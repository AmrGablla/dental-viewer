import { GLTFLoader } from 'three-stdlib';
import { Mesh } from 'three';

export class GLTFLoaderService {
  private loader: GLTFLoader;

  constructor() {
    this.loader = new GLTFLoader();
  }

  async loadGLTF(file: File): Promise<Mesh> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          this.loader.parse(arrayBuffer, '', (gltf) => {
            // Find the first mesh in the scene
            let mesh: Mesh | null = null;
            gltf.scene.traverse((child: any) => {
              if (child.isMesh && !mesh) mesh = child;
            });
            if (!mesh) throw new Error('No mesh found in GLTF/GLB');
            Object.defineProperty(mesh, '__v_skip', { value: true });
            resolve(mesh);
          }, reject);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }
}
