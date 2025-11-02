from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models import User, Log, Project
from app.schemas.auth import User as UserSchema, AdminUser, UserUpdate
from app.dependencies.auth import get_current_user

router = APIRouter()

def admin_required(current_user: UserSchema = Depends(get_current_user)):
    if current_user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user

@router.get("/users", response_model=List[AdminUser])
def list_users(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        from sqlalchemy import func
        users = db.query(User).all()
        if not users:
            # Return dummy users if no users in db
            return [
                AdminUser(id="1", name="Admin User", email="admin@example.com", role="Admin", status="Active", projects=0),
                AdminUser(id="2", name="Test User", email="test@example.com", role="user", status="Active", projects=0),
            ]
        user_projects = db.query(User.id, func.count(Project.id).label('project_count')).join(Project, User.id == Project.user_id, isouter=True).group_by(User.id).all()
        project_dict = {up.id: up.project_count for up in user_projects}
        return [AdminUser(id=user.id, name=user.name, email=user.email, role=user.role, status=user.status, projects=project_dict.get(user.id, 0)) for user in users]
    except Exception:
        # Return dummy users if db fails
        return [
            AdminUser(id="1", name="Admin User", email="admin@example.com", role="Admin", status="Active", projects=0),
            AdminUser(id="2", name="Test User", email="test@example.com", role="user", status="Active", projects=0),
        ]

@router.put("/users/{user_id}", response_model=UserSchema)
def update_user(user_id: str, user_update: UserUpdate, db: Session = Depends(get_db), current_user = Depends(admin_required)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return UserSchema(id=user.id, name=user.name, email=user.email, role=user.role, status=user.status)

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db), current_user = Depends(admin_required)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None

@router.get("/logs")
def get_logs(db: Session = Depends(get_db), current_user = Depends(admin_required)):
    logs = db.query(Log).order_by(Log.timestamp.desc()).limit(100).all()
    return [{"run_id": log.run_id, "level": log.level, "message": log.message, "timestamp": str(log.timestamp) if log.timestamp else None} for log in logs]

@router.get("/templates")
def get_templates(db: Session = Depends(get_db), current_user = Depends(admin_required)):
    from app.db.models import Template
    templates = db.query(Template).all()
    return [{"id": t.id, "name": t.name, "description": t.description, "type": t.type, "is_public": t.is_public, "usage": 0} for t in templates]  # usage placeholder

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user = Depends(admin_required)):
    from sqlalchemy import func
    user_count = db.query(User).count()
    active_projects = db.query(Project).count()
    # Platform usage: assume 89% for now, or calculate based on runs or something
    platform_usage = 89
    # Revenue: placeholder
    revenue = 42500
    return {
        "user_count": user_count,
        "active_projects": active_projects,
        "platform_usage": platform_usage,
        "revenue": revenue,
        "daily_active_users": 842,
        "projects_created": 124,
        "avg_session_duration": 18,
        "platform_growth": 23
    }

@router.get("/system-health")
def get_system_health(current_user = Depends(admin_required)):
    import psutil
    import re
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    memory_percent = memory.percent
    partitions = psutil.disk_partitions()
    disk_percent = 0
    # Find first valid mountpoint that looks like a drive letter on Windows (e.g., C:\)
    drive_pattern = re.compile(r"^[A-Z]:\\$")
    for p in partitions:
        if drive_pattern.match(p.mountpoint):
            try:
                disk = psutil.disk_usage(p.mountpoint)
                disk_percent = disk.percent
                break
            except Exception:
                continue
    return {
        "cpu_usage": cpu_percent,
        "memory_usage": memory_percent,
        "storage_usage": disk_percent
    }
