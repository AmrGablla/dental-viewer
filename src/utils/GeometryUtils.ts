import { Vector3, BufferGeometry, BufferAttribute } from 'three'

export class GeometryUtils {
  /**
   * Calculate vertex normals if they don't exist
   */
  static ensureVertexNormals(geometry: BufferGeometry): void {
    if (!geometry.getAttribute('normal')) {
      geometry.computeVertexNormals()
    }
  }

  /**
   * Get vertex neighbors based on geometric proximity
   */
  static getVertexNeighbors(
    vertexIndex: number, 
    position: BufferAttribute, 
    radius: number = 2.0
  ): number[] {
    const vertex = new Vector3().fromBufferAttribute(position, vertexIndex)
    const neighbors: number[] = []
    
    for (let i = 0; i < position.count; i++) {
      if (i === vertexIndex) continue
      
      const neighbor = new Vector3().fromBufferAttribute(position, i)
      if (vertex.distanceTo(neighbor) <= radius) {
        neighbors.push(i)
      }
    }
    
    return neighbors
  }

  /**
   * Calculate Gaussian curvature at a vertex
   */
  static calculateGaussianCurvature(
    vertexIndex: number,
    position: BufferAttribute,
    _normal: BufferAttribute
  ): number {
    const vertex = new Vector3().fromBufferAttribute(position, vertexIndex)
    
    const neighbors = this.getVertexNeighbors(vertexIndex, position, 3.0)
    if (neighbors.length < 3) return 0
    
    let angleSum = 0
    let area = 0
    
    // Calculate approximate Gaussian curvature using angle deficit
    for (let i = 0; i < neighbors.length; i++) {
      const next = (i + 1) % neighbors.length
      
      const v1 = new Vector3().fromBufferAttribute(position, neighbors[i])
      const v2 = new Vector3().fromBufferAttribute(position, neighbors[next])
      
      const edge1 = v1.clone().sub(vertex).normalize()
      const edge2 = v2.clone().sub(vertex).normalize()
      
      const angle = Math.acos(Math.max(-1, Math.min(1, edge1.dot(edge2))))
      angleSum += angle
      
      // Calculate area contribution
      const triangleArea = edge1.clone().cross(edge2).length() * 0.5
      area += triangleArea
    }
    
    if (area === 0) return 0
    
    // Gaussian curvature = (2π - angle sum) / area
    return (2 * Math.PI - angleSum) / area
  }

  /**
   * Calculate mean curvature at a vertex
   */
  static calculateMeanCurvature(
    vertexIndex: number,
    position: BufferAttribute,
    normal: BufferAttribute
  ): number {
    const vertex = new Vector3().fromBufferAttribute(position, vertexIndex)
    const vertexNormal = new Vector3().fromBufferAttribute(normal, vertexIndex)
    
    const neighbors = this.getVertexNeighbors(vertexIndex, position, 2.5)
    if (neighbors.length === 0) return 0
    
    let meanCurvature = 0
    let totalWeight = 0
    
    for (const neighborIndex of neighbors) {
      const neighbor = new Vector3().fromBufferAttribute(position, neighborIndex)
      const neighborNormal = new Vector3().fromBufferAttribute(normal, neighborIndex)
      
      const distance = vertex.distanceTo(neighbor)
      if (distance === 0) continue
      
      const weight = 1.0 / distance
      const normalDiff = vertexNormal.angleTo(neighborNormal)
      
      meanCurvature += normalDiff * weight
      totalWeight += weight
    }
    
    return totalWeight > 0 ? meanCurvature / totalWeight : 0
  }

  /**
   * Detect concave regions using local geometry analysis
   */
  static calculateConcavity(
    vertexIndex: number,
    position: BufferAttribute,
    normal: BufferAttribute
  ): number {
    const vertex = new Vector3().fromBufferAttribute(position, vertexIndex)
    const vertexNormal = new Vector3().fromBufferAttribute(normal, vertexIndex)
    
    const neighbors = this.getVertexNeighbors(vertexIndex, position, 3.0)
    if (neighbors.length < 3) return 0
    
    let concavityScore = 0
    
    // Calculate the average position of neighbors
    const centroid = new Vector3()
    for (const neighborIndex of neighbors) {
      const neighbor = new Vector3().fromBufferAttribute(position, neighborIndex)
      centroid.add(neighbor)
    }
    centroid.divideScalar(neighbors.length)
    
    // Vector from vertex to centroid
    const toCentroid = centroid.clone().sub(vertex)
    
    // Dot product with normal indicates concavity/convexity
    const dotProduct = toCentroid.normalize().dot(vertexNormal)
    
    // Negative dot product indicates concave region
    concavityScore = -dotProduct
    
    return Math.max(0, concavityScore)
  }

