import { ref } from 'vue';
import * as THREE from 'three';
import type { ToothSegment, DentalModel, IntersectionResult, IntersectionStatistics } from '../types/dental';
import { IntersectionDetectionService, type IntersectionConfig } from '../services/IntersectionDetectionService';
import { IntersectionWorkerService } from '../services/IntersectionWorkerService';

export function useSegmentManager() {
  const selectedSegments = ref<ToothSegment[]>([]);
  const totalMovementDistance = ref(0);
  const movementAxis = ref<
    "Anteroposterior" | "Vertical" | "Transverse" | "Combined" | "None"
  >("None");
  const axisMovementDistances = ref({
    anteroposterior: 0,
    vertical: 0,
    transverse: 0,
  });

  // Intersection detection
  const intersectionResults = ref<IntersectionResult[]>([]);
  const intersectionStatistics = ref<IntersectionStatistics | null>(null);
  const intersectionService = ref<IntersectionDetectionService | null>(null);
  const intersectionWorkerService = ref<IntersectionWorkerService | null>(null);
  const isIntersectionDetectionRunning = ref(false);
  const intersectionDetectionProgress = ref(0);
  let intersectionDetectionTimeout: number | null = null;

  function toggleSegmentSelection(segment: ToothSegment) {
    const index = selectedSegments.value.findIndex((s) => s.id === segment.id);

    if (index >= 0) {
      // Deselect
      selectedSegments.value = [];
      segment.isSelected = false;
      updateSegmentAppearance(segment);
    } else {
      selectedSegments.value.forEach((s) => {
        s.isSelected = false;
        updateSegmentAppearance(s);
      });
      selectedSegments.value = [segment];
      segment.isSelected = true;
      updateSegmentAppearance(segment);
    }
  }

  function updateSegmentAppearance(segment: ToothSegment) {
    const material = segment.mesh.material as any;

    // Ensure the material uses the segment's color
    if (segment.color && material.color) {
      material.color.copy(segment.color);
    }

    if (segment.isSelected) {
      material.emissive.setHex(0x333333);
      material.emissiveIntensity = 0.2;
      material.transparent = true;
      material.opacity = 0.85;
      material.roughness = 0.2;
      material.metalness = 0.15;
    } else {
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0.0;
      material.transparent = true;
      material.opacity = 0.95;
      material.roughness = 0.4;
      material.metalness = 0.05;
    }
  }

  function updateSegmentMovementHistory(
    segment: ToothSegment,
    movementType: "drag" | "directional" | "manual"
  ) {
    if (!segment.originalPosition || !segment.movementHistory) return;

    const currentPosition = segment.mesh.position;
    const deltaPosition = currentPosition.clone().sub(segment.originalPosition);

    // Update movement history
    segment.movementHistory.totalDistance =
      segment.originalPosition.distanceTo(currentPosition);
    segment.movementHistory.axisMovements = {
      anteroposterior: deltaPosition.z,
      vertical: deltaPosition.y,
      transverse: deltaPosition.x,
    };
    segment.movementHistory.lastMovementType = movementType;
    segment.movementHistory.movementCount += 1;

    // Also update the legacy movementDistance for backward compatibility
    segment.movementDistance = segment.movementHistory.totalDistance;

    console.log(
      `Updated movement history for ${segment.name}:`,
      segment.movementHistory
    );
  }

  // Intersection detection functions
  function initializeIntersectionDetection(scene: any) {
    // Initialize both the traditional service (for visualizations) and the worker service
    intersectionService.value = new IntersectionDetectionService(scene, {
      severityThresholds: {
        low: 1.0,
        medium: 5.0,
        high: 10.0
      },
      distanceThreshold: 2.0,
      sampleCount: 200
    });

    // Initialize the worker service
    intersectionWorkerService.value = new IntersectionWorkerService();
  }

  function detectIntersections(dentalModel: DentalModel) {
    // Clear any existing timeout
    if (intersectionDetectionTimeout) {
      clearTimeout(intersectionDetectionTimeout);
    }

    // Prevent infinite loops by checking if already running
    if (isIntersectionDetectionRunning.value) {
      console.log("Intersection detection already running, skipping...");
      return;
    }

    // Additional safety check: don't run if segments are still loading
    if (!dentalModel || !dentalModel.segments || dentalModel.segments.length === 0) {
      console.log("No segments available for intersection detection, skipping...");
      return;
    }

    // Use Web Worker for intersection detection
    if (intersectionWorkerService.value && intersectionWorkerService.value.isWorkerReady()) {
      performWorkerIntersectionDetection(dentalModel);
    } else {
      // Fallback to traditional method if worker is not ready
      console.log("Worker not ready, using traditional intersection detection");
      intersectionDetectionTimeout = setTimeout(() => {
        performIntersectionDetection(dentalModel);
      }, 100);
    }
  }

  function performWorkerIntersectionDetection(dentalModel: DentalModel) {
    if (!intersectionWorkerService.value || !dentalModel.segments.length) {
      intersectionResults.value = [];
      intersectionStatistics.value = null;
      return;
    }

    // Check if all segments are properly loaded with valid meshes
    const validSegments = dentalModel.segments.filter(segment => 
      segment && segment.mesh && segment.mesh.geometry && segment.mesh.visible !== undefined
    );

    if (validSegments.length !== dentalModel.segments.length) {
      console.log(`Skipping intersection detection: ${validSegments.length}/${dentalModel.segments.length} segments are ready`);
      return;
    }

    isIntersectionDetectionRunning.value = true;
    intersectionDetectionProgress.value = 0;
    
    console.log("Starting worker-based intersection detection for", dentalModel.segments.length, "segments");

    intersectionWorkerService.value.detectIntersections(
      dentalModel.segments,
      undefined, // config
      (progress) => {
        // Progress callback
        intersectionDetectionProgress.value = progress;
        console.log(`Intersection detection progress: ${progress}%`);
      },
      (results) => {
        // Complete callback
        intersectionResults.value = results;
        
        // Calculate statistics
        const statistics = calculateIntersectionStatistics(results);
        intersectionStatistics.value = statistics;
        
        // Create visualizations using the traditional service
        if (intersectionService.value) {
          intersectionService.value.createIntersectionVisualizations();
        }
        
        console.log("Worker-based intersection detection completed:", {
          totalIntersections: results.length,
          statistics: intersectionStatistics.value
        });
        
        isIntersectionDetectionRunning.value = false;
        intersectionDetectionProgress.value = 100;
      },
      (error) => {
        // Error callback
        console.error("Worker-based intersection detection failed:", error);
        isIntersectionDetectionRunning.value = false;
        intersectionDetectionProgress.value = 0;
      }
    );
  }

  function performIntersectionDetection(dentalModel: DentalModel) {
    if (!intersectionService.value || !dentalModel.segments.length) {
      intersectionResults.value = [];
      intersectionStatistics.value = null;
      return;
    }

    // Check if all segments are properly loaded with valid meshes
    const validSegments = dentalModel.segments.filter(segment => 
      segment && segment.mesh && segment.mesh.geometry && segment.mesh.visible !== undefined
    );

    if (validSegments.length !== dentalModel.segments.length) {
      console.log(`Skipping intersection detection: ${validSegments.length}/${dentalModel.segments.length} segments are ready`);
      return;
    }

    isIntersectionDetectionRunning.value = true;
    
    try {
      console.log("Detecting intersections for", dentalModel.segments.length, "segments");
      
      // Detect intersections
      const results = intersectionService.value.detectIntersections(dentalModel.segments);
      intersectionResults.value = results;
      
      // Get statistics
      intersectionStatistics.value = intersectionService.value.getIntersectionStatistics();
      
      // Create visualizations
      intersectionService.value.createIntersectionVisualizations();
      
      console.log("Intersection detection completed:", {
        totalIntersections: results.length,
        statistics: intersectionStatistics.value
      });
    } catch (error) {
      console.error("Error during intersection detection:", error);
    } finally {
      isIntersectionDetectionRunning.value = false;
    }
  }

  function calculateIntersectionStatistics(results: IntersectionResult[]): IntersectionStatistics {
    const totalIntersections = results.length;
    const bySeverity = {
      low: results.filter(r => r.severity === 'low').length,
      medium: results.filter(r => r.severity === 'medium').length,
      high: results.filter(r => r.severity === 'high').length
    };

    const byType = {
      contact: results.filter(r => r.intersectionType === 'contact').length,
      overlap: results.filter(r => r.intersectionType === 'overlap').length,
      collision: results.filter(r => r.intersectionType === 'collision').length
    };

    const totalIntersectionVolume = results.reduce((sum, r) => sum + r.intersectionVolume, 0);
    const averagePenetrationDepth = totalIntersections > 0 
      ? results.reduce((sum, r) => sum + r.penetrationDepth, 0) / totalIntersections 
      : 0;

    return {
      totalIntersections,
      bySeverity,
      byType,
      averagePenetrationDepth,
      totalIntersectionVolume
    };
  }

  function clearIntersectionVisualizations() {
    if (intersectionService.value) {
      intersectionService.value.clearIntersectionVisualizations();
    }
  }

  function getIntersectionsForSegment(segmentId: string): IntersectionResult[] {
    if (!intersectionService.value) return [];
    return intersectionService.value.getIntersectionsForSegment(segmentId);
  }

  function hasIntersections(): boolean {
    if (!intersectionService.value) return false;
    return intersectionService.value.hasIntersections();
  }

  function updateIntersectionConfig(config: Partial<IntersectionConfig>) {
    if (intersectionService.value) {
      intersectionService.value.updateConfig(config);
    }
  }

  function getIntersectionConfig(): IntersectionConfig | null {
    if (!intersectionService.value) return null;
    return intersectionService.value.getConfig();
  }

  function resetIndividualPosition(segment: ToothSegment) {
    if (!segment.originalPosition || !segment.isSelected) return;

    segment.mesh.position.copy(segment.originalPosition);
    segment.mesh.updateMatrixWorld();

    // Reset movement distance and history
    segment.movementDistance = 0;
    if (segment.movementHistory) {
      segment.movementHistory.totalDistance = 0;
      segment.movementHistory.axisMovements = {
        anteroposterior: 0,
        vertical: 0,
        transverse: 0,
      };
      segment.movementHistory.lastMovementType = undefined;
      segment.movementHistory.movementCount = 0;
    }

    console.log(
      `Reset position and movement history for segment: ${segment.name}`
    );
  }

  function toggleSegmentVisibility(segment: ToothSegment) {
    segment.mesh.visible = !segment.mesh.visible;
    
    console.log(
      `Segment ${segment.name} ${segment.mesh.visible ? "shown" : "hidden"}`
    );
  }

  function changeSegmentColor(segment: ToothSegment, event: Event) {
    const input = event.target as HTMLInputElement;
    // Create a proper THREE.js Color object
    const color = new THREE.Color(input.value);

    segment.color = color;
    const material = segment.mesh.material as any;
    material.color = color;
  }

  function deleteSegment(segment: ToothSegment, scene: any, dentalModel: DentalModel) {
    if (!dentalModel) return;

    console.log(`🗑️ Starting deletion of segment: ${segment.name} (ID: ${segment.id})`);
    console.log(`📊 Before deletion - Total segments: ${dentalModel.segments.length}`);

    // Remove from scene
    scene.remove(segment.mesh);
    console.log(`🎭 Removed mesh from scene`);
    
    // Remove from dentalModel segments array
    const index = dentalModel.segments.findIndex(
      (s) => s.id === segment.id
    );
    if (index >= 0) {
      dentalModel.segments.splice(index, 1);
      console.log(`📋 Removed segment from dentalModel at index ${index}`);
    } else {
      console.warn(`⚠️ Segment not found in dentalModel segments array`);
    }

    // Remove from selected segments if it was selected
    const selectedIndex = selectedSegments.value.findIndex(
      (s) => s.id === segment.id
    );
    if (selectedIndex >= 0) {
      selectedSegments.value.splice(selectedIndex, 1);
      console.log(`✅ Removed segment from selected segments`);
    }

    // Note: This function doesn't have access to the ref, so we'll need to handle reactivity in the caller
    console.log(`🗑️ Deleted segment: ${segment.name}. Remaining segments: ${dentalModel.segments.length}`);
  }

  function toggleAllSegments(dentalModel: DentalModel) {
    if (!dentalModel?.segments.length) return;

    const allVisible = areAllSegmentsVisible(dentalModel);

    dentalModel.segments.forEach((segment) => {
      segment.mesh.visible = !allVisible;
    });

    console.log(`All segments ${!allVisible ? "shown" : "hidden"}`);
  }

  function areAllSegmentsVisible(dentalModel: DentalModel): boolean {
    if (!dentalModel?.segments.length) return false;

    return dentalModel.segments.every((segment) => segment.mesh.visible);
  }

  function toggleOriginalMesh(dentalModel: DentalModel) {
    if (!dentalModel?.originalMesh) return;

    dentalModel.originalMesh.visible =
      !dentalModel.originalMesh.visible;
    console.log(
      `Original mesh ${
        dentalModel.originalMesh.visible ? "shown" : "hidden"
      }`
    );
  }

  function clearExistingSegments(dentalModel: DentalModel, scene: any) {
    if (!dentalModel) return;
    
    // Remove all existing segments from scene
    dentalModel.segments.forEach((segment) => {
      scene.remove(segment.mesh);
    });
    
    // Clear segments array
    dentalModel.segments = [];
    dentalModel = { ...dentalModel };
    selectedSegments.value = [];
    
    console.log("Cleared existing manual segments for AI segmentation");
  }

  function cleanup() {
    // Clear any pending intersection detection timeout
    if (intersectionDetectionTimeout) {
      clearTimeout(intersectionDetectionTimeout);
      intersectionDetectionTimeout = null;
    }
    
    // Terminate the worker service
    if (intersectionWorkerService.value) {
      intersectionWorkerService.value.terminate();
      intersectionWorkerService.value = null;
    }
    
    // Reset intersection detection state
    isIntersectionDetectionRunning.value = false;
    intersectionDetectionProgress.value = 0;
    
    console.log("Cleaned up segment manager resources");
  }

  return {
    // State
    selectedSegments,
    totalMovementDistance,
    movementAxis,
    axisMovementDistances,
    intersectionResults,
    intersectionStatistics,
    intersectionDetectionProgress,
    isIntersectionDetectionRunning,
    
    // Methods
    toggleSegmentSelection,
    updateSegmentAppearance,
    updateSegmentMovementHistory,
    resetIndividualPosition,
    toggleSegmentVisibility,
    changeSegmentColor,
    deleteSegment,
    toggleAllSegments,
    areAllSegmentsVisible,
    toggleOriginalMesh,
    clearExistingSegments,
    
    // Intersection detection functions
    initializeIntersectionDetection,
    detectIntersections,
    clearIntersectionVisualizations,
    getIntersectionsForSegment,
    hasIntersections,
    updateIntersectionConfig,
    getIntersectionConfig,
    
    // Cleanup
    cleanup,
  };
}
