import * as THREE from 'three';
import type { ToothSegment } from '../types/dental';

export interface IntersectionResult {
  segment1: ToothSegment;
  segment2: ToothSegment;
  intersectionType: 'contact' | 'overlap' | 'collision';
  severity: 'low' | 'medium' | 'high';
  intersectionVolume: number;
  intersectionPoints: THREE.Vector3[];
  penetrationDepth: number;
  contactArea: number;
  boundingBoxOverlap: {
    min: THREE.Vector3;
    max: THREE.Vector3;
  };
}

export interface IntersectionVisualization {
  intersectionMesh: THREE.Mesh;
  intersectionPoints: THREE.Points;
  boundingBoxes: THREE.Mesh[]; // Changed from LineSegments to Mesh for spheres
  intersectionInfo: {
    segment1Name: string;
    segment2Name: string;
    volume: number;
    penetrationDepth: number;
    contactArea: number;
  };
}

export interface IntersectionConfig {
  severityThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  distanceThreshold: number;
  sampleCount: number;
}

export class IntersectionDetectionService {
  private scene: THREE.Scene;
  private config: IntersectionConfig;

  private intersectionVisualizations: Map<string, IntersectionVisualization> = new Map();
  private intersectionResults: IntersectionResult[] = [];

  constructor(scene: THREE.Scene, config?: Partial<IntersectionConfig>) {
    this.scene = scene;
    this.config = {
      severityThresholds: {
        low: 1.0,
        medium: 5.0,
        high: 10.0
      },
      distanceThreshold: 2.0,
      sampleCount: 200,
      ...config
    };
  }

