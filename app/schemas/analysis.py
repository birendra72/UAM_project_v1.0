from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class TaskAnalysisRequest(BaseModel):
    target_column: Optional[str] = None

class TaskAnalysisResponse(BaseModel):
    project_id: str
    task_analysis: Dict[str, Any]
    dataset_info: Dict[str, Any]

class EDARequest(BaseModel):
    analysis_type: str = "full"  # 'full', 'basic', 'advanced'
    include_visualizations: bool = True

class EDAInsight(BaseModel):
    type: str  # 'distribution', 'correlation', 'outlier', 'missing_values', etc.
    title: str
    description: str
    severity: str  # 'low', 'medium', 'high', 'critical'
    data: Dict[str, Any]
    recommendations: List[str]

class EDAResults(BaseModel):
    project_id: str
    run_id: str
    insights: List[EDAInsight]
    summary: Dict[str, Any]
    visualizations: Optional[Dict[str, str]] = None  # storage keys for charts
    created_at: datetime

class MLTrainingRequest(BaseModel):
    task_type: str
    target_column: str
    test_size: float = 0.2
    random_state: int = 42

class MLTrainingResponse(BaseModel):
    project_id: str
    run_id: str
    task_type: str
    models_trained: int
    best_model: str

class TrainingStatus(BaseModel):
    run_id: str
    status: str
    current_task: Optional[str]
    progress: float
    logs: List[Dict[str, Any]]
    results: Optional[Dict[str, Any]] = None

class HyperparameterTuningRequest(BaseModel):
    task_type: str
    target_column: str
    algorithm: str
    search_method: str = "grid"
    max_evals: int = 50
    cv_folds: int = 5
    test_size: float = 0.2
    random_state: int = 42

class HyperparameterTuningResponse(BaseModel):
    run_id: str
    algorithm: str
    best_params: Dict[str, Any]
    best_score: float
    metrics: Dict[str, float]
    cv_results: Dict[str, Any]

class AdvancedMetricsRequest(BaseModel):
    model_id: str
    task_type: str
    target_column: str

class AdvancedMetricsResponse(BaseModel):
    model_id: str
    advanced_metrics: Dict[str, Any]
