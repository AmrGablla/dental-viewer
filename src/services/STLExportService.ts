import type { ToothSegment, OrthodonticTreatmentPlan } from '../types/dental'
import { Vector3 } from 'three'

export class STLExportService {
  
  async exportStepSTL(segments: ToothSegment[], stepNumber: number): Promise<void> {
    try {
      const stlData = this.generateSTLFromSegments(segments, 'ascii')
      const filename = `treatment_step_${stepNumber}.stl`
      this.downloadSTL(stlData, filename)
    } catch (error) {
      console.error('Failed to export STL for step:', error)
      throw new Error(`Failed to export STL for step ${stepNumber}`)
    }
  }

  async exportTreatmentPlan(plan: OrthodonticTreatmentPlan, allSegments: ToothSegment[], includeAllSegments: boolean = false): Promise<void> {
    try {
      const exports: { stepNumber: number; stlData: string }[] = []
      
      // Store original positions before transformation
      const originalPositions = new Map<string, Map<number, { x: number, y: number, z: number }>>()
      
      // Generate STL for each step
      for (let step = 1; step <= plan.totalSteps; step++) {
        // Store positions before this step's transformation
        const stepOriginalPositions = new Map<string, { x: number, y: number, z: number }>()
        allSegments.forEach(segment => {
          if (segment.mesh.position) {
            stepOriginalPositions.set(segment.id, {
              x: segment.mesh.position.x,
              y: segment.mesh.position.y,
              z: segment.mesh.position.z
            })
          }
        })
        originalPositions.set(step, stepOriginalPositions)
        
        let stepSegments: ToothSegment[]
        
        if (includeAllSegments) {
          // Include ALL segments for this step
          stepSegments = [...allSegments]
          // Apply step transformations (this will be done by the caller)
        } else {
          // Only include segments that are moving in this step (original behavior)
          const stepTeeth = plan.teethMovements.filter(tooth => 
            step >= tooth.startStep && step <= tooth.startStep + tooth.totalSteps - 1
          )
          
          stepSegments = stepTeeth
            .map(tooth => allSegments.find(s => s.id === tooth.toothId))
            .filter(s => s !== undefined) as ToothSegment[]
        }
        
        if (stepSegments.length > 0) {
          const stlData = this.generateSTLFromSegments(stepSegments, 'ascii')
          exports.push({ stepNumber: step, stlData })
        }
        
        // Restore positions after this step's export
        if (includeAllSegments) {
          const stepPositions = originalPositions.get(step)
          if (stepPositions) {
            allSegments.forEach(segment => {
              const original = stepPositions.get(segment.id)
              if (original && segment.mesh.position) {
                segment.mesh.position.set(original.x, original.y, original.z)
                segment.mesh.updateMatrixWorld()
              }
            })
          }
        }
      }
      
      // Create a zip file with all steps
      await this.downloadMultipleSTLs(exports, `${plan.name}_all_steps`)
      
    } catch (error) {
      console.error('Failed to export treatment plan:', error)
      throw new Error('Failed to export complete treatment plan')
    }
  }

  generateSTLFromSegments(segments: ToothSegment[], format: 'ascii' | 'binary' = 'ascii'): string {
    if (format === 'ascii') {
      return this.generateASCIISTL(segments)
    } else {
      return this.generateBinarySTL(segments)
    }
  }

  private generateASCIISTL(segments: ToothSegment[]): string {
    let stl = 'solid TreatmentStep\n'
    
    segments.forEach(segment => {
      // Ensure mesh world matrix is up to date
      segment.mesh.updateMatrixWorld(true)
      
      const geometry = segment.mesh.geometry
      const position = geometry.attributes.position
      const index = geometry.index
      
      // Helper to transform local vertex to world space
      const getWorldVertex = (localIndex: number): [number, number, number] => {
        const localVertex = new Vector3(
          position.getX(localIndex),
          position.getY(localIndex),
          position.getZ(localIndex)
        )
        localVertex.applyMatrix4(segment.mesh.matrixWorld)
        return [localVertex.x, localVertex.y, localVertex.z]
      }
      
      if (index) {
        // Indexed geometry
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i)
          const b = index.getX(i + 1)
          const c = index.getX(i + 2)
          
          const v1 = getWorldVertex(a)
          const v2 = getWorldVertex(b)
          const v3 = getWorldVertex(c)
          
          // Calculate normal
          const normal = this.calculateNormal(v1, v2, v3)
          
          stl += `  facet normal ${normal[0]} ${normal[1]} ${normal[2]}\n`
          stl += `    outer loop\n`
          stl += `      vertex ${v1[0]} ${v1[1]} ${v1[2]}\n`
          stl += `      vertex ${v2[0]} ${v2[1]} ${v2[2]}\n`
          stl += `      vertex ${v3[0]} ${v3[1]} ${v3[2]}\n`
          stl += `    endloop\n`
          stl += `  endfacet\n`
        }
      } else {
        // Non-indexed geometry
        for (let i = 0; i < position.count; i += 3) {
          const v1 = getWorldVertex(i)
          const v2 = getWorldVertex(i + 1)
          const v3 = getWorldVertex(i + 2)
          
          const normal = this.calculateNormal(v1, v2, v3)
          
          stl += `  facet normal ${normal[0]} ${normal[1]} ${normal[2]}\n`
          stl += `    outer loop\n`
          stl += `      vertex ${v1[0]} ${v1[1]} ${v1[2]}\n`
          stl += `      vertex ${v2[0]} ${v2[1]} ${v2[2]}\n`
          stl += `      vertex ${v3[0]} ${v3[1]} ${v3[2]}\n`
          stl += `    endloop\n`
          stl += `  endfacet\n`
        }
      }
    })
    
    stl += 'endsolid TreatmentStep\n'
    return stl
  }

  private generateBinarySTL(segments: ToothSegment[]): string {
    // For simplicity, return ASCII format
    // Binary STL would require more complex ArrayBuffer handling
    return this.generateASCIISTL(segments)
  }

  private calculateNormal(v1: number[], v2: number[], v3: number[]): number[] {
    // Calculate two edge vectors
    const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]]
    const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]]
    
    // Calculate cross product
    const normal = [
      edge1[1] * edge2[2] - edge1[2] * edge2[1],
      edge1[2] * edge2[0] - edge1[0] * edge2[2],
      edge1[0] * edge2[1] - edge1[1] * edge2[0]
    ]
    
    // Normalize
    const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2])
    if (length > 0) {
      normal[0] /= length
      normal[1] /= length
      normal[2] /= length
    }
    
    return normal
  }

  private downloadSTL(stlData: string, filename: string): void {
    const blob = new Blob([stlData], { type: 'application/sla' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    URL.revokeObjectURL(url)
  }

  async downloadMultipleSTLs(exports: { stepNumber: number; stlData: string }[], baseName: string): Promise<void> {
    // For now, download each file separately
    // In a real implementation, you might want to create a ZIP file
    exports.forEach(({ stepNumber, stlData }) => {
      const filename = `${baseName}_step_${stepNumber}.stl`
      this.downloadSTL(stlData, filename)
    })
  }
}
