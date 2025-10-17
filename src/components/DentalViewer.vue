<template>
  <div class="dental-viewer">
    <!-- Loading Overlay -->
    <LoadingOverlay
      :isLoading="threeJSManager.isLoading.value"
      :loadingMessage="threeJSManager.loadingMessage.value"
    />

    <AppHeader
      title="My Line"
      description="3D dental model viewer"
      :clickable="true"
      @logoClick="handleLogoClick"
    >
      <template #center>
        <TopToolbar
          :dentalModel="dentalModel"
          :selectedSegments="segmentManager.selectedSegments.value"
          :currentMode="currentMode"
          :isLoading="threeJSManager.isLoading.value"
          :interactionModes="interactionModes"
          @setInteractionMode="setInteractionMode"
          @setLassoMode="setLassoMode"
          @setBrushMode="setBrushMode"
          @toggleBrushSettings="toggleBrushSettings"
        />
      </template>
      <template #actions>
        <button @click="handleLogout" class="logout-btn">
          <Icon name="log-out" :size="16" color="currentColor" />
          Logout
        </button>
      </template>
    </AppHeader>

    <!-- Background Status Indicator -->
    <BackgroundStatusIndicator
      :status="backgroundSegmentationStatus"
      @dismiss="dismissBackgroundStatus"
    />

    <!-- Intersection Detection Progress -->
    <div
      v-if="segmentManager.isIntersectionDetectionRunning.value"
      class="intersection-progress"
    >
      <div class="progress-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{
              width: `${segmentManager.intersectionDetectionProgress.value}%`,
            }"
          ></div>
        </div>
        <div class="progress-text">
          Detecting intersections...
          {{ segmentManager.intersectionDetectionProgress.value }}%
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div
      class="main-content"
      :class="{ 'treatment-fullscreen': isTreatmentPlanFullScreen }"
    >
      <LeftSidebar
        v-show="!isTreatmentPlanFullScreen"
        :dentalModel="dentalModel"
        :selectedSegments="segmentManager.selectedSegments.value"
        :currentTreatmentPlan="currentTreatmentPlan"
        :intersectionResults="segmentManager.intersectionResults.value"
        @toggleOriginalMesh="toggleOriginalMesh"
        @toggleAllSegments="toggleAllSegments"
        @toggleSegmentSelection="segmentManager.toggleSegmentSelection"
        @changeSegmentColor="handleChangeSegmentColor"
        @renameSegment="renameSegment"
        @generateRandomColor="handleGenerateRandomColor"
        @resetIndividualPosition="segmentManager.resetIndividualPosition"
        @toggleSegmentVisibility="segmentManager.toggleSegmentVisibility"
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
        :isLoading="threeJSManager.isLoading.value"
        :loadingMessage="threeJSManager.loadingMessage.value"
        :selectedSegments="segmentManager.selectedSegments.value"
        :totalMovementDistance="segmentManager.totalMovementDistance.value"
        @setViewPreset="setViewPreset"
        @startDirectionalMove="startDirectionalMove"
        @stopDirectionalMove="stopDirectionalMove"
      />
      
      <!-- Brush Settings Panel -->
      <div v-if="currentMode === 'brush' && showBrushSettings && enhancedBrushService" class="brush-settings-panel">
        <BrushSettings
          :initialSettings="brushSettings"
          @update="handleBrushSettingsUpdate"
          @close="showBrushSettings = false"
        />
      </div>
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

      <!-- Intersection Panel -->
      <IntersectionPanel
        :intersectionResults="segmentManager.intersectionResults.value"
        :statistics="segmentManager.intersectionStatistics.value"
        :showNoIntersections="true"
        @highlight="handleIntersectionHighlight"
        @isolate="handleIntersectionIsolate"
        @clear-visualizations="handleClearIntersectionVisualizations"
        @export-data="handleExportIntersectionData"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, shallowRef, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useThreeJS } from "../composables/useThreeJS";
import { useThreeJSManager } from "../composables/useThreeJSManager";
import { useSegmentManager } from "../composables/useSegmentManager";
import { useCameraControls } from "../composables/useCameraControls";
import { useDirectionalMovement } from "../composables/useDirectionalMovement";
import { useGeometryManipulation } from "../composables/useGeometryManipulation";
import { FileHandlerService } from "../services/FileHandlerService";
import { errorHandlingService } from "../services/ErrorHandlingService";
import { buildApiUrl } from "@/config/api";
import { useToast } from "../composables/useToast";

import type {
  DentalModel,
  InteractionMode,
  OrthodonticTreatmentPlan,
  ToothSegment,
} from "../types/dental";
import type {
  EnhancedLassoService,
  LassoMode,
  LassoOperationResult,
} from "../services/EnhancedLassoService";
import type {
  EnhancedBrushService,
  BrushMode,
  BrushOperationResult,
} from "../services/EnhancedBrushService";
import AppHeader from "./AppHeader.vue";
import TopToolbar from "./TopToolbar.vue";
import LeftSidebar from "./LeftSidebar.vue";
import ViewportArea from "./ViewportArea.vue";
import BackgroundStatusIndicator from "./BackgroundStatusIndicator.vue";
import TreatmentPlanPanel from "./TreatmentPlanPanel.vue";
import IntersectionPanel from "./IntersectionPanel.vue";
import LoadingOverlay from "./LoadingOverlay.vue";
import Icon from "./Icon.vue";
import BrushSettings from "./BrushSettings.vue";

// Use the lazy loading composable
const { loadThreeJS, loadServices } = useThreeJS();

// Get route params
const route = useRoute();
const router = useRouter();
const caseId = route.params.caseId as string;

// Initialize composables
const threeJSManager = useThreeJSManager();
const segmentManager = useSegmentManager();
const cameraControls = useCameraControls();
const directionalMovement = useDirectionalMovement();
const geometryManipulation = useGeometryManipulation();
const toastService = useToast();

// Refs
const viewportRef = ref<typeof ViewportArea>();

// Canvas container reference
const canvasContainer = computed(
  () => viewportRef.value?.canvasContainer as HTMLDivElement
);

// Services - will be initialized after lazy loading
let fileHandlerService: FileHandlerService | null = null;
// let segmentationService: SegmentationService | null = null;
let enhancedLassoService: EnhancedLassoService | null = null;
let enhancedBrushService: EnhancedBrushService | null = null;
let THREE: any = null;

// Enhanced Lasso state
const currentLassoMode = ref<LassoMode>("create");

