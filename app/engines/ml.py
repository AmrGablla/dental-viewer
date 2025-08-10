from pathlib import Path
from typing import Dict

from .base import SegmentationEngine


class ModelNotAvailable(Exception):
    pass


class MLSeg(SegmentationEngine):
    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = model_path
        self.model = None
        if model_path and model_path.exists():
            self.model = object()  # placeholder

    def segment(self, mesh_path: Path, out_dir: Path, params: Dict) -> Dict:
        if self.model is None:
            raise ModelNotAvailable("Model file not found")
        raise NotImplementedError("ML segmentation not implemented")
