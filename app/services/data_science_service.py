from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
import io
import uuid
from typing import Dict, List, Any
from app.db.models import Dataset, DatasetVersion
from app.storage import storage
from app.services.dataset_service import DatasetService
from scipy.stats import ks_2samp, wasserstein_distance

class DataScienceService:
    @staticmethod
    def get_quality_score(dataset_id: str, user_id: str, db: Session) -> Dict[str, Any]:
        """
        Calculates a detailed data quality score (0-100) and actionable cleaning recommendations
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
        df = DatasetService._read_dataframe_from_file(file_obj, dataset.filename)

        total_rows = int(len(df))
        total_cols = int(len(df.columns))
        if total_rows == 0 or total_cols == 0:
            return {
                "score": 0.0,
                "breakdown": {"completeness": 0.0, "uniqueness": 0.0, "redundancy": 0.0, "outliers": 0.0, "skewness": 0.0},
                "rules_checked": [],
                "recommendations": ["Dataset is empty. Please upload a valid dataset."]
            }

        # 1. Completeness Score (Missing values)
        total_cells = int(total_rows * total_cols)
        total_missing = int(df.isnull().sum().sum())
        missing_ratio = float(total_missing / total_cells)
        completeness_score = float(max(0.0, 100.0 - (missing_ratio * 200.0))) # deduct more heavily

        # 2. Uniqueness Score (Duplicate rows)
        duplicate_rows = int(df.duplicated().sum())
        duplicate_ratio = float(duplicate_rows / total_rows)
        uniqueness_score = float(max(0.0, 100.0 - (duplicate_ratio * 150.0)))

        # 3. Redundancy (Multicollinearity)
        redundancy_score = 100.0
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        high_corr_pairs = []
        if len(numeric_cols) > 1:
            corr_matrix = df[numeric_cols].corr().abs()
            # Find pairs with correlation > 0.85
            upper_tri = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
            redundant_cols = [column for column in upper_tri.columns if any(upper_tri[column] > 0.85)]
            redundancy_score = float(max(0.0, 100.0 - (len(redundant_cols) / len(numeric_cols) * 100.0)))
            
            # Find correlation details
            for col in upper_tri.columns:
                for row in upper_tri.index:
                    val = upper_tri.loc[row, col]
                    if val > 0.85 and not np.isnan(val):
                        high_corr_pairs.append((row, col, float(val)))

        # 4. Outliers Score
        outlier_count = 0
        total_numeric_cells = int(total_rows * len(numeric_cols))
        if len(numeric_cols) > 0:
            for col in numeric_cols:
                col_data = df[col].dropna()
                if len(col_data) > 0:
                    q1 = col_data.quantile(0.25)
                    q3 = col_data.quantile(0.75)
                    iqr = q3 - q1
                    lower = q1 - 1.5 * iqr
                    upper = q3 + 1.5 * iqr
                    outliers = col_data[(col_data < lower) | (col_data > upper)]
                    outlier_count += len(outliers)
            outlier_ratio = float(outlier_count / total_numeric_cells if total_numeric_cells > 0 else 0)
            outliers_score = float(max(0.0, 100.0 - (outlier_ratio * 500.0)))
        else:
            outliers_score = 100.0

        # 5. Skewness Score
        skew_score = 100.0
        highly_skewed_cols = []
        if len(numeric_cols) > 0:
            skewness = df[numeric_cols].skew()
            highly_skewed = skewness[skewness.abs() > 1.5]
            highly_skewed_cols = list(highly_skewed.index)
            skew_score = float(max(0.0, 100.0 - (len(highly_skewed_cols) / len(numeric_cols) * 100.0)))

        # Overall Score
        overall_score = float(round(
            (completeness_score * 0.30) +
            (uniqueness_score * 0.20) +
            (redundancy_score * 0.15) +
            (outliers_score * 0.20) +
            (skew_score * 0.15),
            1
        ))

        # Build rules checklist with clean native python bools
        rules = [
            {
                "rule": "High Completeness (Missing values < 5%)",
                "passed": bool(missing_ratio < 0.05),
                "details": f"{round(missing_ratio * 100, 2)}% missing cells total"
            },
            {
                "rule": "Low Duplication (Duplicates < 2%)",
                "passed": bool(duplicate_ratio < 0.02),
                "details": f"{duplicate_rows} duplicate rows found"
            },
            {
                "rule": "No Redundant Features (Correlation < 0.85)",
                "passed": bool(len(high_corr_pairs) == 0),
                "details": f"{len(high_corr_pairs)} highly correlated column pairs found"
            },
            {
                "rule": "Low Outlier Presence (Outliers < 3%)",
                "passed": bool((outlier_count / total_numeric_cells if total_numeric_cells > 0 else 0) < 0.03),
                "details": f"{outlier_count} outliers detected in numeric columns"
            },
            {
                "rule": "Low Skewness (Highly skewed features < 20%)",
                "passed": bool((len(highly_skewed_cols) / len(numeric_cols) if len(numeric_cols) > 0 else 0) < 0.2),
                "details": f"{len(highly_skewed_cols)} features with absolute skewness > 1.5"
            }
        ]

        # Generate Actionable Recommendations
        recommendations = []
        if missing_ratio > 0:
            recommendations.append("Use 'Auto Clean' to fill or drop missing values.")
        if duplicate_ratio > 0:
            recommendations.append(f"Remove {duplicate_rows} duplicate rows to ensure uniqueness.")
        for col1, col2, val in high_corr_pairs[:3]:
            recommendations.append(f"Drop '{col2}' because it is highly redundant with '{col1}' (correlation: {round(val, 2)}).")
        if outlier_count > 0:
            recommendations.append(f"Treat outliers in numeric features to prevent ML model distortion.")
        for col in highly_skewed_cols[:3]:
            recommendations.append(f"Log transform highly skewed numeric column '{col}' to make its distribution normal.")

        if not recommendations:
            recommendations.append("Your dataset is in excellent shape! Ready for model training.")

        return {
            "dataset_id": dataset_id,
            "filename": dataset.filename,
            "score": overall_score,
            "breakdown": {
                "completeness": round(completeness_score, 1),
                "uniqueness": round(uniqueness_score, 1),
                "redundancy": round(redundancy_score, 1),
                "outliers": round(outliers_score, 1),
                "skewness": round(skew_score, 1)
            },
            "rules_checked": rules,
            "recommendations": recommendations
        }

    @staticmethod
    def get_feature_suggestions(dataset_id: str, user_id: str, db: Session) -> List[Dict[str, Any]]:
        """
        Analyzes the columns and recommends optimal feature transformations
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
        df = DatasetService._read_dataframe_from_file(file_obj, dataset.filename)

        suggestions = []
        for col in df.columns:
            dtype = df[col].dtype
            unique_count = int(df[col].nunique())
            total_count = int(len(df))

            # 1. Date columns
            is_date = False
            if dtype == 'object':
                try:
                    parsed = pd.to_datetime(df[col], errors='coerce')
                    if parsed.notna().sum() > 0.8 * total_count:
                        is_date = True
                except:
                    pass

            if is_date:
                suggestions.append({
                    "column": col,
                    "inferred_type": "datetime",
                    "transformation": "datetime_extract",
                    "reason": f"Column '{col}' is detected as date. Extracting Year, Month, Day, and Day of Week will improve ML feature representation.",
                    "applied_by_default": True
                })
                continue

            # 2. Skewed numeric columns
            if dtype in ['int64', 'float64']:
                col_data = df[col].dropna()
                if len(col_data) > 0 and float(col_data.min()) >= 0:
                    skew = float(col_data.skew())
                    if abs(skew) > 1.5:
                        suggestions.append({
                            "column": col,
                            "inferred_type": "skewed_numeric",
                            "transformation": "log_transform",
                            "reason": f"Column '{col}' is highly skewed (skew: {round(skew, 2)}). Applying a log transform (np.log1p) will normalize its distribution.",
                            "applied_by_default": True
                        })
                        continue

            # 3. Categorical encoding
            if dtype == 'object':
                if unique_count <= 10:
                    suggestions.append({
                        "column": col,
                        "inferred_type": "low_cardinality_categorical",
                        "transformation": "one_hot_encode",
                        "reason": f"Column '{col}' has only {unique_count} unique values. One-hot encoding creates binary flags that ML models understand.",
                        "applied_by_default": True
                    })
                elif unique_count < total_count * 0.5:
                    suggestions.append({
                        "column": col,
                        "inferred_type": "high_cardinality_categorical",
                        "transformation": "label_encode",
                        "reason": f"Column '{col}' has {unique_count} unique values (high cardinality). Label encoding mapping categories to integers is recommended.",
                        "applied_by_default": False
                    })
                continue

            # 4. Standard Scaling for numerical fields with high variance
            if dtype in ['int64', 'float64']:
                col_data = df[col].dropna()
                if len(col_data) > 0:
                    std = float(col_data.std())
                    if std > 10.0:
                        suggestions.append({
                            "column": col,
                            "inferred_type": "high_variance_numeric",
                            "transformation": "standard_scale",
                            "reason": f"Column '{col}' has high variance (std: {round(std, 2)}). Standardizing (mean=0, std=1) helps model convergence.",
                            "applied_by_default": False
                        })

        return suggestions

    @staticmethod
    def apply_feature_transformations(
        dataset_id: str,
        transformations: List[Dict[str, Any]],
        user_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Applies chosen feature transformations and creates a new dataset version
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
        df = DatasetService._read_dataframe_from_file(file_obj, dataset.filename)

        rows_before = int(df.shape[0])
        cols_before = int(df.shape[1])

        applied = []
        for trans in transformations:
            col = trans.get("column")
            op_type = trans.get("transformation")
            if col not in df.columns:
                continue

            if op_type == "log_transform":
                # Ensure all values are >= 0
                if (df[col].dropna() >= 0).all():
                    df[f"{col}_log"] = np.log1p(df[col])
                    applied.append(f"Log transformed '{col}'")
            elif op_type == "datetime_extract":
                parsed = pd.to_datetime(df[col], errors='coerce')
                df[f"{col}_year"] = parsed.dt.year
                df[f"{col}_month"] = parsed.dt.month
                df[f"{col}_day"] = parsed.dt.day
                df[f"{col}_dayofweek"] = parsed.dt.dayofweek
                # Drop original date column
                df = df.drop(columns=[col])
                applied.append(f"Extracted date fields from '{col}'")
            elif op_type == "one_hot_encode":
                df = pd.get_dummies(df, columns=[col], prefix=col, drop_first=True)
                applied.append(f"One-hot encoded '{col}'")
            elif op_type == "label_encode":
                df[f"{col}_encoded"] = pd.Categorical(df[col]).codes
                df = df.drop(columns=[col])
                applied.append(f"Label encoded '{col}'")
            elif op_type == "standard_scale":
                mean_val = df[col].mean()
                std_val = df[col].std()
                if std_val > 0:
                    df[f"{col}_scaled"] = (df[col] - mean_val) / std_val
                    applied.append(f"Scaled '{col}'")

        # Save new dataframe to storage
        new_key = f"features/{uuid.uuid4()}_{dataset.filename}"
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        storage.upload_fileobj(new_key, io.BytesIO(csv_buffer.getvalue().encode()))

        # Create new version record
        next_version = int(db.query(DatasetVersion).filter(
            DatasetVersion.dataset_id == dataset_id
        ).count() + 1)

        changes_summary = "Applied feature engineering: " + ", ".join(applied)

        version = DatasetVersion(
            dataset_id=dataset_id,
            version_number=next_version,
            storage_key=new_key,
            operation="feature_engineering",
            changes_summary=changes_summary,
            rows_before=rows_before,
            cols_before=cols_before,
            rows_after=int(df.shape[0]),
            cols_after=int(df.shape[1])
        )
        db.add(version)

        # Update dataset pointer to point to new key
        dataset.storage_key = new_key
        dataset.rows = int(df.shape[0])
        dataset.cols = int(df.shape[1])
        dataset.columns_json = DatasetService._analyze_column_types(df)
        db.commit()

        return {
            "message": "Feature engineering applied successfully",
            "applied_operations": applied,
            "version": next_version,
            "rows": int(df.shape[0]),
            "cols": int(df.shape[1])
        }

    @staticmethod
    def detect_data_drift(
        baseline_id: str,
        target_id: str,
        user_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Detects data distribution drift between baseline dataset and target dataset
        using Kolmogorov-Smirnov test (numeric) and PSI (categorical).
        """
        # Load baseline dataset
        baseline = db.query(Dataset).filter(Dataset.id == baseline_id, Dataset.user_id == user_id).first()
        if not baseline:
            raise ValueError("Baseline dataset not found")
        file_obj1 = storage.download_stream(baseline.storage_key)
        df_base = DatasetService._read_dataframe_from_file(file_obj1, baseline.filename)

        # Load target dataset
        target = db.query(Dataset).filter(Dataset.id == target_id, Dataset.user_id == user_id).first()
        if not target:
            raise ValueError("Target dataset not found")
        file_obj2 = storage.download_stream(target.storage_key)
        df_target = DatasetService._read_dataframe_from_file(file_obj2, target.filename)

        common_cols = list(set(df_base.columns) & set(df_target.columns))
        if not common_cols:
            return {
                "drift_detected": False,
                "drift_score": 0.0,
                "message": "No common columns found between the datasets.",
                "metrics": {}
            }

        drift_metrics = {}
        drift_count = 0

        for col in common_cols:
            dtype = df_base[col].dtype
            if dtype in ['int64', 'float64'] and df_target[col].dtype in ['int64', 'float64']:
                # Kolmogorov-Smirnov Test
                base_data = df_base[col].dropna()
                target_data = df_target[col].dropna()

                if len(base_data) > 5 and len(target_data) > 5:
                    ks_stat, p_val = ks_2samp(base_data, target_data)
                    w_dist = wasserstein_distance(base_data, target_data)
                    
                    # If p-value < 0.05, we reject the null hypothesis that distributions are same
                    drifted = bool(p_val < 0.05)
                    if drifted:
                        drift_count += 1

                    drift_metrics[col] = {
                        "type": "numeric",
                        "drifted": bool(drifted),
                        "p_value": float(p_val),
                        "ks_statistic": float(ks_stat),
                        "wasserstein_distance": float(w_dist),
                        "baseline_mean": float(base_data.mean()),
                        "target_mean": float(target_data.mean()),
                        "method": "Kolmogorov-Smirnov"
                    }
            elif dtype == 'object' and df_target[col].dtype == 'object':
                # Categorical Feature: calculate simple Population Stability Index (PSI)
                base_counts = df_base[col].value_counts(normalize=True).to_dict()
                target_counts = df_target[col].value_counts(normalize=True).to_dict()
                
                all_cats = list(set(base_counts.keys()) | set(target_counts.keys()))
                psi_value = 0.0
                for cat in all_cats:
                    actual = target_counts.get(cat, 0.0001)
                    expected = base_counts.get(cat, 0.0001)
                    actual = 0.0001 if actual == 0 else actual
                    expected = 0.0001 if expected == 0 else expected
                    psi_value += (actual - expected) * np.log(actual / expected)
                
                # Standard PSI thresholds: > 0.25 is significant shift, > 0.1 is moderate shift
                drifted = bool(psi_value > 0.25)
                if drifted:
                    drift_count += 1
                
                drift_metrics[col] = {
                    "type": "categorical",
                    "drifted": bool(drifted),
                    "psi": float(psi_value),
                    "method": "Population Stability Index (PSI)"
                }

        drift_score = (drift_count / len(drift_metrics)) * 100 if len(drift_metrics) > 0 else 0.0
        drift_detected = bool(drift_score > 30.0)  # Drifted if more than 30% of features drifted

        return {
            "drift_detected": bool(drift_detected),
            "drift_score": float(round(drift_score, 1)),
            "total_features_checked": int(len(drift_metrics)),
            "drifted_features_count": int(drift_count),
            "metrics": drift_metrics
        }
