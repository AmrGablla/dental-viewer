<template>
  <div class="dental-viewer">
    <TopToolbar
      :dentalModel="dentalModel"
      :selectedSegments="selectedSegments"
      :currentMode="currentMode"
      :isLoading="isLoading"
      :interactionModes="interactionModes"
      :autoSegmentationEnabled="autoSegmentationEnabled"
      @fileUpload="handleFileUpload"
      @exportModel="exportModel"
      @setInteractionMode="setInteractionMode"
      @toggleAutoSegmentation="toggleAutoSegmentation"
    />

    <!-- Background Status Indicator -->
    <BackgroundStatusIndicator 
      :status="backgroundSegmentationStatus"
      @dismiss="dismissBackgroundStatus"
    />

    <!-- Main Content Area -->
    <div class="main-content">
      <LeftSidebar
        :dentalModel="dentalModel"
        :selectedSegments="selectedSegments"
        :totalMovementDistance="totalMovementDistance"
        @toggleOriginalMesh="toggleOriginalMesh"
        @toggleAllSegments="toggleAllSegments"
        @toggleSegmentSelection="toggleSegmentSelection"
        @changeSegmentColor="changeSegmentColor"
        @resetIndividualPosition="resetIndividualPosition"
        @toggleSegmentVisibility="toggleSegmentVisibility"
        @resetSegmentPosition="resetSegmentPosition"
        @startDirectionalMove="startDirectionalMove"
        @stopDirectionalMove="stopDirectionalMove"
        @mergeSelectedSegments="mergeSelectedSegments"
        @splitSelectedSegment="splitSelectedSegment"
        @deleteSelectedSegments="deleteSelectedSegments"
      />

      <ViewportArea
        ref="viewportRef"
        :dentalModel="dentalModel"
        :currentMode="currentMode"
        :isLoading="isLoading"
        :loadingMessage="loadingMessage"
        @setViewPreset="setViewPreset"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  ref,
  onMounted,
  onUnmounted,
  shallowRef,
  markRaw,
  watch,
  computed,
} from "vue";
import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { STLLoaderService } from "../services/STLLoader";
import { SegmentationService } from "../services/SegmentationService";
import type {
  DentalModel,
  ToothSegment,
  InteractionMode,
  SegmentationResult,
  SegmentData,
} from "../types/dental";
import TopToolbar from "./TopToolbar.vue";
import LeftSidebar from "./LeftSidebar.vue";
import ViewportArea from "./ViewportArea.vue";
import BackgroundStatusIndicator from "./BackgroundStatusIndicator.vue";

// Add BVH extensions to THREE.js
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Refs
const viewportRef = ref<typeof ViewportArea>();

// Canvas container reference
const canvasContainer = computed(
  () => viewportRef.value?.canvasContainer as HTMLDivElement
);

// Services
const stlLoader = new STLLoaderService();
const segmentationService = new SegmentationService();

// Reactive state
const dentalModel = shallowRef<DentalModel | null>(null);
const selectedSegments = ref<ToothSegment[]>([]);
const currentMode = ref<InteractionMode["mode"]>("select");
const isLoading = ref(false);
const loadingMessage = ref("");
const totalMovementDistance = ref(0);
const movementAxis = ref<
  "Anteroposterior" | "Vertical" | "Transverse" | "Combined" | "None"
>("None");
const axisMovementDistances = ref({
  anteroposterior: 0, // Front-back (Z-axis in 3D space)
  vertical: 0, // Up-down (Y-axis in 3D space)
  transverse: 0, // Side-side (X-axis in 3D space)
});
const autoSegmentationEnabled = ref(true); // Auto AI segmentation toggle
const backgroundSegmentationStatus = ref<{
  isRunning: boolean;
  message: string;
  progress?: number;
}>({
  isRunning: false,
  message: "",
  progress: undefined,
});

const interactionModes: InteractionMode["mode"][] = [
  "select",
  "lasso",
  "move",
  "rotate",
];

// Three.js objects
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let resizeObserver: ResizeObserver | null = null;

// Interaction state
let isDragging = false;
let isLassoActive = false;
let isPanning = false;
let movementStartPosition = new THREE.Vector3();
let lastMousePosition = new THREE.Vector2();
let lassoPoints: THREE.Vector2[] = [];
let lassoPath: SVGPathElement | null = null;
let movementStartMousePosition = new THREE.Vector2();
let constrainedAxis: "Anteroposterior" | "Vertical" | "Transverse" | null =
  null;
let directionalMoveInterval: number | null = null;
let isDirectionalMoving = false;

onMounted(() => {
  initThreeJS();
  setupEventListeners();
});

// Watch for mode changes to update canvas cursor
watch(currentMode, (newMode) => {
  if (renderer && renderer.domElement) {
    renderer.domElement.setAttribute("data-mode", newMode);
  }
});

onUnmounted(() => {
  // Stop any ongoing directional movement
  if (directionalMoveInterval) {
    clearInterval(directionalMoveInterval);
    directionalMoveInterval = null;
  }
  cleanup();
});

// Cleanup function to dispose renderer and remove event listeners
function cleanup() {
  if (renderer) {
    renderer.dispose();
  }

  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }

  // Remove keyboard event listeners
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("keyup", onKeyUp);
  window.removeEventListener("resize", onWindowResize);
}

function initThreeJS() {
  if (!canvasContainer.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // Get container dimensions
  const containerWidth = canvasContainer.value.clientWidth;
  const containerHeight = canvasContainer.value.clientHeight;

  console.log("Container dimensions:", containerWidth, "x", containerHeight);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    containerWidth / containerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 0, 50);

  // Ensure camera matrices are properly initialized
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(containerWidth, containerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Ensure canvas fills container
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";

  canvasContainer.value.appendChild(renderer.domElement);

  // Set initial canvas mode attribute
  renderer.domElement.setAttribute("data-mode", currentMode.value);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(50, 50, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  const pointLight = new THREE.PointLight(0xffffff, 0.5);
  pointLight.position.set(-50, -50, 50);
  scene.add(pointLight);

  // Raycaster for picking
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // Start render loop
  animate();
}

function setupEventListeners() {
  if (!canvasContainer.value) return;

  const canvas = renderer.domElement;

  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("wheel", onWheel);

  // Add keyboard listeners for modifier keys
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onWindowResize);

  // Setup ResizeObserver to handle container size changes
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === canvasContainer.value) {
          onWindowResize();
        }
      }
    });
    resizeObserver.observe(canvasContainer.value);
  }
}

