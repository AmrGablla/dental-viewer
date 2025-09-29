import type { ToothSegment, DentalModel } from '../types/dental'

// Lazy load Three.js to avoid blocking initial bundle
let THREE: any = null;
const loadThreeJS = async () => {
  if (!THREE) {
    THREE = await import('three');
  }
  return THREE;
};

export type LassoMode = 'create' | 'add' | 'subtract' | 'select'

export interface LassoPoint {
  x: number
  y: number
}

export interface LassoOperation {
  mode: LassoMode
  points: LassoPoint[]
  targetSegmentId?: string
  previewVertices?: number[]
}

export class EnhancedLassoService {
  private canvas: HTMLCanvasElement | null = null
  private camera: any = null
  private scene: any = null
  
  // Lasso state
  private isActive = false
  private currentOperation: LassoOperation | null = null
  private lassoPath: SVGPathElement | null = null
  private previewMesh: any = null
  private previewMaterial: any = null
  
  constructor(
    canvas: HTMLCanvasElement,
    camera: any,
    _renderer: any,
    scene: any
  ) {
    this.canvas = canvas
    this.camera = camera
    this.scene = scene
  }
  
  /**
   * Start a lasso operation
   */
  startLasso(mode: LassoMode, startPoint: { x: number, y: number }, targetSegmentId?: string): void {
    this.isActive = true
    this.currentOperation = {
      mode,
      points: [startPoint],
      targetSegmentId,
      previewVertices: []
    }
    
    this.createVisualOverlay()
    this.updateLassoVisual()
  }
  
  /**
   * Update the lasso path with a new point
   */
  async updateLasso(point: { x: number, y: number }): Promise<void> {
    if (!this.isActive || !this.currentOperation) return
    
    const lastPoint = this.currentOperation.points[this.currentOperation.points.length - 1]
    const distance = Math.sqrt(
      Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
    )
    
    // Only add point if it's far enough from the last one (smoothing)
    if (distance > 3) {
      this.currentOperation.points.push(point)
      this.updateLassoVisual()
      
      // Update preview in real-time if in preview mode
      if (this.shouldShowPreview()) {
        await this.updatePreview()
      }
    }
  }
  
  /**
   * Complete the lasso operation and return the result
   */
  async finishLasso(dentalModel: DentalModel): Promise<LassoOperationResult | null> {
    if (!this.isActive || !this.currentOperation || this.currentOperation.points.length < 3) {
      this.cleanup()
      return null
    }
    
    const result = await this.processLassoOperation(dentalModel)
    this.cleanup()
    return result
  }
  
  /**
   * Cancel the current lasso operation
   */
  cancelLasso(): void {
    this.cleanup()
  }
  
  /**
   * Get current lasso mode
   */
  getCurrentMode(): LassoMode | null {
    return this.currentOperation?.mode || null
  }
  
  /**
   * Check if lasso is currently active
   */
  isLassoActive(): boolean {
    return this.isActive
  }
  
  /**
   * Create visual overlay for lasso
   */
  private createVisualOverlay(): void {
    if (!this.canvas) return
    
    this.removeVisualOverlay()
    
    const rect = this.canvas.getBoundingClientRect()
    
    // Create SVG overlay
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.style.position = "absolute"
    svg.style.top = "0"
    svg.style.left = "0"
    svg.style.width = rect.width + "px"
    svg.style.height = rect.height + "px"
    svg.style.pointerEvents = "none"
    svg.style.zIndex = "1000"
    svg.id = "enhanced-lasso-overlay"
    
    // Create path element
    this.lassoPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
    
    // Set visual style based on mode
    const mode = this.currentOperation?.mode
    this.setLassoVisualStyle(mode || 'create')
    
    svg.appendChild(this.lassoPath)
    this.canvas.parentElement?.appendChild(svg)
  }
  
  /**
   * Set visual style based on lasso mode
   */
  private setLassoVisualStyle(mode: LassoMode): void {
    if (!this.lassoPath) return
    
    const styles = {
      create: {
        stroke: "#51CACD",
        fill: "rgba(81, 202, 205, 0.15)",
        strokeDasharray: "5,3"
      },
      add: {
        stroke: "#4AB8BB",
        fill: "rgba(75, 184, 187, 0.15)",
        strokeDasharray: "3,2"
      },
      subtract: {
        stroke: "#ff4444",
        fill: "rgba(255, 68, 68, 0.15)",
        strokeDasharray: "2,2"
      },
      select: {
        stroke: "#3FA4A7",
        fill: "rgba(63, 164, 167, 0.1)",
        strokeDasharray: "4,4"
      }
    }
    
    const style = styles[mode]
    this.lassoPath.setAttribute("stroke", style.stroke)
    this.lassoPath.setAttribute("stroke-width", "2")
    this.lassoPath.setAttribute("fill", style.fill)
    this.lassoPath.setAttribute("stroke-dasharray", style.strokeDasharray)
  }
  
  /**
   * Update the visual representation of the lasso
   */
  private updateLassoVisual(): void {
    if (!this.lassoPath || !this.currentOperation || this.currentOperation.points.length < 2) {
      return
    }
    
    const points = this.currentOperation.points
    let pathData = `M ${points[0].x} ${points[0].y}`
    
    for (let i = 1; i < points.length; i++) {
      pathData += ` L ${points[i].x} ${points[i].y}`
    }
    
    // Close the path if we have enough points
    if (points.length > 2) {
      pathData += ` Z`
    }
    
    this.lassoPath.setAttribute("d", pathData)
  }
  
