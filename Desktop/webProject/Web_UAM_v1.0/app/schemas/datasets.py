from pydantic import BaseModel, ConfigDict
from typing import List, Dict, Any, Optional, Hashable
from datetime import datetime

class DatasetCreate(BaseModel):
    filename: str
    user_id: str

class Dataset(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    filename: str
    storage_key: str
    rows: Optional[int]
    cols: Optional[int]
    columns_json: Optional[Dict[str, Any]]
    uploaded_at: datetime

class DatasetPreview(BaseModel):
    columns: List[str]
    first_rows: List[Dict[Hashable, Any]]
    model_config = ConfigDict(arbitrary_types_allowed=True)
