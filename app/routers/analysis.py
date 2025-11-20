from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
import pandas as pd
import io
import uuid
import json
import os
from app.db.session import get_db, SessionLocal
from app.db.models import Dataset, Project, Run, Artifact, ProjectDataset, ModelMeta
from app.dependencies.auth import get_current_user
from app.workers.tasks import run_eda
from app.storage import storage
from app.services.ml_service import MLService
import asyncio
from typing import Dict, List, Any, Optional
import logging
import pickle
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    r2_score, mean_squared_error, mean_absolute_error
)
import numpy as np
from sqlalchemy import func


def run_eda_sync(run_id: str):
    """Synchronous version of EDA task"""
    db = SessionLocal()
    run = None
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise Exception("Run not found")
        run.status = "RUNNING"
        run.current_task = "EDA"
        run.progress = 0.1
        db.commit()

        # Get dataset from run
        run.progress = 0.2
        run.current_task = "Loading dataset"
        db.commit()

        dataset = db.query(Dataset).filter(Dataset.id == run.dataset_id).first()
        if not dataset:
            raise Exception("Dataset not found")

        data_bytes = storage.get_object(dataset.storage_key)
        df = pd.read_csv(io.BytesIO(data_bytes.read()))

        run.progress = 0.4
        run.current_task = "Analyzing data structure"
        db.commit()

        # Generate summary stats
        summary = {
            "shape": df.shape,
            "columns": list(df.columns),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "missing_values": df.isnull().sum().to_dict(),
            "describe": df.describe().to_dict()
        }

        run.progress = 0.6
        run.current_task = "Generating summary statistics"
        db.commit()

        # Save summary as JSON artifact
        summary_key = f"eda/{uuid.uuid4()}.json"
        storage.put_object(summary_key, json.dumps(summary).encode())

        artifact_summary = Artifact(
            run_id=run_id,
            type="eda_summary",
            storage_key=summary_key,
            filename=os.path.basename(summary_key),
            metadata_json={"description": "EDA summary statistics"}
        )
        db.add(artifact_summary)

        run.progress = 0.8
        run.current_task = "Generating visualizations"
        db.commit()

        # Generate charts using Plotly (for interactive JSON)
        import plotly.graph_objects as go
        import plotly.io as pio

        # Histogram for first numeric column
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            fig = go.Figure()
            fig.add_trace(go.Histogram(x=df[numeric_cols[0]], nbinsx=30))
            fig.update_layout(title=f"Histogram of {numeric_cols[0]}", xaxis_title=numeric_cols[0], yaxis_title="Count")
            chart_json = pio.to_json(fig) or "{}"

            chart_key = f"eda/{uuid.uuid4()}.json"
            storage.put_object(chart_key, chart_json.encode())

            artifact_chart = Artifact(
                run_id=run_id,
                type="eda_chart",
                storage_key=chart_key,
                filename=os.path.basename(chart_key),
                metadata_json={"description": f"Interactive histogram of {numeric_cols[0]}"}
            )
            db.add(artifact_chart)

        db.commit()

        run.progress = 1.0
        run.status = "COMPLETED"
        run.current_task = None
        db.commit()
        return run_id
    except Exception as e:
        if run:
            run.status = "FAILED"
            db.commit()
        raise
    finally:
        db.close()

router = APIRouter()

@router.get("/")
def list_analysis(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List all analysis runs for the current user
    """
    # Get all analysis runs for the user's projects
    runs = db.query(Run).join(Project).filter(
        Project.user_id == current_user.id
    ).all()

    return [
        {
            "id": run.id,
            "project_id": run.project_id,
            "dataset_id": run.dataset_id,
            "status": run.status,
            "current_task": run.current_task,
            "progress": run.progress,
            "started_at": str(run.started_at) if run.started_at else None,
            "finished_at": str(run.finished_at) if run.finished_at else None,
            "parameters_json": run.parameters_json
        }
        for run in runs
    ]

@router.post("/eda")
async def start_eda(
    dataset_id: str,
    project_id: str,
    options: dict = {},  # Optional EDA options
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Check ownership
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id, ProjectDataset.project_id == project_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Create a run for EDA
    run = Run(
        project_id=project_id,
        dataset_id=dataset_id,
        status="PENDING",
        parameters_json=options
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    # Run EDA synchronously instead of using Celery
    try:
        await asyncio.get_event_loop().run_in_executor(None, run_eda_sync, str(run.id))
        return {"message": "EDA completed", "run_id": str(run.id)}
    except Exception as e:
        run.status = "FAILED"
        db.commit()
        raise HTTPException(status_code=500, detail=f"EDA failed: {str(e)}")

@router.get("/eda/{run_id}/status")
def get_eda_status(run_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    run = db.query(Run).join(Project).filter(Run.id == run_id, Project.user_id == current_user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    artifacts = db.query(Artifact).filter(Artifact.run_id == run_id).all()
    artifact_urls = {}
    for artifact in artifacts:
        if artifact.type == "eda_chart":
            artifact_urls["chart_url"] = storage.get_presigned_url(artifact.storage_key)
        elif artifact.type == "eda_summary":
            artifact_urls["summary_url"] = storage.get_presigned_url(artifact.storage_key)

    return {
        "status": run.status,
        "progress": run.progress,
        "current_task": run.current_task,
        "artifacts": artifact_urls
    }

# ML endpoints
@router.post("/projects/{project_id}/analyze-task-type")
def analyzeTaskType(
    project_id: str,
    target_column: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Analyze the task type for a project based on target column
    """
    try:
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get datasets for the project
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id
        ).all()

        if not datasets:
            raise HTTPException(status_code=404, detail="No datasets found for this project")

        # Use MLService to analyze task type
        result = MLService.analyze_task_type(project_id, current_user.id, db, target_column)

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Task analysis failed: {str(e)}")

