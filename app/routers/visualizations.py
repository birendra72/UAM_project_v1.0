from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.db.session import get_db
from app.db.models import Project, Dataset, ProjectDataset, Run, ModelMeta, Artifact
from app.dependencies.auth import get_current_user
from app.storage import storage
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import io
import base64
from app.services.ml_service import MLService

router = APIRouter()

@router.get("/projects/{project_id}/export-chart")
def export_chart(
    project_id: str,
    chart_type: str = "correlation",  # correlation, distribution, feature_importance
    format: str = "png",  # png, svg
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Export visualization charts for a project
    """
    try:
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get project datasets
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            Dataset.user_id == current_user.id
        ).all()

        if not datasets:
            raise HTTPException(status_code=404, detail="No datasets found for this project")

        # Combine datasets
        combined_df = MLService._combine_datasets(datasets)

        # Generate chart based on type
        plt.figure(figsize=(10, 6))
        sns.set_style("whitegrid")

        if chart_type == "correlation":
            # Correlation heatmap
            numeric_cols = combined_df.select_dtypes(include=[float, int]).columns
            if len(numeric_cols) > 1:
                corr_matrix = combined_df[numeric_cols].corr()
                sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', center=0, fmt='.2f')
                plt.title('Feature Correlation Heatmap')
            else:
                raise HTTPException(status_code=400, detail="Not enough numeric columns for correlation analysis")

        elif chart_type == "distribution":
            # Distribution plot for first numeric column
            numeric_cols = combined_df.select_dtypes(include=[float, int]).columns
            if len(numeric_cols) > 0:
                col = numeric_cols[0]
                sns.histplot(combined_df[col].dropna(), kde=True)
                plt.title(f'Distribution of {col}')
                plt.xlabel(col)
                plt.ylabel('Frequency')
            else:
                raise HTTPException(status_code=400, detail="No numeric columns found for distribution plot")

        elif chart_type == "feature_importance":
            # Get best model for feature importance
            models = db.query(ModelMeta).join(Run).filter(Run.project_id == project_id).all()
            if models:
                # Load first model and check if it has feature importance
                model_meta = models[0]
                try:
                    import joblib
                    model_bytes = storage.get_object(model_meta.storage_key)
                    model = joblib.load(model_bytes)

                    if hasattr(model, 'feature_importances_'):
                        # Get feature names (this is approximate)
                        feature_names = combined_df.drop(columns=[col for col in combined_df.columns if col.lower() in ['target', 'label', 'y']], errors='ignore').columns.tolist()
                        if len(feature_names) == len(model.feature_importances_):
                            importance_df = pd.DataFrame({
                                'feature': feature_names,
                                'importance': model.feature_importances_
                            }).sort_values('importance', ascending=True)

                            plt.barh(importance_df['feature'], importance_df['importance'])
                            plt.title('Feature Importance')
                            plt.xlabel('Importance')
                        else:
                            raise HTTPException(status_code=400, detail="Feature names don't match model dimensions")
                    else:
                        raise HTTPException(status_code=400, detail="Model doesn't support feature importance")
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"Failed to load model: {str(e)}")
            else:
                raise HTTPException(status_code=404, detail="No trained models found for feature importance")

        else:
            raise HTTPException(status_code=400, detail="Unsupported chart type")

        # Save plot to buffer
        buf = io.BytesIO()
        if format.lower() == "png":
            plt.savefig(buf, format='png', dpi=300, bbox_inches='tight')
            content_type = "image/png"
            filename = f"{project.name}_{chart_type}_chart.png"
        elif format.lower() == "svg":
            plt.savefig(buf, format='svg', bbox_inches='tight')
            content_type = "image/svg+xml"
            filename = f"{project.name}_{chart_type}_chart.svg"
        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'png' or 'svg'")

        plt.close()
        buf.seek(0)

        # Store exported chart
        export_key = f"exports/charts/{project_id}_{chart_type}_{format.lower()}.{'png' if format.lower() == 'png' else 'svg'}"
        storage.put_object(export_key, buf.getvalue())

        # Generate download URL
        download_url = storage.get_presigned_url(export_key, expiry_seconds=3600)

        return {
            "download_url": download_url,
            "filename": filename,
            "content_type": content_type,
            "format": format,
            "chart_type": chart_type
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chart export failed: {str(e)}")

@router.get("/projects/{project_id}/available-charts")
def get_available_charts(
    project_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get list of available charts for a project
    """
    try:
        # Verify project ownership
        project = db.query(Project).filter(
            Project.id == project_id,
            Project.user_id == current_user.id
        ).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get project datasets
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            Dataset.user_id == current_user.id
        ).all()

        available_charts = []

        if datasets:
            # Combine datasets to check data types
            combined_df = MLService._combine_datasets(datasets)
            numeric_cols = combined_df.select_dtypes(include=[float, int]).columns

            # Always available: correlation (if multiple numeric columns)
            if len(numeric_cols) > 1:
                available_charts.append({
                    "type": "correlation",
                    "name": "Correlation Heatmap",
                    "description": "Visualize relationships between numeric features"
                })

            # Always available: distribution (if any numeric columns)
            if len(numeric_cols) > 0:
                available_charts.append({
                    "type": "distribution",
                    "name": "Feature Distribution",
                    "description": "Show distribution of numeric features"
                })

        # Check for models with feature importance
        models = db.query(ModelMeta).join(Run).filter(Run.project_id == project_id).all()
        has_tree_model = any(hasattr(model, 'feature_importances_') for model in models) if models else False

        if has_tree_model:
            available_charts.append({
                "type": "feature_importance",
                "name": "Feature Importance",
                "description": "Show which features are most important for predictions"
            })

        return {"available_charts": available_charts}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get available charts: {str(e)}")
