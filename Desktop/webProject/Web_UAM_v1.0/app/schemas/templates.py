from pydantic import BaseModel, ConfigDict
from typing import Optional, Dict, Any
from datetime import datetime

class TemplateBase(BaseModel):
    name: str
    description: Optional[str]
    type: str
    config_json: Dict[str, Any]

class TemplateCreate(TemplateBase):
    pass

class Template(TemplateBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_public: int
    created_by: Optional[str]
    created_at: datetime
