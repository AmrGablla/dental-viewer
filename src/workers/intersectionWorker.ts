// Intersection Detection Web Worker
// This worker handles heavy intersection detection computations without blocking the main thread

interface WorkerMessage {
  type: 'detect-intersections' | 'clear-visualizations';
  data?: any;
}

interface IntersectionResult {
  segment1Id: string;
  segment2Id: string;
  intersectionType: 'contact' | 'overlap' | 'collision';
  severity: 'low' | 'medium' | 'high';
  intersectionVolume: number;
  penetrationDepth: number;
  contactArea: number;
  intersectionPoints: Array<{x: number, y: number, z: number}>;
  boundingBoxOverlap: {
    min: {x: number, y: number, z: number};
    max: {x: number, y: number, z: number};
  };
}

interface SegmentData {
  id: string;
  name: string;
  position: {x: number, y: number, z: number};
  boundingBox: {
    min: {x: number, y: number, z: number};
    max: {x: number, y: number, z: number};
  };
  vertices: Array<{x: number, y: number, z: number}>;
  visible: boolean;
}

interface IntersectionConfig {
  severityThresholds: {
    low: number;
    medium: number;
    high: number;
  };
  distanceThreshold: number;
  sampleCount: number;
}

class IntersectionWorker {
  private config: IntersectionConfig;

  constructor() {
    this.config = {
      severityThresholds: {
        low: 1.0,
        medium: 5.0,
        high: 10.0
      },
      distanceThreshold: 2.0,
      sampleCount: 200
    };
  }

  updateConfig(newConfig: Partial<IntersectionConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  detectIntersections(segments: SegmentData[]): IntersectionResult[] {
    const results: IntersectionResult[] = [];
    
    if (!segments || segments.length === 0) {
      return results;
    }

    // Progress tracking
    const totalComparisons = (segments.length * (segments.length - 1)) / 2;
    let completedComparisons = 0;

    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length; j++) {
        const segment1 = segments[i];
        const segment2 = segments[j];

        // Skip if segments are not visible
        if (!segment1.visible || !segment2.visible) {
          completedComparisons++;
          continue;
        }

        // Check bounding box intersection first (fast check)
        if (!this.boundingBoxesIntersect(segment1.boundingBox, segment2.boundingBox)) {
          completedComparisons++;
          continue;
        }

        // Perform detailed intersection detection
        const intersection = this.detectSegmentIntersection(segment1, segment2);
        if (intersection) {
          results.push(intersection);
        }

        completedComparisons++;
        
        // Report progress every 10% or every 10 comparisons
        if (completedComparisons % Math.max(1, Math.floor(totalComparisons / 10)) === 0) {
          const progress = (completedComparisons / totalComparisons) * 100;
          self.postMessage({
            type: 'progress',
            data: { progress: Math.round(progress), completed: completedComparisons, total: totalComparisons }
          });
        }
      }
    }

