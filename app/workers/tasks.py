from celery import shared_task
from app.db.session import SessionLocal
from app.db.models import Run, Log, Artifact, Dataset, EDAReport, DataLineage
from app.storage import storage
import pandas as pd
import joblib
import os
import matplotlib.pyplot as plt
import seaborn as sns
import uuid
import json
import io
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from typing import cast

@shared_task(bind=True)
def predict_batch_task(self, task_id, model_key, input_file_key, batch_size=1000):
    """
    Background task for batch prediction processing
    """
    try:
        # Load model
        model_bytes = storage.get_object(model_key)
        model = joblib.load(model_bytes)

        # Load input data
        input_bytes = storage.get_object(input_file_key)
        if input_file_key.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(input_bytes.read()))  # type: ignore
        else:  # JSON
            input_data = input_bytes.read().decode('utf-8')
            data = json.loads(input_data)
            df = pd.DataFrame(data)

        # Align and validate columns if feature names are present
        feature_names = None
        if hasattr(model, 'feature_names_in_'):
            feature_names = model.feature_names_in_.tolist()
        elif hasattr(model, 'steps') and len(model.steps) > 0:
            # If pipeline, check the final step or first step
            for name, step in model.steps:
                if hasattr(step, 'feature_names_in_'):
                    feature_names = step.feature_names_in_.tolist()
                    break

        if feature_names:
            missing = list(set(feature_names) - set(df.columns))
            if missing:
                raise ValueError(f"Input file is missing required model features: {', '.join(missing)}")
            df = df[feature_names]

        total_rows = len(df)
        predictions = []

        # Process in batches
        for i in range(0, total_rows, batch_size):
            batch_df = df.iloc[i:i+batch_size]
            batch_predictions = model.predict(batch_df)  # type: ignore
            predictions.extend(batch_predictions.tolist())

            # Update progress
            progress = min((i + len(batch_df)) / total_rows, 1.0)
            self.update_state(state='PROGRESS', meta={'progress': progress})

        # Save results
        results_key = f"predictions/results/{task_id}.json"
        results_data = {
            'task_id': task_id,
            'total_predictions': len(predictions),
            'predictions': predictions
        }
        storage.put_object(results_key, json.dumps(results_data).encode('utf-8'))

        return {
            'status': 'COMPLETED',
            'results_key': results_key,
            'total_predictions': len(predictions)
        }

    except Exception as e:
        self.update_state(state='FAILURE', meta={'error': str(e)})
        raise

def log_message(db, run_id, level, message):
    log = Log(run_id=run_id, level=level, message=message)
    db.add(log)
    db.commit()

@shared_task(bind=True)
def preprocess_data(self, run_id, dataset_key):
    db = SessionLocal()
    run = None
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise Exception("Run not found")
        run.status = "RUNNING"
        run.current_task = "Preprocessing"
        db.commit()

        # Download dataset from storage
        data_bytes = storage.get_object(dataset_key)
        df = pd.read_csv(io.BytesIO(data_bytes.read()))  # type: ignore

        # Type-aware imputation strategy to prevent empty datasets from dropping rows
        df_clean = df.copy()
        for col in df_clean.columns:
            if df_clean[col].isnull().any():
                if pd.api.types.is_numeric_dtype(df_clean[col]):
                    median_val = df_clean[col].median()
                    # Fallback to 0 if entire column is NaN
                    if pd.isna(median_val):
                        median_val = 0.0
                    df_clean[col] = df_clean[col].fillna(median_val)
                else:
                    mode_series = df_clean[col].mode()
                    mode_val = mode_series[0] if not mode_series.empty else 'Unknown'
                    df_clean[col] = df_clean[col].fillna(mode_val)

        # Save cleaned dataset back to storage
        cleaned_key = f"cleaned/{uuid.uuid4()}.csv"
        csv_buffer = io.StringIO()
        df_clean.to_csv(csv_buffer, index=False)
        csv_string = cast(str, csv_buffer.getvalue())
        storage.put_object(cleaned_key, csv_string.encode('utf-8'))

        # Save artifact record
        artifact = Artifact(
            run_id=run_id,
            type="cleaned_dataset",
            storage_key=cleaned_key,
            filename=os.path.basename(cleaned_key),
            metadata_json={"rows": df_clean.shape[0], "cols": df_clean.shape[1]}
        )
        db.add(artifact)
        db.commit()

        run.progress = 0.25
        db.commit()
        log_message(db, run_id, "INFO", "Preprocessing completed successfully.")
        return run_id
    except Exception as e:
        log_message(db, run_id, "ERROR", f"Preprocessing failed: {str(e)}")
        if run:
            run.status = "FAILED"
            db.commit()
        raise
    finally:
        db.close()

