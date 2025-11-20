from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from app.db.session import get_db
from app.db.models import Project as ProjectModel, Dataset, ProjectDataset, ModelMeta, Run, Artifact, PredictionResult, Log
from app.schemas.projects import ProjectCreate, Project as ProjectSchema
from app.schemas.datasets import Dataset as DatasetSchema
from app.dependencies.auth import get_current_user
from app.storage import storage
from app.services.eda_service import EDAService
from app.services.ml_service import MLService
import uuid
from datetime import datetime

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

@router.get("/overview-stats")
def get_portfolio_stats(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    from sqlalchemy import func

    # Active Projects: count of projects
    active_projects = db.query(ProjectModel).filter(ProjectModel.user_id == current_user.id).count()

    # Datasets Used: count of datasets owned by user
    datasets_used = db.query(Dataset).filter(Dataset.user_id == current_user.id).count()

    # Models Training: count of models from user's projects (simplified for now)
    models_training = db.query(ModelMeta).join(Run).join(ProjectModel).filter(ProjectModel.user_id == current_user.id).count()

    # Data Quality: percentage of datasets with validation_status == 'valid'
    total_datasets = db.query(Dataset).filter(Dataset.user_id == current_user.id).count()
    valid_datasets = db.query(Dataset).filter(
        Dataset.user_id == current_user.id,
        Dataset.validation_status == 'valid'
    ).count()
    avg_data_quality = round((valid_datasets / total_datasets) * 100, 1) if total_datasets > 0 else 0.0

    # Success Rate: average accuracy from model metrics
    model_metas = db.query(ModelMeta).join(Run).join(ProjectModel).filter(
        ProjectModel.user_id == current_user.id
    ).all()

    success_rates = []
    for model_meta in model_metas:
        if model_meta.metrics_json:
            metrics = model_meta.metrics_json
            # Look for accuracy, r2_score, or similar success metrics
            if 'accuracy' in metrics:
                success_rates.append(metrics['accuracy'])
            elif 'r2_score' in metrics:
                success_rates.append(metrics['r2_score'])
            elif 'score' in metrics:
                success_rates.append(metrics['score'])

    success_rate = round(sum(success_rates) / len(success_rates) * 100, 1) if success_rates else 0.0

    # Top Model Type: most frequent model name
    model_names = [model_meta.name for model_meta in model_metas if model_meta.name]
    if model_names:
        from collections import Counter
        top_model_type = Counter(model_names).most_common(1)[0][0]
    else:
        top_model_type = "None"

    return {
        "activeProjects": active_projects,
        "datasetsUsed": datasets_used,
        "modelsTraining": models_training,
        "avgDataQuality": f"{avg_data_quality}%",
        "successRate": f"{success_rate}%",
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

@router.get("/{project_id}/export")
def export_project(
    project_id: str,
    format: str = "json",
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export project data including metadata, datasets, and runs
    """
    # Verify project belongs to user
    project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        # Get associated datasets
        datasets = db.query(Dataset).join(ProjectDataset).filter(ProjectDataset.project_id == project_id).all()
        dataset_data = []
        for d in datasets:
            dataset_data.append({
                "id": d.id,
                "filename": d.filename,
                "rows": d.rows,
                "cols": d.cols,
                "uploaded_at": d.uploaded_at.isoformat() if d.uploaded_at else None,
                "columns_json": d.columns_json
            })

        # Get associated runs
        runs = db.query(Run).filter(Run.project_id == project_id).all()
        run_data = []
        for r in runs:
            run_data.append({
                "id": r.id,
                "status": r.status,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "parameters_json": r.parameters_json
            })

        # Prepare export data
        export_data = {
            "project": {
                "id": project.id,
                "name": project.name,
                "description": project.description,
            "created_at": project.created_at.isoformat() if project.created_at else None
            },
            "datasets": dataset_data,
            "runs": run_data
        }

        # Generate export content based on format
        if format.lower() == "json":
            import json
            content = json.dumps(export_data, indent=2)
            content_type = "application/json"
            filename = f"{project.name.replace(' ', '_')}_export.json"
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format. Use 'json'")

        # Store exported file temporarily
        export_key = f"exports/project_{project_id}_{format.lower()}.json"
        storage.put_object(export_key, content.encode('utf-8'))

        # Generate download URL
        download_url = storage.get_presigned_url(export_key, expiry_seconds=3600)

        return {
            "download_url": download_url,
            "filename": filename,
            "content_type": content_type,
            "expires_in": 3600
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Project export failed: {str(e)}")

@router.post("/{project_id}/prediction-summary/export")
def export_prediction_summary(
    project_id: str,
    format_type: str = "pdf",
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export prediction summary as PDF or HTML report
    """
    from app.services.report_service import ReportService
    from fastapi.responses import Response
    import io

    # Verify project ownership
    project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        # Get prediction summary data
        summary_data = get_prediction_summary(project_id, db, current_user)

        # Generate report content
        if format_type.lower() == "pdf":
            report_key = ReportService._generate_prediction_summary_pdf(summary_data, project.name)
            content_type = "application/pdf"
            filename = f"{project.name.replace(' ', '_')}_prediction_summary.pdf"
        elif format_type.lower() == "html":
            report_key = ReportService._generate_prediction_summary_html(summary_data, project.name)
            content_type = "text/html"
            filename = f"{project.name.replace(' ', '_')}_prediction_summary.html"
        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'pdf' or 'html'")

        # Get runs for the project
        runs = db.query(Run).filter(Run.project_id == project_id).all()

        # If no runs exist, create a dummy run for the artifact
        if not runs:
            # Get first dataset for the project
            datasets = db.query(Dataset).join(ProjectDataset).filter(ProjectDataset.project_id == project_id).all()
            if not datasets:
                raise HTTPException(status_code=400, detail="No datasets found for this project")

            # Create a dummy run
            dummy_run = Run(
                project_id=project_id,
                dataset_id=datasets[0].id,  # Use first dataset
                status="COMPLETED",
                started_at=datetime.now(),
                finished_at=datetime.now()
            )
            db.add(dummy_run)
            db.flush()  # Flush to assign id without committing transaction
            run_id = dummy_run.id
        
        else:
            run_id = runs[0].id

        # Create artifact for the prediction summary report
        artifact = Artifact(
            run_id=run_id,
            user_id=current_user.id,
            type="report",
            storage_key=report_key,
            filename=filename,
            metadata_json={
                "format": format_type,
                "generated_at": str(datetime.now()),
                "type": "summary",
                "project_id": project_id
            }
        )
        db.add(artifact)
        db.commit()

        # Generate download URL
        download_url = storage.get_presigned_url(report_key, expiry_seconds=3600)

        return {
            "download_url": download_url,
            "filename": filename,
            "content_type": content_type,
            "expires_in": 3600,
            "artifact_id": artifact.id
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

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

@router.get("/{project_id}/reports")
def get_project_reports(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get reports for a project
    """
    # Verify project ownership
    project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get report artifacts for this project - include both run-based and prediction summary reports
    reports = db.query(Artifact).filter(
        Artifact.type == "report",
        Artifact.user_id == current_user.id
    ).outerjoin(Run, Artifact.run_id == Run.id).filter(
        # Either the artifact is linked to a run in this project, or it's a prediction summary report for this project
        ((Run.project_id == project_id) | ((Artifact.metadata_json.op('->>')('type') == 'summary') & (Artifact.metadata_json.op('->>')('project_id') == project_id)))
    ).all()

    return [
        {
            "id": report.id,
            "filename": report.filename,
            "storage_key": report.storage_key,
            "created_at": str(report.created_at),
            "metadata": report.metadata_json
        }
        for report in reports
    ]

@router.get("/{project_id}/prediction-summary")
def get_prediction_summary(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get prediction summary for a project
    """
    # Verify project ownership
    project = db.query(ProjectModel).filter(
        ProjectModel.id == project_id,
        ProjectModel.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get prediction results for this project
    prediction_results = db.query(PredictionResult).join(
        ModelMeta, PredictionResult.model_id == ModelMeta.id
    ).join(
        Run, ModelMeta.run_id == Run.id
    ).filter(
        Run.project_id == project_id
    ).all()

    if not prediction_results:
        return {
            "total_predictions": 0,
            "prediction_types": {},
            "statistics": {
                "data_quality": {
                    "has_null_predictions": False
                }
            }
        }

    # Analyze predictions - extract from predictions JSON field
    predictions = []
    for pr in prediction_results:
        if pr.predictions and isinstance(pr.predictions, list) and len(pr.predictions) > 0:
            predictions.append(pr.predictions[0])  # Take first prediction if it's a list
        elif pr.predictions and isinstance(pr.predictions, dict):
            # If it's a dict, try to get the first value
            first_key = next(iter(pr.predictions.keys()))
            predictions.append(pr.predictions[first_key])

    if not predictions:
        return {
            "total_predictions": 0,
            "prediction_types": {},
            "statistics": {
                "data_quality": {
                    "has_null_predictions": True
                }
            }
        }

    total_predictions = len(predictions)

    # Determine prediction type
    prediction_types = {}
    statistics: Dict[str, Any] = {}

    # Check if numeric
    try:
        numeric_predictions = [float(p) for p in predictions]
        prediction_types["numeric"] = {
            "min": min(numeric_predictions),
            "max": max(numeric_predictions),
            "mean": sum(numeric_predictions) / len(numeric_predictions),
            "median": sorted(numeric_predictions)[len(numeric_predictions) // 2],
            "std": (sum((x - sum(numeric_predictions) / len(numeric_predictions)) ** 2 for x in numeric_predictions) / len(numeric_predictions)) ** 0.5,
            "q25": sorted(numeric_predictions)[len(numeric_predictions) // 4],
            "q75": sorted(numeric_predictions)[3 * len(numeric_predictions) // 4],
            "unique_values": len(set(numeric_predictions)),
            "range": max(numeric_predictions) - min(numeric_predictions)
        }
        statistics["prediction_ranges"] = {
            "low": f"< {prediction_types['numeric']['q25']}",
            "medium": f"{prediction_types['numeric']['q25']} - {prediction_types['numeric']['q75']}",
            "high": f"> {prediction_types['numeric']['q75']}"
        }
    except (ValueError, TypeError):
        # Categorical predictions
        prediction_counts = {}
        for p in predictions:
            prediction_counts[str(p)] = prediction_counts.get(str(p), 0) + 1

        most_common = max(prediction_counts.items(), key=lambda x: x[1])
        least_common = min(prediction_counts.items(), key=lambda x: x[1])

        prediction_types["categorical"] = {
            "unique_values": len(prediction_counts),
            "most_common": most_common[0],
            "least_common": least_common[0],
            "distribution": prediction_counts,
            "percentages": {k: (v / total_predictions) * 100 for k, v in prediction_counts.items()},
            "entropy": -sum((v / total_predictions) * (v / total_predictions).bit_length() / 8 for v in prediction_counts.values())  # Simplified entropy
        }

        # Class distribution statistics
        if len(prediction_counts) > 1:
            majority_class = most_common[0]
            majority_percentage = (most_common[1] / total_predictions) * 100
            minority_class = least_common[0]
            minority_percentage = (least_common[1] / total_predictions) * 100

            statistics["class_distribution"] = {
                "majority_class": majority_class,
                "majority_percentage": majority_percentage,
                "minority_class": minority_class,
                "minority_percentage": minority_percentage
            }

    # Data quality statistics
    has_null_predictions = any(pr.predictions is None for pr in prediction_results)
    data_quality_stats = {
        "has_null_predictions": has_null_predictions
    }

    # Add variance and outlier count for numeric predictions
    if "numeric" in prediction_types:
        numeric_preds = [float(p) for p in predictions]
        mean_val = prediction_types["numeric"]["mean"]
        std_val = prediction_types["numeric"]["std"]
        variance = std_val ** 2
        outliers = [p for p in numeric_preds if abs(p - mean_val) > 3 * std_val]

        data_quality_stats["prediction_variance"] = variance
        data_quality_stats["outlier_count"] = len(outliers)

    statistics["data_quality"] = data_quality_stats

    # Confidence statistics if available (from summary field)
    confidence_values = []
    for pr in prediction_results:
        if pr.summary and isinstance(pr.summary, dict) and 'confidence' in pr.summary:
            confidence = pr.summary['confidence']
            # Ensure confidence is a number
            if isinstance(confidence, (int, float)):
                confidence_values.append(confidence)

    if confidence_values:
        statistics["confidence"] = {
            "mean_confidence": sum(confidence_values) / len(confidence_values),
            "min_confidence": min(confidence_values),
            "max_confidence": max(confidence_values),
            "std_confidence": (sum((x - sum(confidence_values) / len(confidence_values)) ** 2 for x in confidence_values) / len(confidence_values)) ** 0.5,
            "high_confidence_ratio": len([c for c in confidence_values if c > 0.8]) / len(confidence_values),
            "low_confidence_ratio": len([c for c in confidence_values if c < 0.5]) / len(confidence_values)
        }

    return {
        "total_predictions": total_predictions,
        "prediction_types": prediction_types,
        "statistics": statistics
    }


