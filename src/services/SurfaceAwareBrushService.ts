import type { ToothSegment, DentalModel } from '../types/dental'

// Lazy load Three.js to avoid blocking initial bundle
let THREE: any = null;
const loadThreeJS = async () => {
  if (!THREE) {
    THREE = await import('three');
  }
  return THREE;
};

export interface BrushStroke {
  center: { x: number, y: number }
  radius: number
  strength: number
  timestamp: number
}

export interface BrushSelection {
  vertices: number[]
  strokes: BrushStroke[]
  affectedArea: {
    center: THREE.Vector3
    radius: number
  }
}

/**
 * Surface-aware brush selection tool
 * Provides an alternative to lasso selection with continuous brush strokes
 * Only selects vertices on visible surfaces using raytracing
 */
export class SurfaceAwareBrushService {
  private canvas: HTMLCanvasElement | null = null
  private camera: any = null
  private scene: any = null
  private renderer: any = null
  private raycaster: any = null
  
  // Brush state
  private isActive = false
  private currentStrokes: BrushStroke[] = []
  private brushRadius = 15 // pixels
  private brushStrength = 1.0
  private accumulatedVertices = new Set<number>()
  
  // Visual feedback
  private brushCursor: HTMLElement | null = null
  private previewMesh: any = null
  private previewMaterial: any = null
  
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
    this.initializeBrush()
  }
  
  /**
   * Initialize brush components
   */
  private async initializeBrush(): Promise<void> {
    const ThreeJS = await loadThreeJS();
    this.raycaster = new ThreeJS.Raycaster()
    this.createBrushCursor()
  }
  
  /**
   * Start brush selection
   */
  startBrush(x: number, y: number, radius: number = 15): void {
    this.isActive = true
    this.brushRadius = radius
    this.currentStrokes = []
    this.accumulatedVertices.clear()
    
    this.showBrushCursor()
    this.addBrushStroke(x, y)
  }
  
  /**
   * Update brush selection with new stroke
   */
  async updateBrush(x: number, y: number, dentalModel: DentalModel): Promise<BrushSelection | null> {
    if (!this.isActive) return null
    
    this.updateBrushCursor(x, y)
    this.addBrushStroke(x, y)
    
    // Get vertices affected by current brush stroke
    const newVertices = await this.getVerticesUnderBrush(x, y, dentalModel.originalMesh)
    
    // Add to accumulated selection
    newVertices.forEach(v => this.accumulatedVertices.add(v))
    
    // Update preview
    await this.updatePreview(Array.from(this.accumulatedVertices), dentalModel.originalMesh)
    
    return {
      vertices: Array.from(this.accumulatedVertices),
      strokes: [...this.currentStrokes],
      affectedArea: this.calculateAffectedArea()
    }
  }
  
  /**
   * Finish brush selection
   */
  finishBrush(): BrushSelection | null {
    if (!this.isActive || this.accumulatedVertices.size === 0) {
      this.cleanup()
      return null
    }
    
    const selection: BrushSelection = {
      vertices: Array.from(this.accumulatedVertices),
      strokes: [...this.currentStrokes],
      affectedArea: this.calculateAffectedArea()
    }
    
    this.cleanup()
    return selection
  }
  
  /**
   * Cancel brush selection
   */
  cancelBrush(): void {
    this.cleanup()
  }
  
  /**
   * Check if brush is active
   */
  isBrushActive(): boolean {
    return this.isActive
  }
  
  /**
   * Set brush radius
   */
  setBrushRadius(radius: number): void {
    this.brushRadius = Math.max(5, Math.min(100, radius)) // Clamp between 5-100 pixels
    this.updateBrushCursorSize()
  }
  
  /**
   * Get brush radius
   */
  getBrushRadius(): number {
    return this.brushRadius
  }
  
  /**
   * Add a brush stroke
   */
  private addBrushStroke(x: number, y: number): void {
    const stroke: BrushStroke = {
      center: { x, y },
      radius: this.brushRadius,
      strength: this.brushStrength,
      timestamp: Date.now()
    }
    
    this.currentStrokes.push(stroke)
  }
  
  /**
   * Get vertices under brush using surface-aware selection
   * This is the core method that prevents selection of occluded vertices
   */
  private async getVerticesUnderBrush(x: number, y: number, mesh: any): Promise<number[]> {
    if (!this.camera || !this.canvas || !this.raycaster) return []
    
    const ThreeJS = await loadThreeJS();
    const selectedVertices: number[] = []
    
    const positions = mesh.geometry.attributes.position
    const normals = mesh.geometry.attributes.normal
    const vector = new ThreeJS.Vector3()
    const normal = new ThreeJS.Vector3()
    const rect = this.canvas.getBoundingClientRect()
    
    // Get camera direction for backface culling
    const cameraDirection = new ThreeJS.Vector3()
    this.camera.getWorldDirection(cameraDirection)
    
    // Step 1: Cast ray from brush center to find primary surface
    const mouse = new ThreeJS.Vector2()
    mouse.x = (x / rect.width) * 2 - 1
    mouse.y = -(y / rect.height) * 2 + 1
    
    this.raycaster.setFromCamera(mouse, this.camera)
    const intersections = this.raycaster.intersectObject(mesh, false)
    
    if (intersections.length === 0) return []
    
    const primaryIntersection = intersections[0]
    const primaryDistance = primaryIntersection.distance
    const surfaceTolerance = 0.1 // Allow vertices within this distance of the primary surface
    
    console.log(`Brush selection: Found primary surface at distance ${primaryDistance.toFixed(3)}`)
    
    // Step 2: Process vertices within brush radius
    for (let i = 0; i < positions.count; i++) {
      vector.fromBufferAttribute(positions, i)
      vector.applyMatrix4(mesh.matrixWorld)
      
      // Get vertex normal for backface culling
      if (normals) {
        normal.fromBufferAttribute(normals, i)
        normal.transformDirection(mesh.matrixWorld).normalize()
        
        // Skip vertices facing away from camera
        const facingCamera = normal.dot(cameraDirection) < 0
        if (!facingCamera) continue
      }
      
      // Project to screen space
      const screenVector = vector.clone()
      screenVector.project(this.camera)
      
      const screenX = (screenVector.x * 0.5 + 0.5) * rect.width
      const screenY = (screenVector.y * -0.5 + 0.5) * rect.height
      
      // Check if vertex is within brush radius
      const distance = Math.sqrt(
        Math.pow(screenX - x, 2) + Math.pow(screenY - y, 2)
      )
      
      if (distance <= this.brushRadius) {
        // Check if vertex is on or near the primary surface
        const vertexDistance = vector.distanceTo(this.camera.position)
        
        if (Math.abs(vertexDistance - primaryDistance) <= surfaceTolerance) {
          // Additional raycast test to ensure vertex is visible
          const isVisible = await this.isVertexVisible(vector)
          
          if (isVisible) {
            selectedVertices.push(i)
          }
        }
      }
    }
    
    console.log(`Brush selected ${selectedVertices.length} vertices`)
    return selectedVertices
  }
  
  /**
   * Test if a vertex is visible using raytracing
   */
  private async isVertexVisible(worldPosition: any): Promise<boolean> {
    if (!this.raycaster || !this.camera) return false
    
    // Cast ray from camera to vertex
    const direction = worldPosition.clone().sub(this.camera.position).normalize()
    this.raycaster.set(this.camera.position, direction)
    
    const intersections = this.raycaster.intersectObjects(this.scene.children, true)
    
    if (intersections.length === 0) return true
    
    const closestIntersection = intersections[0]
    const vertexDistance = worldPosition.distanceTo(this.camera.position)
    
    // Allow small tolerance for floating point precision
    const tolerance = 0.001
    return vertexDistance <= closestIntersection.distance + tolerance
  }
  
  /**
   * Calculate affected area bounds
   */
  private calculateAffectedArea(): { center: THREE.Vector3, radius: number } {
    // Default values
    const ThreeJS = THREE || { Vector3: class { constructor() { this.x = 0; this.y = 0; this.z = 0; } } };
    const center = new ThreeJS.Vector3()
    let radius = 0
    
    if (this.currentStrokes.length > 0) {
      // Calculate center of all strokes
      let totalX = 0, totalY = 0
      this.currentStrokes.forEach(stroke => {
        totalX += stroke.center.x
        totalY += stroke.center.y
        radius = Math.max(radius, stroke.radius)
      })
      
      center.x = totalX / this.currentStrokes.length
      center.y = totalY / this.currentStrokes.length
      center.z = 0 // Screen space
    }
    
    return { center, radius }
  }
  
  /**
   * Create brush cursor for visual feedback
   */
  private createBrushCursor(): void {
    this.brushCursor = document.createElement('div')
    this.brushCursor.id = 'surface-aware-brush-cursor'
    this.brushCursor.style.position = 'absolute'
    this.brushCursor.style.pointerEvents = 'none'
    this.brushCursor.style.zIndex = '1001'
    this.brushCursor.style.border = '2px solid #00ff88'
    this.brushCursor.style.borderRadius = '50%'
    this.brushCursor.style.backgroundColor = 'rgba(0, 255, 136, 0.1)'
    this.brushCursor.style.display = 'none'
    this.updateBrushCursorSize()
    
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.appendChild(this.brushCursor)
    }
  }
  
  /**
   * Update brush cursor size
   */
  private updateBrushCursorSize(): void {
    if (!this.brushCursor) return
    
    const size = this.brushRadius * 2
    this.brushCursor.style.width = size + 'px'
    this.brushCursor.style.height = size + 'px'
    this.brushCursor.style.marginLeft = -this.brushRadius + 'px'
    this.brushCursor.style.marginTop = -this.brushRadius + 'px'
  }
  
  /**
   * Show brush cursor
   */
  private showBrushCursor(): void {
    if (this.brushCursor) {
      this.brushCursor.style.display = 'block'
    }
  }
  
  /**
   * Hide brush cursor
   */
  private hideBrushCursor(): void {
    if (this.brushCursor) {
      this.brushCursor.style.display = 'none'
    }
  }
  
  /**
   * Update brush cursor position
   */
  private updateBrushCursor(x: number, y: number): void {
    if (!this.brushCursor || !this.canvas) return
    
    const rect = this.canvas.getBoundingClientRect()
    this.brushCursor.style.left = (rect.left + x) + 'px'
    this.brushCursor.style.top = (rect.top + y) + 'px'
  }
  
  /**
   * Initialize preview material
   */
  private async initializePreviewMaterial(): Promise<void> {
    if (!this.previewMaterial) {
      const ThreeJS = await loadThreeJS();
      this.previewMaterial = new ThreeJS.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.6,
        side: ThreeJS.DoubleSide
      });
    }
  }
  
  /**
   * Update preview visualization
   */
  private async updatePreview(selectedVertices: number[], mesh: any): Promise<void> {
    if (!this.scene || selectedVertices.length === 0) return
    
    await this.initializePreviewMaterial()
    
    // Remove existing preview
    if (this.previewMesh) {
      this.scene.remove(this.previewMesh)
      this.previewMesh = null
    }
    
    // Create preview geometry from selected vertices
    const ThreeJS = await loadThreeJS();
    const previewGeometry = new ThreeJS.BufferGeometry()
    
    // Create points from selected vertices
    const positions = mesh.geometry.attributes.position
    const previewPositions = new Float32Array(selectedVertices.length * 3)
    
    selectedVertices.forEach((vertexIndex, i) => {
      previewPositions[i * 3] = positions.getX(vertexIndex)
      previewPositions[i * 3 + 1] = positions.getY(vertexIndex)
      previewPositions[i * 3 + 2] = positions.getZ(vertexIndex)
    })
    
    previewGeometry.setAttribute('position', new ThreeJS.BufferAttribute(previewPositions, 3))
    
    // Create points material for better visualization
    const pointsMaterial = new ThreeJS.PointsMaterial({
      color: 0x00ff88,
      size: 3,
      transparent: true,
      opacity: 0.8
    })
    
    this.previewMesh = new ThreeJS.Points(previewGeometry, pointsMaterial)
    this.previewMesh.matrixWorld.copy(mesh.matrixWorld)
    this.scene.add(this.previewMesh)
  }
  
  /**
   * Clean up brush selection
   */
  private cleanup(): void {
    this.isActive = false
    this.currentStrokes = []
    this.accumulatedVertices.clear()
    this.hideBrushCursor()
    this.removePreview()
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
  
  /**
   * Cleanup on destroy
   */
  destroy(): void {
    this.cleanup()
    if (this.brushCursor && this.brushCursor.parentElement) {
      this.brushCursor.parentElement.removeChild(this.brushCursor)
    }
  }
}