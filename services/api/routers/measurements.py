from fastapi import APIRouter

router = APIRouter(prefix="/measurements")

@router.post("/{photo_id}/estimate")
def estimate(photo_id: str):
    # ...existing code...
    return {"measurement_bundle_id": "uuid"}
