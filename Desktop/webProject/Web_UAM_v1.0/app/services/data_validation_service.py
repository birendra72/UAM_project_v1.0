from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
from typing import Dict, List, Any
from app.db.models import Dataset
from app.storage import storage

class DataValidationService:
    @staticmethod
    def validate_dataset(dataset_id: str, user_id: str, db: Session) -> Dict[str, Any]:
        """
        Perform comprehensive data validation on a dataset
        Returns validation results with issues found
        """
        # Get dataset
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Load dataset
        file_obj = storage.download_stream(dataset.storage_key)
        df = pd.read_csv(file_obj)

        validation_results = {
            "dataset_id": dataset_id,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "issues": [],
            "summary": {
                "missing_values": 0,
                "duplicate_rows": 0,
                "data_type_issues": 0,
                "outlier_count": 0
            },
            "severity": "good"  # good, warning, critical
        }

        # Check for missing values
        missing_info = DataValidationService._check_missing_values(df)
        if missing_info["total_missing"] > 0:
            validation_results["issues"].append(missing_info)
            validation_results["summary"]["missing_values"] = missing_info["total_missing"]

        # Check for duplicate rows
        duplicate_info = DataValidationService._check_duplicates(df)
        if duplicate_info["duplicate_count"] > 0:
            validation_results["issues"].append(duplicate_info)
            validation_results["summary"]["duplicate_rows"] = duplicate_info["duplicate_count"]

        # Check data types and potential issues
        dtype_info = DataValidationService._check_data_types(df)
        if dtype_info["issues"]:
            validation_results["issues"].extend(dtype_info["issues"])
            validation_results["summary"]["data_type_issues"] = len(dtype_info["issues"])

        # Check for outliers (basic statistical analysis)
        outlier_info = DataValidationService._check_outliers(df)
        if outlier_info["outlier_count"] > 0:
            validation_results["issues"].append(outlier_info)
            validation_results["summary"]["outlier_count"] = outlier_info["outlier_count"]

        # Determine overall severity
        validation_results["severity"] = DataValidationService._calculate_severity(validation_results)

        # Update dataset validation status
        from datetime import datetime
        dataset.validation_status = "valid" if validation_results["severity"] == "good" else "issues_found"
        dataset.last_validated = datetime.utcnow()
        db.commit()

        return validation_results

    @staticmethod
    def _check_missing_values(df: pd.DataFrame) -> Dict[str, Any]:
        """Check for missing values in the dataset"""
        missing_by_column = df.isnull().sum()
        total_missing = missing_by_column.sum()

        missing_details = []
        for col, count in missing_by_column.items():
            if count > 0:
                percentage = (count / len(df)) * 100
                missing_details.append({
                    "column": col,
                    "missing_count": int(count),
                    "missing_percentage": round(percentage, 2)
                })

        return {
            "type": "missing_values",
            "severity": "warning" if total_missing > 0 else "good",
            "total_missing": int(total_missing),
            "details": missing_details
        }

    @staticmethod
    def _check_duplicates(df: pd.DataFrame) -> Dict[str, Any]:
        """Check for duplicate rows"""
        duplicate_count = df.duplicated().sum()

        return {
            "type": "duplicate_rows",
            "severity": "warning" if duplicate_count > 0 else "good",
            "duplicate_count": int(duplicate_count),
            "duplicate_percentage": round((duplicate_count / len(df)) * 100, 2) if len(df) > 0 else 0
        }

    @staticmethod
    def _check_data_types(df: pd.DataFrame) -> Dict[str, Any]:
        """Check for potential data type issues"""
        issues = []

        for col in df.columns:
            dtype = df[col].dtype
            unique_count = df[col].nunique()

            # Check for numeric columns that might be strings
            if dtype == 'object':
                # Try to convert to numeric
                try:
                    pd.to_numeric(df[col], errors='coerce')
                    issues.append({
                        "type": "potential_numeric",
                        "column": col,
                        "message": f"Column '{col}' appears to contain numeric data but is stored as text"
                    })
                except:
                    pass

            # Check for low cardinality in numeric columns (might be categorical)
            elif dtype in ['int64', 'float64']:
                if unique_count < 10 and len(df) > 50:
                    issues.append({
                        "type": "potential_categorical",
                        "column": col,
                        "message": f"Column '{col}' has only {unique_count} unique values, might be categorical"
                    })

        return {
            "issues": issues
        }

    @staticmethod
    def _check_outliers(df: pd.DataFrame) -> Dict[str, Any]:
        """Basic outlier detection using IQR method"""
        outlier_count = 0
        outlier_details = []

        numeric_cols = df.select_dtypes(include=[np.number]).columns

        for col in numeric_cols:
            if df[col].isnull().sum() < len(df) * 0.5:  # Skip if more than 50% missing
                Q1 = df[col].quantile(0.25)
                Q3 = df[col].quantile(0.75)
                IQR = Q3 - Q1

                lower_bound = Q1 - 1.5 * IQR
                upper_bound = Q3 + 1.5 * IQR

                outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
                if len(outliers) > 0:
                    outlier_count += len(outliers)
                    outlier_details.append({
                        "column": col,
                        "outlier_count": len(outliers),
                        "bounds": {"lower": lower_bound, "upper": upper_bound}
                    })

        return {
            "type": "outliers",
            "severity": "info" if outlier_count > 0 else "good",
            "outlier_count": outlier_count,
            "details": outlier_details
        }

    @staticmethod
    def _calculate_severity(validation_results: Dict[str, Any]) -> str:
        """Calculate overall severity based on issues found"""
        issues = validation_results["issues"]
        summary = validation_results["summary"]

        # Critical if more than 20% missing data or severe type issues
        if (summary["missing_values"] / validation_results["total_rows"] > 0.2 or
            summary["data_type_issues"] > validation_results["total_columns"] * 0.5):
            return "critical"

        # Warning if any missing data or duplicates
        if (summary["missing_values"] > 0 or summary["duplicate_rows"] > 0 or
            summary["data_type_issues"] > 0):
            return "warning"

        return "good"
