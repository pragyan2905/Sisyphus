import time
import json
import redis
import models
import os
from logger import get_logger

logger = get_logger("scheduler")

# Connect to the Redis container
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6380")

def start_scheduler():
    # 1. Connect to Redis (Our Message Broker)
    r = redis.from_url(REDIS_URL)
    
    # 2. Connect to PostgreSQL
    db = SessionLocal()
    
    logger.info("Scheduler started. Checking for jobs every 60 seconds...")
    
    while True:
        # Fetch active services in batches to avoid OOM crash on massive tables
        offset = 0
        batch_size = 500
        while True:
            services = db.query(models.Service).filter(models.Service.is_active == True).limit(batch_size).offset(offset).all()
            if not services:
                break
            
            for service in services:
                job = {
                    "service_id": service.id,
                    "url": service.url
                }
                r.lpush("ping_jobs", json.dumps(job))
                logger.info(f"Scheduler: Queued job for {service.url}")
                
            offset += batch_size
            
        logger.info("Scheduler: Sleeping for 60 seconds...")
        time.sleep(60)

if __name__ == "__main__":
    start_scheduler()