// Enhanced Brush state
const currentBrushMode = ref<BrushMode>("create");
const showBrushSettings = ref(false);
const brushSettings = ref({
  radius: 1.5,
  strength: 1.0,
  hardness: 0.9,
  mode: 'create' as BrushMode,
  dentalAwareMode: false,
  respectBoundaries: false,
  adaptiveSampling: true
});

// Reactive state
const dentalModel = shallowRef<DentalModel | null>(null);
const currentMode = ref<InteractionMode["mode"]>("rotate");
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

// User data
const user = ref(null);

const interactionModes: InteractionMode["mode"][] = ["lasso", "brush", "pan", "rotate"];

onMounted(async () => {
  // Load user data
  const userData = localStorage.getItem("user");
  if (userData) {
    user.value = JSON.parse(userData);
  }

  await initializeApp();
});

async function initializeApp() {
  try {
    threeJSManager.isLoading.value = true;
    threeJSManager.loadingMessage.value = "Loading 3D Engine...";

    // Load Three.js and services
    const { THREE: ThreeJS, BVH } = await loadThreeJS();
    THREE = ThreeJS; // Store THREE globally for this component

    const {
      STLLoaderService: STLLoader,
      OBJLoaderService: OBJLoader,
      PLYLoaderService: PLYLoader,
      GLTFLoaderService: GLTFLoader,
    } = await loadServices();

    // Add BVH extensions to THREE.js
    THREE.BufferGeometry.prototype.computeBoundsTree = BVH.computeBoundsTree;
    THREE.BufferGeometry.prototype.disposeBoundsTree = BVH.disposeBoundsTree;
    THREE.Mesh.prototype.raycast = BVH.acceleratedRaycast;

    // Initialize Three.js scene
    const threeJSResult = threeJSManager.initThreeJS(
      canvasContainer.value!,
      THREE
    );
    if (!threeJSResult) {
      throw new Error("Failed to initialize Three.js");
    }

    const { scene, camera, renderer } = threeJSResult;

    // Initialize services
    fileHandlerService = new FileHandlerService(
      new STLLoader(),
      new OBJLoader(),
      new PLYLoader(),
      new GLTFLoader(),
      scene
    );

    // Initialize intersection detection
    segmentManager.initializeIntersectionDetection(scene);

    // Setup event listeners
    if (renderer?.domElement) {
      // Create lasso handlers object
      const lassoHandlers = {
        handleLassoMouseDown,
        handleLassoMouseMove,
        handleLassoMouseUp,
      };
      
      // Create brush handlers object
      const brushHandlers = {
        handleBrushMouseDown,
        handleBrushMouseMove,
        handleBrushMouseUp,
      };

      cameraControls.setupEventListeners(
        renderer.domElement,
        camera,
        renderer,
        currentMode,
        THREE,
        lassoHandlers,
        brushHandlers
      );
      threeJSManager.setupResizeObserver(canvasContainer.value!);
    }

    // Initialize Enhanced Lasso Service
    await initializeEnhancedLasso(renderer, camera, scene);
    
    // Initialize Enhanced Brush Service
    await initializeEnhancedBrush(renderer, camera, scene);

    // Load case data and STL file
    await loadCaseData();

    threeJSManager.isLoading.value = false;

    // Load segments after initial render is complete (non-blocking)
    setTimeout(async () => {
      await loadSegmentsInBackground();
    }, 100);
  } catch (error) {
    console.error("Failed to initialize app:", error);
    threeJSManager.loadingMessage.value = "Failed to load 3D engine";
  }
}

// Load case data and STL file
async function loadCaseData() {
  try {
    if (!caseId) {
      console.error("No case ID provided");
      return;
    }

    threeJSManager.loadingMessage.value = "Loading case data...";

    // Get auth token
    const token = localStorage.getItem("authToken");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Fetch case data from backend
    const response = await fetch(buildApiUrl(`/cases/${caseId}`), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      await errorHandlingService.handleApiError(
        response,
        `Failed to fetch case: ${response.statusText}`
      );
    }

    const responseData = await response.json();
    const caseData = responseData.case; // Extract case data from response
    console.log("Case data loaded:", caseData);

    // Load the STL file from id/raw endpoint
    threeJSManager.loadingMessage.value = "Loading STL file...";

    const fileUrl = buildApiUrl(`/cases/${caseId}/raw`);
    console.log("Loading STL file from:", fileUrl);

    // Get auth token
    const authToken = localStorage.getItem("authToken") || undefined;

    // Load the STL file using the file handler service
    const loadedModel = await fileHandlerService?.loadSTLFile(
      fileUrl,
      authToken
    );

    if (loadedModel) {
      // Compute bounding box for the loaded mesh
      loadedModel.geometry.computeBoundingBox();
      const boundingBox = {
        min: loadedModel.geometry.boundingBox.min.clone(),
        max: loadedModel.geometry.boundingBox.max.clone(),
      };

      console.log("Mesh bounding box:", boundingBox);

      // Ensure the mesh is visible and has proper material
      loadedModel.visible = true;
      if (!loadedModel.material) {
        loadedModel.material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          metalness: 0.1,
          roughness: 0.8,
        });
      }

      // Create dental model structure
      dentalModel.value = {
        originalMesh: loadedModel,
        segments: [],
        boundingBox: boundingBox,
      };

      // Store case metadata separately if needed
      console.log("Case metadata:", {
        caseId: caseData.id,
        caseName: caseData.case_name,
        fileName: caseData.file_name,
        uploadedAt: caseData.created_at,
      });

      console.log("Dental model loaded successfully:", dentalModel.value);

      // Focus camera on the loaded model first (non-blocking)
      if (dentalModel.value) {
        console.log("Focusing camera on model...");
        threeJSManager.focusOnModel(dentalModel.value);

        // Debug scene and camera
        const scene = threeJSManager.getScene();
        const camera = threeJSManager.getCamera();
        const renderer = threeJSManager.getRenderer();

        console.log("Scene children count:", scene.children.length);
        console.log("Camera position:", camera.position);
        console.log(
          "Camera target:",
          camera.getWorldDirection(new THREE.Vector3())
        );

        // Force a render update
        if (renderer) {
          console.log("Forcing render update...");
          renderer.render(scene, camera);
        }
      }
    } else {
      throw new Error("Failed to load STL file");
    }
  } catch (error) {
    console.error("Failed to load case data:", error);
    errorHandlingService.handleFetchError(error);
    threeJSManager.loadingMessage.value = "Failed to load case data";
  }
}

