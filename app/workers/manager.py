import asyncio
import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Dict

from ..engines import ModelNotAvailable, get_engine
from ..schemas.job import JobInfo, JobStatus
from ..utils.ids import new_id
from ..utils.paths import job_dir


class JobManager:
    def __init__(self) -> None:
        self.jobs: Dict[str, JobInfo] = {}

    def create(self, engine: str) -> JobInfo:
        jid = new_id()
        job = JobInfo(job_id=jid, status=JobStatus.queued, progress=0, engine=engine)
        self.jobs[jid] = job
        return job

    async def run(self, job: JobInfo, mesh_path: Path, params: Dict) -> None:
        job.status = JobStatus.running
        job.started_at = datetime.utcnow()
        out = job_dir(job.job_id)
        try:
            engine = get_engine(job.engine)
            await asyncio.to_thread(engine.segment, mesh_path, out, params)
            job.status = JobStatus.done
        except ModelNotAvailable as e:
            job.status = JobStatus.error
            job.message = str(e)
        except Exception as exc:  # pragma: no cover
            job.status = JobStatus.error
            job.message = str(exc)
        finally:
            job.progress = 100
            job.updated_at = datetime.utcnow()

    def get(self, job_id: str) -> JobInfo | None:
        return self.jobs.get(job_id)

    def result_zip(self, job_id: str) -> BytesIO:
        out = job_dir(job_id)
        mem = BytesIO()
        with zipfile.ZipFile(mem, "w") as zf:
            for path in out.rglob("*"):
                if path.is_file():
                    zf.write(path, arcname=path.relative_to(out))
        mem.seek(0)
        return mem


job_manager = JobManager()
