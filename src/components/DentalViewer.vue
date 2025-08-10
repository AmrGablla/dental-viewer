<template>
  <div class="dental-viewer">
    <TopToolbar
      :dentalModel="dentalModel"
      :selectedSegments="selectedSegments"
      :currentMode="currentMode"
      :isLoading="isLoading"
      :interactionModes="interactionModes"
      @fileUpload="handleFileUpload"
      @exportModel="exportModel"
      @setInteractionMode="setInteractionMode"
      @setLassoMode="setLassoMode"
      @togglePreview="togglePreview"
      @confirmSelection="confirmSelection"
      @cancelSelection="cancelSelection"
    />

    <!-- Background Status Indicator -->
    <BackgroundStatusIndicator 
      :status="backgroundSegmentationStatus"
      @dismiss="dismissBackgroundStatus"
    />

    <!-- Main Content Area -->
    <div class="main-content" :class="{ 'treatment-fullscreen': isTreatmentPlanFullScreen }">
      <LeftSidebar
        v-show="!isTreatmentPlanFullScreen"
        :dentalModel="dentalModel"
        :selectedSegments="selectedSegments"
        :currentTreatmentPlan="currentTreatmentPlan"
        @toggleOriginalMesh="toggleOriginalMesh"
        @toggleAllSegments="toggleAllSegments"
        @toggleSegmentSelection="toggleSegmentSelection"
        @changeSegmentColor="changeSegmentColor"
        @resetIndividualPosition="resetIndividualPosition"
        @toggleSegmentVisibility="toggleSegmentVisibility"
        @deleteSegment="deleteSegment"
        @planCreated="handlePlanCreated"
        @planUpdated="handlePlanUpdated"
        @stepChanged="handleStepChanged"
        @treatmentPlanFullScreen="handleTreatmentPlanFullScreen"
      />

      <ViewportArea
        v-show="!isTreatmentPlanFullScreen"
        ref="viewportRef"
        :dentalModel="dentalModel"
        :currentMode="currentMode"
        :isLoading="isLoading"
        :loadingMessage="loadingMessage"
        :selectedSegments="selectedSegments"
        :totalMovementDistance="totalMovementDistance"
        @setViewPreset="setViewPreset"
        @startDirectionalMove="startDirectionalMove"
        @stopDirectionalMove="stopDirectionalMove"
      />
    </div>

    <!-- Full-screen Treatment Plan -->
    <div v-if="isTreatmentPlanFullScreen" class="fullscreen-treatment-plan">
      <TreatmentPlanPanel
        :segments="dentalModel?.segments || []"
        :isVisible="true"
        :isFullScreenMode="true"
        :currentTreatmentPlan="currentTreatmentPlan"
        @planCreated="handlePlanCreated"
        @planUpdated="handlePlanUpdated"
        @stepChanged="handleStepChanged"
        @toggleFullScreen="handleTreatmentPlanFullScreen"
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
import { useThreeJS } from "../composables/useThreeJS";
import type {
  DentalModel,
  ToothSegment,
  InteractionMode,
  SegmentationResult,
  SegmentData,
  ToothType,
  OrthodonticTreatmentPlan,
} from "../types/dental";
import type { 
  EnhancedLassoService, 
  LassoMode, 
  LassoOperationResult 
} from "../services/EnhancedLassoService";
import TopToolbar from "./TopToolbar.vue";
import LeftSidebar from "./LeftSidebar.vue";
import ViewportArea from "./ViewportArea.vue";
import BackgroundStatusIndicator from "./BackgroundStatusIndicator.vue";
import TreatmentPlanPanel from "./TreatmentPlanPanel.vue";

// Use the lazy loading composable
const { loadThreeJS, loadServices } = useThreeJS()

// Dynamic imports will be stored here
let THREE: any
let STLLoaderService: any
let OBJLoaderService: any
let PLYLoaderService: any
let GLTFLoaderService: any
let SegmentationService: any
// Refs
const viewportRef = ref<typeof ViewportArea>();

// Canvas container reference
const canvasContainer = computed(
  () => viewportRef.value?.canvasContainer as HTMLDivElement
);

// Services - will be initialized after lazy loading
let stlLoader: any = null;
let objLoader: any = null;
let plyLoader: any = null;
let gltfLoader: any = null;
let segmentationService: any = null;
let enhancedLassoService: EnhancedLassoService | null = null;

// Enhanced Lasso state
const currentLassoMode = ref<LassoMode>('create');
const previewEnabled = ref(false);
const hasPreviewSelection = ref(false);

// Reactive state
const dentalModel = shallowRef<DentalModel | null>(null);
const selectedSegments = ref<ToothSegment[]>([]);
const currentMode = ref<InteractionMode["mode"]>("lasso");
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
const backgroundSegmentationStatus = ref<{
  isRunning: boolean;
  message: string;
  progress?: number;
}>({
  isRunning: false,
  message: "",
  progress: undefined,
});
const isTreatmentPlanFullScreen = ref(false);
const currentTreatmentPlan = ref<OrthodonticTreatmentPlan | null>(null);

const interactionModes: InteractionMode["mode"][] = [
  "lasso",
  "pan",
];

// Three.js objects - will be initialized after lazy loading
let scene: any;
let camera: any;
let renderer: any;
let mouse: any;
let resizeObserver: ResizeObserver | null = null;

