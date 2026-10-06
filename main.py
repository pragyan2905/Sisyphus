from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from authlib.integrations.starlette_client import OAuth
import os
import security

import models
from database import engine, get_db
import redis
import threading
from contextlib import asynccontextmanager
from scheduler import start_scheduler
from worker import start_worker

# --- Lifecycle Manager for Free Tier Hack ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Launch the scheduler and worker as background threads
    # so they run inside the free Web Service!
    scheduler_thread = threading.Thread(target=start_scheduler, daemon=True)
    worker_thread = threading.Thread(target=start_worker, daemon=True)
    
    scheduler_thread.start()
    worker_thread.start()
    yield


# Auto-create new tables (like PingResult)
models.Base.metadata.create_all(bind=engine)

# Redis client for Rate Limiting
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6380")
try:
    redis_client = redis.from_url(REDIS_URL)
    redis_client.ping()  # Test the connection
except Exception:
    redis_client = None

def check_rate_limit(request: Request):
    # Phase 11: Rate Limiting (Fixed Window)
    # Allow max 20 requests per minute per IP address
    if redis_client is None:
        return  # Skip rate limiting if Redis is unavailable
    
    client_ip = request.client.host
    key = f"rate_limit:{client_ip}"
    
    requests = redis_client.get(key)
    if requests and int(requests) >= 20:
        raise HTTPException(status_code=429, detail="Too Many Requests. Please slow down.")
        
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, 60) # Reset the counter every 60 seconds
    pipe.execute()

app = FastAPI(
    title="Sisyphus API",
    description="Enterprise-grade background monitoring and ping service API.",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    SessionMiddleware, 
    secret_key=os.getenv("SECRET_KEY", "super-secret-local-dev-key")
)

frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- OAuth Setup ---
oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID", "mock-client-id"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET", "mock-secret"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# --- Pydantic Models ---
class ServiceCreate(BaseModel):
    name: str
    url: str
    interval_minutes: int

class ServiceResponse(BaseModel):
    id: int
    name: str
    url: str
    interval_minutes: int
    is_active: bool

    class Config:
        from_attributes = True 

class PingResultResponse(BaseModel):
    id: int
    timestamp: datetime
    status_code: int
    response_time_ms: float
    is_success: bool
    error_message: Optional[str] = None

    class Config:
        from_attributes = True

# --- Authentication Dependency ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = security.verify_token(token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- API Endpoints ---
@app.get("/auth/login")
async def login(request: Request):
    # This will redirect the user to Google's login page
    redirect_uri = request.url_for('auth_callback')
    return await oauth.google.authorize_redirect(request, redirect_uri)

@app.get("/auth/callback")
async def auth_callback(request: Request, db: Session = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception:
        raise HTTPException(status_code=400, detail="OAuth Failed. Did you set GOOGLE_CLIENT_ID in .env?")
        
    user_info = token.get('userinfo')
    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")
    
    email = user_info.get("email")
    
    # 1. Multi-Tenancy: Create user in Postgres if they don't exist
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        user = models.User(email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
        
    # 2. Security: Generate JWT token for this user session
    jwt_token = security.create_access_token(user.id)
    
    # 3. Redirect back to frontend with the token
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend_url}?token={jwt_token}")

@app.get("/health")
def health_check():
    return {"status": "ok", "database": "connected"}

@app.get("/services", response_model=list[ServiceResponse])
def get_all_services(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Service).filter(models.Service.owner_id == current_user.id).all()

@app.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    service = db.query(models.Service).filter(models.Service.id == service_id, models.Service.owner_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@app.post("/services", response_model=ServiceResponse, dependencies=[Depends(check_rate_limit)])
def create_service(service: ServiceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Phase 9: Service Limits & Plans
    # Enforce a Free Tier limit of 5 services per user.
    service_count = db.query(models.Service).filter(models.Service.owner_id == current_user.id).count()
    if service_count >= 5:
        raise HTTPException(
            status_code=403, 
            detail="Free Tier limit reached (Max 5 services). Please subscribe to Pro."
        )

    db_service = models.Service(
        name=service.name,
        url=service.url,
        interval_minutes=service.interval_minutes,
        owner_id=current_user.id
    )
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service

@app.get("/services/{service_id}/history", response_model=list[PingResultResponse])
def get_service_history(service_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Validate owner
    service = db.query(models.Service).filter(models.Service.id == service_id, models.Service.owner_id == current_user.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    # Fetch the 50 most recent pings for this service
    results = db.query(models.PingResult)\
        .filter(models.PingResult.service_id == service_id)\
        .order_by(models.PingResult.timestamp.desc())\
        .limit(50).all()
    return results

@app.put("/services/{service_id}/toggle-pause")
def toggle_service_pause(
    service_id: int, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = db.query(models.Service).filter(
        models.Service.id == service_id, 
        models.Service.owner_id == current_user.id
    ).first()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    service.is_active = not service.is_active
    db.commit()
    return {"message": "Service toggled", "is_active": service.is_active}

@app.delete("/services/{service_id}")
def delete_service(
    service_id: int, 
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    service = db.query(models.Service).filter(
        models.Service.id == service_id, 
        models.Service.owner_id == current_user.id
    ).first()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    db.delete(service)
    db.commit()
    return {"message": "Service successfully deleted"}
