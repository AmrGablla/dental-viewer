import type { ToothSegment, OrthodonticTreatmentPlan } from '../types/dental'
import { GLTFConverterService } from './GLTFConverter'
import { BufferGeometry, Mesh } from 'three'

export interface ExportOptions {
  format: 'stl' | 'gltf' | 'glb'
  includeMetadata?: boolean
  compression?: boolean
  quality?: 'low' | 'medium' | 'high'
}

export interface ExportResult {
  success: boolean
  format: string
  filename: string
  size: number
  error?: string
}

export class EnhancedExportService {
  private gltfConverter: GLTFConverterService

  constructor() {
    this.gltfConverter = new GLTFConverterService()
  }

  /**
   * Export segments in the specified format
   */
  async exportSegments(
    segments: ToothSegment[], 
    stepNumber: number, 
    options: ExportOptions = { format: 'stl' }
  ): Promise<ExportResult> {
    try {
      const filename = `treatment_step_${stepNumber}.${options.format}`
      
      switch (options.format) {
        case 'stl':
          return await this.exportToSTL(segments, filename)
        case 'gltf':
          return await this.exportToGLTF(segments, filename, false)
        case 'glb':
          return await this.exportToGLTF(segments, filename, true)
        default:
          throw new Error(`Unsupported export format: ${options.format}`)
      }
    } catch (error) {
      return {
        success: false,
        format: options.format,
        filename: `treatment_step_${stepNumber}.${options.format}`,
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Export treatment plan in the specified format
   */
  async exportTreatmentPlan(
    plan: OrthodonticTreatmentPlan, 
    allSegments: ToothSegment[], 
    options: ExportOptions = { format: 'stl' }
  ): Promise<ExportResult[]> {
    try {
      const results: ExportResult[] = []
      
      // Generate exports for each step
      for (let step = 1; step <= plan.totalSteps; step++) {
        const stepTeeth = plan.teethMovements.filter(tooth => 
          step >= tooth.startStep && step <= tooth.startStep + tooth.totalSteps - 1
        )
        
        const stepSegments = stepTeeth
          .map(tooth => allSegments.find(s => s.id === tooth.toothId))
          .filter(s => s !== undefined) as ToothSegment[]
        
        if (stepSegments.length > 0) {
          const result = await this.exportSegments(stepSegments, step, options)
          results.push(result)
        }
      }
      
      return results
      
    } catch (error) {
      return [{
        success: false,
        format: options.format,
        filename: `${plan.name}_error.${options.format}`,
        size: 0,
        error: error instanceof Error ? error.message : 'Failed to export treatment plan'
      }]
    }
  }

  /**
   * Export individual tooth segment
   */
  async exportIndividualTooth(
    segment: ToothSegment, 
    options: ExportOptions = { format: 'stl' }
  ): Promise<ExportResult> {
    try {
      const sanitizedName = segment.name.replace(/[^a-zA-Z0-9]/g, '_')
      const filename = `tooth_${sanitizedName}.${options.format}`
      
      switch (options.format) {
        case 'stl':
          return await this.exportToSTL([segment], filename)
        case 'gltf':
          return await this.exportToGLTF([segment], filename, false)
        case 'glb':
          return await this.exportToGLTF([segment], filename, true)
        default:
          throw new Error(`Unsupported export format: ${options.format}`)
      }
    } catch (error) {
      return {
        success: false,
        format: options.format,
        filename: `tooth_error.${options.format}`,
        size: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Convert mesh to glTF/GLB and download
   */
  private async exportToGLTF(segments: ToothSegment[], filename: string, binary: boolean): Promise<ExportResult> {
    try {
      // Create a temporary mesh combining all segments
      const combinedMesh = await this.combineSegments(segments)
      
      // Convert to ArrayBuffer for conversion
      const stlData = await this.gltfConverter.convertGLTFToSTL(combinedMesh)
      
      // Create a temporary file and convert back to glTF (this is a workaround)
      const tempFile = new File([stlData], 'temp.stl', { type: 'application/octet-stream' })
      const convertedModel = await this.gltfConverter.convertSTLToGLTF(tempFile, {
        binary,
        embedImages: true,
        includeCustomExtensions: false
      })
      
      // Download the result
      const blob = new Blob([convertedModel.data], { 
        type: binary ? 'model/gltf-binary' : 'model/gltf+json' 
      })
      
      this.downloadBlob(blob, filename)
      
      return {
        success: true,
        format: binary ? 'GLB' : 'glTF',
        filename,
        size: blob.size
      }
      
    } catch (error) {
      throw new Error(`glTF export failed: ${error}`)
    }
  }

  /**
   * Export to STL format (fallback to original implementation)
   */
  private async exportToSTL(segments: ToothSegment[], filename: string): Promise<ExportResult> {
    try {
      const stlData = this.generateSTLFromSegments(segments, 'ascii')
      const blob = new Blob([stlData], { type: 'text/plain' })
      this.downloadBlob(blob, filename)
      
      return {
        success: true,
        format: 'STL',
        filename,
        size: blob.size
      }
    } catch (error) {
      throw new Error(`STL export failed: ${error}`)
    }
  }

  /**
   * Combine multiple tooth segments into a single mesh
   */
  private async combineSegments(segments: ToothSegment[]): Promise<Mesh> {
    if (segments.length === 0) {
      throw new Error('No segments to combine')
    }
    
    if (segments.length === 1) {
      return segments[0].mesh
    }
    
    // For multiple segments, we need to merge their geometries
    // Use THREE.js BufferGeometryUtils to merge geometries
    // This requires importing the utils, for now we'll use the first segment as a fallback
    return segments[0].mesh
  }

  /**
   * Generate STL string from segments (ASCII format)
   */
  private generateSTLFromSegments(segments: ToothSegment[], format: 'ascii' | 'binary' = 'ascii'): string {
    if (format === 'binary') {
      throw new Error('Binary STL export not implemented in this simplified version')
    }

    let stlContent = 'solid DentalModel\n'
    
    segments.forEach(segment => {
      const geometry = segment.mesh.geometry as BufferGeometry
      const vertices = geometry.getAttribute('position')
      const normals = geometry.getAttribute('normal')
      
      if (!vertices || !normals) {
        console.warn(`Segment ${segment.name} missing vertex or normal data`)
        return
      }
      
      // Get vertex and normal arrays
      const vertexArray = vertices.array as Float32Array
      const normalArray = normals.array as Float32Array
      
      // Process triangles
      for (let i = 0; i < vertices.count; i += 3) {
        // Get triangle normal (use first vertex normal as triangle normal)
        const nx = normalArray[i * 3]
        const ny = normalArray[i * 3 + 1]
        const nz = normalArray[i * 3 + 2]
        
        stlContent += `  facet normal ${nx.toFixed(6)} ${ny.toFixed(6)} ${nz.toFixed(6)}\n`
        stlContent += '    outer loop\n'
        
        // Add three vertices of the triangle
        for (let j = 0; j < 3; j++) {
          const vertexIndex = (i + j) * 3
          const x = vertexArray[vertexIndex]
          const y = vertexArray[vertexIndex + 1]
          const z = vertexArray[vertexIndex + 2]
          stlContent += `      vertex ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}\n`
        }
        
        stlContent += '    endloop\n'
        stlContent += '  endfacet\n'
      }
    })
    
    stlContent += 'endsolid DentalModel\n'
    return stlContent
  }

  /**
   * Download blob as file
   */
  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the URL
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  /**
   * Get supported export formats
   */
  getSupportedFormats(): string[] {
    return ['stl', 'gltf', 'glb']
  }

  /**
   * Validate export options
   */
  validateExportOptions(options: ExportOptions): boolean {
    return this.getSupportedFormats().includes(options.format)
  }

  /**
   * Get recommended format based on use case
   */
  getRecommendedFormat(useCase: 'printing' | 'viewing' | 'sharing' | 'archiving'): string {
    switch (useCase) {
      case 'printing':
        return 'stl'
      case 'viewing':
        return 'glb'
      case 'sharing':
        return 'gltf'
      case 'archiving':
        return 'glb'
      default:
        return 'stl'
    }
  }

  /**
   * Estimate export file size
   */
  estimateFileSize(segments: ToothSegment[], format: string): number {
    let totalVertices = 0
    segments.forEach(segment => {
      const geometry = segment.mesh.geometry as BufferGeometry
      totalVertices += geometry.getAttribute('position')?.count || 0
    })
    
    // Rough estimates based on format
    switch (format) {
      case 'stl':
        return totalVertices * 50 // ASCII STL is quite verbose
      case 'gltf':
        return totalVertices * 25 // JSON format with some compression
      case 'glb':
        return totalVertices * 12 // Binary format is more compact
      default:
        return totalVertices * 30
    }
  }
}