// Interaction state
let isDragging = false;
let isPanning = false;
let movementStartPosition: any;
let lastMousePosition: any;
let directionalMoveInterval: number | null = null;
let isDirectionalMoving = false;

onMounted(async () => {
  await initializeApp();
});

async function initializeApp() {
  try {
    isLoading.value = true;
    loadingMessage.value = "Loading 3D Engine...";

    // Load Three.js and services
    const { THREE: ThreeJS, BVH } = await loadThreeJS();
    const {
      STLLoaderService: STLLoader,
      OBJLoaderService: OBJLoader,
      PLYLoaderService: PLYLoader,
      GLTFLoaderService: GLTFLoader,
      SegmentationService: SegService
    } = await loadServices();

    // Set the loaded modules to global variables
    THREE = ThreeJS;
  STLLoaderService = STLLoader;
  OBJLoaderService = OBJLoader;
  PLYLoaderService = PLYLoader;
  GLTFLoaderService = GLTFLoader;
  SegmentationService = SegService;

    // Add BVH extensions to THREE.js
    THREE.BufferGeometry.prototype.computeBoundsTree = BVH.computeBoundsTree;
    THREE.BufferGeometry.prototype.disposeBoundsTree = BVH.disposeBoundsTree;
    THREE.Mesh.prototype.raycast = BVH.acceleratedRaycast;

    // Initialize services
  stlLoader = new STLLoaderService();
  objLoader = new OBJLoaderService();
  plyLoader = new PLYLoaderService();
  gltfLoader = new GLTFLoaderService();
  segmentationService = new SegmentationService();

    // Initialize Three.js scene
    initThreeJS();
    setupEventListeners();

    isLoading.value = false;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    loadingMessage.value = "Failed to load 3D engine";
  }
}

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

// Utility function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function initThreeJS() {
  if (!canvasContainer.value) return;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f9fa); // Softer, warmer background

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

  // Enhanced Multi-Directional Lighting System
  setupEnhancedLighting();

  mouse = new THREE.Vector2();

  // Initialize Enhanced Lasso Service (asynchronously)
  initializeEnhancedLasso();

  // Initialize movement tracking variables
  movementStartPosition = new THREE.Vector3();
  lastMousePosition = new THREE.Vector2();

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

function setupEnhancedLighting() {
  // Clear any existing lights
  const lightsToRemove = scene.children.filter((child: any) => 
    child instanceof THREE.Light || 
    child.type.includes('Light')
  );
  lightsToRemove.forEach((light: any) => scene.remove(light));

  // Enhanced ambient lighting for overall base illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Main directional light (key light) - from top-front
  const mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  mainDirectionalLight.position.set(40, 60, 40);
  mainDirectionalLight.castShadow = true;
  mainDirectionalLight.shadow.mapSize.width = 4096;
  mainDirectionalLight.shadow.mapSize.height = 4096;
  mainDirectionalLight.shadow.camera.near = 0.1;
  mainDirectionalLight.shadow.camera.far = 200;
  mainDirectionalLight.shadow.camera.left = -100;
  mainDirectionalLight.shadow.camera.right = 100;
  mainDirectionalLight.shadow.camera.top = 100;
  mainDirectionalLight.shadow.camera.bottom = -100;
  mainDirectionalLight.shadow.bias = -0.0001;
  scene.add(mainDirectionalLight);

  // Fill light - from opposite side to reduce harsh shadows
  const fillLight = new THREE.DirectionalLight(0xe6f3ff, 0.6);
  fillLight.position.set(-30, 20, -30);
  scene.add(fillLight);

  // Back light - subtle rim lighting effect
  const backLight = new THREE.DirectionalLight(0xfff5e6, 0.4);
  backLight.position.set(0, -20, -40);
  scene.add(backLight);

  // Multiple point lights for comprehensive coverage
  const pointLights = [
    { position: [50, 50, 50], color: 0xffffff, intensity: 0.8 },
    { position: [-50, 50, 50], color: 0xf0f8ff, intensity: 0.6 },
    { position: [50, -50, 50], color: 0xfff8f0, intensity: 0.6 },
    { position: [-50, -50, 50], color: 0xf8f0ff, intensity: 0.6 },
    { position: [0, 0, -50], color: 0xffffff, intensity: 0.5 },
    { position: [0, 80, 0], color: 0xffffff, intensity: 0.7 },
    { position: [0, -80, 0], color: 0xffffff, intensity: 0.5 }
  ];

  pointLights.forEach(({ position, color, intensity }) => {
    const pointLight = new THREE.PointLight(color, intensity, 200, 2);
    pointLight.position.set(position[0], position[1], position[2]);
    scene.add(pointLight);
  });

  // Hemisphere light for natural sky/ground lighting
  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);
  hemisphereLight.position.set(0, 100, 0);
  scene.add(hemisphereLight);

  // Enhanced renderer settings for better lighting
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  
  // Modern Three.js color space settings
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

async function initializeEnhancedLasso() {
  if (!renderer?.domElement || !camera || !scene) return;
  
  try {
    const { EnhancedLassoService } = await import("../services/EnhancedLassoService");
    enhancedLassoService = new EnhancedLassoService(
      renderer.domElement,
      camera,
      renderer,
      scene
    );
  } catch (error) {
    console.error("Failed to initialize Enhanced Lasso Service:", error);
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
  } else if (currentMode.value === "pan") {
    // Pan mode - change cursor to indicate panning
    if (renderer?.domElement) {
      renderer.domElement.style.cursor = "grabbing";
    }
  } else if (currentMode.value === "lasso") {
    // Start enhanced lasso selection if in lasso mode and not rotating
    startEnhancedLassoSelection(event);
  }
}

