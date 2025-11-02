# Universal Analyst Model — Backend Implementation Procedure

## 1 — Short summary (goal for the agent)

Build a **production-ready backend** for UAM that:

* Implements the API contract for the sitemap and frontend,
* Stores metadata & artifacts in Postgres + MinIO,
* Runs background worker pipelines (Celery + Redis) for EDA / AutoML / reports,
* Exposes endpoints for runs, artifacts, model serving & NLQ placeholder,
* Is containerized, testable locally (docker-compose), and ready for cloud deployment,
* Uses only free/open-source technologies and is easily scalable to 500–1000 users.

---

## 2 — Tech stack (what to use, and for which functions)

* **FastAPI** — main REST API (endpoints, OpenAPI docs `/docs`).

  * Handles authentication, dataset & run lifecycle, artifact listing, presigned links.

* **Uvicorn (ASGI)** — run FastAPI (with Gunicorn for multiworkers in production).

* **PostgreSQL** — relational metadata: users, projects, datasets, runs, artifacts, models, logs.

* **SQLAlchemy + Alembic** — ORM + migrations.

* **Redis** — Celery broker and caching (also pub/sub for live progress notifications).

* **Celery** — background workers for preprocessing, EDA, model training, report generation.

* **MinIO (S3-compatible)** — object store for charts, PDFs and model files (locally in dev; can switch to AWS S3 later).

* **joblib** — serialize trained models.

* **pandas / numpy / scikit-learn / seaborn / matplotlib / plotly** — for EDA, modeling, and charts.

* **ReportLab or WeasyPrint** — render Markdown/HTML → PDF.

* **passlib (bcrypt)** + **PyJWT** — authentication, password hashing, JWT token management.

* **Docker / docker-compose** — dev and basic prod orchestration.

* **GitHub Actions** — CI (unit tests, linters, build images).

* **Prometheus + Grafana** (optional for production) and **Sentry** (error tracking).

---

## 3 — High-level system pieces the agent should deliver

1. **Project skeleton & config**

   * `app/` Python package
   * `app/main.py` — FastAPI app with CORS, middleware, logging
   * `app/config.py` — env-driven config (DATABASE_URL, REDIS_URL, MINIO creds, SECRET_KEY)
   * `.env.example`

2. **Auth**

   * `/auth/register`, `/auth/login`, `/auth/me`
   * JWT access token (+ refresh optional)
   * Password hashing (bcrypt)

3. **Database models & migrations**

   * `User`, `Project`, `Dataset`, `Run`, `Artifact`, `ModelMeta`, `Log`
   * Alembic migrations

4. **File storage abstraction**

   * `storage.py` with pluggable backends: `LocalStorage` (dev) + `S3MinIOClient` (prod)
   * Functions: `upload_bytes`, `download_stream`, `presign_url`, `list_prefix`

5. **Dataset endpoints**

   * `POST /datasets/upload` (multipart) -> returns `dataset_id` + sample preview
   * `GET /datasets/{id}/preview` -> first N rows cached
   * `GET /datasets/` -> list user datasets

6. **Run management**

   * `POST /runs/start` -> create `Run` row, enqueue Celery chain (preprocess→eda→train→finalize)
   * `GET /runs/{run_id}/status` -> returns stage, progress, logs
   * `GET /runs/{run_id}/artifacts` -> list artifact metadata + presigned URLs

7. **Worker integration**

   * `workers/celery_app.py` config
   * tasks: `preprocess_data`, `run_eda`, `train_models`, `finalize_run`
   * tasks save artifacts to MinIO and update `Run` status in DB

8. **Model serving**

   * `GET /models/` list
   * `POST /models/{model_id}/predict` -> accepts JSON or CSV, returns predictions and stores results as artifact

9. **Reports**

   * `POST /reports/generate` or generated as part of finalize task
   * `GET /reports/{report_id}/download` -> presigned link or streaming

10. **NLQ placeholder**

    * `POST /nlq` returning structured placeholder (ready to integrate LLM later)

11. **Admin routes** (protected)

    * `/admin/users`, `/admin/stats`, `/admin/logs`

12. **Docker & docker-compose**

    * Services: `postgres`, `redis`, `minio`, `web` (FastAPI), `worker` (Celery)

13. **Tests**

    * Pytest suite: auth, dataset upload, run start, run status

14. **OpenAPI docs**

    * Validate `/docs` contains all endpoints and schemas

---

## 4 — Database schema (concise)

Use UUID primary keys (string) where helpful.

