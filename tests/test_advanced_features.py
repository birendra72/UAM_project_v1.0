import pytest
import pandas as pd
import io
import uuid
import pickle
from sklearn.linear_model import LinearRegression
from app.db.models import EDAReport, DataLineage, Project, Dataset, Run, ModelMeta, ProjectDataset
from app.storage import storage

def test_advanced_eda_flow(client):
    # 1. Register and get token
    reg_resp = client.post("/api/auth/register", json={
        "name": "Test User Advanced",
        "email": "test_adv@example.com",
        "password": "password123"
    })
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create a project
    proj_resp = client.post("/api/projects/", headers=headers, json={
        "name": "Test Project Adv",
        "description": "Advanced test project"
    })
    assert proj_resp.status_code == 200
    project_id = proj_resp.json()["id"]

    # 3. Create a dummy dataframe & upload it
    # We want a small dataframe with numeric cols for PCA/Isolation Forest
    data = {
        "feature1": [1.0, 2.0, 1.5, 2.2, 1.8, 10.0, 1.2, 1.9, 2.1, 1.6],
        "feature2": [10.0, 20.0, 15.0, 22.0, 18.0, 100.0, 12.0, 19.0, 21.0, 16.0],
        "target": [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
    }
    df = pd.DataFrame(data)
    csv_buf = io.BytesIO()
    df.to_csv(csv_buf, index=False)
    csv_buf.seek(0)

    # Upload dataset using standard route
    dataset_resp = client.post(
        f"/api/datasets/upload?project_id={project_id}",
        headers=headers,
        files={"file": ("test_adv.csv", csv_buf, "text/csv")}
    )
    assert dataset_resp.status_code == 200
    dataset_id = dataset_resp.json()["id"]

    # 4. Trigger Advanced EDA
    eda_resp = client.post(
        f"/api/analysis/eda/advanced?project_id={project_id}&dataset_id={dataset_id}&target_column=target",
        headers=headers
    )
    assert eda_resp.status_code == 200
    eda_data = eda_resp.json()
    assert eda_data["status"] == "success"
    assert "data_quality_score" in eda_data
    report = eda_data["report"]
    assert "outliers_analysis" in report
    assert "dimensionality_reduction" in report
    assert "feature_importance" in report
    assert "correlations" in report

def test_explain_predictions_flow(client, db):
    # 1. Register & login
    reg_resp = client.post("/api/auth/register", json={
        "name": "Test User Explain",
        "email": "test_exp@example.com",
        "password": "password123"
    })
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get user object to retrieve ID
    user_resp = client.get("/api/auth/me", headers=headers)
    user_id = user_resp.json()["id"]

    # 2. Create project & dataset
    proj = Project(name="Explain Proj", user_id=user_id)
    db.add(proj)
    db.commit()
    db.refresh(proj)

    ds = Dataset(filename="explain.csv", storage_key="test/explain.csv", user_id=user_id, rows=10, cols=3)
    db.add(ds)
    db.commit()
    db.refresh(ds)

    pd_rel = ProjectDataset(project_id=proj.id, dataset_id=ds.id)
    db.add(pd_rel)

    run = Run(project_id=proj.id, dataset_id=ds.id, status="COMPLETED")
    db.add(run)
    db.commit()
    db.refresh(run)

    # Train a tiny linear regression model
    model = LinearRegression()
    X_train = [[1.0, 2.0], [2.0, 3.0], [3.0, 4.0], [4.0, 5.0]]
    y_train = [3.0, 5.0, 7.0, 9.0]
    model.fit(X_train, y_train)

    # Save to storage
    model_key = f"models/test_explain_{uuid.uuid4()}.pkl"
    storage.put_object(model_key, pickle.dumps(model))

    model_meta = ModelMeta(run_id=run.id, name="Test Linear Regression", storage_key=model_key, version="1.0")
    db.add(model_meta)
    db.commit()
    db.refresh(model_meta)

    # Save dummy CSV to storage
    df = pd.DataFrame(X_train, columns=["f1", "f2"])
    df["target"] = y_train
    csv_buf = io.StringIO()
    df.to_csv(csv_buf, index=False)
    storage.put_object("test/explain.csv", csv_buf.getvalue().encode('utf-8'))

    # 3. Call Explain Endpoint
    explain_req = {
        "data": [
            {"f1": 1.5, "f2": 2.5}
        ],
        "method": "shap"
    }
    response = client.post(
        f"/api/models/{model_meta.id}/explain",
        headers=headers,
        json=explain_req
    )
    assert response.status_code == 200
    explain_data = response.json()
    assert "explanations" in explain_data
    assert "feature_importance" in explain_data

    # 4. Call GET Explain Endpoint (uses sample data)
    get_response = client.get(
        f"/api/models/{model_meta.id}/explain?method=shap",
        headers=headers
    )
    assert get_response.status_code == 200
    get_explain_data = get_response.json()
    assert "explanations" in get_explain_data
    assert len(get_explain_data["explanations"]) > 0
    assert "feature_importance" in get_explain_data


def test_predict_validation_and_reordering_flow(client, db):
    # 1. Register & login
    reg_resp = client.post("/api/auth/register", json={
        "name": "Test User Predict Validation",
        "email": "test_pred_val@example.com",
        "password": "password123"
    })
    assert reg_resp.status_code == 200
    token = reg_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Get user object to retrieve ID
    user_resp = client.get("/api/auth/me", headers=headers)
    user_id = user_resp.json()["id"]

    # 2. Create project & dataset
    proj = Project(name="Predict Proj", user_id=user_id)
    db.add(proj)
    db.commit()
    db.refresh(proj)

    ds = Dataset(filename="predict.csv", storage_key="test/predict.csv", user_id=user_id, rows=10, cols=3)
    db.add(ds)
    db.commit()
    db.refresh(ds)

    pd_rel = ProjectDataset(project_id=proj.id, dataset_id=ds.id)
    db.add(pd_rel)

    run = Run(project_id=proj.id, dataset_id=ds.id, status="COMPLETED")
    db.add(run)
    db.commit()
    db.refresh(run)

    # Train a tiny linear regression model
    model = LinearRegression()
    X_train = [[1.0, 2.0], [2.0, 3.0], [3.0, 4.0], [4.0, 5.0]]
    y_train = [3.0, 5.0, 7.0, 9.0]
    model.fit(X_train, y_train)

    # Save model and store metrics with feature names
    model_key = f"models/test_pred_val_{uuid.uuid4()}.pkl"
    storage.put_object(model_key, pickle.dumps(model))

    model_meta = ModelMeta(
        run_id=run.id,
        name="Test Linear Regression Validation",
        storage_key=model_key,
        metrics_json={"feature_names": ["f1", "f2"]},
        version="1.0"
    )
    db.add(model_meta)
    db.commit()
    db.refresh(model_meta)

    # 3. Call Predict Endpoint with missing features -> should return HTTP 422
    predict_req_invalid = {
        "data": [
            {"f1": 1.5}
        ]
    }
    response_invalid = client.post(
        f"/api/models/{model_meta.id}/predict",
        headers=headers,
        json=predict_req_invalid
    )
    assert response_invalid.status_code == 422
    invalid_data = response_invalid.json()
    assert "detail" in invalid_data
    assert invalid_data["detail"]["valid"] is False
    assert "missing" in invalid_data["detail"]
    assert "f2" in invalid_data["detail"]["missing"]

    # 4. Call Predict Endpoint with features in reversed order -> should succeed (by aligning them)
    predict_req_valid = {
        "data": [
            {"f2": 2.5, "f1": 1.5}
        ]
    }
    response_valid = client.post(
        f"/api/models/{model_meta.id}/predict",
        headers=headers,
        json=predict_req_valid
    )
    assert response_valid.status_code == 200
    valid_data = response_valid.json()
    assert "predictions" in valid_data
    assert len(valid_data["predictions"]) == 1
    # expected outcome is 1.5 * model.coef_[0] + 2.5 * model.coef_[1] + intercept_ = 4.0
    assert abs(valid_data["predictions"][0] - 4.0) < 1e-5
    assert "summary" in valid_data
    assert "insights" in valid_data["summary"]
    assert len(valid_data["summary"]["insights"]) > 0

