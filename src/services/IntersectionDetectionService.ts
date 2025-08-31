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
    try {
      this.intersectionResults = [];
      
      if (!segments || segments.length === 0) {
        console.warn('No segments provided for intersection detection');
        return this.intersectionResults;
      }
      
      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          try {
            const segment1 = segments[i];
            const segment2 = segments[j];
            
            // Validate segments
            if (!segment1 || !segment2) {
              console.warn(`Invalid segments at indices ${i}, ${j}`);
              continue;
            }

            if (!segment1.mesh || !segment2.mesh) {
              console.warn(`Missing mesh for segments at indices ${i}, ${j}`);
              continue;
            }
            
            if (!segment1.mesh.visible || !segment2.mesh.visible) {
              continue;
            }

            const intersection = this.detectSegmentIntersection(segment1, segment2);
            if (intersection) {
              this.intersectionResults.push(intersection);
            }
          } catch (error) {
            console.error(`Error detecting intersection between segments ${i} and ${j}:`, error);
            continue;
          }
        }
      }

      return this.intersectionResults;
    } catch (error) {
      console.error('Error in detectIntersections:', error);
      return [];
    }
  }

  /**
   * Detect intersection between two specific segments using actual mesh geometry
   */
  private detectSegmentIntersection(segment1: ToothSegment, segment2: ToothSegment): IntersectionResult | null {
    try {
      // Validate input parameters
      if (!segment1?.mesh || !segment2?.mesh) {
        console.warn('Invalid segments provided to detectSegmentIntersection');
        return null;
      }

      const mesh1 = segment1.mesh;
      const mesh2 = segment2.mesh;

      // Validate mesh geometry
      if (!mesh1.geometry || !mesh2.geometry) {
        console.warn('Mesh geometry is missing for intersection detection');
        return null;
      }

      // Update world matrices safely
      try {
        mesh1.updateMatrixWorld();
        mesh2.updateMatrixWorld();
      } catch (error) {
        console.warn('Failed to update world matrices:', error);
        return null;
      }

      // First check bounding boxes for early exit
      let bbox1: THREE.Box3, bbox2: THREE.Box3;
      try {
        bbox1 = new THREE.Box3().setFromObject(mesh1);
        bbox2 = new THREE.Box3().setFromObject(mesh2);
      } catch (error) {
        console.warn('Failed to compute bounding boxes:', error);
        return null;
      }

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

      // Validate intersection data
      if (!intersectionBbox || !intersectionBbox.min || !intersectionBbox.max) {
        console.warn('Invalid intersection bounding box');
        return null;
      }

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
    } catch (error) {
      console.error('Error in detectSegmentIntersection:', error);
      return null;
    }
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
    try {
      const intersectionPoints: THREE.Vector3[] = [];
      
      // Validate geometry and get position attribute
      const geometry1 = mesh1.geometry;
      if (!geometry1) {
        console.warn('Mesh1 geometry is null');
        return null;
      }

      const positions1 = geometry1.getAttribute('position');
      if (!positions1) {
        console.warn('Mesh1 position attribute is missing');
        return null;
      }

      if (positions1.count === 0) {
        console.warn('Mesh1 has no vertices');
        return null;
      }
      
      // Sample points from mesh1 and check if they're inside mesh2
      const sampleCount = Math.min(500, positions1.count); // Limit samples for performance
      let insideCount = 0;
      
      for (let i = 0; i < sampleCount; i++) {
        try {
          const vertex = new THREE.Vector3();
          vertex.fromBufferAttribute(positions1, i);
          
          // Validate vertex data
          if (!isFinite(vertex.x) || !isFinite(vertex.y) || !isFinite(vertex.z)) {
            console.warn(`Invalid vertex data at index ${i}:`, vertex);
            continue;
          }
          
          mesh1.localToWorld(vertex);
          
          if (this.isPointInsideMesh(vertex, mesh2)) {
            intersectionPoints.push(vertex.clone());
            insideCount++;
          }
        } catch (error) {
          console.warn(`Error processing vertex ${i}:`, error);
          continue;
        }
      }
      
      // If no intersection points found, return null
      if (insideCount === 0) {
        return null;
      }
      
      // Calculate intersection metrics safely
      const intersectionVolume = this.calculateMeshIntersectionVolume(intersectionPoints);
      const penetrationDepth = this.calculateMeshPenetrationDepth(mesh2, intersectionPoints);
      const contactArea = this.calculateMeshContactArea(intersectionPoints);
      const intersectionBbox = this.calculateIntersectionBoundingBox(intersectionPoints);
      
      // Validate calculated values
      if (!isFinite(intersectionVolume) || !isFinite(penetrationDepth) || !isFinite(contactArea)) {
        console.warn('Invalid calculated intersection metrics');
        return null;
      }
      
      return {
        intersectionVolume,
        penetrationDepth,
        contactArea,
        intersectionPoints,
        intersectionBbox
      };
    } catch (error) {
      console.error('Error in detectMeshIntersection:', error);
      return null;
    }
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
    try {
      // Validate geometries
      const geometry1 = mesh1.geometry;
      const geometry2 = mesh2.geometry;
      
      if (!geometry1 || !geometry2) {
        console.warn('Missing geometry in distance-based intersection detection');
        return null;
      }

      const positions1 = geometry1.getAttribute('position');
      const positions2 = geometry2.getAttribute('position');
      
      if (!positions1 || !positions2) {
        console.warn('Missing position attributes in distance-based intersection detection');
        return null;
      }

      if (positions1.count === 0 || positions2.count === 0) {
        console.warn('Empty position attributes in distance-based intersection detection');
        return null;
      }
      
      const intersectionPoints: THREE.Vector3[] = [];
      const threshold = this.config.distanceThreshold;
      
      // Sample points from both meshes and find close pairs
      const sampleCount1 = Math.min(this.config.sampleCount, positions1.count);
      const sampleCount2 = Math.min(this.config.sampleCount, positions2.count);
      
      for (let i = 0; i < sampleCount1; i++) {
        try {
          const vertex1 = new THREE.Vector3();
          vertex1.fromBufferAttribute(positions1, i);
          
          // Validate vertex data
          if (!isFinite(vertex1.x) || !isFinite(vertex1.y) || !isFinite(vertex1.z)) {
            continue;
          }
          
          mesh1.localToWorld(vertex1);
          
          for (let j = 0; j < sampleCount2; j++) {
            try {
              const vertex2 = new THREE.Vector3();
              vertex2.fromBufferAttribute(positions2, j);
              
              // Validate vertex data
              if (!isFinite(vertex2.x) || !isFinite(vertex2.y) || !isFinite(vertex2.z)) {
                continue;
              }
              
              mesh2.localToWorld(vertex2);
              
              const distance = vertex1.distanceTo(vertex2);
              if (distance < threshold && isFinite(distance)) {
                // Add midpoint as intersection point
                const midpoint = vertex1.clone().add(vertex2).multiplyScalar(0.5);
                intersectionPoints.push(midpoint);
              }
            } catch (error) {
              console.warn(`Error processing vertex pair ${i}-${j}:`, error);
              continue;
            }
          }
        } catch (error) {
          console.warn(`Error processing vertex ${i}:`, error);
          continue;
        }
      }
      
      if (intersectionPoints.length === 0) {
        return null;
      }
      
      // Calculate metrics safely
      const intersectionVolume = this.calculateMeshIntersectionVolume(intersectionPoints);
      const penetrationDepth = threshold - (intersectionPoints.reduce((sum, point) => {
        try {
          // Find minimum distance to either mesh surface
          const dist1 = this.getDistanceToMesh(point, mesh1);
          const dist2 = this.getDistanceToMesh(point, mesh2);
          return sum + Math.min(dist1, dist2);
        } catch (error) {
          console.warn('Error calculating distance to mesh:', error);
          return sum;
        }
      }, 0) / intersectionPoints.length);
      const contactArea = this.calculateMeshContactArea(intersectionPoints);
      const intersectionBbox = this.calculateIntersectionBoundingBox(intersectionPoints);
      
      // Validate calculated values
      if (!isFinite(intersectionVolume) || !isFinite(penetrationDepth) || !isFinite(contactArea)) {
        console.warn('Invalid calculated distance-based intersection metrics');
        return null;
      }
      
      return {
        intersectionVolume,
        penetrationDepth: Math.max(0, penetrationDepth),
        contactArea,
        intersectionPoints,
        intersectionBbox
      };
    } catch (error) {
      console.error('Error in detectDistanceBasedIntersection:', error);
      return null;
    }
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
    try {
      if (!point || !mesh) {
        console.warn('Invalid point or mesh in getDistanceToMesh');
        return Infinity;
      }

      const geometry = mesh.geometry;
      if (!geometry) {
        console.warn('Mesh geometry is null in getDistanceToMesh');
        return Infinity;
      }

      const positions = geometry.getAttribute('position');
      if (!positions || positions.count === 0) {
        console.warn('Invalid position attribute in getDistanceToMesh');
        return Infinity;
      }

      let minDistance = Infinity;
      
      // Sample some vertices to find closest point
      const sampleCount = Math.min(50, positions.count);
      for (let i = 0; i < sampleCount; i++) {
        try {
          const vertex = new THREE.Vector3();
          vertex.fromBufferAttribute(positions, i);
          
          // Validate vertex data
          if (!isFinite(vertex.x) || !isFinite(vertex.y) || !isFinite(vertex.z)) {
            continue;
          }
          
          mesh.localToWorld(vertex);
          
          const distance = point.distanceTo(vertex);
          if (isFinite(distance)) {
            minDistance = Math.min(minDistance, distance);
          }
        } catch (error) {
          console.warn(`Error processing vertex ${i} in getDistanceToMesh:`, error);
          continue;
        }
      }
      
      return minDistance === Infinity ? 0 : minDistance;
    } catch (error) {
      console.error('Error in getDistanceToMesh:', error);
      return Infinity;
    }
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
    try {
      if (!intersectionPoints || intersectionPoints.length === 0) return 0;
      if (!mesh2) {
        console.warn('Invalid mesh2 in calculateMeshPenetrationDepth');
        return 0;
      }
      
      // Calculate average distance from intersection points to mesh2 surface
      let totalDistance = 0;
      let validPoints = 0;
      const raycaster = new THREE.Raycaster();
      
      for (const point of intersectionPoints) {
        try {
          // Validate point
          if (!point || !isFinite(point.x) || !isFinite(point.y) || !isFinite(point.z)) {
            continue;
          }

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
            try {
              raycaster.set(point, direction);
              const intersects = raycaster.intersectObject(mesh2, false);
              if (intersects.length > 0 && intersects[0].distance !== undefined && isFinite(intersects[0].distance)) {
                minDistance = Math.min(minDistance, intersects[0].distance);
              }
            } catch (error) {
              console.warn('Error in ray casting for penetration depth:', error);
              continue;
            }
          }
          
          if (minDistance !== Infinity && isFinite(minDistance)) {
            totalDistance += minDistance;
            validPoints++;
          }
        } catch (error) {
          console.warn('Error processing intersection point:', error);
          continue;
        }
      }
      
      return validPoints > 0 ? totalDistance / validPoints : 0;
    } catch (error) {
      console.error('Error in calculateMeshPenetrationDepth:', error);
      return 0;
    }
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
    try {
      if (!point || !mesh) {
        console.warn('Invalid point or mesh in isPointInsideMesh');
        return false;
      }

      // Validate point coordinates
      if (!isFinite(point.x) || !isFinite(point.y) || !isFinite(point.z)) {
        console.warn('Invalid point coordinates in isPointInsideMesh');
        return false;
      }

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
        try {
          raycaster.set(point, direction);
          const intersects = raycaster.intersectObject(mesh, false);
          
          // If odd number of intersections, point is inside for this direction
          if (intersects.length % 2 === 1) {
            insideCount++;
          }
        } catch (error) {
          console.warn('Error in ray casting for direction:', direction, error);
          continue;
        }
      }
      
      // Point is inside if majority of rays indicate inside
      return insideCount > directions.length / 2;
    } catch (error) {
      console.error('Error in isPointInsideMesh:', error);
      return false;
    }
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
    try {
      this.clearIntersectionVisualizations();
      
      if (!this.intersectionResults || this.intersectionResults.length === 0) {
        console.warn('No intersection results to visualize');
        return;
      }
      
      this.intersectionResults.forEach((result, index) => {
        try {
          if (!result || !result.segment1 || !result.segment2) {
            console.warn(`Invalid intersection result at index ${index}`);
            return;
          }

          const visualization = this.createIntersectionVisualization(result);
          const key = `${result.segment1.id}-${result.segment2.id}`;
          this.intersectionVisualizations.set(key, visualization);
        } catch (error) {
          console.error(`Error creating visualization for intersection ${index}:`, error);
        }
      });
    } catch (error) {
      console.error('Error in createIntersectionVisualizations:', error);
    }
  }

  /**
   * Create visualization for a single intersection using actual mesh intersection points
   */
  private createIntersectionVisualization(result: IntersectionResult): IntersectionVisualization {
    try {
      if (!result || !result.intersectionPoints) {
        console.warn('Invalid intersection result for visualization');
        return this.createFallbackVisualization();
      }

      // Create intersection volume mesh from actual intersection points
      let intersectionMesh: THREE.Mesh;
      
      if (result.intersectionPoints.length > 0) {
        try {
          // Create a convex hull or bounding box from intersection points
          const bbox = new THREE.Box3().setFromPoints(result.intersectionPoints);
          const size = bbox.getSize(new THREE.Vector3());
          const center = bbox.getCenter(new THREE.Vector3());
          
          // Validate size values
          if (!isFinite(size.x) || !isFinite(size.y) || !isFinite(size.z) ||
              !isFinite(center.x) || !isFinite(center.y) || !isFinite(center.z)) {
            console.warn('Invalid bounding box size or center');
            return this.createFallbackVisualization();
          }
          
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
        } catch (error) {
          console.warn('Error creating intersection mesh:', error);
          return this.createFallbackVisualization();
        }
      } else {
        // Fallback to empty geometry if no intersection points
        intersectionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
        intersectionMesh.visible = false;
      }
      
      // Create intersection points visualization with larger, more visible points
      let intersectionPoints: THREE.Points;
      try {
        const pointsGeometry = new THREE.BufferGeometry().setFromPoints(result.intersectionPoints);
        const pointsMaterial = new THREE.PointsMaterial({
          color: this.getSeverityColor(result.severity),
          size: 0.8, // Larger points for better visibility
          sizeAttenuation: false
        });
        intersectionPoints = new THREE.Points(pointsGeometry, pointsMaterial);
      } catch (error) {
        console.warn('Error creating intersection points visualization:', error);
        intersectionPoints = new THREE.Points(new THREE.BufferGeometry());
      }
      
      // Create small spheres at intersection points for better visibility
      const intersectionSpheres: THREE.Mesh[] = [];
      try {
        const sphereGeometry = new THREE.SphereGeometry(0.2, 8, 6);
        const sphereMaterial = new THREE.MeshBasicMaterial({
          color: this.getSeverityColor(result.severity),
          transparent: true,
          opacity: 0.8
        });
        
        result.intersectionPoints.forEach((point) => {
          try {
            if (point && isFinite(point.x) && isFinite(point.y) && isFinite(point.z)) {
              const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
              sphere.position.copy(point);
              intersectionSpheres.push(sphere);
              this.scene.add(sphere);
            }
          } catch (error) {
            console.warn('Error creating intersection sphere:', error);
          }
        });
      } catch (error) {
        console.warn('Error creating intersection spheres:', error);
      }
      
      // Add to scene safely
      try {
        this.scene.add(intersectionMesh);
        this.scene.add(intersectionPoints);
      } catch (error) {
        console.warn('Error adding visualization to scene:', error);
      }
      
      return {
        intersectionMesh,
        intersectionPoints,
        boundingBoxes: intersectionSpheres, // Store spheres instead of wireframes
        intersectionInfo: {
          segment1Name: result.segment1?.name || 'Unknown',
          segment2Name: result.segment2?.name || 'Unknown',
          volume: result.intersectionVolume || 0,
          penetrationDepth: result.penetrationDepth || 0,
          contactArea: result.contactArea || 0
        }
      };
    } catch (error) {
      console.error('Error in createIntersectionVisualization:', error);
      return this.createFallbackVisualization();
    }
  }

  /**
   * Create a fallback visualization when the main method fails
   */
  private createFallbackVisualization(): IntersectionVisualization {
    const fallbackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    fallbackMesh.visible = false;
    
    const fallbackPoints = new THREE.Points(new THREE.BufferGeometry());
    
    return {
      intersectionMesh: fallbackMesh,
      intersectionPoints: fallbackPoints,
      boundingBoxes: [],
      intersectionInfo: {
        segment1Name: 'Unknown',
        segment2Name: 'Unknown',
        volume: 0,
        penetrationDepth: 0,
        contactArea: 0
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
    try {
      this.intersectionVisualizations.forEach((visualization, key) => {
        try {
          // Remove from scene safely
          if (visualization.intersectionMesh && this.scene) {
            this.scene.remove(visualization.intersectionMesh);
          }
          if (visualization.intersectionPoints && this.scene) {
            this.scene.remove(visualization.intersectionPoints);
          }
          
          // Remove bounding box spheres
          if (visualization.boundingBoxes && this.scene) {
            visualization.boundingBoxes.forEach(sphere => {
              try {
                if (sphere && this.scene) {
                  this.scene.remove(sphere);
                }
              } catch (error) {
                console.warn('Error removing sphere from scene:', error);
              }
            });
          }
          
          // Dispose of geometries and materials to prevent memory leaks
          this.disposeMesh(visualization.intersectionMesh);
          this.disposePoints(visualization.intersectionPoints);
          
          // Dispose bounding box spheres
          if (visualization.boundingBoxes) {
            visualization.boundingBoxes.forEach(sphere => {
              this.disposeMesh(sphere);
            });
          }
        } catch (error) {
          console.error(`Error clearing visualization ${key}:`, error);
        }
      });
      
      this.intersectionVisualizations.clear();
    } catch (error) {
      console.error('Error in clearIntersectionVisualizations:', error);
    }
  }

  /**
   * Safely dispose of a mesh and its resources
   */
  private disposeMesh(mesh: THREE.Mesh | undefined): void {
    if (!mesh) return;
    
    try {
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(mat => {
            if (mat && typeof mat.dispose === 'function') {
              mat.dispose();
            }
          });
        } else if (typeof mesh.material.dispose === 'function') {
          mesh.material.dispose();
        }
      }
    } catch (error) {
      console.warn('Error disposing mesh:', error);
    }
  }

  /**
   * Safely dispose of points and their resources
   */
  private disposePoints(points: THREE.Points | undefined): void {
    if (!points) return;
    
    try {
      if (points.geometry) {
        points.geometry.dispose();
      }
      if (points.material) {
        if (Array.isArray(points.material)) {
          points.material.forEach(mat => {
            if (mat && typeof mat.dispose === 'function') {
              mat.dispose();
            }
          });
        } else if (typeof points.material.dispose === 'function') {
          points.material.dispose();
        }
      }
    } catch (error) {
      console.warn('Error disposing points:', error);
    }
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