  /**
   * DBSCAN clustering algorithm for vertex grouping
   */
  static dbscanClustering(
    vertices: Vector3[],
    epsilon: number = 2.0,
    minPoints: number = 5
  ): number[][] {
    const clusters: number[][] = []
    const visited = new Array(vertices.length).fill(false)
    const clustered = new Array(vertices.length).fill(false)
    
    for (let i = 0; i < vertices.length; i++) {
      if (visited[i]) continue
      
      visited[i] = true
      const neighbors = this.getNeighborsWithinEpsilon(i, vertices, epsilon)
      
      if (neighbors.length < minPoints) {
        // Mark as noise (not clustered)
        continue
      }
      
      // Start new cluster
      const cluster: number[] = [i]
      clustered[i] = true
      
      // Expand cluster
      let j = 0
      while (j < neighbors.length) {
        const neighborIndex = neighbors[j]
        
        if (!visited[neighborIndex]) {
          visited[neighborIndex] = true
          const neighborNeighbors = this.getNeighborsWithinEpsilon(neighborIndex, vertices, epsilon)
          
          if (neighborNeighbors.length >= minPoints) {
            neighbors.push(...neighborNeighbors.filter(nn => !neighbors.includes(nn)))
          }
        }
        
        if (!clustered[neighborIndex]) {
          cluster.push(neighborIndex)
          clustered[neighborIndex] = true
        }
        
        j++
      }
      
      clusters.push(cluster)
    }
    
    return clusters
  }

  /**
   * Get neighbors within epsilon distance for DBSCAN
   */
  private static getNeighborsWithinEpsilon(
    vertexIndex: number,
    vertices: Vector3[],
    epsilon: number
  ): number[] {
    const vertex = vertices[vertexIndex]
    const neighbors: number[] = []
    
    for (let i = 0; i < vertices.length; i++) {
      if (i === vertexIndex) continue
      
      if (vertex.distanceTo(vertices[i]) <= epsilon) {
        neighbors.push(i)
      }
    }
    
    return neighbors
  }

  /**
   * Create oriented bounding box for better spatial analysis
   */
  static calculateOrientedBoundingBox(vertices: Vector3[]): {
    center: Vector3
    size: Vector3
    rotation: Matrix3
  } {
    // Calculate centroid
    const center = new Vector3()
    vertices.forEach(v => center.add(v))
    center.divideScalar(vertices.length)
    
    // Prepare centered vertices for approximate PCA
    const centered = vertices.map(v => v.clone().sub(center))
    
    // This is a simplified implementation
    // In practice, you'd want proper PCA implementation
    const size = new Vector3()
    const rotation = new Matrix3()
    
    // Calculate approximate bounds
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity
    
    centered.forEach(v => {
      minX = Math.min(minX, v.x)
      maxX = Math.max(maxX, v.x)
      minY = Math.min(minY, v.y)
      maxY = Math.max(maxY, v.y)
      minZ = Math.min(minZ, v.z)
      maxZ = Math.max(maxZ, v.z)
    })
    
    size.set(maxX - minX, maxY - minY, maxZ - minZ)
    rotation.identity()
    
    return { center, size, rotation }
  }

  /**
   * Smooth mesh vertices using Laplacian smoothing
   */
  static laplacianSmoothing(
    geometry: BufferGeometry,
    iterations: number = 1,
    factor: number = 0.1
  ): void {
    const position = geometry.getAttribute('position') as BufferAttribute
    const vertices: Vector3[] = []
    
    // Get all vertices
    for (let i = 0; i < position.count; i++) {
      vertices.push(new Vector3().fromBufferAttribute(position, i))
    }
    
    for (let iter = 0; iter < iterations; iter++) {
      const smoothedVertices = vertices.map((vertex, index) => {
        const neighbors = this.getVertexNeighbors(index, position, 2.0)
        
        if (neighbors.length === 0) return vertex.clone()
        
        const average = new Vector3()
        neighbors.forEach(neighborIndex => {
          average.add(vertices[neighborIndex])
        })
        average.divideScalar(neighbors.length)
        
        // Apply smoothing factor
        return vertex.clone().lerp(average, factor)
      })
      
      // Update vertices array
      vertices.splice(0, vertices.length, ...smoothedVertices)
    }
    
    // Update geometry
    const newPositions = new Float32Array(vertices.length * 3)
    vertices.forEach((vertex, index) => {
      newPositions[index * 3] = vertex.x
      newPositions[index * 3 + 1] = vertex.y
      newPositions[index * 3 + 2] = vertex.z
    })
    
    position.set(newPositions)
    position.needsUpdate = true
    geometry.computeVertexNormals()
  }
}

// Import Matrix3 type (it might not be available in older Three.js versions)
class Matrix3 {
  elements: number[]
  
  constructor() {
    this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]
  }
  
  identity(): this {
    this.elements = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    return this
  }
}
