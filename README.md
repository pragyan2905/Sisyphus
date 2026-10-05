# Sisyphus

A scalable, asynchronous uptime monitoring system built on a decoupled queue architecture.

## Architecture

```mermaid
flowchart TD
    User([User Browser]) -->|"HTTP"| UI[React Dashboard]
    UI -->|"REST API"| API[FastAPI Server]

    subgraph API Layer
        API --> Auth[Google OAuth & JWT]
        API --> RL[Rate Limiter]
    end

    subgraph Data Layer
        DB[(PostgreSQL)]
        Queue[(Redis)]
    end

    API <-->|"R/W Configs"| DB
    RL <-->|"Enforce Quotas"| Queue

    subgraph Execution Layer
        Sched[Scheduler Daemon]
        Worker1[Async Worker 1]
        Worker2[Async Worker N]
    end

    Sched -->|"Fetch Active Targets"| DB
    Sched -->|"Push ping_jobs"| Queue

    Queue -->|"Consume BRPOP"| Worker1
    Queue -->|"Consume BRPOP"| Worker2

    Worker1 -->|"Async HTTP GET"| Target1{{Target Service A}}
    Worker2 -->|"Async HTTP GET"| Target2{{Target Service B}}

    Worker1 -->|"Save Status & Latency"| DB
    Worker2 -->|"Save Status & Latency"| DB
```

## Tech Stack
*   **Backend:** Python, FastAPI, SQLAlchemy
*   **Frontend:** React.js, Vite
*   **Infrastructure:** PostgreSQL, Redis
*   **Authentication:** Google OAuth 2.0 (JWT)
*   **Testing:** Pytest, HTTPX

## System Components
1. **API Server (`main.py`)**: Exposes REST endpoints, enforces fixed-window rate limiting via Redis, and handles JWT generation and validation.
2. **Scheduler (`scheduler.py`)**: A daemon that queries PostgreSQL for active monitoring targets using paginated batching (`.limit(500)`) and pushes them to the Redis message queue.
3. **Async Workers (`worker.py`)**: Horizontally scalable daemon processes that execute blocking `BRPOP` commands on Redis to consume tasks, performing network I/O asynchronously via `httpx`.

## Setup & Local Development

### 1. Environment Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql+psycopg2://admin:password@localhost:5433/sisyphus_db
REDIS_URL=redis://localhost:6380
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
SECRET_KEY=your_secure_secret
```

### 2. Infrastructure (Docker)
Start the PostgreSQL and Redis containers:
```bash
docker-compose up -d
```

### 3. Backend Services
Initialize the Python environment and run the core services:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 1. Start the FastAPI web server
uvicorn main:app --reload --port 8080

# 2. Start the cron scheduler (run in a separate terminal)
python scheduler.py

# 3. Start the execution worker (run in a separate terminal)
python worker.py
```

### 4. Frontend Client
```bash
cd client
npm install
npm run dev
```

## Automated Testing
Execute the `pytest` suite to validate API routing, database constraints, and rate limiter configurations.
```bash
source venv/bin/activate
pytest test_api.py -v
```

## Deployment
Deployment configuration is provided via `render.yaml`. It automates the provisioning of:
*   PostgreSQL and Redis instances (Internal Network)
*   FastAPI Web Service
*   Scheduler & Worker Background Services
*   React Frontend (Static CDN Build)
