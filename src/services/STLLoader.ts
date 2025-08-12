import { STLLoader } from 'three-stdlib'
import { Mesh, Vector3, MeshStandardMaterial, DoubleSide } from 'three'
import { GLTFConverterService, type ConvertedModel } from './GLTFConverter'

export class STLLoaderService {
  private loader: STLLoader
  private gltfConverter: GLTFConverterService

  constructor() {
    this.loader = new STLLoader()
    this.gltfConverter = new GLTFConverterService()
  }

  /**
   * Parse STL data from ArrayBuffer
   */
  parseSTLFromArrayBuffer(arrayBuffer: ArrayBuffer): any {
    return this.loader.parse(arrayBuffer);
  }

  /**
   * Load STL file and convert to glTF/GLB format for internal use
   */
  async loadSTLAsGLTF(file: File, useGLB: boolean = true): Promise<{
    mesh: Mesh,
    convertedModel: ConvertedModel
  }> {
    try {
      console.log(`Loading ${file.name} and converting to ${useGLB ? 'GLB' : 'glTF'}...`)
      
      // Convert STL to glTF/GLB
      const convertedModel = await this.gltfConverter.convertSTLToGLTF(file, {
        binary: useGLB,
        embedImages: true,
        includeCustomExtensions: false
      })
      
      // Load the converted glTF/GLB as mesh
      const mesh = await this.gltfConverter.loadGLTF(convertedModel.data)
      
      console.log(`Conversion complete: ${file.name} -> ${convertedModel.format.toUpperCase()}`)
      console.log(`Original size: ${this.gltfConverter.formatFileSize(file.size)}`)
      console.log(`Converted size: ${this.gltfConverter.formatFileSize(convertedModel.size)}`)
      console.log(`Compression: ${this.gltfConverter.getCompressionRatio(file.size, convertedModel.size)}%`)
      
      return {
        mesh,
        convertedModel
      }
    } catch (error) {
      console.error('Error loading STL as glTF:', error)
      // Fallback to traditional STL loading
      console.log('Falling back to traditional STL loading...')
      const mesh = await this.loadSTL(file)
      return {
        mesh,
        convertedModel: {
          data: new ArrayBuffer(0),
          format: 'glb',
          size: file.size,
          vertexCount: mesh.geometry.getAttribute('position')?.count || 0,
          triangleCount: mesh.geometry.index ? mesh.geometry.index.count / 3 : (mesh.geometry.getAttribute('position')?.count || 0) / 3,
          originalFileName: file.name
        }
      }
    }
  }

  async loadSTL(file: File): Promise<Mesh> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer
          console.log('File read successfully, size:', arrayBuffer.byteLength)
          
          const geometry = this.loader.parse(arrayBuffer)
          const vertexCount = geometry.getAttribute('position')?.count || 0
          console.log('STL parsed successfully, vertices:', vertexCount.toLocaleString())
          
          // For very large models, consider geometry optimization
          if (vertexCount > 1000000) {
            console.log('Large model detected, applying optimizations...')
            geometry.computeVertexNormals() // Ensure we have normals
          }
          
          // Center the geometry
          geometry.computeBoundingBox()
          const center = geometry.boundingBox?.getCenter(new Vector3()) || new Vector3()
          geometry.translate(-center.x, -center.y, -center.z)
          
          // Create mesh with enhanced material for better lighting
          const material = new MeshStandardMaterial({ 
            color: 0xf8f8f8,        // Slightly off-white for better visual appeal
            side: DoubleSide,
            roughness: 0.3,         // Slight shininess for dental material
            metalness: 0.1,         // Very slight metallic quality
            transparent: false,
            opacity: 1.0,
            flatShading: false,     // Smooth shading for better quality
            emissive: 0x000000,     // No emissive color
            emissiveIntensity: 0.0
          })
          
          const mesh = new Mesh(geometry, material)
          
          // Mark the mesh as raw to prevent Vue reactivity issues
          // This is important when the mesh will be used in Vue components
          Object.defineProperty(mesh, '__v_skip', { value: true })
          
          console.log('Mesh created successfully')
          resolve(mesh)
        } catch (error) {
          console.error('Error parsing STL:', error)
          reject(error)
        }
      }
      
      reader.onerror = () => {
        console.error('Failed to read file')
        reject(new Error('Failed to read file'))
      }
      
      console.log('Starting to read file:', file.name, 'size:', file.size)
      reader.readAsArrayBuffer(file)
    })
  }

  async loadSTLFromURL(url: string): Promise<Mesh> {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (geometry) => {
          // Center the geometry
          geometry.computeBoundingBox()
          const center = geometry.boundingBox?.getCenter(new Vector3()) || new Vector3()
          geometry.translate(-center.x, -center.y, -center.z)
          
          const material = new MeshStandardMaterial({ 
            color: 0xf8f8f8,        // Slightly off-white for better visual appeal
            side: DoubleSide,
            roughness: 0.3,         // Slight shininess for dental material
            metalness: 0.1,         // Very slight metallic quality
            transparent: false,
            opacity: 1.0,
            flatShading: false,     // Smooth shading for better quality
            emissive: 0x000000,     // No emissive color
            emissiveIntensity: 0.0
          })
          
          const mesh = new Mesh(geometry, material)
          
          // Mark the mesh as raw to prevent Vue reactivity issues
          Object.defineProperty(mesh, '__v_skip', { value: true })
          
          resolve(mesh)
        },
        undefined,
        reject
      )
    })
  }
}
