from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from app.db.session import get_db
from app.db.models import User, Log, Project, Run
from app.schemas.auth import User as UserSchema, AdminUser, UserUpdate
from app.dependencies.auth import get_current_user
from sqlalchemy import func

router = APIRouter()

def admin_required(current_user: UserSchema = Depends(get_current_user)):
    if current_user.role != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin privileges required")
    return current_user

@router.get("/users", response_model=List[AdminUser])
def list_users(db: Session = Depends(get_db), current_user = Depends(admin_required)):
    """List all users — admin only."""
    users = db.query(User).all()
    if not users:
        return []
    user_projects = (
        db.query(User.id, func.count(Project.id).label("project_count"))
        .outerjoin(Project, User.id == Project.user_id)
        .group_by(User.id)
        .all()
    )
    project_dict = {up.id: up.project_count for up in user_projects}
    return [
        AdminUser(
            id=user.id, name=user.name, email=user.email,
            role=user.role, status=user.status,
            projects=project_dict.get(user.id, 0)
        )
        for user in users
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
    return [
        {
            "run_id": log.run_id,
            "level": log.level,
            "message": log.message,
            "timestamp": str(log.timestamp) if log.timestamp else None
        }
        for log in logs
    ]

@router.get("/templates")
def get_templates(db: Session = Depends(get_db), current_user = Depends(admin_required)):
    from app.db.models import Template
    templates = db.query(Template).all()
    return [
        {"id": t.id, "name": t.name, "description": t.description,
         "type": t.type, "is_public": t.is_public, "usage": 0}
        for t in templates
    ]

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user = Depends(admin_required)):
    """Real platform stats computed from the database."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    user_count = db.query(User).count()
    active_projects = db.query(Project).count()

    # Projects created this week
    projects_this_week = db.query(Project).filter(Project.created_at >= week_ago).count()

    # Active users: distinct projects with a run in the last 7 days
    active_users_now = (
        db.query(func.count(func.distinct(Run.project_id)))
        .filter(Run.started_at >= week_ago)
        .scalar() or 0
    )
    active_users_prev = (
        db.query(func.count(func.distinct(Run.project_id)))
        .filter(Run.started_at.between(two_weeks_ago, week_ago))
        .scalar() or 0
    )

    # Platform usage %: fraction of users who had at least one run in 7 days
    usage_pct = round(
        (active_users_now / max(user_count, 1)) * 100, 1
    ) if user_count > 0 else 0.0

    # Period-over-period growth
    growth = 0.0
    if active_users_prev > 0:
        growth = round(((active_users_now - active_users_prev) / active_users_prev) * 100, 1)

    return {
        "user_count": user_count,
        "active_projects": active_projects,
        "platform_usage": usage_pct,
        "revenue": 0,           # Integrate Stripe for real billing data
        "daily_active_users": active_users_now,
        "projects_created": projects_this_week,
        "avg_session_duration": 0,  # Requires user_sessions table (Wave 2)
        "platform_growth": growth
    }

@router.get("/system-health")
def get_system_health(current_user = Depends(admin_required)):
    """Live system resource metrics via psutil (platform-agnostic)."""
    import psutil
    cpu_percent = psutil.cpu_percent(interval=1)
    memory = psutil.virtual_memory()
    # Platform-agnostic disk: use root "/" on Linux/Mac, fall back to first partition
    try:
        disk = psutil.disk_usage("/")
        disk_percent = disk.percent
    except Exception:
        try:
            partitions = psutil.disk_partitions()
            disk_percent = psutil.disk_usage(partitions[0].mountpoint).percent if partitions else 0
        except Exception:
            disk_percent = 0
    return {
        "cpu_usage": cpu_percent,
        "memory_usage": memory.percent,
        "storage_usage": disk_percent
    }
