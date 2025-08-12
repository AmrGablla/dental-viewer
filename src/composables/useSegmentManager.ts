import { ref, markRaw } from 'vue';
import type { ToothSegment, DentalModel } from '../types/dental';

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
    // Note: THREE reference needs to be passed to this function
    // For now, we'll use a simple color object
    const color = { hex: input.value } as any;

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

  return {
    // State
    selectedSegments,
    totalMovementDistance,
    movementAxis,
    axisMovementDistances,
    
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
  };
}
