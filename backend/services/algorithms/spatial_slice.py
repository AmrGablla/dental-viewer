import numpy as np
import open3d as o3d
from typing import Dict, List


def slice_mesh_into_regions(mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
    """Slice the mesh into spatial regions using the original geometry."""
    print("Slicing mesh into spatial regions...")
    vertices = np.asarray(mesh.vertices)
    triangles = np.asarray(mesh.triangles)
    segments: List[Dict] = []
    triangle_centers = np.mean(vertices[triangles], axis=1)
    centered = triangle_centers - triangle_centers.mean(axis=0)
    _, singular_values, vh = np.linalg.svd(centered, full_matrices=False)
    components = vh.T
    pca_coords = centered @ components
    order = np.argsort(singular_values)
    arch_idx = order[1]
    side_idx = order[2]
    side_coord = pca_coords[:, side_idx]
    arch_coord = pca_coords[:, arch_idx]
    side_center = np.median(side_coord)
    arch_type = config.get('arch_type', 'full')
    expected_count = config.get('expected_tooth_count', 28)
    if arch_type == 'full':
        n_arch_regions = max(6, expected_count // 4)
    elif arch_type in ['upper', 'lower']:
        n_arch_regions = max(4, expected_count // 2)
    else:
        n_arch_regions = max(2, expected_count // 3)
    arch_splits = np.linspace(arch_coord.min(), arch_coord.max(), n_arch_regions + 1)
    min_triangles = config.get('min_tooth_size', 50)
    for side in ["left", "right"]:
        for i in range(n_arch_regions):
            arch_start = arch_splits[i]
            arch_end = arch_splits[i + 1]
            if side == "left":
                region_mask = (side_coord <= side_center) & \
                              (arch_coord >= arch_start) & \
                              (arch_coord < arch_end)
            else:
                region_mask = (side_coord > side_center) & \
                              (arch_coord >= arch_start) & \
                              (arch_coord < arch_end)
            if np.sum(region_mask) < min_triangles:
                continue
            region_triangle_indices = np.where(region_mask)[0]
            region_mesh = mesh.select_by_index(region_triangle_indices)
            region_mesh.remove_duplicated_vertices()
            region_mesh.remove_duplicated_triangles()
            region_mesh.remove_degenerate_triangles()
            if len(region_mesh.triangles) >= min_triangles:
                region_mesh.compute_vertex_normals()
                segments.append({
                    "mesh": region_mesh,
                    "method": f"spatial_slice_{side}_{i}"
                })
    print(f"Created {len(segments)} spatial regions")
    return segments
