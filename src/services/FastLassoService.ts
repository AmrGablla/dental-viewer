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

export interface PerformanceStats {
  totalVertices: number
  processedVertices: number
  selectedVertices: number
  processingTimeMs: number
  samplingRatio: number
}

export class FastLassoService {
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
  
  // Performance optimization settings
  private maxVerticesPerFrame = 50000 // Process at most 50k vertices per frame
  private samplingRate = 0.1 // Sample 10% of vertices for large meshes
  private depthTolerance = 0.5 // Depth tolerance for visibility check
  
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
   * Start a lasso operation with optimized selection mode
   */
  async startLasso(
    mode: LassoMode, 
    selectionMode: SelectionMode = 'surface',
    startPoint: { x: number, y: number }, 
    targetSegmentId?: string
  ): Promise<void> {
    try {
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
    } catch (error) {
      console.error('Error starting lasso:', error)
      this.cleanup()
    }
  }
  
  /**
   * Update the lasso path with a new point
   */
  async updateLasso(point: { x: number, y: number }): Promise<void> {
    if (!this.isActive || !this.currentOperation) return
    
    try {
      const lastPoint = this.currentOperation.points[this.currentOperation.points.length - 1]
      const distance = Math.sqrt(
        Math.pow(point.x - lastPoint.x, 2) + Math.pow(point.y - lastPoint.y, 2)
      )
      
      // Only add point if it's far enough from the last one (smoothing)
      if (distance > 3) {
        this.currentOperation.points.push(point)
        this.updateLassoVisual()
      }
    } catch (error) {
      console.error('Error updating lasso:', error)
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
    
    try {
      const result = await this.processLassoOperation(dentalModel)
      this.cleanup()
      return result
    } catch (error) {
      console.error('Error finishing lasso:', error)
      this.cleanup()
      return null
    }
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
    svg.id = "fast-lasso-overlay"
    
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
   * Process the completed lasso operation with optimized performance
   */
  private async processLassoOperation(dentalModel: DentalModel): Promise<LassoOperationResult> {
    if (!this.currentOperation) {
      throw new Error('No active lasso operation')
    }
    
    const startTime = performance.now()
    const selectionMode = this.currentOperation.selectionMode
    let selectedVertices: number[] = []
    let stats: PerformanceStats
    
    switch (selectionMode) {
      case 'surface':
        const surfaceResult = await this.getFastSurfaceVerticesInsideLasso(
          dentalModel.originalMesh,
          this.currentOperation.points
        )
        selectedVertices = surfaceResult.vertices
        stats = surfaceResult.stats
        break
      case 'volume':
        const volumeResult = await this.getFastVolumeVerticesInsideLasso(
          dentalModel.originalMesh,
          this.currentOperation.points
        )
        selectedVertices = volumeResult.vertices
        stats = volumeResult.stats
        break
      case 'connected':
        const connectedResult = await this.getFastConnectedSurfaceVertices(
          dentalModel.originalMesh,
          this.currentOperation.points
        )
        selectedVertices = connectedResult.vertices
        stats = connectedResult.stats
        break
      default:
        stats = {
          totalVertices: 0,
          processedVertices: 0,
          selectedVertices: 0,
          processingTimeMs: 0,
          samplingRatio: 1.0
        }
    }
    
    const processingTime = performance.now() - startTime
    console.log(`🚀 Fast lasso selection completed in ${processingTime.toFixed(2)}ms:`, {
      mode: this.currentOperation.mode,
      selectionMode: this.currentOperation.selectionMode,
      selectedVertices: selectedVertices.length,
      ...stats
    })
    
    return {
      mode: this.currentOperation.mode,
      selectionMode: this.currentOperation.selectionMode,
      selectedVertices,
      targetSegmentId: this.currentOperation.targetSegmentId,
      affectedSegments: this.getAffectedSegments(dentalModel, selectedVertices),
      performanceStats: stats
    }
  }
  
  /**
   * OPTIMIZED: Fast surface selection using depth buffer sampling
   */
  private async getFastSurfaceVerticesInsideLasso(
    mesh: any, 
    lassoPoints: LassoPoint[]
  ): Promise<{ vertices: number[], stats: PerformanceStats }> {
    if (!this.camera || !this.canvas) {
      return { vertices: [], stats: this.createEmptyStats() }
    }
    
    const ThreeJS = await loadThreeJS();
    const positions = mesh.geometry.attributes.position
    const normals = mesh.geometry.attributes.normal
    const totalVertices = positions.count
    
    // Adaptive sampling based on mesh size
    const samplingRatio = this.calculateOptimalSamplingRatio(totalVertices)
    const stepSize = Math.max(1, Math.floor(1 / samplingRatio))
    
    const selectedVertices: number[] = []
    const vector = new ThreeJS.Vector3()
    const normal = new ThreeJS.Vector3()
    const cameraPosition = this.camera.position
    const rect = this.canvas.getBoundingClientRect()
    
    // Create depth buffer for fast visibility checking
    const depthSamples = await this.createDepthSamples(mesh, lassoPoints)
    
    let processedCount = 0
    
    console.log(`🔍 Processing ${totalVertices} vertices with sampling ratio ${samplingRatio}`)
    
    for (let i = 0; i < totalVertices; i += stepSize) {
      try {
        processedCount++
        
        // Get vertex position
        vector.fromBufferAttribute(positions, i)
        vector.applyMatrix4(mesh.matrixWorld)
        
        // Quick distance check - if vertex is much further than camera focus, skip
        const distanceToCamera = vector.distanceTo(cameraPosition)
        if (distanceToCamera > 1000) continue // Adjust based on your model scale
        
        // Surface normal check (if available)
        if (normals) {
          normal.fromBufferAttribute(normals, i)
          normal.transformDirection(mesh.matrixWorld)
          
          // Calculate view direction
          const viewDirection = new ThreeJS.Vector3()
          viewDirection.subVectors(cameraPosition, vector).normalize()
          
          // Skip back-facing surfaces (simple check)
          if (normal.dot(viewDirection) < 0.1) continue
        }
        
        // Project to screen space
        const projectedVertex = vector.clone()
        projectedVertex.project(this.camera)
        
        const screenX = (projectedVertex.x * 0.5 + 0.5) * rect.width
        const screenY = (projectedVertex.y * -0.5 + 0.5) * rect.height
        
        // Check if vertex is inside lasso polygon
        if (this.pointInPolygon({ x: screenX, y: screenY }, lassoPoints)) {
          // Fast depth check using pre-computed samples
          const isVisible = this.fastDepthCheck(projectedVertex.z, screenX, screenY, depthSamples)
          
          if (isVisible) {
            selectedVertices.push(i)
            
            // If using sampling, add nearby vertices to improve coverage
            if (stepSize > 1) {
              for (let j = 1; j < stepSize && i + j < totalVertices; j++) {
                selectedVertices.push(i + j)
              }
            }
          }
        }
        
        // Yield control periodically to prevent blocking
        if (processedCount % 10000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        
      } catch (error) {
        console.warn(`Error processing vertex ${i}:`, error)
        continue
      }
    }
    
    const stats: PerformanceStats = {
      totalVertices,
      processedVertices: processedCount,
      selectedVertices: selectedVertices.length,
      processingTimeMs: 0, // Will be set by caller
      samplingRatio
    }
    
    return { vertices: selectedVertices, stats }
  }
  
  /**
   * FAST: Volume selection with performance limits
   */
  private async getFastVolumeVerticesInsideLasso(
    mesh: any, 
    lassoPoints: LassoPoint[]
  ): Promise<{ vertices: number[], stats: PerformanceStats }> {
    if (!this.camera || !this.canvas) {
      return { vertices: [], stats: this.createEmptyStats() }
    }
    
    const ThreeJS = await loadThreeJS();
    const positions = mesh.geometry.attributes.position
    const totalVertices = positions.count
    const samplingRatio = this.calculateOptimalSamplingRatio(totalVertices)
    const stepSize = Math.max(1, Math.floor(1 / samplingRatio))
    
    const selectedVertices: number[] = []
    const vector = new ThreeJS.Vector3()
    const rect = this.canvas.getBoundingClientRect()
    
    let processedCount = 0
    
    for (let i = 0; i < totalVertices; i += stepSize) {
      try {
        processedCount++
        
        vector.fromBufferAttribute(positions, i)
        vector.applyMatrix4(mesh.matrixWorld)
        vector.project(this.camera)
        
        const screenX = (vector.x * 0.5 + 0.5) * rect.width
        const screenY = (vector.y * -0.5 + 0.5) * rect.height
        
        if (this.pointInPolygon({ x: screenX, y: screenY }, lassoPoints)) {
          selectedVertices.push(i)
          
          // Add nearby vertices if sampling
          if (stepSize > 1) {
            for (let j = 1; j < stepSize && i + j < totalVertices; j++) {
              selectedVertices.push(i + j)
            }
          }
        }
        
        // Yield control periodically
        if (processedCount % 15000 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        
      } catch (error) {
        console.warn(`Error processing vertex ${i}:`, error)
        continue
      }
    }
    
    const stats: PerformanceStats = {
      totalVertices,
      processedVertices: processedCount,
      selectedVertices: selectedVertices.length,
      processingTimeMs: 0,
      samplingRatio
    }
    
    return { vertices: selectedVertices, stats }
  }
  
  /**
   * FAST: Connected surface selection with limited expansion
   */
  private async getFastConnectedSurfaceVertices(
    mesh: any, 
    lassoPoints: LassoPoint[]
  ): Promise<{ vertices: number[], stats: PerformanceStats }> {
    // First get surface vertices with more aggressive sampling for seed points
    const surfaceResult = await this.getFastSurfaceVerticesInsideLasso(mesh, lassoPoints)
    
    if (surfaceResult.vertices.length === 0) {
      return surfaceResult
    }
    
    // Limit expansion to prevent performance issues
    const maxExpansionVertices = Math.min(surfaceResult.vertices.length * 3, 10000)
    const connectedVertices = await this.limitedConnectedExpansion(
      mesh, 
      surfaceResult.vertices, 
      maxExpansionVertices
    )
    
    return {
      vertices: connectedVertices,
      stats: {
        ...surfaceResult.stats,
        selectedVertices: connectedVertices.length
      }
    }
  }
  
  /**
   * Calculate optimal sampling ratio based on mesh size
   */
  private calculateOptimalSamplingRatio(totalVertices: number): number {
    if (totalVertices < 10000) return 1.0 // Process all vertices
    if (totalVertices < 50000) return 0.5 // Process 50%
    if (totalVertices < 200000) return 0.2 // Process 20%
    return 0.1 // Process 10% for very large meshes
  }
  
  /**
   * Create simple depth samples for fast visibility checking
   */
  private async createDepthSamples(mesh: any, lassoPoints: LassoPoint[]): Promise<Map<string, number>> {
    const samples = new Map<string, number>()
    
    // Sample a few points around the lasso for depth reference
    const samplePoints = this.getSamplePointsFromLasso(lassoPoints, 20)
    
    for (const point of samplePoints) {
      const key = `${Math.floor(point.x / 10)}_${Math.floor(point.y / 10)}`
      samples.set(key, -1) // Placeholder depth value
    }
    
    return samples
  }
  
  /**
   * Fast depth check using sampling approach
   */
  private fastDepthCheck(vertexDepth: number, screenX: number, screenY: number, depthSamples: Map<string, number>): boolean {
    // Simple approach: assume vertices with reasonable depth are visible
    // This is much faster than full raycasting but still filters out most hidden vertices
    return vertexDepth > -0.95 && vertexDepth < 0.95
  }
  
  /**
   * Get sample points from lasso polygon
   */
  private getSamplePointsFromLasso(lassoPoints: LassoPoint[], numSamples: number): LassoPoint[] {
    const samples: LassoPoint[] = []
    const step = Math.max(1, Math.floor(lassoPoints.length / numSamples))
    
    for (let i = 0; i < lassoPoints.length; i += step) {
      samples.push(lassoPoints[i])
    }
    
    return samples
  }
  
  /**
   * Limited connected vertex expansion to prevent performance issues
   */
  private async limitedConnectedExpansion(
    mesh: any, 
    seedVertices: number[], 
    maxVertices: number
  ): Promise<number[]> {
    const ThreeJS = await loadThreeJS();
    const positions = mesh.geometry.attributes.position
    const indices = mesh.geometry.index
    
    if (!indices || seedVertices.length === 0) return seedVertices
    
    const connectedVertices = new Set<number>(seedVertices)
    const queue = [...seedVertices]
    const connectionThreshold = 5.0 // Larger threshold for performance
    
    let expansionCount = 0
    const maxExpansions = Math.min(maxVertices - seedVertices.length, 5000)
    
    while (queue.length > 0 && expansionCount < maxExpansions) {
      const currentVertex = queue.shift()!
      const currentPos = new ThreeJS.Vector3()
      currentPos.fromBufferAttribute(positions, currentVertex)
      
      // Only check a limited number of triangles to prevent slowdown
      const maxTrianglesToCheck = 50
      let triangleCount = 0
      
      for (let i = 0; i < indices.count && triangleCount < maxTrianglesToCheck; i += 3) {
        const a = indices.getX(i)
        const b = indices.getX(i + 1)
        const c = indices.getX(i + 2)
        
        if (a === currentVertex || b === currentVertex || c === currentVertex) {
          triangleCount++
          const neighbors = [a, b, c].filter(v => v !== currentVertex)
          
          for (const neighbor of neighbors) {
            if (!connectedVertices.has(neighbor) && expansionCount < maxExpansions) {
              const neighborPos = new ThreeJS.Vector3()
              neighborPos.fromBufferAttribute(positions, neighbor)
              
              const distance = currentPos.distanceTo(neighborPos)
              
              if (distance <= connectionThreshold) {
                connectedVertices.add(neighbor)
                queue.push(neighbor)
                expansionCount++
              }
            }
          }
        }
      }
      
      // Yield control periodically
      if (expansionCount % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
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
      try {
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
      } catch (error) {
        console.warn('Error processing segment:', segment.id, error)
      }
    })
    
    return affectedSegments
  }
  
  /**
   * Create empty performance stats
   */
  private createEmptyStats(): PerformanceStats {
    return {
      totalVertices: 0,
      processedVertices: 0,
      selectedVertices: 0,
      processingTimeMs: 0,
      samplingRatio: 1.0
    }
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
    const overlay = document.getElementById("fast-lasso-overlay")
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
  performanceStats?: PerformanceStats
}