// Event handlers and functions
function setInteractionMode(mode: InteractionMode["mode"]) {
  // Clean up any active enhanced lasso selection when changing modes
  if (currentMode.value === "lasso" && enhancedLassoService?.isLassoActive()) {
    enhancedLassoService.cancelLasso();
  }
  
  // Clean up any active brush operation when changing modes
  if (currentMode.value === "brush" && enhancedBrushService) {
    if (enhancedBrushService.isBrushActive()) {
      enhancedBrushService.cancelBrush();
    }
    enhancedBrushService.hideCursor();
  }

  currentMode.value = mode;
  console.log(`Interaction mode changed to: ${mode}`);

  // Set appropriate cursor for the new mode
  const renderer = threeJSManager.getRenderer();
  if (renderer?.domElement) {
    const cursorMap = {
      lasso: "crosshair",
      brush: "none", // Hide default cursor, we'll show custom brush cursor
      pan: "grab",
      rotate: "grab",
    };
    renderer.domElement.style.cursor = cursorMap[mode] || "default";
  }
}

function setViewPreset(
  view: "top" | "bottom" | "front" | "back" | "left" | "right"
) {
  if (!dentalModel.value) return;
  threeJSManager.setViewPreset(view, dentalModel.value);
}

// Enhanced Lasso Handlers
function setLassoMode(mode: LassoMode) {
  currentLassoMode.value = mode;
  console.log(`Lasso mode set to: ${mode}`);
}

// Enhanced Brush Handlers
function setBrushMode(mode: BrushMode) {
  currentBrushMode.value = mode;
  brushSettings.value.mode = mode;
  
  // Update brush settings when mode changes
  if (enhancedBrushService) {
    enhancedBrushService.updateSettings({ mode });
  }
}

function handleBrushSettingsUpdate(settings: any) {
  brushSettings.value = { ...settings };
  
  if (enhancedBrushService) {
    enhancedBrushService.updateSettings(settings);
  }
}

function toggleBrushSettings() {
  showBrushSettings.value = !showBrushSettings.value;
}

