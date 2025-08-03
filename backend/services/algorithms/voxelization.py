import numpy as np
import open3d as o3d
from typing import Dict, List


def segment_by_voxelization(mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
    """Segment the mesh by converting to a voxel grid and labeling components."""
    print("Attempting voxel-based segmentation...")
    voxel_size = config.get('voxel_size', 0.4)
    min_voxels = config.get('min_voxel_size', 30)
    min_triangles = config.get('min_tooth_size', 50)
    try:
        voxel_grid = o3d.geometry.VoxelGrid.create_from_triangle_mesh(mesh, voxel_size)
    except Exception as e:
        print(f"Voxelization failed: {e}")
        return []
    voxels = voxel_grid.get_voxels()
    if len(voxels) == 0:
        return []
    indices = np.array([v.grid_index for v in voxels])
    min_idx = indices.min(axis=0)
    max_idx = indices.max(axis=0) + 1
    grid_shape = max_idx - min_idx
    volume = np.zeros(grid_shape, dtype=bool)
    for v in voxels:
        volume[tuple(v.grid_index - min_idx)] = True
    from scipy.ndimage import binary_opening, label, generate_binary_structure
    structure = generate_binary_structure(3, 1)
    opened = binary_opening(volume, structure)
    labeled, num_features = label(opened, structure)
    bbox_min = mesh.get_axis_aligned_bounding_box().min_bound
    segments: List[Dict] = []
    for i in range(1, num_features + 1):
        mask = labeled == i
        if np.sum(mask) < min_voxels:
            continue
        coords = np.argwhere(mask) + min_idx
        min_bound = bbox_min + coords.min(axis=0) * voxel_size
        max_bound = bbox_min + (coords.max(axis=0) + 1) * voxel_size
        aabb = o3d.geometry.AxisAlignedBoundingBox(min_bound, max_bound)
        segment_mesh = mesh.crop(aabb)
        segment_mesh.remove_duplicated_vertices()
        segment_mesh.remove_duplicated_triangles()
        segment_mesh.remove_degenerate_triangles()
        if len(segment_mesh.triangles) >= min_triangles:
            segment_mesh.compute_vertex_normals()
            segments.append({
                "mesh": segment_mesh,
                "method": "voxel_cc"
            })
    print(f"Voxel segmentation created {len(segments)} segments")
    return segments