    return results;
  }

  private boundingBoxesIntersect(bbox1: any, bbox2: any): boolean {
    return !(
      bbox1.max.x < bbox2.min.x || bbox1.min.x > bbox2.max.x ||
      bbox1.max.y < bbox2.min.y || bbox1.min.y > bbox2.max.y ||
      bbox1.max.z < bbox2.min.z || bbox1.min.z > bbox2.max.z
    );
  }

  private detectSegmentIntersection(segment1: SegmentData, segment2: SegmentData): IntersectionResult | null {
    try {
      // Calculate distance between segment centers
      const distance = this.calculateDistance(segment1.position, segment2.position);
      
      // If segments are too far apart, no intersection
      if (distance > this.config.distanceThreshold * 2) {
        return null;
      }

      // Sample points from segment1 and check if they're inside segment2
      const intersectionPoints = this.findIntersectionPoints(segment1, segment2);
      
      if (intersectionPoints.length === 0) {
        return null;
      }

      // Calculate intersection metrics
      const intersectionVolume = this.calculateIntersectionVolume(intersectionPoints);
      const penetrationDepth = this.calculatePenetrationDepth(segment1, segment2, intersectionPoints);
      const contactArea = this.calculateContactArea(intersectionPoints);
      const boundingBoxOverlap = this.calculateIntersectionBoundingBox(intersectionPoints);

      // Determine intersection type and severity
      const intersectionType = this.determineIntersectionType(penetrationDepth);
      const severity = this.determineSeverity(penetrationDepth, intersectionVolume, contactArea);

      return {
        segment1Id: segment1.id,
        segment2Id: segment2.id,
        intersectionType,
        severity,
        intersectionVolume,
        penetrationDepth,
        contactArea,
        intersectionPoints: intersectionPoints.map(p => ({x: p.x, y: p.y, z: p.z})),
        boundingBoxOverlap
      };
    } catch (error) {
      console.error('Error in segment intersection detection:', error);
      return null;
    }
  }

  private calculateDistance(pos1: any, pos2: any): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  private findIntersectionPoints(segment1: SegmentData, segment2: SegmentData): Array<{x: number, y: number, z: number}> {
    const intersectionPoints: Array<{x: number, y: number, z: number}> = [];
    
    // Sample points from segment1 vertices
    const sampleCount = Math.min(this.config.sampleCount, segment1.vertices.length);
    const step = Math.max(1, Math.floor(segment1.vertices.length / sampleCount));
    
    for (let i = 0; i < segment1.vertices.length; i += step) {
      const vertex = segment1.vertices[i];
      
      // Check if this point is inside segment2's bounding box
      if (this.isPointInBoundingBox(vertex, segment2.boundingBox)) {
        // Simple distance-based check for intersection
        const distance = this.calculateDistance(vertex, segment2.position);
        if (distance < this.config.distanceThreshold) {
          intersectionPoints.push(vertex);
        }
      }
    }

    return intersectionPoints;
  }

  private isPointInBoundingBox(point: any, bbox: any): boolean {
    return point.x >= bbox.min.x && point.x <= bbox.max.x &&
           point.y >= bbox.min.y && point.y <= bbox.max.y &&
           point.z >= bbox.min.z && point.z <= bbox.max.z;
  }

  private calculateIntersectionVolume(points: Array<{x: number, y: number, z: number}>): number {
    if (points.length < 4) return 0;
    
    // Simple volume estimation based on bounding box of intersection points
    const bbox = this.calculateBoundingBox(points);
    const size = {
      x: bbox.max.x - bbox.min.x,
      y: bbox.max.y - bbox.min.y,
      z: bbox.max.z - bbox.min.z
    };
    
    return size.x * size.y * size.z;
  }

  private calculatePenetrationDepth(_segment1: SegmentData, segment2: SegmentData, intersectionPoints: Array<{x: number, y: number, z: number}>): number {
    if (intersectionPoints.length === 0) return 0;
    
    // Calculate average distance from intersection points to segment2 center
    let totalDistance = 0;
    intersectionPoints.forEach(point => {
      totalDistance += this.calculateDistance(point, segment2.position);
    });
    
    return totalDistance / intersectionPoints.length;
  }

  private calculateContactArea(points: Array<{x: number, y: number, z: number}>): number {
    if (points.length < 3) return 0;
    
    // Simple area estimation based on point spread
    const bbox = this.calculateBoundingBox(points);
    const size = {
      x: bbox.max.x - bbox.min.x,
      y: bbox.max.y - bbox.min.y,
      z: bbox.max.z - bbox.min.z
    };
    
    // Return the largest face area
    return Math.max(size.x * size.y, size.x * size.z, size.y * size.z);
  }

  private calculateIntersectionBoundingBox(points: Array<{x: number, y: number, z: number}>): {min: {x: number, y: number, z: number}, max: {x: number, y: number, z: number}} {
    return this.calculateBoundingBox(points);
  }

  private calculateBoundingBox(points: Array<{x: number, y: number, z: number}>): {min: {x: number, y: number, z: number}, max: {x: number, y: number, z: number}} {
    if (points.length === 0) {
      return { min: {x: 0, y: 0, z: 0}, max: {x: 0, y: 0, z: 0} };
    }

    let minX = points[0].x, minY = points[0].y, minZ = points[0].z;
    let maxX = points[0].x, maxY = points[0].y, maxZ = points[0].z;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      minZ = Math.min(minZ, point.z);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      maxZ = Math.max(maxZ, point.z);
    });

    return {
      min: {x: minX, y: minY, z: minZ},
      max: {x: maxX, y: maxY, z: maxZ}
    };
  }

  private determineIntersectionType(penetrationDepth: number): 'contact' | 'overlap' | 'collision' {
    if (penetrationDepth < 0.1) {
      return 'contact';
    } else if (penetrationDepth < 1.0) {
      return 'overlap';
    } else {
      return 'collision';
    }
  }

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
}

// Initialize worker
const worker = new IntersectionWorker();

// Handle messages from main thread
self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const { type, data } = event.data;

  switch (type) {
    case 'detect-intersections':
      try {
        const { segments, config } = data;
        
        // Update config if provided
        if (config) {
          worker.updateConfig(config);
        }

        // Perform intersection detection
        const results = worker.detectIntersections(segments);
        
        // Send results back to main thread
        self.postMessage({
          type: 'intersection-results',
          data: { results, segments: segments.length }
        });
      } catch (error) {
        self.postMessage({
          type: 'error',
          data: { error: (error as Error).message }
        });
      }
      break;

    case 'clear-visualizations':
      // No action needed in worker for clearing visualizations
      self.postMessage({
        type: 'clear-complete',
        data: {}
      });
      break;

    default:
      console.warn('Unknown message type:', type);
  }
});

// Notify that worker is ready
self.postMessage({
  type: 'worker-ready',
  data: {}
});