function onMouseMove(event: MouseEvent) {
  updateMousePosition(event);

  if (isDragging) {
    if (isPanning) {
      // Rotate the camera/model with modifier key
      rotateWithModifier(event);
    } else if (currentMode.value === "lasso") {
      updateEnhancedLassoSelection(event);
    } else if (currentMode.value === "pan") {
      // Implement pan logic for camera movement
      panCamera(event);
    }
  }

  // Update cursor based on modifier keys (even when not dragging)
  if (renderer?.domElement) {
    if (event.metaKey || event.ctrlKey) {
      renderer.domElement.style.cursor = "grab";
    } else {
      // Reset cursor based on current mode
      const cursorMap = {
        lasso: "crosshair",
        pan: "grab",
      };
      renderer.domElement.style.cursor =
        cursorMap[currentMode.value] || "default";
    }
  }
}

function onMouseUp(_event: MouseEvent) {
  if (isDragging && currentMode.value === "lasso" && enhancedLassoService?.isLassoActive()) {
    finalizeEnhancedLassoSelection();
  }

  // Reset rotation state and cursor
  if (isPanning) {
    isPanning = false;
    if (renderer?.domElement) {
      renderer.domElement.style.cursor = "grab"; // Keep grab cursor if modifier still held
    }
  } else if (currentMode.value === "pan" && renderer?.domElement) {
    // Reset pan cursor back to grab
    renderer.domElement.style.cursor = "grab";
  }

  isDragging = false;
}

function onClick(event: MouseEvent) {
  updateMousePosition(event);

  if (currentMode.value === "lasso") {
    // Lasso mode click handling is managed by the enhanced lasso service
  }
  // Note: Click handling for pan mode is not needed as it's drag-based
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
      pan: "grab",
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
    material.roughness = 0.2; // More reflective when selected
    material.metalness = 0.15;
  } else {
    material.emissive.setHex(0x000000);
    material.emissiveIntensity = 0.0;
    material.transparent = true;
    material.opacity = 0.95;
    material.roughness = 0.4; // Default roughness
    material.metalness = 0.05;
  }
}

function panCamera(event: MouseEvent) {
  // Pan camera by moving its position and target
  const deltaX = event.movementX * 0.01;
  const deltaY = event.movementY * 0.01;

  // Get camera's right and up vectors
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  const cameraRight = new THREE.Vector3();
  cameraRight.crossVectors(camera.up, cameraDirection).normalize();
  
  const cameraUp = new THREE.Vector3();
  cameraUp.copy(camera.up).normalize();

  // Calculate pan movement in world space
  const panMovement = new THREE.Vector3();
  panMovement.addScaledVector(cameraRight, deltaX);
  panMovement.addScaledVector(cameraUp, deltaY);

  // Apply movement to camera position
  camera.position.add(panMovement);
  
  // Update camera matrix
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

  // Force reactivity update by creating a new dentalModel reference
  if (dentalModel.value) {
    dentalModel.value = { ...dentalModel.value };
  }

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

  // Force reactivity update by creating a new dentalModel reference
  if (dentalModel.value) {
    dentalModel.value = { ...dentalModel.value };
  }

  console.log(
    `Reset position and movement history for segment: ${segment.name}`
  );
}

