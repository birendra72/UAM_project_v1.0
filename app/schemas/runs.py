from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime

class RunStart(BaseModel):
    project_id: str
    dataset_id: str
    options: Optional[Dict[str, Any]] = {}

class Run(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    dataset_id: str
    status: str
    current_task: Optional[str]
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    parameters_json: Optional[Dict[str, Any]]
    progress: float

class RunStatus(BaseModel):
    run_id: str
    status: str
    current_task: Optional[str]
    progress: float
    logs: List[Dict[str, Any]]

class Artifact(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    run_id: str
    type: str
    storage_key: str
    filename: str
    metadata_json: Optional[Dict[str, Any]]
    created_at: datetime
    download_url: Optional[str]