function onMouseDown(event: MouseEvent) {
  isDragging = true;
  updateMousePosition(event);

  // Store initial mouse position for rotation and movement
  lastMousePosition.set(event.clientX, event.clientY);

  // Check if Cmd (Mac) or Ctrl (Windows/Linux) is held for rotation
  const isRotationRequested = event.metaKey || event.ctrlKey;

  if (isRotationRequested) {
    isPanning = true; // Keep variable name for compatibility but use for rotation
    // Change cursor to indicate rotation mode
    if (renderer?.domElement) {
      renderer.domElement.style.cursor = "grabbing";
    }
  } else if (
    selectedSegments.value.length > 0 &&
    currentMode.value !== "lasso"
  ) {
    // Always start 3D movement of selected segments (except in lasso mode)
    movementStartMousePosition.set(event.clientX, event.clientY);
    constrainedAxis = null; // Reset axis constraint
    movementAxis.value = "None";
    axisMovementDistances.value = {
      anteroposterior: 0,
      vertical: 0,
      transverse: 0,
    };
    console.log("Starting 3D segment movement");
  } else if (currentMode.value === "lasso") {
    // Start lasso selection if in lasso mode and not rotating
    startLassoSelection(event);
  }
}

function onMouseMove(event: MouseEvent) {
  updateMousePosition(event);

  if (isDragging) {
    if (isPanning) {
      // Rotate the camera/model with modifier key
      rotateWithModifier(event);
    } else if (
      selectedSegments.value.length > 0 &&
      currentMode.value !== "lasso"
    ) {
      // Always move selected segments when dragging (except in lasso mode)
      moveSegmentsIn3D(event);
    } else if (currentMode.value === "lasso") {
      updateLassoSelection(event);
    } else if (currentMode.value === "rotate") {
      // Implement rotation logic for selected segments
      rotateCamera(event);
    }
  }

  // Update cursor based on modifier keys (even when not dragging)
  if (renderer?.domElement) {
    if (event.metaKey || event.ctrlKey) {
      renderer.domElement.style.cursor = "grab";
    } else if (
      selectedSegments.value.length > 0 &&
      currentMode.value !== "lasso" &&
      currentMode.value !== "rotate"
    ) {
      renderer.domElement.style.cursor = "move";
    } else {
      // Reset cursor based on current mode
      const cursorMap = {
        lasso: "crosshair",
        select: "pointer",
        rotate: "grab",
        move: "move",
      };
      renderer.domElement.style.cursor =
        cursorMap[currentMode.value] || "default";
    }
  }
}

function onMouseUp(event: MouseEvent) {
  if (isDragging && currentMode.value === "lasso" && isLassoActive) {
    finalizeLassoSelection(event);
  }

  // Reset rotation state and cursor
  if (isPanning) {
    isPanning = false;
    if (renderer?.domElement) {
      renderer.domElement.style.cursor = "grab"; // Keep grab cursor if modifier still held
    }
  }

  // End segment movement
  if (selectedSegments.value.length > 0 && isDragging) {
    console.log(
      `Finished moving segments. Total distance: ${totalMovementDistance.value.toFixed(
        2
      )}mm`
    );
  }

  isDragging = false;
}

function onClick(event: MouseEvent) {
  updateMousePosition(event);

  if (currentMode.value === "select") {
    selectSegment();
  } else if (currentMode.value === "lasso") {
    // Implement lasso selection
  }
}

function onWheel(event: WheelEvent) {
  event.preventDefault(); // Prevent page scroll

  // Detect touchpad vs mouse wheel for different sensitivities
  const isTouchpad = Math.abs(event.deltaY) < 100 && event.deltaY % 1 !== 0;

  // Increased sensitivity for better accuracy and control
  const zoomSensitivity = isTouchpad ? 0.015 : 0.05;

  // REVERSED: Positive deltaY now zooms IN (closer), negative zooms OUT (farther)
  let zoomDelta = event.deltaY * zoomSensitivity;

  // Increased range for better accuracy
  zoomDelta = Math.max(-0.2, Math.min(0.2, zoomDelta));

  const zoomFactor = 1 + zoomDelta;

  // Get current distance from origin
  const currentDistance = camera.position.length();

  // Apply zoom with limits to prevent getting too close or too far
  const minDistance = 2; // Closer minimum for better detail inspection
  const maxDistance = 800; // Farther maximum for overview
  const newDistance = currentDistance * zoomFactor;

  // Only zoom if within reasonable bounds
  if (newDistance >= minDistance && newDistance <= maxDistance) {
    // More responsive interpolation for better accuracy
    const targetPosition = camera.position.clone().multiplyScalar(zoomFactor);

    // Increased lerp factor for more immediate response
    camera.position.lerp(targetPosition, 0.9);
    camera.updateMatrixWorld();
  }
}

function onWindowResize() {
  if (!canvasContainer.value || !camera || !renderer) return;

  const containerWidth = canvasContainer.value.clientWidth;
  const containerHeight = canvasContainer.value.clientHeight;

  console.log("Resizing to:", containerWidth, "x", containerHeight);

  camera.aspect = containerWidth / containerHeight;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  renderer.setSize(containerWidth, containerHeight);

  // Ensure canvas still fills container after resize
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
}

function onKeyDown(event: KeyboardEvent) {
  // Update cursor when modifier keys are pressed
  if ((event.metaKey || event.ctrlKey) && renderer?.domElement && !isDragging) {
    renderer.domElement.style.cursor = "grab";
  }
}

function onKeyUp(event: KeyboardEvent) {
  // Reset cursor when modifier keys are released
  if (!event.metaKey && !event.ctrlKey && renderer?.domElement && !isDragging) {
    // Reset cursor based on current mode
    const cursorMap = {
      lasso: "crosshair",
      select: "pointer",
      rotate: "grab",
      move: "move",
    };
    renderer.domElement.style.cursor =
      cursorMap[currentMode.value] || "default";
  }
}

