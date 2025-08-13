from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import health, jobs, segment
from .core.config import settings

app = FastAPI(title="Dental Segmentation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(segment.router)
app.include_router(jobs.router)
