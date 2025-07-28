import * as THREE from 'three'
import type { ToothSegment } from '../types/dental'

export interface LassoPoint {
  x: number
  y: number
}

export interface BrushStroke {
  points: THREE.Vector3[]
  radius: number
  strength: number
}

export class InteractionService {
  private camera: THREE.Camera
  private scene: THREE.Scene
  private raycaster: THREE.Raycaster
  private mouse: THREE.Vector2
  
  // Lasso selection
  private lassoPoints: LassoPoint[] = []
  private isLassoing = false
  
  // Brush selection
  private brushStrokes: BrushStroke[] = []
  private isBrushing = false
  private currentBrushRadius = 2.0
  
  // Transform controls
  private transformMode: 'translate' | 'rotate' | 'scale' = 'translate'
  private transformGizmo: THREE.Group | null = null

  constructor(camera: THREE.Camera, scene: THREE.Scene) {
    this.camera = camera
    this.scene = scene
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
  }

  // Lasso Selection Methods
  startLasso(x: number, y: number): void {
    this.isLassoing = true
    this.lassoPoints = [{ x, y }]
  }

  updateLasso(x: number, y: number): void {
    if (this.isLassoing) {
      this.lassoPoints.push({ x, y })
    }
  }

  finishLasso(segments: ToothSegment[]): ToothSegment[] {
    if (!this.isLassoing || this.lassoPoints.length < 3) {
      this.isLassoing = false
      this.lassoPoints = []
      return []
    }

    const selectedSegments: ToothSegment[] = []
    
    segments.forEach(segment => {
      // Project segment centroid to screen space
      const screenPosition = this.worldToScreen(segment.centroid)
      
      // Check if point is inside lasso polygon
      if (this.pointInPolygon(screenPosition, this.lassoPoints)) {
        selectedSegments.push(segment)
      }
    })

    this.isLassoing = false
    this.lassoPoints = []
    
    return selectedSegments
  }

  getLassoPoints(): LassoPoint[] {
    return [...this.lassoPoints]
  }

  // Brush Selection Methods
  startBrush(x: number, y: number, radius: number = 2.0): void {
    this.isBrushing = true
    this.currentBrushRadius = radius
    this.brushStrokes = []
    
    // Store initial brush position for reference
    this.mouse.set(x, y)
  }

  updateBrush(x: number, y: number, segments: ToothSegment[]): ToothSegment[] {
    if (!this.isBrushing) return []

    this.mouse.set(x, y)
    this.raycaster.setFromCamera(this.mouse, this.camera)

    const selectedSegments: ToothSegment[] = []
    
    segments.forEach(segment => {
      const intersects = this.raycaster.intersectObject(segment.mesh)
      
      if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point
        
        // Add brush stroke
        this.brushStrokes.push({
          points: [intersectionPoint],
          radius: this.currentBrushRadius,
          strength: 1.0
        })
        
        selectedSegments.push(segment)
      }
    })

