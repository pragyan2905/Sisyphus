import time
import httpx
import asyncio

# This URL intentionally takes exactly 1 second to respond.
URL = "https://httpbin.org/delay/1"  

def run_synchronous():
    print("--- Starting Synchronous requests (Blocking I/O) ---")
    start = time.time()
    
    with httpx.Client() as client:
        for i in range(5):
            print(f"Sending Sync Request {i+1}...")
            client.get(URL)
            
    end = time.time()
    print(f"Synchronous total time: {end - start:.2f} seconds\n")


async def fetch_async(client, i):
    print(f"Sending Async Request {i+1}...")
    await client.get(URL)

async def run_asynchronous():
    print("--- Starting Asynchronous requests (Non-Blocking I/O) ---")
    start = time.time()
    
    async with httpx.AsyncClient() as client:
        # We create 5 "Coroutines" (tasks that can be paused)
        tasks = []
        for i in range(5):
            tasks.append(fetch_async(client, i))
            
        # We tell the Event Loop: "Run all these tasks concurrently!"
        await asyncio.gather(*tasks)
        
    end = time.time()
    print(f"Asynchronous total time: {end - start:.2f} seconds\n")

if __name__ == "__main__":
    run_synchronous()
    asyncio.run(run_asynchronous())
