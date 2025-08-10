import asyncio
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..schemas.job import JobStatus
from ..workers.manager import job_manager

router = APIRouter(prefix="/jobs")


@router.get("/{job_id}")
async def job_status(job_id: str):
    job = job_manager.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job.dict()


@router.get("/{job_id}/result")
async def job_result(job_id: str):
    job = job_manager.get(job_id)
    if not job or job.status != JobStatus.done:
        raise HTTPException(404, "result not ready")
    mem = job_manager.result_zip(job_id)
    headers = {"Content-Disposition": f"attachment; filename={job_id}.zip"}
    return StreamingResponse(mem, media_type="application/zip", headers=headers)


@router.get("/{job_id}/events")
async def job_events(job_id: str):
    async def event_stream():
        while True:
            job = job_manager.get(job_id)
            if not job:
                break
            yield f"data: {job.progress}\n\n"
            if job.status in {JobStatus.done, JobStatus.error}:
                break
            await asyncio.sleep(1)
    return StreamingResponse(event_stream(), media_type="text/event-stream")
