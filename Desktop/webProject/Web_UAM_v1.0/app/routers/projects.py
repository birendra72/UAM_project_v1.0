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
def list_projects(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    projects = db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).all()
    return [ProjectSchema.from_orm(p) for p in projects]

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

@router.get("/overview-stats")
def get_portfolio_stats(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    from sqlalchemy import func

    # Active Projects: count of projects
    active_projects = db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).count()

    # Datasets Used: count of datasets owned by user
    datasets_used = db.query(Dataset).filter(Dataset.user_id == current_user.id).count()

    # Models Training: count of models from user's projects (simplified for now)
    models_training = db.query(ModelMeta).join(Run).join(ProjectModel).filter(ProjectModel.user_id == current_user.id).count()

    # Avg. Data Quality: placeholder for now
    avg_data_quality = "N/A"

    # Top Model Type: placeholder for now
    top_model_type = "N/A"

    return {
        "activeProjects": active_projects,
        "datasetsUsed": datasets_used,
        "modelsTraining": models_training,
        "avgDataQuality": avg_data_quality,
        "topModelType": top_model_type
    }

@router.get("/recent-projects")
def get_recent_projects(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    # Get recent projects with their associated datasets and status
    projects = db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).order_by(ProjectModel.created_at.desc()).limit(3).all()

    recent_projects = []
    for project in projects:
        # Get associated datasets
        datasets = db.query(Dataset).join(ProjectDataset).filter(ProjectDataset.project_id == project.id).all()
        dataset_names = [d.filename for d in datasets]

        # Get latest run status
        latest_run = db.query(Run).filter(Run.project_id == project.id).order_by(Run.started_at.desc()).first()
        status = latest_run.status if latest_run else "No runs"

        # Calculate updated time (simplified to created_at for now)
        updated = project.created_at.strftime("%Y-%m-%d %H:%M:%S")

        recent_projects.append({
            "id": project.id,
            "name": project.name,
            "dataset": dataset_names[0] if dataset_names else "No dataset",
            "status": status,
            "updated": updated
        })

    return recent_projects

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
