from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase, relationship
from sqlalchemy import String, Integer, DateTime, Text, Float, JSON, ForeignKey
from sqlalchemy.sql import func
import uuid
from datetime import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="user")  # user or admin
    status: Mapped[str] = mapped_column(String, default="active")  # active or inactive
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    projects: Mapped[list["Project"]] = relationship("Project", back_populates="user")
    datasets: Mapped[list["Dataset"]] = relationship("Dataset", back_populates="user")
    templates: Mapped[list["Template"]] = relationship("Template", back_populates="creator")
    prediction_results: Mapped[list["PredictionResult"]] = relationship("PredictionResult", back_populates="user")
    artifacts: Mapped[list["Artifact"]] = relationship("Artifact", back_populates="user")

from sqlalchemy import ForeignKey

class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="projects")
    runs = relationship("Run", back_populates="project")
    project_datasets = relationship("ProjectDataset", back_populates="project")

class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    rows: Mapped[int | None] = mapped_column(Integer)
    cols: Mapped[int | None] = mapped_column(Integer)
    columns_json: Mapped[dict | None] = mapped_column(JSON)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    validation_status: Mapped[str | None] = mapped_column(String, default="pending")  # pending, valid, issues_found
    last_validated: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    user = relationship("User", back_populates="datasets")
    dataset_versions = relationship("DatasetVersion", back_populates="dataset")
    runs = relationship("Run", back_populates="dataset")
    project_datasets = relationship("ProjectDataset", back_populates="dataset")

class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    dataset_id: Mapped[str] = mapped_column(String, ForeignKey("datasets.id"), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    operation: Mapped[str] = mapped_column(String, nullable=False)  # 'clean', 'transform', etc.
    changes_summary: Mapped[str | None] = mapped_column(Text)
    rows_before: Mapped[int | None] = mapped_column(Integer)
    cols_before: Mapped[int | None] = mapped_column(Integer)
    rows_after: Mapped[int | None] = mapped_column(Integer)
    cols_after: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dataset = relationship("Dataset", back_populates="dataset_versions")

class ProjectDataset(Base):
    __tablename__ = "project_datasets"

    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), primary_key=True)
    dataset_id: Mapped[str] = mapped_column(String, ForeignKey("datasets.id"), primary_key=True)

    # Relationships
    project: Mapped["Project"] = relationship("Project", back_populates="project_datasets")
    dataset: Mapped["Dataset"] = relationship("Dataset", back_populates="project_datasets")

class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id"), nullable=False)
    dataset_id: Mapped[str] = mapped_column(String, ForeignKey("datasets.id"), nullable=False)
    status: Mapped[str] = mapped_column(String, default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    current_task: Mapped[str | None] = mapped_column(String)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    parameters_json: Mapped[dict | None] = mapped_column(JSON)
    progress: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    project = relationship("Project", back_populates="runs")
    dataset = relationship("Dataset", back_populates="runs")
    artifacts = relationship("Artifact", back_populates="run")
    model_metas = relationship("ModelMeta", back_populates="run")
    logs = relationship("Log", back_populates="run")

class Artifact(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String, ForeignKey("runs.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # chart, pdf, model, prediction
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    run = relationship("Run", back_populates="artifacts")
    user = relationship("User", back_populates="artifacts")

class ModelMeta(Base):
    __tablename__ = "model_metas"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String, ForeignKey("runs.id"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    storage_key: Mapped[str] = mapped_column(String, nullable=False)
    metrics_json: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    version: Mapped[str | None] = mapped_column(String)

    # Relationships
    run = relationship("Run", back_populates="model_metas")
    prediction_results = relationship("PredictionResult", back_populates="model")

class Log(Base):
    __tablename__ = "logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(String, ForeignKey("runs.id"), nullable=False)
    level: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    run = relationship("Run", back_populates="logs")

class Template(Base):
    __tablename__ = "templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String, nullable=False)  # e.g., 'analysis', 'model'
    config_json: Mapped[dict | None] = mapped_column(JSON)
    is_public: Mapped[bool] = mapped_column(Integer, default=1)  # 1 for public, 0 for admin only
    created_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    creator = relationship("User", back_populates="templates")

class PredictionResult(Base):
    __tablename__ = "prediction_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    model_id: Mapped[str] = mapped_column(String, ForeignKey("model_metas.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), nullable=False)
    input_data: Mapped[dict | None] = mapped_column(JSON)  # Store input features
    predictions: Mapped[dict | None] = mapped_column(JSON)  # Store prediction results
    summary: Mapped[dict | None] = mapped_column(JSON)  # Store summary statistics
    batch_id: Mapped[str | None] = mapped_column(String)  # For batch predictions
    status: Mapped[str] = mapped_column(String, default="completed")  # completed, failed
    processing_time: Mapped[float | None] = mapped_column(Float)  # in seconds
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model = relationship("ModelMeta", back_populates="prediction_results")
    user = relationship("User", back_populates="prediction_results")