  /**
   * Check if we should show preview for current mode
   */
  private shouldShowPreview(): boolean {
    const mode = this.currentOperation?.mode
    return mode === 'create' || mode === 'add' || mode === 'subtract'
  }
  
  /**
   * Initialize preview material with lazy-loaded Three.js
   */
  private async initializePreviewMaterial(): Promise<void> {
    if (!this.previewMaterial) {
      const ThreeJS = await loadThreeJS();
      this.previewMaterial = new ThreeJS.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.3,
        side: ThreeJS.DoubleSide
      });
    }
  }

  /**
   * Update preview visualization
   */
  private async updatePreview(): Promise<void> {
    if (!this.currentOperation || !this.scene) return
    
    // Initialize preview material if needed
    await this.initializePreviewMaterial();
    
    // Remove existing preview
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh)
      this.previewMesh = null
    }
    
    // Create new preview based on current lasso area
    // This is a simplified preview - in a real implementation, 
    // you'd calculate which vertices are actually selected
    const ThreeJS = await loadThreeJS();
    const previewGeometry = new ThreeJS.BufferGeometry()
    // Add preview geometry creation logic here
    
    this.previewMesh = new ThreeJS.Mesh(previewGeometry, this.previewMaterial)
    this.scene.add(this.previewMesh)
  }
  
  /**
   * Process the completed lasso operation
   */
  private async processLassoOperation(dentalModel: DentalModel): Promise<LassoOperationResult> {
    if (!this.currentOperation) {
      throw new Error('No active lasso operation')
    }
    
    const selectedVertices = await this.getVerticesInsideLasso(
      dentalModel.originalMesh,
      this.currentOperation.points
    )
    
    return {
      mode: this.currentOperation.mode,
      selectedVertices,
      targetSegmentId: this.currentOperation.targetSegmentId,
      affectedSegments: this.getAffectedSegments(dentalModel, selectedVertices)
    }
  }
  
  /**
   * Get vertices inside the lasso area
   */
  private async getVerticesInsideLasso(mesh: any, lassoPoints: LassoPoint[]): Promise<number[]> {
    if (!this.camera || !this.canvas) return []
    
    const ThreeJS = await loadThreeJS();
    const selectedVertices: number[] = []
    const positions = mesh.geometry.attributes.position
    const vector = new ThreeJS.Vector3()
    const rect = this.canvas.getBoundingClientRect()
    
    for (let i = 0; i < positions.count; i++) {
      vector.fromBufferAttribute(positions, i)
      vector.applyMatrix4(mesh.matrixWorld)
      
      // Project to screen space
      vector.project(this.camera)
      
      const screenX = (vector.x * 0.5 + 0.5) * rect.width
      const screenY = (vector.y * -0.5 + 0.5) * rect.height
      
      if (this.pointInPolygon({ x: screenX, y: screenY }, lassoPoints)) {
        selectedVertices.push(i)
      }
    }
    
    return selectedVertices
  }
  
  /**
   * Point-in-polygon test using ray casting algorithm
   */
  private pointInPolygon(point: { x: number, y: number }, polygon: LassoPoint[]): boolean {
    let inside = false
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x
      const yi = polygon[i].y
      const xj = polygon[j].x
      const yj = polygon[j].y
      
      if (((yi > point.y) !== (yj > point.y)) &&
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    
    return inside
  }
  
  /**
   * Get segments affected by the lasso operation
   */
  private getAffectedSegments(dentalModel: DentalModel, selectedVertices: number[]): ToothSegment[] {
    if (!this.camera || !this.canvas || selectedVertices.length === 0) return []
    
    const affectedSegments: ToothSegment[] = []
    const rect = this.canvas.getBoundingClientRect()
    
    // For each segment, check if its centroid is inside the lasso
    dentalModel.segments.forEach(segment => {
      // Get segment centroid
      const centroid = segment.centroid.clone()
      centroid.applyMatrix4(segment.mesh.matrixWorld)
      
      // Project to screen space
      centroid.project(this.camera!)
      
      const screenX = (centroid.x * 0.5 + 0.5) * rect.width
      const screenY = (centroid.y * -0.5 + 0.5) * rect.height
      
      // Check if centroid is inside lasso
      if (this.pointInPolygon({ x: screenX, y: screenY }, this.currentOperation?.points || [])) {
        affectedSegments.push(segment)
      }
    })
    
    return affectedSegments
  }
  
  /**
   * Clean up visual elements and reset state
   */
  private cleanup(): void {
    this.isActive = false
    this.currentOperation = null
    this.removeVisualOverlay()
    this.removePreview()
  }
  
  /**
   * Remove visual overlay
   */
  private removeVisualOverlay(): void {
    const overlay = document.getElementById("enhanced-lasso-overlay")
    if (overlay) {
      overlay.remove()
    }
    this.lassoPath = null
  }
  
  /**
   * Remove preview mesh
   */
  private removePreview(): void {
    if (this.previewMesh && this.scene) {
      this.scene.remove(this.previewMesh)
      this.previewMesh = null
    }
  }
}

export interface LassoOperationResult {
  mode: LassoMode
  selectedVertices: number[]
  targetSegmentId?: string
  affectedSegments: ToothSegment[]
}