@router.post("/projects/{project_id}/ml/analyze-task")
def analyze_task_type_ml(
    project_id: str,
    target_column: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Analyze the task type for a project based on target column (ML endpoint)
    """
    try:
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get datasets for the project
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id
        ).all()

        if not datasets:
            raise HTTPException(status_code=404, detail="No datasets found for this project")

        # Use MLService to analyze task type
        result = MLService.analyze_task_type(project_id, current_user.id, db, target_column)

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Task analysis failed: {str(e)}")

@router.post("/projects/{project_id}/generate-eda")
def generateEDA(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Generate EDA for a project
    """
    try:
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get datasets for the project
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id
        ).all()

        if not datasets:
            raise HTTPException(status_code=404, detail="No datasets found for this project")

        # Start EDA run
        run = Run(
            project_id=project_id,
            dataset_id=datasets[0].id,  # Use first dataset as primary
            status="PENDING",
            current_task="Starting EDA",
            parameters_json={}
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        # Run EDA synchronously
        try:
            run_eda_sync(str(run.id))
            return {"message": "EDA started successfully", "run_id": str(run.id)}
        except Exception as e:
            run.status = "FAILED"
            db.commit()
            raise HTTPException(status_code=500, detail=f"EDA failed: {str(e)}")

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"EDA generation failed: {str(e)}")

