<template>
  <div class="dental-viewer">
    <TopToolbar
      :dentalModel="dentalModel"
      :selectedSegments="segmentManager.selectedSegments.value"
      :currentMode="currentMode"
      :isLoading="threeJSManager.isLoading.value"
      :interactionModes="interactionModes"
      @fileUpload="handleFileUpload"
      @setInteractionMode="setInteractionMode"
      @setLassoMode="setLassoMode"
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
        :selectedSegments="segmentManager.selectedSegments.value"
        :currentTreatmentPlan="currentTreatmentPlan"
        @toggleOriginalMesh="toggleOriginalMesh"
        @toggleAllSegments="toggleAllSegments"
        @toggleSegmentSelection="segmentManager.toggleSegmentSelection"
        @changeSegmentColor="segmentManager.changeSegmentColor"
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
  watch,
  computed,
} from "vue";
import { useThreeJS } from "../composables/useThreeJS";
import { useThreeJSManager } from "../composables/useThreeJSManager";
import { useSegmentManager } from "../composables/useSegmentManager";
import { useCameraControls } from "../composables/useCameraControls";
import { useDirectionalMovement } from "../composables/useDirectionalMovement";
import { useGeometryManipulation } from "../composables/useGeometryManipulation";
import { FileHandlerService } from "../services/FileHandlerService";
import { SegmentationService } from "../services/SegmentationService";
import type {
  DentalModel,
  InteractionMode,
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
const { loadThreeJS, loadServices } = useThreeJS();

// Initialize composables
const threeJSManager = useThreeJSManager();
const segmentManager = useSegmentManager();
const cameraControls = useCameraControls();
const directionalMovement = useDirectionalMovement();
const geometryManipulation = useGeometryManipulation();

// Refs
const viewportRef = ref<typeof ViewportArea>();

// Canvas container reference
const canvasContainer = computed(
  () => viewportRef.value?.canvasContainer as HTMLDivElement
);

// Services - will be initialized after lazy loading
let fileHandlerService: FileHandlerService | null = null;
let segmentationService: SegmentationService | null = null;
let enhancedLassoService: EnhancedLassoService | null = null;
let THREE: any = null;

// Enhanced Lasso state
const currentLassoMode = ref<LassoMode>('create');
const previewEnabled = ref(false);
const hasPreviewSelection = ref(false);

// Reactive state
const dentalModel = shallowRef<DentalModel | null>(null);
const currentMode = ref<InteractionMode["mode"]>("lasso");
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

onMounted(async () => {
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
      GLTFLoaderService: GLTFLoader
    } = await loadServices();

    // Add BVH extensions to THREE.js
    THREE.BufferGeometry.prototype.computeBoundsTree = BVH.computeBoundsTree;
    THREE.BufferGeometry.prototype.disposeBoundsTree = BVH.disposeBoundsTree;
    THREE.Mesh.prototype.raycast = BVH.acceleratedRaycast;

    // Initialize Three.js scene
    const threeJSResult = threeJSManager.initThreeJS(canvasContainer.value!, THREE);
    if (!threeJSResult) {
      throw new Error('Failed to initialize Three.js');
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
    
    // Initialize the real segmentation service with backend connection
    console.log("🔧 Initializing segmentation service...");
    const { BackendService } = await import("../services/BackendService");
    const backendService = new BackendService('http://localhost:8000', THREE);
    segmentationService = new SegmentationService(backendService, scene, THREE);
    console.log("✅ Segmentation service initialized:", !!segmentationService);

    // Setup event listeners
    if (renderer?.domElement) {
      // Create lasso handlers object
      const lassoHandlers = {
        handleLassoMouseDown,
        handleLassoMouseMove,
        handleLassoMouseUp
      };
      
      cameraControls.setupEventListeners(renderer.domElement, camera, renderer, currentMode, THREE, lassoHandlers);
      threeJSManager.setupResizeObserver(canvasContainer.value!);
    }

    // Initialize Enhanced Lasso Service
    await initializeEnhancedLasso(renderer, camera, scene);

    threeJSManager.isLoading.value = false;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    threeJSManager.loadingMessage.value = "Failed to load 3D engine";
  }
}

// Watch for mode changes to update canvas cursor
watch(currentMode, (newMode) => {
  const renderer = threeJSManager.getRenderer();
  if (renderer && renderer.domElement) {
    renderer.domElement.setAttribute("data-mode", newMode);
  }
});

onUnmounted(() => {
  directionalMovement.cleanup();
  cameraControls.cleanup();
  threeJSManager.cleanup();
});

async function initializeEnhancedLasso(renderer: any, camera: any, scene: any) {
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

// File handling
async function handleFileUpload(event: Event, autoSegment: boolean = false) {
  console.log("📁 handleFileUpload called with autoSegment:", autoSegment);
  console.log("📁 Event type:", event.type, "Event target:", event.target);
  if (!fileHandlerService) {
    console.error("❌ fileHandlerService is not initialized");
    return;
  }

  const onLoadStart = () => {
    threeJSManager.isLoading.value = true;
    threeJSManager.loadingMessage.value = "Loading 3D model...";
  };

  const onLoadComplete = (model: DentalModel) => {
    dentalModel.value = model;
    threeJSManager.focusOnModel(model);
    threeJSManager.isLoading.value = false;
    threeJSManager.loadingMessage.value = "Model loaded successfully";
  };

  const onError = (error: Error) => {
    alert(error.message);
    threeJSManager.isLoading.value = false;
    threeJSManager.loadingMessage.value = "";
  };

  const startBackgroundAISegmentation = async (file: File) => {
    console.log("🤖 startBackgroundAISegmentation called with file:", file.name);
    if (!segmentationService) {
      console.error("❌ segmentationService is not initialized");
      return;
    }
    if (!dentalModel.value) {
      console.error("❌ dentalModel is not loaded");
      return;
    }
    
    await segmentationService.startBackgroundAISegmentation(
      file,
      dentalModel.value,
      (status) => {
        backgroundSegmentationStatus.value = status;
      },
      (result) => {
        console.log(`✅ Background AI Segmentation completed: ${result.segments.length} teeth found`);
        setTimeout(() => {
          backgroundSegmentationStatus.value.isRunning = false;
          backgroundSegmentationStatus.value.message = "";
          backgroundSegmentationStatus.value.progress = undefined;
          
          threeJSManager.loadingMessage.value = `AI found ${result.segments.length} teeth!`;
          setTimeout(() => {
            threeJSManager.loadingMessage.value = "";
          }, 3000);
        }, 1000);
      },
      (error) => {
        console.error("Background AI Segmentation failed:", error);
        backgroundSegmentationStatus.value.isRunning = false;
        backgroundSegmentationStatus.value.message = "";
        backgroundSegmentationStatus.value.progress = undefined;
        
        threeJSManager.loadingMessage.value = `AI segmentation failed: ${error.message}`;
        setTimeout(() => {
          threeJSManager.loadingMessage.value = "";
        }, 5000);
      },
      (updatedDentalModel) => {
        // Update the reactive dentalModel ref to trigger Vue reactivity
        dentalModel.value = updatedDentalModel;
        console.log("🔄 Updated dentalModel ref to trigger Vue reactivity and sidebar update");
      }
    );
  };

  console.log("📤 Calling fileHandlerService.handleFileUpload with autoSegment:", autoSegment);
  await fileHandlerService.handleFileUpload(
    event,
    autoSegment,
    onLoadStart,
    onLoadComplete,
    onError,
    startBackgroundAISegmentation
  );

function setInteractionMode(mode: InteractionMode["mode"]) {
  // Clean up any active enhanced lasso selection when changing modes
  if (currentMode.value === "lasso" && enhancedLassoService?.isLassoActive()) {
    enhancedLassoService.cancelLasso();
  }

  currentMode.value = mode;
  console.log(`Interaction mode changed to: ${mode}`);

  // Set appropriate cursor for the new mode
  const renderer = threeJSManager.getRenderer();
  if (renderer?.domElement) {
    const cursorMap = {
      lasso: "crosshair",
      pan: "grab",
    };
    renderer.domElement.style.cursor = cursorMap[mode] || "default";
  }
}

function setViewPreset(view: "top" | "bottom" | "front" | "back" | "left" | "right") {
  if (!dentalModel.value) return;
  threeJSManager.setViewPreset(view, dentalModel.value);
}

// Enhanced Lasso Handlers
function setLassoMode(mode: LassoMode) {
  currentLassoMode.value = mode;
  console.log(`Lasso mode set to: ${mode}`);
}

function confirmSelection() {
  if (!hasPreviewSelection.value) return;
  
  hasPreviewSelection.value = false;
  console.log('Selection confirmed');
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

// Lasso Mouse Event Handlers
function handleLassoMouseDown(event: MouseEvent) {
  if (currentMode.value !== "lasso" || !enhancedLassoService || !dentalModel.value) return;

  // Don't start lasso if modifier keys are held (for rotation)
  if (event.metaKey || event.ctrlKey) return;

  const renderer = threeJSManager.getRenderer();
  if (!renderer) return;

  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  const targetSegmentId = segmentManager.selectedSegments.value.length > 0 
    ? segmentManager.selectedSegments.value[0].id 
    : undefined;

  enhancedLassoService.startLasso(
    currentLassoMode.value,
    { x, y },
    targetSegmentId
  );

  console.log(`Started enhanced lasso selection in ${currentLassoMode.value} mode`);
}

function handleLassoMouseMove(event: MouseEvent) {
  if (currentMode.value !== "lasso" || !enhancedLassoService || !enhancedLassoService.isLassoActive()) return;
  
  const renderer = threeJSManager.getRenderer();
  if (!renderer) return;
  
  const rect = renderer.domElement.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  enhancedLassoService.updateLasso({ x, y });
}

function handleLassoMouseUp(_event: MouseEvent) {
  if (currentMode.value !== "lasso" || !enhancedLassoService || !enhancedLassoService.isLassoActive()) return;
  
  const result = enhancedLassoService.finishLasso(dentalModel.value!);
  
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
    alert("Error creating segment. Try selecting a smaller area.");
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

  geometryManipulation.addVerticesToSegment(targetSegment, selectedVertices, dentalModel.value?.originalMesh, THREE);
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

  geometryManipulation.removeVerticesFromSegment(targetSegment, selectedVertices, dentalModel.value?.originalMesh, THREE);
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
    THREE
  );
}

function stopDirectionalMove() {
  directionalMovement.stopDirectionalMove();
}

// Segment Management Functions
function toggleOriginalMesh() {
  if (!dentalModel.value) return;
  segmentManager.toggleOriginalMesh(dentalModel.value);
}

function toggleAllSegments() {
  if (!dentalModel.value) return;
  segmentManager.toggleAllSegments(dentalModel.value);
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
}

function handleTreatmentPlanFullScreen(isFullScreen: boolean) {
  isTreatmentPlanFullScreen.value = isFullScreen;
  console.log('Treatment plan full screen:', isFullScreen);
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
