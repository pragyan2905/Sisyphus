import pytest
from fastapi.testclient import TestClient
from main import app
import security
import models
from database import engine, SessionLocal

# Recreate tables before testing to ensure clean state
models.Base.metadata.create_all(bind=engine)

client = TestClient(app)

def get_test_token():
    db = SessionLocal()
    user = db.query(models.User).filter(models.User.email == "test@test.com").first()
    if not user:
        user = models.User(email="test@test.com")
        db.add(user)
        db.commit()
        db.refresh(user)
    token = security.create_access_token(user.id)
    db.close()
    return token

def test_health_check():
    """Test that the API is up and connected to PostgreSQL."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}

def test_create_service():
    """Test that we can create a new service."""
    # First, clear the database to avoid hitting the 5-service limit during test
    db = SessionLocal()
    db.query(models.Service).delete()
    db.commit()
    
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.post("/services", json={
        "name": "Pytest Target",
        "url": "https://example.com",
        "interval_minutes": 5
    }, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Pytest Target"
    assert data["url"] == "https://example.com"
    assert data["interval_minutes"] == 5
    assert data["is_active"] == True
    
    db.close()

def test_rate_limiter_active():
    """Test that the rate limiter headers or blocks exist on rapid requests."""
    token = get_test_token()
    headers = {"Authorization": f"Bearer {token}"}
    
    responses = []
    for _ in range(25):
        responses.append(client.post("/services", json={
            "name": "Spam Service",
            "url": "https://spam.com",
            "interval_minutes": 5
        }, headers=headers))
        
    # At least one response should trigger the 429 Rate Limit
    rate_limited = any(r.status_code == 429 for r in responses)
    assert [r.status_code for r in responses[-5:]] == [429, 429, 429, 429, 429]