@router.get("/projects/{project_id}/eda/results")
def getEDAResults(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get EDA results for a project
    """
    try:
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get the latest EDA run for this project
        latest_run = db.query(Run).filter(
            Run.project_id == project_id,
            Run.parameters_json != None  # EDA runs have empty parameters
        ).order_by(Run.started_at.desc()).first()

        if not latest_run:
            return {
                "run_id": None,
                "status": "NO_EDA_RUNS",
                "message": "No EDA runs found for this project"
            }

        # Get EDA artifacts
        artifacts = db.query(Artifact).filter(
            Artifact.run_id == latest_run.id,
            Artifact.type.in_(["eda_summary", "eda_chart"])
        ).all()

        results = {
            "run_id": str(latest_run.id),
            "status": latest_run.status,
            "created_at": str(latest_run.started_at) if latest_run.started_at else None
        }

        if artifacts:
            for artifact in artifacts:
                if artifact.type == "eda_summary":
                    # Load summary from storage
                    summary_data = storage.get_object(artifact.storage_key)
                    results["summary"] = json.loads(summary_data.read().decode())
                elif artifact.type == "eda_chart":
                    # Generate presigned URL for chart
                    results["chart_url"] = storage.get_presigned_url(artifact.storage_key)

        # Mock additional EDA results for now
        results.update({
            "correlations": {},
            "insights": [],
            "distributions": {},
            "outliers": {}
        })

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get EDA results: {str(e)}")

@router.post("/projects/{project_id}/ml/train-auto")
async def train_auto_ml(
    project_id: str,
    request: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Start AutoML training for a project with real-time progress updates
    """
    task_type = request.get("task_type")
    target_column = request.get("target_column")
    test_size = request.get("test_size", 0.2)
    random_state = request.get("random_state", 42)

    if not task_type or not target_column:
        raise HTTPException(status_code=400, detail="task_type and target_column are required")

    # Validate task type and target column compatibility
    try:
        # Get task analysis to check compatibility
        task_analysis = MLService.analyze_task_type(project_id, current_user.id, db, target_column)

        # Check if the selected task_type matches the target column type
        target_info = None
        if task_analysis["task_analysis"]["possible_targets"]:
            target_info = next((t for t in task_analysis["task_analysis"]["possible_targets"] if t["column"] == target_column), None)

        if target_info:
            expected_task_type = target_info["task_type"]
            if task_type == "regression" and expected_task_type != "regression":
                raise HTTPException(
                    status_code=400,
                    detail=f"Incompatible combination: Task type '{task_type}' requires a numeric target column, but '{target_column}' is {expected_task_type}. Please select a numeric column for regression or choose a classification task type."
                )
            elif task_type in ["binary_classification", "multiclass_classification"] and expected_task_type != "classification":
                raise HTTPException(
                    status_code=400,
                    detail=f"Incompatible combination: Task type '{task_type}' requires a categorical target column, but '{target_column}' is {expected_task_type}. Please select a categorical column for classification or choose regression task type."
                )

        # Use the enhanced training function with progress updates
        result = await train_auto_ml_with_progress(
            project_id=project_id,
            user_id=current_user.id,
            task_type=task_type,
            target_column=target_column,
            test_size=test_size,
            random_state=random_state,
            db=db,
            manager=manager
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

@router.get("/projects/{project_id}/ml/training-status")
def get_training_status(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get the latest training status for a project
    """
    # Check project ownership
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get the latest run for this project
    latest_run = db.query(Run).filter(Run.project_id == project_id).order_by(Run.started_at.desc()).first()

    if not latest_run:
        return {
            "status": "NO_RUNS",
            "message": "No training runs found for this project"
        }

    # Get models from this run
    models = db.query(ModelMeta).filter(ModelMeta.run_id == latest_run.id).all()

    return {
        "run_id": latest_run.id,
        "status": latest_run.status,
        "current_task": latest_run.current_task,
        "progress": latest_run.progress,
        "started_at": latest_run.started_at.isoformat() if latest_run.started_at else None,
        "finished_at": latest_run.finished_at.isoformat() if latest_run.finished_at else None,
        "models_count": len(models),
        "models": [
            {
                "id": str(model.id),
                "name": model.name,
                "metrics": model.metrics_json,
                "created_at": model.created_at.isoformat()
            } for model in models
        ]
    }

@router.get("/projects/{project_id}/ml/models")
def get_project_models(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get all trained models for a project
    """
    # Check project ownership
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get all models for this project through runs
    models = db.query(ModelMeta).join(Run).filter(Run.project_id == project_id).all()

    return [
        {
            "id": str(model.id),
            "run_id": str(model.run_id),
            "name": model.name,
            "storage_key": model.storage_key,
            "metrics": model.metrics_json,
            "version": model.version,
            "created_at": model.created_at.isoformat(),
            "best_params": model.metrics_json.get('best_params', {}) if model.metrics_json else {}
        } for model in models
    ]

@router.get("/ml/hyperparameter-spaces/{task_type}")
def get_hyperparameter_spaces(
    task_type: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get hyperparameter configuration options for different models
    """
    # Define hyperparameter configurations for different models
    hyperparameter_configs = {
        "classification": {
            "Logistic Regression": {
                "C": {"type": "float", "range": [0.01, 100.0], "default": 1.0, "description": "Inverse of regularization strength"},
                "penalty": {"type": "select", "options": ["l1", "l2", "elasticnet", "none"], "default": "l2", "description": "Regularization technique"}
            },
            "Random Forest": {
                "n_estimators": {"type": "int", "range": [10, 500], "default": 100, "description": "Number of trees in the forest"},
                "max_depth": {"type": "int", "range": [3, 50], "default": None, "description": "Maximum depth of the tree"},
                "min_samples_split": {"type": "int", "range": [2, 20], "default": 2, "description": "Minimum samples required to split an internal node"}
            },
            "SVM": {
                "C": {"type": "float", "range": [0.01, 100.0], "default": 1.0, "description": "Regularization parameter"},
                "kernel": {"type": "select", "options": ["linear", "poly", "rbf", "sigmoid"], "default": "rbf", "description": "Kernel type"}
            },
            "Decision Tree": {
                "max_depth": {"type": "int", "range": [3, 50], "default": None, "description": "Maximum depth of the tree"},
                "min_samples_split": {"type": "int", "range": [2, 20], "default": 2, "description": "Minimum samples required to split an internal node"},
                "criterion": {"type": "select", "options": ["gini", "entropy"], "default": "gini", "description": "Function to measure the quality of a split"}
            },
            "K-Nearest Neighbors": {
                "n_neighbors": {"type": "int", "range": [1, 20], "default": 5, "description": "Number of neighbors to use"},
                "weights": {"type": "select", "options": ["uniform", "distance"], "default": "uniform", "description": "Weight function used in prediction"}
            }
        },
        "regression": {
            "Linear Regression": {},  # No hyperparameters
            "Random Forest": {
                "n_estimators": {"type": "int", "range": [10, 500], "default": 100, "description": "Number of trees in the forest"},
                "max_depth": {"type": "int", "range": [3, 50], "default": None, "description": "Maximum depth of the tree"},
                "min_samples_split": {"type": "int", "range": [2, 20], "default": 2, "description": "Minimum samples required to split an internal node"}
            },
            "SVR": {
                "C": {"type": "float", "range": [0.01, 100.0], "default": 1.0, "description": "Regularization parameter"},
                "kernel": {"type": "select", "options": ["linear", "poly", "rbf", "sigmoid"], "default": "rbf", "description": "Kernel type"}
            },
            "Decision Tree": {
                "max_depth": {"type": "int", "range": [3, 50], "default": None, "description": "Maximum depth of the tree"},
                "min_samples_split": {"type": "int", "range": [2, 20], "default": 2, "description": "Minimum samples required to split an internal node"},
                "criterion": {"type": "select", "options": ["squared_error", "friedman_mse", "absolute_error"], "default": "squared_error", "description": "Function to measure the quality of a split"}
            },
            "K-Nearest Neighbors": {
                "n_neighbors": {"type": "int", "range": [1, 20], "default": 5, "description": "Number of neighbors to use"},
                "weights": {"type": "select", "options": ["uniform", "distance"], "default": "uniform", "description": "Weight function used in prediction"}
            }
        }
    }

    return hyperparameter_configs.get(task_type, {})

@router.post("/projects/{project_id}/ml/train-with-custom-params")
async def train_with_custom_hyperparameters(
    project_id: str,
    request: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Train models with custom hyperparameter configurations
    """
    task_type = request.get("task_type")
    target_column = request.get("target_column")
    custom_params = request.get("custom_params", {})
    test_size = request.get("test_size", 0.2)
    random_state = request.get("random_state", 42)

    if not task_type or not target_column:
        raise HTTPException(status_code=400, detail="task_type and target_column are required")

    # Validate task type and target column compatibility
    try:
        # Get task analysis to check compatibility
        task_analysis = MLService.analyze_task_type(project_id, current_user.id, db, target_column)

        # Check if the selected task_type matches the target column type
        target_info = None
        if task_analysis["task_analysis"]["possible_targets"]:
            target_info = next((t for t in task_analysis["task_analysis"]["possible_targets"] if t["column"] == target_column), None)

        if target_info:
            expected_task_type = target_info["task_type"]
            if task_type == "regression" and expected_task_type != "regression":
                raise HTTPException(
                    status_code=400,
                    detail=f"Incompatible combination: Task type '{task_type}' requires a numeric target column, but '{target_column}' is {expected_task_type}. Please select a numeric column for regression or choose a classification task type."
                )
            elif task_type in ["binary_classification", "multiclass_classification"] and expected_task_type != "classification":
                raise HTTPException(
                    status_code=400,
                    detail=f"Incompatible combination: Task type '{task_type}' requires a categorical target column, but '{target_column}' is {expected_task_type}. Please select a categorical column for classification or choose regression task type."
                )

        # Use enhanced training function with custom parameters
        result = await train_auto_ml_with_custom_params(
            project_id=project_id,
            user_id=current_user.id,
            task_type=task_type,
            target_column=target_column,
            custom_params=custom_params,
            test_size=test_size,
            random_state=random_state,
            db=db,
            manager=manager
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {str(e)}")

# WebSocket connection manager for real-time training updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, project_id: str, websocket: WebSocket):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)

    def disconnect(self, project_id: str, websocket: WebSocket):
        if project_id in self.active_connections:
            self.active_connections[project_id].remove(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def broadcast(self, project_id: str, message: dict):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logging.error(f"Failed to send message to websocket: {e}")

manager = ConnectionManager()

@router.websocket("/projects/{project_id}/ml/train-progress")
async def training_progress_websocket(
    project_id: str,
    websocket: WebSocket
):
    """
    WebSocket endpoint for real-time training progress updates
    """
    await manager.connect(project_id, websocket)
    try:
        while True:
            # Keep connection alive and wait for client messages
            data = await websocket.receive_text()
            # Could handle client messages here if needed
    except WebSocketDisconnect:
        manager.disconnect(project_id, websocket)

# Enhanced training function with progress updates
async def train_auto_ml_with_progress(
    project_id: str,
    user_id: str,
    task_type: str,
    target_column: str,
    test_size: float,
    random_state: int,
    db: Session,
    manager: ConnectionManager
):
    """
    Enhanced AutoML training with real-time progress updates
    """
    try:
        # Send initial progress
        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "initializing",
            "progress": 0.1,
            "message": "Initializing training..."
        })

        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == user_id
        ).first()
        if not project:
            raise ValueError("Project not found")

        # Get datasets for the project
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            Dataset.user_id == user_id
        ).all()

        if not datasets:
            raise ValueError("No datasets found for this project")

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "loading_data",
            "progress": 0.2,
            "message": "Loading and combining datasets..."
        })

        # Combine all datasets for training
        combined_df = MLService._combine_datasets(datasets)

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "preprocessing",
            "progress": 0.3,
            "message": "Preprocessing data..."
        })

        # Prepare data for training
        X, y, feature_names = MLService._prepare_data(combined_df, target_column, task_type)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "creating_run",
            "progress": 0.4,
            "message": "Setting up training run..."
        })

        # Create a run record for tracking
        run = Run(
            project_id=project_id,
            dataset_id=datasets[0].id,  # Use first dataset as primary
            status="RUNNING",
            current_task="Training models",
            parameters_json={
                "task_type": task_type,
                "target_column": target_column,
                "test_size": test_size,
                "random_state": random_state
            }
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "training_models",
            "progress": 0.5,
            "message": f"Training {6 if task_type in ['binary_classification', 'multiclass_classification'] else 5} models...",
            "run_id": str(run.id)
        })

        # Train models based on task type with cross-validation
        models_results = await train_models_with_progress(
            X_train, X_test, y_train, y_test, task_type, X, y, project_id, manager
        )

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "saving_models",
            "progress": 0.9,
            "message": "Saving trained models..."
        })

        # Store trained models and metadata
        model_metas = []
        for model_result in models_results:
            if 'error' not in model_result:
                # Save model to storage
                model_storage_key = f"models/{project_id}/{run.id}/{model_result['name'].replace(' ', '_').lower()}.pkl"
                model_buffer = io.BytesIO()
                pickle.dump(model_result['model'], model_buffer)
                model_buffer.seek(0)
                storage.upload_fileobj(model_storage_key, model_buffer)

                # Create model metadata record
                model_meta = ModelMeta(
                    run_id=run.id,
                    name=model_result['name'],
                    storage_key=model_storage_key,
                    metrics_json={
                        k: v for k, v in model_result.items()
                        if k not in ['model', 'name', 'storage_key']
                    },
                    version="1.0"
                )
                db.add(model_meta)
                model_metas.append(model_meta)

        db.commit()

        # Update run status
        run.status = "COMPLETED"
        run.finished_at = func.now()
        db.commit()

        # Store results (exclude model objects from serialization)
        models_for_storage = [
            {k: v for k, v in model.items() if k != 'model'}
            for model in models_results
        ]

        training_results = {
            "project_id": project_id,
            "run_id": run.id,
            "task_type": task_type,
            "target_column": target_column,
            "dataset_info": {
                "total_samples": len(X),
                "training_samples": len(X_train),
                "test_samples": len(X_test),
                "features": len(feature_names)
            },
            "models": models_for_storage,
            "feature_names": feature_names.tolist()
        }

        # Save to storage
        storage_key = f"ml/{project_id}_{run.id}.json"
        storage.upload_fileobj(storage_key, io.BytesIO(json.dumps(training_results).encode('utf-8')))

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "completed",
            "progress": 1.0,
            "message": "Training completed successfully!",
            "results": {
                "project_id": project_id,
                "run_id": str(run.id),
                "storage_key": storage_key,
                "task_type": task_type,
                "models_trained": len(models_results),
                "best_model": max(models_results, key=lambda x: x['score'])['name']
            }
        })

        return {
            "project_id": project_id,
            "run_id": str(run.id),
            "storage_key": storage_key,
            "task_type": task_type,
            "models_trained": len(models_results),
            "best_model": max(models_results, key=lambda x: x['score'])['name']
        }

    except Exception as e:
        await manager.broadcast(project_id, {
            "type": "error",
            "message": f"Training failed: {str(e)}"
        })
        raise

