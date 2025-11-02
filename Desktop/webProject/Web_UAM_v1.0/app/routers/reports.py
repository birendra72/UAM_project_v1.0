from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.db.models import Project, Artifact
from app.dependencies.auth import get_current_user
from app.services.report_service import ReportService
from app.storage import storage

router = APIRouter()

@router.post("/projects/{project_id}/generate")
def generateProjectReport(
    project_id: str,
    include_eda: bool = Query(True, description="Include EDA results in report"),
    include_models: bool = Query(True, description="Include model results in report"),
    format_type: str = Query("pdf", description="Report format: pdf or html"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Generate a comprehensive report for a project
    """
    try:
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Generate report
        result = ReportService.generate_comprehensive_report(
            project_id=project_id,
            user_id=current_user.id,
            db=db,
            include_eda=include_eda,
            include_models=include_models,
            format_type=format_type
        )

        return {
            "message": "Report generated successfully",
            "report_key": result["report_key"],
            "format": result["format"],
            "artifact_id": result["artifact_id"]
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")

@router.get("/projects/{project_id}/reports")
def getProjectReports(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List all reports for a project
    """
    # Verify project ownership
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get report artifacts
    reports = db.query(Artifact).filter(
        Artifact.type == "report"
    ).join(Project, Artifact.run_id == Project.id).filter(
        Project.id == project_id,
        Project.user_id == current_user.id
    ).all()

    return [
        {
            "id": report.id,
            "filename": report.filename,
            "storage_key": report.storage_key,
            "created_at": str(report.created_at),
            "metadata": report.metadata_json
        }
        for report in reports
    ]

@router.get("/{artifact_id}/download")
def getReportDownloadUrl(
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get download URL for a report
    """
    # Get artifact and verify ownership
    artifact = db.query(Artifact).join(Project).filter(
        Artifact.id == artifact_id,
        Artifact.type == "report",
        Project.user_id == current_user.id
    ).first()

    if not artifact:
        raise HTTPException(status_code=404, detail="Report not found")

    # Generate presigned URL for download
    try:
        download_url = storage.get_presigned_url(artifact.storage_key, expiry_seconds=3600)
        return {
            "download_url": download_url,
            "filename": artifact.filename,
            "content_type": "application/pdf" if artifact.filename.endswith('.pdf') else "text/html"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {str(e)}")
