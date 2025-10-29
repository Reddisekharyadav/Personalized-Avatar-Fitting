from .celery_app import celery
from .worker import generate_personalized_avatar
import os


@celery.task(name='services.ml.tasks.generate_avatar_task')
def generate_avatar_task(image_path, model_paths=None):
    if model_paths is None:
        model_paths = {}
    result = generate_personalized_avatar(image_path, model_paths)
    # return basename of produced model
    return os.path.basename(result.get('obj_path') or '')
