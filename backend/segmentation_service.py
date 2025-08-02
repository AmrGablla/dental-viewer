"""
Dental segmentation service using Open3D for STL file processing
"""

import open3d as o3d
import numpy as np
import tempfile
import os
import uuid
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import shutil

from config import settings


class SegmentationResult:
    """Container for segmentation results"""
    
    def __init__(self, session_id: str, output_dir: str, segments: List[Dict]):
        self.session_id = session_id
        self.output_dir = output_dir
        self.segments = segments
        
    def to_dict(self) -> Dict:
        return {
            "session_id": self.session_id,
            "segments_count": len(self.segments),
            "segments": self.segments
        }


class DentalSegmentationService:
    """Service for segmenting dental STL files into individual teeth"""
    
    def __init__(self):
        self.active_sessions: Dict[str, str] = {}
        
    def segment_stl_file(self, file_path: str, filename: str, user_config: Dict = None) -> SegmentationResult:
        """
        Segment an STL file into individual teeth using enhanced clustering.
        
        Args:
            file_path: Path to the STL file
            filename: Original filename for reference
            user_config: Optional user configuration for segmentation
            
        Returns:
            SegmentationResult containing session info and segment details
            
        Raises:
            Exception: If segmentation fails
        """
        try:
            # Create session ID
            session_id = str(uuid.uuid4())
            
            # Apply user configuration to settings
            config = self._apply_user_config(user_config or {})
            print(f"Using configuration: {config}")
            
            # Load and validate mesh
            mesh = self._load_mesh(file_path)
            
            # Process mesh for segmentation
            processed_mesh = self._sample_points_from_mesh(mesh)
            
            # Perform mesh-based segmentation with configuration
            segments_data = self._segment_mesh_by_connectivity(processed_mesh, config)
            
            # Create output directory
            output_dir = self._create_output_directory(session_id)
            
            # Export segments
            segments = self._export_mesh_segments(segments_data, output_dir, session_id)
            
            # Store session
            self.active_sessions[session_id] = output_dir
            
            return SegmentationResult(session_id, output_dir, segments)
            
        except Exception as e:
            raise Exception(f"Segmentation failed: {str(e)}")
    
    def _apply_user_config(self, user_config: Dict) -> Dict:
        """Apply user configuration to segmentation parameters"""
        config = {
            'arch_type': user_config.get('archType', 'full'),
            'expected_tooth_count': user_config.get('expectedToothCount', 28),
            'tooth_types_present': user_config.get('toothTypesPresent', ['incisors', 'canines', 'premolars', 'molars']),
            'model_quality': user_config.get('modelQuality', 'medium'),
            'separation_level': user_config.get('separationLevel', 'touching'),
            'clustering_sensitivity': user_config.get('clusteringSensitivity', 1.5),
            'min_tooth_size': user_config.get('minToothSize', 100)
        }
        
        # Adjust clustering parameters based on user input
        if config['separation_level'] == 'natural':
            config['clustering_eps_range'] = [0.5, 1.0, 1.5]
        elif config['separation_level'] == 'touching':
            config['clustering_eps_range'] = [0.8, 1.2, 1.8]
        elif config['separation_level'] == 'connected':
            config['clustering_eps_range'] = [1.0, 1.5, 2.0, 2.5]
        
        # Adjust based on model quality
        if config['model_quality'] == 'high':
            config['point_cloud_samples'] = 75000
            config['min_cluster_points'] = 15
        elif config['model_quality'] == 'medium':
            config['point_cloud_samples'] = 50000
            config['min_cluster_points'] = 25
        else:  # low quality
            config['point_cloud_samples'] = 30000
            config['min_cluster_points'] = 35
        
        return config
    
    def _load_mesh(self, file_path: str) -> o3d.geometry.TriangleMesh:
        """Load and validate STL mesh"""
        print(f"Loading STL file: {file_path}")
        
        mesh = o3d.io.read_triangle_mesh(file_path)
        
        if len(mesh.vertices) == 0:
            raise Exception("Invalid STL file or empty mesh")
        
        # Compute normals for better point sampling
        mesh.compute_vertex_normals()
        
        # Optional: Remove duplicated vertices and triangles
        mesh.remove_duplicated_vertices()
        mesh.remove_duplicated_triangles()
        
        print(f"Mesh loaded: {len(mesh.vertices)} vertices, {len(mesh.triangles)} triangles")
        return mesh
    
    def _sample_points_from_mesh(self, mesh: o3d.geometry.TriangleMesh) -> o3d.geometry.TriangleMesh:
        """Keep the original mesh for better segmentation instead of point clouds"""
        print(f"Processing mesh with {len(mesh.vertices)} vertices...")
        
        # Clean the mesh
        mesh.remove_duplicated_vertices()
        mesh.remove_duplicated_triangles()
        mesh.remove_degenerate_triangles()
        mesh.remove_non_manifold_edges()
        
        # Smooth the mesh slightly to reduce noise
        mesh = mesh.filter_smooth_laplacian(number_of_iterations=1)
        
        # Compute normals
        mesh.compute_vertex_normals()
        
        print(f"Processed mesh: {len(mesh.vertices)} vertices, {len(mesh.triangles)} triangles")
        return mesh
    
    def _segment_mesh_by_connectivity(self, mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
        """Segment mesh using multiple approaches for dental separation"""
        print("Attempting mesh segmentation...")
        
        # First try connected components
        triangle_clusters, cluster_n_triangles, cluster_area = mesh.cluster_connected_triangles()
        triangle_clusters = np.asarray(triangle_clusters)
        cluster_n_triangles = np.asarray(cluster_n_triangles)
        
        print(f"Found {len(cluster_n_triangles)} connected components")
        
        # If we have reasonable connected components, use them
        if len(cluster_n_triangles) > 1:
            segments = self._extract_connected_components(mesh, triangle_clusters, cluster_n_triangles, config)
            if len(segments) > 0:
                return segments
        
        print("Connected components failed, trying curvature-based segmentation...")
        
        # Fallback: Use curvature and sampling for segmentation
        return self._segment_by_curvature_and_sampling(mesh, config)
    
    def _extract_connected_components(self, mesh: o3d.geometry.TriangleMesh, 
                                    triangle_clusters: np.ndarray, 
                                    cluster_n_triangles: np.ndarray, 
                                    config: Dict) -> List[Dict]:
        """Extract valid connected components as segments"""
        segments = []
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
    
    def _segment_by_curvature_and_sampling(self, mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
        """Segment using point sampling and clustering but keep original mesh geometry"""
        print("Using point cloud clustering with mesh preservation...")
        
        # Use configured point cloud samples
        sample_count = config.get('point_cloud_samples', settings.POINT_CLOUD_SAMPLES)
        point_cloud = mesh.sample_points_uniformly(sample_count)
        
        if len(point_cloud.points) == 0:
            raise Exception("Failed to sample points from mesh")
        
        # Estimate normals
        point_cloud.estimate_normals()
        
        # Use multiple clustering attempts with configured parameters
        best_segments = []
        best_count = 0
        
        # Use configured clustering parameters
        eps_range = config.get('clustering_eps_range', [0.8, 1.0, 1.2, 1.5])
        min_points_base = config.get('min_cluster_points', 25)
        expected_count = config.get('expected_tooth_count', 28)
        
        clustering_params = [
            {"eps": eps, "min_points": min_points_base + i*5} 
            for i, eps in enumerate(eps_range)
        ]
        
        for params in clustering_params:
            try:
                labels = np.array(point_cloud.cluster_dbscan(
                    eps=params["eps"],
                    min_points=params["min_points"]
                ))
                
                segments = self._map_clusters_to_original_mesh(mesh, point_cloud, labels, config)
                
                # Score based on expected tooth count and user preferences
                score = self._score_segmentation_result(segments, expected_count)
                
                if score > best_count:
                    best_segments = segments
                    best_count = score
                    print(f"Found {len(segments)} segments with eps={params['eps']}, score={score:.2f}")
                    
            except Exception as e:
                print(f"Clustering failed with {params}: {e}")
                continue

        if len(best_segments) == 0:
            # Try voxel-based morphological segmentation before slicing
            print("Clustering failed, attempting voxel-based segmentation...")
            best_segments = self._segment_by_voxelization(mesh, config)

        if len(best_segments) == 0:
            # Try watershed segmentation as an additional strategy
            print("Voxel segmentation failed, attempting watershed segmentation...")
            best_segments = self._segment_by_watershed(mesh, config)

        if len(best_segments) == 0:
            # Final fallback: slice the mesh into regions
            print("Watershed segmentation failed, slicing mesh into regions...")
            best_segments = self._slice_mesh_into_regions(mesh, config)

        return best_segments
    
    def _score_segmentation_result(self, segments: List[Dict], expected_count: int) -> float:
        """Score segmentation result based on expected tooth count and quality"""
        if len(segments) == 0:
            return 0.0
        
        # Base score from number of segments
        count_score = 1.0 - abs(len(segments) - expected_count) / expected_count
        count_score = max(0.0, count_score)
        
        # Quality score based on segment sizes
        sizes = [len(np.asarray(seg["mesh"].triangles)) for seg in segments]
        size_variance = np.var(sizes) / np.mean(sizes) if len(sizes) > 1 else 0
        quality_score = 1.0 / (1.0 + size_variance)  # Lower variance is better
        
        return count_score * 0.7 + quality_score * 0.3
    
    def _map_clusters_to_original_mesh(self, mesh: o3d.geometry.TriangleMesh, 
                                     point_cloud: o3d.geometry.PointCloud, 
                                     labels: np.ndarray, 
                                     config: Dict) -> List[Dict]:
        """Map point cloud clusters back to original mesh triangles"""
        segments = []
        max_label = labels.max()
        
        if max_label < 0:
            return segments
        
        # Get mesh vertices and triangles
        mesh_vertices = np.asarray(mesh.vertices)
        mesh_triangles = np.asarray(mesh.triangles)
        sampled_points = np.asarray(point_cloud.points)
        
        # Build KD-tree for mapping sampled points back to mesh vertices
        from sklearn.neighbors import NearestNeighbors
        nn = NearestNeighbors(n_neighbors=1)
        nn.fit(mesh_vertices)
        
        # Map each sampled point to nearest mesh vertex
        distances, vertex_indices = nn.kneighbors(sampled_points)
        vertex_indices = vertex_indices.flatten()
        
        min_cluster_size = config.get('min_tooth_size', 50)
        
        for cluster_id in range(max_label + 1):
            cluster_mask = labels == cluster_id
            
            if np.sum(cluster_mask) < 20:  # Skip small clusters
                continue
            
            # Get vertices that belong to this cluster
            cluster_vertex_indices = vertex_indices[cluster_mask]
            cluster_vertex_set = set(cluster_vertex_indices)
            
            # Find triangles that have vertices in this cluster
            triangle_mask = np.array([
                len(set(triangle) & cluster_vertex_set) >= 2  # At least 2 vertices in cluster
                for triangle in mesh_triangles
            ])
            
            if np.sum(triangle_mask) < 10:  # Skip if too few triangles
                continue
            
            # Extract mesh segment using triangle indices
            triangle_indices = np.where(triangle_mask)[0]
            segment_mesh = mesh.select_by_index(triangle_indices)
            
            # Clean the segment
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

    def _segment_by_voxelization(self, mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
        """Segment the mesh by converting to a voxel grid and labeling components"""
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
        segments = []

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

    def _segment_by_watershed(self, mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
        """Segment the mesh using a distance transform and watershed algorithm"""
        print("Attempting watershed-based segmentation...")

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

        try:
            from scipy.ndimage import distance_transform_edt, label
            from skimage.feature import peak_local_max
            from skimage.segmentation import watershed
        except Exception as e:
            print(f"Watershed dependencies missing: {e}")
            return []

        distance = distance_transform_edt(volume)
        local_max = peak_local_max(distance, indices=False, min_distance=2, labels=volume)
        markers, _ = label(local_max)
        labels = watershed(-distance, markers, mask=volume)

        bbox_min = mesh.get_axis_aligned_bounding_box().min_bound
        segments = []

        for i in range(1, labels.max() + 1):
            mask = labels == i
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
                    "method": "watershed_voxel"
                })

        print(f"Watershed segmentation created {len(segments)} segments")
        return segments
    
    def _slice_mesh_into_regions(self, mesh: o3d.geometry.TriangleMesh, config: Dict) -> List[Dict]:
        """Slice the mesh into spatial regions using the original geometry"""
        print("Slicing mesh into spatial regions...")
        
        vertices = np.asarray(mesh.vertices)
        triangles = np.asarray(mesh.triangles)
        
        segments = []

        # Calculate triangle centers
        triangle_centers = np.mean(vertices[triangles], axis=1)

        # Use PCA to determine mesh orientation so slicing follows the dental arch
        centered = triangle_centers - triangle_centers.mean(axis=0)
        _, singular_values, vh = np.linalg.svd(centered, full_matrices=False)
        components = vh.T  # principal axes (columns)
        pca_coords = centered @ components

        # Identify vertical, arch and side axes based on spread (singular values)
        # Smallest spread -> vertical axis, largest -> left/right side
        order = np.argsort(singular_values)
        arch_idx = order[1]  # middle spread -> arch front/back
        side_idx = order[2]  # largest spread -> left/right

        side_coord = pca_coords[:, side_idx]
        arch_coord = pca_coords[:, arch_idx]
        side_center = np.median(side_coord)
        
        # Adjust regions based on arch type
        arch_type = config.get('arch_type', 'full')
        expected_count = config.get('expected_tooth_count', 28)
        
        if arch_type == 'full':
            n_arch_regions = max(6, expected_count // 4)  # Divide by quadrants
        elif arch_type in ['upper', 'lower']:
            n_arch_regions = max(4, expected_count // 2)  # Single arch
        else:  # partial
            n_arch_regions = max(2, expected_count // 3)

        # Compute splits along the dental arch using PCA coordinates
        arch_splits = np.linspace(arch_coord.min(), arch_coord.max(), n_arch_regions + 1)

        min_triangles = config.get('min_tooth_size', 50)

        for side in ["left", "right"]:
            for i in range(n_arch_regions):
                arch_start = arch_splits[i]
                arch_end = arch_splits[i + 1]

                # Define region mask using detected axes
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
                
                # Extract triangles for this region
                region_triangle_indices = np.where(region_mask)[0]
                region_mesh = mesh.select_by_index(region_triangle_indices)
                
                # Clean the region mesh
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
    
    def _export_mesh_segments(self, segments: List[Dict], 
                             output_dir: str, session_id: str) -> List[Dict]:
        """Export each mesh segment as a separate STL file"""
        segment_info_list = []
        
        print(f"Exporting {len(segments)} mesh segments...")
        
        for i, segment_data in enumerate(segments):
            segment_mesh = segment_data["mesh"]
            method = segment_data["method"]
            
            # Generate filename
            tooth_number = i + 1
            filename = f"tooth_{tooth_number:02d}_{method}.stl"
            file_path = os.path.join(output_dir, filename)
            
            # Save as STL (better for 3D visualization than PLY)
            success = o3d.io.write_triangle_mesh(file_path, segment_mesh)
            if not success:
                print(f"Warning: Failed to save segment {i}")
                continue
            
            # Calculate mesh statistics
            vertices = np.asarray(segment_mesh.vertices)
            bbox = segment_mesh.get_axis_aligned_bounding_box()
            center = vertices.mean(axis=0)
            volume = bbox.volume()
            
            # Estimate tooth type based on size and position
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
                    "max": bbox.max_bound.tolist()
                },
                "download_url": f"/download/{session_id}/{filename}"
            }
            
            segment_info_list.append(segment_info)
        
        print(f"Successfully exported {len(segment_info_list)} segments")
        return segment_info_list
    
    def _create_output_directory(self, session_id: str) -> str:
        """Create output directory for session"""
        output_dir = os.path.join(tempfile.gettempdir(), f"dental_segments_{session_id}")
        os.makedirs(output_dir, exist_ok=True)
        return output_dir
    
    def _classify_tooth_type(self, center: np.ndarray, volume: float) -> str:
        """Classify tooth type based on position and size"""
        # Simple classification based on size
        if volume > 50:  # Larger teeth
            return "molar"
        elif volume > 25:  # Medium teeth
            return "premolar"
        elif volume > 15:  # Smaller teeth
            return "canine"
        else:  # Smallest teeth
            return "incisor"
    
    def get_session_info(self, session_id: str) -> Optional[Dict]:
        """Get information about a segmentation session"""
        if session_id not in self.active_sessions:
            return None
        
        output_dir = self.active_sessions[session_id]
        segment_files = []
        
        if os.path.exists(output_dir):
            for filename in os.listdir(output_dir):
                if filename.endswith('.stl'):
                    file_path = os.path.join(output_dir, filename)
                    file_size = os.path.getsize(file_path)
                    segment_files.append({
                        "filename": filename,
                        "size": file_size,
                        "download_url": f"/download/{session_id}/{filename}"
                    })
        
        return {
            "session_id": session_id,
            "output_directory": output_dir,
            "segments": segment_files
        }
    
    def cleanup_session(self, session_id: str) -> bool:
        """Clean up a segmentation session and remove temporary files"""
        if session_id not in self.active_sessions:
            return False
        
        output_dir = self.active_sessions[session_id]
        
        # Remove directory and all files
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)
        
        # Remove from active sessions
        del self.active_sessions[session_id]
        
        return True
    
    def get_file_path(self, session_id: str, filename: str) -> Optional[str]:
        """Get the full path to a segment file"""
        if session_id not in self.active_sessions:
            return None
        
        output_dir = self.active_sessions[session_id]
        file_path = os.path.join(output_dir, filename)
        
        if os.path.exists(file_path):
            return file_path
        
        return None
