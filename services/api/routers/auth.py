from fastapi import APIRouter

router = APIRouter(prefix="/auth")

@router.post("/register")
def register():
    # ...existing code...
    return {"msg": "register endpoint"}

@router.post("/login")
def login():
    # ...existing code...
    return {"msg": "login endpoint"}

@router.post("/refresh")
def refresh():
    # ...existing code...
    return {"msg": "refresh endpoint"}
