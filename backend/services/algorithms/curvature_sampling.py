import numpy as np
import open3d as o3d
from typing import Dict, List

from config import settings
from .voxelization import segment_by_voxelization
from .watershed import segment_by_watershed
from .spatial_slice import slice_mesh_into_regions


def segment_by_curvature_and_sampling(mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
    """Segment using point sampling and clustering but keep original mesh geometry."""
    print("Using point cloud clustering with mesh preservation...")
    sample_count = config.get('point_cloud_samples', settings.POINT_CLOUD_SAMPLES)
    point_cloud = mesh.sample_points_uniformly(sample_count)
    if len(point_cloud.points) == 0:
        raise Exception("Failed to sample points from mesh")
    point_cloud.estimate_normals()
    best_segments: List[Dict] = []
    best_count = 0
    eps_range = config.get('clustering_eps_range', [0.8, 1.0, 1.2, 1.5])
    min_points_base = config.get('min_cluster_points', 25)
    expected_count = config.get('expected_tooth_count', 28)
    clustering_params = [
        {"eps": eps, "min_points": min_points_base + i * 5}
        for i, eps in enumerate(eps_range)
    ]
    for params in clustering_params:
        try:
            labels = np.array(point_cloud.cluster_dbscan(
                eps=params["eps"],
                min_points=params["min_points"]
            ))
            segments = map_clusters_to_original_mesh(mesh, point_cloud, labels, config)
            score = score_segmentation_result(segments, expected_count)
            if score > best_count:
                best_segments = segments
                best_count = score
                print(f"Found {len(segments)} segments with eps={params['eps']}, score={score:.2f}")
        except Exception as e:
            print(f"Clustering failed with {params}: {e}")
            continue
    if len(best_segments) == 0:
        print("Clustering failed, attempting voxel-based segmentation...")
        best_segments = segment_by_voxelization(mesh, config)
    if len(best_segments) == 0:
        print("Voxel segmentation failed, attempting watershed segmentation...")
        best_segments = segment_by_watershed(mesh, config)
    if len(best_segments) == 0:
        print("Watershed segmentation failed, slicing mesh into regions...")
        best_segments = slice_mesh_into_regions(mesh, config)
    return best_segments


def score_segmentation_result(segments: List[Dict], expected_count: int) -> float:
    """Score segmentation result based on expected tooth count and quality."""
    if len(segments) == 0:
        return 0.0
    count_score = 1.0 - abs(len(segments) - expected_count) / expected_count
    count_score = max(0.0, count_score)
    sizes = [len(np.asarray(seg["mesh"].triangles)) for seg in segments]
    size_variance = np.var(sizes) / np.mean(sizes) if len(sizes) > 1 else 0
    quality_score = 1.0 / (1.0 + size_variance)
    return count_score * 0.7 + quality_score * 0.3


def map_clusters_to_original_mesh(mesh: o3d.geometry.TriangleMesh,
                                  point_cloud: o3d.geometry.PointCloud,
                                  labels: np.ndarray,
                                  config: Dict) -> List[Dict]:
    """Map point cloud clusters back to original mesh triangles."""
    segments: List[Dict] = []
    max_label = labels.max()
    if max_label < 0:
        return segments
    mesh_vertices = np.asarray(mesh.vertices)
    mesh_triangles = np.asarray(mesh.triangles)
    sampled_points = np.asarray(point_cloud.points)
    from sklearn.neighbors import NearestNeighbors
    nn = NearestNeighbors(n_neighbors=1)
    nn.fit(mesh_vertices)
    _, vertex_indices = nn.kneighbors(sampled_points)
    vertex_indices = vertex_indices.flatten()
    min_cluster_size = config.get('min_tooth_size', 50)
    for cluster_id in range(max_label + 1):
        cluster_mask = labels == cluster_id
        if np.sum(cluster_mask) < 20:
            continue
        cluster_vertex_indices = vertex_indices[cluster_mask]
        cluster_vertex_set = set(cluster_vertex_indices)
        triangle_mask = np.array([
            len(set(triangle) & cluster_vertex_set) >= 2
            for triangle in mesh_triangles
        ])
        if np.sum(triangle_mask) < 10:
            continue
        triangle_indices = np.where(triangle_mask)[0]
        segment_mesh = mesh.select_by_index(triangle_indices)
        segment_mesh.remove_duplicated_vertices()
        segment_mesh.remove_duplicated_triangles()
        segment_mesh.remove_degenerate_triangles()
        if len(segment_mesh.triangles) >= min_cluster_size:
            segment_mesh.compute_vertex_normals()
            segments.append({
                "mesh": segment_mesh,
                "method": "mesh_mapped_clustering"
            })
    return segments