function updateMousePosition(event: MouseEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function selectSegment() {
  if (!dentalModel.value) return;

  raycaster.setFromCamera(mouse, camera);

  const meshes = dentalModel.value.segments.map((segment) => segment.mesh);
  const intersects = raycaster.intersectObjects(meshes);

  if (intersects.length > 0) {
    const intersectedMesh = intersects[0].object as THREE.Mesh;
    const segment = dentalModel.value.segments.find(
      (s) => s.mesh === intersectedMesh
    );

    if (segment) {
      toggleSegmentSelection(segment);
    }
  }
}

function toggleSegmentSelection(segment: ToothSegment) {
  const index = selectedSegments.value.findIndex((s) => s.id === segment.id);

  if (index >= 0) {
    // Deselect
    selectedSegments.value.splice(index, 1);
    segment.isSelected = false;
    updateSegmentAppearance(segment);
  } else {
    // Select
    selectedSegments.value.push(segment);
    segment.isSelected = true;
    updateSegmentAppearance(segment);
  }
}

function updateSegmentAppearance(segment: ToothSegment) {
  const material = segment.mesh.material as THREE.MeshLambertMaterial;

  if (segment.isSelected) {
    material.emissive.setHex(0x444444);
    material.transparent = true;
    material.opacity = 0.8;
  } else {
    material.emissive.setHex(0x000000);
    material.transparent = false;
    material.opacity = 1.0;
  }
}

function rotateCamera(event: MouseEvent) {
  // Simple orbit camera rotation
  const deltaX = event.movementX * 0.01;
  const deltaY = event.movementY * 0.01;

  const spherical = new THREE.Spherical();
  spherical.setFromVector3(camera.position);
  spherical.theta -= deltaX;
  spherical.phi += deltaY;
  spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

  camera.position.setFromSpherical(spherical);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}

function rotateWithModifier(event: MouseEvent) {
  // Calculate mouse movement delta
  const currentMousePosition = new THREE.Vector2(event.clientX, event.clientY);
  const deltaX = currentMousePosition.x - lastMousePosition.x;
  const deltaY = currentMousePosition.y - lastMousePosition.y;

  // Update last mouse position
  lastMousePosition.copy(currentMousePosition);

  // Convert mouse movement to rotation angles
  const rotationSpeed = 0.005;
  const deltaTheta = -deltaX * rotationSpeed;
  const deltaPhi = deltaY * rotationSpeed;

  // Use spherical coordinates for smooth orbital rotation
  const spherical = new THREE.Spherical();
  spherical.setFromVector3(camera.position);

  // Apply rotation deltas
  spherical.theta += deltaTheta;
  spherical.phi += deltaPhi;

  // Clamp phi to prevent flipping
  spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

  // Update camera position
  camera.position.setFromSpherical(spherical);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}

function moveSegmentsIn3D(event: MouseEvent) {
  if (selectedSegments.value.length === 0) return;

  // Initialize movement tracking if not already done
  if (totalMovementDistance.value === 0) {
    movementStartPosition.copy(selectedSegments.value[0].mesh.position);
  }

  // Calculate mouse movement delta
  const currentMousePosition = new THREE.Vector2(event.clientX, event.clientY);
  const deltaX = currentMousePosition.x - lastMousePosition.x;
  const deltaY = currentMousePosition.y - lastMousePosition.y;

  // Update last mouse position
  lastMousePosition.copy(currentMousePosition);

  // Calculate total mouse movement from start for axis determination
  const totalDeltaX = currentMousePosition.x - movementStartMousePosition.x;
  const totalDeltaY = currentMousePosition.y - movementStartMousePosition.y;

  // Determine constrained axis if not already set (threshold for axis lock)
  const axisThreshold = 15; // pixels
  if (
    !constrainedAxis &&
    (Math.abs(totalDeltaX) > axisThreshold ||
      Math.abs(totalDeltaY) > axisThreshold)
  ) {
    const horizontalMovement = Math.abs(totalDeltaX);
    const verticalMovement = Math.abs(totalDeltaY);

    // Determine primary axis based on dominant movement direction
    if (horizontalMovement > verticalMovement * 1.5) {
      constrainedAxis = "Transverse"; // Horizontal movement = Transverse (side-to-side)
      movementAxis.value = "Transverse";
    } else if (verticalMovement > horizontalMovement * 1.5) {
      constrainedAxis = "Vertical"; // Vertical movement = Vertical (up-down)
      movementAxis.value = "Vertical";
    } else {
      constrainedAxis = "Anteroposterior"; // Diagonal or mixed = Anteroposterior (front-back)
      movementAxis.value = "Anteroposterior";
    }

    console.log(`Movement constrained to ${constrainedAxis} axis`);
  }

  // Get camera's right and up vectors for proper 3D movement
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);

  const cameraRight = new THREE.Vector3();
  cameraRight.crossVectors(camera.up, cameraDirection).normalize();

  const cameraUp = new THREE.Vector3();
  cameraUp.crossVectors(cameraDirection, cameraRight).normalize();

  // Calculate movement sensitivity based on camera distance
  const distance = camera.position.length();
  const movementSensitivity = distance * 0.001; // Slightly increased for better control

  // Calculate movement vector based on constrained axis
  const movementVector = new THREE.Vector3();

  if (constrainedAxis === "Transverse") {
    // Transverse movement (side-to-side, X-axis in 3D space)
    movementVector.addScaledVector(cameraRight, -deltaX * movementSensitivity);
  } else if (constrainedAxis === "Vertical") {
    // Vertical movement (up-down, Y-axis in 3D space)
    movementVector.addScaledVector(cameraUp, deltaY * movementSensitivity);
  } else if (constrainedAxis === "Anteroposterior") {
    // Anteroposterior movement (front-back, Z-axis in 3D space)
    const cameraForward = cameraDirection.clone().negate();
    movementVector.addScaledVector(
      cameraForward,
      (deltaX + deltaY) * 0.5 * movementSensitivity
    );
  }

  // Apply movement to all selected segments
  selectedSegments.value.forEach((segment) => {
    segment.mesh.position.add(movementVector);
    segment.mesh.updateMatrixWorld();
  });

  // Calculate and update movement distances
  if (selectedSegments.value[0]) {
    const currentPosition = selectedSegments.value[0].mesh.position;
    const totalDistance = movementStartPosition.distanceTo(currentPosition);
    totalMovementDistance.value = totalDistance;

    // Update individual segment movement distance and history
    const segment = selectedSegments.value[0];
    if (segment.originalPosition) {
      segment.movementDistance =
        segment.originalPosition.distanceTo(currentPosition);
      // Update movement history
      updateSegmentMovementHistory(segment, "drag");
    }

    // Calculate axis-specific distances using dental coordinate system
    const deltaPosition = currentPosition.clone().sub(movementStartPosition);
    axisMovementDistances.value = {
      transverse: deltaPosition.x, // Side-to-side (X in 3D space)
      vertical: deltaPosition.y, // Up-down (Y in 3D space)
      anteroposterior: deltaPosition.z, // Front-back (Z in 3D space)
    };

    // Update movement axis display based on largest component
    const absTransverse = Math.abs(deltaPosition.x);
    const absVertical = Math.abs(deltaPosition.y);
    const absAnteroposterior = Math.abs(deltaPosition.z);

    if (absTransverse > absVertical && absTransverse > absAnteroposterior) {
      movementAxis.value = "Transverse";
    } else if (
      absVertical > absTransverse &&
      absVertical > absAnteroposterior
    ) {
      movementAxis.value = "Vertical";
    } else if (
      absAnteroposterior > absTransverse &&
      absAnteroposterior > absVertical
    ) {
      movementAxis.value = "Anteroposterior";
    } else {
      movementAxis.value = "Combined";
    }
  }
}

