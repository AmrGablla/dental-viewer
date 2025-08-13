from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from typing import Optional


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    done = "done"
    error = "error"


@dataclass
class JobInfo:
    job_id: str
    status: JobStatus
    progress: int
    started_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    message: Optional[str] = None
    engine: str = "simple"

    def dict(self):
        return asdict(self)
