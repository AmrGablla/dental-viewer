import { markRaw } from 'vue';
import type { DentalModel } from '../types/dental';
import { errorHandlingService } from './ErrorHandlingService';

export class FileHandlerService {
  private stlLoader: any;
  private objLoader: any;
  private plyLoader: any;
  private gltfLoader: any;
  private scene: any;

  constructor(
    stlLoader: any,
    objLoader: any,
    plyLoader: any,
    gltfLoader: any,
    scene: any
  ) {
    this.stlLoader = stlLoader;
    this.objLoader = objLoader;
    this.plyLoader = plyLoader;
    this.gltfLoader = gltfLoader;
    this.scene = scene;
  }

  // Utility function to format file sizes
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async handleFileUpload(
    event: Event,
    autoSegment: boolean = false,
    onLoadStart?: () => void,
    onLoadComplete?: (dentalModel: DentalModel) => void,
    onError?: (error: Error) => void,
    startBackgroundAISegmentation?: (file: File) => Promise<void>
  ): Promise<DentalModel | null> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      console.log("No file selected");
      return null;
    }

    console.log(
      "File selected:",
      file.name,
      "size:",
      file.size,
      "type:",
      file.type,
      "auto-segment:",
      autoSegment
    );

    onLoadStart?.();

    // Helper to clear previous model from scene
    this.clearPreviousModel();

    try {
      const dentalModel = await this.loadModel(file);
      
      // Helper to add mesh to scene and update dentalModel
      this.setModel(dentalModel);

      console.log("Model loaded successfully");
      
      // Call onLoadComplete first to ensure dentalModel is set
      onLoadComplete?.(dentalModel);
      
      console.log("🔍 Auto-segmentation check - autoSegment:", autoSegment, "file extension:", file.name.toLowerCase().endsWith('.stl'));
      
      if (autoSegment && file.name.toLowerCase().endsWith('.stl')) {
        console.log("🚀 Triggering auto-segmentation for STL file:", file.name);
        // Add a small delay to ensure the model is fully loaded and reactive
        setTimeout(() => {
          startBackgroundAISegmentation?.(file);
        }, 100);
      } else {
        console.log("❌ Auto-segmentation not triggered - conditions not met");
      }
      return dentalModel;

    } catch (error) {
      console.error("Error loading 3D model:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      onError?.(new Error(`Error loading 3D model: ${errorMessage}. Please try again.`));
      return null;
    } finally {
      if (input) input.value = "";
    }
  }

  private clearPreviousModel() {
    // This would need access to the current dentalModel to clear it
    // Implementation depends on how you want to handle this
  }

  private async loadModel(file: File): Promise<DentalModel> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    let mesh: any = null;
    let convertedModel: any = undefined;
    let geometry: any = null;
    let boundingBox: any = null;

    if (ext === 'stl') {
      try {
        console.log("Converting STL to glTF format...");
        const result = await this.stlLoader.loadSTLAsGLTF(file, true);
        mesh = result.mesh;
        convertedModel = result.convertedModel;
        geometry = mesh.geometry;
      } catch (err) {
        console.warn("STL glTF conversion failed, falling back to STL loader", err);
        mesh = await this.stlLoader.loadSTL(file);
        geometry = mesh.geometry;
      }
    } else if (ext === 'obj') {
      mesh = await this.objLoader.loadOBJ(file);
      // mesh is a THREE.Group, compute bounding box for all children
      let box: any = null;
      mesh.traverse((child: any) => {
        if (child.isMesh) {
          child.geometry.computeBoundingBox();
          if (!box) {
            box = child.geometry.boundingBox.clone();
          } else {
            box.union(child.geometry.boundingBox);
          }
        }
      });
      geometry = { boundingBox: box };
    } else if (ext === 'ply') {
      mesh = await this.plyLoader.loadPLY(file);
      geometry = mesh.geometry;
    } else if (ext === 'gltf' || ext === 'glb') {
      mesh = await this.gltfLoader.loadGLTF(file);
      geometry = mesh.geometry;
    } else {
      throw new Error('Unsupported file type: ' + ext);
    }

    // Compute bounding box
    if (geometry && geometry.boundingBox) {
      boundingBox = {
        min: geometry.boundingBox.min.clone() || { x: 0, y: 0, z: 0 },
        max: geometry.boundingBox.max.clone() || { x: 0, y: 0, z: 0 },
      };
    } else {
      // fallback
      boundingBox = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }

    const rawMesh = markRaw(mesh);
    rawMesh.visible = true;
    this.scene.add(rawMesh);

    return {
      originalMesh: rawMesh,
      segments: [],
      boundingBox,
      ...(convertedModel ? { convertedModel } : {}),
    };
  }

  private setModel(_dentalModel: DentalModel) {
    // This would focus on the model after loading
    // Implementation depends on camera access
  }

  // Load STL file from URL
  async loadSTLFile(url: string, authToken?: string, centerGeometry: boolean = true): Promise<any> {
    try {
      console.log("Loading STL file from URL:", url);
      
      // Prepare headers
      const headers: HeadersInit = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      // Fetch the STL file
      const response = await fetch(url, { headers });
      if (!response.ok) {
        await errorHandlingService.handleApiError(response, `Failed to fetch STL file: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
      
      // Create a File object from the blob
      // For raw endpoints, we know it's always an STL file, so use model.stl
      // For segment endpoints, we also know it's an STL file
      let fileName = 'model.stl';
      if (url.includes('/raw')) {
        fileName = 'model.stl';
      } else if (url.includes('/segments/')) {
        fileName = 'segment.stl';
      } else {
        fileName = url.split('/').pop() || 'model.stl';
      }
      const file = new File([blob], fileName, { type: 'application/octet-stream' });
      
      // Load the model using existing logic, but with centerGeometry parameter
      const dentalModel = await this.loadModelWithOptions(file, centerGeometry);
      
      return dentalModel.originalMesh;
    } catch (error) {
      console.error("Error loading STL file from URL:", error);
      errorHandlingService.handleFetchError(error);
      throw error;
    }
  }

  private async loadModelWithOptions(file: File, centerGeometry: boolean = true): Promise<DentalModel> {
    const ext = file.name.split('.').pop()?.toLowerCase();
    let mesh: any = null;
    let convertedModel: any = undefined;
    let geometry: any = null;
    let boundingBox: any = null;

    if (ext === 'stl') {
      // For segments (when centerGeometry is false), skip glTF conversion to preserve positioning
      if (!centerGeometry) {
        console.log("Loading STL directly (skipping glTF conversion) to preserve segment positioning");
        mesh = await this.stlLoader.loadSTL(file, centerGeometry);
        geometry = mesh.geometry;
      } else {
        try {
          console.log("Converting STL to glTF format...");
          const result = await this.stlLoader.loadSTLAsGLTF(file, true);
          mesh = result.mesh;
          convertedModel = result.convertedModel;
          geometry = mesh.geometry;
        } catch (err) {
          console.warn("STL glTF conversion failed, falling back to STL loader", err);
          mesh = await this.stlLoader.loadSTL(file, centerGeometry);
          geometry = mesh.geometry;
        }
      }
    } else if (ext === 'obj') {
      mesh = await this.objLoader.loadOBJ(file);
      // mesh is a THREE.Group, compute bounding box for all children
      let box: any = null;
      mesh.traverse((child: any) => {
        if (child.isMesh) {
          child.geometry.computeBoundingBox();
          if (!box) {
            box = child.geometry.boundingBox.clone();
          } else {
            box.union(child.geometry.boundingBox);
          }
        }
      });
      geometry = { boundingBox: box };
    } else if (ext === 'ply') {
      mesh = await this.plyLoader.loadPLY(file);
      geometry = mesh.geometry;
    } else if (ext === 'gltf' || ext === 'glb') {
      mesh = await this.gltfLoader.loadGLTF(file);
      geometry = mesh.geometry;
    } else {
      throw new Error('Unsupported file type: ' + ext);
    }

    // Compute bounding box
    if (geometry && geometry.boundingBox) {
      boundingBox = {
        min: geometry.boundingBox.min.clone() || { x: 0, y: 0, z: 0 },
        max: geometry.boundingBox.max.clone() || { x: 0, y: 0, z: 0 },
      };
    } else {
      // fallback
      boundingBox = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    }

    const rawMesh = markRaw(mesh);
    rawMesh.visible = true;
    this.scene.add(rawMesh);

    return {
      originalMesh: rawMesh,
      segments: [],
      boundingBox,
      ...(convertedModel ? { convertedModel } : {}),
    };
  }
}
