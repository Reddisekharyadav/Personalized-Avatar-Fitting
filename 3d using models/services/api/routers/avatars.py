from fastapi import APIRouter

router = APIRouter(prefix="/avatars")

@router.post("")
def create_avatar():
    # ...existing code...
    return {"avatar_id": "uuid"}

@router.get("/{id}")
def get_avatar(id: str):
    # ...existing code...
    return {"type": "2d", "style": "freefire-like", "preview_url": "https://s3.example.com/avatars/uuid.png"}
