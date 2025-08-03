import numpy as np
import open3d as o3d
from typing import Dict, List

from .connected_components import extract_connected_components
from .curvature_sampling import segment_by_curvature_and_sampling
from .voxelization import segment_by_voxelization
from .watershed import segment_by_watershed
from .spatial_slice import slice_mesh_into_regions


def segment_mesh(mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
    """Segment mesh using multiple approaches for dental separation."""
    print("Attempting mesh segmentation...")
    triangle_clusters, cluster_n_triangles, _ = mesh.cluster_connected_triangles()
    triangle_clusters = np.asarray(triangle_clusters)
    cluster_n_triangles = np.asarray(cluster_n_triangles)
    print(f"Found {len(cluster_n_triangles)} connected components")
    if len(cluster_n_triangles) > 1:
        segments = extract_connected_components(mesh, triangle_clusters, cluster_n_triangles, config)
        if len(segments) > 0:
            return segments
    print("Connected components failed, trying curvature-based segmentation...")
    return segment_by_curvature_and_sampling(mesh, config)


__all__ = [
    "segment_mesh",
    "extract_connected_components",
    "segment_by_curvature_and_sampling",
    "segment_by_voxelization",
    "segment_by_watershed",
    "slice_mesh_into_regions",
]
