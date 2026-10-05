from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Float
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    
    # Relationship to Service
    services = relationship("Service", back_populates="owner", cascade="all, delete-orphan")

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String)
    interval_minutes = Column(Integer)
    is_active = Column(Boolean, default=True)
    
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    owner = relationship("User", back_populates="services")
    
    # A Service has many PingResults
    ping_results = relationship("PingResult", back_populates="service", cascade="all, delete-orphan")

class PingResult(Base):
    __tablename__ = "ping_results"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"))
    
    # When did the ping happen? Auto-set by the DB.
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # The HTTP Status (e.g. 200, 404, 500)
    status_code = Column(Integer)
    
    # How fast was it?
    response_time_ms = Column(Float)
    
    # Did it succeed?
    is_success = Column(Boolean)
    
    # If it failed (like a DNS error), store it here
    error_message = Column(String, nullable=True)

    service = relationship("Service", back_populates="ping_results")
