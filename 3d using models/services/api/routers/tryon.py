from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
from fastapi import BackgroundTasks

router = APIRouter(prefix="/tryon")

# Use the same broker default as the ML service
BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', BROKER_URL)


def get_celery():
    """Lazily import and return a Celery instance. Raises ImportError if Celery
    is not installed so uvicorn can start even when celery isn't available.
    """
    from celery import Celery  # will raise ImportError if missing
    return Celery(broker=BROKER_URL, backend=RESULT_BACKEND)


@router.post("")
async def tryon(file: UploadFile = File(...)):
    """Accept an uploaded image, save it locally and enqueue the ML task.

    Returns the Celery task id that can be polled for status.
    """
    uploads_dir = os.path.join(os.getcwd(), 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex}_{file.filename}"
    filepath = os.path.join(uploads_dir, filename)
    try:
        contents = await file.read()
        # prefer aiofiles for non-blocking write if available
        try:
            import aiofiles
            async with aiofiles.open(filepath, 'wb') as f:
                await f.write(contents)
        except Exception:
            # fallback to blocking write
            with open(filepath, 'wb') as f:
                f.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to save upload: {e}")

    # Enqueue the ML task (task name used by services.ml.tasks)
    try:
        celery = get_celery()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Celery not available: {e}")

    # Collect model paths from environment if present, pass to task as kwargs
    model_paths = {
        "male": os.environ.get("SMPLX_MALE_PATH"),
        "female": os.environ.get("SMPLX_FEMALE_PATH"),
        "neutral": os.environ.get("SMPLX_NEUTRAL_PATH"),
    }
    # Remove Nones to avoid serialization issues
    model_paths = {k: v for k, v in model_paths.items() if v}

    try:
        async_result = celery.send_task(
            'services.ml.tasks.generate_avatar_task',
            args=[filepath],
            kwargs={"model_paths": model_paths or None},
            queue='ml_queue'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to enqueue task. Is Redis running at {BROKER_URL}? Error: {e}")

    return {"task_id": async_result.id, "status": "scheduled", "file": os.path.basename(filepath)}


@router.get("/status/{task_id}")
def tryon_status(task_id: str):
    """Query task status and (if available) result."""
    try:
        celery = get_celery()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Celery not available: {e}")

    res = celery.AsyncResult(task_id)
    # If result is a dict, surface file_url/basename for convenience
    result = res.result
    if isinstance(result, dict):
        file_url = result.get("file_url")
        basename = result.get("basename")
    else:
        file_url = None
        basename = None
    return {"task_id": task_id, "status": res.status, "result": result, "file_url": file_url, "basename": basename}
