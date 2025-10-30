from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from routers import auth, upload, photos, measurements, avatars, garments, tryon_sync as tryon

app = FastAPI()

# Explicit dev origins (wildcard cannot be used with allow_credentials=True)
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
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

# Optional: handle favicon to avoid 404 noise in logs
@app.get('/favicon.ico')
async def favicon():
    return Response(status_code=204)

# Serve generated files (uploads and results) so the frontend can fetch them by basename
uploads_dir = os.path.join(os.getcwd(), 'uploads')
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/files", StaticFiles(directory=uploads_dir), name="files")
