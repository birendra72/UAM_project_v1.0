from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models import Template, User
from app.schemas.templates import TemplateCreate, Template as TemplateSchema
from app.dependencies.auth import get_current_user

router = APIRouter()

@router.get("/", response_model=List[TemplateSchema])
def list_templates(db: Session = Depends(get_db)):
    templates = db.query(Template).filter(Template.is_public == 1).all()
    return [TemplateSchema.from_orm(t) for t in templates]

@router.get("/{template_id}", response_model=TemplateSchema)
def get_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(Template).filter(Template.id == template_id, Template.is_public == 1).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateSchema.from_orm(template)

@router.post("/{template_id}/apply")
def apply_template(
    template_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check project ownership
    from app.db.models import Project
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == current_user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Apply template config (for now, just store it in project or start a run)
    # This is a placeholder - in a real implementation, parse template.config_json and apply to project
    return {"message": "Template applied", "template_id": template_id, "project_id": project_id, "config": template.config_json}

@router.post("/admin", response_model=TemplateSchema)
def create_template(template_create: TemplateCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    template = Template(
        name=template_create.name,
        description=template_create.description,
        type=template_create.type,
        config_json=template_create.config_json,
        is_public=1,
        created_by=current_user.id
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return TemplateSchema.from_orm(template)
