from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging

from app.config import settings
from app.routers import auth, projects, datasets, runs, models, reports, analysis, templates, admin, notifications

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from app.utils.limiter import limiter

app = FastAPI(
    title="Universal Analyst Model (UAM) Backend",
    description="Backend API for UAM platform",
    version="0.1.0",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from app.utils.errors import db_exception_handler, validation_exception_handler, global_exception_handler

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(SQLAlchemyError, db_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, global_exception_handler)


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uam-backend")

# CORS settings - parse from environment config
origins = []
if settings.ALLOWED_ORIGINS:
    origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Include routers with /api prefix
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(runs.router, prefix="/api/runs", tags=["runs"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

# Mount static files for serving artifacts
app.mount("/files", StaticFiles(directory="./storage"), name="files")

from fastapi import Depends, Response
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db.session import get_db
import redis

@app.get("/api/")
def read_root():
    return {"message": "Welcome to UAM Backend API"}

@app.get("/api/health")
def health_check(response: Response, db: Session = Depends(get_db)):
    db_status = "healthy"
    redis_status = "healthy"
    details = {}
    
    # 1. Check Database connection
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "unhealthy"
        details["db_error"] = str(e)
        
    # 2. Check Redis connection
    try:
        r = redis.from_url(settings.REDIS_URL, socket_timeout=1)
        r.ping()
    except Exception as e:
        redis_status = "unhealthy"
        details["redis_error"] = str(e)
        
    if db_status == "unhealthy" or redis_status == "unhealthy":
        response.status_code = 503
        
    return {
        "status": "healthy" if response.status_code == 200 else "unhealthy",
        "database": db_status,
        "redis": redis_status,
        "details": details
    }
