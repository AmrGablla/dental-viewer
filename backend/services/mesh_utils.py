import open3d as o3d


def load_mesh(file_path: str) -> o3d.geometry.TriangleMesh:
    """Load and validate STL mesh."""
    print(f"Loading STL file: {file_path}")
    mesh = o3d.io.read_triangle_mesh(file_path)
    if len(mesh.vertices) == 0:
        raise Exception("Invalid STL file or empty mesh")
    mesh.compute_vertex_normals()
    mesh.remove_duplicated_vertices()
    mesh.remove_duplicated_triangles()
    print(f"Mesh loaded: {len(mesh.vertices)} vertices, {len(mesh.triangles)} triangles")
    return mesh


def sample_mesh(mesh: o3d.geometry.TriangleMesh) -> o3d.geometry.TriangleMesh:
    """Clean and prepare mesh for segmentation."""
    print(f"Processing mesh with {len(mesh.vertices)} vertices...")
    mesh.remove_duplicated_vertices()
    mesh.remove_duplicated_triangles()
    mesh.remove_degenerate_triangles()
    mesh.remove_non_manifold_edges()
    mesh = mesh.filter_smooth_laplacian(number_of_iterations=1)
    mesh.compute_vertex_normals()
    print(f"Processed mesh: {len(mesh.vertices)} vertices, {len(mesh.triangles)} triangles")
    return mesh
