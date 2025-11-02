from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class ReportGenerate(BaseModel):
    project_id: str
    report_type: str  # 'summary', 'detailed', 'custom'
    include_sections: Optional[list[str]] = None
    filters: Optional[Dict[str, Any]] = None

class Report(BaseModel):
    id: str
    project_id: str
    user_id: str
    report_type: str
    storage_key: str
    filename: str
    metadata_json: Optional[Dict[str, Any]]
    created_at: datetime
    download_url: Optional[str]

class ReportDownload(BaseModel):
    download_url: str
    expires_in: int  # seconds
