import { Vector3, Mesh, Color } from 'three'

export interface ToothSegment {
  id: string
  name: string
  mesh: Mesh
  originalVertices: Vector3[]
  centroid: Vector3
  color: Color
  isSelected: boolean
  toothType: 'incisor' | 'canine' | 'premolar' | 'molar' | 'gum'
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
  mode: 'select' | 'lasso' | 'brush' | 'move' | 'rotate' | 'merge' | 'split'
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
