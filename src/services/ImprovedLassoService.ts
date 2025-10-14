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
export type SelectionMode = 'surface' | 'volume' | 'connected'

export interface LassoPoint {
  x: number
  y: number
}

export interface LassoOperation {
  mode: LassoMode
  selectionMode: SelectionMode
  points: LassoPoint[]
  targetSegmentId?: string
  previewVertices?: number[]
}

export interface RaycastResult {
  vertexIndex: number
  face: any
  point: any
  normal: any
  distance: number
  isVisible: boolean
}

export class ImprovedLassoService {
  private canvas: HTMLCanvasElement | null = null
  private camera: any = null
  private scene: any = null
  private renderer: any = null
  private raycaster: any = null
  
  // Lasso state
  private isActive = false
  private currentOperation: LassoOperation | null = null
  private lassoPath: SVGPathElement | null = null
  private previewMesh: any = null
  private previewMaterial: any = null
  
  // Performance optimization
  private depthTexture: any = null
  private frameBuffer: any = null
  
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
  }

  /**
   * Initialize raycaster and depth testing utilities
   */
  private async initializeRaycaster(): Promise<void> {
    if (!this.raycaster) {
      const ThreeJS = await loadThreeJS();
      this.raycaster = new ThreeJS.Raycaster();
      // Set raycaster precision for better vertex selection
      this.raycaster.params.Points.threshold = 0.1;
      this.raycaster.params.Line.threshold = 0.1;
    }
  }
  
  /**
   * Start a lasso operation with improved selection mode
   */
  async startLasso(
    mode: LassoMode, 
    selectionMode: SelectionMode = 'surface',
    startPoint: { x: number, y: number }, 
    targetSegmentId?: string
  ): Promise<void> {
    await this.initializeRaycaster();
    
    this.isActive = true
    this.currentOperation = {
      mode,
      selectionMode,
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
   * Get current selection mode
   */
  getCurrentSelectionMode(): SelectionMode | null {
    return this.currentOperation?.selectionMode || null
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
    svg.id = "improved-lasso-overlay"
    
    // Create path element
    this.lassoPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
    
    // Set visual style based on mode and selection type
    this.setLassoVisualStyle()
    
    svg.appendChild(this.lassoPath)
    this.canvas.parentElement?.appendChild(svg)
  }
  
  /**
   * Set visual style based on lasso mode and selection mode
   */
  private setLassoVisualStyle(): void {
    if (!this.lassoPath || !this.currentOperation) return
    
    const mode = this.currentOperation.mode
    const selectionMode = this.currentOperation.selectionMode
    
    const baseStyles = {
      create: { color: "#51CACD", opacity: 0.15 },
      add: { color: "#4AB8BB", opacity: 0.15 },
      subtract: { color: "#ff4444", opacity: 0.15 },
      select: { color: "#3FA4A7", opacity: 0.1 }
    }
    
    const selectionStyles = {
      surface: { dasharray: "5,3", width: "2" },
      volume: { dasharray: "8,4", width: "3" },
      connected: { dasharray: "3,2,1,2", width: "2" }
    }
    
    const baseStyle = baseStyles[mode] || baseStyles.create
    const selectionStyle = selectionStyles[selectionMode] || selectionStyles.surface
    
    this.lassoPath.setAttribute("stroke", baseStyle.color)
    this.lassoPath.setAttribute("stroke-width", selectionStyle.width)
    this.lassoPath.setAttribute("fill", `rgba(${this.hexToRgb(baseStyle.color)}, ${baseStyle.opacity})`)
    this.lassoPath.setAttribute("stroke-dasharray", selectionStyle.dasharray)
  }
  
  /**
   * Helper to convert hex to RGB for rgba string
   */
  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return "0, 0, 0"
    
    const r = parseInt(result[1], 16)
    const g = parseInt(result[2], 16)
    const b = parseInt(result[3], 16)
    return `${r}, ${g}, ${b}`
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
    
    const selectionMode = this.currentOperation.selectionMode
    let selectedVertices: number[] = []
    
    switch (selectionMode) {
      case 'surface':
        selectedVertices = await this.getVisibleVerticesInsideLasso(
          dentalModel.originalMesh,
          this.currentOperation.points
        )
        break
      case 'volume':
        selectedVertices = await this.getVolumeVerticesInsideLasso(
          dentalModel.originalMesh,
          this.currentOperation.points
        )
        break
      case 'connected':
        selectedVertices = await this.getConnectedSurfaceVertices(
          dentalModel.originalMesh,
          this.currentOperation.points
        )
        break
    }
    
    return {
      mode: this.currentOperation.mode,
      selectionMode: this.currentOperation.selectionMode,
      selectedVertices,
      targetSegmentId: this.currentOperation.targetSegmentId,
      affectedSegments: this.getAffectedSegments(dentalModel, selectedVertices)
    }
  }
  
  /**
   * IMPROVED: Get only visible surface vertices inside the lasso area
   * This fixes the main issue by using raycasting and depth testing
   */
  private async getVisibleVerticesInsideLasso(mesh: any, lassoPoints: LassoPoint[]): Promise<number[]> {
    if (!this.camera || !this.canvas || !this.raycaster) return []
    
    const ThreeJS = await loadThreeJS();
    const selectedVertices: number[] = []
    const positions = mesh.geometry.attributes.position
    const normals = mesh.geometry.attributes.normal
    const vector = new ThreeJS.Vector3()
    const normal = new ThreeJS.Vector3()
    const rect = this.canvas.getBoundingClientRect()
    
    // Create a temporary raycaster for depth testing
    const tempRaycaster = new ThreeJS.Raycaster()
    const rayDirection = new ThreeJS.Vector3()
    
    console.log(`🎯 Starting surface-only lasso selection for ${positions.count} vertices...`)
    
    for (let i = 0; i < positions.count; i++) {
      vector.fromBufferAttribute(positions, i)
      vector.applyMatrix4(mesh.matrixWorld)
      
      // Get vertex normal for surface facing check
      if (normals) {
        normal.fromBufferAttribute(normals, i)
        normal.transformDirection(mesh.matrixWorld)
        
        // Calculate view direction
        rayDirection.subVectors(this.camera.position, vector).normalize()
        
        // Skip vertices on surfaces facing away from camera
        if (normal.dot(rayDirection) < 0.1) {
          continue
        }
      }
      
      // Project to screen space
      const projectedVertex = vector.clone()
      projectedVertex.project(this.camera)
      
      const screenX = (projectedVertex.x * 0.5 + 0.5) * rect.width
      const screenY = (projectedVertex.y * -0.5 + 0.5) * rect.height
      
      // Check if vertex is inside lasso polygon
      if (this.pointInPolygon({ x: screenX, y: screenY }, lassoPoints)) {
        // DEPTH TEST: Use raycasting to check if vertex is visible
        const isVisible = await this.isVertexVisible(vector, mesh, tempRaycaster)
        
        if (isVisible) {
          selectedVertices.push(i)
        }
      }
    }
    
    console.log(`✅ Surface-only selection complete: ${selectedVertices.length} visible vertices selected`)
    return selectedVertices
  }
  
  /**
   * Check if a vertex is visible (not occluded) using raycasting
   */
  private async isVertexVisible(worldPosition: any, mesh: any, raycaster: any): Promise<boolean> {
    const ThreeJS = await loadThreeJS();
    
    // Cast ray from camera to vertex
    const rayDirection = new ThreeJS.Vector3()
    rayDirection.subVectors(worldPosition, this.camera.position).normalize()
    
    raycaster.set(this.camera.position, rayDirection)
    
    // Get all intersections
    const intersects = raycaster.intersectObject(mesh, false)
    
    if (intersects.length === 0) return true
    
    // Check if the first intersection is close to our target vertex
    const firstIntersection = intersects[0]
    const distanceToVertex = this.camera.position.distanceTo(worldPosition)
    const distanceToFirstHit = firstIntersection.distance
    
    // If the first hit is very close to our vertex (within tolerance), it's visible
    const tolerance = 0.1
    return Math.abs(distanceToFirstHit - distanceToVertex) < tolerance
  }
  
  /**
   * FALLBACK: Get all vertices inside lasso (original behavior)
   */
  private async getVolumeVerticesInsideLasso(mesh: any, lassoPoints: LassoPoint[]): Promise<number[]> {
    if (!this.camera || !this.canvas) return []
    
    const ThreeJS = await loadThreeJS();
    const selectedVertices: number[] = []
    const positions = mesh.geometry.attributes.position
    const vector = new ThreeJS.Vector3()
    const rect = this.canvas.getBoundingClientRect()
    
    console.log(`📦 Starting volume lasso selection for ${positions.count} vertices...`)
    
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
    
    console.log(`✅ Volume selection complete: ${selectedVertices.length} vertices selected`)
    return selectedVertices
  }
  
  /**
   * NEW: Get connected surface vertices for better tooth segmentation
   */
  private async getConnectedSurfaceVertices(mesh: any, lassoPoints: LassoPoint[]): Promise<number[]> {
    console.log(`🔗 Starting connected surface selection...`)
    
    // First get visible surface vertices
    const seedVertices = await this.getVisibleVerticesInsideLasso(mesh, lassoPoints)
    
    if (seedVertices.length === 0) return []
    
    // Then expand selection to connected vertices
    const connectedVertices = await this.expandToConnectedVertices(mesh, seedVertices)
    
    console.log(`✅ Connected surface selection complete: ${connectedVertices.length} vertices selected`)
    return connectedVertices
  }
  
  /**
   * Expand selection to connected vertices (for tooth segmentation)
   */
  private async expandToConnectedVertices(mesh: any, seedVertices: number[]): Promise<number[]> {
    const ThreeJS = await loadThreeJS();
    const positions = mesh.geometry.attributes.position
    const indices = mesh.geometry.index
    
    if (!indices) return seedVertices // Can't expand without index
    
    const connectedVertices = new Set<number>(seedVertices)
    const queue = [...seedVertices]
    const visited = new Set<number>(seedVertices)
    
    // Distance threshold for connected vertices (adjust for dental models)
    const connectionThreshold = 2.0
    
    while (queue.length > 0) {
      const currentVertex = queue.shift()!
      const currentPos = new ThreeJS.Vector3()
      currentPos.fromBufferAttribute(positions, currentVertex)
      
      // Find triangles that include this vertex
      for (let i = 0; i < indices.count; i += 3) {
        const a = indices.getX(i)
        const b = indices.getX(i + 1)
        const c = indices.getX(i + 2)
        
        // If current vertex is part of this triangle
        if (a === currentVertex || b === currentVertex || c === currentVertex) {
          const neighbors = [a, b, c].filter(v => v !== currentVertex)
          
          for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
              const neighborPos = new ThreeJS.Vector3()
              neighborPos.fromBufferAttribute(positions, neighbor)
              
              const distance = currentPos.distanceTo(neighborPos)
              
              if (distance <= connectionThreshold) {
                visited.add(neighbor)
                connectedVertices.add(neighbor)
                queue.push(neighbor)
              }
            }
          }
        }
      }
    }
    
    return Array.from(connectedVertices)
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
    const overlay = document.getElementById("improved-lasso-overlay")
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
  selectionMode: SelectionMode
  selectedVertices: number[]
  targetSegmentId?: string
  affectedSegments: ToothSegment[]
}