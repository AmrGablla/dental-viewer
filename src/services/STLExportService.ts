import type { ToothSegment, OrthodonticTreatmentPlan } from '../types/dental'

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

  async exportTreatmentPlan(plan: OrthodonticTreatmentPlan, allSegments: ToothSegment[]): Promise<void> {
    try {
      const exports: { stepNumber: number; stlData: string }[] = []
      
      // Generate STL for each step
      for (let step = 1; step <= plan.totalSteps; step++) {
        const stepTeeth = plan.teethMovements.filter(tooth => 
          step >= tooth.startStep && step <= tooth.startStep + tooth.totalSteps - 1
        )
        
        const stepSegments = stepTeeth
          .map(tooth => allSegments.find(s => s.id === tooth.toothId))
          .filter(s => s !== undefined) as ToothSegment[]
        
        if (stepSegments.length > 0) {
          const stlData = this.generateSTLFromSegments(stepSegments, 'ascii')
          exports.push({ stepNumber: step, stlData })
        }
      }
      
      // Create a zip file with all steps
      await this.downloadMultipleSTLs(exports, `${plan.name}_all_steps`)
      
    } catch (error) {
      console.error('Failed to export treatment plan:', error)
      throw new Error('Failed to export complete treatment plan')
    }
  }

  private generateSTLFromSegments(segments: ToothSegment[], format: 'ascii' | 'binary' = 'ascii'): string {
    if (format === 'ascii') {
      return this.generateASCIISTL(segments)
    } else {
      return this.generateBinarySTL(segments)
    }
  }

  private generateASCIISTL(segments: ToothSegment[]): string {
    let stl = 'solid TreatmentStep\n'
    
    segments.forEach(segment => {
      const geometry = segment.mesh.geometry
      const position = geometry.attributes.position
      const index = geometry.index
      
      if (index) {
        // Indexed geometry
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i) * 3
          const b = index.getX(i + 1) * 3
          const c = index.getX(i + 2) * 3
          
          const v1 = [position.getX(a), position.getY(a), position.getZ(a)]
          const v2 = [position.getX(b), position.getY(b), position.getZ(b)]
          const v3 = [position.getX(c), position.getY(c), position.getZ(c)]
          
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
          const v1 = [position.getX(i), position.getY(i), position.getZ(i)]
          const v2 = [position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)]
          const v3 = [position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)]
          
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

  private async downloadMultipleSTLs(exports: { stepNumber: number; stlData: string }[], baseName: string): Promise<void> {
    // For now, download each file separately
    // In a real implementation, you might want to create a ZIP file
    exports.forEach(({ stepNumber, stlData }) => {
      const filename = `${baseName}_step_${stepNumber}.stl`
      this.downloadSTL(stlData, filename)
    })
  }
}
