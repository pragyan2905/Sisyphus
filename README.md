# Sisyphus

Sisyphus is an asynchronous uptime monitoring service. It periodically pings registered HTTP endpoints, records response time and status codes, and exposes that telemetry via a REST API and React dashboard. The system is built on a decoupled Producer-Consumer architecture backed by Redis, ensuring the API server never blocks on I/O-heavy ping operations.

## Architecture

```mermaid
flowchart TD
    User(["User Browser"])

    User -->|"Interacts with"| UI

    subgraph FRONTEND ["Web Dashboard (Frontend)"]
        UI["React Dashboard"]
    end

    UI -->|"HTTP Requests"| FastAPI

    subgraph APILAYER ["API Layer (FastAPI)"]
        FastAPI["FastAPI Server"]
        FastAPI -->|"Login"| OAuth["Google OAuth & JWT"]
        FastAPI -->|"Check limits"| RateLimit["Rate Limiter"]
    end

    subgraph DATALAYER ["Data Layer"]
        PG[("PostgreSQL")]
        Redis[("Redis Cache / Queue")]
    end

    FastAPI <-->|"Read/Write user & service configs"| PG
    RateLimit <-.->|"Read/Write counts"| Redis

    subgraph EXECUTION ["Execution Layer"]
        Sched["Scheduler Process"]
        W1["Async Worker 1"]
        W2["Async Worker 2"]
        WN["Async Worker N"]
    end

    PG -->|"1. Fetch active services"| Sched
    Sched -->|"2. Push ping_jobs"| Redis
    Redis -->|"3. Consume jobs"| W1
    Redis -->|"3. Consume jobs"| W2
    Redis -->|"3. Consume jobs"| WN

    W1 -->|"4. HTTP"| TA{{" Target Service A"}}
    W2 -->|"4. HTTP"| TB{{" Target Service B"}}

    W1 -->|"5. Save ping result & latency"| PG
    W2 -->|"5. Save ping result & latency"| PG

    classDef userStyle fill:#e879f9,stroke:#d946ef,color:#fff
    classDef frontendStyle fill:#f0abfc,stroke:#d946ef,color:#1a1a1a
    classDef apiStyle fill:#e9d5ff,stroke:#a855f7,color:#1a1a1a
    classDef dataStyle fill:#99f6e4,stroke:#14b8a6,color:#1a1a1a
    classDef execStyle fill:#fed7aa,stroke:#f97316,color:#1a1a1a
    classDef targetStyle fill:#bbf7d0,stroke:#22c55e,color:#1a1a1a

    class User userStyle
    class UI frontendStyle
    class FastAPI,OAuth,RateLimit apiStyle
    class PG,Redis dataStyle
    class Sched,W1,W2,WN execStyle
    class TA,TB targetStyle
```

## Tech Stack

| Layer | Technology |
|---|---|
| API | Python 3.13, FastAPI, SQLAlchemy |
| Frontend | React 18, Vite |
| Database | PostgreSQL 15 |
| Message Queue | Redis 7 |
| Auth | Google OAuth 2.0, PyJWT |
| Testing | Pytest, HTTPX |
| Deployment | Render (render.yaml Blueprint) |

## API Documentation

The REST API is fully documented via an interactive, auto-generated Swagger UI interface. Once deployed (or running locally), navigate to `/docs` to view the OpenAPI specifications, authenticate via the UI, and execute test requests directly against the live endpoints.

## Core Implementations

*   **Producer-Consumer Queue**: `scheduler.py` queries targets and pushes to a Redis `ping_jobs` list. Independent `worker.py` instances use `BRPOP` to execute the HTTP requests asynchronously.
*   **Database Pagination**: The scheduler pulls active monitors from PostgreSQL using `.limit(500).offset(n)` batches to enforce strict memory bounds at scale.
*   **Multi-Tenancy**: Data separation is enforced at the API layer via a `get_current_user` FastAPI dependency. All records are hard-scoped to the authenticated `owner_id`.
*   **Rate Limiting**: `POST /services` utilizes a fixed-window algorithm in Redis (`INCR` + `EXPIRE`) to throttle requests by client IP with O(1) time complexity.
*   **Structured Telemetry**: A custom `JSONFormatter` intercepts standard Python logging to output machine-readable JSON logs for compatibility with external observability pipelines.

## Local Development

### Prerequisites
- Docker Desktop
- Python 3.13+
- Node.js 18+

### Environment Configuration
```env
DATABASE_URL=postgresql+psycopg2://admin:password@localhost:5433/sisyphus_db
REDIS_URL=redis://localhost:6380
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
SECRET_KEY=your_secure_secret
```

### Start Infrastructure
```bash
docker-compose up -d
```

### Start Backend Services
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

uvicorn main:app --reload --port 8080   # Terminal 1
python scheduler.py                      # Terminal 2
python worker.py                         # Terminal 3
```

### Start Frontend
```bash
cd client && npm install && npm run dev
```

## Testing
```bash
source venv/bin/activate
pytest test_api.py -v
```

The test suite covers health checks, authenticated service creation, and rate limiter enforcement.

## Deployment

Provisioned via `render.yaml` as a Render Blueprint. Creates 6 services in a single deploy:

```
sisyphus-api         Web Service   (FastAPI)
sisyphus-worker      Background    (Async Pinger)
sisyphus-scheduler   Background    (Job Producer)
sisyphus-redis       Redis         (Queue & Rate Limiter)
sisyphus-db          PostgreSQL    (Data Store)
sisyphus-frontend    Static Site   (React CDN Build)
```

Services communicate over Render's internal network using environment variables injected at build time via `fromService` and `fromDatabase` references in `render.yaml`.
