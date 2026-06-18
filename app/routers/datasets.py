from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.session import get_db
from app.db.models import Dataset
from app.schemas.datasets import Dataset as DatasetSchema, DatasetPreview
from app.dependencies.auth import get_current_user
from app.services.dataset_service import DatasetService
from app.services.data_validation_service import DataValidationService
from app.services.data_science_service import DataScienceService

from app.config import settings

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
    # Validate file size
    try:
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)
        if file_size > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 50MB")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        # If seek/tell fails, fallback to header content-length check
        cl = file.headers.get("content-length")
        if cl and int(cl) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=400, detail="File size exceeds maximum limit of 50MB")

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
        dataset = DatasetService.get_dataset(dataset_id, current_user.id, db)
        return DatasetSchema.from_orm(dataset)
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
    project_id: str = "",
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        if page < 1:
            page = 1
        if limit < 1:
            limit = 20
        datasets = DatasetService.list_datasets(project_id, current_user.id, db, page, limit)
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
        return DatasetService.analyze_types(dataset_id, current_user.id, db)
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

@router.get("/{dataset_id}/quality-score")
def get_dataset_quality_score(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DataScienceService.get_quality_score(dataset_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{dataset_id}/feature-suggestions")
def get_feature_suggestions(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DataScienceService.get_feature_suggestions(dataset_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{dataset_id}/apply-features")
def apply_feature_transformations(
    dataset_id: str,
    transformations: List[dict],
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DataScienceService.apply_feature_transformations(dataset_id, transformations, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{dataset_id}/compare-drift/{target_id}")
def detect_data_drift(
    dataset_id: str,
    target_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        return DataScienceService.detect_data_drift(dataset_id, target_id, current_user.id, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
