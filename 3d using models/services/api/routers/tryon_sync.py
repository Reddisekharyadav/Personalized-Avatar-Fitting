from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid
import sys

router = APIRouter(prefix="/tryon")

# Add ML service to path so we can import worker functions
ML_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'ml'))
if ML_PATH not in sys.path:
    sys.path.insert(0, ML_PATH)


def _collect_model_paths_from_env() -> dict:
    """Collect SMPL-X model paths from environment variables if available.
    Returns a dict with keys male/female/neutral when all are present and exist; otherwise returns {}.
    """
    male = os.environ.get("SMPLX_MALE_PATH")
    female = os.environ.get("SMPLX_FEMALE_PATH")
    neutral = os.environ.get("SMPLX_NEUTRAL_PATH")
    if male and female and neutral and all(os.path.isfile(p) for p in [male, female, neutral]):
        return {"male": male, "female": female, "neutral": neutral}
    return {}


@router.post("")
async def tryon(file: UploadFile = File(...)):
    """Accept an uploaded image, process it synchronously with ML worker, and return result.

    Returns the generated avatar file info and metadata immediately (no task queue).
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

    # Import ML worker functions
    try:
        # Prefer explicit package import if available
        try:
            from ml.worker import process_user_image, process_user_image_3d_auto_gender
        except Exception:
            # Fall back to plain worker import (may work when ML_PATH inserted into sys.path)
            from worker import process_user_image, process_user_image_3d_auto_gender
    except Exception:
        # Last resort: try to load worker.py directly from ML_PATH
        import importlib.util
        worker_path = os.path.join(ML_PATH, "worker.py")
        if os.path.isfile(worker_path):
            spec = importlib.util.spec_from_file_location("worker", worker_path)
            worker = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(worker)
            process_user_image = getattr(worker, "process_user_image")
            process_user_image_3d_auto_gender = getattr(worker, "process_user_image_3d_auto_gender")
        else:
            raise HTTPException(status_code=500, detail=f"ML worker not available: attempted ml.worker, worker, and {worker_path}")

    # Collect model paths from environment
    model_paths = _collect_model_paths_from_env()
    
    try:
        # Run ML processing synchronously
        if model_paths:
            print(f"[tryon_sync] Running 3D pipeline for: {filepath}")
            out = process_user_image_3d_auto_gender(filepath, model_paths)
            result = {
                "mode": "3d",
                "obj_path": out.get("avatar_obj"),
                "gender": out.get("gender"),
                "measurements": out.get("body_measurements"),
                "face_landmarks": out.get("face_landmarks", False),
            }
        else:
            print(f"[tryon_sync] 3D models not configured; running 2D fallback for: {filepath}")
            out = process_user_image(filepath)
            result = {
                "mode": "2d",
                "avatar_png": out.get("avatar_path"),
            }

        # Also return a basename and a simple file_url hint (served by API /files mount)
        file_key = "obj_path" if result.get("obj_path") else "avatar_png"
        basename = os.path.basename(result.get(file_key) or "")
        result["basename"] = basename
        # The API will serve uploads under /files; client can GET /files/{basename}
        result["file_url"] = f"/files/{basename}" if basename else None
        result["status"] = "SUCCESS"
        print(f"[tryon_sync] Result mode={result.get('mode')} file={basename}")
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"ML processing failed: {e}")
