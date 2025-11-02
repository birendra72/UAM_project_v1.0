from celery import shared_task
from app.db.session import SessionLocal
from app.db.models import Run, Log, Artifact, Dataset
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

        total_rows = len(df)
        predictions = []

        # Process in batches
        for i in range(0, total_rows, batch_size):
            batch_df = df.iloc[i:i+batch_size]
            batch_predictions = model.predict(batch_df)  # type: ignore
            predictions.extend(batch_predictions.tolist())

            # Update progress (in production, store in Redis/database)
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

        # Simple preprocessing example: drop NA
        df_clean = df.dropna()

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

        # Get dataset from run
        dataset = db.query(Dataset).filter(Dataset.id == run.dataset_id).first()
        if not dataset:
            raise Exception("Dataset not found")

        data_bytes = storage.get_object(dataset.storage_key)
        df = pd.read_csv(io.BytesIO(data_bytes.read()))  # type: ignore

        # Generate summary stats
        summary = {
            "shape": df.shape,
            "columns": list(df.columns),
            "dtypes": df.dtypes.astype(str).to_dict(),
            "missing_values": df.isnull().sum().to_dict(),
            "describe": df.describe().to_dict()
        }

        # Save summary as JSON artifact
        summary_key = f"eda/{uuid.uuid4()}.json"
        storage.put_object(summary_key, json.dumps(summary).encode())

        artifact_summary = Artifact(
            run_id=run_id,
            type="eda_summary",
            storage_key=summary_key,
            filename=os.path.basename(summary_key),
            metadata_json={"description": "EDA summary statistics"}
        )
        db.add(artifact_summary)

        # Generate charts using Plotly (for interactive JSON)
        import plotly.graph_objects as go
        import plotly.io as pio

        # Histogram for first numeric column
        numeric_cols = df.select_dtypes(include=['number']).columns
        if len(numeric_cols) > 0:
            fig = go.Figure()
            fig.add_trace(go.Histogram(x=df[numeric_cols[0]], nbinsx=30))
            fig.update_layout(title=f"Histogram of {numeric_cols[0]}", xaxis_title=numeric_cols[0], yaxis_title="Count")
            chart_json = pio.to_json(fig)
            if chart_json is None:
                chart_json = "{}"

            chart_key = f"eda/{uuid.uuid4()}.json"
            storage.put_object(chart_key, chart_json.encode())

            artifact_chart = Artifact(
                run_id=run_id,
                type="eda_chart",
                storage_key=chart_key,
                filename=os.path.basename(chart_key),
                metadata_json={"description": f"Interactive histogram of {numeric_cols[0]}"}
            )
            db.add(artifact_chart)

        db.commit()

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
