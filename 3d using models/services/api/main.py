from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, upload, photos, measurements, avatars, garments, tryon

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(photos.router)
app.include_router(measurements.router)
app.include_router(avatars.router)
app.include_router(garments.router)
app.include_router(tryon.router)
