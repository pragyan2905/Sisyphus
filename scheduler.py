import time
import json
import redis
from database import SessionLocal
import models

import os

# Connect to the Redis container
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6380")

def start_scheduler():
    # 1. Connect to Redis (Our Message Broker)
    r = redis.from_url(REDIS_URL)
    
    # 2. Connect to PostgreSQL
    db = SessionLocal()
    
    print("Scheduler started. Checking for jobs every 60 seconds...")
    
    while True:
        # Fetch all active services from the database
        services = db.query(models.Service).filter(models.Service.is_active == True).all()
        
        for service in services:
            # We package the job payload as a Dictionary
            job = {
                "service_id": service.id,
                "url": service.url
            }
            
            # LPUSH: "Left Push". We push the job into a Redis List named "ping_jobs"
            # We must convert the dictionary to a JSON string because Redis only stores text/bytes.
            r.lpush("ping_jobs", json.dumps(job))
            print(f"Scheduler: Queued job for {service.url}")
            
        print("Scheduler: Sleeping for 60 seconds...\n")
        time.sleep(60)

if __name__ == "__main__":
    start_scheduler()