    return selectedSegments
  }

  finishBrush(): void {
    this.isBrushing = false
  }

  getBrushStrokes(): BrushStroke[] {
    return [...this.brushStrokes]
  }

  // Transform Methods
  createTransformGizmo(position: THREE.Vector3): void {
    if (this.transformGizmo) {
      this.scene.remove(this.transformGizmo)
    }

    this.transformGizmo = new THREE.Group()
    
    // Create simple transform handles
    const materials = {
      x: new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      y: new THREE.MeshBasicMaterial({ color: 0x00ff00 }),
      z: new THREE.MeshBasicMaterial({ color: 0x0000ff })
    }

    // Translation arrows
    if (this.transformMode === 'translate') {
      const arrowGeometry = new THREE.ConeGeometry(0.2, 1, 8)
      
      // X axis
      const xArrow = new THREE.Mesh(arrowGeometry, materials.x)
      xArrow.position.set(2, 0, 0)
      xArrow.rotateZ(-Math.PI / 2)
      xArrow.userData = { axis: 'x', type: 'translate' }
      this.transformGizmo.add(xArrow)
      
      // Y axis
      const yArrow = new THREE.Mesh(arrowGeometry, materials.y)
      yArrow.position.set(0, 2, 0)
      yArrow.userData = { axis: 'y', type: 'translate' }
      this.transformGizmo.add(yArrow)
      
      // Z axis
      const zArrow = new THREE.Mesh(arrowGeometry, materials.z)
      zArrow.position.set(0, 0, 2)
      zArrow.rotateX(Math.PI / 2)
      zArrow.userData = { axis: 'z', type: 'translate' }
      this.transformGizmo.add(zArrow)
    }
    
    // Rotation rings
    else if (this.transformMode === 'rotate') {
      const ringGeometry = new THREE.TorusGeometry(2, 0.1, 8, 16)
      
      // X axis rotation
      const xRing = new THREE.Mesh(ringGeometry, materials.x)
      xRing.rotateY(Math.PI / 2)
      xRing.userData = { axis: 'x', type: 'rotate' }
      this.transformGizmo.add(xRing)
      
      // Y axis rotation
      const yRing = new THREE.Mesh(ringGeometry, materials.y)
      yRing.rotateX(Math.PI / 2)
      yRing.userData = { axis: 'y', type: 'rotate' }
      this.transformGizmo.add(yRing)
      
      // Z axis rotation
      const zRing = new THREE.Mesh(ringGeometry, materials.z)
      zRing.userData = { axis: 'z', type: 'rotate' }
      this.transformGizmo.add(zRing)
    }

    this.transformGizmo.position.copy(position)
    this.scene.add(this.transformGizmo)
  }

  updateTransformGizmo(position: THREE.Vector3): void {
    if (this.transformGizmo) {
      this.transformGizmo.position.copy(position)
    }
  }

  removeTransformGizmo(): void {
    if (this.transformGizmo) {
      this.scene.remove(this.transformGizmo)
      this.transformGizmo = null
    }
  }

  handleTransformInteraction(
    x: number, 
    y: number, 
    segments: ToothSegment[], 
    deltaMovement: { x: number, y: number }
  ): boolean {
    if (!this.transformGizmo) return false

    this.mouse.set(x, y)
    this.raycaster.setFromCamera(this.mouse, this.camera)

    const intersects = this.raycaster.intersectObject(this.transformGizmo, true)
    
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object
      const userData = intersectedObject.userData
      
      if (userData.type === 'translate') {
        this.applyTranslation(segments, userData.axis, deltaMovement)
        return true
      } else if (userData.type === 'rotate') {
        this.applyRotation(segments, userData.axis, deltaMovement)
        return true
      }
    }

    return false
  }

  private applyTranslation(
    segments: ToothSegment[], 
    axis: string, 
    deltaMovement: { x: number, y: number }
  ): void {
    const delta = new THREE.Vector3()
    
    switch (axis) {
      case 'x':
        delta.x = deltaMovement.x * 0.1
        break
      case 'y':
        delta.y = -deltaMovement.y * 0.1
        break
      case 'z':
        delta.z = deltaMovement.x * 0.1
        break
    }

    segments.forEach(segment => {
      segment.mesh.position.add(delta)
      segment.centroid.add(delta)
    })

    if (this.transformGizmo) {
      this.transformGizmo.position.add(delta)
    }
  }

  private applyRotation(
    segments: ToothSegment[], 
    axis: string, 
    deltaMovement: { x: number, y: number }
  ): void {
    const angle = deltaMovement.x * 0.01
    const rotationAxis = new THREE.Vector3()
    
    switch (axis) {
      case 'x':
        rotationAxis.set(1, 0, 0)
        break
      case 'y':
        rotationAxis.set(0, 1, 0)
        break
      case 'z':
        rotationAxis.set(0, 0, 1)
        break
    }

    // Calculate center point of selected segments
    const center = new THREE.Vector3()
    segments.forEach(segment => center.add(segment.centroid))
    center.divideScalar(segments.length)

    segments.forEach(segment => {
      // Rotate around center point
      const quaternion = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle)
      
      // Translate to origin, rotate, translate back
      segment.mesh.position.sub(center)
      segment.mesh.position.applyQuaternion(quaternion)
      segment.mesh.position.add(center)
      
      segment.mesh.applyQuaternion(quaternion)
      
      // Update centroid
      segment.centroid.sub(center)
      segment.centroid.applyQuaternion(quaternion)
      segment.centroid.add(center)
    })
  }

  // Utility Methods
  private worldToScreen(worldPosition: THREE.Vector3): { x: number, y: number } {
    const vector = worldPosition.clone()
    vector.project(this.camera)
    
    return {
      x: (vector.x + 1) / 2,
      y: (-vector.y + 1) / 2
    }
  }

  private pointInPolygon(point: { x: number, y: number }, polygon: LassoPoint[]): boolean {
    let inside = false
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y
      const xj = polygon[j].x, yj = polygon[j].y
      
      if (((yi > point.y) !== (yj > point.y)) && 
          (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
        inside = !inside
      }
    }
    
    return inside
  }

  // Advanced Selection Methods
  selectByRegion(
    segments: ToothSegment[], 
    startPoint: THREE.Vector2, 
    endPoint: THREE.Vector2
  ): ToothSegment[] {
    const selectedSegments: ToothSegment[] = []
    
    // Create selection rectangle
    const minX = Math.min(startPoint.x, endPoint.x)
    const maxX = Math.max(startPoint.x, endPoint.x)
    const minY = Math.min(startPoint.y, endPoint.y)
    const maxY = Math.max(startPoint.y, endPoint.y)

    segments.forEach(segment => {
      const screenPos = this.worldToScreen(segment.centroid)
      
      if (screenPos.x >= minX && screenPos.x <= maxX &&
          screenPos.y >= minY && screenPos.y <= maxY) {
        selectedSegments.push(segment)
      }
    })

    return selectedSegments
  }

  selectByColor(segments: ToothSegment[], targetColor: THREE.Color, tolerance: number = 0.1): ToothSegment[] {
    return segments.filter(segment => {
      // Calculate color distance manually since distanceTo doesn't exist on Color
      const dr = segment.color.r - targetColor.r
      const dg = segment.color.g - targetColor.g
      const db = segment.color.b - targetColor.b
      const colorDistance = Math.sqrt(dr * dr + dg * dg + db * db)
      return colorDistance <= tolerance
    })
  }

  selectByToothType(segments: ToothSegment[], toothType: string): ToothSegment[] {
    return segments.filter(segment => segment.toothType === toothType)
  }

  selectConnectedRegion(segments: ToothSegment[], seedSegment: ToothSegment, threshold: number = 5.0): ToothSegment[] {
    const selected: ToothSegment[] = [seedSegment]
    const visited = new Set<string>([seedSegment.id])
    const queue = [seedSegment]

    while (queue.length > 0) {
      const current = queue.shift()!
      
      segments.forEach(segment => {
        if (visited.has(segment.id)) return
        
        const distance = current.centroid.distanceTo(segment.centroid)
        if (distance <= threshold) {
          selected.push(segment)
          visited.add(segment.id)
          queue.push(segment)
        }
      })
    }

    return selected
  }

  setTransformMode(mode: 'translate' | 'rotate' | 'scale'): void {
    this.transformMode = mode
  }

  getTransformMode(): 'translate' | 'rotate' | 'scale' {
    return this.transformMode
  }
}
