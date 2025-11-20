from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.db.models import Dataset
from app.schemas.datasets import Dataset as DatasetSchema, DatasetPreview
from app.dependencies.auth import get_current_user
from app.services.dataset_service import DatasetService
from app.services.data_validation_service import DataValidationService
from app.storage import storage
import pandas as pd
import io
import json

router = APIRouter()

@router.post("/link/{dataset_id}/{project_id}")
def link_dataset_to_project(
    dataset_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DatasetService.link_dataset_to_project(dataset_id, project_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/link/{dataset_id}/{project_id}")
def unlink_dataset_from_project(
    dataset_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DatasetService.unlink_dataset_from_project(dataset_id, project_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/upload", response_model=DatasetSchema)
def upload_dataset(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        dataset = DatasetService.upload_dataset(file, project_id, current_user.id, db)
        return DatasetSchema.from_orm(dataset)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{dataset_id}/preview", response_model=DatasetPreview)
def get_dataset_preview(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        preview = DatasetService.get_dataset_preview(dataset_id, current_user.id, db)
        return DatasetPreview(**preview)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{dataset_id}", response_model=DatasetSchema)
def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DatasetService.get_dataset(dataset_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{dataset_id}/clean")
def clean_dataset(
    dataset_id: str,
    options: dict = {},  # Optional cleaning options
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DatasetService.clean_dataset(dataset_id, options, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{dataset_id}/transform")
def transform_dataset(
    dataset_id: str,
    options: dict = {},  # Optional transformation options
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DatasetService.transform_dataset(dataset_id, options, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        # First unlink from all projects to avoid foreign key constraint issues
        from app.db.models import ProjectDataset, DatasetVersion
        db.query(ProjectDataset).filter(ProjectDataset.dataset_id == dataset_id).delete()

        # Delete all dataset versions to avoid foreign key constraint issues
        db.query(DatasetVersion).filter(DatasetVersion.dataset_id == dataset_id).delete()

        db.commit()

        return DatasetService.delete_dataset(dataset_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[DatasetSchema])
def list_datasets(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    List all datasets for the current user
    """
    try:
        datasets = DatasetService.list_datasets("", current_user.id, db)
        return [DatasetSchema.from_orm(d) for d in datasets]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{dataset_id}/validate")
def validate_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DataValidationService.validate_dataset(dataset_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{dataset_id}/analyze-types")
def analyze_dataset_types(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        result = DatasetService.analyze_types(dataset_id, current_user.id, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{dataset_id}/summary")
def get_dataset_summary(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DatasetService.get_dataset_summary(dataset_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{dataset_id}/export")
def export_dataset(
    dataset_id: str,
    format: str = "csv",  # csv, json, xlsx
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export dataset in specified format and return file directly for download
    """
    try:
        # Verify dataset ownership
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == current_user.id
        ).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")

        # Load dataset from storage
        file_obj = storage.download_stream(dataset.storage_key)
        df = pd.read_csv(file_obj)

        # Generate export content based on format
        if format.lower() == "csv":
            output = io.StringIO()
            df.to_csv(output, index=False)
            content = output.getvalue()
            content_type = "text/csv"
            filename = f"{dataset.filename.rsplit('.', 1)[0]}_export.csv"
        elif format.lower() == "json":
            content = df.to_json(orient="records", indent=2)
            content_type = "application/json"
            filename = f"{dataset.filename.rsplit('.', 1)[0]}_export.json"
        elif format.lower() == "xlsx":
            output = io.BytesIO()
            df.to_excel(output, index=False, engine='openpyxl')
            content = output.getvalue()
            content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"{dataset.filename.rsplit('.', 1)[0]}_export.xlsx"
        else:
            raise HTTPException(status_code=400, detail="Unsupported export format. Use 'csv', 'json', or 'xlsx'")

        # Return file directly with proper headers for download
        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(content))
            }
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