// Lasso Mouse Event Handlers
function handleLassoMouseDown(event: MouseEvent) {
  if (
    currentMode.value !== "lasso" ||
    !enhancedLassoService ||
    !dentalModel.value
  )
    return;

  // Don't start lasso if modifier keys are held (for rotation/pan)
  if (event.metaKey || event.ctrlKey) return;

  const renderer = threeJSManager.getRenderer();
  if (!renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const targetSegmentId =
    segmentManager.selectedSegments.value.length > 0
      ? segmentManager.selectedSegments.value[0].id
      : undefined;

  enhancedLassoService.startLasso(
    currentLassoMode.value,
    { x, y },
    targetSegmentId
  );

  console.log(
    `Started enhanced lasso selection in ${currentLassoMode.value} mode`
  );
}

async function handleLassoMouseMove(event: MouseEvent) {
  if (
    currentMode.value !== "lasso" ||
    !enhancedLassoService ||
    !enhancedLassoService.isLassoActive()
  )
    return;

  // Don't update lasso if modifier keys are held (for rotation/pan)
  if (event.metaKey || event.ctrlKey) return;

  const renderer = threeJSManager.getRenderer();
  if (!renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  await enhancedLassoService.updateLasso({ x, y });
}

async function handleLassoMouseUp(_event: MouseEvent) {
  if (
    currentMode.value !== "lasso" ||
    !enhancedLassoService ||
    !enhancedLassoService.isLassoActive()
  )
    return;

  const result = await enhancedLassoService.finishLasso(dentalModel.value!);

  if (result) {
    handleLassoOperationResult(result);
  }

  console.log("Finalized enhanced lasso selection");
}

function handleLassoOperationResult(result: LassoOperationResult) {
  switch (result.mode) {
    case "create":
      handleLassoCreateSegment(result.selectedVertices);
      break;
    case "select":
      handleLassoSelectSegments(result.affectedSegments);
      break;
    case "add":
      handleLassoAddToSegment(result.selectedVertices, result.targetSegmentId);
      break;
    case "subtract":
      handleLassoSubtractFromSegment(
        result.selectedVertices,
        result.targetSegmentId
      );
      break;
  }
}

async function handleLassoCreateSegment(selectedVertices: number[]) {
  if (!dentalModel.value?.originalMesh || selectedVertices.length === 0) {
    toastService.error(
      "No Vertices Found",
      "No vertices found inside lasso area."
    );
    return;
  }

  try {
    threeJSManager.isLoading.value = true;
    threeJSManager.loadingMessage.value = "Creating segment...";

    const newSegment = await geometryManipulation.createSegmentFromVertices(
      selectedVertices,
      dentalModel.value.originalMesh,
      dentalModel.value,
      THREE
    );

    if (newSegment) {
      dentalModel.value.segments.push(newSegment);
      const scene = threeJSManager.getScene();
      if (scene) {
        scene.add(newSegment.mesh);
      }
      dentalModel.value = { ...dentalModel.value };

      // Keep original mesh visible for more segmentations
      dentalModel.value.originalMesh.visible = true;
      if (scene && !scene.children.includes(dentalModel.value.originalMesh)) {
        scene.add(dentalModel.value.originalMesh);
      }

      // Select the new segment
      segmentManager.selectedSegments.value.forEach((segment) => {
        segment.isSelected = false;
        segmentManager.updateSegmentAppearance(segment);
      });
      segmentManager.selectedSegments.value = [newSegment];
      newSegment.isSelected = true;
      segmentManager.updateSegmentAppearance(newSegment);

      console.log(`Successfully created segment ${newSegment.name}`);
    }
  } catch (error) {
    console.error("Error creating segment:", error);
    toastService.error(
      "Segment Creation Failed",
      "Error creating segment. Try selecting a smaller area."
    );
  } finally {
    threeJSManager.isLoading.value = false;
    threeJSManager.loadingMessage.value = "";
  }
}

function handleLassoSelectSegments(segments: any[]) {
  // Clear current selection
  segmentManager.selectedSegments.value.forEach((segment) => {
    segment.isSelected = false;
    segmentManager.updateSegmentAppearance(segment);
  });

  // Select the lassoed segments
  segmentManager.selectedSegments.value = segments;
  segments.forEach((segment) => {
    segment.isSelected = true;
    segmentManager.updateSegmentAppearance(segment);
  });

  console.log(`Selected ${segments.length} segments via lasso`);
}

function handleLassoAddToSegment(
  selectedVertices: number[],
  targetSegmentId?: string
) {
  if (!targetSegmentId || selectedVertices.length === 0) {
    toastService.warning(
      "No Segment Selected",
      "Please select a segment first to add vertices to it."
    );
    return;
  }

  const targetSegment = dentalModel.value?.segments.find(
    (s) => s.id === targetSegmentId
  );
  if (!targetSegment) {
    toastService.error("Segment Not Found", "Target segment not found.");
    return;
  }

  geometryManipulation.addVerticesToSegment(
    targetSegment,
    selectedVertices,
    dentalModel.value?.originalMesh,
    THREE
  );
}

function handleLassoSubtractFromSegment(
  selectedVertices: number[],
  targetSegmentId?: string
) {
  if (!targetSegmentId || selectedVertices.length === 0) {
    toastService.warning(
      "No Segment Selected",
      "Please select a segment first to remove vertices from it."
    );
    return;
  }

  const targetSegment = dentalModel.value?.segments.find(
    (s) => s.id === targetSegmentId
  );
  if (!targetSegment) {
    toastService.error("Segment Not Found", "Target segment not found.");
    return;
  }

  geometryManipulation.removeVerticesFromSegment(
    targetSegment,
    selectedVertices,
    dentalModel.value?.originalMesh,
    THREE
  );
}

// Directional Movement Functions
function startDirectionalMove(
  axis: "Anteroposterior" | "Vertical" | "Transverse",
  direction: number
) {
  const camera = threeJSManager.getCamera();
  if (!camera || !THREE) return;

  directionalMovement.startDirectionalMove(
    axis,
    direction,
    segmentManager.selectedSegments.value,
    camera,
    THREE,
    () => {
      // Update movement history for all selected segments
      segmentManager.selectedSegments.value.forEach((segment) => {
        segmentManager.updateSegmentMovementHistory(segment, "directional");
      });

      // Trigger Vue reactivity by reassigning the dentalModel ref
      if (dentalModel.value) {
        dentalModel.value = { ...dentalModel.value };
      }

      // Intersection detection disabled - removed to prevent dialog popup during movement
      // if (dentalModel.value) {
      //   segmentManager.detectIntersections(dentalModel.value);
      // }
    }
  );
}

function stopDirectionalMove() {
  directionalMovement.stopDirectionalMove();

  // Update movement history for all selected segments when movement stops
  segmentManager.selectedSegments.value.forEach((segment) => {
    segmentManager.updateSegmentMovementHistory(segment, "directional");
  });

  // Trigger Vue reactivity by reassigning the dentalModel ref
  if (dentalModel.value) {
    dentalModel.value = { ...dentalModel.value };
  }
}


// Segment Management Functions
function toggleOriginalMesh() {
  if (!dentalModel.value) return;
  segmentManager.toggleOriginalMesh(dentalModel.value);

  // Trigger Vue reactivity by reassigning the dentalModel ref
  dentalModel.value = { ...dentalModel.value };
}

function toggleAllSegments() {
  if (!dentalModel.value) return;
  segmentManager.toggleAllSegments(dentalModel.value);

  // Trigger Vue reactivity by reassigning the dentalModel ref
  dentalModel.value = { ...dentalModel.value };
}

function deleteSegment(segment: any) {
  if (!dentalModel.value) return;
  const scene = threeJSManager.getScene();
  if (!scene) return;

  segmentManager.deleteSegment(segment, scene, dentalModel.value);

  // Trigger Vue reactivity by reassigning the dentalModel ref
  dentalModel.value = { ...dentalModel.value };
  console.log("🔄 Triggered Vue reactivity after deleting segment");
}

async function renameSegment(segment: any, newName: string) {
  if (!dentalModel.value) return;

  try {
    // Update the segment name locally
    segment.name = newName;

    // Update the mesh name as well
    if (segment.mesh) {
      segment.mesh.name = newName;
    }

    // Save to database if we have a case ID
    const caseId = route.params.caseId as string;
    if (caseId && segment.id) {
      const token = localStorage.getItem("authToken");
      if (token) {
        const response = await fetch(
          buildApiUrl(`/cases/${caseId}/segments/${segment.id}`),
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: newName }),
          }
        );

        if (!response.ok) {
          await errorHandlingService.handleApiError(
            response,
            "Failed to save segment name to database"
          );
        }

        console.log(
          `✅ Segment "${segment.name}" renamed to "${newName}" and saved to database`
        );
      }
    }

    // Trigger Vue reactivity
    dentalModel.value = { ...dentalModel.value };
  } catch (error) {
    console.error("Error renaming segment:", error);
    // Revert the name change on error
    segment.name = segment.name;
    toastService.error(
      "Save Failed",
      "Failed to save segment name. Please try again."
    );
  }
}

async function handleChangeSegmentColor(segment: any, event: Event) {
  if (!dentalModel.value) return;

  try {
    // Update the segment color locally
    segmentManager.changeSegmentColor(segment, event);

    // Save to database if we have a case ID
    const caseId = route.params.caseId as string;
    if (caseId && segment.id) {
      const input = event.target as HTMLInputElement;
      const colorHex = input.value;

      const token = localStorage.getItem("authToken");
      if (token) {
        const response = await fetch(
          buildApiUrl(`/cases/${caseId}/segments/${segment.id}`),
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ color: colorHex }),
          }
        );

        if (!response.ok) {
          await errorHandlingService.handleApiError(
            response,
            "Failed to save segment color to database"
          );
        }

        console.log(
          `✅ Segment "${segment.name}" color updated to "${colorHex}" and saved to database`
        );
      }
    }

    // Trigger Vue reactivity
    dentalModel.value = { ...dentalModel.value };
  } catch (error) {
    console.error("Error updating segment color:", error);
    errorHandlingService.handleFetchError(error);
    toastService.error(
      "Save Failed",
      "Failed to save segment color. Please try again."
    );
  }
}

async function handleGenerateRandomColor(segment: any) {
  if (!dentalModel.value) return;

  try {
    // Generate a random color
    const randomColor = generateRandomHexColor();

    // Update the segment color locally
    segment.color.setHex(randomColor);
    const material = segment.mesh.material as any;
    if (material && material.color) {
      material.color.setHex(randomColor);
    }

    // Save to database if we have a case ID
    const caseId = route.params.caseId as string;
    if (caseId && segment.id) {
      const token = localStorage.getItem("authToken");
      if (token) {
        const response = await fetch(
          buildApiUrl(`/cases/${caseId}/segments/${segment.id}`),
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              color: `#${randomColor.toString(16).padStart(6, "0")}`,
            }),
          }
        );

        if (!response.ok) {
          await errorHandlingService.handleApiError(
            response,
            "Failed to save random color to database"
          );
        }

        console.log(
          `✅ Segment "${segment.name}" assigned random color and saved to database`
        );
      }
    }

    // Trigger Vue reactivity
    dentalModel.value = { ...dentalModel.value };
  } catch (error) {
    console.error("Error generating random color:", error);
    errorHandlingService.handleFetchError(error);
    toastService.error(
      "Save Failed",
      "Failed to save random color. Please try again."
    );
  }
}

