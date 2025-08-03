"""Dental segmentation service using Open3D for STL file processing."""

import os
import uuid
import shutil
import tempfile
from typing import Dict, List, Optional

import numpy as np
import open3d as o3d

from ..config import settings
from .config_utils import apply_user_config
from .mesh_utils import load_mesh, sample_mesh
from .algorithms import segment_mesh


class SegmentationResult:
    """Container for segmentation results."""

    def __init__(self, session_id: str, output_dir: str, segments: List[Dict]):
        self.session_id = session_id
        self.output_dir = output_dir
        self.segments = segments

    def to_dict(self) -> Dict:
        return {
            "session_id": self.session_id,
            "segments_count": len(self.segments),
            "segments": self.segments,
        }


class DentalSegmentationService:
    """Service for segmenting dental STL files into individual teeth."""

    def __init__(self):
        self.active_sessions: Dict[str, str] = {}

    def segment_stl_file(self, file_path: str, filename: str, user_config: Dict | None = None) -> SegmentationResult:
        """Segment an STL file into individual teeth using various strategies."""
        try:
            session_id = str(uuid.uuid4())
            config = apply_user_config(user_config or {})
            print(f"Using configuration: {config}")
            mesh = load_mesh(file_path)
            processed_mesh = sample_mesh(mesh)
            segments_data = segment_mesh(processed_mesh, config)
            output_dir = self._create_output_directory(session_id)
            segments = self._export_mesh_segments(segments_data, output_dir, session_id)
            self.active_sessions[session_id] = output_dir
            return SegmentationResult(session_id, output_dir, segments)
        except Exception as e:
            raise Exception(f"Segmentation failed: {str(e)}")

    def _export_mesh_segments(self, segments: List[Dict], output_dir: str, session_id: str) -> List[Dict]:
        """Export each mesh segment as a separate STL file."""
        segment_info_list: List[Dict] = []
        print(f"Exporting {len(segments)} mesh segments...")
        for i, segment_data in enumerate(segments):
            segment_mesh = segment_data["mesh"]
            method = segment_data["method"]
            tooth_number = i + 1
            filename = f"tooth_{tooth_number:02d}_{method}.stl"
            file_path = os.path.join(output_dir, filename)
            success = o3d.io.write_triangle_mesh(file_path, segment_mesh)
            if not success:
                print(f"Warning: Failed to save segment {i}")
                continue
            vertices = np.asarray(segment_mesh.vertices)
            bbox = segment_mesh.get_axis_aligned_bounding_box()
            center = vertices.mean(axis=0)
            volume = bbox.volume()
            tooth_type = self._classify_tooth_type(center, volume)
            segment_info = {
                "id": i,
                "tooth_number": tooth_number,
                "tooth_type": tooth_type,
                "method": method,
                "filename": filename,
                "vertex_count": len(vertices),
                "triangle_count": len(segment_mesh.triangles),
                "center": center.tolist(),
                "volume": float(volume),
                "bounding_box": {
                    "min": bbox.min_bound.tolist(),
                    "max": bbox.max_bound.tolist(),
                },
                "download_url": f"/download/{session_id}/{filename}",
            }
            segment_info_list.append(segment_info)
        print(f"Successfully exported {len(segment_info_list)} segments")
        return segment_info_list

    def _create_output_directory(self, session_id: str) -> str:
        output_dir = os.path.join(tempfile.gettempdir(), f"dental_segments_{session_id}")
        os.makedirs(output_dir, exist_ok=True)
        return output_dir

    def _classify_tooth_type(self, center: np.ndarray, volume: float) -> str:
        if volume > 50:
            return "molar"
        elif volume > 25:
            return "premolar"
        elif volume > 15:
            return "canine"
        return "incisor"

    def get_session_info(self, session_id: str) -> Optional[Dict]:
        if session_id not in self.active_sessions:
            return None
        output_dir = self.active_sessions[session_id]
        segment_files: List[Dict] = []
        if os.path.exists(output_dir):
            for filename in os.listdir(output_dir):
                if filename.endswith('.stl'):
                    file_path = os.path.join(output_dir, filename)
                    file_size = os.path.getsize(file_path)
                    segment_files.append({
                        "filename": filename,
                        "size": file_size,
                        "download_url": f"/download/{session_id}/{filename}",
                    })
        return {
            "session_id": session_id,
            "output_directory": output_dir,
            "segments": segment_files,
        }

    def cleanup_session(self, session_id: str) -> bool:
        if session_id not in self.active_sessions:
            return False
        output_dir = self.active_sessions[session_id]
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)
        del self.active_sessions[session_id]
        return True

    def get_file_path(self, session_id: str, filename: str) -> Optional[str]:
        if session_id not in self.active_sessions:
            return None
        output_dir = self.active_sessions[session_id]
        file_path = os.path.join(output_dir, filename)
        if os.path.exists(file_path):
            return file_path
        return None
