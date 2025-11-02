from celery import Celery
from app.config import settings

celery_app = Celery(
    "uam_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.workers.tasks"
    ],
)

celery_app.conf.task_routes = {
    "app.workers.tasks.preprocess_data": {"queue": "preprocess"},
    "app.workers.tasks.run_eda": {"queue": "eda"},
    "app.workers.tasks.train_models": {"queue": "train"},
    "app.workers.tasks.finalize_run": {"queue": "finalize"},
}

celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]
celery_app.conf.result_expires = 3600