**User**

* id (uuid), name, email (unique), password_hash, role (user/admin), created_at

**Project**

* id, user_id (FK), name, description, created_at

**Dataset**

* id, project_id, filename, storage_key, rows, cols, columns_json, uploaded_at

**Run**

* id, project_id, dataset_id, status, current_task, started_at, finished_at, parameters_json, progress (0-100)

**Artifact**

* id, run_id, type (chart/pdf/model/prediction), storage_key, filename, metadata_json, created_at

**ModelMeta**

* id, run_id, name, storage_key, metrics_json, created_at, version

**Log**

* id, run_id, level, message, timestamp

---

## 5 — API contract (examples the agent must implement)

(Only key endpoints shown — full OpenAPI required.)

* `POST /auth/register`
  body: `{name, email, password}`
  returns: `{access_token, token_type, user}`

* `POST /auth/login`
  body: `{email, password}`
  returns: `{access_token, token_type, user}`

* `POST /datasets/upload` (multipart)
  form-data: `file`, `project_id`
  returns: `{dataset_id, preview: {columns, first_rows}}`

* `POST /runs/start`
  body: `{project_id, dataset_id, options}`
  returns: `{run_id, status}`

* `GET /runs/{run_id}/status`
  returns: `{run_id, status, current_task, progress, logs[]}`

* `GET /runs/{run_id}/artifacts`
  returns list of artifacts with presigned `download_url`

* `POST /models/{model_id}/predict`
  body: JSON rows or uploaded CSV -> returns predictions

* `GET /reports/{report_id}/download`
  returns presigned link or binary stream

All endpoints with authentication require `Authorization: Bearer <token>` header (use OAuth2PasswordBearer).

---

## 6 — Worker chain & DB update pattern (implementation detail)

* When `POST /runs/start` is called:

  1. Create `Run` DB row with `status='PENDING'`.
  2. Enqueue Celery chain:

     ```
     preprocess_data.s(run_id, dataset_key) |
     run_eda.s(run_id) |
     train_models.s(run_id) |
     finalize_run.s(run_id)
     ```
  3. Return `run_id` to client.

* Each task:

  * Loads DB session, sets `Run.status` to current stage (e.g., `RUNNING`, `EDA_COMPLETED`)
  * Writes logs to `Log` table
  * On success, writes artifacts to MinIO and inserts `Artifact` rows with storage keys
  * On failure, writes `Log`, sets `Run.status='FAILED'` and returns error details

* `finalize_run` writes `artifacts_manifest.json` and stores it as `Artifact`.

---

## 7 — Storage & downloads (MinIO)

* Agent must implement `storage.minio_client` wrapper:

  * `upload_fileobj(bucket, key, fileobj, metadata)` returns `storage_key`
  * `get_presigned_url(bucket, key, expiry_seconds=3600)` returns URL
* Artifacts should be private; frontend downloads via presigned link.

---

## 8 — Security & operational rules the agent must follow

* Validate uploads (max file size, allowed extensions)
* Sanitize filenames
* Use secure JWT secret from env
* Rate-limit run creation per user (e.g., 3 concurrent runs)
* Ensure tasks are idempotent
* Use HTTPS in production (certificate management outside agent)

---

## 9 — CI / Testing / Deployment plan (agent must include)

* **CI steps (GitHub Actions)**:

  * Run unit tests (pytest)
  * Lint (flake8 or ruff)
  * Build Docker images
  * Push images to registry (optional for you)

* **Local dev**: `docker-compose up --build`

* **Production**: deploy images to Render/Railway/Hetzner/K8s

* Provide clear `README.md` with run instructions and env variables.

---


## 11 — Handoff outputs (what the agent must submit)

* Full repository with code (organized under `app/`)
* `docker-compose.yml` and Dockerfiles
* Alembic migrations
* `README.md` with run & deployment instructions
* Postman collection or OpenAPI export
* Minimal test coverage (auth, upload, run lifecycle)
* Example dataset and example run demonstrating EDA + model saved

---

## 12 — Example commands & environment variables (agent should include)

`.env.example`

```
DATABASE_URL=postgresql://uam:uam_pass@postgres:5432/uam_db
REDIS_URL=redis://redis:6379/0
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=artifacts
SECRET_KEY=<strong-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Start locally:

```bash
docker-compose up --build
# In web container
alembic upgrade head
```

Trigger run (curl):

```bash
curl -X POST "http://localhost:8000/runs/start" -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"project_id":"...","dataset_id":"..."}'
```

---