async def train_models_with_progress(
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train: np.ndarray,
    y_test: np.ndarray,
    task_type: str,
    X: np.ndarray,
    y: np.ndarray,
    project_id: str,
    manager: ConnectionManager
) -> List[Dict[str, Any]]:
    """
    Train multiple models with hyperparameter tuning, detailed logging, and progress updates
    """
    results = []

    if task_type in ['binary_classification', 'multiclass_classification']:
        # Classification models with hyperparameter grids
        models_and_params = [
            ('Logistic Regression', LogisticRegression(max_iter=1000, random_state=42), {
                'C': [0.1, 1.0, 10.0],
                'penalty': ['l2']
            }),
            ('Random Forest', RandomForestClassifier(random_state=42), {
                'n_estimators': [50, 100, 200],
                'max_depth': [None, 10, 20],
                'min_samples_split': [2, 5]
            }),
            ('SVM', SVC(random_state=42), {
                'C': [0.1, 1.0, 10.0],
                'kernel': ['rbf', 'linear']
            }),
            ('Decision Tree', DecisionTreeClassifier(random_state=42), {
                'max_depth': [None, 10, 20],
                'min_samples_split': [2, 5, 10]
            }),
            ('Naive Bayes', GaussianNB(), {}),  # No hyperparameters to tune
            ('K-Nearest Neighbors', KNeighborsClassifier(), {
                'n_neighbors': [3, 5, 7],
                'weights': ['uniform', 'distance']
            })
        ]

        total_models = len(models_and_params)
        for i, (name, model, param_grid) in enumerate(models_and_params):
            try:
                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "progress": 0.5 + (i / total_models) * 0.3,
                    "message": f"Starting hyperparameter tuning for {name}...",
                    "logs": [f"[{name}] Beginning hyperparameter optimization"]
                })

                # Perform hyperparameter tuning if parameters are provided
                if param_grid:
                    # Send tuning start message
                    await manager.broadcast(project_id, {
                        "type": "hyperparameter_progress",
                        "model_name": name,
                        "stage": "tuning_start",
                        "param_grid": param_grid,
                        "total_combinations": len(list(__import__('itertools').product(*param_grid.values()))),
                        "message": f"Exploring {len(list(__import__('itertools').product(*param_grid.values())))} parameter combinations"
                    })

                    # Custom GridSearchCV with progress updates
                    best_score = -1
                    best_params = {}
                    best_model = model
                    tuning_results = []

                    from itertools import product
                    param_combinations = list(product(*param_grid.values()))
                    param_keys = list(param_grid.keys())

                    for j, param_values in enumerate(param_combinations):
                        current_params = dict(zip(param_keys, param_values))

                        # Create model with current parameters
                        try:
                            temp_model = model.__class__(**{**model.get_params(), **current_params})
                            temp_model.fit(X_train, y_train)
                            y_pred_temp = temp_model.predict(X_test)
                            score = accuracy_score(y_test, y_pred_temp)

                            tuning_results.append({
                                'params': current_params,
                                'score': float(score),
                                'iteration': j + 1
                            })

                            if score > best_score:
                                best_score = score
                                best_params = current_params
                                best_model = temp_model

                            # Send intermediate results
                            await manager.broadcast(project_id, {
                                "type": "hyperparameter_progress",
                                "model_name": name,
                                "stage": "iteration_complete",
                                "current_params": current_params,
                                "current_score": float(score),
                                "best_score": float(best_score),
                                "iteration": j + 1,
                                "total_iterations": len(param_combinations),
                                "logs": [f"[{name}] Iteration {j + 1}/{len(param_combinations)}: Score {score:.4f} with params {current_params}"]
                            })

                        except Exception as e:
                            await manager.broadcast(project_id, {
                                "type": "hyperparameter_progress",
                                "model_name": name,
                                "stage": "iteration_error",
                                "current_params": current_params,
                                "error": str(e),
                                "logs": [f"[{name}] Error with params {current_params}: {str(e)}"]
                            })

                    # Fit the best model if it's still the original unfitted model
                    if best_model == model:
                        best_model.fit(X_train, y_train)

                    # Store tuning results
                    await manager.broadcast(project_id, {
                        "type": "hyperparameter_progress",
                        "model_name": name,
                        "stage": "tuning_complete",
                        "best_params": best_params,
                        "best_score": float(best_score),
                        "tuning_history": tuning_results,
                        "logs": [f"[{name}] Hyperparameter tuning completed. Best score: {best_score:.4f} with params: {best_params}"]
                    })

                else:
                    best_model = model
                    best_model.fit(X_train, y_train)
                    best_params = {}

                    await manager.broadcast(project_id, {
                        "type": "hyperparameter_progress",
                        "model_name": name,
                        "stage": "no_tuning",
                        "logs": [f"[{name}] No hyperparameters to tune, using default settings"]
                    })

                y_pred = best_model.predict(X_test)

                # Calculate metrics
                accuracy = accuracy_score(y_test, y_pred)
                precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
                recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
                f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)

                # Calculate cross-validation score
                cv_scores = cross_val_score(best_model, X, y, cv=5, scoring='accuracy')
                cv_mean = float(np.round(np.mean(cv_scores), 4))
                cv_std = float(np.round(np.std(cv_scores), 4))

                results.append({
                    'name': name,
                    'model': best_model,
                    'best_params': best_params,
                    'accuracy': float(np.round(accuracy, 4)),
                    'precision': float(np.round(precision, 4)),
                    'recall': float(np.round(recall, 4)),
                    'f1_score': float(np.round(f1, 4)),
                    'cv_mean': cv_mean,
                    'cv_std': cv_std,
                    'score': float(accuracy)  # Primary score for ranking
                })

                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "progress": 0.5 + ((i + 1) / total_models) * 0.3,
                    "message": f"{name} training completed with accuracy: {accuracy:.4f}",
                    "logs": [f"[{name}] Final metrics - Accuracy: {accuracy:.4f}, Precision: {precision:.4f}, Recall: {recall:.4f}, F1: {f1:.4f}"]
                })

            except Exception as e:
                print(f"Error training {name}: {e}")
                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "stage": "error",
                    "error": str(e),
                    "logs": [f"[{name}] Training failed: {str(e)}"]
                })
                results.append({
                    'name': name,
                    'error': str(e),
                    'score': 0
                })

    else:
        # Regression models with hyperparameter grids
        models_and_params = [
            ('Linear Regression', LinearRegression(), {}),  # No hyperparameters to tune
            ('Random Forest', RandomForestRegressor(random_state=42), {
                'n_estimators': [50, 100, 200],
                'max_depth': [None, 10, 20],
                'min_samples_split': [2, 5]
            }),
            ('SVR', SVR(), {
                'C': [0.1, 1.0, 10.0],
                'kernel': ['rbf', 'linear']
            }),
            ('Decision Tree', DecisionTreeRegressor(random_state=42), {
                'max_depth': [None, 10, 20],
                'min_samples_split': [2, 5, 10]
            }),
            ('K-Nearest Neighbors', KNeighborsRegressor(), {
                'n_neighbors': [3, 5, 7],
                'weights': ['uniform', 'distance']
            })
        ]

        total_models = len(models_and_params)
        for i, (name, model, param_grid) in enumerate(models_and_params):
            try:
                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "progress": 0.5 + (i / total_models) * 0.3,
                    "message": f"Starting hyperparameter tuning for {name}...",
                    "logs": [f"[{name}] Beginning hyperparameter optimization"]
                })

                # Perform hyperparameter tuning if parameters are provided
                if param_grid:
                    # Send tuning start message
                    await manager.broadcast(project_id, {
                        "type": "hyperparameter_progress",
                        "model_name": name,
                        "stage": "tuning_start",
                        "param_grid": param_grid,
                        "total_combinations": len(list(__import__('itertools').product(*param_grid.values()))),
                        "message": f"Exploring {len(list(__import__('itertools').product(*param_grid.values())))} parameter combinations"
                    })

                    # Custom GridSearchCV with progress updates
                    best_score = float('-inf')
                    best_params = {}
                    best_model = model
                    tuning_results = []

                    from itertools import product
                    param_combinations = list(product(*param_grid.values()))
                    param_keys = list(param_grid.keys())

                    for j, param_values in enumerate(param_combinations):
                        current_params = dict(zip(param_keys, param_values))

                        # Create model with current parameters
                        try:
                            temp_model = model.__class__(**{**model.get_params(), **current_params})
                            temp_model.fit(X_train, y_train)
                            y_pred_temp = temp_model.predict(X_test)
                            score = r2_score(y_test, y_pred_temp)

                            tuning_results.append({
                                'params': current_params,
                                'score': float(score),
                                'iteration': j + 1
                            })

                            if score > best_score:
                                best_score = score
                                best_params = current_params
                                best_model = temp_model

                            # Send intermediate results
                            await manager.broadcast(project_id, {
                                "type": "hyperparameter_progress",
                                "model_name": name,
                                "stage": "iteration_complete",
                                "current_params": current_params,
                                "current_score": float(score),
                                "best_score": float(best_score),
                                "iteration": j + 1,
                                "total_iterations": len(param_combinations),
                                "logs": [f"[{name}] Iteration {j + 1}/{len(param_combinations)}: R² {score:.4f} with params {current_params}"]
                            })

                        except Exception as e:
                            await manager.broadcast(project_id, {
                                "type": "hyperparameter_progress",
                                "model_name": name,
                                "stage": "iteration_error",
                                "current_params": current_params,
                                "error": str(e),
                                "logs": [f"[{name}] Error with params {current_params}: {str(e)}"]
                            })

                    # Store tuning results
                    await manager.broadcast(project_id, {
                        "type": "hyperparameter_progress",
                        "model_name": name,
                        "stage": "tuning_complete",
                        "best_params": best_params,
                        "best_score": float(best_score),
                        "tuning_history": tuning_results,
                        "logs": [f"[{name}] Hyperparameter tuning completed. Best R²: {best_score:.4f} with params: {best_params}"]
                    })

                else:
                    best_model = model
                    best_model.fit(X_train, y_train)
                    best_params = {}

                    await manager.broadcast(project_id, {
                        "type": "hyperparameter_progress",
                        "model_name": name,
                        "stage": "no_tuning",
                        "logs": [f"[{name}] No hyperparameters to tune, using default settings"]
                    })

                y_pred = best_model.predict(X_test)

                # Calculate metrics
                r2 = r2_score(y_test, y_pred)
                mse = mean_squared_error(y_test, y_pred)
                mae = mean_absolute_error(y_test, y_pred)

                # Calculate cross-validation score
                cv_scores = cross_val_score(best_model, X, y, cv=5, scoring='r2')
                cv_mean = float(np.round(np.mean(cv_scores), 4))
                cv_std = float(np.round(np.std(cv_scores), 4))

                results.append({
                    'name': name,
                    'model': best_model,
                    'best_params': best_params,
                    'r2_score': float(np.round(r2, 4)),
                    'mse': float(np.round(mse, 4)),
                    'mae': float(np.round(mae, 4)),
                    'cv_mean': cv_mean,
                    'cv_std': cv_std,
                    'score': float(r2)  # Primary score for ranking
                })

                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "progress": 0.5 + ((i + 1) / total_models) * 0.3,
                    "message": f"{name} training completed with R²: {r2:.4f}",
                    "logs": [f"[{name}] Final metrics - R²: {r2:.4f}, MSE: {mse:.4f}, MAE: {mae:.4f}"]
                })

            except Exception as e:
                print(f"Error training {name}: {e}")
                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "stage": "error",
                    "error": str(e),
                    "logs": [f"[{name}] Training failed: {str(e)}"]
                })
                results.append({
                    'name': name,
                    'error': str(e),
                    'score': float('-inf')
                })

    # Sort by score (descending)
    results.sort(key=lambda x: x.get('score', 0), reverse=True)
    return results