  /**
   * Detect intersections between all segments
   */
  detectIntersections(segments: ToothSegment[]): IntersectionResult[] {
    this.intersectionResults = [];
    
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const segment1 = segments[i];
        const segment2 = segments[j];
        
        if (!segment1.mesh.visible || !segment2.mesh.visible) {
          continue;
        }

        const intersection = this.detectSegmentIntersection(segment1, segment2);
        if (intersection) {
          this.intersectionResults.push(intersection);
        }
      }
    }

    return this.intersectionResults;
  }

  /**
   * Detect intersection between two specific segments using actual mesh geometry
   */
  private detectSegmentIntersection(segment1: ToothSegment, segment2: ToothSegment): IntersectionResult | null {
    const mesh1 = segment1.mesh;
    const mesh2 = segment2.mesh;

    // Update world matrices
    mesh1.updateMatrixWorld();
    mesh2.updateMatrixWorld();

    // First check bounding boxes for early exit
    const bbox1 = new THREE.Box3().setFromObject(mesh1);
    const bbox2 = new THREE.Box3().setFromObject(mesh2);

    if (!bbox1.intersectsBox(bbox2)) {
      return null;
    }

    // Perform actual mesh intersection detection
    let intersectionData = this.detectMeshIntersection(mesh1, mesh2);
    
    // If no intersection found with mesh method, try distance-based fallback
    if (!intersectionData) {
      intersectionData = this.detectDistanceBasedIntersection(mesh1, mesh2);
    }
    
    // If still no intersection, try bounding box overlap method
    if (!intersectionData) {
      intersectionData = this.detectBoundingBoxOverlap(mesh1, mesh2);
    }
    
    if (!intersectionData) {
      return null;
    }

    const { intersectionVolume, penetrationDepth, contactArea, intersectionPoints, intersectionBbox } = intersectionData;

    // Determine intersection type and severity
    const intersectionType = this.determineIntersectionType(penetrationDepth);
    const severity = this.determineSeverity(penetrationDepth, intersectionVolume, contactArea);

    return {
      segment1,
      segment2,
      intersectionType,
      severity,
      intersectionVolume,
      intersectionPoints,
      penetrationDepth,
      contactArea,
      boundingBoxOverlap: {
        min: intersectionBbox.min.clone(),
        max: intersectionBbox.max.clone()
      }
    };
  }

  /**
   * Detect actual mesh intersection using ray casting and point sampling
   */
  private detectMeshIntersection(mesh1: THREE.Mesh, mesh2: THREE.Mesh): {
    intersectionVolume: number;
    penetrationDepth: number;
    contactArea: number;
    intersectionPoints: THREE.Vector3[];
    intersectionBbox: THREE.Box3;
  } | null {
    const intersectionPoints: THREE.Vector3[] = [];
    
    // Get geometry data
    const geometry1 = mesh1.geometry;
    
    // Sample points from mesh1 and check if they're inside mesh2
    const positions1 = geometry1.getAttribute('position');
    const sampleCount = Math.min(500, positions1.count); // Limit samples for performance
    let insideCount = 0;
    
    for (let i = 0; i < sampleCount; i++) {
      const vertex = new THREE.Vector3();
      vertex.fromBufferAttribute(positions1, i);
      mesh1.localToWorld(vertex);
      
      if (this.isPointInsideMesh(vertex, mesh2)) {
        intersectionPoints.push(vertex.clone());
        insideCount++;
      }
    }
    
    // If no intersection points found, return null
    if (insideCount === 0) {
      return null;
    }
    
    // Calculate intersection metrics
    const intersectionVolume = this.calculateMeshIntersectionVolume(intersectionPoints);
    const penetrationDepth = this.calculateMeshPenetrationDepth(mesh2, intersectionPoints);
    const contactArea = this.calculateMeshContactArea(intersectionPoints);
    const intersectionBbox = this.calculateIntersectionBoundingBox(intersectionPoints);
    
    return {
      intersectionVolume,
      penetrationDepth,
      contactArea,
      intersectionPoints,
      intersectionBbox
    };
  }

  /**
   * Distance-based intersection detection as fallback
   */
  private detectDistanceBasedIntersection(mesh1: THREE.Mesh, mesh2: THREE.Mesh): {
    intersectionVolume: number;
    penetrationDepth: number;
    contactArea: number;
    intersectionPoints: THREE.Vector3[];
    intersectionBbox: THREE.Box3;
  } | null {
    const geometry1 = mesh1.geometry;
    const geometry2 = mesh2.geometry;
    const positions1 = geometry1.getAttribute('position');
    const positions2 = geometry2.getAttribute('position');
    
    const intersectionPoints: THREE.Vector3[] = [];
    const threshold = this.config.distanceThreshold;
    
    // Sample points from both meshes and find close pairs
    const sampleCount1 = Math.min(this.config.sampleCount, positions1.count);
    const sampleCount2 = Math.min(this.config.sampleCount, positions2.count);
    
    for (let i = 0; i < sampleCount1; i++) {
      const vertex1 = new THREE.Vector3();
      vertex1.fromBufferAttribute(positions1, i);
      mesh1.localToWorld(vertex1);
      
      for (let j = 0; j < sampleCount2; j++) {
        const vertex2 = new THREE.Vector3();
        vertex2.fromBufferAttribute(positions2, j);
        mesh2.localToWorld(vertex2);
        
        const distance = vertex1.distanceTo(vertex2);
        if (distance < threshold) {
          // Add midpoint as intersection point
          const midpoint = vertex1.clone().add(vertex2).multiplyScalar(0.5);
          intersectionPoints.push(midpoint);
        }
      }
    }
    
    if (intersectionPoints.length === 0) {
      return null;
    }
    
    // Calculate metrics
    const intersectionVolume = this.calculateMeshIntersectionVolume(intersectionPoints);
    const penetrationDepth = threshold - (intersectionPoints.reduce((sum, point) => {
      // Find minimum distance to either mesh surface
      const dist1 = this.getDistanceToMesh(point, mesh1);
      const dist2 = this.getDistanceToMesh(point, mesh2);
      return sum + Math.min(dist1, dist2);
    }, 0) / intersectionPoints.length);
    const contactArea = this.calculateMeshContactArea(intersectionPoints);
    const intersectionBbox = this.calculateIntersectionBoundingBox(intersectionPoints);
    
    return {
      intersectionVolume,
      penetrationDepth: Math.max(0, penetrationDepth),
      contactArea,
      intersectionPoints,
      intersectionBbox
    };
  }

  /**
   * Bounding box overlap detection as final fallback
   */
  private detectBoundingBoxOverlap(mesh1: THREE.Mesh, mesh2: THREE.Mesh): {
    intersectionVolume: number;
    penetrationDepth: number;
    contactArea: number;
    intersectionPoints: THREE.Vector3[];
    intersectionBbox: THREE.Box3;
  } | null {
    const bbox1 = new THREE.Box3().setFromObject(mesh1);
    const bbox2 = new THREE.Box3().setFromObject(mesh2);
    
    const intersectionBbox = bbox1.intersect(bbox2);
    if (!intersectionBbox) {
      return null;
    }
    
    // Create intersection points from the bounding box corners
    const intersectionPoints: THREE.Vector3[] = [
      intersectionBbox.min.clone(),
      intersectionBbox.max.clone(),
      new THREE.Vector3(intersectionBbox.min.x, intersectionBbox.min.y, intersectionBbox.max.z),
      new THREE.Vector3(intersectionBbox.min.x, intersectionBbox.max.y, intersectionBbox.min.z),
      new THREE.Vector3(intersectionBbox.min.x, intersectionBbox.max.y, intersectionBbox.max.z),
      new THREE.Vector3(intersectionBbox.max.x, intersectionBbox.min.y, intersectionBbox.min.z),
      new THREE.Vector3(intersectionBbox.max.x, intersectionBbox.min.y, intersectionBbox.max.z),
      new THREE.Vector3(intersectionBbox.max.x, intersectionBbox.max.y, intersectionBbox.min.z)
    ];
    
    // Calculate metrics based on bounding box overlap
    const size = intersectionBbox.getSize(new THREE.Vector3());
    const intersectionVolume = size.x * size.y * size.z;
    const penetrationDepth = Math.min(size.x, size.y, size.z);
    const contactArea = Math.max(size.x * size.y, size.x * size.z, size.y * size.z);
    
    return {
      intersectionVolume,
      penetrationDepth,
      contactArea,
      intersectionPoints,
      intersectionBbox
    };
  }

  /**
   * Get approximate distance from point to mesh surface
   */
  private getDistanceToMesh(point: THREE.Vector3, mesh: THREE.Mesh): number {
    const geometry = mesh.geometry;
    const positions = geometry.getAttribute('position');
    let minDistance = Infinity;
    
    // Sample some vertices to find closest point
    const sampleCount = Math.min(50, positions.count);
    for (let i = 0; i < sampleCount; i++) {
      const vertex = new THREE.Vector3();
      vertex.fromBufferAttribute(positions, i);
      mesh.localToWorld(vertex);
      
      const distance = point.distanceTo(vertex);
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  }

  /**
   * Calculate intersection volume from actual intersection points
   */
  private calculateMeshIntersectionVolume(points: THREE.Vector3[]): number {
    if (points.length < 4) return 0;
    
    // Use convex hull approximation for volume calculation
    const bbox = new THREE.Box3().setFromPoints(points);
    const size = bbox.getSize(new THREE.Vector3());
    
    // Approximate volume based on point density and bounding box
    const pointDensity = points.length / (size.x * size.y * size.z);
    return Math.max(0.001, size.x * size.y * size.z * pointDensity);
  }

  /**
   * Calculate mesh penetration depth based on actual intersection points
   */
  private calculateMeshPenetrationDepth(mesh2: THREE.Mesh, intersectionPoints: THREE.Vector3[]): number {
    if (intersectionPoints.length === 0) return 0;
    
    // Calculate average distance from intersection points to mesh2 surface
    let totalDistance = 0;
    const raycaster = new THREE.Raycaster();
    
    for (const point of intersectionPoints) {
      // Cast rays in multiple directions to find the surface
      const directions = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
      ];
      
      let minDistance = Infinity;
      for (const direction of directions) {
        raycaster.set(point, direction);
        const intersects = raycaster.intersectObject(mesh2);
        if (intersects.length > 0) {
          minDistance = Math.min(minDistance, intersects[0].distance);
        }
      }
      
      if (minDistance !== Infinity) {
        totalDistance += minDistance;
      }
    }
    
    return totalDistance / intersectionPoints.length;
  }

  /**
   * Calculate mesh contact area based on intersection points
   */
  private calculateMeshContactArea(intersectionPoints: THREE.Vector3[]): number {
    if (intersectionPoints.length < 3) return 0;
    
    // Use the bounding box of intersection points to estimate contact area
    const bbox = new THREE.Box3().setFromPoints(intersectionPoints);
    const size = bbox.getSize(new THREE.Vector3());
    
    // Estimate contact area as the largest face of the intersection bounding box
    return Math.max(size.x * size.y, size.x * size.z, size.y * size.z);
  }

  /**
   * Calculate bounding box for intersection points
   */
  private calculateIntersectionBoundingBox(intersectionPoints: THREE.Vector3[]): THREE.Box3 {
    return new THREE.Box3().setFromPoints(intersectionPoints);
  }



  /**
   * Check if a point is inside a mesh using ray casting
   */
  private isPointInsideMesh(point: THREE.Vector3, mesh: THREE.Mesh): boolean {
    const raycaster = new THREE.Raycaster();
    
    // Cast rays in multiple directions to be more robust
    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, -1)
    ];
    
    let insideCount = 0;
    
    for (const direction of directions) {
      raycaster.set(point, direction);
      const intersects = raycaster.intersectObject(mesh);
      
      // If odd number of intersections, point is inside for this direction
      if (intersects.length % 2 === 1) {
        insideCount++;
      }
    }
    
    // Point is inside if majority of rays indicate inside
    return insideCount > directions.length / 2;
  }

  /**
   * Determine intersection type based on penetration depth and volume
   */
  private determineIntersectionType(penetrationDepth: number): 'contact' | 'overlap' | 'collision' {
    if (penetrationDepth < 0.1) {
      return 'contact';
    } else if (penetrationDepth < 1.0) {
      return 'overlap';
    } else {
      return 'collision';
    }
  }

  /**
   * Determine severity based on intersection metrics using configurable thresholds
   */
  private determineSeverity(penetrationDepth: number, volume: number, contactArea: number): 'low' | 'medium' | 'high' {
    const severityScore = (penetrationDepth * 10) + (volume * 0.1) + (contactArea * 0.01);
    const { low, medium } = this.config.severityThresholds;
    
    if (severityScore < low) {
      return 'low';
    } else if (severityScore < medium) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  /**
   * Create visual representation of intersections
   */
  createIntersectionVisualizations(): void {
    this.clearIntersectionVisualizations();
    
    this.intersectionResults.forEach((result) => {
      const visualization = this.createIntersectionVisualization(result);
      this.intersectionVisualizations.set(`${result.segment1.id}-${result.segment2.id}`, visualization);
    });
  }

  /**
   * Create visualization for a single intersection using actual mesh intersection points
   */
  private createIntersectionVisualization(result: IntersectionResult): IntersectionVisualization {
    // Create intersection volume mesh from actual intersection points
    let intersectionMesh: THREE.Mesh;
    
    if (result.intersectionPoints.length > 0) {
      // Create a convex hull or bounding box from intersection points
      const bbox = new THREE.Box3().setFromPoints(result.intersectionPoints);
      const size = bbox.getSize(new THREE.Vector3());
      const center = bbox.getCenter(new THREE.Vector3());
      
      // Create a more accurate representation of the intersection volume
      const intersectionGeometry = new THREE.BoxGeometry(
        Math.max(0.1, size.x),
        Math.max(0.1, size.y),
        Math.max(0.1, size.z)
      );
      
      const intersectionMaterial = new THREE.MeshBasicMaterial({
        color: this.getSeverityColor(result.severity),
        transparent: true,
        opacity: 0.4,
        wireframe: false
      });
      
      intersectionMesh = new THREE.Mesh(intersectionGeometry, intersectionMaterial);
      intersectionMesh.position.copy(center);
    } else {
      // Fallback to empty geometry if no intersection points
      intersectionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
      intersectionMesh.visible = false;
    }
    
    // Create intersection points visualization with larger, more visible points
    const pointsGeometry = new THREE.BufferGeometry().setFromPoints(result.intersectionPoints);
    const pointsMaterial = new THREE.PointsMaterial({
      color: this.getSeverityColor(result.severity),
      size: 0.8, // Larger points for better visibility
      sizeAttenuation: false
    });
    const intersectionPoints = new THREE.Points(pointsGeometry, pointsMaterial);
    
    // Create small spheres at intersection points for better visibility
    const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 6);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: this.getSeverityColor(result.severity),
      transparent: true,
      opacity: 0.8
    });
    
    const intersectionSpheres: THREE.Mesh[] = [];
    result.intersectionPoints.forEach((point) => {
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.copy(point);
      intersectionSpheres.push(sphere);
      this.scene.add(sphere);
    });
    
    // Add to scene
    this.scene.add(intersectionMesh);
    this.scene.add(intersectionPoints);
    
    return {
      intersectionMesh,
      intersectionPoints,
      boundingBoxes: intersectionSpheres, // Store spheres instead of wireframes
      intersectionInfo: {
        segment1Name: result.segment1.name,
        segment2Name: result.segment2.name,
        volume: result.intersectionVolume,
        penetrationDepth: result.penetrationDepth,
        contactArea: result.contactArea
      }
    };
  }

  /**
   * Get color based on severity
   */
  private getSeverityColor(severity: 'low' | 'medium' | 'high'): THREE.Color {
    switch (severity) {
      case 'low':
        return new THREE.Color(0x00ff00); // Green
      case 'medium':
        return new THREE.Color(0xffaa00); // Orange
      case 'high':
        return new THREE.Color(0xff0000); // Red
      default:
        return new THREE.Color(0xffffff); // White
    }
  }



  /**
   * Clear all intersection visualizations
   */
  clearIntersectionVisualizations(): void {
    this.intersectionVisualizations.forEach((visualization) => {
      this.scene.remove(visualization.intersectionMesh);
      this.scene.remove(visualization.intersectionPoints);
      visualization.boundingBoxes.forEach(sphere => this.scene.remove(sphere));
      
      // Dispose of geometries and materials to prevent memory leaks
      if (visualization.intersectionMesh.geometry) {
        visualization.intersectionMesh.geometry.dispose();
      }
      if (visualization.intersectionMesh.material) {
        if (Array.isArray(visualization.intersectionMesh.material)) {
          visualization.intersectionMesh.material.forEach(mat => mat.dispose());
        } else {
          visualization.intersectionMesh.material.dispose();
        }
      }
      
      if (visualization.intersectionPoints.geometry) {
        visualization.intersectionPoints.geometry.dispose();
      }
      if (visualization.intersectionPoints.material) {
        if (Array.isArray(visualization.intersectionPoints.material)) {
          visualization.intersectionPoints.material.forEach(mat => mat.dispose());
        } else {
          visualization.intersectionPoints.material.dispose();
        }
      }
      
      visualization.boundingBoxes.forEach(sphere => {
        if (sphere.geometry) sphere.geometry.dispose();
        if (sphere.material) {
          if (Array.isArray(sphere.material)) {
            sphere.material.forEach(mat => mat.dispose());
          } else {
            sphere.material.dispose();
          }
        }
      });
    });
    this.intersectionVisualizations.clear();
  }

  /**
   * Get current intersection results
   */
  getIntersectionResults(): IntersectionResult[] {
    return this.intersectionResults;
  }

  /**
   * Get intersection results for a specific segment
   */
  getIntersectionsForSegment(segmentId: string): IntersectionResult[] {
    return this.intersectionResults.filter(result => 
      result.segment1.id === segmentId || result.segment2.id === segmentId
    );
  }

  /**
   * Check if segments have any intersections
   */
  hasIntersections(): boolean {
    return this.intersectionResults.length > 0;
  }

  /**
   * Get intersection statistics
   */
  getIntersectionStatistics(): {
    totalIntersections: number;
    bySeverity: { low: number; medium: number; high: number };
    byType: { contact: number; overlap: number; collision: number };
    averagePenetrationDepth: number;
    totalIntersectionVolume: number;
  } {
    const stats = {
      totalIntersections: this.intersectionResults.length,
      bySeverity: { low: 0, medium: 0, high: 0 },
      byType: { contact: 0, overlap: 0, collision: 0 },
      averagePenetrationDepth: 0,
      totalIntersectionVolume: 0
    };

    if (this.intersectionResults.length === 0) {
      return stats;
    }

    this.intersectionResults.forEach(result => {
      stats.bySeverity[result.severity]++;
      stats.byType[result.intersectionType]++;
      stats.averagePenetrationDepth += result.penetrationDepth;
      stats.totalIntersectionVolume += result.intersectionVolume;
    });

    stats.averagePenetrationDepth /= this.intersectionResults.length;

    return stats;
  }

  /**
   * Update intersection detection configuration
   */
  updateConfig(newConfig: Partial<IntersectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): IntersectionConfig {
    return { ...this.config };
  }
}
