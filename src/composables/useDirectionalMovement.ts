// Remove unused import
import type { ToothSegment } from '../types/dental';

export function useDirectionalMovement() {
  let directionalMoveInterval: number | null = null;
  let isDirectionalMoving = false;
  let movementStartPosition: any;

  function startDirectionalMove(
    axis: "Anteroposterior" | "Vertical" | "Transverse",
    direction: number,
    selectedSegments: ToothSegment[],
    camera: any,
    THREE: any
  ) {
    if (selectedSegments.length === 0) return;

    isDirectionalMoving = true;

    // Initialize movement start position if not already set
    if (!movementStartPosition) {
      movementStartPosition = selectedSegments[0].mesh.position.clone();
    }

    // Continuous movement while button is held
    const moveStep = 0.1; // mm per step
    const moveInterval = 50; // ms between moves

    directionalMoveInterval = window.setInterval(() => {
      if (!isDirectionalMoving) return;

      moveSegmentInDirection(axis, direction * moveStep, selectedSegments, camera, THREE);
    }, moveInterval);

    console.log(
      `Started directional movement: ${axis} ${
        direction > 0 ? "positive" : "negative"
      }`
    );
  }

  function stopDirectionalMove() {
    isDirectionalMoving = false;

    if (directionalMoveInterval) {
      clearInterval(directionalMoveInterval);
      directionalMoveInterval = null;
    }

    console.log("Stopped directional movement");
  }

  function moveSegmentInDirection(
    axis: "Anteroposterior" | "Vertical" | "Transverse",
    distance: number,
    selectedSegments: ToothSegment[],
    camera: any,
    THREE: any
  ) {
    if (selectedSegments.length === 0) return;

    // Get camera vectors for proper 3D movement
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);

    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(camera.up, cameraDirection).normalize();

    const cameraUp = new THREE.Vector3();
    cameraUp.crossVectors(cameraDirection, cameraRight).normalize();

    const cameraForward = cameraDirection.clone().negate();

    // Calculate movement vector based on axis
    const movementVector = new THREE.Vector3();

    if (axis === "Transverse") {
      // Side-to-side movement (X-axis in 3D space)
      movementVector.addScaledVector(cameraRight, distance);
    } else if (axis === "Vertical") {
      // Up-down movement (Y-axis in 3D space)
      movementVector.addScaledVector(cameraUp, distance);
    } else if (axis === "Anteroposterior") {
      // Front-back movement (Z-axis in 3D space)
      movementVector.addScaledVector(cameraForward, distance);
    }

    // Apply movement to all selected segments
    selectedSegments.forEach((segment) => {
      segment.mesh.position.add(movementVector);
      segment.mesh.updateMatrixWorld();
    });

    // Update distance tracking
    if (selectedSegments[0]) {
      const currentPosition = selectedSegments[0].mesh.position;
      // Note: totalDistance calculation removed as movementStartPosition is not available

      // Update individual segment movement distance and history
      const segment = selectedSegments[0];
      if (segment.originalPosition) {
        segment.movementDistance =
          segment.originalPosition.distanceTo(currentPosition);
        // Update movement history
        updateSegmentMovementHistory(segment, "directional");
      }

      // Calculate axis-specific distances using dental coordinate system
      const deltaPosition = currentPosition.clone().sub(movementStartPosition);
      const axisMovementDistances = {
        transverse: deltaPosition.x, // Side-to-side (X in 3D space)
        vertical: deltaPosition.y, // Up-down (Y in 3D space)
        anteroposterior: deltaPosition.z, // Front-back (Z in 3D space)
      };

      console.log("Movement distances:", axisMovementDistances);
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

  function cleanup() {
    if (directionalMoveInterval) {
      clearInterval(directionalMoveInterval);
      directionalMoveInterval = null;
    }
    isDirectionalMoving = false;
  }

  return {
    // State
    isDirectionalMoving: () => isDirectionalMoving,
    
    // Methods
    startDirectionalMove,
    stopDirectionalMove,
    moveSegmentInDirection,
    updateSegmentMovementHistory,
    cleanup,
  };
}