function toggleSegmentVisibility(segment: ToothSegment) {
  segment.mesh.visible = !segment.mesh.visible;
  
  // Force reactivity update by creating a new dentalModel reference
  if (dentalModel.value) {
    dentalModel.value = { ...dentalModel.value };
  }
  
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

// Enhanced Lasso Selection Functions
function startEnhancedLassoSelection(event: MouseEvent) {
  if (!enhancedLassoService || !dentalModel.value) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const targetSegmentId = selectedSegments.value.length > 0 ? selectedSegments.value[0].id : undefined;

  enhancedLassoService.startLasso(
    currentLassoMode.value,
    { x, y },
    targetSegmentId
  );

  console.log(`Started enhanced lasso selection in ${currentLassoMode.value} mode`);
}

function updateEnhancedLassoSelection(event: MouseEvent) {
  if (!enhancedLassoService || !enhancedLassoService.isLassoActive()) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  enhancedLassoService.updateLasso({ x, y });
}

function finalizeEnhancedLassoSelection() {
  if (!enhancedLassoService || !dentalModel.value) return;
  
  const result = enhancedLassoService.finishLasso(dentalModel.value);
  
  if (result) {
    handleLassoOperationResult(result);
  }
  
  console.log("Finalized enhanced lasso selection");
}

function handleLassoOperationResult(result: LassoOperationResult) {
  switch (result.mode) {
    case 'create':
      handleLassoCreateSegment(result.selectedVertices);
      break;
    case 'select':
      handleLassoSelectSegments(result.affectedSegments);
      break;
    case 'add':
      handleLassoAddToSegment(result.selectedVertices, result.targetSegmentId);
      break;
    case 'subtract':
      handleLassoSubtractFromSegment(result.selectedVertices, result.targetSegmentId);
      break;
  }
}

async function handleLassoCreateSegment(selectedVertices: number[]) {
  if (!dentalModel.value?.originalMesh || selectedVertices.length === 0) {
    alert("No vertices found inside lasso area.");
    return;
  }

  try {
    isLoading.value = true;
    loadingMessage.value = "Creating segment...";

    const newSegment = await createSegmentFromVertices(
      selectedVertices,
      dentalModel.value.originalMesh
    );

    if (newSegment) {
      dentalModel.value.segments.push(newSegment);
      scene.add(newSegment.mesh);
      dentalModel.value = { ...dentalModel.value };

      // Keep original mesh visible for more segmentations
      dentalModel.value.originalMesh.visible = true;
      if (!scene.children.includes(dentalModel.value.originalMesh)) {
        scene.add(dentalModel.value.originalMesh);
      }

      // Select the new segment
      selectedSegments.value.forEach((segment) => {
        segment.isSelected = false;
        updateSegmentAppearance(segment);
      });
      selectedSegments.value = [newSegment];
      newSegment.isSelected = true;
      updateSegmentAppearance(newSegment);

      console.log(`Successfully created segment ${newSegment.name}`);
    }
  } catch (error) {
    console.error("Error creating segment:", error);
    alert("Error creating segment. Try selecting a smaller area.");
  } finally {
    isLoading.value = false;
    loadingMessage.value = "";
  }
}

function handleLassoSelectSegments(segments: ToothSegment[]) {
  // Clear current selection
  selectedSegments.value.forEach((segment) => {
    segment.isSelected = false;
    updateSegmentAppearance(segment);
  });

  // Select the lassoed segments
  selectedSegments.value = segments;
  segments.forEach((segment) => {
    segment.isSelected = true;
    updateSegmentAppearance(segment);
  });

  console.log(`Selected ${segments.length} segments via lasso`);
}

function handleLassoAddToSegment(selectedVertices: number[], targetSegmentId?: string) {
  if (!targetSegmentId || selectedVertices.length === 0) {
    alert("Please select a segment first to add vertices to it.");
    return;
  }

  const targetSegment = dentalModel.value?.segments.find(s => s.id === targetSegmentId);
  if (!targetSegment) {
    alert("Target segment not found.");
    return;
  }

  addVerticestoSegment(targetSegment, selectedVertices);
}

function handleLassoSubtractFromSegment(selectedVertices: number[], targetSegmentId?: string) {
  if (!targetSegmentId || selectedVertices.length === 0) {
    alert("Please select a segment first to remove vertices from it.");
    return;
  }

  const targetSegment = dentalModel.value?.segments.find(s => s.id === targetSegmentId);
  if (!targetSegment) {
    alert("Target segment not found.");
    return;
  }

  // Use the optimized removal function that doesn't modify the model immediately
  removeVerticesFromSegmentSafely(targetSegment, selectedVertices);
}

async function removeVerticesFromSegmentSafely(targetSegment: ToothSegment, selectedVertices: number[]) {
  if (!dentalModel.value?.originalMesh || selectedVertices.length === 0) {
    console.warn("No original mesh or vertices to remove");
    return;
  }

  try {
    isLoading.value = true;
    loadingMessage.value = `Removing ${selectedVertices.length} vertices from segment...`;

    const originalGeometry = dentalModel.value.originalMesh.geometry;
    const originalPositions = originalGeometry.getAttribute("position");
    const segmentGeometry = targetSegment.mesh.geometry;
    
    console.log(`Processing vertex removal for segment ${targetSegment.name}`);
    console.log(`Selected vertices to remove: ${selectedVertices.length}`);
    
    let newGeometry: any = null;
    
    if (originalGeometry.index && segmentGeometry.index) {
      newGeometry = await createRemovedVerticesGeometry(targetSegment, selectedVertices, originalPositions, true);
    } else {
      newGeometry = await createRemovedVerticesGeometry(targetSegment, selectedVertices, originalPositions, false);
    }

    if (!newGeometry) {
      alert("Could not create updated geometry");
      return;
    }

    // Update the segment mesh safely
    scene.remove(targetSegment.mesh);
    
    // Create new mesh with updated geometry
    const originalMaterial = targetSegment.mesh.material;
    const material = Array.isArray(originalMaterial) ? originalMaterial[0].clone() : originalMaterial.clone();
    const newMesh = new THREE.Mesh(newGeometry, material);
    newMesh.name = targetSegment.name;
    
    // Update segment
    targetSegment.mesh = newMesh;
    
    // Add new mesh to scene
    scene.add(newMesh);
    updateSegmentAppearance(targetSegment);
    
    // Update reactivity
    dentalModel.value = { ...dentalModel.value };
    
    console.log(`Successfully removed vertices from segment ${targetSegment.name}`);

  } catch (error) {
    console.error("Error removing vertices from segment:", error);
    alert(`Error removing vertices from segment: ${error}`);
  } finally {
    isLoading.value = false;
    loadingMessage.value = "";
  }
}

async function createRemovedVerticesGeometry(
  targetSegment: ToothSegment, 
  selectedVertices: number[], 
  originalPositions: any,
  isIndexed: boolean
): Promise<any> {
  const segmentGeometry = targetSegment.mesh.geometry;
  
  if (isIndexed) {
    const segmentIndices = segmentGeometry.index;
    
    if (!segmentIndices) {
      throw new Error("Segment must have indexed geometry for indexed removal");
    }
    
    const selectedVertexSet = new Set(selectedVertices);
    const segmentIndexArray = segmentIndices.array;
    const remainingIndices = [];
    
    // Keep triangles that don't contain any selected vertices
    for (let i = 0; i < segmentIndexArray.length; i += 3) {
      if (i + 2 >= segmentIndexArray.length) break;
      
      const v1 = segmentIndexArray[i];
      const v2 = segmentIndexArray[i + 1];
      const v3 = segmentIndexArray[i + 2];
      
      // Keep triangle only if none of its vertices are selected for removal
      const shouldKeep = !selectedVertexSet.has(v1) && 
                        !selectedVertexSet.has(v2) && 
                        !selectedVertexSet.has(v3);
      
      if (shouldKeep) {
        remainingIndices.push(v1, v2, v3);
      }
    }
    
    if (remainingIndices.length === 0) {
      console.warn("All triangles would be removed - keeping at least one triangle");
      // Keep the first triangle to avoid empty geometry
      remainingIndices.push(segmentIndexArray[0], segmentIndexArray[1], segmentIndexArray[2]);
    }
    
    // Create geometry with remaining triangles
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', originalPositions.clone());
    newGeometry.setIndex(remainingIndices);
    newGeometry.computeVertexNormals();
    
    return newGeometry;
    
  } else {
    // Non-indexed geometry
    const segmentPositions = segmentGeometry.getAttribute("position");
    
    // Create spatial hash for quick vertex lookup
    const PRECISION = 6;
    const selectedVertexCoords = new Set<string>();
    
    // Build hash of selected vertex coordinates
    for (const vertexIndex of selectedVertices) {
      if (vertexIndex < originalPositions.count) {
        const x = originalPositions.getX(vertexIndex).toFixed(PRECISION);
        const y = originalPositions.getY(vertexIndex).toFixed(PRECISION);
        const z = originalPositions.getZ(vertexIndex).toFixed(PRECISION);
        selectedVertexCoords.add(`${x},${y},${z}`);
      }
    }
    
    const remainingVertices = [];
    const vertexCount = segmentPositions.count;
    
    // Process triangles and keep those without selected vertices
    for (let i = 0; i < vertexCount; i += 3) {
      if (i + 2 >= vertexCount) break;
      
      // Get triangle vertices
      const vertices = [
        {
          x: segmentPositions.getX(i),
          y: segmentPositions.getY(i),
          z: segmentPositions.getZ(i)
        },
        {
          x: segmentPositions.getX(i + 1),
          y: segmentPositions.getY(i + 1),
          z: segmentPositions.getZ(i + 1)
        },
        {
          x: segmentPositions.getX(i + 2),
          y: segmentPositions.getY(i + 2),
          z: segmentPositions.getZ(i + 2)
        }
      ];
      
      // Check if any vertex should be removed
      const shouldRemove = vertices.some(v => {
        const key = `${v.x.toFixed(PRECISION)},${v.y.toFixed(PRECISION)},${v.z.toFixed(PRECISION)}`;
        return selectedVertexCoords.has(key);
      });
      
      // Keep triangle if none of its vertices should be removed
      if (!shouldRemove) {
        remainingVertices.push(...vertices.flatMap(v => [v.x, v.y, v.z]));
      }
    }
    
    if (remainingVertices.length === 0) {
      console.warn("All triangles would be removed - keeping original segment");
      throw new Error("Cannot remove all vertices from segment");
    }
    
    // Create geometry with remaining vertices
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(remainingVertices), 3));
    newGeometry.computeVertexNormals();
    
    return newGeometry;
  }
}

