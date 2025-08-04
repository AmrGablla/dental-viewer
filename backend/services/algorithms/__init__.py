import numpy as np
import open3d as o3d
from typing import Dict, List

from .connected_components import extract_connected_components
from .curvature_sampling import segment_by_curvature_and_sampling
from .voxelization import segment_by_voxelization
from .watershed import segment_by_watershed
from .spatial_slice import slice_mesh_into_regions
from .gum_segmentation import split_gum_and_teeth


def segment_mesh(mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
    """Segment mesh into gums and individual teeth."""
    print("Attempting mesh segmentation...")

    segments: List[Dict] = []

    # First separate gums from teeth
    gum_mesh, teeth_mesh = split_gum_and_teeth(mesh, config)
    if len(gum_mesh.triangles) > 0:
        segments.append({"mesh": gum_mesh, "method": "gum"})

    # Perform tooth segmentation on the remaining mesh
    triangle_clusters, cluster_n_triangles, _ = teeth_mesh.cluster_connected_triangles()
    triangle_clusters = np.asarray(triangle_clusters)
    cluster_n_triangles = np.asarray(cluster_n_triangles)
    print(f"Found {len(cluster_n_triangles)} connected components in teeth mesh")
    if len(cluster_n_triangles) > 1:
        tooth_segments = extract_connected_components(teeth_mesh, triangle_clusters, cluster_n_triangles, config)
        if len(tooth_segments) > 0:
            segments.extend(tooth_segments)
            return segments
    print("Connected components failed, trying curvature-based segmentation...")
    tooth_segments = segment_by_curvature_and_sampling(teeth_mesh, config)
    segments.extend(tooth_segments)
    return segments


__all__ = [
    "segment_mesh",
    "extract_connected_components",
    "segment_by_curvature_and_sampling",
    "segment_by_voxelization",
    "segment_by_watershed",
    "slice_mesh_into_regions",
    "split_gum_and_teeth",
]
