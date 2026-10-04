from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    
    # Relationship to Service. 
    # cascade="all, delete-orphan" tells SQLAlchemy to delete all services if this user is deleted.
    services = relationship("Service", back_populates="owner", cascade="all, delete-orphan")

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    url = Column(String)
    interval_minutes = Column(Integer)
    is_active = Column(Boolean, default=True)
    
    # Foreign key linking this service to a specific user.
    # ondelete="CASCADE" tells the PostgreSQL engine to enforce this at the database level.
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    
    # Relationship back to the User
    owner = relationship("User", back_populates="services")
