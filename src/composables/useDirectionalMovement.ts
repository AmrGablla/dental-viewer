// Remove unused import
import type { ToothSegment } from '../types/dental';

/**
 * Dental-Aware Movement Controls
 * 
 * This module provides movement controls that are aware of dental anatomy:
 * - Root direction calculation from tooth geometry
 * - Movement along tooth root axis for extrusion/intrusion
 * - Proper dental coordinate system (mesial-distal, buccal-lingual, occlusal-apical)
 */

interface DentalAxes {
  rootAxis: any;        // Occlusal-Apical axis (along root direction)
  mesialDistalAxis: any; // Mesial-Distal axis (anterior-posterior along arch)
  buccalLingualAxis: any; // Buccal-Lingual axis (transverse, perpendicular to arch)
}

// Cache for dental axes per segment to avoid recalculation
const dentalAxesCache = new Map<string, DentalAxes>();

export function useDirectionalMovement() {
  let directionalMoveInterval: number | null = null;
  let isDirectionalMoving = false;
  let movementStartPosition: any;

  /**
   * Calculate tooth root direction from geometry
   * Root direction points from crown (occlusal) toward apex (apical)
   */
  function calculateRootDirection(segment: ToothSegment, THREE: any): any {
    const geometry = segment.mesh.geometry;
    const positions = geometry.getAttribute('position');
    
    if (!positions || positions.count === 0) {
      // Fallback to default downward direction
      return new THREE.Vector3(0, -1, 0);
    }

    // Find the lowest point (most apical point)
    let lowestPoint = new THREE.Vector3(Infinity, Infinity, Infinity);
    let highestPoint = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    
    const tempPoint = new THREE.Vector3();
    
    for (let i = 0; i < positions.count; i++) {
      tempPoint.fromBufferAttribute(positions, i);
      tempPoint.applyMatrix4(segment.mesh.matrixWorld);
      
      if (tempPoint.y < lowestPoint.y) {
        lowestPoint.copy(tempPoint);
      }
      if (tempPoint.y > highestPoint.y) {
        highestPoint.copy(tempPoint);
      }
    }

    // Root direction: from highest point (occlusal) toward lowest point (apical)
    // This gives a more accurate representation of the tooth's long axis
    const rootDirection = new THREE.Vector3()
      .subVectors(lowestPoint, highestPoint)
      .normalize();

    // If root direction is too small or invalid, use default downward
    if (rootDirection.length() < 0.01) {
      rootDirection.set(0, -1, 0);
    }

    return rootDirection;
  }

  /**
   * Calculate dental coordinate axes for a segment
   * These axes respect tooth anatomy and root direction
   */
  function calculateDentalAxes(segment: ToothSegment, THREE: any, camera: any): DentalAxes {
    // Check cache first
    const cacheKey = segment.id;
    if (dentalAxesCache.has(cacheKey)) {
      return dentalAxesCache.get(cacheKey)!;
    }

    // Calculate root axis (occlusal-apical)
    const rootAxis = calculateRootDirection(segment, THREE);

    // Calculate mesial-distal axis (anterior-posterior along dental arch)
    // For upper jaw: generally forward (positive Z in standard orientation)
    // For lower jaw: generally forward but may vary
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    const cameraForward = cameraDirection.clone().negate();
    
    // Project camera forward onto plane perpendicular to root axis
    const mesialDistalAxis = new THREE.Vector3()
      .subVectors(
        cameraForward,
        rootAxis.clone().multiplyScalar(cameraForward.dot(rootAxis))
      )
      .normalize();

    // Calculate buccal-lingual axis (transverse, perpendicular to arch)
    // Cross product of root axis and mesial-distal axis
    const buccalLingualAxis = new THREE.Vector3()
      .crossVectors(rootAxis, mesialDistalAxis)
      .normalize();

    // Ensure right-handed coordinate system
    const crossCheck = new THREE.Vector3().crossVectors(mesialDistalAxis, rootAxis);
    if (crossCheck.dot(buccalLingualAxis) < 0) {
      buccalLingualAxis.negate();
    }

    const axes: DentalAxes = {
      rootAxis,
      mesialDistalAxis,
      buccalLingualAxis
    };

    // Cache for performance
    dentalAxesCache.set(cacheKey, axes);
    return axes;
  }

  /**
   * Clear cached axes for a segment (call when geometry changes)
   */
  function clearDentalAxesCache(segmentId?: string) {
    if (segmentId) {
      dentalAxesCache.delete(segmentId);
    } else {
      dentalAxesCache.clear();
    }
  }

  function startDirectionalMove(
    axis: "Anteroposterior" | "Vertical" | "Transverse",
    direction: number,
    selectedSegments: ToothSegment[],
    camera: any,
    THREE: any,
    onMovementComplete?: () => void
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

      moveSegmentInDirection(axis, direction * moveStep, selectedSegments, camera, THREE, onMovementComplete);
    }, moveInterval);

    console.log(
      `Started dental-aware directional movement: ${axis} ${
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
    THREE: any,
    onMovementComplete?: () => void
  ) {
    if (selectedSegments.length === 0) return;

    // Apply movement to all selected segments
    selectedSegments.forEach((segment) => {
      // Calculate dental axes for this segment
      const axes = calculateDentalAxes(segment, THREE, camera);
      
      // Calculate movement vector based on dental coordinate system
      const movementVector = new THREE.Vector3();

      if (axis === "Transverse") {
        // Buccal-Lingual movement (transverse, perpendicular to arch)
        movementVector.addScaledVector(axes.buccalLingualAxis, distance);
      } else if (axis === "Vertical") {
        // Occlusal-Apical movement along root axis
        // This is the key dental-aware improvement: vertical movement follows root direction
        movementVector.addScaledVector(axes.rootAxis, distance);
      } else if (axis === "Anteroposterior") {
        // Mesial-Distal movement (anterior-posterior along dental arch)
        movementVector.addScaledVector(axes.mesialDistalAxis, distance);
      }

      // Apply movement to segment
      segment.mesh.position.add(movementVector);
      segment.mesh.updateMatrixWorld();
    });

    // Call movement complete callback for intersection detection
    if (onMovementComplete) {
      onMovementComplete();
    }

    // Update distance tracking
    if (selectedSegments[0]) {
      const currentPosition = selectedSegments[0].mesh.position;

      // Update individual segment movement distance and history
      const segment = selectedSegments[0];
      if (segment.originalPosition) {
        segment.movementDistance =
          segment.originalPosition.distanceTo(currentPosition);
        // Update movement history
        updateSegmentMovementHistory(segment, "directional", THREE, camera);
      }

      // Calculate axis-specific distances using dental coordinate system
      const axes = calculateDentalAxes(selectedSegments[0], THREE, camera);
      const deltaPosition = currentPosition.clone().sub(movementStartPosition);
      
      // Project delta onto dental axes
      const axisMovementDistances = {
        transverse: deltaPosition.dot(axes.buccalLingualAxis),
        vertical: deltaPosition.dot(axes.rootAxis),
        anteroposterior: deltaPosition.dot(axes.mesialDistalAxis),
      };

      console.log("Dental-aware movement distances:", axisMovementDistances);
    }
  }

  function updateSegmentMovementHistory(
    segment: ToothSegment,
    movementType: "drag" | "directional" | "manual",
    THREE: any,
    camera: any
  ) {
    if (!segment.originalPosition || !segment.movementHistory) return;

    const currentPosition = segment.mesh.position;
    const deltaPosition = currentPosition.clone().sub(segment.originalPosition);

    // Calculate dental axes to project movement correctly
    const axes = calculateDentalAxes(segment, THREE, camera);

    // Project delta position onto dental coordinate system
    const dentalMovements = {
      anteroposterior: deltaPosition.dot(axes.mesialDistalAxis),
      vertical: deltaPosition.dot(axes.rootAxis),
      transverse: deltaPosition.dot(axes.buccalLingualAxis),
    };

    // Update movement history
    segment.movementHistory.totalDistance =
      segment.originalPosition.distanceTo(currentPosition);
    segment.movementHistory.axisMovements = dentalMovements;
    segment.movementHistory.lastMovementType = movementType;
    segment.movementHistory.movementCount += 1;

    // Also update the legacy movementDistance for backward compatibility
    segment.movementDistance = segment.movementHistory.totalDistance;

    console.log(
      `Updated dental-aware movement history for ${segment.name}:`,
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
    calculateDentalAxes,
    clearDentalAxesCache,
    cleanup,
  };
}
