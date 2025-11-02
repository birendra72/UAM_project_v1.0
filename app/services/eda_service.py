from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import pandas as pd
import json
import uuid
from ydata_profiling import ProfileReport
from app.db.models import Project as ProjectModel, Dataset, ProjectDataset
from app.storage import storage

class EDAService:
    @staticmethod
    def generate_eda_report(
        project_id: str,
        user_id: str,
        db: Session,
        dataset_ids: Optional[list] = None
    ) -> Dict[str, Any]:
        """
        Generate comprehensive EDA report for a project using ydata-profiling
        """
        # Verify project ownership
        project = db.query(ProjectModel).filter(
            ProjectModel.id == project_id,
            ProjectModel.user_id == user_id
        ).first()
        if not project:
            raise ValueError("Project not found")

        # Get datasets for the project
        if dataset_ids:
            # Filter by provided dataset IDs
            datasets = db.query(Dataset).join(ProjectDataset).filter(
                ProjectDataset.project_id == project_id,
                Dataset.id.in_(dataset_ids),
                Dataset.user_id == user_id
            ).all()
        else:
            # Get all datasets in the project
            datasets = db.query(Dataset).join(ProjectDataset).filter(
                ProjectDataset.project_id == project_id,
                Dataset.user_id == user_id
            ).all()

        if not datasets:
            raise ValueError("No datasets found for this project")

        # Combine all datasets for analysis
        combined_df = EDAService._combine_datasets(datasets)

        # Generate ydata-profiling report with error handling
        profile_report_data = None
        try:
            profile = ProfileReport(
                combined_df,
                title=f"EDA Report - {project.name}",
                explorative=True,
                minimal=True  # Use minimal mode to avoid complex computations
            )
            profile_json = profile.to_json()
            profile_report_data = json.loads(profile_json)
        except Exception as e:
            print(f"Warning: ydata-profiling failed: {e}. Using fallback analysis.")
            # Fallback: generate basic profile manually
            profile_report_data = EDAService._generate_basic_profile(combined_df)

        # Generate additional insights
        insights = EDAService._generate_insights(combined_df)

        # Store results
        eda_results = {
            "project_id": project_id,
            "profile_report": profile_report_data,
            "insights": insights,
            "datasets_used": [d.id for d in datasets],
            "total_rows": len(combined_df),
            "total_columns": len(combined_df.columns)
        }

        # Save to storage
        storage_key = f"eda/{project_id}_{uuid.uuid4()}.json"
        import io
        storage.upload_fileobj(storage_key, io.BytesIO(json.dumps(eda_results).encode('utf-8')))

        # TODO: Store in database table (will be added in Phase 4)

        return {
            "project_id": project_id,
            "storage_key": storage_key,
            "insights": insights,
            "total_datasets": len(datasets),
            "total_rows": len(combined_df),
            "total_columns": len(combined_df.columns)
        }

    @staticmethod
    def get_eda_results(
        project_id: str,
        user_id: str,
        db: Session
    ) -> Dict[str, Any]:
        """
        Retrieve EDA results for a project
        """
        # Verify project ownership
        project = db.query(ProjectModel).filter(
            ProjectModel.id == project_id,
            ProjectModel.user_id == user_id
        ).first()
        if not project:
            raise ValueError("Project not found")

        # Get datasets for the project
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            Dataset.user_id == user_id
        ).all()

        if not datasets:
            raise ValueError("No datasets found for this project")

        # Combine all datasets for analysis
        combined_df = EDAService._combine_datasets(datasets)

        # Generate insights (this is the actual analysis)
        insights = EDAService._generate_insights(combined_df)

        # Generate outliers data
        outliers_data = EDAService._generate_outliers_data(combined_df)

        # Return results in the expected format
        return {
            "run_id": f"eda_{project_id}",
            "status": "completed",
            "created_at": "2024-01-01T00:00:00Z",
            "results": {
                "summary": insights["data_quality"],
                "correlations": insights["correlations"],
                "insights": insights["recommendations"],
                "distributions": insights["distributions"],
                "outliers": outliers_data
            }
        }

    @staticmethod
    def _combine_datasets(datasets: list) -> pd.DataFrame:
        """
        Combine multiple datasets into a single DataFrame for analysis
        """
        dfs = []
        for dataset in datasets:
            try:
                file_obj = storage.download_stream(dataset.storage_key)
                df = pd.read_csv(file_obj)
                # Add dataset identifier column
                df['_dataset_id'] = dataset.id
                df['_dataset_name'] = dataset.filename
                dfs.append(df)
            except Exception as e:
                print(f"Error loading dataset {dataset.id}: {e}")
                continue

        if not dfs:
            raise ValueError("No datasets could be loaded")

        # Combine all DataFrames
        combined_df = pd.concat(dfs, ignore_index=True, sort=False)
        return combined_df

    @staticmethod
    def _generate_insights(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Generate automated insights from the dataset
        """
        insights = {
            "data_quality": {},
            "correlations": {},
            "distributions": {},
            "recommendations": []
        }

        # Data quality insights
        total_rows = len(df)
        total_cols = len(df.columns)

        insights["data_quality"] = {
            "total_rows": total_rows,
            "total_columns": total_cols,
            "missing_data_percentage": round((df.isnull().sum().sum() / (total_rows * total_cols)) * 100, 2),
            "duplicate_rows": int(df.duplicated().sum()),
            "columns_with_missing": int((df.isnull().sum() > 0).sum())
        }

        # Correlation analysis for numeric columns (excluding complex types)
        numeric_cols = [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col]) and not pd.api.types.is_complex_dtype(df[col])]
        if len(numeric_cols) > 1:
            try:
                corr_matrix = df[numeric_cols].corr()
                # Get top correlations
                top_correlations = []
                for i in range(len(numeric_cols)):
                    for j in range(i+1, len(numeric_cols)):
                        corr_value = corr_matrix.iloc[i, j]
                        # Handle different types of correlation values
                        if pd.isna(corr_value):
                            continue
                        try:
                            # Convert to numeric, handling complex numbers
                            numeric_corr = pd.to_numeric(corr_value, errors='coerce')
                            if pd.isna(numeric_corr):
                                continue
                            if isinstance(numeric_corr, complex):
                                corr_value = float(numeric_corr.real)
                            else:
                                corr_value = float(numeric_corr)
                        except (TypeError, ValueError, AttributeError):
                            continue
                        if abs(corr_value) > 0.5:  # Only significant correlations
                            top_correlations.append({
                                "col1": numeric_cols[i],
                                "col2": numeric_cols[j],
                                "correlation": round(corr_value, 3)
                            })

                top_correlations.sort(key=lambda x: abs(x["correlation"]), reverse=True)
                insights["correlations"]["top_correlations"] = top_correlations[:10]  # Top 10
            except Exception as e:
                print(f"Warning: Correlation analysis failed: {e}")
                insights["correlations"]["error"] = "Correlation analysis failed"

        # Distribution insights
        insights["distributions"] = {}
        for col in numeric_cols[:5]:  # Analyze first 5 numeric columns
            try:
                col_data = pd.to_numeric(df[col], errors='coerce').dropna()
                if len(col_data) > 0:
                    # Safely convert statistics to float
                    def safe_float(value):
                        if pd.isna(value):
                            return 0.0
                        try:
                            # Convert to numeric first, then handle special cases
                            numeric_value = pd.to_numeric(value, errors='coerce')
                            if pd.isna(numeric_value):
                                return 0.0
                            # Handle complex numbers
                            if isinstance(numeric_value, complex):
                                return float(numeric_value.real)
                            return float(numeric_value)
                        except (TypeError, ValueError, AttributeError, OverflowError):
                            return 0.0

                    insights["distributions"][col] = {
                        "mean": round(safe_float(col_data.mean()), 2),
                        "median": round(safe_float(col_data.median()), 2),
                        "std": round(safe_float(col_data.std()), 2),
                        "skewness": round(safe_float(col_data.skew()), 2),
                        "kurtosis": round(safe_float(col_data.kurtosis()), 2),
                        "outliers_count": EDAService._detect_outliers(col_data)
                    }
            except Exception as e:
                print(f"Warning: Failed to analyze distribution for column {col}: {e}")
                continue

        # Generate recommendations
        recommendations = []

        # Missing data recommendations
        missing_pct = insights["data_quality"]["missing_data_percentage"]
        if missing_pct > 20:
            recommendations.append({
                "type": "warning",
                "message": f"High missing data ({missing_pct}%). Consider imputation or removal."
            })
        elif missing_pct > 5:
            recommendations.append({
                "type": "info",
                "message": f"Moderate missing data ({missing_pct}%). Review imputation strategies."
            })

        # Duplicate data
        dup_count = insights["data_quality"]["duplicate_rows"]
        if dup_count > 0:
            recommendations.append({
                "type": "warning",
                "message": f"Found {dup_count} duplicate rows. Consider removing duplicates."
            })

        # Correlation recommendations
        if "top_correlations" in insights["correlations"]:
            high_corr = [c for c in insights["correlations"]["top_correlations"] if abs(c["correlation"]) > 0.8]
            if high_corr:
                recommendations.append({
                    "type": "info",
                    "message": f"Found {len(high_corr)} highly correlated variable pairs. Consider feature selection."
                })

        # Column type recommendations
        categorical_cols = df.select_dtypes(include=['object']).columns
        if len(categorical_cols) > 0:
            recommendations.append({
                "type": "info",
                "message": f"Found {len(categorical_cols)} categorical columns. Consider encoding for ML models."
            })

        insights["recommendations"] = recommendations

        return insights

    @staticmethod
    def _detect_outliers(series: pd.Series) -> int:
        """
        Detect outliers using IQR method
        """
        Q1 = series.quantile(0.25)
        Q3 = series.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        outliers = series[(series < lower_bound) | (series > upper_bound)]
        return len(outliers)

    @staticmethod
    def _generate_outliers_data(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Generate detailed outliers data for each numeric column
        """
        outliers_data = {}
        numeric_cols = [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col]) and not pd.api.types.is_complex_dtype(df[col])]

        for col in numeric_cols[:5]:  # Analyze first 5 numeric columns
            try:
                col_data = pd.to_numeric(df[col], errors='coerce').dropna()
                if len(col_data) > 0:
                    # Detect outliers using IQR method
                    Q1 = col_data.quantile(0.25)
                    Q3 = col_data.quantile(0.75)
                    IQR = Q3 - Q1
                    lower_bound = Q1 - 1.5 * IQR
                    upper_bound = Q3 + 1.5 * IQR

                    # Get outlier values and their indices
                    outlier_mask = (col_data < lower_bound) | (col_data > upper_bound)
                    outlier_values = col_data[outlier_mask].tolist()
                    outlier_indices = col_data[outlier_mask].index.tolist()

                    outliers_data[col] = {
                        "count": len(outlier_values),
                        "lower_bound": round(float(lower_bound), 2),
                        "upper_bound": round(float(upper_bound), 2),
                        "outlier_values": [round(float(v), 2) for v in outlier_values[:10]],  # Limit to first 10 outliers
                        "outlier_indices": outlier_indices[:10],  # Corresponding indices
                        "percentage": round((len(outlier_values) / len(col_data)) * 100, 2)
                    }
            except Exception as e:
                print(f"Warning: Failed to analyze outliers for column {col}: {e}")
                continue

        return outliers_data

    @staticmethod
    def _generate_basic_profile(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Generate a basic profile report when ydata-profiling fails
        """
        profile = {
            "summary": {
                "table": {
                    "n": len(df),
                    "nvar": len(df.columns),
                    "total_missing": df.isnull().sum().sum(),
                    "percentage_missing": round((df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100, 2)
                }
            },
            "variables": {}
        }

        for col in df.columns:
            dtype = str(df[col].dtype)
            missing_count = df[col].isnull().sum()
            unique_count = df[col].nunique()

            var_info = {
                "type": dtype,
                "n_missing": missing_count,
                "n_unique": unique_count,
                "p_missing": round((missing_count / len(df)) * 100, 2)
            }

            # Add type-specific info
            if pd.api.types.is_numeric_dtype(df[col]):
                non_null = df[col].dropna()
                if len(non_null) > 0:
                    var_info.update({
                        "mean": float(non_null.mean()),
                        "std": float(non_null.std()),
                        "min": float(non_null.min()),
                        "max": float(non_null.max()),
                        "25%": float(non_null.quantile(0.25)),
                        "50%": float(non_null.quantile(0.5)),
                        "75%": float(non_null.quantile(0.75))
                    })

            profile["variables"][col] = var_info

        return profile
