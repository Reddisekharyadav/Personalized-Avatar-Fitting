from fastapi import APIRouter

router = APIRouter(prefix="/tryon")

@router.post("")
def tryon():
    # ...existing code...
    return {"preview_urls": ["https://s3.example.com/previews/uuid.png"], "layers": []}

@router.get("/{id}")
def get_tryon(id: str):
    # ...existing code...
    return {"preview_urls": ["https://s3.example.com/previews/uuid.png"], "layers": []}
