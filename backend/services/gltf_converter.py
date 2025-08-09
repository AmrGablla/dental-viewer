"""
GLB/glTF conversion service for handling 3D model format conversions.
This service provides conversion between STL and glTF/GLB formats using trimesh and pygltflib.
"""

import os
import tempfile
import numpy as np
from typing import Dict, Any, Optional, Tuple, Union
import json

import trimesh
import open3d as o3d
from pygltflib import GLTF2, Scene, Node, Mesh, Primitive, Accessor, BufferView, Buffer
from pygltflib.utils import ImageFormat


class GLTFConverterService:
    """Service for converting between STL and glTF/GLB formats."""
    
    def __init__(self):
        self.supported_input_formats = ['.stl']
        self.supported_output_formats = ['.glb', '.gltf']
    
    def stl_to_gltf(self, stl_path: str, output_path: str, binary: bool = True) -> Dict[str, Any]:
        """
        Convert STL file to glTF or GLB format.
        
        Args:
            stl_path: Path to input STL file
            output_path: Path for output glTF/GLB file
            binary: True for GLB, False for glTF
            
        Returns:
            Dictionary with conversion results and metadata
        """
        try:
            print(f"Loading STL file: {stl_path}")
            
            # Determine format type first
            format_type = 'GLB' if binary else 'glTF'
            
            # Load STL using trimesh (more robust than Open3D for various STL formats)
            mesh = trimesh.load(stl_path)
            
            if not isinstance(mesh, trimesh.Trimesh):
                raise ValueError("Loaded object is not a valid mesh")
            
            print(f"Mesh loaded: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
            
            # Ensure mesh is watertight and properly oriented
            if not mesh.is_watertight:
                print("Mesh is not watertight, attempting to repair...")
                mesh.fill_holes()
                mesh.fix_normals()
            
            # Convert to glTF/GLB
            if binary:
                mesh.export(output_path, file_type='glb')
                format_type = 'GLB'
            else:
                mesh.export(output_path, file_type='gltf')
                format_type = 'glTF'
            
            # Get file sizes for comparison
            original_size = os.path.getsize(stl_path)
            converted_size = os.path.getsize(output_path)
            compression_ratio = round((1 - (converted_size / original_size)) * 100, 2)
            
            result = {
                'success': True,
                'input_format': 'STL',
                'output_format': format_type,
                'input_size': original_size,
                'output_size': converted_size,
                'compression_ratio': compression_ratio,
                'vertex_count': len(mesh.vertices),
                'face_count': len(mesh.faces),
                'bounds': mesh.bounds.tolist(),
                'volume': float(mesh.volume) if mesh.is_volume else 0,
                'surface_area': float(mesh.area),
                'is_watertight': mesh.is_watertight,
                'output_path': output_path
            }
            
            print(f"Conversion successful: STL -> {format_type}")
            print(f"Original size: {self._format_file_size(original_size)}")
            print(f"Converted size: {self._format_file_size(converted_size)}")
            print(f"Compression: {compression_ratio}%")
            
            return result
            
        except Exception as e:
            format_type = 'GLB' if binary else 'glTF'
            print(f"Error converting STL to {format_type}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'input_format': 'STL',
                'output_format': format_type
            }
    
    def gltf_to_stl(self, gltf_path: str, output_path: str) -> Dict[str, Any]:
        """
        Convert glTF/GLB file back to STL format.
        
        Args:
            gltf_path: Path to input glTF/GLB file
            output_path: Path for output STL file
            
        Returns:
            Dictionary with conversion results and metadata
        """
        try:
            print(f"Loading glTF/GLB file: {gltf_path}")
            
            # Load using trimesh
            mesh = trimesh.load(gltf_path)
            
            if not isinstance(mesh, trimesh.Trimesh):
                # Handle scene with multiple meshes
                if hasattr(mesh, 'geometry') and mesh.geometry:
                    # Combine all geometries
                    meshes = list(mesh.geometry.values())
                    if len(meshes) == 1:
                        mesh = meshes[0]
                    else:
                        # Combine multiple meshes
                        mesh = trimesh.util.concatenate(meshes)
                else:
                    raise ValueError("No valid mesh found in glTF file")
            
            print(f"Mesh loaded: {len(mesh.vertices)} vertices, {len(mesh.faces)} faces")
            
            # Export as STL
            mesh.export(output_path, file_type='stl')
            
            # Get file sizes
            original_size = os.path.getsize(gltf_path)
            converted_size = os.path.getsize(output_path)
            
            result = {
                'success': True,
                'input_format': 'glTF/GLB',
                'output_format': 'STL',
                'input_size': original_size,
                'output_size': converted_size,
                'vertex_count': len(mesh.vertices),
                'face_count': len(mesh.faces),
                'bounds': mesh.bounds.tolist(),
                'volume': float(mesh.volume) if mesh.is_volume else 0,
                'surface_area': float(mesh.area),
                'is_watertight': mesh.is_watertight,
                'output_path': output_path
            }
            
            print(f"Conversion successful: glTF/GLB -> STL")
            
            return result
            
        except Exception as e:
            print(f"Error converting glTF/GLB to STL: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'input_format': 'glTF/GLB',
                'output_format': 'STL'
            }
    
    def process_segmented_meshes_to_gltf(self, segments: list, output_dir: str, 
                                       session_id: str, binary: bool = True) -> Dict[str, Any]:
        """
        Convert segmented meshes (from Open3D) to glTF/GLB format.
        
        Args:
            segments: List of segmented mesh data from segmentation service
            output_dir: Directory to save converted files
            session_id: Session identifier
            binary: True for GLB, False for glTF
            
        Returns:
            Dictionary with conversion results for all segments
        """
        try:
            converted_segments = []
            format_ext = '.glb' if binary else '.gltf'
            format_name = 'GLB' if binary else 'glTF'
            
            print(f"Converting {len(segments)} segments to {format_name}...")
            
            for i, segment_data in enumerate(segments):
                try:
                    segment_mesh = segment_data["mesh"]  # Open3D mesh
                    method = segment_data["method"]
                    
                    # Convert Open3D mesh to trimesh
                    vertices = np.asarray(segment_mesh.vertices)
                    faces = np.asarray(segment_mesh.triangles)
                    
                    if len(vertices) == 0 or len(faces) == 0:
                        print(f"Warning: Segment {i} is empty, skipping...")
                        continue
                    
                    # Create trimesh object
                    trimesh_obj = trimesh.Trimesh(vertices=vertices, faces=faces)
                    
                    # Generate filename
                    if method == "gum":
                        filename = f"gum{format_ext}"
                        tooth_number = 0
                        tooth_type = "gum"
                    else:
                        tooth_number = i + 1
                        filename = f"tooth_{tooth_number:02d}_{method}{format_ext}"
                        tooth_type = self._classify_tooth_type(vertices.mean(axis=0), 
                                                             trimesh_obj.volume)
                    
                    # Export path
                    file_path = os.path.join(output_dir, filename)
                    
                    # Export as glTF/GLB
                    if binary:
                        trimesh_obj.export(file_path, file_type='glb')
                    else:
                        trimesh_obj.export(file_path, file_type='gltf')
                    
                    # Collect segment info
                    file_size = os.path.getsize(file_path)
                    bbox = trimesh_obj.bounds
                    
                    segment_info = {
                        "id": i,
                        "tooth_number": tooth_number,
                        "tooth_type": tooth_type,
                        "method": method,
                        "filename": filename,
                        "format": format_name,
                        "vertex_count": len(vertices),
                        "triangle_count": len(faces),
                        "file_size": file_size,
                        "center": trimesh_obj.center_mass.tolist(),
                        "volume": float(trimesh_obj.volume),
                        "surface_area": float(trimesh_obj.area),
                        "bounding_box": {
                            "min": bbox[0].tolist(),
                            "max": bbox[1].tolist(),
                        },
                        "is_watertight": trimesh_obj.is_watertight
                    }
                    
                    converted_segments.append(segment_info)
                    print(f"Converted segment {i}: {filename}")
                    
                except Exception as e:
                    print(f"Error converting segment {i}: {str(e)}")
                    continue
            
            result = {
                'success': True,
                'session_id': session_id,
                'format': format_name,
                'total_segments': len(segments),
                'converted_segments': len(converted_segments),
                'segments': converted_segments,
                'output_directory': output_dir
            }
            
            print(f"Successfully converted {len(converted_segments)} segments to {format_name}")
            return result
            
        except Exception as e:
            format_name = 'GLB' if binary else 'glTF'
            print(f"Error processing segments to {format_name}: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'format': format_name,
                'total_segments': len(segments) if segments else 0
            }
    
    def _classify_tooth_type(self, center: np.ndarray, volume: float) -> str:
        """
        Classify tooth type based on position and volume.
        This is a simplified classification - can be enhanced with ML models.
        """
        # Simple heuristic based on volume
        if volume < 50:  # Small volume suggests premolar/incisor
            return "incisor" if abs(center[0]) < 10 else "premolar"
        elif volume < 150:  # Medium volume suggests canine/premolar
            return "canine" if abs(center[0]) < 15 else "premolar"
        else:  # Large volume suggests molar
            return "molar"
    
    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format."""
        if size_bytes == 0:
            return "0 B"
        
        size_names = ["B", "KB", "MB", "GB"]
        import math
        i = int(math.floor(math.log(size_bytes, 1024)))
        p = math.pow(1024, i)
        s = round(size_bytes / p, 2)
        return f"{s} {size_names[i]}"
    
    def validate_file_format(self, file_path: str, expected_format: str) -> bool:
        """Validate if file matches expected format."""
        try:
            if expected_format.lower() in ['stl']:
                # Try loading with trimesh
                mesh = trimesh.load(file_path)
                return isinstance(mesh, trimesh.Trimesh)
            elif expected_format.lower() in ['gltf', 'glb']:
                # Try loading with trimesh
                mesh = trimesh.load(file_path)
                return mesh is not None
            return False
        except:
            return False
    
    def get_mesh_info(self, file_path: str) -> Dict[str, Any]:
        """Get detailed information about a mesh file."""
        try:
            mesh = trimesh.load(file_path)
            
            if isinstance(mesh, trimesh.Trimesh):
                return {
                    'vertices': len(mesh.vertices),
                    'faces': len(mesh.faces),
                    'volume': float(mesh.volume) if mesh.is_volume else 0,
                    'surface_area': float(mesh.area),
                    'bounds': mesh.bounds.tolist(),
                    'center': mesh.center_mass.tolist(),
                    'is_watertight': mesh.is_watertight,
                    'file_size': os.path.getsize(file_path)
                }
            else:
                # Handle scenes with multiple meshes
                total_vertices = 0
                total_faces = 0
                total_volume = 0
                total_area = 0
                
                if hasattr(mesh, 'geometry'):
                    for geom in mesh.geometry.values():
                        if isinstance(geom, trimesh.Trimesh):
                            total_vertices += len(geom.vertices)
                            total_faces += len(geom.faces)
                            total_volume += float(geom.volume) if geom.is_volume else 0
                            total_area += float(geom.area)
                
                return {
                    'vertices': total_vertices,
                    'faces': total_faces,
                    'volume': total_volume,
                    'surface_area': total_area,
                    'file_size': os.path.getsize(file_path),
                    'is_scene': True
                }
                
        except Exception as e:
            return {'error': str(e)}
