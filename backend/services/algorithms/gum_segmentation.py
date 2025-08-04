import numpy as np
import open3d as o3d
from typing import Dict, Tuple


def split_gum_and_teeth(mesh: o3d.geometry.TriangleMesh, config: Dict) -> Tuple[o3d.geometry.TriangleMesh, o3d.geometry.TriangleMesh]:
    """Separate gums from teeth using a simple height threshold.

    The function estimates the vertical axis using PCA, then classifies
    triangles below a certain height percentile as gums and the rest as teeth.
    """
    print("Separating gums from teeth...")
    vertices = np.asarray(mesh.vertices)
    triangles = np.asarray(mesh.triangles)
    if len(vertices) == 0 or len(triangles) == 0:
        return mesh, o3d.geometry.TriangleMesh()

    # Estimate vertical axis using PCA
    centered = vertices - vertices.mean(axis=0)
    _, _, vh = np.linalg.svd(centered, full_matrices=False)
    vertical_axis = vh[2]

    # Project vertices onto vertical axis to get relative heights
    heights = centered @ vertical_axis
    percentile = config.get("gum_height_percentile", 25)
    threshold = np.percentile(heights, percentile)

    # Triangles with all vertices below threshold are considered gum
    mask = np.all(heights[triangles] < threshold, axis=1)
    gum_triangles = np.where(mask)[0]
    teeth_triangles = np.where(~mask)[0]

    gum_mesh = mesh.select_by_index(gum_triangles)
    teeth_mesh = mesh.select_by_index(teeth_triangles)

    for m in [gum_mesh, teeth_mesh]:
        m.remove_duplicated_vertices()
        m.remove_duplicated_triangles()
        m.remove_degenerate_triangles()
        if len(m.triangles) > 0:
            m.compute_vertex_normals()

    return gum_mesh, teeth_mesh
