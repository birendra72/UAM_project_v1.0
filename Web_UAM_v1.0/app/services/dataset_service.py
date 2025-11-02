from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
import json
import uuid
import io
import os
from pathlib import Path
from fastapi import UploadFile
from app.db.models import Dataset, Project as ProjectModel, ProjectDataset, DatasetVersion, Run, Artifact, Log, ModelMeta, PredictionResult
from app.storage import storage
import numpy as np

class DatasetService:
    @staticmethod
    def _get_file_extension(filename: Optional[str]) -> str:
        """Get file extension from filename"""
        if filename is None:
            return '.csv'  # Default to CSV
        return os.path.splitext(filename)[1].lower()

    @staticmethod
    def _read_dataframe_from_file(file_obj, filename: Optional[str]) -> pd.DataFrame:
        """Read DataFrame from file based on extension, supporting multiple formats"""
        if filename is None:
            # Default to CSV if filename is None
            return pd.read_csv(file_obj)
        ext = DatasetService._get_file_extension(filename)
        if ext == '.xlsx' or ext == '.xls':
            return pd.read_excel(file_obj)
        elif ext == '.csv':
            return pd.read_csv(file_obj)
        elif ext == '.json':
            return pd.read_json(file_obj)
        elif ext == '.parquet':
            return pd.read_parquet(file_obj)
        elif ext == '.feather':
            return pd.read_feather(file_obj)
        else:
            # Default to CSV for backward compatibility
            return pd.read_csv(file_obj)
    @staticmethod
    def link_dataset_to_project(
        dataset_id: str,
        project_id: str,
        user_id: str,
        db: Session
    ):
        # Verify project belongs to user
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == user_id).first()
        if not project:
            raise ValueError("Project not found")

        # Check if dataset exists and user owns it
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Check if link already exists
        existing_link = db.query(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            ProjectDataset.dataset_id == dataset_id
        ).first()
        if existing_link:
            raise ValueError("Dataset already linked to project")

        # Create link
        project_dataset = ProjectDataset(project_id=project_id, dataset_id=dataset_id)
        db.add(project_dataset)
        db.commit()

        return {"message": "Dataset linked to project successfully"}

    @staticmethod
    def unlink_dataset_from_project(
        dataset_id: str,
        project_id: str,
        user_id: str,
        db: Session
    ):
        # Verify project belongs to user
        project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == user_id).first()
        if not project:
            raise ValueError("Project not found")

        # Find and delete link
        link = db.query(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            ProjectDataset.dataset_id == dataset_id
        ).first()
        if not link:
            raise ValueError("Dataset not linked to project")

        db.delete(link)
        db.commit()

        return {"message": "Dataset unlinked from project successfully"}

    @staticmethod
    def upload_dataset(
        file: UploadFile,
        project_id: Optional[str],
        user_id: str,
        db: Session
    ):
        # Check if project belongs to user (if provided)
        if project_id:
            project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == user_id).first()
            if not project:
                raise ValueError("Project not found")

        # Generate storage key
        storage_key = f"datasets/{uuid.uuid4()}_{file.filename}"

        # Save file to storage
        storage.upload_fileobj(storage_key, file.file)

        # Try to read with pandas for metadata and smart type detection
        try:
            df = DatasetService._read_dataframe_from_file(file.file, file.filename)
            rows, cols = df.shape
            columns_json = DatasetService._analyze_column_types(df)
        except Exception:
            rows = None
            cols = None
            columns_json = None

        # Create dataset record with user ownership
        dataset = Dataset(
            user_id=user_id,
            filename=file.filename,
            storage_key=storage_key,
            rows=rows,
            cols=cols,
            columns_json=columns_json
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)

        # Link dataset to project if project_id provided
        if project_id:
            project_dataset = ProjectDataset(project_id=project_id, dataset_id=dataset.id)
            db.add(project_dataset)
            db.commit()

        return dataset

    @staticmethod
    def _sanitize_dataframe_for_json(df: pd.DataFrame) -> pd.DataFrame:
        """Replace NaN, inf, and other non-JSON serializable values with None"""
        return df.replace([np.inf, -np.inf, np.nan], None)

    @staticmethod
    def get_dataset_preview(
        dataset_id: str,
        user_id: str,
        db: Session
    ):
        # Check if dataset exists and user owns it
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Get file from storage
        file_obj = storage.download_stream(dataset.storage_key)
        if dataset.filename is None:
            raise ValueError("Dataset filename is missing")
        df = DatasetService._read_dataframe_from_file(file_obj, dataset.filename)

        # Limit preview to 100 rows for performance
        preview_df = df.head(100)
        # Sanitize for JSON serialization
        sanitized_df = DatasetService._sanitize_dataframe_for_json(preview_df)
        first_rows = sanitized_df.to_dict('records')
        columns = list(df.columns)

        # Generate summary statistics
        summary_stats = DatasetService._generate_summary_stats(df)

        return {
            "columns": columns,
            "first_rows": first_rows,
            "summary_stats": summary_stats
        }

    @staticmethod
    def _generate_summary_stats(df: pd.DataFrame) -> dict:
        """Generate summary statistics for the dataset"""
        import numpy as np

        def safe_float(value):
            """Convert to float, handling NaN and other missing values"""
            if pd.isna(value):
                return None
            try:
                return float(round(value, 2))
            except (ValueError, TypeError):
                return None

        stats = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "column_stats": {}
        }

        for col in df.columns:
            col_stats = {
                "dtype": str(df[col].dtype),
                "null_count": int(df[col].isnull().sum()),
                "null_percentage": round((df[col].isnull().sum() / len(df)) * 100, 2),
                "unique_count": int(df[col].nunique())
            }

            # Add type-specific statistics
            if df[col].dtype in ['int64', 'float64']:
                # Handle NaN values properly for JSON serialization
                col_stats.update({
                    "mean": safe_float(df[col].mean()),
                    "median": safe_float(df[col].median()),
                    "std": safe_float(df[col].std()),
                    "min": safe_float(df[col].min()),
                    "max": safe_float(df[col].max())
                })
            elif df[col].dtype == 'object':
                # For categorical/text columns, show most common values
                value_counts = df[col].value_counts().head(5)
                col_stats["top_values"] = value_counts.to_dict()

            stats["column_stats"][col] = col_stats

        return stats

    @staticmethod
    def get_dataset(
        dataset_id: str,
        user_id: str,
        db: Session
    ):
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")
        return dataset

    @staticmethod
    def clean_dataset(
        dataset_id: str,
        options: dict,
        user_id: str,
        db: Session
    ):
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Load dataset
        file_obj = storage.download_stream(dataset.storage_key)
        df = DatasetService._read_dataframe_from_file(file_obj, dataset.filename)

        # Store original dimensions
        rows_before = df.shape[0]
        cols_before = df.shape[1]

        # Apply cleaning: drop duplicates, fill missing values with smart strategies
        df_clean = df.drop_duplicates()

        if options and options.get("fill_na"):
            # Smart filling based on column types
            for col in df_clean.columns:
                if df_clean[col].isnull().any():
                    if df_clean[col].dtype in ['int64', 'float64']:
                        # For numeric columns, use mean or median based on outliers
                        if DatasetService._has_outliers(df_clean[col]):
                            fill_value = df_clean[col].median()
                        else:
                            fill_value = df_clean[col].mean()
                        df_clean[col] = df_clean[col].fillna(fill_value)
                    else:
                        # For categorical/text columns, use mode
                        mode_value = df_clean[col].mode()
                        if not mode_value.empty:
                            df_clean[col] = df_clean[col].fillna(mode_value[0])
        else:
            df_clean = df_clean.dropna()

        # Save cleaned dataset
        cleaned_key = f"cleaned/{uuid.uuid4()}_{dataset.filename}"
        csv_buffer = io.StringIO()
        df_clean.to_csv(csv_buffer, index=False)
        storage.upload_fileobj(cleaned_key, io.BytesIO(csv_buffer.getvalue().encode()))

        # Update dataset metadata
        dataset.rows = df_clean.shape[0]
        dataset.cols = df_clean.shape[1]
        dataset.columns_json = DatasetService._analyze_column_types(df_clean)
        dataset.storage_key = cleaned_key  # Update to point to cleaned version
        db.commit()

        # Create version record
        next_version = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset_id
        ).count() + 1

        changes_summary = f"Cleaned dataset: removed {rows_before - df_clean.shape[0]} duplicate rows"
        if options and options.get("fill_na"):
            changes_summary += ", filled missing values"
        else:
            changes_summary += ", removed rows with missing values"

        version = DatasetVersion(
            dataset_id=dataset_id,
            version_number=next_version,
            storage_key=cleaned_key,
            operation="clean",
            changes_summary=changes_summary,
            rows_before=rows_before,
            cols_before=cols_before,
            rows_after=df_clean.shape[0],
            cols_after=df_clean.shape[1]
        )
        db.add(version)
        db.commit()

        return {"message": "Dataset cleaned", "dataset_id": dataset_id, "rows": dataset.rows, "cols": dataset.cols, "version": next_version}

    @staticmethod
    def get_dataset_versions(dataset_id: str, user_id: str, db: Session) -> List[dict]:
        """
        Get all versions of a dataset
        """
        # Verify dataset ownership
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        versions = db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset_id
        ).order_by(DatasetVersion.version_number.desc()).all()

        return [{
            "id": v.id,
            "version_number": v.version_number,
            "operation": v.operation,
            "changes_summary": v.changes_summary,
            "rows_before": v.rows_before,
            "cols_before": v.cols_before,
            "rows_after": v.rows_after,
            "cols_after": v.cols_after,
            "created_at": v.created_at.isoformat() if v.created_at else None
        } for v in versions]

    @staticmethod
    def rollback_dataset_version(dataset_id: str, version_id: str, user_id: str, db: Session) -> dict:
        """
        Rollback dataset to a specific version
        """
        # Verify dataset ownership
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Find the version
        version = db.query(DatasetVersion).filter(
            DatasetVersion.id == version_id,
            DatasetVersion.dataset_id == dataset_id
        ).first()
        if not version:
            raise ValueError("Version not found")

        # Update dataset to point to this version
        dataset.storage_key = version.storage_key
        dataset.rows = version.rows_after
        dataset.cols = version.cols_after
        db.commit()

        return {
            "message": f"Dataset rolled back to version {version.version_number}",
            "dataset_id": dataset_id,
            "version": version.version_number
        }

    @staticmethod
    def _has_outliers(series: pd.Series) -> bool:
        """Check if a numeric series has outliers using IQR method"""
        if series.dtype not in ['int64', 'float64']:
            return False

        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        outliers = series[(series < lower_bound) | (series > upper_bound)]
        return len(outliers) > 0

    @staticmethod
    def transform_dataset(
        dataset_id: str,
        options: dict,
        user_id: str,
        db: Session
    ):
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Load dataset
        file_obj = storage.download_stream(dataset.storage_key)
        df = DatasetService._read_dataframe_from_file(file_obj, dataset.filename)

        # Apply transformations
        if options:
            if options.get("normalize"):
                numeric_cols = df.select_dtypes(include=['number']).columns
                df[numeric_cols] = (df[numeric_cols] - df[numeric_cols].mean()) / df[numeric_cols].std()
            if options.get("encode_categorical"):
                categorical_cols = df.select_dtypes(include=['object']).columns
                for col in categorical_cols:
                    df[col] = pd.Categorical(df[col]).codes

        # Save transformed dataset
        transformed_key = f"transformed/{uuid.uuid4()}_{dataset.filename}"
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        storage.upload_fileobj(transformed_key, io.BytesIO(csv_buffer.getvalue().encode()))

        # Update dataset metadata
        dataset.rows = df.shape[0]
        dataset.cols = df.shape[1]
        dataset.columns_json = {col: str(df[col].dtype) for col in df.columns}
        db.commit()

        return {"message": "Dataset transformed", "dataset_id": dataset_id, "rows": dataset.rows, "cols": dataset.cols}

    @staticmethod
    def delete_dataset(
        dataset_id: str,
        user_id: str,
        db: Session
    ):
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Delete related records first to avoid foreign key constraint issues
        # Delete ProjectDataset links
        db.query(ProjectDataset).filter(ProjectDataset.dataset_id == dataset_id).delete()

        # Delete DatasetVersion records
        db.query(DatasetVersion).filter(DatasetVersion.dataset_id == dataset_id).delete()

        # Delete related Run records and their dependencies
        runs = db.query(Run).filter(Run.dataset_id == dataset_id).all()
        for run in runs:
            # Delete Artifacts
            db.query(Artifact).filter(Artifact.run_id == run.id).delete()
            # Delete Logs
            db.query(Log).filter(Log.run_id == run.id).delete()
            # Delete ModelMetas and their PredictionResults
            model_metas = db.query(ModelMeta).filter(ModelMeta.run_id == run.id).all()
            for model_meta in model_metas:
                db.query(PredictionResult).filter(PredictionResult.model_id == model_meta.id).delete()
            db.query(ModelMeta).filter(ModelMeta.run_id == run.id).delete()
            # Delete the Run itself
            db.delete(run)

        # Delete from storage
        storage.delete_file(dataset.storage_key)

        # Delete from database
        db.delete(dataset)
        db.commit()

        return {"message": "Dataset deleted successfully"}

    @staticmethod
    def list_datasets(
        project_id: Optional[str],
        user_id: str,
        db: Session
    ):
        if project_id:
            # Verify project belongs to user
            project = db.query(ProjectModel).filter(ProjectModel.id == project_id, ProjectModel.user_id == user_id).first()
            if not project:
                raise ValueError("Project not found")
            datasets = db.query(Dataset).join(ProjectDataset).filter(ProjectDataset.project_id == project_id).all()
        else:
            datasets = db.query(Dataset).filter(Dataset.user_id == user_id).all()
        return datasets

    @staticmethod
    def _analyze_column_types(df: pd.DataFrame) -> dict:
        """
        Analyze column types and provide smart type detection
        Returns a dictionary with column names as keys and type info as values
        """
        column_analysis = {}

        for col in df.columns:
            dtype = df[col].dtype
            unique_count = df[col].nunique()
            total_count = len(df)
            null_count = df[col].isnull().sum()

            # Basic type detection with better handling
            if dtype == 'object':
                # Check if it's actually numeric
                try:
                    numeric_conversion = pd.to_numeric(df[col], errors='coerce')
                    if numeric_conversion.notna().sum() > 0.8 * total_count:  # 80% convertible
                        inferred_type = 'numeric_string'
                    else:
                        inferred_type = 'text'
                except:
                    # Check if it's datetime
                    try:
                        datetime_conversion = pd.to_datetime(df[col], errors='coerce')
                        if datetime_conversion.notna().sum() > 0.8 * total_count:
                            inferred_type = 'datetime_string'
                        else:
                            inferred_type = 'categorical' if unique_count < total_count * 0.5 else 'text'
                    except:
                        inferred_type = 'categorical' if unique_count < total_count * 0.5 else 'text'
            elif dtype in ['int64', 'float64']:
                # Check if it's actually categorical (few unique values)
                if unique_count <= 10 and total_count > 50:
                    inferred_type = 'categorical_numeric'
                else:
                    inferred_type = 'numeric'
            elif dtype == 'bool':
                inferred_type = 'boolean'
            else:
                inferred_type = str(dtype)

            column_analysis[col] = {
                'original_dtype': str(dtype),
                'inferred_type': inferred_type,
                'unique_count': int(unique_count),
                'null_count': int(null_count),
                'null_percentage': round((null_count / total_count) * 100, 2) if total_count > 0 else 0
            }

        return column_analysis

    @staticmethod
    def analyze_types(dataset_id: str, user_id: str, db: Session) -> dict:
        """
        Analyze column types for a dataset
        """
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Load dataset
        file_obj = storage.download_stream(dataset.storage_key)
        df = DatasetService._read_dataframe_from_file(file_obj, dataset.filename)

        # Analyze types
        analysis = DatasetService._analyze_column_types(df)

        # Update dataset with analysis
        dataset.columns_json = analysis
        db.commit()

        return {
            "dataset_id": dataset_id,
            "analysis": analysis,
            "total_columns": len(analysis)
        }

    @staticmethod
    def get_dataset_summary(
        dataset_id: str,
        user_id: str,
        db: Session
    ):
        """
        Get summary statistics for a dataset
        """
        import numpy as np

        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Load dataset
        file_obj = storage.download_stream(dataset.storage_key)
        df = DatasetService._read_dataframe_from_file(file_obj, dataset.filename)

        # Generate summary statistics
        summary_stats = DatasetService._generate_summary_stats(df)

        def safe_float(value):
            """Convert to float, handling NaN values"""
            if isinstance(value, (int, float)) and not np.isnan(value):
                return float(value)
            return None

        return {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "column_types": {col: str(df[col].dtype) for col in df.columns},
            "missing_values": {col: int(df[col].isnull().sum()) for col in df.columns},
            "statistics": {
                col: {
                    "mean": safe_float(df[col].mean()) if df[col].dtype in ['int64', 'float64'] and not df[col].isnull().all() else None,
                    "std": safe_float(df[col].std()) if df[col].dtype in ['int64', 'float64'] and not df[col].isnull().all() else None,
                    "min": safe_float(df[col].min()) if df[col].dtype in ['int64', 'float64'] and not df[col].isnull().all() else None,
                    "max": safe_float(df[col].max()) if df[col].dtype in ['int64', 'float64'] and not df[col].isnull().all() else None,
                    "count": int(df[col].count())
                } for col in df.columns if df[col].dtype in ['int64', 'float64']
            }
        }
