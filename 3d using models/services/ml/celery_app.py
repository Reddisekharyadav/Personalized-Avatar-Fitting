import os
from celery import Celery

BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', BROKER_URL)

celery = Celery('ml_tasks', broker=BROKER_URL, backend=RESULT_BACKEND)
celery.conf.task_routes = {'services.ml.tasks.generate_avatar_task': {'queue': 'ml_queue'}}
