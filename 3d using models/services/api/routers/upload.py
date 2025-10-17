from fastapi import APIRouter

router = APIRouter(prefix="/uploads")

@router.get("/presign")
def presign():
    # ...existing code...
    return {"url": "https://s3.example.com/upload", "key": "raw_uploads/uuid.jpg"}
