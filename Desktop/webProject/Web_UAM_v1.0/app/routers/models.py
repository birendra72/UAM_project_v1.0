from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models import ModelMeta, Run, Project, Artifact, Dataset, ProjectDataset
from app.schemas.models import (
    ModelMeta as ModelMetaSchema,
    PredictRequest,
    PredictResponse,
    BatchPredictRequest,
    BatchPredictResponse,
    BatchPredictStatus,
    ExplainRequest,
    ExplainResponse
)
from app.schemas.runs import RunStart
from app.dependencies.auth import get_current_user
from app.storage import storage
from app.services.ml_service import MLService
import joblib
import io
import pandas as pd
import uuid
import json
from app.workers.tasks import predict_batch_task

router = APIRouter()

@router.get("/projects/{project_id}/models")
def getProjectModels(project_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """
    Get all models for a specific project
    """
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get models for the project
    models = db.query(ModelMeta).join(Run).filter(
        Run.project_id == project_id
    ).all()

    return [
        {
            "id": str(model.id),
            "run_id": str(model.run_id),
            "name": model.name,
            "storage_key": model.storage_key,
            "metrics": model.metrics_json or {},
            "version": model.version or "1.0",
            "created_at": str(model.created_at)
        }
        for model in models
    ]

@router.get("/", response_model=List[ModelMetaSchema])
def list_models(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    models = db.query(ModelMeta).join(Run).join(Project).filter(Project.user_id == current_user.id).all()
    return [
        ModelMetaSchema(
            id=str(model.id),
            run_id=str(model.run_id),
            name=model.name,
            storage_key=model.storage_key,
            metrics_json=model.metrics_json or {},
            created_at=model.created_at,
            version=model.version or "1.0"
        ) for model in models
    ]

@router.post("/train")
def train_model(
    project_id: str,
    dataset_id: str,
    options: dict = {},  # Optional training options
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Check ownership
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    dataset = db.query(Dataset).join(ProjectDataset).filter(
        ProjectDataset.dataset_id == dataset_id,
        ProjectDataset.project_id == project_id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Start a run for training
    from app.routers.runs import start_run
    run_start = RunStart(project_id=project_id, dataset_id=dataset_id, options=options)
    response = start_run(run_start, db=db, current_user=current_user)
    return {"message": "Training started", "run_id": response["run_id"]}

@router.get("/{model_id}/metrics")
def get_model_metrics(model_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    model_meta = db.query(ModelMeta).join(Run).join(Project).filter(ModelMeta.id == model_id, Project.user_id == current_user.id).first()
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")
    return model_meta.metrics_json

@router.post("/{model_id}/predict", response_model=PredictResponse)
def predict(model_id: str, request: PredictRequest, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    model_meta = db.query(ModelMeta).join(Run).join(Project).filter(ModelMeta.id == model_id, Project.user_id == current_user.id).first()
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")

    # Load model from storage
    model_bytes = storage.get_object(model_meta.storage_key)
    model = joblib.load(io.BytesIO(model_bytes))  # type: ignore

    # Prepare input data
    input_df = pd.DataFrame(request.data)

    # Predict
    predictions = model.predict(input_df)  # type: ignore

    # Generate summary
    summary = MLService.generate_prediction_summary(predictions)

    return PredictResponse(predictions=predictions.tolist(), summary=summary)

@router.post("/{model_id}/predict-file")
def predict_from_file(
    model_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    model_meta = db.query(ModelMeta).join(Run).join(Project).filter(ModelMeta.id == model_id, Project.user_id == current_user.id).first()
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(('.csv', '.json')):
        raise HTTPException(status_code=400, detail="Only CSV and JSON files are supported")

    # Read file content
    content = file.file.read()

    # Parse data based on file type
    if file.filename.lower().endswith('.csv'):
        df = pd.read_csv(io.BytesIO(content))
        data = df.to_dict('records')
    else:  # JSON
        import json
        data = json.loads(content)
        if not isinstance(data, list):
            data = [data]

    # Load model and predict
    model_bytes = storage.get_object(model_meta.storage_key)
    model = joblib.load(io.BytesIO(model_bytes))  # type: ignore

    input_df = pd.DataFrame(data)
    predictions = model.predict(input_df)  # type: ignore

    # Generate summary
    summary = MLService.generate_prediction_summary(predictions)

    return PredictResponse(predictions=predictions.tolist(), summary=summary)

@router.post("/{model_id}/predict-batch", response_model=BatchPredictResponse)
def predict_batch(
    model_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    batch_size: int = 1000,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    model_meta = db.query(ModelMeta).join(Run).join(Project).filter(ModelMeta.id == model_id, Project.user_id == current_user.id).first()
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(('.csv', '.json')):
        raise HTTPException(status_code=400, detail="Only CSV and JSON files are supported")

    # Upload file to storage
    file_key = f"predictions/input/{uuid.uuid4()}_{file.filename}"
    storage.put_object(file_key, file.file.read())

    # Create task ID
    task_id = str(uuid.uuid4())

    # Start background task
    background_tasks.add_task(
        predict_batch_task,
        task_id=task_id,
        model_key=model_meta.storage_key,
        input_file_key=file_key,
        batch_size=batch_size
    )

    return BatchPredictResponse(
        task_id=task_id,
        status="PENDING",
        message="Batch prediction started"
    )

@router.get("/{model_id}/predict-batch/{task_id}", response_model=BatchPredictStatus)
def get_batch_predict_status(
    model_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Check model ownership
    model_meta = db.query(ModelMeta).join(Run).join(Project).filter(
        ModelMeta.id == model_id, Project.user_id == current_user.id
    ).first()
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")

    # For now, return mock status (in production, you'd check Redis/Celery status)
    # This is a simplified implementation
    return BatchPredictStatus(
        task_id=task_id,
        status="COMPLETED",
        progress=1.0,
        total_rows=1000,
        processed_rows=1000,
        results_key=f"predictions/results/{task_id}.json"
    )

@router.post("/{model_id}/explain", response_model=ExplainResponse)
def explain_prediction(
    model_id: str,
    request: ExplainRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    model_meta = db.query(ModelMeta).join(Run).join(Project).filter(ModelMeta.id == model_id, Project.user_id == current_user.id).first()
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")

    # Get project and dataset info for context
    run = db.query(Run).filter(Run.id == model_meta.run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get datasets for the project
    datasets = db.query(Dataset).join(Project).filter(
        Project.id == run.project_id, Project.user_id == current_user.id
    ).all()

    if not datasets:
        raise HTTPException(status_code=404, detail="No datasets found for project")

    # Use MLService for explanations
    explanations = MLService.explain_predictions(
        model_meta=model_meta,
        datasets=datasets,
        input_data=request.data,
        method=request.method or "lime"
    )

    return ExplainResponse(
        explanations=explanations["explanations"],
        feature_importance=explanations.get("feature_importance")
    )