async function createSegmentFromVertices(
  vertexIndices: number[],
  originalMesh: any
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
  const newVertices: any[] = [];

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
  const material = new THREE.MeshStandardMaterial({
    color: color,
    side: THREE.DoubleSide, // Ensure both sides are rendered
    roughness: 0.4,
    metalness: 0.05,
    transparent: true,
    opacity: 0.95
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

  if (!file) {
    console.log("No file selected");
    return;
  }

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
  loadingMessage.value = "Loading 3D model...";

  // Helper to clear previous model from scene
  function clearPreviousModel() {
    if (dentalModel.value) {
      dentalModel.value.segments.forEach((segment) => {
        scene.remove(segment.mesh);
      });
      if (dentalModel.value.originalMesh) {
        scene.remove(dentalModel.value.originalMesh);
      }
    }
  }

  // Helper to add mesh to scene and update dentalModel
  function setModel(mesh: any, boundingBox: any, convertedModel?: any) {
    const rawMesh = markRaw(mesh);
    rawMesh.visible = true;
    scene.add(rawMesh);
    dentalModel.value = {
      originalMesh: rawMesh,
      segments: [],
      boundingBox,
      ...(convertedModel ? { convertedModel } : {}),
    };
    focusOnModel();
  }

  try {
    const ext = file.name.split('.').pop()?.toLowerCase();
    let mesh: any = null;
    let convertedModel: any = undefined;
    let geometry: any = null;
    let boundingBox: any = null;


    if (ext === 'stl') {
      try {
        loadingMessage.value = "Converting STL to glTF format...";
        const result = await stlLoader.loadSTLAsGLTF(file, true);
        mesh = result.mesh;
        convertedModel = result.convertedModel;
        geometry = mesh.geometry;
      } catch (err) {
        console.warn("STL glTF conversion failed, falling back to STL loader", err);
        mesh = await stlLoader.loadSTL(file);
        geometry = mesh.geometry;
      }
    } else if (ext === 'obj') {
      mesh = await objLoader.loadOBJ(file);
      // mesh is a THREE.Group, compute bounding box for all children
      let box = null;
      mesh.traverse((child: any) => {
        if (child.isMesh) {
          child.geometry.computeBoundingBox();
          if (!box) {
            box = child.geometry.boundingBox.clone();
          } else {
            box.union(child.geometry.boundingBox);
          }
        }
      });
      geometry = { boundingBox: box };
    } else if (ext === 'ply') {
      mesh = await plyLoader.loadPLY(file);
      geometry = mesh.geometry;
    } else if (ext === 'gltf' || ext === 'glb') {
      mesh = await gltfLoader.loadGLTF(file);
      geometry = mesh.geometry;
    } else {
      throw new Error('Unsupported file type: ' + ext);
    }

    // Compute bounding box
    if (geometry && geometry.boundingBox) {
      boundingBox = {
        min: geometry.boundingBox.min.clone() || new THREE.Vector3(),
        max: geometry.boundingBox.max.clone() || new THREE.Vector3(),
      };
    } else {
      // fallback
      boundingBox = { min: new THREE.Vector3(), max: new THREE.Vector3() };
    }

    clearPreviousModel();
    setModel(mesh, boundingBox, convertedModel);

    loadingMessage.value = "Model loaded successfully";
    if (autoSegment && ext === 'stl') {
      startBackgroundAISegmentation(file);
    }
  } catch (error) {
    console.error("Error loading 3D model:", error);
    alert(
      `Error loading 3D model: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please try again.`
    );
  } finally {
    isLoading.value = false;
    loadingMessage.value = "";
    if (input) input.value = "";
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
  // Clean up any active enhanced lasso selection when changing modes
  if (currentMode.value === "lasso" && enhancedLassoService?.isLassoActive()) {
    enhancedLassoService.cancelLasso();
  }

  currentMode.value = mode;
  console.log(`Interaction mode changed to: ${mode}`);

  // Set appropriate cursor for the new mode
  if (renderer?.domElement) {
    const cursorMap = {
      lasso: "crosshair",
      pan: "grab",
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

    let position: any;

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
    targetPosition: any,
    lookAtTarget: any
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
    const material = segment.mesh.material as any;
    material.color = color;
  }

function deleteSegment(segment: ToothSegment) {
    if (!dentalModel.value) return;

    // Remove from scene
    scene.remove(segment.mesh);
    
    // Remove from dentalModel segments array
    const index = dentalModel.value.segments.findIndex(
      (s) => s.id === segment.id
    );
    if (index >= 0) {
      dentalModel.value.segments.splice(index, 1);
    }

    // Remove from selected segments if it was selected
    const selectedIndex = selectedSegments.value.findIndex(
      (s) => s.id === segment.id
    );
    if (selectedIndex >= 0) {
      selectedSegments.value.splice(selectedIndex, 1);
    }

    // Trigger reactivity by creating a new reference since we're using shallowRef
    dentalModel.value = markRaw({ ...dentalModel.value });
  }

// Geometry Manipulation Functions
async function addVerticestoSegment(targetSegment: ToothSegment, selectedVertices: number[]) {
  if (!dentalModel.value?.originalMesh || selectedVertices.length === 0) {
    console.warn("No original mesh or vertices to add");
    return;
  }

  try {
    isLoading.value = true;
    loadingMessage.value = `Adding ${selectedVertices.length} vertices to segment...`;

    // Get the original mesh geometry
    const originalGeometry = dentalModel.value.originalMesh.geometry;
    const originalPositions = originalGeometry.getAttribute("position");
    
    if (!originalPositions) {
      throw new Error("Original mesh has no position attribute");
    }

    console.log(`Processing vertex addition for segment ${targetSegment.name}`);
    console.log(`Original mesh vertices: ${originalPositions.count}`);
    console.log(`Selected vertices to add: ${selectedVertices.length}`);
    
    // Use a more efficient approach based on geometry type
    if (originalGeometry.index) {
      await addVerticesIndexedGeometry(targetSegment, selectedVertices, originalGeometry, originalPositions);
    } else {
      await addVerticesNonIndexedGeometry(targetSegment, selectedVertices, originalPositions);
    }

  } catch (error) {
    console.error("Error adding vertices to segment:", error);
    alert(`Error adding vertices to segment: ${error}`);
  } finally {
    isLoading.value = false;
    loadingMessage.value = "";
  }
}

// Optimized function for indexed geometry
async function addVerticesIndexedGeometry(
  targetSegment: ToothSegment, 
  selectedVertices: number[], 
  originalGeometry: any, 
  originalPositions: any
) {
  const originalIndices = originalGeometry.index;
  const segmentGeometry = targetSegment.mesh.geometry;
  let segmentIndices = segmentGeometry.index;
  
  if (!segmentIndices) {
    // Convert segment to indexed geometry first
    console.log("Converting segment to indexed geometry...");
    segmentGeometry.computeBoundingBox();
    segmentGeometry.computeVertexNormals();
    if (!segmentGeometry.index) {
      // Simple indexed conversion - create sequential indices
      const vertexCount = segmentGeometry.getAttribute('position').count;
      const indices = [];
      for (let i = 0; i < vertexCount; i++) {
        indices.push(i);
      }
      segmentGeometry.setIndex(indices);
    }
    segmentIndices = segmentGeometry.index!;
  }
  
  // Create efficient lookup sets
  const selectedVertexSet = new Set(selectedVertices);
  
  // Use simpler existing vertex set instead of complex triangle comparison
  const existingVerticesSet = new Set(Array.from(segmentIndices.array));
  
  // Find triangles from original mesh that contain selected vertices
  const originalIndexArray = originalIndices.array;
  const newIndices = [];
  
  console.log("Finding relevant triangles...");
  console.log(`Selected vertices: ${selectedVertices.length}`);
  
  // Single pass: collect triangles with selected vertices that aren't fully in existing segment
  for (let i = 0; i < originalIndexArray.length; i += 3) {
    const v1 = originalIndexArray[i];
    const v2 = originalIndexArray[i + 1];
    const v3 = originalIndexArray[i + 2];
    
    // Check if triangle contains any selected vertices
    const hasSelectedVertex = selectedVertexSet.has(v1) || selectedVertexSet.has(v2) || selectedVertexSet.has(v3);
    
    // Check if triangle is already fully in the segment (all vertices exist)
    const isFullyInSegment = existingVerticesSet.has(v1) && existingVerticesSet.has(v2) && existingVerticesSet.has(v3);
    
    if (hasSelectedVertex && !isFullyInSegment) {
      newIndices.push(v1, v2, v3);
    }
  }
  
  if (newIndices.length === 0) {
    alert("No new geometry found to add to segment");
    return;
  }
  
  console.log(`Found ${newIndices.length / 3} new triangles to add`);
  
  // Efficiently combine indices
  const combinedIndices = new Array(segmentIndices.array.length + newIndices.length);
  let index = 0;
  
  // Copy existing indices
  for (let i = 0; i < segmentIndices.array.length; i++) {
    combinedIndices[index++] = segmentIndices.array[i];
  }
  
  // Add new indices
  for (let i = 0; i < newIndices.length; i++) {
    combinedIndices[index++] = newIndices[i];
  }
  
  // Create optimized geometry
  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute('position', originalPositions.clone());
  newGeometry.setIndex(combinedIndices);
  
  // Compute normals efficiently
  newGeometry.computeVertexNormals();
  
  await updateSegmentMesh(targetSegment, newGeometry, combinedIndices, originalPositions);
  
  console.log(`Successfully added ${newIndices.length / 3} triangles to segment`);
}

// Optimized function for non-indexed geometry  
async function addVerticesNonIndexedGeometry(
  targetSegment: ToothSegment,
  selectedVertices: number[],
  originalPositions: any
) {
  console.log("Processing non-indexed geometry addition...");
  
  const segmentGeometry = targetSegment.mesh.geometry;
  const segmentPositions = segmentGeometry.getAttribute("position");
  
  // Create efficient vertex lookup using spatial hashing for existing vertices
  const PRECISION = 6;
  const existingVertexKeys = new Set<string>();
  
  // Build set of existing vertex coordinates
  for (let i = 0; i < segmentPositions.count; i++) {
    const x = segmentPositions.getX(i).toFixed(PRECISION);
    const y = segmentPositions.getY(i).toFixed(PRECISION);
    const z = segmentPositions.getZ(i).toFixed(PRECISION);
    existingVertexKeys.add(`${x},${y},${z}`);
  }
  
  // Collect new triangles more efficiently
  const newVertices = [];
  const selectedVertexSet = new Set(selectedVertices);
  const vertexCount = originalPositions.count;
  
  console.log(`Selected vertices: ${selectedVertices.length}`);
  
  // Single pass: process triangles and collect new ones
  for (let i = 0; i < vertexCount; i += 3) {
    if (i + 2 >= vertexCount) break;
    
    // Check if triangle contains selected vertices
    const hasSelectedVertex = selectedVertexSet.has(i) || 
                             selectedVertexSet.has(i + 1) || 
                             selectedVertexSet.has(i + 2);
    
    if (hasSelectedVertex) {
      const vertices = [
        {
          x: originalPositions.getX(i),
          y: originalPositions.getY(i),
          z: originalPositions.getZ(i)
        },
        {
          x: originalPositions.getX(i + 1),
          y: originalPositions.getY(i + 1),
          z: originalPositions.getZ(i + 1)
        },
        {
          x: originalPositions.getX(i + 2),
          y: originalPositions.getY(i + 2),
          z: originalPositions.getZ(i + 2)
        }
      ];
      
      // Check if triangle has any new vertices (simpler check than full triangle comparison)
      const hasNewVertex = vertices.some(v => {
        const key = `${v.x.toFixed(PRECISION)},${v.y.toFixed(PRECISION)},${v.z.toFixed(PRECISION)}`;
        return !existingVertexKeys.has(key);
      });
      
      if (hasNewVertex) {
        newVertices.push(...vertices.flatMap(v => [v.x, v.y, v.z]));
      }
    }
  }
  
  if (newVertices.length === 0) {
    alert("No new vertices found to add to segment");
    return;
  }
  
  console.log(`Found ${newVertices.length / 9} new triangles to add`);
  
  // Efficiently combine vertex arrays
  const existingVertices = Array.from(segmentPositions.array);
  const combinedVertices = new Float32Array(existingVertices.length + newVertices.length);
  
  combinedVertices.set(existingVertices, 0);
  combinedVertices.set(newVertices, existingVertices.length);
  
  // Create optimized geometry
  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute('position', new THREE.BufferAttribute(combinedVertices, 3));
  newGeometry.computeVertexNormals();
  
  await updateSegmentMeshNonIndexed(targetSegment, newGeometry);
  
  console.log(`Successfully added ${newVertices.length / 9} triangles to segment`);
}

// Helper function to update segment mesh with indexed geometry
async function updateSegmentMesh(targetSegment: ToothSegment, newGeometry: any, combinedIndices: number[], originalPositions: any) {
  // Remove old mesh from scene
  scene.remove(targetSegment.mesh);
  targetSegment.mesh.geometry.dispose();

  // Create new mesh with the combined geometry
  const newMesh = new THREE.Mesh(newGeometry, targetSegment.mesh.material);
  newMesh.name = targetSegment.name;
  newMesh.castShadow = true;
  newMesh.receiveShadow = true;

  // Update segment properties
  targetSegment.mesh = newMesh;
  
  // Update originalVertices to include all vertices referenced by the new indices
  const allVertexIndices = new Set(combinedIndices);
  targetSegment.originalVertices = Array.from(allVertexIndices).map(index => {
    return new THREE.Vector3(
      originalPositions.getX(index),
      originalPositions.getY(index), 
      originalPositions.getZ(index)
    );
  });

  // Recalculate centroid
  targetSegment.centroid = calculateCentroid(targetSegment.originalVertices);

  // Add new mesh to scene
  scene.add(newMesh);
  updateSegmentAppearance(targetSegment);

  // Update reactivity
  dentalModel.value = markRaw({ ...dentalModel.value! });
}

// Helper function to update segment mesh with non-indexed geometry
async function updateSegmentMeshNonIndexed(targetSegment: ToothSegment, newGeometry: any) {
  // Remove old mesh from scene
  scene.remove(targetSegment.mesh);
  targetSegment.mesh.geometry.dispose();

  // Create new mesh with the combined geometry
  const newMesh = new THREE.Mesh(newGeometry, targetSegment.mesh.material);
  newMesh.name = targetSegment.name;
  newMesh.castShadow = true;
  newMesh.receiveShadow = true;

  // Update segment properties
  targetSegment.mesh = newMesh;
  
  // Update originalVertices from the new geometry
  const positions = newGeometry.getAttribute('position');
  const vertices = [];
  for (let i = 0; i < positions.count; i++) {
    vertices.push(new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    ));
  }
  targetSegment.originalVertices = vertices;

  // Recalculate centroid
  targetSegment.centroid = calculateCentroid(targetSegment.originalVertices);

  // Add new mesh to scene
  scene.add(newMesh);
  updateSegmentAppearance(targetSegment);

  // Update reactivity
  dentalModel.value = markRaw({ ...dentalModel.value! });
}

// Utility function to calculate centroid of vertices
function calculateCentroid(vertices: any[]): any {
  if (vertices.length === 0) {
    return new THREE.Vector3(0, 0, 0);
  }

  const centroid = new THREE.Vector3(0, 0, 0);
  
  vertices.forEach(vertex => {
    centroid.add(vertex);
  });
  
  centroid.divideScalar(vertices.length);
  return centroid;
}

// Enhanced Lasso Handlers
function setLassoMode(mode: LassoMode) {
  currentLassoMode.value = mode;
  console.log(`Lasso mode set to: ${mode}`);
}

function togglePreview() {
  previewEnabled.value = !previewEnabled.value;
  console.log(`Preview mode: ${previewEnabled.value ? 'enabled' : 'disabled'}`);
}

function confirmSelection() {
  if (!hasPreviewSelection.value) return;
  
  hasPreviewSelection.value = false;
  console.log('Selection confirmed');
  
  // Apply the preview selection
  // This would depend on your specific implementation needs
}

function cancelSelection() {
  if (!hasPreviewSelection.value) return;
  
  hasPreviewSelection.value = false;
  
  // Cancel current lasso operation
  if (enhancedLassoService?.isLassoActive()) {
    enhancedLassoService.cancelLasso();
  }
  
  console.log('Selection cancelled');
}

// Treatment Plan Handlers
function handlePlanCreated(plan: OrthodonticTreatmentPlan) {
  currentTreatmentPlan.value = plan;
  console.log('Treatment plan created:', plan);
}

function handlePlanUpdated(plan: OrthodonticTreatmentPlan | null) {
  currentTreatmentPlan.value = plan;
  console.log('Treatment plan updated:', plan);
}

function handleStepChanged(stepNumber: number) {
  console.log('Treatment step changed to:', stepNumber);
  // You can add additional logic here if needed
}

function handleTreatmentPlanFullScreen(isFullScreen: boolean) {
  isTreatmentPlanFullScreen.value = isFullScreen;
  console.log('Treatment plan full screen:', isFullScreen);
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
    const material = mesh.material as any;
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
      id: `ai_segment_${segmentData.id}`,
      name: segmentData.name || (segmentData.toothType === 'gum' ? 'Gum' : `AI Tooth ${segmentData.id + 1}`),
      mesh: mesh,
      originalVertices: [],
      centroid: centroid,
      color: color,
      toothType: (segmentData.toothType as ToothType) || 'molar',
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
      loadingMessage.value = `AI found ${result.segments.length} teeth!`;
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
    loadingMessage.value = `AI segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
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

.main-content.treatment-fullscreen {
  display: none;
}

.fullscreen-treatment-plan {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.02);
  backdrop-filter: blur(2px);
  animation: fadeInBackdrop 0.3s ease;
}

@keyframes fadeInBackdrop {
  from {
    opacity: 0;
    backdrop-filter: blur(0px);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(2px);
  }
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
  }
}
</style>
