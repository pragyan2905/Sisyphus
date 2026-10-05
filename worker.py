import asyncio
import json
import httpx
import redis.asyncio as redis
import redis.exceptions

REDIS_URL = "redis://localhost:6380"

async def process_ping_job(job_data):
    """The actual work function. This takes the job data and executes the HTTP request."""
    url = job_data.get("url")
    service_id = job_data.get("service_id")
    
    print(f"[{service_id}] Ping started: {url}")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=5.0)
            print(f"[{service_id}] SUCCESS: {url} returned {response.status_code}")
    except Exception as e:
        print(f"[{service_id}] FAILED: {url} - Error: {e}")

async def start_worker():
    """The Consumer loop. It listens to the Redis queue permanently."""
    r = redis.from_url(REDIS_URL)
    print("Worker is listening to Redis queue 'ping_jobs'...")
    
    while True:
        try:
            # We use timeout=5 instead of timeout=0. 
            # If no job arrives in 5 seconds, it returns None and loops again.
            # This prevents the underlying network socket from timing out and crashing the worker!
            result = await r.brpop("ping_jobs", timeout=5)
            
            if result:
                queue_name, job_string = result
                job_data = json.loads(job_string)
                
                asyncio.create_task(process_ping_job(job_data))
                
        except redis.exceptions.TimeoutError:
            # This is expected network behavior. We just loop again.
            continue
        except Exception as e:
            print(f"Worker experienced a fatal error: {e}")
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(start_worker())
