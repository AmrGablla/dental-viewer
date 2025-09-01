import type { ToothSegment, IntersectionResult } from '../types/dental';
import * as THREE from 'three';

interface WorkerMessage {
  type: string;
  data?: any;
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

export class IntersectionWorkerService {
  private worker: Worker | null = null;
  private isReady = false;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private progressCallback: ((progress: number) => void) | null = null;

  constructor() {
    this.initializeWorker();
  }

  private initializeWorker() {
    try {
      // Create worker from the worker file
      this.worker = new Worker(new URL('../workers/intersectionWorker.ts', import.meta.url), {
        type: 'module'
      });

      this.worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Intersection worker error:', error);
        this.isReady = false;
      };

      console.log('Intersection worker initialized');
    } catch (error) {
      console.error('Failed to initialize intersection worker:', error);
      this.isReady = false;
    }
  }

  private handleWorkerMessage(message: WorkerMessage) {
    const { type, data } = message;

    switch (type) {
      case 'worker-ready':
        this.isReady = true;
        console.log('Intersection worker is ready');
        break;

      case 'intersection-results':
        const handler = this.messageHandlers.get('intersection-results');
        if (handler) {
          handler(data);
        }
        break;

      case 'progress':
        if (this.progressCallback) {
          this.progressCallback(data.progress);
        }
        break;

      case 'error':
        console.error('Worker error:', data.error);
        const errorHandler = this.messageHandlers.get('error');
        if (errorHandler) {
          errorHandler(data);
        }
        break;

      case 'clear-complete':
        const clearHandler = this.messageHandlers.get('clear-complete');
        if (clearHandler) {
          clearHandler(data);
        }
        break;

      default:
        console.warn('Unknown worker message type:', type);
    }
  }

  /**
   * Convert ToothSegment objects to worker-compatible format
   */
  private convertSegmentsToWorkerFormat(segments: ToothSegment[]): SegmentData[] {
    return segments.map(segment => {
      // Extract vertices from geometry
      const vertices: Array<{x: number, y: number, z: number}> = [];
      
      if (segment.mesh && segment.mesh.geometry) {
        const geometry = segment.mesh.geometry;
        const positionAttribute = geometry.getAttribute('position');
        
        if (positionAttribute) {
          for (let i = 0; i < positionAttribute.count; i++) {
            const vertex = new THREE.Vector3();
            vertex.fromBufferAttribute(positionAttribute, i);
            segment.mesh.localToWorld(vertex);
            vertices.push({x: vertex.x, y: vertex.y, z: vertex.z});
          }
        }
      }

      // Calculate bounding box
      let boundingBox = {
        min: {x: 0, y: 0, z: 0},
        max: {x: 0, y: 0, z: 0}
      };

      if (segment.mesh) {
        const bbox = new THREE.Box3().setFromObject(segment.mesh);
        boundingBox = {
          min: {x: bbox.min.x, y: bbox.min.y, z: bbox.min.z},
          max: {x: bbox.max.x, y: bbox.max.y, z: bbox.max.z}
        };
      }

      return {
        id: segment.id,
        name: segment.name,
        position: {
          x: segment.mesh?.position.x || 0,
          y: segment.mesh?.position.y || 0,
          z: segment.mesh?.position.z || 0
        },
        boundingBox,
        vertices,
        visible: segment.mesh?.visible || false
      };
    });
  }

  /**
   * Convert worker results back to IntersectionResult format
   */
  private convertWorkerResultsToIntersectionResults(
    workerResults: any[], 
    segments: ToothSegment[]
  ): IntersectionResult[] {
    return workerResults.map(workerResult => {
      const segment1 = segments.find(s => s.id === workerResult.segment1Id);
      const segment2 = segments.find(s => s.id === workerResult.segment2Id);

      if (!segment1 || !segment2) {
        console.warn('Segment not found for intersection result:', workerResult);
        return null;
      }

      return {
        segment1,
        segment2,
        intersectionType: workerResult.intersectionType,
        severity: workerResult.severity,
        intersectionVolume: workerResult.intersectionVolume,
        penetrationDepth: workerResult.penetrationDepth,
        contactArea: workerResult.contactArea,
        intersectionPoints: workerResult.intersectionPoints.map((p: any) => 
          new THREE.Vector3(p.x, p.y, p.z)
        ),
        boundingBoxOverlap: {
          min: new THREE.Vector3(
            workerResult.boundingBoxOverlap.min.x,
            workerResult.boundingBoxOverlap.min.y,
            workerResult.boundingBoxOverlap.min.z
          ),
          max: new THREE.Vector3(
            workerResult.boundingBoxOverlap.max.x,
            workerResult.boundingBoxOverlap.max.y,
            workerResult.boundingBoxOverlap.max.z
          )
        }
      };
    }).filter(Boolean) as IntersectionResult[];
  }

  /**
   * Detect intersections using the Web Worker
   */
  detectIntersections(
    segments: ToothSegment[], 
    config?: Partial<IntersectionConfig>,
    onProgress?: (progress: number) => void,
    onComplete?: (results: IntersectionResult[]) => void,
    onError?: (error: string) => void
  ): Promise<IntersectionResult[]> {
    return new Promise((resolve, reject) => {
      if (!this.worker || !this.isReady) {
        const error = 'Intersection worker is not ready';
        console.error(error);
        if (onError) onError(error);
        reject(new Error(error));
        return;
      }

      // Set up message handlers
      this.messageHandlers.set('intersection-results', (data) => {
                  try {
            const results = this.convertWorkerResultsToIntersectionResults(data.results, segments);
            
            if (onComplete) {
              onComplete(results);
            }
            
            resolve(results);
          } catch (error) {
            console.error('Error processing intersection results:', error);
            if (onError) onError((error as Error).message);
            reject(error);
          }
      });

      this.messageHandlers.set('error', (data) => {
        const error = data.error || 'Unknown worker error';
        console.error('Worker error:', error);
        if (onError) onError(error);
        reject(new Error(error));
      });

      // Set up progress callback
      this.progressCallback = onProgress || null;

      // Convert segments to worker format
      const workerSegments = this.convertSegmentsToWorkerFormat(segments);

      // Send message to worker
      this.worker.postMessage({
        type: 'detect-intersections',
        data: { segments: workerSegments, config }
      });
    });
  }



  /**
   * Clear intersection visualizations
   */
  clearVisualizations(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.worker || !this.isReady) {
        resolve();
        return;
      }

      this.messageHandlers.set('clear-complete', () => {
        resolve();
      });

      this.worker.postMessage({
        type: 'clear-visualizations',
        data: {}
      });
    });
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      console.log('Intersection worker terminated');
    }
  }

  /**
   * Check if worker is ready
   */
  isWorkerReady(): boolean {
    return this.isReady;
  }
}
