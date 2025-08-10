from pathlib import Path

BASE_DIR = Path("data")
BASE_DIR.mkdir(exist_ok=True)


def job_dir(job_id: str) -> Path:
    p = BASE_DIR / job_id
    p.mkdir(parents=True, exist_ok=True)
    return p
