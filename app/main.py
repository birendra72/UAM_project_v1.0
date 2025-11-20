from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging

from app.config import settings
from app.routers import auth, projects, datasets, runs, stocks, models, reports, analysis, templates, admin, visualizations

app = FastAPI(
    title="Universal Analyst Model (UAM) Backend",
    description="Backend API for UAM platform",
    version="0.1.0",
    openapi_url="/api/openapi.json",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uam-backend")

# CORS settings - allow frontend origin (adjust as needed)
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://172.17.112.1:8080",
    "http://172.17.240.1:8080",
    "http://172.18.128.1:8080",
    "http://172.31.64.1:8081",
    "http://172.31.64.1:8080",
    "http://192.168.31.9:8080",
    "http://192.168.31.9:8081",
    "https://uam-project-v1-0.vercel.app",  # Production frontend
]

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
app.include_router(stocks.router, prefix="/api/stocks", tags=["stocks"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(templates.router, prefix="/api/templates", tags=["templates"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(visualizations.router, prefix="/api/visualizations", tags=["visualizations"])

# Mount static files for serving artifacts
app.mount("/files", StaticFiles(directory="./storage"), name="files")

@app.get("/")
def read_root():
    return {"message": "Welcome to UAM Backend API"}

@app.get("/api/")
def read_api_root():
    return {"message": "Welcome to UAM Backend API"}
