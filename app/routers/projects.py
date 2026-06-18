from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.db.models import Project as ProjectModel, Dataset, ProjectDataset, ModelMeta, Run, Artifact, PredictionResult, Log
from app.schemas.projects import ProjectCreate, Project as ProjectSchema
from app.schemas.datasets import Dataset as DatasetSchema
from app.dependencies.auth import get_current_user
from app.storage import storage
from app.services.eda_service import EDAService
from app.services.ml_service import MLService
import uuid

router = APIRouter()

@router.post("/", response_model=ProjectSchema)
def create_project(project_create: ProjectCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    project = ProjectModel(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=project_create.name,
        description=project_create.description
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectSchema.from_orm(project)

@router.get("/", response_model=List[ProjectSchema])
def list_projects(
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if page < 1:
        page = 1
    if limit < 1:
        limit = 20
    offset = (page - 1) * limit
    projects = db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).offset(offset).limit(limit).all()
    return [ProjectSchema.from_orm(p) for p in projects]

@router.get("/overview-stats")
def get_portfolio_stats(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    from sqlalchemy import func
    from app.db.models import EDAReport

    active_projects = db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).count()
    datasets_used = db.query(Dataset).filter(Dataset.user_id == current_user.id).count()
    models_count = db.query(ModelMeta).join(Run).join(ProjectModel).filter(ProjectModel.user_id == current_user.id).count()

    # Avg Data Quality from EDA reports
    eda_reports = (
        db.query(EDAReport)
        .join(ProjectModel, EDAReport.project_id == ProjectModel.id)
        .filter(ProjectModel.user_id == current_user.id)
        .all()
    )
    avg_data_quality = (
        f"{round(sum(r.data_quality_score for r in eda_reports) / len(eda_reports), 1)}%"
        if eda_reports else "N/A"
    )

    # Top model by accuracy metric
    top_model_type = "N/A"
    all_models = (
        db.query(ModelMeta).join(Run).join(ProjectModel)
        .filter(ProjectModel.user_id == current_user.id)
        .all()
    )
    if all_models:
        best = max(
            all_models,
            key=lambda m: (
                m.metrics_json.get("accuracy", 0)
                if isinstance(m.metrics_json, dict) else 0
            )
        )
        top_model_type = best.name

    return {
        "activeProjects": active_projects,
        "datasetsUsed": datasets_used,
        "modelsTraining": models_count,
        "avgDataQuality": avg_data_quality,
        "topModelType": top_model_type
    }

@router.get("/recent-projects")
def get_recent_projects(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    projects = (
        db.query(ProjectModel)
        .filter(ProjectModel.user_id == current_user.id)
        .order_by(ProjectModel.created_at.desc())
        .limit(5)
        .all()
    )

    result = []
    for project in projects:
        first_dataset = (
            db.query(Dataset)
            .join(ProjectDataset, Dataset.id == ProjectDataset.dataset_id)
            .filter(ProjectDataset.project_id == project.id)
            .first()
        )
        latest_run = (
            db.query(Run)
            .filter(Run.project_id == project.id)
            .order_by(Run.started_at.desc())
            .first()
        )
        status = latest_run.status if latest_run else "EMPTY"
        # Use latest run's started_at if available, else project created_at
        updated_dt = (
            latest_run.started_at if latest_run and latest_run.started_at
            else project.created_at
        )
        updated = updated_dt.strftime("%Y-%m-%d") if updated_dt else "N/A"

        result.append({
            "id": project.id,
            "name": project.name,
            "dataset": first_dataset.filename if first_dataset else "No dataset",
            "status": status,
            "updated": updated
        })

    return result

@router.get("/{project_id}", response_model=ProjectSchema)
def get_project(project_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectSchema.from_orm(project)

@router.put("/{project_id}", response_model=ProjectSchema)
def update_project(project_id: str, project_update: ProjectCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project.name = project_update.name
    project.description = project_update.description
    db.commit()
    db.refresh(project)
    return ProjectSchema.from_orm(project)

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Delete associated project-dataset links first to avoid foreign key constraint issues
    db.query(ProjectDataset).filter(ProjectDataset.project_id == project_id).delete()

    # Delete associated runs and their related records (artifacts, model_metas, logs)
    runs = db.query(Run).filter(Run.project_id == project_id).all()
    for run in runs:
        # Delete artifacts
        db.query(Artifact).filter(Artifact.run_id == run.id).delete()
        # Delete model_metas and their prediction_results
        model_metas = db.query(ModelMeta).filter(ModelMeta.run_id == run.id).all()
        for model_meta in model_metas:
            db.query(PredictionResult).filter(PredictionResult.model_id == model_meta.id).delete()
        db.query(ModelMeta).filter(ModelMeta.run_id == run.id).delete()
        # Delete logs
        db.query(Log).filter(Log.run_id == run.id).delete()
        # Delete run
        db.delete(run)

    # Only delete the project record - keep datasets as they may be shared or used in other contexts
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}

@router.get("/{project_id}/datasets", response_model=List[DatasetSchema])
def get_project_datasets(project_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Verify project belongs to user
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    datasets = db.query(Dataset).join(ProjectDataset).filter(ProjectDataset.project_id == project_id).all()
    return [DatasetSchema.from_orm(d) for d in datasets]

@router.post("/{project_id}/eda/generate")
def generate_eda_report(
    project_id: str,
    dataset_ids: Optional[List[str]] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Generate comprehensive EDA report for a project
    """
    try:
        result = EDAService.generate_eda_report(
            project_id=project_id,
            user_id=current_user.id,
            db=db,
            dataset_ids=dataset_ids
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/ml/analyze-task")
def analyze_task_type(
    project_id: str,
    target_column: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Analyze the dataset to determine the ML task type and provide recommendations
    """
    try:
        result = MLService.analyze_task_type(
            project_id=project_id,
            user_id=current_user.id,
            db=db,
            target_column=target_column
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{project_id}/eda/results")
def get_eda_results(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Retrieve EDA results for a project
    """
    try:
        result = EDAService.get_eda_results(
            project_id=project_id,
            user_id=current_user.id,
            db=db
        )

        # If no results in database, return a proper structure for frontend
        if result.get("status") == "pending":
            return {
                "run_id": f"eda_{project_id}",
                "status": "completed",
                "created_at": "2024-01-01T00:00:00Z",
                "results": {
                    "summary": {
                        "total_rows": 0,
                        "total_columns": 0,
                        "missing_data_percentage": 0.0,
                        "duplicate_rows": 0,
                        "columns_with_missing": 0
                    },
                    "correlations": {},
                    "insights": [],
                    "distributions": {},
                    "outliers": {}
                }
            }

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