function resetSegmentPosition() {
  if (selectedSegments.value.length === 0) return;

  selectedSegments.value.forEach((segment) => {
    segment.mesh.position.copy(movementStartPosition);
    segment.mesh.updateMatrixWorld();
  });

  totalMovementDistance.value = 0;
  movementAxis.value = "None";
  axisMovementDistances.value = {
    anteroposterior: 0,
    vertical: 0,
    transverse: 0,
  };
  constrainedAxis = null;

  console.log("Reset segment positions to original location");
}

// Individual Segment Functions
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
    anteroposterior: deltaPosition.z, // Front-back (Z-axis in 3D space)
    vertical: deltaPosition.y, // Up-down (Y-axis in 3D space)
    transverse: deltaPosition.x, // Side-to-side (X-axis in 3D space)
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

// Directional Movement Functions
function startDirectionalMove(
  axis: "Anteroposterior" | "Vertical" | "Transverse",
  direction: number
) {
  if (selectedSegments.value.length === 0) return;

  isDirectionalMoving = true;
  movementAxis.value = axis;

  // Initialize movement start position if not already set
  if (totalMovementDistance.value === 0) {
    movementStartPosition.copy(selectedSegments.value[0].mesh.position);
  }

  // Continuous movement while button is held
  const moveStep = 0.1; // mm per step
  const moveInterval = 50; // ms between moves

  directionalMoveInterval = window.setInterval(() => {
    if (!isDirectionalMoving) return;

    moveSegmentInDirection(axis, direction * moveStep);
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
  distance: number
) {
  if (selectedSegments.value.length === 0) return;

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
  selectedSegments.value.forEach((segment) => {
    segment.mesh.position.add(movementVector);
    segment.mesh.updateMatrixWorld();
  });

  // Update distance tracking
  if (selectedSegments.value[0]) {
    const currentPosition = selectedSegments.value[0].mesh.position;
    const totalDistance = movementStartPosition.distanceTo(currentPosition);
    totalMovementDistance.value = totalDistance;

    // Update individual segment movement distance and history
    const segment = selectedSegments.value[0];
    if (segment.originalPosition) {
      segment.movementDistance =
        segment.originalPosition.distanceTo(currentPosition);
      // Update movement history
      updateSegmentMovementHistory(segment, "directional");
    }

    // Calculate axis-specific distances using dental coordinate system
    const deltaPosition = currentPosition.clone().sub(movementStartPosition);
    axisMovementDistances.value = {
      transverse: deltaPosition.x, // Side-to-side (X in 3D space)
      vertical: deltaPosition.y, // Up-down (Y in 3D space)
      anteroposterior: deltaPosition.z, // Front-back (Z in 3D space)
    };
  }
}

// Lasso Selection Functions
function startLassoSelection(event: MouseEvent) {
  isLassoActive = true;
  lassoPoints = [];

  // Get canvas coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  lassoPoints.push(new THREE.Vector2(x, y));
  createLassoVisual();

  console.log("Started lasso selection");
}

function updateLassoSelection(event: MouseEvent) {
  if (!isLassoActive) return;

  // Get canvas coordinates
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const newPoint = new THREE.Vector2(x, y);

  // Only add point if it's far enough from the last point (smooth the path)
  if (
    lassoPoints.length === 0 ||
    lassoPoints[lassoPoints.length - 1].distanceTo(newPoint) > 5
  ) {
    lassoPoints.push(newPoint);
    updateLassoVisual();
  }
}

function finalizeLassoSelection(event: MouseEvent) {
  if (!isLassoActive) return;

  // Close the lasso path
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  lassoPoints.push(new THREE.Vector2(x, y));

  console.log(`Finalizing lasso with ${lassoPoints.length} points`);
  console.log(`Dental model exists: ${!!dentalModel.value}`);
  console.log(`Original mesh exists: ${!!dentalModel.value?.originalMesh}`);
  console.log(`Segments count: ${dentalModel.value?.segments.length || 0}`);

  // Perform selection based on lasso area
  performLassoSelection();

  // Clean up
  isLassoActive = false;
  removeLassoVisual();
  lassoPoints = [];

  console.log("Completed lasso selection cleanup");
}

function createLassoVisual() {
  // Create SVG overlay for lasso visualization
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();

  // Remove existing lasso if any
  removeLassoVisual();

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.width = rect.width + "px";
  svg.style.height = rect.height + "px";
  svg.style.pointerEvents = "none";
  svg.style.zIndex = "1000";
  svg.id = "lasso-overlay";

  lassoPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  lassoPath.setAttribute("stroke", "#00ff00");
  lassoPath.setAttribute("stroke-width", "2");
  lassoPath.setAttribute("fill", "rgba(0, 255, 0, 0.2)");
  lassoPath.setAttribute("stroke-dasharray", "3,3");

  svg.appendChild(lassoPath);

  canvas.parentElement?.appendChild(svg);
}

function updateLassoVisual() {
  if (!lassoPath || lassoPoints.length < 2) return;

  let pathData = `M ${lassoPoints[0].x} ${lassoPoints[0].y}`;
  for (let i = 1; i < lassoPoints.length; i++) {
    pathData += ` L ${lassoPoints[i].x} ${lassoPoints[i].y}`;
  }

  // Close the path if we have enough points
  if (lassoPoints.length > 2) {
    pathData += ` Z`; // Close the path
  }

  lassoPath.setAttribute("d", pathData);
}

function removeLassoVisual() {
  const overlay = document.getElementById("lasso-overlay");
  if (overlay) {
    overlay.remove();
  }
  lassoPath = null;
}

function performLassoSelection() {
  if (!dentalModel.value || lassoPoints.length < 3) {
    console.log(
      "Cannot perform lasso selection: insufficient points or no model"
    );
    console.log(
      `Lasso points: ${
        lassoPoints.length
      }, Model exists: ${!!dentalModel.value}`
    );
    return;
  }

  console.log(
    `Performing lasso selection. Segments exist: ${
      dentalModel.value.segments.length > 0
    }`
  );

  // ALWAYS create new segments from original mesh when using lasso tool
  // This allows creating multiple segments by always working from the original mesh
  console.log(
    "Creating new segment from original mesh (allowing multiple segments)"
  );
  performManualSegmentation();
}

async function performManualSegmentation() {
  if (!dentalModel.value?.originalMesh) return;

  try {
    isLoading.value = true;
    loadingMessage.value = "Creating segment...";

    const selectedVertices = getVerticesInsideLasso(
      dentalModel.value.originalMesh
    );

    if (selectedVertices.length === 0) {
      alert("No vertices found inside lasso area.");
      return;
    }

    console.log(
      `Creating segment ${dentalModel.value.segments.length + 1} with ${
        selectedVertices.length
      } vertices`
    );

    const newSegment = await createSegmentFromVertices(
      selectedVertices,
      dentalModel.value.originalMesh
    );

    if (newSegment) {
      // Add new segment to the model
      dentalModel.value.segments.push(newSegment);
      scene.add(newSegment.mesh);

      // Ensure reactivity for newly added segment
      dentalModel.value = { ...dentalModel.value };

      // IMPORTANT: Keep the original mesh visible for subsequent lasso operations
      dentalModel.value.originalMesh.visible = true;

      // Make sure the original mesh is still in the scene
      if (!scene.children.includes(dentalModel.value.originalMesh)) {
        scene.add(dentalModel.value.originalMesh);
        console.log(
          "Re-added original mesh to scene for continued segmentation"
        );
      }

      // Clear other selections and make only the new segment selected
      selectedSegments.value.forEach((segment) => {
        segment.isSelected = false;
        updateSegmentAppearance(segment);
      });
      selectedSegments.value = [newSegment];
      newSegment.isSelected = true;
      updateSegmentAppearance(newSegment);

      console.log(
        `Successfully created segment ${newSegment.name}. Original mesh remains visible for more segmentations.`
      );
    }
  } catch (error) {
    console.error("Error creating segment:", error);
    alert("Error creating segment. Try selecting a smaller area.");
  } finally {
    isLoading.value = false;
    loadingMessage.value = "";
  }
}

function isPointInPolygon(
  point: THREE.Vector2,
  polygon: THREE.Vector2[]
): boolean {
  let inside = false;

  // Ray casting algorithm - optimized version
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    if (
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
}

function getVerticesInsideLasso(mesh: THREE.Mesh): number[] {
  const geometry = mesh.geometry;
  const positions = geometry.getAttribute("position");
  const selectedIndices: number[] = [];

  console.log(
    `Processing ${positions.count} vertices against lasso with ${lassoPoints.length} points`
  );
  console.log(
    `Mesh visible: ${mesh.visible}, in scene: ${scene.children.includes(mesh)}`
  );

  const rect = renderer.domElement.getBoundingClientRect();
  const vertex = new THREE.Vector3();
  const screenPoint = new THREE.Vector2();

  // Make sure we're using the mesh's world matrix
  mesh.updateMatrixWorld();

  for (let i = 0; i < positions.count; i++) {
    vertex.set(positions.getX(i), positions.getY(i), positions.getZ(i));

    // Apply the mesh's world transformation
    vertex.applyMatrix4(mesh.matrixWorld);

    // Project to screen coordinates
    vertex.project(camera);

    // Skip vertices behind the camera
    if (vertex.z < -1 || vertex.z > 1) continue;

    // Convert NDC to screen coordinates
    screenPoint.x = ((vertex.x + 1) * rect.width) / 2;
    screenPoint.y = ((-vertex.y + 1) * rect.height) / 2;

    // Check if vertex is within screen bounds
    if (
      screenPoint.x >= 0 &&
      screenPoint.x <= rect.width &&
      screenPoint.y >= 0 &&
      screenPoint.y <= rect.height
    ) {
      if (isPointInPolygon(screenPoint, lassoPoints)) {
        selectedIndices.push(i);
      }
    }
  }

  console.log(
    `Found ${selectedIndices.length} vertices inside lasso for segment creation`
  );
  return selectedIndices;
}

async function createSegmentFromVertices(
  vertexIndices: number[],
  originalMesh: THREE.Mesh
): Promise<ToothSegment | null> {
  if (vertexIndices.length === 0) return null;

  console.log(`Creating segment from ${vertexIndices.length} vertices...`);

  const geometry = originalMesh.geometry;
  const positions = geometry.getAttribute("position");
  const indices = geometry.index;

  // Create a set of selected vertices for fast lookup
  const selectedVertices = new Set(vertexIndices);

  let selectedTriangles: number[] = [];

  if (indices) {
    // Indexed geometry
    console.log("Processing indexed geometry...");
    const indexArray = indices.array;

    for (let i = 0; i < indexArray.length; i += 3) {
      const v1 = indexArray[i];
      const v2 = indexArray[i + 1];
      const v3 = indexArray[i + 2];

      // Count how many vertices of this triangle are selected
      const selectedCount = [v1, v2, v3].filter((v) =>
        selectedVertices.has(v)
      ).length;

      // Include triangle if at least 2 vertices are selected
      if (selectedCount >= 2) {
        selectedTriangles.push(v1, v2, v3);
      }
    }
  } else {
    // Non-indexed geometry (common for STL files)
    console.log("Processing non-indexed geometry...");
    const vertexCount = positions.count;

    for (let i = 0; i < vertexCount; i += 3) {
      const v1 = i;
      const v2 = i + 1;
      const v3 = i + 2;

      // Count how many vertices of this triangle are selected
      const selectedCount = [v1, v2, v3].filter((v) =>
        selectedVertices.has(v)
      ).length;

      // Include triangle if at least 2 vertices are selected
      if (selectedCount >= 2) {
        selectedTriangles.push(v1, v2, v3);
      }
    }
  }

  if (selectedTriangles.length === 0) {
    console.warn("No triangles found for selected vertices");
    return null;
  }

  // Create new geometry with proper triangles
  const newPositions = new Float32Array(selectedTriangles.length * 3);
  const newVertices: THREE.Vector3[] = [];

  for (let i = 0; i < selectedTriangles.length; i++) {
    const vertexIndex = selectedTriangles[i];
    const baseIndex = i * 3;

    const x = positions.getX(vertexIndex);
    const y = positions.getY(vertexIndex);
    const z = positions.getZ(vertexIndex);

    newPositions[baseIndex] = x;
    newPositions[baseIndex + 1] = y;
    newPositions[baseIndex + 2] = z;

    newVertices.push(new THREE.Vector3(x, y, z));
  }

  // Create proper geometry with triangles
  const segmentGeometry = new THREE.BufferGeometry();
  segmentGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(newPositions, 3)
  );
  segmentGeometry.computeVertexNormals();
  segmentGeometry.computeBoundingBox();

  const centroid = new THREE.Vector3();
  if (segmentGeometry.boundingBox) {
    segmentGeometry.boundingBox.getCenter(centroid);
  }

  // Create material with proper shading
  const hue = (dentalModel.value?.segments.length || 0) * 0.3;
  const color = new THREE.Color().setHSL(hue, 0.7, 0.5);
  const material = new THREE.MeshLambertMaterial({
    color: color,
    side: THREE.DoubleSide, // Ensure both sides are rendered
  });

  // Create mesh
  const segmentMesh = new THREE.Mesh(segmentGeometry, material);
  segmentMesh.castShadow = true;
  segmentMesh.receiveShadow = true;
  markRaw(segmentMesh);

  // Create segment
  const segment: ToothSegment = {
    id: `segment_${Date.now()}`,
    name: `Segment ${(dentalModel.value?.segments.length || 0) + 1}`,
    mesh: segmentMesh,
    originalVertices: newVertices,
    centroid: centroid,
    color: color,
    toothType: "molar",
    isSelected: false,
    movementDistance: 0,
    originalPosition: segmentMesh.position.clone(),
    movementHistory: {
      totalDistance: 0,
      axisMovements: {
        anteroposterior: 0,
        vertical: 0,
        transverse: 0,
      },
      lastMovementType: undefined,
      movementCount: 0,
    },
  };

  console.log(
    `Created solid segment with ${selectedTriangles.length / 3} triangles`
  );
  return segment;
}

function animate() {
  try {
    // Ensure camera and renderer exist
    if (!camera || !renderer || !scene) {
      console.warn("Missing Three.js objects, stopping animation");
      return;
    }

    // Ensure camera matrices are updated
    camera.updateMatrixWorld();

    // Update any mesh matrices that might be modified
    if (dentalModel.value) {
      dentalModel.value.segments.forEach((segment) => {
        if (segment.mesh) {
          segment.mesh.updateMatrixWorld();
        }
      });
    }

    renderer.render(scene, camera);

    // Continue animation loop
    requestAnimationFrame(animate);
  } catch (error) {
    console.error("Animation error:", error);
    // Try to restart animation after a short delay to prevent infinite error loops
    setTimeout(() => {
      console.log("Attempting to restart animation...");
      requestAnimationFrame(animate);
    }, 1000);
  }
}

// File handling
async function handleFileUpload(event: Event, autoSegment: boolean = false) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (file) {
    console.log(
      "File selected:",
      file.name,
      "size:",
      file.size,
      "type:",
      file.type,
      "auto-segment:",
      autoSegment
    );

    isLoading.value = true;
    loadingMessage.value = "Loading STL file...";

    try {
      console.log("Starting STL loading...");
      loadingMessage.value = "Parsing STL file...";
      const mesh = await stlLoader.loadSTL(file);
      console.log("STL loaded successfully:", mesh);

      // Clear previous model
      if (dentalModel.value) {
        console.log(
          "Clearing previous model segments:",
          dentalModel.value.segments.length
        );
        dentalModel.value.segments.forEach((segment) => {
          scene.remove(segment.mesh);
        });
        // Also remove the original mesh if it exists
        if (dentalModel.value.originalMesh) {
          scene.remove(dentalModel.value.originalMesh);
        }
      }

      // Mark the mesh as raw to prevent Vue reactivity issues
      const rawMesh = markRaw(mesh);

      // Add original mesh to scene (visible)
      rawMesh.visible = true;
      scene.add(rawMesh);
      console.log("Original mesh added to scene and made visible");

      // Create a simple dental model with just the original mesh (no segmentation yet)
      const geometry = mesh.geometry as any;
      geometry.computeBoundingBox();
      const boundingBox = {
        min: geometry.boundingBox?.min.clone() || new THREE.Vector3(),
        max: geometry.boundingBox?.max.clone() || new THREE.Vector3(),
      };

      // Create dental model without segments initially
      dentalModel.value = {
        originalMesh: rawMesh,
        segments: [], // Empty segments array - no segmentation applied yet
        boundingBox,
      };

      const vertexCount = geometry.getAttribute("position")?.count || 0;
      console.log(
        `STL model loaded with ${vertexCount.toLocaleString()} vertices`
      );
      loadingMessage.value = "Model loaded successfully";

      // Focus camera on model
      focusOnModel();
      console.log("Camera focused on model");

      // Start background AI segmentation if enabled
      if (autoSegment) {
        console.log("🤖 Starting automatic AI segmentation in background...");
        startBackgroundAISegmentation(file);
      } else {
        console.log("Model loaded without auto-segmentation");
      }
    } catch (error) {
      console.error("Error loading STL file:", error);
      alert(
        `Error loading STL file: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try again.`
      );
    } finally {
      isLoading.value = false;
      loadingMessage.value = "";
      // Clear the input so the same file can be selected again
      if (input) {
        input.value = "";
      }
    }
  } else {
    console.log("No file selected");
  }
}

function focusOnModel() {
  if (!dentalModel.value) return;

  const box = dentalModel.value.boundingBox;
  const center = box.min.clone().add(box.max).multiplyScalar(0.5);
  const size = box.max.clone().sub(box.min);
  const maxDim = Math.max(size.x, size.y, size.z);

  camera.position.set(center.x, center.y, center.z + maxDim * 2);
  camera.lookAt(center);
  camera.updateMatrixWorld();
}

function toggleOriginalMesh() {
  if (!dentalModel.value?.originalMesh) return;

  dentalModel.value.originalMesh.visible =
    !dentalModel.value.originalMesh.visible;
  console.log(
    `Original mesh ${
      dentalModel.value.originalMesh.visible ? "shown" : "hidden"
    }`
  );
}

function toggleAllSegments() {
  if (!dentalModel.value?.segments.length) return;

  const allVisible = areAllSegmentsVisible();

  dentalModel.value.segments.forEach((segment) => {
    segment.mesh.visible = !allVisible;
  });

  console.log(`All segments ${!allVisible ? "shown" : "hidden"}`);
}

function areAllSegmentsVisible(): boolean {
  if (!dentalModel.value?.segments.length) return false;

  return dentalModel.value.segments.every((segment) => segment.mesh.visible);
}

function setInteractionMode(mode: InteractionMode["mode"]) {
  // Clean up any active lasso selection when changing modes
  if (currentMode.value === "lasso" && isLassoActive) {
    isLassoActive = false;
    removeLassoVisual();
    lassoPoints = [];
  }

  currentMode.value = mode;
  console.log(`Interaction mode changed to: ${mode}`);

  // Set appropriate cursor for the new mode
  if (renderer?.domElement) {
    const cursorMap = {
      lasso: "crosshair",
      select: "pointer",
      rotate: "grab",
      move: "move",
    };
    renderer.domElement.style.cursor = cursorMap[mode] || "default";
    console.log(
      `Cursor set to: ${cursorMap[mode] || "default"} for mode: ${mode}`
    );
  }
}

function setViewPreset(
  view: "top" | "bottom" | "front" | "back" | "left" | "right"
) {
    if (!dentalModel.value) return;

    const box = dentalModel.value.boundingBox;
    const center = box.min.clone().add(box.max).multiplyScalar(0.5);
    const size = box.max.clone().sub(box.min);
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2; // Distance from center

    let position: THREE.Vector3;

    switch (view) {
      case "top":
        position = new THREE.Vector3(center.x, center.y + distance, center.z);
        break;
      case "bottom":
        position = new THREE.Vector3(center.x, center.y - distance, center.z);
        break;
      case "front":
        position = new THREE.Vector3(center.x, center.y, center.z + distance);
        break;
      case "back":
        position = new THREE.Vector3(center.x, center.y, center.z - distance);
        break;
      case "left":
        position = new THREE.Vector3(center.x - distance, center.y, center.z);
        break;
      case "right":
        position = new THREE.Vector3(center.x + distance, center.y, center.z);
        break;
      default:
        return;
    }

    // Smooth transition to new position
    animateCameraToPosition(position, center);
  }

function animateCameraToPosition(
    targetPosition: THREE.Vector3,
    lookAtTarget: THREE.Vector3
  ) {
    const startPosition = camera.position.clone();
    const startTime = performance.now();
    const duration = 500; // Animation duration in ms

    function animate() {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      // Interpolate position
      camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
      camera.lookAt(lookAtTarget);
      camera.updateMatrixWorld();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    animate();
  }

function changeSegmentColor(segment: ToothSegment, event: Event) {
    const input = event.target as HTMLInputElement;
    const color = new THREE.Color(input.value);

    segment.color = color;
    const material = segment.mesh.material as THREE.MeshLambertMaterial;
    material.color = color;
  }

function mergeSelectedSegments() {
    if (selectedSegments.value.length < 2) {
      alert("Select at least 2 segments to merge");
      return;
    }

    // Implementation for merging segments
    console.log("Merging segments:", selectedSegments.value);
  }

function splitSelectedSegment() {
    if (selectedSegments.value.length !== 1) {
      alert("Select exactly one segment to split");
      return;
    }

    // Implementation for splitting segment
    console.log("Splitting segment:", selectedSegments.value[0]);
  }

function deleteSelectedSegments() {
    if (!dentalModel.value || selectedSegments.value.length === 0) return;

    selectedSegments.value.forEach((segment) => {
      scene.remove(segment.mesh);
      const index = dentalModel.value!.segments.findIndex(
        (s) => s.id === segment.id
      );
      if (index >= 0) {
        dentalModel.value!.segments.splice(index, 1);
      }
    });

    selectedSegments.value = [];
  }

function exportModel() {
    if (!dentalModel.value) return;

    const exportData = {
      segments: dentalModel.value.segments.map((segment) => ({
        id: segment.id,
        name: segment.name,
        vertices: segment.originalVertices.flatMap((v) => [v.x, v.y, v.z]),
        faces: [], // You'd need to extract face indices
        color: "#" + segment.color.getHexString(),
        toothType: segment.toothType,
      })),
      metadata: {
        originalFileName: "dental_model.stl",
        segmentationMethod: "manual",
        exportDate: new Date().toISOString(),
      },
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dental_segmentation.json";
    a.click();
    URL.revokeObjectURL(url);
  }

// Auto Segmentation & Background Processing Functions
function toggleAutoSegmentation() {
  autoSegmentationEnabled.value = !autoSegmentationEnabled.value;
  console.log(`🔄 Auto AI Segmentation ${autoSegmentationEnabled.value ? 'ENABLED' : 'DISABLED'}`);
  
  // Show user feedback
  const status = autoSegmentationEnabled.value ? "enabled" : "disabled";
  loadingMessage.value = `Auto AI segmentation ${status}`;
  setTimeout(() => {
    if (loadingMessage.value === `Auto AI segmentation ${status}`) {
      loadingMessage.value = "";
    }
  }, 2000);
}

function clearExistingSegments() {
  if (!dentalModel.value) return;
  
  // Remove all existing segments from scene
  dentalModel.value.segments.forEach((segment) => {
    scene.remove(segment.mesh);
  });
  
  // Clear segments array
  dentalModel.value.segments = [];
  dentalModel.value = { ...dentalModel.value };
  selectedSegments.value = [];
  
  console.log("Cleared existing manual segments for AI segmentation");
}

async function createAISegments(result: SegmentationResult): Promise<void> {
  if (!dentalModel.value) return;

  try {
    loadingMessage.value = "Creating 3D tooth segments...";

    for (let i = 0; i < result.segments.length; i++) {
      const segmentData = result.segments[i];

      const segment = await createSegmentFromData(result.sessionId, segmentData);

      if (segment) {
        dentalModel.value.segments.push(segment);
        scene.add(segment.mesh);
      }
    }

    // Force reactivity update so sidebar reflects new segments
    dentalModel.value = { ...dentalModel.value };

    console.log(`Created ${result.segments.length} AI-segmented tooth segments`);
    console.log(`Session ID: ${result.sessionId} - Use this to download individual STL files`);

  } catch (error) {
    console.error("Error creating AI segments:", error);
    throw error;
  }
}

async function createSegmentFromData(sessionId: string, segmentData: SegmentData): Promise<ToothSegment | null> {
  try {
    // Load actual segment mesh from backend
    const mesh = await segmentationService.loadSegmentAsMesh(sessionId, segmentData.filename);

    // Apply color from segmentation result
    const color = new THREE.Color(segmentData.color);
    const material = mesh.material as THREE.MeshLambertMaterial;
    material.color = color;
    material.side = THREE.DoubleSide;

    mesh.castShadow = true;
    mesh.receiveShadow = true;
    markRaw(mesh);

    const centroid = new THREE.Vector3(
      segmentData.center[0],
      segmentData.center[1],
      segmentData.center[2]
    );

    const segment: ToothSegment = {
      id: `ai_tooth_${segmentData.id}`,
      name: segmentData.name || `AI Tooth ${segmentData.id + 1}`,
      mesh: mesh,
      originalVertices: [],
      centroid: centroid,
      color: color,
      toothType: 'molar',
      isSelected: false,
      movementDistance: 0,
      originalPosition: mesh.position.clone(),
      movementHistory: {
        totalDistance: 0,
        axisMovements: {
          anteroposterior: 0,
          vertical: 0,
          transverse: 0,
        },
        lastMovementType: undefined,
        movementCount: 0,
      },
    };

    console.log(`Loaded AI segment: ${segment.name} from ${segmentData.filename}`);
    return segment;

  } catch (error) {
    console.error('Error loading segment:', error);
    return null;
  }
}

async function startBackgroundAISegmentation(file: File) {
  if (!dentalModel.value) return;

  try {
    // Update background status
    backgroundSegmentationStatus.value = {
      isRunning: true,
      message: "AI analyzing dental structure...",
      progress: 0,
    };

    console.log("🤖 Starting background AI segmentation...");

    // Check if backend is available
    const isHealthy = await segmentationService.checkHealth();
    if (!isHealthy) {
      throw new Error("Backend service unavailable");
    }

    backgroundSegmentationStatus.value.message = "Uploading to AI service...";
    backgroundSegmentationStatus.value.progress = 25;

    // Perform AI segmentation
    const result = await segmentationService.segmentSTLFile(file);

    backgroundSegmentationStatus.value.message = "Processing segmentation results...";
    backgroundSegmentationStatus.value.progress = 75;

    // Wait a bit for the 3D model to be fully loaded and rendered
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Clear existing manual segments (keep original mesh visible)
    if (dentalModel.value.segments.length > 0) {
      console.log("🧹 Clearing manual segments for AI results...");
      clearExistingSegments();
    }

    // Create AI-segmented tooth segments
    await createAISegments(result);

    backgroundSegmentationStatus.value.message = "AI segmentation completed!";
    backgroundSegmentationStatus.value.progress = 100;

    console.log(`✅ Background AI Segmentation completed: ${result.segments.length} teeth found`);
    
    // Show success notification
    setTimeout(() => {
      backgroundSegmentationStatus.value.isRunning = false;
      backgroundSegmentationStatus.value.message = "";
      backgroundSegmentationStatus.value.progress = undefined;
      
      // Brief success message
      loadingMessage.value = `🤖 AI found ${result.segments.length} teeth!`;
      setTimeout(() => {
        loadingMessage.value = "";
      }, 3000);
    }, 1000);

  } catch (error) {
    console.error("Background AI Segmentation failed:", error);
    
    backgroundSegmentationStatus.value.isRunning = false;
    backgroundSegmentationStatus.value.message = "";
    backgroundSegmentationStatus.value.progress = undefined;
    
    // Show error message briefly
    loadingMessage.value = `⚠️ AI segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setTimeout(() => {
      loadingMessage.value = "";
    }, 5000);
  }
}

function dismissBackgroundStatus() {
  backgroundSegmentationStatus.value.isRunning = false;
  backgroundSegmentationStatus.value.message = "";
  backgroundSegmentationStatus.value.progress = undefined;
}
</script>

<style scoped>
.dental-viewer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  color: #f1f5f9;
  font-family: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont,
    sans-serif;
  overflow: hidden;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
}
</style>
