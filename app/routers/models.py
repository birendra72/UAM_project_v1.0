from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
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
from celery.result import AsyncResult
from app.workers.celery_app import celery_app

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

    # Validate input data
    validation = MLService.validate_prediction_input(model_meta, request.data)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail=validation)

    # Load model from storage
    model_bytes = storage.get_object(model_meta.storage_key)
    if hasattr(model_bytes, "read"):
        model = joblib.load(model_bytes)
    else:
        model = joblib.load(io.BytesIO(model_bytes))  # type: ignore

    # Prepare input data
    input_df = pd.DataFrame(request.data)
    
    # Ensure correct column ordering
    feature_names = model_meta.metrics_json.get("feature_names", [])
    if feature_names:
        input_df = input_df[feature_names]

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

    # Validate input data
    validation = MLService.validate_prediction_input(model_meta, data)
    if not validation["valid"]:
        raise HTTPException(status_code=422, detail=validation)

    # Load model and predict
    model_bytes = storage.get_object(model_meta.storage_key)
    if hasattr(model_bytes, "read"):
        model = joblib.load(model_bytes)
    else:
        model = joblib.load(io.BytesIO(model_bytes))  # type: ignore

    input_df = pd.DataFrame(data)
    feature_names = model_meta.metrics_json.get("feature_names", [])
    if feature_names:
        input_df = input_df[feature_names]

    predictions = model.predict(input_df)  # type: ignore

    # Generate summary
    summary = MLService.generate_prediction_summary(predictions)

    return PredictResponse(predictions=predictions.tolist(), summary=summary)

@router.post("/{model_id}/predict-batch", response_model=BatchPredictResponse)
def predict_batch(
    model_id: str,
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

    content = file.file.read()

    # Fast validation of file sample to prevent starting a failing background task
    try:
        if file.filename.lower().endswith('.csv'):
            df_sample = pd.read_csv(io.BytesIO(content), nrows=5)
            sample_data = df_sample.to_dict('records')
        else:
            import json
            sample_data = json.loads(content)
            if isinstance(sample_data, list) and sample_data:
                sample_data = sample_data[:5]
            else:
                sample_data = [sample_data]
        
        validation = MLService.validate_prediction_input(model_meta, sample_data)
        if not validation["valid"]:
            raise HTTPException(status_code=422, detail=validation)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to validate file schema: {str(e)}")

    # Upload file to storage
    file_key = f"predictions/input/{uuid.uuid4()}_{file.filename}"
    storage.put_object(file_key, content)

    # Create task ID
    task_id = str(uuid.uuid4())

    # Start background task enqueued via Celery
    predict_batch_task.apply_async(
        kwargs={
            "task_id": task_id,
            "model_key": model_meta.storage_key,
            "input_file_key": file_key,
            "batch_size": batch_size
        },
        task_id=task_id
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

    res = AsyncResult(task_id, app=celery_app)
    state = res.state
    progress = 0.0
    results_key = None
    error = None

    if state == "PROGRESS":
        progress = res.info.get("progress", 0.0) if res.info else 0.0
    elif state == "SUCCESS":
        progress = 1.0
        info = res.info or {}
        results_key = info.get("results_key")
    elif state == "FAILURE":
        progress = 0.0
        error = str(res.info) if res.info else "Unknown error"

    return BatchPredictStatus(
        task_id=task_id,
        status=state,
        progress=progress,
        total_rows=None,
        processed_rows=None,
        results_key=results_key,
        error=error
    )

@router.get("/{model_id}/explain", response_model=ExplainResponse)
def get_model_explanation(
    model_id: str,
    method: Optional[str] = "shap",
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    model_meta = db.query(ModelMeta).join(Run).join(Project).filter(
        ModelMeta.id == model_id, Project.user_id == current_user.id
    ).first()
    if not model_meta:
        raise HTTPException(status_code=404, detail="Model not found")

    # Get project and dataset info for context
    run = db.query(Run).filter(Run.id == model_meta.run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get datasets for the project
    datasets = db.query(Dataset).join(ProjectDataset).join(Project).filter(
        Project.id == run.project_id, Project.user_id == current_user.id
    ).all()

    if not datasets:
        raise HTTPException(status_code=404, detail="No datasets found for project")

    # Load first 5 rows of the principal dataset as sample data
    try:
        file_obj = storage.download_stream(datasets[0].storage_key)
        df = pd.read_csv(file_obj)
        if 'target' in df.columns:
            df = df.drop(columns=['target'])
        # Drop internal columns if they exist
        internal_cols = [c for c in ['_dataset_id', '_dataset_name'] if c in df.columns]
        if internal_cols:
            df = df.drop(columns=internal_cols)
        sample_data = df.head(5).to_dict('records')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read dataset sample: {str(e)}")

    # Use MLService for explanations
    explanations = MLService.explain_predictions(
        model_meta=model_meta,
        datasets=datasets,
        input_data=sample_data,
        method=method or "shap"
    )

    return ExplainResponse(
        explanations=explanations["explanations"],
        feature_importance=explanations.get("feature_importance")
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
    datasets = db.query(Dataset).join(ProjectDataset).join(Project).filter(
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
