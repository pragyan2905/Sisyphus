# Sisyphus

**Sisyphus** is an enterprise-grade, highly scalable uptime monitoring service. Like the Greek myth of Sisyphus forever pushing his boulder, this system tirelessly runs in the background, endlessly pinging target servers to ensure they remain alive, logging their response times, and providing instant observability.

## System Architecture

To prevent memory bloat, out-of-memory (OOM) crashes, and event-loop freezing, the architecture is entirely decoupled. It relies on a Message Broker (Redis) to separate the web server from the background execution workers.

### Architecture Diagram

```mermaid
flowchart TD
    User((User Browser)) -->|Interacts| UI[React Dashboard]
    UI -->|HTTP REST| API[FastAPI Server]

    subgraph API Layer
        API --> Auth[Google OAuth & JWT]
        API --> RL[Rate Limiter]
    end

    subgraph Data Layer
        DB[(PostgreSQL)]
        Queue[(Redis)]
    end

    API <-->|R/W Users & Services| DB
    RL <-->|Check/Incr Limits| Queue

    subgraph Execution Layer
        Sched[Scheduler Daemon]
        Worker1[Async Worker 1]
        Worker2[Async Worker N]
    end

    Sched -->|1. Fetch active monitors in batches| DB
    Sched -->|2. Push 'ping_jobs'| Queue

    Queue -->|3. Consume (BRPOP)| Worker1
    Queue -->|3. Consume (BRPOP)| Worker2

    Worker1 -->|4. Async HTTP GET| Target1{{Target Service A}}
    Worker2 -->|4. Async HTTP GET| Target2{{Target Service B}}

    Worker1 -->|5. Save Latency & Status| DB
    Worker2 -->|5. Save Latency & Status| DB
```

## Tech Stack
*   **Backend API**: Python, FastAPI, SQLAlchemy
*   **Frontend**: React.js, Vite, Vanilla CSS
*   **Database**: PostgreSQL (Relational persistence)
*   **Message Broker & Cache**: Redis (Task Queueing & Rate Limiting)
*   **Authentication**: Google OAuth 2.0 & JWT (JSON Web Tokens)
*   **Testing**: Pytest & HTTPX

## Core Features & Engineering Decisions

### 1. Decoupled Execution (The Worker Pattern)
If an API server attempts to ping thousands of URLs synchronously, it will freeze the entire application. Sisyphus solves this by running a standalone `scheduler.py` daemon that queries the database using `.limit(500)` paginated chunks, and pushes those jobs to a Redis `ping_jobs` list. Independent `worker.py` instances use `brpop` to consume those jobs and perform the pings asynchronously using `httpx`.

### 2. Multi-Tenancy & JWT Auth
The API is fully locked down using a Dependency Injection (`get_current_user`). When a user logs in via Google, the backend generates a secure JWT. All API routes (like adding a service or viewing history) require this token in the `Authorization: Bearer` header, enforcing strict row-level separation so users can only see and ping their own services.

### 3. Redis Rate Limiting (Fixed Window)
To protect the backend from abuse, the `POST /services` endpoint is protected by a custom Redis Rate Limiter. It tracks requests by Client IP and enforces a strict limit (e.g., 20 requests per minute).

### 4. Structured Logging
Instead of raw print statements, the backend uses a custom `JSONFormatter`. All output is structured JSON, making it production-ready for ingestion by observability platforms like Datadog, Splunk, or AWS CloudWatch.

## Deployment
This project is configured for 1-click deployment on **Render.com**. 
The `render.yaml` file defines a full stack:
1. `sisyphus-api` (Web Service)
2. `sisyphus-worker` (Background Worker)
3. `sisyphus-scheduler` (Background Worker)
4. `sisyphus-redis` (Internal Redis)
5. `sisyphus-db` (Internal PostgreSQL)
6. `sisyphus-frontend` (Static React Site)

### Local Development
```bash
# 1. Start Postgres and Redis
docker-compose up -d

# 2. Start the Backend API
source venv/bin/activate
uvicorn main:app --reload --port 8080

# 3. Start the Background Workers
python scheduler.py
python worker.py

# 4. Start the Frontend
cd client
npm run dev
```
