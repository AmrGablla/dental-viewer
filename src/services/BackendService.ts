import { STLLoaderService } from './STLLoader';

export class BackendService {
  private baseUrl: string;
  private THREE: any;
  private stlLoader: STLLoaderService;

  constructor(baseUrl: string = 'http://localhost:8000', THREE?: any) {
    this.baseUrl = baseUrl;
    this.THREE = THREE || (window as any).THREE;
    this.stlLoader = new STLLoaderService();
  }

  async checkHealth(): Promise<boolean> {
    try {
      console.log("🔍 Checking backend health at:", `${this.baseUrl}/health`);
      const response = await fetch(`${this.baseUrl}/health`);
      const isHealthy = response.ok;
      console.log("🏥 Backend health check result:", isHealthy);
      return isHealthy;
    } catch (error) {
      console.error('Backend health check failed:', error);
      return false;
    }
  }

  async segmentSTLFile(file: File): Promise<any> {
    try {
      console.log("📤 Sending STL file to backend for segmentation:", file.name);
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${this.baseUrl}/segment`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend segmentation failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log("📥 Received segmentation result from backend:", result);
      return result;
    } catch (error) {
      console.error('Backend segmentation request failed:', error);
      throw error;
    }
  }

  async loadSegmentAsMesh(sessionId: string, filename: string, color: string = '#00ff00'): Promise<any> {
    try {
      console.log("📥 Loading segment mesh from backend:", filename, "with color:", color);
      
      const response = await fetch(`${this.baseUrl}/download/${sessionId}/${filename}`);
      
      if (!response.ok) {
        console.warn("Could not load segment mesh from backend, creating placeholder");
        return this.createPlaceholderMesh(color);
      }

      // The backend returns individual STL files for each segment
      const arrayBuffer = await response.arrayBuffer();
      console.log("📦 Received mesh data, size:", arrayBuffer.byteLength, "bytes");
      
      // Debug: Check the first few bytes to see what format we're actually getting
      const uint8Array = new Uint8Array(arrayBuffer);
      const header = new TextDecoder().decode(uint8Array.slice(0, 100));
      console.log("🔍 File header (first 100 bytes):", header);
      
      // Parse the STL data using the STLLoader
      try {
        const geometry = this.stlLoader.parseSTLFromArrayBuffer(arrayBuffer);
        
        // Don't center the geometry for segments to preserve original positions
        // The geometry should already be in the correct position relative to the main model
        geometry.computeBoundingBox();
        
        const material = new this.THREE.MeshStandardMaterial({
          color: color,
          side: this.THREE.DoubleSide,
          roughness: 0.3,
          metalness: 0.1,
          flatShading: false,
          transparent: true,
          opacity: 0.8
        });
        const mesh = new this.THREE.Mesh(geometry, material);
        
        // Don't set position to center - let the segment positioning logic handle it
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        console.log("✅ Successfully parsed STL mesh:", mesh);
        return mesh;
      } catch (parseError) {
        console.error("❌ Failed to parse STL data, falling back to placeholder:", parseError);
        return this.createPlaceholderMesh(color);
      }
      
    } catch (error) {
      console.error('Error loading segment mesh:', error);
      return this.createPlaceholderMesh(color);
    }
  }

  private createPlaceholderMesh(color: string = '#00ff00'): any {
    // Create a simple placeholder mesh for demonstration
    // In a real implementation, this would be replaced with actual mesh loading
    if (!this.THREE) {
      console.error("❌ THREE is not available in BackendService");
      return null;
    }
    
    const geometry = new this.THREE.BoxGeometry(2, 2, 2); // Larger size
    const material = new this.THREE.MeshStandardMaterial({ 
      color: color,
      transparent: true,
      opacity: 0.8,
      side: this.THREE.DoubleSide
    });
    const mesh = new this.THREE.Mesh(geometry, material);
    
    // Position the mesh with some offset so segments are visible and not overlapping
    const offset = Math.random() * 10 - 5; // Random offset between -5 and 5
    mesh.position.set(offset, offset, offset);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    console.log("🔧 Created placeholder mesh with color:", color, mesh);
    return mesh;
  }
}
