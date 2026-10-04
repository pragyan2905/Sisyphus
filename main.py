from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel

import models
from database import engine, get_db

# This line automatically creates all tables in PostgreSQL based on models.py
models.Base.metadata.create_all(bind=engine)

app = FastAPI()

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

# --- API Endpoints ---
@app.get("/health")
def health_check():
    return {"status": "ok", "database": "connected"}

@app.get("/services", response_model=list[ServiceResponse])
def get_all_services(db: Session = Depends(get_db)):
    return db.query(models.Service).all()

@app.get("/services/{service_id}", response_model=ServiceResponse)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    return service

@app.post("/services", response_model=ServiceResponse)
def create_service(service: ServiceCreate, db: Session = Depends(get_db)):
    db_service = models.Service(
        name=service.name,
        url=service.url,
        interval_minutes=service.interval_minutes
    )
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service