async def train_auto_ml_with_custom_params(
    project_id: str,
    user_id: str,
    task_type: str,
    target_column: str,
    custom_params: dict,
    test_size: float,
    random_state: int,
    db: Session,
    manager: ConnectionManager
):
    """
    Enhanced AutoML training with custom hyperparameter configurations
    """
    try:
        # Send initial progress
        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "initializing",
            "progress": 0.1,
            "message": "Initializing training with custom parameters..."
        })

        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == user_id
        ).first()
        if not project:
            raise ValueError("Project not found")

        # Get datasets for the project
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            Dataset.user_id == user_id
        ).all()

        if not datasets:
            raise ValueError("No datasets found for this project")

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "loading_data",
            "progress": 0.2,
            "message": "Loading and combining datasets..."
        })

        # Combine all datasets for training
        combined_df = MLService._combine_datasets(datasets)

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "preprocessing",
            "progress": 0.3,
            "message": "Preprocessing data..."
        })

        # Prepare data for training
        X, y, feature_names = MLService._prepare_data(combined_df, target_column, task_type)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "creating_run",
            "progress": 0.4,
            "message": "Setting up training run..."
        })

        # Create a run record for tracking
        run = Run(
            project_id=project_id,
            dataset_id=datasets[0].id,  # Use first dataset as primary
            status="RUNNING",
            current_task="Training models with custom parameters",
            parameters_json={
                "task_type": task_type,
                "target_column": target_column,
                "custom_params": custom_params,
                "test_size": test_size,
                "random_state": random_state
            }
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "training_models",
            "progress": 0.5,
            "message": f"Training models with custom hyperparameters...",
            "run_id": str(run.id)
        })

        # Train models based on task type with custom parameters
        models_results = await train_models_with_custom_params(
            X_train, X_test, y_train, y_test, task_type, X, y, custom_params, project_id, manager
        )

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "saving_models",
            "progress": 0.9,
            "message": "Saving trained models..."
        })

        # Store trained models and metadata
        model_metas = []
        for model_result in models_results:
            if 'error' not in model_result:
                # Save model to storage
                model_storage_key = f"models/{project_id}/{run.id}/{model_result['name'].replace(' ', '_').lower()}.pkl"
                model_buffer = io.BytesIO()
                pickle.dump(model_result['model'], model_buffer)
                model_buffer.seek(0)
                storage.upload_fileobj(model_storage_key, model_buffer)

                # Create model metadata record
                model_meta = ModelMeta(
                    run_id=run.id,
                    name=model_result['name'],
                    storage_key=model_storage_key,
                    metrics_json={
                        k: v for k, v in model_result.items()
                        if k not in ['model', 'name', 'storage_key']
                    },
                    version="1.0"
                )
                db.add(model_meta)
                model_metas.append(model_meta)

        db.commit()

        # Update run status
        run.status = "COMPLETED"
        run.finished_at = func.now()
        db.commit()

        # Store results (exclude model objects from serialization)
        models_for_storage = [
            {k: v for k, v in model.items() if k != 'model'}
            for model in models_results
        ]

        training_results = {
            "project_id": project_id,
            "run_id": run.id,
            "task_type": task_type,
            "target_column": target_column,
            "custom_params": custom_params,
            "dataset_info": {
                "total_samples": len(X),
                "training_samples": len(X_train),
                "test_samples": len(X_test),
                "features": len(feature_names)
            },
            "models": models_for_storage,
            "feature_names": feature_names.tolist()
        }

        # Save to storage
        storage_key = f"ml/{project_id}_{run.id}.json"
        storage.upload_fileobj(storage_key, io.BytesIO(json.dumps(training_results).encode('utf-8')))

        await manager.broadcast(project_id, {
            "type": "progress",
            "stage": "completed",
            "progress": 1.0,
            "message": "Training completed successfully!",
            "results": {
                "project_id": project_id,
                "run_id": str(run.id),
                "storage_key": storage_key,
                "task_type": task_type,
                "models_trained": len(models_results),
                "best_model": max(models_results, key=lambda x: x['score'])['name']
            }
        })

        return {
            "project_id": project_id,
            "run_id": str(run.id),
            "storage_key": storage_key,
            "task_type": task_type,
            "models_trained": len(models_results),
            "best_model": max(models_results, key=lambda x: x['score'])['name']
        }

    except Exception as e:
        await manager.broadcast(project_id, {
            "type": "error",
            "message": f"Training failed: {str(e)}"
        })
        raise

