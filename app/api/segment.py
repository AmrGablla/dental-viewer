import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, File, UploadFile

from ..core.config import settings
from ..workers.manager import job_manager
from ..utils.paths import job_dir

router = APIRouter()


def choose_engine(engine: Optional[str]) -> str:
    return (engine or settings.seg_engine or "simple").lower()


@router.post("/segment")
async def segment(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    engine: Optional[str] = None,
    scheme: str = settings.scheme,
    sync: int = 0,
) -> dict:
    eng = choose_engine(engine)
    job = job_manager.create(eng)
    target_dir = job_dir(job.job_id)
    input_path = target_dir / "input.stl"
    with open(input_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    params = {
        "theta_deg": settings.theta_deg,
        "min_comp_faces": settings.min_comp_faces,
        "smooth_iters": settings.smooth_iters,
        "artifacts_format": settings.artifacts_format,
    }
    if sync:
        await job_manager.run(job, input_path, params)
    else:
        background.add_task(job_manager.run, job, input_path, params)
    return {
        "job_id": job.job_id,
        "engine": eng,
        "status": job.status,
        "estimate_ms": 0,
    }
