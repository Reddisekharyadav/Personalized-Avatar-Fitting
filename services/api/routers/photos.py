from fastapi import APIRouter

router = APIRouter(prefix="/photos")

@router.post("")
def create_photo():
    # ...existing code...
    return {"photo_id": "uuid"}

@router.get("/{id}")
def get_photo(id: str):
    # ...existing code...
    return {"status": "processed", "pose_score": 0.95, "masks": []}