function generateRandomHexColor(): number {
  // Generate a random color with good contrast and visibility
  const hue = Math.random() * 360;
  const saturation = 0.6 + Math.random() * 0.4; // 60-100% saturation
  const lightness = 0.4 + Math.random() * 0.3; // 40-70% lightness for good visibility

  // Convert HSL to RGB
  const h = hue / 360;
  const s = saturation;
  const l = lightness;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 1 / 6) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 2 / 6) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 3 / 6) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 4 / 6) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 5 / 6) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  // Convert to hex
  const red = Math.round((r + m) * 255);
  const green = Math.round((g + m) * 255);
  const blue = Math.round((b + m) * 255);

  return (red << 16) | (green << 8) | blue;
}

// Treatment Plan Handlers
function handlePlanCreated(plan: OrthodonticTreatmentPlan) {
  currentTreatmentPlan.value = plan;

  // Store current positions as original positions for progressive movement
  if (dentalModel.value) {
    dentalModel.value.segments.forEach((segment) => {
      if (!segment.originalPosition) {
        segment.originalPosition = segment.mesh.position.clone();
      }
    });
  }

  console.log("Treatment plan created:", plan);
}

function handlePlanUpdated(plan: OrthodonticTreatmentPlan | null) {
  currentTreatmentPlan.value = plan;
  console.log("Treatment plan updated:", plan);

  // If no plan, show all segments
  if (!plan && dentalModel.value) {
    showAllSegments();
  }
}

function showAllSegments() {
  if (!dentalModel.value) {
    return;
  }

  // Show all segments and apply their final treatment positions
  if (currentTreatmentPlan.value) {
    // Apply final step positions (last step of treatment)
    const finalStep = currentTreatmentPlan.value.totalSteps;
    dentalModel.value.segments.forEach((segment) => {
      segment.mesh.visible = true;
      applyProgressiveMovement(segment, finalStep);
    });
  } else {
    // No treatment plan - just show all segments in current positions
    dentalModel.value.segments.forEach((segment) => {
      segment.mesh.visible = true;
    });
  }

  // Trigger Vue reactivity
  dentalModel.value = { ...dentalModel.value };
  console.log("All segments shown");
}

function applyProgressiveMovement(segment: any, stepNumber: number) {
  if (!currentTreatmentPlan.value) {
    return;
  }

  // Find the tooth movement data for this segment
  const toothMovement = currentTreatmentPlan.value.teethMovements.find(
    (tooth) => tooth.toothId === segment.id
  );

  if (!toothMovement) {
    // If no movement data, keep segment in original position
    if (segment.originalPosition) {
      segment.mesh.position.copy(segment.originalPosition);
      segment.mesh.updateMatrixWorld();
    }
    return;
  }

  // Calculate total movement for this step
  let totalMovement = { x: 0, y: 0, z: 0 };

  toothMovement.movements.forEach((movement) => {
    const movementStartStep =
      movement.startStep || toothMovement.startStep || 1;
    const movementDuration =
      movement.userSteps || movement.recommendedSteps || 1;
    const movementEndStep = movementStartStep + movementDuration - 1;

    // Check if this movement is active in the current step
    if (stepNumber >= movementStartStep && stepNumber <= movementEndStep) {
      // Calculate how many steps into this movement we are
      const stepsIntoMovement = stepNumber - movementStartStep + 1;
      const totalSteps = movementDuration;

      // Calculate the proportion of movement completed
      const movementProgress = Math.min(stepsIntoMovement / totalSteps, 1);

      // Apply movement based on direction
      const movementDistance = movement.distance * movementProgress;

      switch (movement.direction) {
        case "anteroposterior":
          totalMovement.z += movementDistance;
          break;
        case "vertical":
          totalMovement.y += movementDistance;
          break;
        case "transverse":
          totalMovement.x += movementDistance;
          break;
      }
    } else if (stepNumber > movementEndStep) {
      // If we're past the end of this movement, apply the full movement
      switch (movement.direction) {
        case "anteroposterior":
          totalMovement.z += movement.distance;
          break;
        case "vertical":
          totalMovement.y += movement.distance;
          break;
        case "transverse":
          totalMovement.x += movement.distance;
          break;
      }
    }
    // If stepNumber < movementStartStep, no movement is applied (stays at original position)
  });

  // Apply the calculated movement to the segment
  if (segment.originalPosition) {
    segment.mesh.position.set(
      segment.originalPosition.x + totalMovement.x,
      segment.originalPosition.y + totalMovement.y,
      segment.originalPosition.z + totalMovement.z
    );
    segment.mesh.updateMatrixWorld();
  }

  console.log(
    `Applied progressive movement to ${segment.name} for step ${stepNumber}:`,
    totalMovement
  );
}

function handleStepChanged(stepNumber: number) {
  console.log("Treatment step changed to:", stepNumber);
  updateSegmentVisibilityForStep(stepNumber);
}

function updateSegmentVisibilityForStep(stepNumber: number) {
  if (!dentalModel.value || !currentTreatmentPlan.value) {
    return;
  }

  // Apply progressive movement to all segments, keeping them all visible
  dentalModel.value.segments.forEach((segment) => {
    // Keep all segments visible
    segment.mesh.visible = true;

    // Apply progressive movement based on current step
    applyProgressiveMovement(segment, stepNumber);

    console.log(
      `Applied progressive movement to ${segment.name} for step ${stepNumber}`
    );
  });

  // Trigger Vue reactivity
  dentalModel.value = { ...dentalModel.value };
}

function handleTreatmentPlanFullScreen(isFullScreen: boolean) {
  isTreatmentPlanFullScreen.value = isFullScreen;
}

function dismissBackgroundStatus() {
  backgroundSegmentationStatus.value.isRunning = false;
  backgroundSegmentationStatus.value.message = "";
  backgroundSegmentationStatus.value.progress = undefined;
}

function handleLogout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  router.push("/login");
}

