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

export interface DepthTestResult {
  vertices: number[]
  faces: number[]
  surfacePoints: Array<{
    vertex: number
    worldPosition: THREE.Vector3
    screenPosition: { x: number, y: number }
    depth: number
    isVisible: boolean
  }>
}

/**
 * Enhanced Lasso Service with depth-aware selection
 * Solves the issue of selecting vertices behind intended surfaces
 */
export class DepthAwareLassoService {
  private canvas: HTMLCanvasElement | null = null
  private camera: any = null
  private scene: any = null
  private renderer: any = null
  
  // Lasso state
  private isActive = false
  private currentOperation: LassoOperation | null = null
  private lassoPath: SVGPathElement | null = null
  private previewMesh: any = null
  private previewMaterial: any = null
  
  // Depth testing components
  private raycaster: any = null
  private depthBuffer: Float32Array | null = null
  private renderTarget: any = null
  
  constructor(
    canvas: HTMLCanvasElement,
    camera: any,
    renderer: any,
    scene: any
  ) {
    this.canvas = canvas
    this.camera = camera
    this.renderer = renderer
    this.scene = scene
    this.initializeDepthTesting()
  }
  
  /**
   * Initialize depth testing components
   */
  private async initializeDepthTesting(): Promise<void> {
    const ThreeJS = await loadThreeJS();
    this.raycaster = new ThreeJS.Raycaster()
    
    // Create render target for depth buffer access
    this.renderTarget = new ThreeJS.WebGLRenderTarget(
      this.canvas?.width || 800, 
      this.canvas?.height || 600, 
      {
        minFilter: ThreeJS.NearestFilter,
        magFilter: ThreeJS.NearestFilter,
        format: ThreeJS.RGBAFormat,
        type: ThreeJS.FloatType,
        depthBuffer: true,
        stencilBuffer: false
      }
    )
  }
  
  /**
   * Start a depth-aware lasso operation
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
    
    const result = await this.processDepthAwareLassoOperation(dentalModel)
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
   * Process the completed lasso operation with depth awareness
   */
  private async processDepthAwareLassoOperation(dentalModel: DentalModel): Promise<LassoOperationResult> {
    if (!this.currentOperation) {
      throw new Error('No active lasso operation')
    }
    
    // Perform depth-aware vertex selection
    const depthTestResult = await this.getVisibleVerticesInsideLasso(
      dentalModel.originalMesh,
      this.currentOperation.points
    )
    
    return {
      mode: this.currentOperation.mode,
      selectedVertices: depthTestResult.vertices,
      targetSegmentId: this.currentOperation.targetSegmentId,
      affectedSegments: this.getAffectedSegments(dentalModel, depthTestResult.vertices),
      depthTestResult // Additional information about the selection
    }
  }
  
  /**
   * Get vertices inside the lasso area that are actually visible (depth-aware selection)
   * This is the core improvement that fixes the "selecting surfaces behind" issue
   */
  private async getVisibleVerticesInsideLasso(mesh: any, lassoPoints: LassoPoint[]): Promise<DepthTestResult> {
    if (!this.camera || !this.canvas || !this.raycaster) {
      return { vertices: [], faces: [], surfacePoints: [] }
    }
    
    const ThreeJS = await loadThreeJS();
    const selectedVertices: number[] = []
    const selectedFaces: number[] = []
    const surfacePoints: DepthTestResult['surfacePoints'] = []
    
    const positions = mesh.geometry.attributes.position
    const normals = mesh.geometry.attributes.normal
    const vector = new ThreeJS.Vector3()
    const normal = new ThreeJS.Vector3()
    const rect = this.canvas.getBoundingClientRect()
    
    // Step 1: Get camera direction for backface culling
    const cameraDirection = new ThreeJS.Vector3()
    this.camera.getWorldDirection(cameraDirection)
    
    // Step 2: Create depth buffer by rendering scene to render target
    const depthMap = await this.renderDepthBuffer()
    
    console.log(`Processing ${positions.count} vertices for depth-aware lasso selection`)
    
    // Step 3: Process vertices with multiple filtering layers
    for (let i = 0; i < positions.count; i++) {
      vector.fromBufferAttribute(positions, i)
      vector.applyMatrix4(mesh.matrixWorld)
      
      // Get vertex normal for backface culling
      if (normals) {
        normal.fromBufferAttribute(normals, i)
        normal.transformDirection(mesh.matrixWorld).normalize()
        
        // Skip vertices facing away from camera (backface culling)
        const facingCamera = normal.dot(cameraDirection) < 0 // Negative because normal points outward
        if (!facingCamera) {
          continue
        }
      }
      
      // Project to screen space
      const screenVector = vector.clone()
      screenVector.project(this.camera)
      
      // Convert to pixel coordinates
      const screenX = (screenVector.x * 0.5 + 0.5) * rect.width
      const screenY = (screenVector.y * -0.5 + 0.5) * rect.height
      const depth = screenVector.z
      
      // Skip vertices outside screen bounds
      if (screenX < 0 || screenX >= rect.width || screenY < 0 || screenY >= rect.height) {
        continue
      }
      
      // Check if point is inside lasso polygon
      if (this.pointInPolygon({ x: screenX, y: screenY }, lassoPoints)) {
        // Step 4: Perform ray-based occlusion test
        const isVisible = await this.isVertexVisible(vector, screenX, screenY, depth, depthMap)
        
        const surfacePoint = {
          vertex: i,
          worldPosition: vector.clone(),
          screenPosition: { x: screenX, y: screenY },
          depth: depth,
          isVisible: isVisible
        }
        
        surfacePoints.push(surfacePoint)
        
        // Only add visible vertices
        if (isVisible) {
          selectedVertices.push(i)
        }
      }
    }
    
    console.log(`Selected ${selectedVertices.length} visible vertices out of ${surfacePoints.length} candidates`)
    
    return {
      vertices: selectedVertices,
      faces: selectedFaces,
      surfacePoints: surfacePoints
    }
  }
  
