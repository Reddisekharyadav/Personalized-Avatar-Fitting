# Virtual Try-On Avatar Platform

Mono-repo for a full-stack virtual dressing room with Next.js frontend, FastAPI backend, ML service, and infra for local/cloud deployment.

## Structure
- `apps/web`: Next.js frontend
- `services/api`: FastAPI backend
- `services/ml`: Python ML service (Celery)
- `infra`: Docker Compose, Terraform, configs
- `shared`: Shared types/models
