from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import Optional, Dict, Any, List
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV, RandomizedSearchCV
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.linear_model import LogisticRegression, LinearRegression
from sklearn.svm import SVC, SVR
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
try:
    from xgboost import XGBClassifier, XGBRegressor
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, r2_score, mean_squared_error, mean_absolute_error
from sklearn.metrics import confusion_matrix, roc_curve, auc, precision_recall_curve
import scipy.stats as stats
import json
import uuid
import pickle
import io
from app.db.models import Project as ProjectModel, Dataset, ProjectDataset, ModelMeta, Run
from app.storage import storage

class MLService:
    @staticmethod
    def _safe_float(value):
        """Convert to float, handling NaN and other missing values"""
        if pd.isna(value):
            return None
        try:
            return float(round(value, 4))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def analyze_task_type(
        project_id: str,
        user_id: str,
        db: Session,
        target_column: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze the dataset to determine the ML task type and provide recommendations
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
        combined_df = MLService._combine_datasets(datasets)

        # Analyze task type
        task_analysis = MLService._analyze_task_type(combined_df, target_column)

        return {
            "project_id": project_id,
            "task_analysis": task_analysis,
            "dataset_info": {
                "total_rows": len(combined_df),
                "total_columns": len(combined_df.columns),
                "numeric_columns": len(combined_df.select_dtypes(include=[np.number]).columns),
                "categorical_columns": len(combined_df.select_dtypes(include=['object']).columns)
            }
        }

    @staticmethod
    def train_auto_ml(
        project_id: str,
        user_id: str,
        db: Session,
        task_type: str,
        target_column: str,
        test_size: float = 0.2,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """
        Train multiple models automatically and return comparison results
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

        # Combine all datasets for training
        combined_df = MLService._combine_datasets(datasets)

        # Prepare data for training
        X, y, feature_names = MLService._prepare_data(combined_df, target_column, task_type)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        # Create a run record for tracking
        run = Run(
            project_id=project_id,
            dataset_id=datasets[0].id,  # Use first dataset as primary
            status="RUNNING",
            current_task="Training models",
            parameters_json={
                "task_type": task_type,
                "target_column": target_column,
                "test_size": test_size,
                "random_state": random_state
            }
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        # Train models based on task type with cross-validation
        models_results = MLService._train_models(X_train, X_test, y_train, y_test, task_type, X, y)

        # Store trained models and metadata
        model_metas = []
        for model_result in models_results:
            if 'error' not in model_result:
                # Save model to storage
                model_storage_key = f"models/{project_id}/{run.id}/{model_result['name'].replace(' ', '_').lower()}.pkl"
                model_buffer = io.BytesIO()
                pickle.dump(model_result['model'], model_buffer)
                model_buffer.seek(0)
                storage.upload_fileobj(model_storage_key, model_buffer)

                # Create model metadata record
                model_meta = ModelMeta(
                    run_id=run.id,
                    name=model_result['name'],
                    storage_key=model_storage_key,
                    metrics_json={
                        k: v for k, v in model_result.items()
                        if k not in ['model', 'name', 'storage_key']
                    },
                    version="1.0"
                )
                model_meta.metrics_json["target_column"] = target_column
                model_meta.metrics_json["feature_names"] = feature_names.tolist()
                db.add(model_meta)
                model_metas.append(model_meta)

        db.commit()

        # Update run status
        run.status = "COMPLETED"
        run.finished_at = func.now()
        db.commit()

        # Store results (exclude model objects from serialization)
        models_for_storage = [
            {k: v for k, v in model.items() if k != 'model'}
            for model in models_results
        ]

        training_results = {
            "project_id": project_id,
            "run_id": run.id,
            "task_type": task_type,
            "target_column": target_column,
            "dataset_info": {
                "total_samples": len(X),
                "training_samples": len(X_train),
                "test_samples": len(X_test),
                "features": len(feature_names)
            },
            "models": models_for_storage,
            "feature_names": feature_names.tolist()
        }

        # Save to storage
        storage_key = f"ml/{project_id}_{run.id}.json"
        storage.upload_fileobj(storage_key, io.BytesIO(json.dumps(training_results).encode('utf-8')))

        return {
            "project_id": project_id,
            "run_id": run.id,
            "storage_key": storage_key,
            "task_type": task_type,
            "models_trained": len(models_results),
            "best_model": max(models_results, key=lambda x: x['score'])['name']
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
    def _analyze_task_type(df: pd.DataFrame, target_column: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze the dataset to determine the appropriate ML task type
        """
        analysis = {
            "recommended_task": "unknown",
            "confidence": 0.0,
            "reasoning": [],
            "possible_targets": [],
            "task_details": {},
            "recommended_algorithms": []
        }

        # Get numeric and categorical columns
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object']).columns.tolist()

        # If target column is specified, analyze it
        if target_column and target_column in df.columns:
            target_data = df[target_column].dropna()
            target_analysis = MLService._analyze_target_column(target_data, target_column)
            analysis.update(target_analysis)

            # Set recommended algorithms based on task type
            if analysis["task_type"] == "regression":
                analysis["recommended_algorithms"] = [
                    "Linear Regression",
                    "Random Forest",
                    "SVR",
                    "Gradient Boosting"
                ]
            elif analysis["task_type"] in ["binary_classification", "multiclass_classification"]:
                analysis["recommended_algorithms"] = [
                    "Logistic Regression",
                    "Random Forest",
                    "SVM",
                    "XGBoost"
                ]
            else:
                analysis["recommended_algorithms"] = [
                    "K-Means",
                    "DBSCAN",
                    "Hierarchical",
                    "Gaussian Mixture"
                ]
        else:
            # Auto-detect potential target columns
            potential_targets = []

            # Check numeric columns for regression potential
            for col in numeric_cols:
                if df[col].nunique() > 10:  # Continuous-like
                    potential_targets.append({
                        "column": col,
                        "task_type": "regression",
                        "unique_values": df[col].nunique(),
                        "correlation_potential": True
                    })

            # Check categorical columns for classification potential
            for col in categorical_cols:
                unique_count = df[col].nunique()
                if 2 <= unique_count <= 20:  # Reasonable classification target
                    potential_targets.append({
                        "column": col,
                        "task_type": "classification",
                        "unique_values": unique_count,
                        "classes": df[col].unique().tolist()[:10]  # Show first 10 classes
                    })

            analysis["possible_targets"] = potential_targets

            # Recommend based on data characteristics
            if len(potential_targets) > 0:
                # Prefer regression if we have continuous targets
                regression_targets = [t for t in potential_targets if t["task_type"] == "regression"]
                classification_targets = [t for t in potential_targets if t["task_type"] == "classification"]

                if regression_targets:
                    analysis["recommended_task"] = "regression"
                    analysis["confidence"] = 0.8
                    analysis["reasoning"].append("Found continuous numeric columns suitable for regression")
                    analysis["recommended_algorithms"] = [
                        "Linear Regression",
                        "Random Forest",
                        "SVR",
                        "Gradient Boosting"
                    ]
                elif classification_targets:
                    analysis["recommended_task"] = "classification"
                    analysis["confidence"] = 0.7
                    analysis["reasoning"].append("Found categorical columns with reasonable number of classes")
                    analysis["recommended_algorithms"] = [
                        "Logistic Regression",
                        "Random Forest",
                        "SVM",
                        "XGBoost"
                    ]
                else:
                    analysis["recommended_task"] = "clustering"
                    analysis["confidence"] = 0.5
                    analysis["reasoning"].append("No clear target column found, clustering may be appropriate")
                    analysis["recommended_algorithms"] = [
                        "K-Means",
                        "DBSCAN",
                        "Hierarchical",
                        "Gaussian Mixture"
                    ]
            else:
                analysis["recommended_task"] = "clustering"
                analysis["confidence"] = 0.3
                analysis["reasoning"].append("Dataset structure suggests unsupervised learning")
                analysis["recommended_algorithms"] = [
                    "K-Means",
                    "DBSCAN",
                    "Hierarchical",
                    "Gaussian Mixture"
                ]

        return analysis

    @staticmethod
    def _analyze_target_column(target_data: pd.Series, column_name: str) -> Dict[str, Any]:
        """
        Analyze a specific target column to determine task type
        """
        analysis = {
            "target_column": column_name,
            "task_type": "unknown",
            "is_suitable": False,
            "details": {}
        }

        # Check if numeric
        if pd.api.types.is_numeric_dtype(target_data):
            unique_count = target_data.nunique()
            total_count = len(target_data)

            if unique_count == 2:
                analysis["task_type"] = "binary_classification"
                analysis["is_suitable"] = True
                analysis["details"] = {
                    "unique_values": unique_count,
                    "classes": sorted(target_data.unique().tolist()),
                    "class_distribution": target_data.value_counts().to_dict()
                }
            elif 2 < unique_count <= 20:
                analysis["task_type"] = "multiclass_classification"
                analysis["is_suitable"] = True
                analysis["details"] = {
                    "unique_values": unique_count,
                    "classes": sorted(target_data.unique().tolist())[:10],  # Show first 10
                    "class_distribution": target_data.value_counts().head(10).to_dict()
                }
            elif unique_count > 20:
                # Check if it's continuous or discrete
                if unique_count / total_count > 0.1:  # More than 10% unique values
                    analysis["task_type"] = "regression"
                    analysis["is_suitable"] = True
                    analysis["details"] = {
                        "unique_values": unique_count,
                        "range": [MLService._safe_float(target_data.min()), MLService._safe_float(target_data.max())],
                        "mean": MLService._safe_float(target_data.mean()),
                        "std": MLService._safe_float(target_data.std())
                    }
                else:
                    analysis["task_type"] = "multiclass_classification"
                    analysis["is_suitable"] = True
        else:
            # Categorical target
            unique_count = target_data.nunique()
            if unique_count == 2:
                analysis["task_type"] = "binary_classification"
                analysis["is_suitable"] = True
            elif 2 < unique_count <= 20:
                analysis["task_type"] = "multiclass_classification"
                analysis["is_suitable"] = True
            else:
                analysis["is_suitable"] = False
                analysis["details"] = {"reason": "Too many classes for classification"}

            if analysis["is_suitable"]:
                analysis["details"] = {
                    "unique_values": unique_count,
                    "classes": target_data.value_counts().head(10).to_dict()
                }

        return analysis

    @staticmethod
    def _prepare_data(df: pd.DataFrame, target_column: str, task_type: str) -> tuple:
        """
        Prepare data for ML training
        """
        # Separate features and target
        X = df.drop(columns=[target_column])
        y = df[target_column]

        # Handle missing values
        X = X.fillna(X.mean(numeric_only=True))  # Fill numeric with mean
        X = X.fillna(X.mode().iloc[0])  # Fill categorical with mode

        # Encode categorical variables
        categorical_cols = X.select_dtypes(include=['object']).columns
        label_encoders = {}

        for col in categorical_cols:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            label_encoders[col] = le

        # Scale numeric features
        numeric_cols = X.select_dtypes(include=[np.number]).columns
        if len(numeric_cols) > 0:
            scaler = StandardScaler()
            X[numeric_cols] = scaler.fit_transform(X[numeric_cols])

        # Encode target if classification
        if task_type in ['binary_classification', 'multiclass_classification']:
            target_encoder = LabelEncoder()
            y = target_encoder.fit_transform(y.astype(str))
        elif task_type == 'regression':
            # Ensure target is numeric for regression
            try:
                y = y.astype(float)
            except ValueError as e:
                raise ValueError(f"Target column '{target_column}' contains non-numeric values that cannot be converted to float for regression. Error: {str(e)}")
        else:
            y = np.asarray(y)

        # Convert to numpy arrays
        X = X.values
        y = np.asarray(y)

        return X, y, df.drop(columns=[target_column]).columns

    @staticmethod
    def _train_models(X_train: np.ndarray, X_test: np.ndarray, y_train: np.ndarray, y_test: np.ndarray, task_type: str, X: np.ndarray, y: np.ndarray) -> List[Dict[str, Any]]:
        """
        Train multiple models and return their performance
        """
        results = []

        if task_type in ['binary_classification', 'multiclass_classification']:
            # Classification models
            models = [
                ('Logistic Regression', LogisticRegression(max_iter=1000, random_state=42)),
                ('Random Forest', RandomForestClassifier(n_estimators=100, random_state=42)),
            ]
            if HAS_XGBOOST:
                models.append(('XGBoost', XGBClassifier(n_estimators=100, random_state=42)))
            models.extend([
                ('SVM', SVC(random_state=42)),
                ('Decision Tree', DecisionTreeClassifier(random_state=42)),
                ('Naive Bayes', GaussianNB()),
                ('K-Nearest Neighbors', KNeighborsClassifier())
            ])

            for name, model in models:
                try:
                    model.fit(X_train, y_train)
                    y_pred = model.predict(X_test)  # type: ignore

                    # Calculate metrics
                    accuracy = accuracy_score(y_test, y_pred)
                    precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
                    recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
                    f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)

                    # Calculate cross-validation score
                    cv_scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')
                    cv_mean = float(np.round(np.mean(cv_scores), 4))
                    cv_std = float(np.round(np.std(cv_scores), 4))

                    results.append({
                        'name': name,
                        'model': model,
                        'accuracy': float(np.round(accuracy, 4)),
                        'precision': float(np.round(precision, 4)),
                        'recall': float(np.round(recall, 4)),
                        'f1_score': float(np.round(f1, 4)),
                        'cv_mean': cv_mean,
                        'cv_std': cv_std,
                        'score': float(accuracy)  # Primary score for ranking
                    })
                except Exception as e:
                    print(f"Error training {name}: {e}")
                    results.append({
                        'name': name,
                        'error': str(e),
                        'score': 0
                    })

        else:
            # Regression models
            models = [
                ('Linear Regression', LinearRegression()),
                ('Random Forest', RandomForestRegressor(n_estimators=100, random_state=42)),
                ('SVR', SVR()),
                ('Decision Tree', DecisionTreeRegressor(random_state=42)),
                ('K-Nearest Neighbors', KNeighborsRegressor())
            ]

            for name, model in models:
                try:
                    model.fit(X_train, y_train)
                    y_pred = model.predict(X_test)  # type: ignore

                    # Calculate metrics
                    r2 = r2_score(y_test, y_pred)
                    mse = mean_squared_error(y_test, y_pred)
                    mae = mean_absolute_error(y_test, y_pred)

                    # Calculate cross-validation score
                    cv_scores = cross_val_score(model, X, y, cv=5, scoring='r2')
                    cv_mean = float(np.round(np.mean(cv_scores), 4))
                    cv_std = float(np.round(np.std(cv_scores), 4))

                    results.append({
                        'name': name,
                        'model': model,
                        'r2_score': float(np.round(r2, 4)),
                        'mse': float(np.round(mse, 4)),
                        'mae': float(np.round(mae, 4)),
                        'cv_mean': cv_mean,
                        'cv_std': cv_std,
                        'score': float(r2)  # Primary score for ranking
                    })
                except Exception as e:
                    print(f"Error training {name}: {e}")
                    results.append({
                        'name': name,
                        'error': str(e),
                        'score': float('-inf')
                    })

        # Sort by score (descending)
        results.sort(key=lambda x: x.get('score', 0), reverse=True)
        return results

    @staticmethod
    def get_hyperparameter_spaces(task_type: str) -> Dict[str, Dict[str, Any]]:
        """
        Get hyperparameter search spaces for different algorithms
        """
        if task_type in ['binary_classification', 'multiclass_classification']:
            return {
                'Logistic Regression': {
                    'C': [0.001, 0.01, 0.1, 1, 10, 100],
                    'penalty': ['l1', 'l2', 'elasticnet', 'none'],
                    'solver': ['newton-cg', 'lbfgs', 'liblinear', 'sag', 'saga'],
                    'max_iter': [1000, 2000, 5000]
                },
                'Random Forest': {
                    'n_estimators': [50, 100, 200, 300],
                    'max_depth': [None, 10, 20, 30, 50],
                    'min_samples_split': [2, 5, 10],
                    'min_samples_leaf': [1, 2, 4],
                    'max_features': ['auto', 'sqrt', 'log2'],
                    'bootstrap': [True, False]
                },
                'XGBoost': {
                    'n_estimators': [50, 100, 200, 300],
                    'max_depth': [3, 5, 7, 9],
                    'learning_rate': [0.01, 0.1, 0.2, 0.3],
                    'subsample': [0.6, 0.8, 1.0],
                    'colsample_bytree': [0.6, 0.8, 1.0],
                    'gamma': [0, 0.1, 0.2, 0.3],
                    'reg_alpha': [0, 0.01, 0.1, 1],
                    'reg_lambda': [0.01, 0.1, 1, 10]
                },
                'SVM': {
                    'C': [0.1, 1, 10, 100],
                    'kernel': ['linear', 'poly', 'rbf', 'sigmoid'],
                    'gamma': ['scale', 'auto', 0.001, 0.01, 0.1, 1],
                    'degree': [2, 3, 4]  # Only for poly kernel
                },
                'Decision Tree': {
                    'max_depth': [None, 5, 10, 15, 20, 30],
                    'min_samples_split': [2, 5, 10, 15],
                    'min_samples_leaf': [1, 2, 4, 6],
                    'criterion': ['gini', 'entropy'],
                    'max_features': [None, 'auto', 'sqrt', 'log2']
                },
                'K-Nearest Neighbors': {
                    'n_neighbors': [3, 5, 7, 9, 11, 15],
                    'weights': ['uniform', 'distance'],
                    'algorithm': ['auto', 'ball_tree', 'kd_tree', 'brute'],
                    'p': [1, 2]  # Manhattan vs Euclidean distance
                }
            }
        else:  # Regression
            return {
                'Linear Regression': {
                    'fit_intercept': [True, False],
                    'normalize': [True, False]
                },
                'Random Forest': {
                    'n_estimators': [50, 100, 200, 300],
                    'max_depth': [None, 10, 20, 30, 50],
                    'min_samples_split': [2, 5, 10],
                    'min_samples_leaf': [1, 2, 4],
                    'max_features': ['auto', 'sqrt', 'log2'],
                    'bootstrap': [True, False]
                },
                'SVR': {
                    'C': [0.1, 1, 10, 100],
                    'kernel': ['linear', 'poly', 'rbf', 'sigmoid'],
                    'gamma': ['scale', 'auto', 0.001, 0.01, 0.1, 1],
                    'epsilon': [0.01, 0.1, 0.2, 0.5]
                },
                'Decision Tree': {
                    'max_depth': [None, 5, 10, 15, 20, 30],
                    'min_samples_split': [2, 5, 10, 15],
                    'min_samples_leaf': [1, 2, 4, 6],
                    'criterion': ['mse', 'friedman_mse', 'mae'],
                    'max_features': [None, 'auto', 'sqrt', 'log2']
                },
                'K-Nearest Neighbors': {
                    'n_neighbors': [3, 5, 7, 9, 11, 15],
                    'weights': ['uniform', 'distance'],
                    'algorithm': ['auto', 'ball_tree', 'kd_tree', 'brute'],
                    'p': [1, 2]
                }
            }

    @staticmethod
    def perform_hyperparameter_tuning(
        project_id: str,
        user_id: str,
        db: Session,
        task_type: str,
        target_column: str,
        algorithm: str,
        search_method: str = 'grid',
        max_evals: int = 50,
        cv_folds: int = 5,
        test_size: float = 0.2,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """
        Perform hyperparameter tuning for a specific algorithm
        """
        # Verify project ownership
        project = db.query(ProjectModel).filter(
            ProjectModel.id == project_id,
            ProjectModel.user_id == user_id
        ).first()
        if not project:
            raise ValueError("Project not found")

        # Get datasets
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            Dataset.user_id == user_id
        ).all()

        if not datasets:
            raise ValueError("No datasets found for this project")

        # Combine datasets
        combined_df = MLService._combine_datasets(datasets)

        # Prepare data
        X, y, feature_names = MLService._prepare_data(combined_df, target_column, task_type)

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

        # Get hyperparameter space
        param_spaces = MLService.get_hyperparameter_spaces(task_type)
        if algorithm not in param_spaces:
            raise ValueError(f"Algorithm '{algorithm}' not supported for hyperparameter tuning")

        param_space = param_spaces[algorithm]

        # Create base model
        base_model = MLService._get_base_model(algorithm, task_type)

        # Create run record for hyperparameter tuning
        run = Run(
            project_id=project_id,
            dataset_id=datasets[0].id,
            status="RUNNING",
            current_task=f"Hyperparameter tuning for {algorithm}",
            parameters_json={
                "task_type": task_type,
                "target_column": target_column,
                "algorithm": algorithm,
                "search_method": search_method,
                "max_evals": max_evals,
                "cv_folds": cv_folds,
                "test_size": test_size
            }
        )
        db.add(run)
        db.commit()
        db.refresh(run)

        try:
            # Perform hyperparameter search
            if search_method == 'grid':
                search = GridSearchCV(
                    base_model,
                    param_space,
                    cv=cv_folds,
                    scoring=MLService._get_scoring_metric(task_type),
                    n_jobs=-1,
                    verbose=1
                )
            else:  # random
                search = RandomizedSearchCV(
                    base_model,
                    param_space,
                    n_iter=min(max_evals, len(param_space)),
                    cv=cv_folds,
                    scoring=MLService._get_scoring_metric(task_type),
                    n_jobs=-1,
                    random_state=random_state,
                    verbose=1
                )

            # Fit the search
            search.fit(X_train, y_train)

            # Get best model and evaluate
            best_model = search.best_estimator_
            y_pred = best_model.predict(X_test)

            # Calculate metrics
            metrics = MLService._calculate_metrics(y_test, y_pred, task_type)

            # Store best model
            model_storage_key = f"models/{project_id}/{run.id}/{algorithm.replace(' ', '_').lower()}_tuned.pkl"
            model_buffer = io.BytesIO()
            pickle.dump(best_model, model_buffer)
            model_buffer.seek(0)
            storage.upload_fileobj(model_storage_key, model_buffer)

            # Create model metadata
            model_meta = ModelMeta(
                run_id=run.id,
                name=f"{algorithm} (Tuned)",
                storage_key=model_storage_key,
                metrics_json={
                    **metrics,
                    'best_params': search.best_params_,
                    'cv_results': {
                        'mean_test_score': float(np.mean(search.cv_results_['mean_test_score'])),
                        'std_test_score': float(np.std(search.cv_results_['mean_test_score'])),
                        'best_score': float(search.best_score_)
                    }
                },
                version="1.0"
            )
            model_meta.metrics_json["target_column"] = target_column
            model_meta.metrics_json["feature_names"] = feature_names.tolist()
            db.add(model_meta)
            db.commit()

            # Update run status
            run.status = "COMPLETED"
            run.finished_at = func.now()
            db.commit()

            return {
                "run_id": run.id,
                "algorithm": algorithm,
                "best_params": search.best_params_,
                "best_score": float(search.best_score_),
                "metrics": metrics,
                "cv_results": {
                    'mean_test_score': float(np.mean(search.cv_results_['mean_test_score'])),
                    'std_test_score': float(np.std(search.cv_results_['mean_test_score'])),
                    'n_candidates': len(search.cv_results_['mean_test_score'])
                }
            }

        except Exception as e:
            run.status = "FAILED"
            run.finished_at = func.now()
            db.commit()
            raise e

    @staticmethod
    def _get_base_model(algorithm: str, task_type: str):
        """Get base model instance for hyperparameter tuning"""
        if task_type in ['binary_classification', 'multiclass_classification']:
            if algorithm == 'Logistic Regression':
                return LogisticRegression(max_iter=1000, random_state=42)
            elif algorithm == 'Random Forest':
                return RandomForestClassifier(random_state=42)
            elif algorithm == 'SVM':
                return SVC(random_state=42)
            elif algorithm == 'Decision Tree':
                return DecisionTreeClassifier(random_state=42)
            elif algorithm == 'K-Nearest Neighbors':
                return KNeighborsClassifier()
        else:  # regression
            if algorithm == 'Linear Regression':
                return LinearRegression()
            elif algorithm == 'Random Forest':
                return RandomForestRegressor(random_state=42)
            elif algorithm == 'SVR':
                return SVR()
            elif algorithm == 'Decision Tree':
                return DecisionTreeRegressor(random_state=42)
            elif algorithm == 'K-Nearest Neighbors':
                return KNeighborsRegressor()

        raise ValueError(f"Unsupported algorithm: {algorithm}")

    @staticmethod
    def _get_scoring_metric(task_type: str) -> str:
        """Get appropriate scoring metric for the task type"""
        if task_type in ['binary_classification', 'multiclass_classification']:
            return 'accuracy'
        else:
            return 'r2'

    @staticmethod
    def _calculate_metrics(y_true: np.ndarray, y_pred: np.ndarray, task_type: str) -> Dict[str, float]:
        """Calculate evaluation metrics"""
        if task_type in ['binary_classification', 'multiclass_classification']:
            return {
                'accuracy': float(accuracy_score(y_true, y_pred)),
                'precision': float(precision_score(y_true, y_pred, average='weighted', zero_division=0)),
                'recall': float(recall_score(y_true, y_pred, average='weighted', zero_division=0)),
                'f1_score': float(f1_score(y_true, y_pred, average='weighted', zero_division=0))
            }
        else:
            return {
                'r2_score': float(r2_score(y_true, y_pred)),
                'mse': float(mean_squared_error(y_true, y_pred)),
                'mae': float(mean_absolute_error(y_true, y_pred))
            }

    @staticmethod
    def validate_prediction_input(model_meta, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate incoming prediction data against model's expected features.
        Returns a dictionary with status, message, missing_features, and extra_features.
        """
        feature_names = model_meta.metrics_json.get("feature_names", [])
        if not feature_names:
            return {"valid": True, "missing": [], "extra": []}

        # Check if input data is empty
        if not data:
            return {"valid": False, "message": "Input data is empty", "missing": feature_names, "extra": []}

        first_record_keys = set(data[0].keys())
        expected_keys = set(feature_names)

        missing = list(expected_keys - first_record_keys)
        extra = list(first_record_keys - expected_keys)

        if missing:
            return {
                "valid": False,
                "message": f"Validation failed: Missing features required by model: {', '.join(missing)}",
                "missing": missing,
                "extra": extra
            }

        return {"valid": True, "missing": [], "extra": extra}

    @staticmethod
    def generate_prediction_summary(predictions: np.ndarray) -> Dict[str, Any]:
        """
        Generate summary statistics for predictions
        """
        summary = {
            "total_predictions": len(predictions),
            "prediction_types": {},
            "insights": []
        }

        # Handle different prediction types
        if predictions.dtype.kind in ['i', 'f']:  # integer or float
            summary["prediction_types"]["numeric"] = {
                "min": float(np.min(predictions)),
                "max": float(np.max(predictions)),
                "mean": float(np.mean(predictions)),
                "std": float(np.std(predictions)),
                "unique_values": len(np.unique(predictions))
            }
            stats = summary["prediction_types"]["numeric"]
            summary["insights"].append(f"Predicted outputs range from {stats['min']:.2f} to {stats['max']:.2f}, averaging {stats['mean']:.2f}.")
            if stats["std"] > (stats["max"] - stats["min"]) * 0.25:
                summary["insights"].append("Note: High variance detected in predictions. Outputs show a wide range of variation.")
            else:
                summary["insights"].append("Note: Low variance detected. Predictions are concentrated around the average.")
        else:  # categorical
            unique_vals, counts = np.unique(predictions, return_counts=True)
            summary["prediction_types"]["categorical"] = {
                "unique_values": len(unique_vals),
                "most_common": str(unique_vals[np.argmax(counts)]),
                "distribution": dict(zip(unique_vals.astype(str).tolist(), counts.tolist()))
            }
            stats = summary["prediction_types"]["categorical"]
            summary["insights"].append(f"Class distribution highlights '{stats['most_common']}' as the dominant predicted category.")
            # check imbalance
            dist = stats["distribution"]
            total = len(predictions)
            max_pct = (dist[stats["most_common"]] / total) * 100
            if max_pct > 70:
                summary["insights"].append(f"Imbalance warning: '{stats['most_common']}' constitutes {max_pct:.1f}% of all outputs.")
            else:
                summary["insights"].append("Distribution balance: Predicted categories are relatively well-distributed.")

        return summary

    @staticmethod
    def explain_predictions(
        model_meta,
        datasets: list,
        input_data: List[Dict[str, Any]],
        method: str = "shap"
    ) -> Dict[str, Any]:
        """
        Generate explanations for predictions using SHAP or LIME
        """
        try:
            # Load model
            model_file = storage.download_stream(model_meta.storage_key)
            model = pickle.load(model_file)  # type: ignore

            # Prepare input data
            input_df = pd.DataFrame(input_data)

            # Get training data for background (required for SHAP)
            combined_df = MLService._combine_datasets(datasets)
            if 'target' in combined_df.columns:
                combined_df = combined_df.drop(columns=['target'])
            background_data = combined_df.head(min(100, len(combined_df)))  # Use subset for background

            explanations = []
            feature_importance = {}
            fallback_used = False

            if method.lower() == "shap":
                try:
                    import shap

                    # Create explainer based on model type
                    if hasattr(model, 'predict_proba'):
                        explainer = shap.TreeExplainer(model, background_data) if hasattr(model, 'feature_importances_') else shap.KernelExplainer(model.predict_proba, background_data)
                    else:
                        explainer = shap.TreeExplainer(model, background_data) if hasattr(model, 'feature_importances_') else shap.KernelExplainer(model.predict, background_data)

                    # Calculate SHAP values
                    shap_values = explainer.shap_values(input_df)

                    # Process explanations for each prediction
                    for i, row in enumerate(input_df.iterrows()):
                        row_explanation = {
                            "sample_index": i,
                            "feature_contributions": {}
                        }

                        if isinstance(shap_values, list):  # Multi-class
                            shap_vals = shap_values[0][i] if len(shap_values) > 0 else shap_values[i]
                        else:  # Single output
                            shap_vals = shap_values[i]

                        for j, feature in enumerate(input_df.columns):
                            row_explanation["feature_contributions"][feature] = float(shap_vals[j])

                        explanations.append(row_explanation)

                    # Global feature importance
                    if hasattr(model, 'feature_importances_'):
                        feature_importance = dict(zip(input_df.columns, model.feature_importances_.tolist()))
                    else:
                        # Calculate mean absolute SHAP values
                        mean_shap = np.mean(np.abs(shap_values), axis=0)
                        feature_importance = dict(zip(input_df.columns, mean_shap.tolist()))

                except Exception as ex:
                    print(f"SHAP explainer failed/not installed: {ex}. Falling back to perturbation explainer.")
                    fallback_used = True

            elif method.lower() == "lime":
                try:
                    import lime.lime_tabular

                    # Create LIME explainer
                    explainer = lime.lime_tabular.LimeTabularExplainer(
                        training_data=background_data.values,
                        feature_names=input_df.columns.tolist(),
                        class_names=None,  # Will be inferred
                        mode='regression' if not hasattr(model, 'predict_proba') else 'classification'
                    )

                    # Generate explanations for each prediction
                    for i, row in enumerate(input_df.values):
                        exp = explainer.explain_instance(
                            row,
                            model.predict_proba if hasattr(model, 'predict_proba') else model.predict,
                            num_features=len(input_df.columns)
                        )

                        row_explanation = {
                            "sample_index": i,
                            "feature_contributions": dict(exp.as_list())
                        }
                        explanations.append(row_explanation)

                    # LIME doesn't provide global feature importance easily
                    feature_importance = {}

                except Exception as ex:
                    print(f"LIME explainer failed/not installed: {ex}. Falling back to perturbation explainer.")
                    fallback_used = True

            else:
                fallback_used = True

            if fallback_used:
                # Robust perturbation-based fallback explainer
                if hasattr(model, 'feature_importances_') and model.feature_importances_ is not None:
                    feature_importance = dict(zip(input_df.columns, [float(x) for x in model.feature_importances_.tolist()]))
                elif hasattr(model, 'coef_') and model.coef_ is not None:
                    coefs = np.abs(model.coef_)
                    if coefs.ndim > 1:
                        coefs = np.mean(coefs, axis=0)
                    coefs_sum = coefs.sum() if coefs.sum() > 0 else 1.0
                    feature_importance = dict(zip(input_df.columns, [float(x) for x in (coefs / coefs_sum).tolist()]))
                else:
                    feature_importance = {col: 1.0 / len(input_df.columns) for col in input_df.columns}

                for i in range(len(input_df)):
                    row_explanation = {
                        "sample_index": i,
                        "feature_contributions": {}
                    }
                    sample_row = input_df.iloc[[i]].copy()
                    
                    # Get baseline prediction
                    if hasattr(model, 'predict_proba'):
                        baseline_pred = model.predict_proba(sample_row)[0]
                        if isinstance(baseline_pred, np.ndarray) and len(baseline_pred) > 1:
                            baseline_val = float(baseline_pred[1])
                        else:
                            baseline_val = float(baseline_pred[0] if isinstance(baseline_pred, np.ndarray) else baseline_pred)
                    else:
                        baseline_val = float(model.predict(sample_row)[0])

                    # Perturb each feature locally
                    for col in input_df.columns:
                        std = background_data[col].std() if col in background_data.columns else 0.0
                        if pd.isna(std) or std == 0:
                            std = 1.0
                        
                        val = sample_row[col].values[0]
                        contributions = []
                        if isinstance(val, (int, float, np.integer, np.floating)):
                            for direction in [-1.0, 1.0]:
                                perturbed_row = sample_row.copy()
                                perturbed_row[col] = val + direction * 0.1 * std
                                if hasattr(model, 'predict_proba'):
                                    pred_new = model.predict_proba(perturbed_row)[0]
                                    if isinstance(pred_new, np.ndarray) and len(pred_new) > 1:
                                        new_val = float(pred_new[1])
                                    else:
                                        new_val = float(pred_new[0] if isinstance(pred_new, np.ndarray) else pred_new)
                                else:
                                    new_val = float(model.predict(perturbed_row)[0])
                                contributions.append(new_val - baseline_val)
                            avg_change = float(np.mean(contributions))
                        else:
                            # Categorical swapping
                            perturbed_row = sample_row.copy()
                            if col in background_data.columns:
                                mode_val = background_data[col].mode().values[0]
                                if mode_val == val and len(background_data[col].unique()) > 1:
                                    uniq = background_data[col].unique()
                                    perturbed_row[col] = uniq[1] if uniq[0] == val else uniq[0]
                                else:
                                    perturbed_row[col] = mode_val
                            else:
                                perturbed_row[col] = val

                            if hasattr(model, 'predict_proba'):
                                pred_new = model.predict_proba(perturbed_row)[0]
                                if isinstance(pred_new, np.ndarray) and len(pred_new) > 1:
                                    new_val = float(pred_new[1])
                                else:
                                    new_val = float(pred_new[0] if isinstance(pred_new, np.ndarray) else pred_new)
                            else:
                                new_val = float(model.predict(perturbed_row)[0])
                            avg_change = float(new_val - baseline_val)

                        row_explanation["feature_contributions"][col] = avg_change

                    explanations.append(row_explanation)

            return {
                "explanations": explanations,
                "feature_importance": feature_importance,
                "method": method if not fallback_used else "fallback_perturbation"
            }

        except Exception as e:
            raise ValueError(f"Failed to generate explanations: {str(e)}")

    @staticmethod
    def calculate_advanced_metrics(
        project_id: str,
        user_id: str,
        db: Session,
        model_id: str,
        task_type: str,
        target_column: str
    ) -> Dict[str, Any]:
        """
        Calculate advanced evaluation metrics including confusion matrix, ROC curves, etc.
        """
        # Get model metadata
        model_meta = db.query(ModelMeta).join(Run).filter(
            ModelMeta.id == model_id,
            Run.project_id == project_id
        ).first()

        if not model_meta:
            raise ValueError("Model not found")

        # Get project datasets
        datasets = db.query(Dataset).join(ProjectDataset).filter(
            ProjectDataset.project_id == project_id,
            Dataset.user_id == user_id
        ).all()

        if not datasets:
            raise ValueError("No datasets found for this project")

        # Load model
        try:
            model_file = storage.download_stream(model_meta.storage_key)
            model = pickle.load(model_file)
        except Exception as e:
            raise ValueError(f"Failed to load model: {str(e)}")

        # Prepare data
        combined_df = MLService._combine_datasets(datasets)
        X, y, feature_names = MLService._prepare_data(combined_df, target_column, task_type)

        # Split data (using same random state for consistency)
        _, X_test, _, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        # Make predictions
        y_pred = model.predict(X_test)  # type: ignore

        advanced_metrics = {}

        if task_type in ['binary_classification', 'multiclass_classification']:
            # Confusion Matrix
            cm = confusion_matrix(y_test, y_pred)
            advanced_metrics['confusion_matrix'] = cm.tolist()

            # For binary classification, add ROC curve
            if task_type == 'binary_classification' and hasattr(model, 'predict_proba'):
                try:
                    y_prob = model.predict_proba(X_test)[:, 1]
                    fpr, tpr, _ = roc_curve(y_test, y_prob)
                    roc_auc = auc(fpr, tpr)

                    advanced_metrics['roc_curve'] = {
                        'fpr': fpr.tolist(),
                        'tpr': tpr.tolist(),
                        'auc': float(roc_auc)
                    }

                    # Precision-Recall curve
                    precision, recall, _ = precision_recall_curve(y_test, y_prob)
                    advanced_metrics['precision_recall_curve'] = {
                        'precision': precision.tolist(),
                        'recall': recall.tolist()
                    }
                except Exception as e:
                    print(f"Failed to calculate ROC/PR curves: {e}")

        # Feature importance for tree-based models
        if hasattr(model, 'feature_importances_'):
            feature_importance = model.feature_importances_
            # Sort by importance
            sorted_idx = np.argsort(feature_importance)[::-1]
            advanced_metrics['feature_importance'] = {
                'features': feature_names[sorted_idx].tolist(),
                'importance': feature_importance[sorted_idx].tolist()
            }

        # Update model metadata with advanced metrics
        if model_meta.metrics_json is None:
            model_meta.metrics_json = {}

        model_meta.metrics_json.update({
            'advanced_metrics': advanced_metrics,
            'calculated_at': str(func.now())
        })

        db.commit()

        return {
            'model_id': model_id,
            'advanced_metrics': advanced_metrics
        }
