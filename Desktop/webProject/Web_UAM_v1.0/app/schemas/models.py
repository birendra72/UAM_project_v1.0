from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime

class ModelMeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    name: str
    storage_key: str
    metrics_json: Optional[Dict[str, Any]]
    created_at: datetime
    version: Optional[str]

class PredictRequest(BaseModel):
    data: List[Dict[str, Any]]

class PredictResponse(BaseModel):
    predictions: List[Any]
    summary: Optional[Dict[str, Any]] = None

class BatchPredictRequest(BaseModel):
    file_key: str  # Storage key of uploaded file
    batch_size: Optional[int] = 1000

class BatchPredictResponse(BaseModel):
    task_id: str
    status: str
    message: str

class BatchPredictStatus(BaseModel):
    task_id: str
    status: str
    progress: float
    total_rows: Optional[int] = None
    processed_rows: Optional[int] = None
    results_key: Optional[str] = None
    error: Optional[str] = None

class ExplainRequest(BaseModel):
    data: List[Dict[str, Any]]
    method: Optional[str] = "shap"  # "shap" or "lime"

class ExplainResponse(BaseModel):
    explanations: List[Dict[str, Any]]
    feature_importance: Optional[Dict[str, float]] = None