// Load segments in background after initial render
async function loadSegmentsInBackground() {
  try {
    console.log("🔄 Starting background segment loading...");

    // Show a subtle loading indicator for segments
    threeJSManager.loadingMessage.value = "Loading segments...";

    // Run migration and segment loading in parallel
    const [migrationResult, segmentsResult] = await Promise.allSettled([
      migrateExistingSegments(),
      loadExistingSegments(),
    ]);

    // Handle migration results
    if (migrationResult.status === "fulfilled") {
      console.log("✅ Segment migration completed");
    } else {
      console.warn("⚠️ Segment migration failed:", migrationResult.reason);
    }

    // Handle segment loading results
    if (segmentsResult.status === "fulfilled") {
      console.log("✅ Segment loading completed");
    } else {
      console.warn("⚠️ Segment loading failed:", segmentsResult.reason);
    }

    // Clear loading message
    threeJSManager.loadingMessage.value = "";
    console.log("🎉 Background segment loading completed");
  } catch (error) {
    console.error("❌ Background segment loading failed:", error);
    threeJSManager.loadingMessage.value = "";
  }
}

// Migrate existing segments to database
async function migrateExistingSegments() {
  try {
    const caseId = route.params.caseId as string;
    if (!caseId) return;

    const token = localStorage.getItem("authToken");
    if (!token) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      buildApiUrl(`/cases/${caseId}/segments/migrate`),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      await errorHandlingService.handleApiError(
        response,
        "Failed to migrate segments"
      );
    }

    const result = await response.json();
    if (result.migrated > 0) {
      console.log(`✅ Migrated ${result.migrated} segments to database`);
      // Note: Segment loading is handled separately in parallel
    }
  } catch (error) {
    console.error("Error migrating segments:", error);
    errorHandlingService.handleFetchError(error);
  }
}

// Generate different colors for segments
function generateSegmentColor(index: number): number {
  const colors = [
    0xff6b6b, // Red
    0x4ecdc4, // Teal
    0x45b7d1, // Blue
    0x96ceb4, // Green
    0xfeca57, // Yellow
    0xff9ff3, // Pink
    0x54a0ff, // Light Blue
    0x5f27cd, // Purple
    0x00d2d3, // Cyan
    0xff9f43, // Orange
    0x10ac84, // Emerald
    0xee5a24, // Dark Orange
    0x575fcf, // Indigo
    0x0abde3, // Sky Blue
    0x48dbfb, // Light Cyan
  ];

  return colors[index % colors.length];
}

function handleLogoClick() {
  router.push("/cases");
}

async function loadExistingSegments() {
  try {
    if (!caseId || !dentalModel.value) {
      console.log("No case ID or dental model available for loading segments");
      return;
    }

    // Loading message is handled at a higher level

    // Get auth token
    const token = localStorage.getItem("authToken");
    if (!token) {
      throw new Error("No authentication token found");
    }

    // Fetch segments from backend with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for segment loading

    const response = await fetch(
      buildApiUrl(`/cases/${caseId}/segments`),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        console.log("No segments found for this case");
        return;
      }
      await errorHandlingService.handleApiError(
        response,
        `Failed to fetch segments: ${response.statusText}`
      );
    }

    const segmentsData = await response.json();

    // Log the first segment's data structure to understand available positioning info
    if (segmentsData.segments && segmentsData.segments.length > 0) {
      console.log("First segment data structure:", segmentsData.segments[0]);

      // Log coordinate system information
      const firstSegment = segmentsData.segments[0];
      if (firstSegment.center) {
        console.log("Coordinate system analysis:");
        console.log("  Center coordinates:", firstSegment.center);
        console.log("  Coordinate range:", {
          x: [
            Math.min(
              ...segmentsData.segments.map((s: any) => s.center?.[0] || 0)
            ),
            Math.max(
              ...segmentsData.segments.map((s: any) => s.center?.[0] || 0)
            ),
          ],
          y: [
            Math.min(
              ...segmentsData.segments.map((s: any) => s.center?.[1] || 0)
            ),
            Math.max(
              ...segmentsData.segments.map((s: any) => s.center?.[1] || 0)
            ),
          ],
          z: [
            Math.min(
              ...segmentsData.segments.map((s: any) => s.center?.[2] || 0)
            ),
            Math.max(
              ...segmentsData.segments.map((s: any) => s.center?.[2] || 0)
            ),
          ],
        });
      }
    }

    if (segmentsData.segments && segmentsData.segments.length > 0) {
      // Get the original model's bounding box for reference
      let originalModelBbox: any = null;
      if (dentalModel.value?.originalMesh) {
        originalModelBbox = new THREE.Box3().setFromObject(
          dentalModel.value.originalMesh
        );
        console.log("Original model bounding box:", originalModelBbox);
      }

      // Load each segment
      for (const segmentInfo of segmentsData.segments) {
        try {
          // Load segment mesh from backend - don't center geometry to preserve original positions
          const segmentUrl = buildApiUrl(`/cases/${caseId}/segments/${segmentInfo.id}`);
          const segmentMesh = await fileHandlerService?.loadSTLFile(
            segmentUrl,
            token,
            false
          );

          if (segmentMesh) {
            // Don't set any position - let the segment render in its natural position
            // The geometry is already in the correct position since we loaded it with centerGeometry: false
            console.log(
              `Segment ${segmentInfo.id} loaded with natural positioning`
            );
            console.log(
              `Segment ${segmentInfo.id} position:`,
              segmentMesh.position
            );
            console.log(
              `Segment ${segmentInfo.id} geometry bounding box:`,
              segmentMesh.geometry.boundingBox
            );

            // Update the mesh's world matrix
            segmentMesh.updateMatrixWorld();

            // Create segment color - use database color if available, otherwise generate one
            const segmentColor =
              segmentInfo.color ||
              generateSegmentColor(segmentsData.segments.indexOf(segmentInfo));

            // Update the mesh material to use the segment color
            if (segmentMesh.material) {
              segmentMesh.material.color.setHex(segmentColor);
              segmentMesh.material.transparent = true;
              segmentMesh.material.opacity = 0.95;
              segmentMesh.material.side = THREE.DoubleSide;
            }

            // Create segment object
            const segment: ToothSegment = {
              id: segmentInfo.id,
              name: segmentInfo.name || `Segment ${segmentInfo.id}`,
              mesh: segmentMesh,
              originalVertices: [], // Will be populated if needed
              centroid: segmentMesh.position.clone(), // Use actual mesh position as centroid
              color: new THREE.Color(segmentColor),
              toothType: segmentInfo.tooth_type || "incisor",
              isSelected: false,
              originalPosition: segmentMesh.position.clone(),
              movementHistory: {
                totalDistance: 0,
                axisMovements: {
                  anteroposterior: 0,
                  vertical: 0,
                  transverse: 0,
                },
                movementCount: 0,
              },
            };

            // Add to dental model
            dentalModel.value.segments.push(segment);

            // Add to scene
            const scene = threeJSManager.getScene();
            if (scene) {
              scene.add(segmentMesh);
            }

            // Apply segment styling
            segmentManager.updateSegmentAppearance(segment);

            console.log(
              `Loaded segment: ${segment.name} at position:`,
              segmentMesh.position
            );

            // Log the final position for debugging
            console.log(
              `Final position for segment ${segmentInfo.id}:`,
              segmentMesh.position
            );
          }
        } catch (segmentError) {
          console.error(
            `Failed to load segment ${segmentInfo.id}:`,
            segmentError
          );
        }
      }

      // Trigger Vue reactivity
      dentalModel.value = { ...dentalModel.value };

      console.log(
        `Successfully loaded ${dentalModel.value.segments.length} segments`
      );

      // Focus camera on the model with segments
      if (dentalModel.value.segments.length > 0) {
        threeJSManager.focusOnModel(dentalModel.value);
      }

      // Intersection detection disabled - removed to prevent dialog popup
      // segmentManager.detectIntersections(dentalModel.value);
    } else {
      console.log("No segments found for this case");
    }
  } catch (error) {
    console.error("Failed to load existing segments:", error);
    errorHandlingService.handleFetchError(error);
  } finally {
    threeJSManager.loadingMessage.value = "";
  }
}