  /**
   * Render scene to depth buffer for occlusion testing
   */
  private async renderDepthBuffer(): Promise<Float32Array | null> {
    if (!this.renderer || !this.renderTarget) return null
    
    try {
      // Render scene to depth buffer
      this.renderer.setRenderTarget(this.renderTarget)
      this.renderer.render(this.scene, this.camera)
      this.renderer.setRenderTarget(null)
      
      // Read depth buffer (this is a simplified approach)
      // In practice, you might need a more sophisticated depth reading mechanism
      return null // Placeholder for actual depth buffer reading
    } catch (error) {
      console.warn('Failed to render depth buffer:', error)
      return null
    }
  }
  
  /**
   * Test if a vertex is visible using raytracing
   * This is the key method that prevents selection of occluded vertices
   */
  private async isVertexVisible(
    worldPosition: any,
    screenX: number,
    screenY: number,
    depth: number,
    depthMap: Float32Array | null
  ): Promise<boolean> {
    if (!this.raycaster || !this.camera) return false
    
    const ThreeJS = await loadThreeJS();
    
    // Method 1: Raycast-based occlusion test
    const mouse = new ThreeJS.Vector2()
    mouse.x = (screenX / (this.canvas?.getBoundingClientRect().width || 800)) * 2 - 1
    mouse.y = -(screenY / (this.canvas?.getBoundingClientRect().height || 600)) * 2 + 1
    
    this.raycaster.setFromCamera(mouse, this.camera)
    
    // Cast ray and check if this vertex is the closest intersection
    const intersections = this.raycaster.intersectObjects(this.scene.children, true)
    
    if (intersections.length === 0) {
      return true // No obstructions
    }
    
    const closestIntersection = intersections[0]
    const intersectionDistance = closestIntersection.distance
    const vertexDistance = worldPosition.distanceTo(this.camera.position)
    
    // Allow small tolerance for floating point precision
    const tolerance = 0.001
    return vertexDistance <= intersectionDistance + tolerance
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
    svg.id = "depth-aware-lasso-overlay"
    
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
        stroke: "#00ff88",
        fill: "rgba(0, 255, 136, 0.15)",
        strokeDasharray: "5,3"
      },
      add: {
        stroke: "#00aa66",
        fill: "rgba(0, 170, 102, 0.15)",
        strokeDasharray: "3,2"
      },
      subtract: {
        stroke: "#ff4444",
        fill: "rgba(255, 68, 68, 0.15)",
        strokeDasharray: "2,2"
      },
      select: {
        stroke: "#0088ff",
        fill: "rgba(0, 136, 255, 0.1)",
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
        color: 0x00ff88,
        transparent: true,
        opacity: 0.4,
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
    const ThreeJS = await loadThreeJS();
    const previewGeometry = new ThreeJS.BufferGeometry()
    // Add preview geometry creation logic here
    
    this.previewMesh = new ThreeJS.Mesh(previewGeometry, this.previewMaterial)
    this.scene.add(this.previewMesh)
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
    const overlay = document.getElementById("depth-aware-lasso-overlay")
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
  depthTestResult?: DepthTestResult
}