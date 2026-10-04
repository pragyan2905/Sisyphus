from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# The connection string to our Docker container. 
# Format: postgresql://user:password@host:port/database_name
SQLALCHEMY_DATABASE_URL = "postgresql://admin:password@localhost:5433/keepalive_db"

# The Engine is the core that actually handles the TCP connection pool to PostgreSQL.
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# A Session is a temporary "workspace" for your database operations.
# You use a session to add/update rows, and then "commit" the transaction.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All our database models will inherit from this Base class.
Base = declarative_base()

# This is a FastAPI Dependency. It creates a new database session for every HTTP request,
# and safely closes the connection when the request is done.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
