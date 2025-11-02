from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class PredictionRequest(BaseModel):
    model_id: str
    data: List[Dict[str, Any]]

class PredictionResponse(BaseModel):
    predictions: List[Any]
    summary: Optional[Dict[str, Any]] = None
    processing_time: Optional[float] = None

class BatchPredictionRequest(BaseModel):
    model_id: str
    file_key: str  # Storage key of uploaded file
    batch_size: Optional[int] = 1000

class BatchPredictionResponse(BaseModel):
    task_id: str
    status: str
    message: str

class BatchPredictionStatus(BaseModel):
    task_id: str
    status: str
    progress: float
    total_rows: Optional[int] = None
    processed_rows: Optional[int] = None
    results_key: Optional[str] = None
    error: Optional[str] = None

class PredictionResult(BaseModel):
    id: str
    model_id: str
    user_id: str
    input_data: Optional[Dict[str, Any]] = None
    predictions: Optional[Dict[str, Any]] = None
    summary: Optional[Dict[str, Any]] = None
    batch_id: Optional[str] = None
    status: str
    processing_time: Optional[float] = None
    created_at: datetime

class ExplainRequest(BaseModel):
    model_id: str
    data: List[Dict[str, Any]]
    method: Optional[str] = "shap"  # "shap" or "lime"

class ExplainResponse(BaseModel):
    explanations: List[Dict[str, Any]]
    feature_importance: Optional[Dict[str, float]] = None
    method: str
