from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from uuid import UUID
from app.db.session import get_db
from app.db.models import Project, Artifact, Run
from app.dependencies.auth import get_current_user
from app.services.report_service import ReportService
from app.storage import storage

router = APIRouter()

@router.get("/")
def list_reports(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List all reports for the current user
    """
    # Get all report artifacts for the user's projects with relationships loaded
    reports = db.query(Artifact).options(joinedload(Artifact.run).joinedload(Run.project)).filter(
        Artifact.type == "report"
    ).join(Run, Artifact.run_id == Run.id).join(Project, Run.project_id == Project.id).filter(
        Project.user_id == current_user.id
    ).all()

    return [
        {
            "id": report.id,
            "filename": report.filename,
            "storage_key": report.storage_key,
            "created_at": str(report.created_at),
            "metadata": report.metadata_json,
            "project_id": report.run.project_id if report.run else None
        }
        for report in reports
    ]

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
        Artifact.type == "report",
        Artifact.user_id == current_user.id
    ).join(Run, Artifact.run_id == Run.id).filter(
        Run.project_id == project_id
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
def downloadReport(
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Download a report file directly
    """
    try:
        # Convert string to UUID for proper database query
        artifact_uuid = artifact_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid artifact ID format")

    # Get artifact with relationships loaded and verify ownership
    artifact = db.query(Artifact).options(joinedload(Artifact.run).joinedload(Run.project)).filter(
        Artifact.id == artifact_uuid,
        Artifact.type == "report"
    ).first()

    # Debug logging
    print(f"Artifact found: {artifact is not None}")
    if artifact:
        print(f"Artifact run: {artifact.run is not None}")
        if artifact.run:
            print(f"Run project: {artifact.run.project is not None}")
            if artifact.run.project:
                print(f"Project user_id: {artifact.run.project.user_id}")
                print(f"Current user_id: {current_user.id}")
                print(f"Ownership check: {artifact.run.project.user_id == current_user.id}")

    if not artifact or not artifact.run or not artifact.run.project or artifact.run.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")

    # Check if file exists in storage
    try:
        file_data = storage.get_object(artifact.storage_key)
        if file_data is None:
            raise HTTPException(status_code=404, detail="Report file not found in storage")

        # Determine content type
        content_type = "application/pdf" if artifact.filename.endswith('.pdf') else "text/html"

        # Read file content
        if hasattr(file_data, 'read'):
            content = file_data.read()
            if isinstance(content, (bytes, bytearray, memoryview)):
                file_content = bytes(content)
            else:
                file_content = content.encode('utf-8')
        elif isinstance(file_data, bytes):
            file_content = file_data
        else:
            file_content = str(file_data).encode('utf-8')

        # Return file with proper headers
        from fastapi.responses import Response
        return Response(
            content=file_content,
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename={artifact.filename}",
                "Content-Length": str(len(file_content))
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download report: {str(e)}")

@router.delete("/{artifact_id}/delete")
def deleteReport(
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Delete a report artifact
    """
    try:
        # Convert string to UUID for proper database query
        artifact_uuid = artifact_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid artifact ID format")

    # Get artifact with relationships loaded and verify ownership
    artifact = db.query(Artifact).options(joinedload(Artifact.run).joinedload(Run.project)).filter(
        Artifact.id == artifact_uuid,
        Artifact.type == "report"
    ).first()

    # Debug logging
    print(f"Artifact found: {artifact is not None}")
    if artifact:
        print(f"Artifact run: {artifact.run is not None}")
        if artifact.run:
            print(f"Run project: {artifact.run.project is not None}")
            if artifact.run.project:
                print(f"Project user_id: {artifact.run.project.user_id}")
                print(f"Current user_id: {current_user.id}")
                print(f"Ownership check: {artifact.run.project.user_id == current_user.id}")

    if not artifact or not artifact.run or not artifact.run.project or artifact.run.project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        # Delete from storage
        storage.delete_file(artifact.storage_key)

        # Delete from database
        db.delete(artifact)
        db.commit()

        return {"message": "Report deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete report: {str(e)}")

@router.get("/{artifact_id}/preview")
def previewReport(
    artifact_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get report content for inline preview
    """
    try:
        # Convert string to UUID for proper database query
        artifact_uuid = artifact_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid artifact ID format")

    # Get artifact with relationships loaded and verify ownership
    artifact = db.query(Artifact).filter(
        Artifact.id == artifact_uuid,
        Artifact.type == "report",
        Artifact.user_id == current_user.id
    ).first()

    if not artifact:
        raise HTTPException(status_code=404, detail="Report not found")

    # Check if file exists in storage
    try:
        file_data = storage.get_object(artifact.storage_key)
        if file_data is None:
            raise HTTPException(status_code=404, detail="Report file not found in storage")

        # Read file content
        if hasattr(file_data, 'read'):
            content = file_data.read()
            if isinstance(content, (bytes, bytearray, memoryview)):
                file_content = bytes(content)
            else:
                file_content = content.encode('utf-8')
        elif isinstance(file_data, bytes):
            file_content = file_data
        else:
            file_content = str(file_data).encode('utf-8')

        # For HTML reports, return content directly
        if artifact.filename.endswith('.html'):
            from fastapi.responses import HTMLResponse
            return HTMLResponse(content=file_content.decode('utf-8'))

        # For PDF reports, return base64 encoded content for frontend preview
        elif artifact.filename.endswith('.pdf'):
            import base64
            encoded_content = base64.b64encode(file_content).decode('utf-8')
            return {
                "content": encoded_content,
                "content_type": "application/pdf",
                "filename": artifact.filename
            }

        else:
            # Fallback for other formats
            return {
                "content": file_content.decode('utf-8'),
                "content_type": "text/plain",
                "filename": artifact.filename
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview report: {str(e)}")
