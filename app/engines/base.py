from abc import ABC, abstractmethod
from pathlib import Path
from typing import Dict

class SegmentationEngine(ABC):
    @abstractmethod
    def segment(self, mesh_path: Path, out_dir: Path, params: Dict) -> Dict:
        """Process mesh and write artifacts to out_dir."""
