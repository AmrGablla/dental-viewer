import { Vector3, Mesh, Color } from 'three'

export type ToothType = 'incisor' | 'canine' | 'premolar' | 'molar' | 'wisdom' | 'gum'

export interface ToothSegment {
  id: string
  name: string
  mesh: Mesh
  originalVertices: Vector3[]
  centroid: Vector3
  color: Color
  toothType: ToothType
  isSelected?: boolean
  movementDistance?: number
  originalPosition?: Vector3
  movementHistory?: {
    totalDistance: number
    axisMovements: {
      anteroposterior: number  // Front-back movement (Z-axis)
      vertical: number         // Up-down movement (Y-axis)
      transverse: number       // Side-to-side movement (X-axis)
    }
    lastMovementType?: 'drag' | 'directional' | 'manual'
    movementCount: number
  }
}

export interface DentalModel {
  originalMesh: Mesh
  segments: ToothSegment[]
  boundingBox: {
    min: Vector3
    max: Vector3
  }
}

export interface InteractionMode {
  mode: 'select' | 'lasso' | 'move' | 'rotate'
}

export interface MovementAxis {
  axis: 'Anteroposterior' | 'Vertical' | 'Transverse' | 'Combined' | 'None'
  distances: {
    anteroposterior: number // Front-back movement (mm)
    vertical: number        // Up-down movement (mm)  
    transverse: number      // Side-to-side movement (mm)
  }
}

export interface ExportData {
  segments: {
    id: string
    name: string
    vertices: number[]
    faces: number[]
    color: string
    toothType: string
  }[]
  metadata: {
    originalFileName: string
    segmentationMethod: string
    exportDate: string
  }
}

export interface SegmentationResult {
  sessionId: string
  originalFile: string
  segments: SegmentData[]
  timestamp: Date
  status: 'processing' | 'completed' | 'failed'
}

export interface SegmentData {
  id: number
  name: string
  filename: string
  pointCount: number
  center: [number, number, number]
  volume: number
  boundingBox?: {
    min: [number, number, number]
    max: [number, number, number]
  }
  downloadUrl: string
  visible: boolean
  selected: boolean
  color: string
  toothType?: string
}