// Intersection Detection Handlers
function handleIntersectionHighlight(intersection: any) {
  console.log("Highlighting intersection:", intersection);
  // TODO: Implement intersection highlighting
}

function handleIntersectionIsolate(intersection: any) {
  console.log("Isolating segments for intersection:", intersection);
  // TODO: Implement segment isolation
}

function handleClearIntersectionVisualizations() {
  segmentManager.clearIntersectionVisualizations();
  console.log("Cleared intersection visualizations");
}

function handleExportIntersectionData() {
  const data = {
    intersections: segmentManager.intersectionResults.value,
    statistics: segmentManager.intersectionStatistics.value,
    timestamp: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `intersection-data-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);

  console.log("Exported intersection data");
}

async function initializeEnhancedLasso(renderer: any, camera: any, scene: any) {
  try {
    const { EnhancedLassoService } = await import(
      "../services/EnhancedLassoService"
    );
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

async function initializeEnhancedBrush(renderer: any, camera: any, scene: any) {
  try {
    const { EnhancedBrushService } = await import(
      "../services/EnhancedBrushService"
    );
    enhancedBrushService = new EnhancedBrushService(
      renderer.domElement,
      camera,
      renderer,
      scene
    );
  } catch (error) {
    console.error("Failed to initialize Enhanced Brush Service:", error);
  }
}

// Brush Mouse Event Handlers
async function handleBrushMouseDown(event: MouseEvent) {
  if (
    currentMode.value !== "brush" ||
    !enhancedBrushService ||
    !dentalModel.value
  )
    return;

  // Don't start brush if modifier keys are held (for rotation/pan)
  if (event.metaKey || event.ctrlKey) return;

  const renderer = threeJSManager.getRenderer();
  if (!renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const targetSegmentId =
    segmentManager.selectedSegments.value.length > 0
      ? segmentManager.selectedSegments.value[0].id
      : undefined;

  // Temporarily make original mesh visible if it's hidden (for raycasting)
  const wasOriginalHidden = !dentalModel.value.originalMesh.visible;
  if (wasOriginalHidden && currentBrushMode.value === 'create') {
    dentalModel.value.originalMesh.visible = true;
  }

  await enhancedBrushService.startBrush(
    currentBrushMode.value,
    { x, y },
    dentalModel.value,
    targetSegmentId
  );
}

async function handleBrushMouseMove(event: MouseEvent) {
  if (
    currentMode.value !== "brush" ||
    !enhancedBrushService ||
    !dentalModel.value
  )
    return;

  // Don't update brush if modifier keys are held (for rotation/pan)
  if (event.metaKey || event.ctrlKey) {
    enhancedBrushService.hideCursor();
    return;
  }

  const renderer = threeJSManager.getRenderer();
  if (!renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  // Always show/update cursor in brush mode
  enhancedBrushService.showCursor({ x, y });

  // If actively brushing, update the selection
  if (enhancedBrushService.isBrushActive()) {
    await enhancedBrushService.updateBrush({ x, y }, dentalModel.value);
  }
}

async function handleBrushMouseUp(_event: MouseEvent) {
  if (
    currentMode.value !== "brush" ||
    !enhancedBrushService ||
    !enhancedBrushService.isBrushActive()
  )
    return;

  const result = await enhancedBrushService.finishBrush(dentalModel.value!);

  if (result) {
    handleBrushOperationResult(result);
  }
}

function handleBrushOperationResult(result: BrushOperationResult) {
  switch (result.mode) {
    case "create":
      handleBrushCreateSegment(result.selectedVertices);
      break;
    case "select":
      handleBrushSelectSegments(result.affectedSegments);
      break;
    case "add":
      handleBrushAddToSegment(result.selectedVertices, result.targetSegmentId);
      break;
    case "subtract":
      handleBrushSubtractFromSegment(result.selectedVertices, result.targetSegmentId);
      break;
  }
}

async function handleBrushCreateSegment(selectedVertices: number[]) {
  if (!dentalModel.value?.originalMesh || selectedVertices.length === 0) {
    toastService.error(
      "No Vertices Found",
      "No vertices found in brush area."
    );
    return;
  }

  try {
    threeJSManager.isLoading.value = true;
    threeJSManager.loadingMessage.value = "Creating segment with brush...";

    const newSegment = await geometryManipulation.createSegmentFromVertices(
      selectedVertices,
      dentalModel.value.originalMesh,
      dentalModel.value,
      THREE
    );

    if (newSegment) {
      dentalModel.value.segments.push(newSegment);
      const scene = threeJSManager.getScene();
      if (scene) {
        scene.add(newSegment.mesh);
      }
      dentalModel.value = { ...dentalModel.value };

      // Keep original mesh visible for more segmentations
      dentalModel.value.originalMesh.visible = true;
      if (scene && !scene.children.includes(dentalModel.value.originalMesh)) {
        scene.add(dentalModel.value.originalMesh);
      }

      // Select the new segment
      segmentManager.selectedSegments.value.forEach((segment) => {
        segment.isSelected = false;
        segmentManager.updateSegmentAppearance(segment);
      });
      segmentManager.selectedSegments.value = [newSegment];
      newSegment.isSelected = true;
      segmentManager.updateSegmentAppearance(newSegment);

      // Segment created successfully
    }
  } catch (error) {
    console.error("Error creating segment with brush:", error);
    toastService.error(
      "Segment Creation Failed",
      "Error creating segment. Try painting a smaller area."
    );
  } finally {
    threeJSManager.isLoading.value = false;
    threeJSManager.loadingMessage.value = "";
  }
}

function handleBrushSelectSegments(segments: any[]) {
  // Clear current selection
  segmentManager.selectedSegments.value.forEach((segment) => {
    segment.isSelected = false;
    segmentManager.updateSegmentAppearance(segment);
  });

  // Select the brushed segments
  segmentManager.selectedSegments.value = segments;
  segments.forEach((segment) => {
    segment.isSelected = true;
    segmentManager.updateSegmentAppearance(segment);
  });

  // Segments selected via brush
}

function handleBrushAddToSegment(
  selectedVertices: number[],
  targetSegmentId?: string
) {
  if (!targetSegmentId || selectedVertices.length === 0) {
    toastService.warning(
      "No Segment Selected",
      "Please select a segment first to add vertices to it."
    );
    return;
  }

  const targetSegment = dentalModel.value?.segments.find(
    (s) => s.id === targetSegmentId
  );
  if (!targetSegment) {
    toastService.error("Segment Not Found", "Target segment not found.");
    return;
  }

  geometryManipulation.addVerticesToSegment(
    targetSegment,
    selectedVertices,
    dentalModel.value?.originalMesh,
    THREE
  );
  
  // Vertices added to segment
}

function handleBrushSubtractFromSegment(
  selectedVertices: number[],
  targetSegmentId?: string
) {
  if (!targetSegmentId || selectedVertices.length === 0) {
    toastService.warning(
      "No Segment Selected",
      "Please select a segment first to remove vertices from it."
    );
    return;
  }

  const targetSegment = dentalModel.value?.segments.find(
    (s) => s.id === targetSegmentId
  );
  if (!targetSegment) {
    toastService.error("Segment Not Found", "Target segment not found.");
    return;
  }

  geometryManipulation.removeVerticesFromSegment(
    targetSegment,
    selectedVertices,
    dentalModel.value?.originalMesh,
    THREE
  );
  
  // Vertices removed from segment
}
</script>

<style scoped>
.dental-viewer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #ffffff;
  color: #f1f5f9;
  font-family: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont,
    sans-serif;
  overflow: hidden;
  position: relative;
}

.dental-viewer::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px; /* Only cover the header area */
  background: radial-gradient(
      circle at 15% 85%,
      rgba(81, 202, 205, 0.2) 0%,
      transparent 60%
    ),
    radial-gradient(
      circle at 85% 15%,
      rgba(81, 202, 205, 0.15) 0%,
      transparent 55%
    ),
    radial-gradient(
      circle at 50% 50%,
      rgba(81, 202, 205, 0.08) 0%,
      transparent 70%
    ),
    radial-gradient(
      circle at 25% 25%,
      rgba(65, 67, 67, 0.9) 0%,
      transparent 45%
    ),
    radial-gradient(
      circle at 75% 75%,
      rgba(45, 47, 47, 0.8) 0%,
      transparent 50%
    ),
    linear-gradient(
      135deg,
      #2a2c2c 0%,
      #1a1c1c 20%,
      #252727 40%,
      #1e2020 60%,
      #2a2c2c 80%,
      #1a1c1c 100%
    );
  animation: backgroundShift 25s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

.dental-viewer::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px; /* Only cover the header area */
  background-image: linear-gradient(
      45deg,
      transparent 40%,
      rgba(81, 202, 205, 0.03) 50%,
      transparent 60%
    ),
    linear-gradient(
      -45deg,
      transparent 40%,
      rgba(81, 202, 205, 0.02) 50%,
      transparent 60%
    );
  background-size: 80px 80px;
  animation: patternMove 35s linear infinite;
  pointer-events: none;
  z-index: 0;
}

@keyframes backgroundShift {
  0%,
  100% {
    transform: translateX(0) translateY(0) scale(1);
    opacity: 1;
  }
  25% {
    transform: translateX(-15px) translateY(-8px) scale(1.02);
    opacity: 0.8;
  }
  50% {
    transform: translateX(8px) translateY(-15px) scale(0.98);
    opacity: 0.9;
  }
  75% {
    transform: translateX(-8px) translateY(12px) scale(1.01);
    opacity: 0.85;
  }
}

@keyframes patternMove {
  0% {
    background-position: 0 0, 0 0;
  }
  100% {
    background-position: 80px 80px, -80px -80px;
  }
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  height: calc(100vh - 64px); /* Account for header height */
  background: #ffffff;
  position: relative;
  z-index: 1;
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
  display: flex;
  flex-direction: column;
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

.user-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: white;
  padding: 10px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.2);
}

.logout-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
  transition: left 0.6s ease;
}

.logout-btn:hover::before {
  left: 100%;
}

.logout-btn:hover {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  border-color: rgba(239, 68, 68, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
}

/* Intersection Detection Progress */
.intersection-progress {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1001;
  background: linear-gradient(
    135deg,
    rgba(65, 67, 67, 0.98) 0%,
    rgba(55, 57, 57, 0.95) 50%,
    rgba(45, 47, 47, 0.92) 100%
  );
  backdrop-filter: blur(16px);
  border: 1px solid rgba(81, 202, 205, 0.4);
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(81, 202, 205, 0.2);
  min-width: 350px;
}

.progress-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.progress-bar {
  width: 100%;
  height: 12px;
  background: linear-gradient(
    135deg,
    rgba(45, 47, 47, 0.8) 0%,
    rgba(35, 37, 37, 0.6) 100%
  );
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(81, 202, 205, 0.2);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #51cacd 0%, #4ab8bb 50%, #3fa4a7 100%);
  border-radius: 8px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 0 12px rgba(81, 202, 205, 0.4);
}

.progress-fill::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

.progress-text {
  color: #f1f5f9;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
}

/* Brush Settings Panel */
.brush-settings-panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
  animation: slideInUp 0.3s ease-out;
}

@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