async def train_models_with_custom_params(
    X_train: np.ndarray,
    X_test: np.ndarray,
    y_train: np.ndarray,
    y_test: np.ndarray,
    task_type: str,
    X: np.ndarray,
    y: np.ndarray,
    custom_params: dict,
    project_id: str,
    manager: ConnectionManager
) -> List[Dict[str, Any]]:
    """
    Train models with custom hyperparameter configurations
    """
    results = []

    if task_type in ['binary_classification', 'multiclass_classification']:
        # Classification models with custom parameters
        models_and_params = [
            ('Logistic Regression', LogisticRegression(max_iter=1000, random_state=42), custom_params.get('Logistic Regression', {})),
            ('Random Forest', RandomForestClassifier(random_state=42), custom_params.get('Random Forest', {})),
            ('SVM', SVC(random_state=42), custom_params.get('SVM', {})),
            ('Decision Tree', DecisionTreeClassifier(random_state=42), custom_params.get('Decision Tree', {})),
            ('Naive Bayes', GaussianNB(), custom_params.get('Naive Bayes', {})),
            ('K-Nearest Neighbors', KNeighborsClassifier(), custom_params.get('K-Nearest Neighbors', {}))
        ]

        total_models = len(models_and_params)
        for i, (name, model, params) in enumerate(models_and_params):
            try:
                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "progress": 0.5 + (i / total_models) * 0.3,
                    "message": f"Training {name} with custom parameters...",
                    "logs": [f"[{name}] Using custom parameters: {params}"]
                })

                # Apply custom parameters
                if params:
                    model.set_params(**params)

                # Train the model
                model.fit(X_train, y_train)

                y_pred = model.predict(X_test)

                # Calculate metrics
                accuracy = accuracy_score(y_test, y_pred)
                precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
                recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
                f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)

                # Calculate cross-validation score
                cv_scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')
                cv_mean = float(np.round(np.mean(cv_scores), 4))
                cv_std = float(np.round(np.std(cv_scores), 4))

                results.append({
                    'name': name,
                    'model': model,
                    'best_params': params,
                    'accuracy': float(np.round(accuracy, 4)),
                    'precision': float(np.round(precision, 4)),
                    'recall': float(np.round(recall, 4)),
                    'f1_score': float(np.round(f1, 4)),
                    'cv_mean': cv_mean,
                    'cv_std': cv_std,
                    'score': float(accuracy)  # Primary score for ranking
                })

                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "progress": 0.5 + ((i + 1) / total_models) * 0.3,
                    "message": f"{name} training completed with accuracy: {accuracy:.4f}",
                    "logs": [f"[{name}] Final metrics - Accuracy: {accuracy:.4f}, Precision: {precision:.4f}, Recall: {recall:.4f}, F1: {f1:.4f}"]
                })

            except Exception as e:
                print(f"Error training {name}: {e}")
                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "stage": "error",
                    "error": str(e),
                    "logs": [f"[{name}] Training failed: {str(e)}"]
                })
                results.append({
                    'name': name,
                    'error': str(e),
                    'score': 0
                })

    else:
        # Regression models with custom parameters
        models_and_params = [
            ('Linear Regression', LinearRegression(), custom_params.get('Linear Regression', {})),
            ('Random Forest', RandomForestRegressor(random_state=42), custom_params.get('Random Forest', {})),
            ('SVR', SVR(), custom_params.get('SVR', {})),
            ('Decision Tree', DecisionTreeRegressor(random_state=42), custom_params.get('Decision Tree', {})),
            ('K-Nearest Neighbors', KNeighborsRegressor(), custom_params.get('K-Nearest Neighbors', {}))
        ]

        total_models = len(models_and_params)
        for i, (name, model, params) in enumerate(models_and_params):
            try:
                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "progress": 0.5 + (i / total_models) * 0.3,
                    "message": f"Training {name} with custom parameters...",
                    "logs": [f"[{name}] Using custom parameters: {params}"]
                })

                # Apply custom parameters
                if params:
                    model.set_params(**params)

                # Train the model
                model.fit(X_train, y_train)

                y_pred = model.predict(X_test)

                # Calculate metrics
                r2 = r2_score(y_test, y_pred)
                mse = mean_squared_error(y_test, y_pred)
                mae = mean_absolute_error(y_test, y_pred)

                # Calculate cross-validation score
                cv_scores = cross_val_score(model, X, y, cv=5, scoring='r2')
                cv_mean = float(np.round(np.mean(cv_scores), 4))
                cv_std = float(np.round(np.std(cv_scores), 4))

                results.append({
                    'name': name,
                    'model': model,
                    'best_params': params,
                    'r2_score': float(np.round(r2, 4)),
                    'mse': float(np.round(mse, 4)),
                    'mae': float(np.round(mae, 4)),
                    'cv_mean': cv_mean,
                    'cv_std': cv_std,
                    'score': float(r2)  # Primary score for ranking
                })

                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "progress": 0.5 + ((i + 1) / total_models) * 0.3,
                    "message": f"{name} training completed with R²: {r2:.4f}",
                    "logs": [f"[{name}] Final metrics - R²: {r2:.4f}, MSE: {mse:.4f}, MAE: {mae:.4f}"]
                })

            except Exception as e:
                print(f"Error training {name}: {e}")
                await manager.broadcast(project_id, {
                    "type": "model_progress",
                    "model_name": name,
                    "stage": "error",
                    "error": str(e),
                    "logs": [f"[{name}] Training failed: {str(e)}"]
                })
                results.append({
                    'name': name,
                    'error': str(e),
                    'score': float('-inf')
                })

    # Sort by score (descending)
    results.sort(key=lambda x: x.get('score', 0), reverse=True)
    return results
