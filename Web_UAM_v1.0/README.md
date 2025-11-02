# Universal Analyst Model (UAM) Backend

A production-ready backend for the Universal Analyst Model platform, designed to empower data analysts and scientists with intelligent automation and collaborative tools. Our platform provides advanced data cleaning, automated exploratory data analysis (EDA), guided machine learning workflows, and seamless project management to accelerate data-driven decision-making.

## What We Do

- Automate the tedious and error-prone tasks of data cleaning and preprocessing.
- Provide insightful exploratory data analysis reports automatically.
- Guide users through machine learning model training, evaluation, and deployment.
- Enable collaborative project management for data science teams.
- Store and manage datasets, models, and analysis artifacts securely.
- Offer a scalable and extensible backend architecture for enterprise-grade applications.

## What Our Platform Has Achieved

- Delivered a robust REST API built with FastAPI, ensuring high performance and easy integration.
- Implemented secure user authentication and authorization with JWT.
- Integrated PostgreSQL for reliable data storage and SQLAlchemy ORM for database interactions.
- Utilized Celery with Redis for asynchronous background task processing.
- Employed MinIO for scalable object storage of datasets and model artifacts.
- Containerized the entire application with Docker for easy deployment and scalability.
- Provided comprehensive API documentation and testing to ensure quality and maintainability.

## Tech Stack

- FastAPI
- PostgreSQL
- Redis
- Celery
- MinIO
- SQLAlchemy
- Alembic
- Pydantic
- Docker

## Quick Start

### Prerequisites

- Docker and Docker Compose installed on your machine.
- Python 3.12+ (for local development without Docker).

### Running with Docker Compose

1. Clone the repository:

```bash
git clone <repository-url>
cd <repository-folder>
```

2. Copy the example environment file and configure it:

```bash
cp .env.example .env
# Edit .env to set your environment variables as needed
```

3. Build and start the containers:

```bash
docker-compose up --build
```

4. Access the API documentation at:

```
http://localhost:8000/api/docs
```

### Local Development Setup

1. Clone the repository and navigate to the project folder.

2. Create and activate a Python virtual environment:

```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

3. Install the required dependencies:

```bash
pip install -r requirements.txt
```

4. Configure environment variables by copying `.env.example` to `.env` and editing as needed.

5. Initialize the database schema:

```bash
alembic upgrade head
```

6. Run the FastAPI server with auto-reload:

```bash
uvicorn app.main:app --reload
```

7. In a separate terminal, start the Celery worker for background tasks:

```bash
celery -A app.workers.celery_app worker --loglevel=info
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Projects
- `GET /api/projects/` - List projects
- `POST /api/projects/` - Create project

### Datasets
- `POST /api/datasets/upload` - Upload dataset
- `GET /api/datasets/{id}/preview` - Preview dataset
- `GET /api/datasets/` - List datasets

### Runs
- `POST /api/runs/start` - Start analysis run
- `GET /api/runs/{id}` - Get run status
- `GET /api/runs/{id}/artifacts` - List run artifacts

### Models
- `GET /api/models/` - List trained models
- `POST /api/models/{id}/predict` - Make predictions

## Environment Variables

See `.env.example` for required environment variables.

## Testing

Run tests with pytest:

```bash
pytest
```

## Deployment

The application is containerized and can be deployed globally using free-tier cloud services. We recommend using Render for hosting, Supabase for database/storage, and Vercel for the frontend.

### Global Deployment Guide

#### Prerequisites
- GitHub account (for Render deployment)
- Supabase account (free tier available)
- Vercel account (free tier available)
- Render account (free tier available, no trial limits)

#### 1. Set up Supabase (Database & Storage)
1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. In your project dashboard, go to Settings → Database
4. Copy the connection string (it looks like: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`)
5. Go to Settings → API
6. Copy the anon public key and service_role secret key
7. Create a storage bucket named "artifacts" in the Storage section

#### 2. Set up Redis (Upstash - Free Tier)
1. Go to [upstash.com](https://upstash.com) and create a free account
2. Create a new Redis database
3. Copy the Redis URL (it looks like: `redis://default:[password]@[url]:6379`)

#### 3. Deploy Backend to Render
1. Go to [render.com](https://render.com) and create a free account
2. Connect your GitHub repository
3. Create a new Web Service and select "Deploy from GitHub repo"
4. Choose your repository and configure:
   - **Runtime**: Docker
   - **Branch**: main (or your deployment branch)
5. In the Environment section, add environment variables:
   - `DATABASE_URL`: Your Supabase connection string
   - `REDIS_URL`: Your Upstash Redis URL
   - `MINIO_ENDPOINT`: `https://[your-project-ref].supabase.co/storage/v1/s3`
   - `MINIO_ACCESS_KEY`: Your Supabase anon key
   - `MINIO_SECRET_KEY`: Your Supabase service role key
   - `MINIO_BUCKET`: `artifacts`
   - `SECRET_KEY`: A random secret key
   - `ALLOWED_ORIGINS`: Your frontend URL (from Vercel)
6. Render will automatically build and deploy your Docker container

#### 4. Deploy Frontend to Vercel
1. Go to [vercel.com](https://vercel.com) and create a free account
2. Connect your GitHub repository (the FrontEnd folder)
3. Create a new project and select the FrontEnd directory
4. In project settings, add environment variable:
   - `VITE_API_BASE_URL`: Your Render backend URL (e.g., `https://your-service.onrender.com`)
5. Deploy the frontend

#### 5. Update CORS (if needed)
In your Render environment variables, update `ALLOWED_ORIGINS` to include your Vercel frontend URL.

#### Local Development with Cloud Services
For local development using cloud services instead of Docker Compose:

1. Copy `.env.example` to `.env`
2. Fill in your Supabase and Redis credentials
3. Run the application locally:
   ```bash
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload
   ```
4. In a separate terminal, start the worker:
   ```bash
   celery -A app.workers.celery_app worker --loglevel=info
   ```

#### Alternative: Docker Compose (Local Only)
For local development only, you can still use the traditional Docker Compose setup with local PostgreSQL, Redis, and MinIO.

## License

This project is proprietary and confidential.
