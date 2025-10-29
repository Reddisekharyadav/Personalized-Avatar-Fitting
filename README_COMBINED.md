# VirtualDressing — Combined README

This repository contains multiple approaches and services for a virtual dressing / avatar fitting project. The top-level folders of interest are:

- `2d` — Scripts and models for 2D try-on workflows (image segmentation, overlaying clothing on images).
- `3d apis` — Backend and frontend services (Node/Next.js) for serving 3D models, avatar viewers, and related APIs.
- `3d using models` — Additional 3D model experiments, tools and services (may include Python/Node mix).

This combined README summarizes what each folder contains and includes quick run/development notes.

---

## 2d

Location: `2d/`

Contains scripts for downloading clothing images, segmenting clothing using a U2Net model, and overlaying garments on portrait images.

Key files:
- `download_clothing_image.py` — helper to fetch clothing images.
- `segment_clothing_u2net.py` — runs U2Net segmentation (model weights in `2d/model/`).
- `overlay_clothing_test.py` — example overlay script.
- `model/` — pre-trained U2Net weights (`u2net.pth`, `u2net_portrait.pth`).

Quick start (Python 3.11 recommended):

1. Create and activate a virtual environment:

   python -m venv .venv
   # Windows PowerShell
   .\.venv\Scripts\Activate.ps1

2. Install requirements if provided (or install typical packages):

   pip install -r requirements.txt

3. Run example segmentation/overlay scripts:

   python 2d/segment_clothing_u2net.py
   python 2d/overlay_clothing_test.py

Notes:
- Model weights are stored in `2d/model/`. Do not commit large model files to the repo unless necessary; use external storage and update the README with download links.

---

## 3d apis

Location: `3d apis/`

Contains a Node.js backend for serving avatar/model resources and a Next.js frontend for viewing avatars and outfits.

Key subfolders:
- `backend/` — Express/Node services and API routes. Includes scripts for converting, caching and preparing models.
- `frontend/` — Next.js app with components like `ModelViewer.jsx`, `AvatarViewer.jsx`, and pages for try-on and wardrobe.

Quick start (Node 18+ recommended):

1. Install dependencies for backend and frontend separately:

   cd "3d apis/backend"; npm install
   cd "3d apis/frontend"; npm install

2. Start backend (example):

   cd "3d apis/backend"; npm run start

3. Start frontend in dev mode (example):

   cd "3d apis/frontend"; npm run dev

Notes:
- Check `3d apis/backend/scripts/` for model conversion utilities. Many operations create large caches under `3d apis/backend/cache/` and `model-cache/`.
- Keep binary caches out of git. Use .gitignore (added) to exclude `cache/`, `uploads/`, `model-cache/`, and `backend/avatars/*-cached`.

---

## 3d using models

Location: `3d using models/`

Contains experimental apps and services that use 3D models, including a Python FastAPI service example under `services/api`.

Quick start (Python 3.11 for FastAPI parts; Node for other parts):

1. For the FastAPI service under `3d using models/services/api`:

   cd "3d using models/services/api"
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

2. For any Node/JS apps under `3d using models/apps` or similar, follow `package.json` scripts.

Notes:
- The included Dockerfile (in `services/api`) installs dependencies with `pip install -r requirements.txt`. When building Docker images, ensure large model files are excluded or downloaded at runtime.

---

## Contributing

- Use the per-folder `.gitignore` files to avoid committing model weights, caches, node_modules, and other large artifacts. Each of the three top folders has a `.gitignore` added in this commit.
- When adding models, prefer storing them in external storage (S3, GDrive) and provide download scripts.

---

## Contact

If you need help integrating the components or preparing a deployment (Docker, Azure, etc.), open an issue or message the maintainer.
