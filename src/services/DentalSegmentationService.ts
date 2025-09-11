import * as THREE from 'three'

export interface SegmentationOptions {
  /** Maximum allowed colour distance when comparing vertices (enamel–dentin contrast). */
  intensityThreshold?: number
  /** Maximum allowed angle (radians) between vertex normals to stay within the same tooth. */
  normalThreshold?: number
  /** Maximum distance from the seed region to expand, limiting growth across teeth. */
  maxDistance?: number
}

/**
 * Dental-aware segmentation that expands an initial selection using simple
 * region growing. The algorithm considers tooth-specific cues like enamel
 * intensity, surface orientation and anatomical size limits. This allows a
 * semi‑automated workflow: a rough lasso is drawn and the service refines the
 * selection to follow tooth boundaries more precisely.
 */
export class DentalSegmentationService {
  /** Expand a seed region to follow tooth boundaries. */
  autoSegmentFromSeed (
    seedVertices: number[],
    mesh: THREE.Mesh,
    options: SegmentationOptions = {}
  ): number[] {
    const geometry = mesh.geometry as THREE.BufferGeometry
    geometry.computeVertexNormals()

    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
    const colors = geometry.getAttribute('color') as THREE.BufferAttribute | undefined

    const adjacency = this.buildAdjacency(geometry)

    const visited = new Set<number>(seedVertices)
    const queue: number[] = [...seedVertices]

    // Determine seed characteristics
    const seedIndex = seedVertices[0]
    const seedNormal = new THREE.Vector3(
      normals.getX(seedIndex),
      normals.getY(seedIndex),
      normals.getZ(seedIndex)
    ).normalize()
    const seedColour = colors
      ? new THREE.Color(colors.getX(seedIndex), colors.getY(seedIndex), colors.getZ(seedIndex))
      : null

    const seedCentroid = new THREE.Vector3()
    for (const v of seedVertices) {
      seedCentroid.add(new THREE.Vector3(
        positions.getX(v),
        positions.getY(v),
        positions.getZ(v)
      ))
    }
    seedCentroid.divideScalar(seedVertices.length)

    // Defaults tuned for tooth anatomy
    const intensityThreshold = options.intensityThreshold ?? 0.15
    const normalThreshold = options.normalThreshold ?? (Math.PI / 8) // 22.5°
    const maxDistance = options.maxDistance ?? 5 // mm

    const tmpPos = new THREE.Vector3()
    const tmpNormal = new THREE.Vector3()
    const tmpColour = new THREE.Color()

    while (queue.length > 0) {
      const v = queue.shift()!
      const neighbours = adjacency.get(v)
      if (!neighbours) continue

      for (const nb of neighbours) {
        if (visited.has(nb)) continue

        tmpPos.set(
          positions.getX(nb),
          positions.getY(nb),
          positions.getZ(nb)
        )

        // Enforce anatomical distance to avoid leaking into neighbour teeth
        if (tmpPos.distanceTo(seedCentroid) > maxDistance) continue

        tmpNormal.set(
          normals.getX(nb),
          normals.getY(nb),
          normals.getZ(nb)
        ).normalize()
        const angle = tmpNormal.angleTo(seedNormal)
        if (angle > normalThreshold) continue

        if (seedColour && colors) {
          tmpColour.set(colors.getX(nb), colors.getY(nb), colors.getZ(nb))
          const colourDiff = Math.sqrt(
            Math.pow(tmpColour.r - seedColour.r, 2) +
            Math.pow(tmpColour.g - seedColour.g, 2) +
            Math.pow(tmpColour.b - seedColour.b, 2)
          )
          if (colourDiff > intensityThreshold) continue
        }

        visited.add(nb)
        queue.push(nb)
      }
    }

    return Array.from(visited)
  }

  /** Build vertex adjacency from mesh geometry. */
  private buildAdjacency (geometry: THREE.BufferGeometry): Map<number, Set<number>> {
    const adjacency = new Map<number, Set<number>>()
    const index = geometry.getIndex()

    if (index) {
      const arr = index.array as ArrayLike<number>
      for (let i = 0; i < arr.length; i += 3) {
        const a = arr[i], b = arr[i + 1], c = arr[i + 2]
        this.link(adjacency, a, b)
        this.link(adjacency, b, c)
        this.link(adjacency, c, a)
      }
    } else {
      const vertexCount = geometry.getAttribute('position').count
      for (let i = 0; i < vertexCount; i += 3) {
        const a = i, b = i + 1, c = i + 2
        this.link(adjacency, a, b)
        this.link(adjacency, b, c)
        this.link(adjacency, c, a)
      }
    }

    return adjacency
  }

  private link (adj: Map<number, Set<number>>, a: number, b: number) {
    if (!adj.has(a)) adj.set(a, new Set())
    if (!adj.has(b)) adj.set(b, new Set())
    adj.get(a)!.add(b)
    adj.get(b)!.add(a)
  }
}

export default DentalSegmentationService
