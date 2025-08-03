import numpy as np
import open3d as o3d
from typing import Dict, List


def extract_connected_components(mesh: o3d.geometry.TriangleMesh,
                                 triangle_clusters: np.ndarray,
                                 cluster_n_triangles: np.ndarray,
                                 config: Dict) -> List[Dict]:
    """Extract valid connected components as segments."""
    segments: List[Dict] = []
    min_triangles = config.get('min_tooth_size', 50)
    max_triangles = len(mesh.triangles) // 3
    for i, n_triangles in enumerate(cluster_n_triangles):
        if min_triangles <= n_triangles <= max_triangles:
            cluster_triangles = triangle_clusters == i
            segment_mesh = mesh.select_by_index(np.where(cluster_triangles)[0])
            segment_mesh.remove_duplicated_vertices()
            segment_mesh.remove_duplicated_triangles()
            segment_mesh.compute_vertex_normals()
            if len(segment_mesh.triangles) >= min_triangles:
                segments.append({
                    "mesh": segment_mesh,
                    "method": "connected_components"
                })
    return segments
