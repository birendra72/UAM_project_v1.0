# Universal Analyst Model (UAM) Backend - Project Structure and Interactions

## Overview

This document provides an overview of the project structure, the main components of the Universal Analyst Model backend, their interactions, and the commands used to initiate communication and run the system.

---

## Project Structure

```
/ (root)
├── README.md
├── PROJECT_STRUCTURE.md
├── Dockerfile
├── docker-compose.yml
├── alembic.ini
├── .env.example
├── requirements.txt
├── app/
│   ├── main.py                # FastAPI application entry point
│   ├── config.py              # Configuration settings
│   ├── db/                    # Database models and session management
│   ├── routers/               # API route handlers (auth, projects, datasets, runs, models, etc.)
│   ├── schemas/               # Pydantic schemas for request/response validation
│   ├── utils/                 # Utility functions (e.g., authentication helpers)
│   ├── workers/               # Celery worker and task definitions
│   ├── storage.py             # Object storage interface (MinIO)
│   └── dependencies/          # Dependency injection for FastAPI routes
├── alembic/                   # Database migration scripts
├── tests/                     # Test cases and fixtures
├── FrontEnd/                  # Frontend source code (React/TypeScript)
└── storage/                   # Local storage for datasets and artifacts (optional)
```

---

## Component Interactions

- **FastAPI app (app/main.py)**
  - Serves REST API endpoints.
  - Registers routers for authentication, projects, datasets, runs, models, etc.
  - Uses dependency injection for database sessions, authentication, and other services.

- **Database (PostgreSQL)**
  - Stores user data, projects, datasets metadata, runs, models metadata.
  - Accessed via SQLAlchemy ORM in `app/db/`.

- **Celery Workers (app/workers/)**
  - Handle background tasks such as data processing, model training, and analysis runs.
  - Communicate with Redis as a message broker.

- **Object Storage (MinIO)**
  - Stores datasets, model artifacts, and analysis outputs.
  - Accessed via `app/storage.py`.

- **Authentication**
  - JWT-based authentication handled in `app/routers/auth.py` and `app/utils/auth.py`.
  - Protects API endpoints and manages user sessions.

- **Frontend (FrontEnd/)**
  - React/TypeScript SPA that interacts with the backend API.
  - Provides user interface for project management, dataset upload, model training, and results visualization.

---

## Communication Flow and Commands

1. **Starting the backend and dependencies (Docker Compose):**

```bash
docker-compose up --build
```

- Starts PostgreSQL, Redis, MinIO, FastAPI backend, and Celery workers.
- Backend API available at `http://localhost:8000/api/docs`.

2. **Local development without Docker:**

- Create and activate Python virtual environment.
- Install dependencies:

```bash
pip install -r requirements.txt
```

- Run database migrations:

```bash
alembic upgrade head
```

- Start FastAPI server with auto-reload:

```bash
uvicorn app.main:app --reload
```

- Start Celery worker in a separate terminal:

```bash
celery -A app.workers.celery_app worker --loglevel=info
```

3. **API Requests:**

- Frontend or API clients send HTTP requests to FastAPI endpoints.
- FastAPI routes handle requests, interact with the database, and enqueue background tasks.
- Celery workers process background tasks asynchronously.
- Results and artifacts are stored in PostgreSQL and MinIO, accessible via API.

---

## Summary

- The FastAPI backend is the core service exposing REST APIs.
- PostgreSQL stores structured data.
- Redis and Celery handle asynchronous task processing.
- MinIO manages object storage.
- Frontend interacts with backend APIs for user operations.
- Docker Compose simplifies running the entire stack locally or in production.

This structure ensures modularity, scalability, and maintainability of the Universal Analyst Model platform.
