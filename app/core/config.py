import os
from typing import List


def _get_list(value: str | None) -> List[str]:
    if not value:
        return ["*"]
    return [v.strip() for v in value.split(",") if v.strip()]


class Settings:
    port: int = int(os.getenv("PORT", "8000"))
    cors_origins: List[str] = _get_list(os.getenv("CORS_ORIGINS"))
    max_upload_mb: int = int(os.getenv("MAX_UPLOAD_MB", "200"))
    seg_engine: str = os.getenv("SEG_ENGINE", "simple")
    scheme: str = os.getenv("SCHEME", "universal")
    theta_deg: float = float(os.getenv("THETA_DEG", "45"))
    min_comp_faces: int = int(os.getenv("MIN_COMP_FACES", "10"))
    smooth_iters: int = int(os.getenv("SMOOTH_ITERS", "0"))
    artifacts_format: str = os.getenv("ARTIFACTS_FORMAT", "glb")


settings = Settings()
