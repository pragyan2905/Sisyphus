import asyncio
import json
import httpx
import time
import redis
import redis.exceptions
from database import SessionLocal
import models
import os
from logger import get_logger

logger = get_logger("worker")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6380")

async def process_ping_job(job_data):
    url = job_data.get("url")
    service_id = job_data.get("service_id")
    
    logger.info(f"[{service_id}] Ping started: {url}")
    
    # 1. Start the stopwatch
    start_time = time.time()
    
    status_code = 0
    is_success = False
    error_message = None
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            status_code = response.status_code
            # Any 2xx or 3xx code is a success
            is_success = (200 <= status_code < 400)
    except Exception as e:
        error_message = str(e)
    
    # 2. Stop the stopwatch and calculate latency
    end_time = time.time()
    latency_ms = (end_time - start_time) * 1000
    
    # 3. Save the result to PostgreSQL
    db = SessionLocal()
    try:
        ping_result = models.PingResult(
            service_id=service_id,
            status_code=status_code,
            response_time_ms=latency_ms,
            is_success=is_success,
            error_message=error_message
        )
        db.add(ping_result)
        db.commit()
        logger.info(f"[{service_id}] Logged to DB: {status_code}, {latency_ms:.0f}ms")
    except Exception as db_err:
        logger.error(f"[{service_id}] DB Error: {db_err}")
    finally:
        db.close()

async def start_worker():
    r = redis.from_url(REDIS_URL)
    logger.info("Worker is listening to Redis queue 'ping_jobs'...")
    
    while True:
        try:
            # Run the blocking brpop in a separate thread so it doesn't freeze the async worker
            result = await asyncio.to_thread(r.brpop, "ping_jobs", 5)
            if result:
                queue_name, job_string = result
                job_data = json.loads(job_string)
                asyncio.create_task(process_ping_job(job_data))
        except redis.exceptions.TimeoutError:
            continue
        except Exception as e:
            import traceback
            traceback.print_exc()
            logger.error(f"Worker Error: {e}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(start_worker())
