import json
from pathlib import Path
from typing import Dict

from .base import SegmentationEngine


class SimpleSeg(SegmentationEngine):
    def segment(self, mesh_path: Path, out_dir: Path, params: Dict) -> Dict:
        per_tooth = out_dir / "per_tooth"
        per_tooth.mkdir(exist_ok=True)
        data = mesh_path.read_bytes()
        (per_tooth / "01.stl").write_bytes(data)
        preview = out_dir / f"preview.{params.get('artifacts_format', 'glb')}"
        preview.write_bytes(b"preview")
        text = mesh_path.read_text(errors="ignore")
        count = sum(1 for line in text.splitlines() if line.strip().startswith("facet"))
        labels = " ".join("0" for _ in range(count))
        (out_dir / "labels.npy").write_text(labels)
        report = {"counts": 1}
        (out_dir / "report.json").write_text(json.dumps(report))
        return {"result_dir": out_dir}
