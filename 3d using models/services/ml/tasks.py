from .celery_app import celery
from .worker import process_user_image, process_user_image_3d_auto_gender
import os


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


@celery.task(name='services.ml.tasks.generate_avatar_task')
def generate_avatar_task(image_path: str, model_paths: dict | None = None) -> dict:
    """Generate an avatar from the uploaded image.

    Behavior:
    - If SMPL-X model paths are provided (or found in env) and exist, run full 3D pipeline and return an OBJ path and measurements.
    - Otherwise, run a 2D fallback (silhouette) and return a PNG path.

    Returns a result dict including available outputs and metadata.
    """
    try:
        # Prefer provided model_paths; else try env
        effective_models = model_paths or _collect_model_paths_from_env()
        if effective_models:
            print(f"[tasks] Running 3D pipeline for: {image_path}")
            out = process_user_image_3d_auto_gender(image_path, effective_models)
            # Normalize keys for API consumers
            result = {
                "mode": "3d",
                "obj_path": out.get("avatar_obj"),
                "gender": out.get("gender"),
                "measurements": out.get("body_measurements"),
                "face_landmarks": out.get("face_landmarks", False),
            }
        else:
            print(f"[tasks] 3D models not configured; running 2D fallback for: {image_path}")
            out = process_user_image(image_path)
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
        print(f"[tasks] Result mode={result.get('mode')} file={basename}")
        return result
    except Exception as e:
        # Return an error payload; Celery state will still be SUCCESS unless we raise
        return {"error": str(e)}
