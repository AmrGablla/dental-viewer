import { OBJLoader } from 'three-stdlib';
import { Group, Mesh, MeshStandardMaterial, DoubleSide, Object3D } from 'three';

export class OBJLoaderService {
  private loader: OBJLoader;

  constructor() {
    this.loader = new OBJLoader();
  }

  async loadOBJ(file: File): Promise<Group> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const object = this.loader.parse(text);
          const group = new Group();
          let foundMesh = false;
          object.traverse((child: Object3D) => {
            if ((child as Mesh).isMesh) {
              foundMesh = true;
              const mesh = child as Mesh;
              // If mesh has no material, apply default
              if (!mesh.material || (Array.isArray(mesh.material) && mesh.material.length === 0)) {
                mesh.material = new MeshStandardMaterial({
                  color: 0xf8f8f8,
                  side: DoubleSide,
                  roughness: 0.3,
                  metalness: 0.1,
                  flatShading: false,
                });
              }
              Object.defineProperty(mesh, '__v_skip', { value: true });
              group.add(mesh);
            }
          });
          if (!foundMesh) throw new Error('No mesh found in OBJ');
          Object.defineProperty(group, '__v_skip', { value: true });
          resolve(group);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
}
