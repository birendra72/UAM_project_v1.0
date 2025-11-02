from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models import Run, Project, Dataset, Log, Artifact
from app.schemas.runs import RunStart, RunStatus, Artifact as ArtifactSchema, Run as RunSchema
from app.dependencies.auth import get_current_user
from app.workers.celery_app import celery_app
from app.workers.tasks import preprocess_data, run_eda, train_models, finalize_run
import uuid

router = APIRouter()

@router.get("/", response_model=List[RunSchema])
def list_runs(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    runs = db.query(Run).join(Project).filter(Project.user_id == current_user.id).all()
    return [
        RunSchema(
            id=run.id,
            project_id=run.project_id,
            dataset_id=run.dataset_id,
            status=run.status,
            current_task=run.current_task,
            started_at=run.started_at,
            finished_at=run.finished_at,
            progress=run.progress,
            parameters_json=run.parameters_json
        ) for run in runs
    ]

@router.get("/{run_id}", response_model=RunSchema)
def get_run(run_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    run = db.query(Run).join(Project).filter(Run.id == run_id, Project.user_id == current_user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return RunSchema(
        id=run.id,
        project_id=run.project_id,
        dataset_id=run.dataset_id,
        status=run.status,
        current_task=run.current_task,
        started_at=run.started_at,
        finished_at=run.finished_at,
        progress=run.progress,
        parameters_json=run.parameters_json
    )

@router.post("/start")
def start_run(run_start: RunStart, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Check project ownership
    project = db.query(Project).filter(Project.id == run_start.project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check dataset exists and belongs to project
    dataset = db.query(Dataset).filter(Dataset.id == run_start.dataset_id, Dataset.project_id == run_start.project_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Create Run
    run = Run(
        id=str(uuid.uuid4()),
        project_id=run_start.project_id,
        dataset_id=run_start.dataset_id,
        status="PENDING",
        progress=0.0,
        parameters_json=run_start.options
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Enqueue Celery chain
    chain = (
        preprocess_data.s(run.id, dataset.storage_key) |
        run_eda.s(run.id) |
        train_models.s(run.id) |
        finalize_run.s(run.id)
    )
    chain.apply_async()

    return {"run_id": run.id, "status": run.status}

@router.get("/{run_id}/status", response_model=RunStatus)
def get_run_status(run_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    run = db.query(Run).join(Project).filter(Run.id == run_id, Project.user_id == current_user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    logs = db.query(Log).filter(Log.run_id == run_id).order_by(Log.timestamp).all()
    logs_list = [{"level": log.level, "message": log.message, "timestamp": log.timestamp.isoformat()} for log in logs]

    return RunStatus(
        run_id=run.id,
        status=run.status,
        current_task=run.current_task,
        progress=run.progress,
        logs=logs_list
    )

@router.get("/{run_id}/artifacts", response_model=List[ArtifactSchema])
def get_run_artifacts(run_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    run = db.query(Run).join(Project).filter(Run.id == run_id, Project.user_id == current_user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    artifacts = db.query(Artifact).filter(Artifact.run_id == run_id).all()
    result = []
    for artifact in artifacts:
        download_url = None
        try:
            from app.storage import storage
            download_url = storage.get_presigned_url(artifact.storage_key)
        except Exception:
            download_url = None
        result.append(ArtifactSchema(
            id=str(artifact.id),
            run_id=str(artifact.run_id),
            type=artifact.type,
            storage_key=artifact.storage_key,
            filename=artifact.filename,
            metadata_json=artifact.metadata_json,
            created_at=artifact.created_at,
            download_url=download_url
        ))
    return result
