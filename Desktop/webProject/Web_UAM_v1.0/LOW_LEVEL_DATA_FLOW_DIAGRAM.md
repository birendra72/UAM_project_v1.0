# Universal Analyst Model (UAM) Backend - Low-Level Data Flow Diagram

This document provides a detailed data flow diagram illustrating how data flows from the frontend through the backend components and back, including the key files responsible for each part.

## Components and Files Involved

- **Frontend API Calls:** `FrontEnd/src/lib/api.ts`
- **FastAPI Routers:** `app/routers/` (e.g., `auth.py`, `projects.py`, `datasets.py`, `runs.py`, `models.py`)
- **Authentication Utilities:** `app/utils/auth.py`
- **Database Models and Session:** `app/db/models.py`, `app/db/session.py`
- **Background Tasks:** `app/workers/tasks.py`, `app/workers/celery_app.py`
- **Object Storage Interface:** `app/storage.py`

## Data Flow Diagram (Mermaid)

```mermaid
flowchart TD
    User[User / Frontend UI]
    APIClient[Frontend API Client<br/>(FrontEnd/src/lib/api.ts)]
    Router[FastAPI Routers<br/>(app/routers/*.py)]
    AuthUtil[Auth Utilities<br/>(app/utils/auth.py)]
    DBSession[DB Session<br/>(app/db/session.py)]
    DBModels[DB Models<br/>(app/db/models.py)]
    CeleryTasks[Celery Tasks<br/>(app/workers/tasks.py)]
    CeleryApp[Celery App<br/>(app/workers/celery_app.py)]
    Storage[Object Storage<br/>(app/storage.py)]
    DB[(PostgreSQL Database)]

    User -->|User Action| APIClient
    APIClient -->|HTTP Request| Router
    Router -->|Auth Check| AuthUtil
    Router -->|DB Access| DBSession
    DBSession --> DBModels
    DBModels --> DB
    Router -->|Trigger Background Task| CeleryApp
    CeleryApp --> CeleryTasks
    CeleryTasks --> DBSession
    CeleryTasks --> Storage
    CeleryTasks --> DB
    Router -->|Return Response| APIClient
    APIClient -->|Display Data| User
```

## Description

1. The user interacts with the frontend UI, which uses the API client (`FrontEnd/src/lib/api.ts`) to send HTTP requests.
2. Requests reach the FastAPI routers (`app/routers/*.py`), which handle routing and business logic.
3. Authentication utilities (`app/utils/auth.py`) verify user credentials and permissions.
4. Routers use the database session (`app/db/session.py`) and models (`app/db/models.py`) to query or update the PostgreSQL database.
5. For long-running or asynchronous tasks, routers trigger Celery tasks via the Celery app (`app/workers/celery_app.py`).
6. Celery workers execute tasks defined in `app/workers/tasks.py`, interacting with the database and object storage (`app/storage.py`) as needed.
7. Responses are returned from the backend to the frontend API client, which updates the UI accordingly.

This detailed flow clarifies the responsibilities of each component and the files involved in processing frontend requests through the backend system.