@shared_task(bind=True)
def run_eda(self, run_id):
    db = SessionLocal()
    run = None
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise Exception("Run not found")
        run.status = "RUNNING"
        run.current_task = "EDA"
        db.commit()

        # Retrieve project and user_id to leverage EDAService
        project = run.project
        if not project:
            raise Exception("Project associated with run not found")

        # Get datasets for the project
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == run.project_id
        ).all()

        if not datasets:
            raise Exception("No datasets found for this project")

        from app.services.eda_service import EDAService

        # Combine all datasets for analysis
        combined_df = EDAService._combine_datasets(datasets)

        # Generate insights (actual analysis)
        insights = EDAService._generate_insights(combined_df)

        # Generate outliers data
        outliers_data = EDAService._generate_outliers_data(combined_df)

        # Structure complete results for the frontend
        results_data = {
            "run_id": run_id,
            "status": "completed",
            "created_at": str(run.started_at) if run.started_at else None,
            "results": {
                "summary": insights["data_quality"],
                "correlations": insights["correlations"],
                "insights": insights["recommendations"],
                "distributions": insights["distributions"],
                "outliers": outliers_data
            }
        }

        # Save results as JSON artifact in storage
        results_key = f"eda/results/{run_id}.json"
        storage.put_object(results_key, json.dumps(results_data).encode('utf-8'))

        # Save artifact record in DB
        artifact = Artifact(
            run_id=run_id,
            type="eda_results",
            storage_key=results_key,
            filename=f"eda_results_{run_id}.json",
            metadata_json={
                "description": "Complete EDA results including correlations, distributions, outliers, and insights",
                "rows": len(combined_df),
                "cols": len(combined_df.columns)
            }
        )
        db.add(artifact)

        # Save EDAReport record in DB
        data_quality_score = 100.0 - float(insights["data_quality"]["missing_data_percentage"])
        if insights["data_quality"]["duplicate_rows"] > 0:
            data_quality_score -= min(10.0, float(insights["data_quality"]["duplicate_rows"]) / len(combined_df) * 100)
        data_quality_score = max(0.0, min(100.0, data_quality_score))

        eda_report_db = EDAReport(
            project_id=run.project_id,
            dataset_id=datasets[0].id,
            summary_metrics=insights["data_quality"],
            data_quality_score=data_quality_score,
            outliers_json=outliers_data,
            correlations_json=insights.get("correlations", {}),
            storage_key=results_key
        )
        db.add(eda_report_db)

        # Save DataLineage record in DB
        lineage = DataLineage(
            dataset_id=datasets[0].id,
            operation_type="eda",
            input_storage_key=datasets[0].storage_key,
            output_storage_key=results_key,
            parameters_json={"run_id": run_id},
            executed_by=project.user_id
        )
        db.add(lineage)
        db.commit()

        # Update run status
        run.progress = 1.0
        run.status = "COMPLETED"
        run.current_task = None
        db.commit()
        log_message(db, run_id, "INFO", "EDA completed successfully.")
        return run_id
    except Exception as e:
        log_message(db, run_id, "ERROR", f"EDA failed: {str(e)}")
        if run:
            run.status = "FAILED"
            db.commit()
        raise
    finally:
        db.close()

@shared_task(bind=True)
def train_models(self, run_id):
    db = SessionLocal()
    run = None
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise Exception("Run not found")
        run.current_task = "Training"
        db.commit()

        artifacts = db.query(Artifact).filter(Artifact.run_id == run_id, Artifact.type == "cleaned_dataset").all()
        if not artifacts:
            raise Exception("Cleaned dataset artifact not found")

        cleaned_key = artifacts[0].storage_key
        data_bytes = storage.get_object(cleaned_key)
        df = pd.read_csv(io.BytesIO(data_bytes.read()))  # type: ignore

        # Simple model: predict first numeric column from second numeric column
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) < 2:
            raise Exception("Not enough numeric columns for training")

        X = df[[numeric_cols[1]]]
        y = df[numeric_cols[0]]

        from sklearn.linear_model import LinearRegression
        model = LinearRegression()
        model.fit(X, y)

        model_key = f"models/{uuid.uuid4()}.joblib"
        model_buffer = io.BytesIO()
        joblib.dump(model, model_buffer)
        model_buffer.seek(0)
        storage.put_object(model_key, model_buffer.read())

        artifact = Artifact(
            run_id=run_id,
            type="model",
            storage_key=model_key,
            filename=os.path.basename(model_key),
            metadata_json={"model_type": "LinearRegression"}
        )
        db.add(artifact)
        db.commit()

        run.progress = 0.75
        db.commit()
        log_message(db, run_id, "INFO", "Model training completed successfully.")
        return run_id
    except Exception as e:
        log_message(db, run_id, "ERROR", f"Training failed: {str(e)}")
        if run:
            run.status = "FAILED"
            db.commit()
        raise
    finally:
        db.close()

@shared_task(bind=True)
def finalize_run(self, run_id):
    db = SessionLocal()
    run = None
    try:
        run = db.query(Run).filter(Run.id == run_id).first()
        if not run:
            raise Exception("Run not found")
        run.current_task = "Finalizing"
        db.commit()

        # Generate a simple PDF report
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        c.drawString(100, 750, f"Run Report: {run_id}")
        c.drawString(100, 730, f"Status: {run.status}")
        c.drawString(100, 710, "This is a sample report generated by UAM backend.")
        c.showPage()
        c.save()
        buffer.seek(0)

        report_key = f"reports/{uuid.uuid4()}.pdf"
        storage.put_object(report_key, buffer.read())

        artifact = Artifact(
            run_id=run_id,
            type="report",
            storage_key=report_key,
            filename=os.path.basename(report_key),
            metadata_json={"description": "Run report PDF"}
        )
        db.add(artifact)

        run.status = "COMPLETED"
        run.progress = 1.0
        run.current_task = None
        db.commit()
        log_message(db, run_id, "INFO", "Run finalized successfully.")
        return run_id
    except Exception as e:
        log_message(db, run_id, "ERROR", f"Finalization failed: {str(e)}")
        if run:
            run.status = "FAILED"
            db.commit()
        raise
    finally:
        db.close()
