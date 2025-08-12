import { PLYLoader } from 'three-stdlib';
import { Mesh, MeshStandardMaterial, DoubleSide } from 'three';

export class PLYLoaderService {
  private loader: PLYLoader;

  constructor() {
    this.loader = new PLYLoader();
  }

  async loadPLY(file: File): Promise<Mesh> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const geometry = this.loader.parse(arrayBuffer);
          const material = new MeshStandardMaterial({
            color: 0xf8f8f8,
            side: DoubleSide,
            roughness: 0.3,
            metalness: 0.1,
            flatShading: false,
          });
          const mesh = new Mesh(geometry, material);
          Object.defineProperty(mesh, '__v_skip', { value: true });
          resolve(mesh);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  parsePLYFromArrayBuffer(arrayBuffer: ArrayBuffer): any {
    return this.loader.parse(arrayBuffer);
  }
}
