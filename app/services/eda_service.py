from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
import pandas as pd
import json
import uuid
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
            from ydata_profiling import ProfileReport
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

    @staticmethod
    def generate_advanced_eda(
        project_id: str,
        user_id: str,
        dataset_id: str,
        target_column: Optional[str],
        db: Session
    ) -> Dict[str, Any]:
        """
        Generate advanced statistical and machine learning insights (PCA, Isolation Forest, Mutual Information).
        """
        from app.db.models import Project as ProjectModel, Dataset, EDAReport, DataLineage
        import numpy as np

        # Verify project ownership
        project = db.query(ProjectModel).filter(
            ProjectModel.id == project_id,
            ProjectModel.user_id == user_id
        ).first()
        if not project:
            raise ValueError("Project not found")

        # Get dataset
        dataset = db.query(Dataset).filter(
            Dataset.id == dataset_id,
            Dataset.user_id == user_id
        ).first()
        if not dataset:
            raise ValueError("Dataset not found")

        # Load dataframe
        file_obj = storage.download_stream(dataset.storage_key)
        df = pd.read_csv(file_obj)

        # Basic stats
        total_rows = len(df)
        total_cols = len(df.columns)
        
        # Select numeric columns for advanced ML analysis
        numeric_cols = [col for col in df.columns if pd.api.types.is_numeric_dtype(df[col]) and not pd.api.types.is_complex_dtype(df[col])]
        
        # Impute temporary df for ML models
        df_imputed = df[numeric_cols].copy()
        for col in df_imputed.columns:
            median_val = df_imputed[col].median()
            if pd.isna(median_val):
                median_val = 0.0
            df_imputed[col] = df_imputed[col].fillna(median_val)

        # 1. Isolation Forest Outlier Detection
        outliers_count_iforest = 0
        iforest_details = {}
        if len(numeric_cols) > 0 and total_rows > 5:
            try:
                from sklearn.ensemble import IsolationForest
                clf = IsolationForest(contamination=0.05, random_state=42)
                preds = clf.fit_predict(df_imputed)
                outliers_mask = preds == -1
                outliers_count_iforest = int(np.sum(outliers_mask))
                iforest_details = {
                    "method": "Isolation Forest",
                    "contamination_threshold": 0.05,
                    "outliers_detected": outliers_count_iforest,
                    "outliers_percentage": round((outliers_count_iforest / total_rows) * 100, 2)
                }
            except Exception as e:
                iforest_details = {"error": f"Isolation forest failed: {str(e)}"}

        # 2. PCA (Principal Component Analysis)
        pca_details = {}
        if len(numeric_cols) >= 2 and total_rows > 5:
            try:
                from sklearn.preprocessing import StandardScaler
                from sklearn.decomposition import PCA
                scaler = StandardScaler()
                scaled_data = scaler.fit_transform(df_imputed)
                
                n_comps = min(3, len(numeric_cols))
                pca = PCA(n_components=n_comps)
                pca.fit(scaled_data)
                
                pca_details = {
                    "explained_variance_ratio": [round(float(v), 4) for v in pca.explained_variance_ratio_],
                    "cumulative_variance": round(float(np.sum(pca.explained_variance_ratio_)), 4),
                    "components_loadings": {
                        f"PC{i+1}": {
                            col: round(float(loading), 4)
                            for col, loading in zip(numeric_cols, pca.components_[i])
                        }
                        for i in range(n_comps)
                    }
                }
            except Exception as e:
                pca_details = {"error": f"PCA failed: {str(e)}"}

        # 3. Mutual Information (Feature Importance)
        mutual_info_scores = {}
        if target_column and target_column in df.columns:
            try:
                # Prepare target and features
                y = df[target_column].copy()
                X_cols = [c for c in numeric_cols if c != target_column]
                
                if len(X_cols) > 0:
                    # Impute target
                    if pd.api.types.is_numeric_dtype(y):
                        y_imputed = y.fillna(y.median() if not pd.isna(y.median()) else 0.0)
                        is_classification = y_imputed.nunique() < 10
                    else:
                        y_imputed = y.fillna(y.mode()[0] if not y.mode().empty else "Unknown")
                        is_classification = True
                    
                    X = df_imputed[X_cols]
                    
                    if is_classification:
                        from sklearn.feature_selection import mutual_info_classif
                        scores = mutual_info_classif(X, y_imputed, random_state=42)
                    else:
                        from sklearn.feature_selection import mutual_info_regression
                        scores = mutual_info_regression(X, y_imputed, random_state=42)
                        
                    mutual_info_scores = {
                        col: round(float(score), 4)
                        for col, score in zip(X_cols, scores)
                    }
                    # Sort scores descending
                    mutual_info_scores = dict(sorted(mutual_info_scores.items(), key=lambda item: item[1], reverse=True))
            except Exception as e:
                mutual_info_scores = {"error": f"Mutual information calculation failed: {str(e)}"}

        # 4. Correlation Matrices (Pearson & Spearman)
        pearson_corr = {}
        spearman_corr = {}
        if len(numeric_cols) > 1:
            try:
                p_corr = df[numeric_cols].corr(method='pearson')
                s_corr = df[numeric_cols].corr(method='spearman')
                
                # Format matrices as serializable dicts
                for col in numeric_cols:
                    pearson_corr[col] = {k: round(float(v), 4) if not pd.isna(v) else None for k, v in p_corr[col].items()}
                    spearman_corr[col] = {k: round(float(v), 4) if not pd.isna(v) else None for k, v in s_corr[col].items()}
            except Exception as e:
                pearson_corr = {"error": f"Pearson corr failed: {str(e)}"}

        # Calculate data quality score
        missing_data_pct = round((df.isnull().sum().sum() / (total_rows * total_cols)) * 100, 2)
        duplicate_rows = int(df.duplicated().sum())
        data_quality_score = 100.0 - missing_data_pct
        if duplicate_rows > 0:
            data_quality_score -= min(10.0, (duplicate_rows / total_rows) * 100)
        data_quality_score = max(0.0, min(100.0, data_quality_score))

        # Structure results
        advanced_report = {
            "summary_metrics": {
                "total_rows": total_rows,
                "total_columns": total_cols,
                "missing_data_percentage": missing_data_pct,
                "duplicate_rows": duplicate_rows,
                "data_quality_score": data_quality_score
            },
            "outliers_analysis": iforest_details,
            "dimensionality_reduction": pca_details,
            "feature_importance": mutual_info_scores,
            "correlations": {
                "pearson": pearson_corr,
                "spearman": spearman_corr
            }
        }

        # Save to storage
        storage_key = f"eda/advanced_{project_id}_{uuid.uuid4()}.json"
        import io
        storage.upload_fileobj(storage_key, io.BytesIO(json.dumps(advanced_report).encode('utf-8')))

        # Store in database
        eda_report_db = EDAReport(
            project_id=project_id,
            dataset_id=dataset_id,
            summary_metrics=advanced_report["summary_metrics"],
            data_quality_score=data_quality_score,
            outliers_json=iforest_details,
            correlations_json=advanced_report["correlations"],
            storage_key=storage_key
        )
        db.add(eda_report_db)

        # Add Data Lineage
        lineage = DataLineage(
            dataset_id=dataset_id,
            operation_type="advanced_eda",
            input_storage_key=dataset.storage_key,
            output_storage_key=storage_key,
            parameters_json={"target_column": target_column},
            executed_by=user_id
        )
        db.add(lineage)
        db.commit()

        return {
            "status": "success",
            "report_id": eda_report_db.id,
            "data_quality_score": data_quality_score,
            "storage_key": storage_key,
            "report": advanced_report
        }

