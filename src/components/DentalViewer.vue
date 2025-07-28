<template>
  <div class="dental-viewer">
    <!-- Top Toolbar -->
    <div class="top-toolbar">
      <div class="toolbar-section">
        <div class="app-title">
          <span class="app-icon">🦷</span>
          <span>DentalViewer Pro</span>
        </div>
      </div>
      
      <div class="toolbar-section toolbar-center">
        <div class="file-controls">
          <input 
            ref="fileInput" 
            type="file" 
            accept=".stl" 
            @change="handleFileUpload"
            style="display: none"
          />
          <button @click="triggerFileUpload" :disabled="isLoading" class="toolbar-btn primary">
            <span class="btn-icon">📁</span>
            Load STL
          </button>
          <button @click="exportModel" :disabled="!dentalModel || isLoading" class="toolbar-btn">
            <span class="btn-icon">💾</span>
            Export
          </button>
        </div>
        
        <div class="view-controls" v-if="dentalModel">
          <button 
            v-for="mode in interactionModes" 
            :key="mode"
            @click="setInteractionMode(mode)"
            :class="{ active: currentMode === mode, disabled: isInteractionModeDisabled(mode) }"
            class="toolbar-btn mode-btn"
            :title="getInteractionModeTitle(mode)"
            :disabled="isInteractionModeDisabled(mode)"
          >
            <span class="btn-icon">{{ getModeIcon(mode) }}</span>
          </button>
        </div>
      </div>
      
      <div class="toolbar-section">
        <div class="status-info">
          <span v-if="dentalModel?.segments.length" class="segment-count">
            {{ dentalModel.segments.length }} segments
          </span>
          <span v-if="selectedSegments.length" class="selected-count">
            {{ selectedSegments.length }} selected
          </span>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="main-content">
      <!-- Left Sidebar -->
      <div class="left-sidebar">
        <!-- Manual Segmentation Info -->
        <div class="panel" v-if="dentalModel && dentalModel.segments.length === 0">
          <div class="panel-header">
            <span class="panel-icon">✋</span>
            <span class="panel-title">Manual Segmentation</span>
          </div>
          <div class="panel-content">
            <div class="info-text">
              <p>Use the <strong>Lasso Tool</strong> to create segments manually:</p>
              <ol>
                <li>Select the lasso tool (⭕) from the toolbar</li>
                <li>Draw around the area you want to segment</li>
                <li>A new segment will be created automatically</li>
                <li>The original model will remain visible</li>
                <li><strong>Repeat to create as many segments as needed!</strong></li>
              </ol>
              <div class="performance-tips">
                <p><strong>⚡ Tips:</strong></p>
                <ul>
                  <li>Each lasso creates a new segment from the original mesh</li>
                  <li>You can create overlapping segments if needed</li>
                  <li>Use smaller lasso areas for faster processing</li>
                  <li>Zoom in closer to select specific regions</li>
                </ul>
              </div>
              <p><em>Create as many segments as you need - each lasso creates a new one!</em></p>
            </div>
          </div>
        </div>

        <!-- Visibility Controls -->
        <div class="panel" v-if="dentalModel && dentalModel.segments.length > 0">
          <div class="panel-header">
            <span class="panel-icon">👁️</span>
            <span class="panel-title">Visibility</span>
          </div>
          <div class="panel-content">
            <button 
              @click="toggleOriginalMesh" 
              class="btn btn-secondary full-width"
              style="margin-bottom: 8px;"
            >
              {{ dentalModel?.originalMesh?.visible ? 'Hide Original Model' : 'Show Original Model' }}
            </button>
            <button 
              @click="toggleAllSegments" 
              class="btn btn-secondary full-width"
            >
              {{ areAllSegmentsVisible() ? 'Hide All Segments' : 'Show All Segments' }}
            </button>
          </div>
        </div>

        <!-- Segment Management -->
        <div class="panel" v-if="dentalModel && dentalModel.segments.length > 0">
          <div class="panel-header">
            <span class="panel-icon">🎨</span>
            <span class="panel-title">All Segments</span>
            <span class="panel-badge">{{ dentalModel.segments.length }}</span>
          </div>
          <div class="panel-content">
            <div class="segment-list">
              <div 
                v-for="segment in dentalModel.segments" 
                :key="segment.id"
                class="segment-item"
                :class="{ selected: segment.isSelected }"
              >
                <div class="segment-header">
                  <div class="segment-info">
                    <span class="segment-checkbox">
                      <input 
                        type="checkbox" 
                        :checked="segment.isSelected"
                        @click.stop="toggleSegmentSelection(segment)"
                      />
                    </span>
                    <span class="segment-name">{{ segment.name }}</span>
                    <span class="segment-type">{{ segment.toothType }}</span>
                  </div>
                  <div class="segment-controls">
                    <input 
                      type="color" 
                      :value="'#' + segment.color.getHexString()"
                      @change="changeSegmentColor(segment, $event)"
                      @click.stop
                      class="color-picker"
                    />
                  </div>
                </div>
                
                <!-- Always show segment controls -->
                <div class="segment-expanded">
                  <div class="segment-actions">
                    <button 
                      class="btn btn-sm btn-secondary" 
                      @click="resetIndividualPosition(segment)"
                      :disabled="!segment.isSelected"
                    >
                      <span>↩️</span> Reset
                    </button>
                    <button 
                      class="btn btn-sm btn-secondary" 
                      @click="toggleSegmentVisibility(segment)"
                    >
                      <span>{{ segment.mesh.visible ? '👁️' : '🙈' }}</span>
                    </button>
                  </div>
                  
                  <!-- Individual movement info -->
                  <div v-if="segment.movementHistory && segment.movementHistory.totalDistance > 0" class="individual-movement-info">
                    <div class="movement-summary">
                      <div class="movement-distance">
                        <span class="distance-label">Total Movement:</span>
                        <span class="distance-value">{{ segment.movementHistory.totalDistance.toFixed(2) }} mm</span>
                      </div>
                    </div>
                    
                    <!-- Axis breakdown -->
                    <div class="axis-breakdown">
                      <div class="axis-movement-item">
                        <span class="axis-label">Anteroposterior:</span>
                        <span class="axis-value" :class="{ positive: segment.movementHistory.axisMovements.anteroposterior > 0, negative: segment.movementHistory.axisMovements.anteroposterior < 0 }">
                          {{ segment.movementHistory.axisMovements.anteroposterior > 0 ? '+' : '' }}{{ segment.movementHistory.axisMovements.anteroposterior.toFixed(2) }} mm
                        </span>
                      </div>
                      <div class="axis-movement-item">
                        <span class="axis-label">Vertical:</span>
                        <span class="axis-value" :class="{ positive: segment.movementHistory.axisMovements.vertical > 0, negative: segment.movementHistory.axisMovements.vertical < 0 }">
                          {{ segment.movementHistory.axisMovements.vertical > 0 ? '+' : '' }}{{ segment.movementHistory.axisMovements.vertical.toFixed(2) }} mm
                        </span>
                      </div>
                      <div class="axis-movement-item">
                        <span class="axis-label">Transverse:</span>
                        <span class="axis-value" :class="{ positive: segment.movementHistory.axisMovements.transverse > 0, negative: segment.movementHistory.axisMovements.transverse < 0 }">
                          {{ segment.movementHistory.axisMovements.transverse > 0 ? '+' : '' }}{{ segment.movementHistory.axisMovements.transverse.toFixed(2) }} mm
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Movement Controls -->
            <div class="movement-controls" v-if="selectedSegments.length > 0">
              <div class="movement-header">
                <span class="movement-icon">🎯</span>
                <span class="movement-title">Movement</span>
              </div>
              
              <!-- Movement Toggle -->
              <div class="movement-buttons">
                <button 
                  v-if="!isMovingSegment" 
                  @click="startMovementMode" 
                  class="btn btn-secondary movement-btn"
                >
                  <span>🎯</span> Enable Movement
                </button>
                <button 
                  v-else 
                  @click="disableMovementMode" 
                  class="btn btn-secondary movement-btn"
                >
                  <span>⏹️</span> Disable Movement
                </button>
                <button 
                  @click="resetSegmentPosition" 
                  :disabled="totalMovementDistance === 0"
                  class="btn btn-secondary movement-btn"
                >
                  <span>↩️</span> Reset
                </button>
              </div>
              
              <!-- Directional Controls -->
              <div v-if="isMovingSegment" class="direction-controls">
                <div class="axis-control-group">
                  <div class="axis-label">Anteroposterior</div>
                  <div class="axis-buttons">
                    <button 
                      class="direction-btn" 
                      @mousedown="startDirectionalMove('Anteroposterior', -1)" 
                      @mouseup="stopDirectionalMove" 
                      @mouseleave="stopDirectionalMove"
                    >← Post</button>
                    <button 
                      class="direction-btn" 
                      @mousedown="startDirectionalMove('Anteroposterior', 1)" 
                      @mouseup="stopDirectionalMove" 
                      @mouseleave="stopDirectionalMove"
                    >Ant →</button>
                  </div>
                </div>
                
                <div class="axis-control-group">
                  <div class="axis-label">Vertical</div>
                  <div class="axis-buttons">
                    <button 
                      class="direction-btn" 
                      @mousedown="startDirectionalMove('Vertical', -1)" 
                      @mouseup="stopDirectionalMove" 
                      @mouseleave="stopDirectionalMove"
                    >↓ Inf</button>
                    <button 
                      class="direction-btn" 
                      @mousedown="startDirectionalMove('Vertical', 1)" 
                      @mouseup="stopDirectionalMove" 
                      @mouseleave="stopDirectionalMove"
                    >Sup ↑</button>
                  </div>
                </div>
                
                <div class="axis-control-group">
                  <div class="axis-label">Transverse</div>
                  <div class="axis-buttons">
                    <button 
                      class="direction-btn" 
                      @mousedown="startDirectionalMove('Transverse', -1)" 
                      @mouseup="stopDirectionalMove" 
                      @mouseleave="stopDirectionalMove"
                    >← Left</button>
                    <button 
                      class="direction-btn" 
                      @mousedown="startDirectionalMove('Transverse', 1)" 
                      @mouseup="stopDirectionalMove" 
                      @mouseleave="stopDirectionalMove"
                    >Right →</button>
                  </div>
                </div>
              </div>
              
              <!-- Movement Display -->
              <div v-if="totalMovementDistance > 0" class="movement-display">
                <div class="total-distance">
                  Total: {{ totalMovementDistance.toFixed(1) }} mm
                </div>
              </div>
            </div>
            
            <div class="action-buttons">
              <button @click="mergeSelectedSegments" class="btn btn-secondary" :disabled="selectedSegments.length < 2">
                Merge
              </button>
              <button @click="splitSelectedSegment" class="btn btn-secondary" :disabled="selectedSegments.length !== 1">
                Split
              </button>
              <button @click="deleteSelectedSegments" class="btn btn-danger">
                Delete
              </button>
            </div>
          </div>
        </div>

        <!-- Model Information -->
        <div class="panel" v-if="dentalModel">
          <div class="panel-header">
            <span class="panel-icon">📊</span>
            <span class="panel-title">Model Info</span>
          </div>
          <div class="panel-content">
            <div class="info-item">
              <span class="info-label">Total Segments:</span>
              <span class="info-value">{{ dentalModel.segments.length }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Selected:</span>
              <span class="info-value">{{ selectedSegments.length }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Method:</span>
              <span class="info-value">Manual</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3D Viewport -->
      <div class="viewport">
        <div ref="canvasContainer" class="canvas-container">
          <!-- Loading overlay -->
          <div v-if="isLoading" class="loading-overlay">
            <div class="loading-spinner"></div>
            <div class="loading-text">{{ loadingMessage }}</div>
          </div>
          
          <!-- Viewport Controls -->
          <div class="viewport-controls">
          <div class="viewport-info">
            <span v-if="currentMode !== 'select'" class="current-mode">
              {{ getModeIcon(currentMode) }} {{ currentMode.toUpperCase() }}
            </span>
            <span v-if="dentalModel && dentalModel.segments.length === 0 && currentMode === 'lasso'" class="mode-hint">
              Draw to create segments manually
            </span>
            <span v-if="dentalModel && dentalModel.segments.length === 0 && (currentMode === 'merge' || currentMode === 'split')" class="mode-hint">
              Create segments first
            </span>
          </div>            <div class="camera-controls">
              <button class="control-btn" @click="resetCamera" title="Reset View">
                <span>🏠</span>
              </button>
              <button class="control-btn" @click="fitToScreen" title="Fit to Screen">
                <span>🔍</span>
              </button>
            </div>
          </div>
          
          <!-- View Preset Controls -->
          <div class="view-presets" v-if="dentalModel">
            <div class="view-presets-title">Views</div>
            <div class="view-presets-grid">
              <button class="preset-btn" @click="setViewPreset('top')" title="Top View">
                <span>⬆️</span>
              </button>
              <button class="preset-btn" @click="setViewPreset('bottom')" title="Bottom View">
                <span>⬇️</span>
              </button>
              <button class="preset-btn" @click="setViewPreset('front')" title="Front View">
                <span>👁️</span>
              </button>
              <button class="preset-btn" @click="setViewPreset('back')" title="Back View">
                <span>👁️‍🗨️</span>
              </button>
              <button class="preset-btn" @click="setViewPreset('left')" title="Left View">
                <span>⬅️</span>
              </button>
              <button class="preset-btn" @click="setViewPreset('right')" title="Right View">
                <span>➡️</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template><script setup lang="ts">
import { ref, onMounted, onUnmounted, shallowRef, markRaw, watch } from 'vue'
import * as THREE from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { STLLoaderService } from '../services/STLLoader'
import type { DentalModel, ToothSegment, InteractionMode } from '../types/dental'

// Add BVH extensions to THREE.js
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
THREE.Mesh.prototype.raycast = acceleratedRaycast

// Refs
const canvasContainer = ref<HTMLDivElement>()
const fileInput = ref<HTMLInputElement>()

// Services
const stlLoader = new STLLoaderService()

// Reactive state
const dentalModel = shallowRef<DentalModel | null>(null)
const selectedSegments = ref<ToothSegment[]>([])
const currentMode = ref<InteractionMode['mode']>('select')
const isLoading = ref(false)
const loadingMessage = ref('')
const totalMovementDistance = ref(0)
const movementAxis = ref<'Anteroposterior' | 'Vertical' | 'Transverse' | 'Combined' | 'None'>('None')
const axisMovementDistances = ref({
  anteroposterior: 0, // Front-back (Z-axis in 3D space)
  vertical: 0,        // Up-down (Y-axis in 3D space)
  transverse: 0       // Side-side (X-axis in 3D space)
})

const interactionModes: InteractionMode['mode'][] = [
  'select', 'lasso', 'brush', 'move', 'rotate', 'merge', 'split'
]

// Three.js objects
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let raycaster: THREE.Raycaster
let mouse: THREE.Vector2
let resizeObserver: ResizeObserver | null = null

// Interaction state
let isDragging = false
let isLassoActive = false
let isPanning = false
let isMovingSegment = false
let movementStartPosition = new THREE.Vector3()
let lastMousePosition = new THREE.Vector2()
let lassoPoints: THREE.Vector2[] = []
let lassoPath: SVGPathElement | null = null
let movementStartMousePosition = new THREE.Vector2()
let constrainedAxis: 'Anteroposterior' | 'Vertical' | 'Transverse' | null = null
let directionalMoveInterval: number | null = null
let isDirectionalMoving = false

onMounted(() => {
  initThreeJS()
  setupEventListeners()
})

// Watch for mode changes to update canvas cursor
watch(currentMode, (newMode) => {
  if (renderer && renderer.domElement) {
    renderer.domElement.setAttribute('data-mode', newMode)
  }
})

onUnmounted(() => {
  // Stop any ongoing directional movement
  stopDirectionalMove()
  cleanup()
})

function initThreeJS() {
  if (!canvasContainer.value) return
  
  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)
  
  // Get container dimensions
  const containerWidth = canvasContainer.value.clientWidth
  const containerHeight = canvasContainer.value.clientHeight
  
  console.log('Container dimensions:', containerWidth, 'x', containerHeight)
  
  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    containerWidth / containerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 0, 50)
  
  // Ensure camera matrices are properly initialized
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(containerWidth, containerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  
  // Ensure canvas fills container
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  
  canvasContainer.value.appendChild(renderer.domElement)
  
  // Set initial canvas mode attribute
  renderer.domElement.setAttribute('data-mode', currentMode.value)
  
  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(50, 50, 50)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)
  
  const pointLight = new THREE.PointLight(0xffffff, 0.5)
  pointLight.position.set(-50, -50, 50)
  scene.add(pointLight)
  
  // Raycaster for picking
  raycaster = new THREE.Raycaster()
  mouse = new THREE.Vector2()
  
  // Start render loop
  animate()
}

function setupEventListeners() {
  if (!canvasContainer.value) return
  
  const canvas = renderer.domElement
  
  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('click', onClick)
  canvas.addEventListener('wheel', onWheel)
  
  // Add keyboard listeners for modifier keys
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', onWindowResize)
  
  // Setup ResizeObserver to handle container size changes
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === canvasContainer.value) {
          onWindowResize()
        }
      }
    })
    resizeObserver.observe(canvasContainer.value)
  }
}

function onMouseDown(event: MouseEvent) {
  isDragging = true
  updateMousePosition(event)
  
  // Store initial mouse position for rotation and movement
  lastMousePosition.set(event.clientX, event.clientY)
  
  // Check if Cmd (Mac) or Ctrl (Windows/Linux) is held for rotation
  const isRotationRequested = event.metaKey || event.ctrlKey
  
  if (isRotationRequested) {
    isPanning = true // Keep variable name for compatibility but use for rotation
    // Change cursor to indicate rotation mode
    if (renderer?.domElement) {
      renderer.domElement.style.cursor = 'grabbing'
    }
  } else if (isMovingSegment && selectedSegments.value.length > 0) {
    // Start 3D movement of segments
    movementStartMousePosition.set(event.clientX, event.clientY)
    constrainedAxis = null // Reset axis constraint
    movementAxis.value = 'None'
    axisMovementDistances.value = { anteroposterior: 0, vertical: 0, transverse: 0 }
    console.log('Starting 3D segment movement')
  } else if (currentMode.value === 'lasso') {
    // Start lasso selection if in lasso mode and not rotating
    startLassoSelection(event)
  }
}

function onMouseMove(event: MouseEvent) {
  updateMousePosition(event)
  
  if (isDragging) {
    if (isPanning) {
      // Rotate the camera/model with modifier key
      rotateWithModifier(event)
    } else if (isMovingSegment && selectedSegments.value.length > 0) {
      // Move selected segments in 3D space
      moveSegmentsIn3D(event)
    } else if (currentMode.value === 'lasso') {
      updateLassoSelection(event)
    } else if (currentMode.value === 'rotate') {
      // Implement rotation logic for selected segments
      rotateCamera(event)
    } else if (currentMode.value === 'move') {
      // Implement movement logic for selected segments
      moveSelectedSegments(event)
    }
  }
  
  // Update cursor based on modifier keys (even when not dragging)
  if (renderer?.domElement) {
    if (event.metaKey || event.ctrlKey) {
      renderer.domElement.style.cursor = 'grab'
    } else if (isMovingSegment) {
      renderer.domElement.style.cursor = 'move'
    } else {
      // Reset cursor based on current mode
      const cursorMap = {
        lasso: 'crosshair',
        select: 'pointer',
        rotate: 'grab',
        move: 'move',
        brush: 'crosshair',
        merge: 'pointer',
        split: 'pointer'
      }
      renderer.domElement.style.cursor = cursorMap[currentMode.value] || 'default'
    }
  }
}

function onMouseUp(event: MouseEvent) {
  if (isDragging && currentMode.value === 'lasso' && isLassoActive) {
    finalizeLassoSelection(event)
  }
  
  // Reset rotation state and cursor
  if (isPanning) {
    isPanning = false
    if (renderer?.domElement) {
      renderer.domElement.style.cursor = 'grab' // Keep grab cursor if modifier still held
    }
  }
  
  // End segment movement
  if (isMovingSegment && isDragging) {
    console.log(`Finished moving segments. Total distance: ${totalMovementDistance.value.toFixed(2)}mm`)
  }
  
  isDragging = false
}

function onClick(event: MouseEvent) {
  updateMousePosition(event)
  
  if (currentMode.value === 'select') {
    selectSegment()
  } else if (currentMode.value === 'lasso') {
    // Implement lasso selection
  }
}

function onWheel(event: WheelEvent) {
  event.preventDefault() // Prevent page scroll
  
  // Detect touchpad vs mouse wheel for different sensitivities
  const isTouchpad = Math.abs(event.deltaY) < 100 && event.deltaY % 1 !== 0
  
  // Increased sensitivity for better accuracy and control
  const zoomSensitivity = isTouchpad ? 0.015 : 0.05
  
  // REVERSED: Positive deltaY now zooms IN (closer), negative zooms OUT (farther)
  let zoomDelta = event.deltaY * zoomSensitivity
  
  // Increased range for better accuracy
  zoomDelta = Math.max(-0.2, Math.min(0.2, zoomDelta))
  
  const zoomFactor = 1 + zoomDelta
  
  // Get current distance from origin
  const currentDistance = camera.position.length()
  
  // Apply zoom with limits to prevent getting too close or too far
  const minDistance = 2 // Closer minimum for better detail inspection
  const maxDistance = 800 // Farther maximum for overview
  const newDistance = currentDistance * zoomFactor
  
  // Only zoom if within reasonable bounds
  if (newDistance >= minDistance && newDistance <= maxDistance) {
    // More responsive interpolation for better accuracy
    const targetPosition = camera.position.clone().multiplyScalar(zoomFactor)
    
    // Increased lerp factor for more immediate response
    camera.position.lerp(targetPosition, 0.9)
    camera.updateMatrixWorld()
  }
}

function onWindowResize() {
  if (!canvasContainer.value || !camera || !renderer) return
  
  const containerWidth = canvasContainer.value.clientWidth
  const containerHeight = canvasContainer.value.clientHeight
  
  console.log('Resizing to:', containerWidth, 'x', containerHeight)
  
  camera.aspect = containerWidth / containerHeight
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  
  renderer.setSize(containerWidth, containerHeight)
  
  // Ensure canvas still fills container after resize
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
}

function onKeyDown(event: KeyboardEvent) {
  // Update cursor when modifier keys are pressed
  if ((event.metaKey || event.ctrlKey) && renderer?.domElement && !isDragging) {
    renderer.domElement.style.cursor = 'grab'
  }
}

function onKeyUp(event: KeyboardEvent) {
  // Reset cursor when modifier keys are released
  if ((!event.metaKey && !event.ctrlKey) && renderer?.domElement && !isDragging) {
    // Reset cursor based on current mode
    const cursorMap = {
      lasso: 'crosshair',
      select: 'pointer',
      rotate: 'grab',
      move: 'move',
      brush: 'crosshair',
      merge: 'pointer',
      split: 'pointer'
    }
    renderer.domElement.style.cursor = cursorMap[currentMode.value] || 'default'
  }
}

function updateMousePosition(event: MouseEvent) {
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
}

function selectSegment() {
  if (!dentalModel.value) return
  
  raycaster.setFromCamera(mouse, camera)
  
  const meshes = dentalModel.value.segments.map(segment => segment.mesh)
  const intersects = raycaster.intersectObjects(meshes)
  
  if (intersects.length > 0) {
    const intersectedMesh = intersects[0].object as THREE.Mesh
    const segment = dentalModel.value.segments.find(s => s.mesh === intersectedMesh)
    
    if (segment) {
      toggleSegmentSelection(segment)
    }
  }
}

function toggleSegmentSelection(segment: ToothSegment) {
  const index = selectedSegments.value.findIndex(s => s.id === segment.id)
  
  if (index >= 0) {
    // Deselect
    selectedSegments.value.splice(index, 1)
    segment.isSelected = false
    updateSegmentAppearance(segment)
  } else {
    // Select
    selectedSegments.value.push(segment)
    segment.isSelected = true
    updateSegmentAppearance(segment)
  }
}

function updateSegmentAppearance(segment: ToothSegment) {
  const material = segment.mesh.material as THREE.MeshLambertMaterial
  
  if (segment.isSelected) {
    material.emissive.setHex(0x444444)
    material.transparent = true
    material.opacity = 0.8
  } else {
    material.emissive.setHex(0x000000)
    material.transparent = false
    material.opacity = 1.0
  }
}

function rotateCamera(event: MouseEvent) {
  // Simple orbit camera rotation
  const deltaX = event.movementX * 0.01
  const deltaY = event.movementY * 0.01
  
  const spherical = new THREE.Spherical()
  spherical.setFromVector3(camera.position)
  spherical.theta -= deltaX
  spherical.phi += deltaY
  spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi))
  
  camera.position.setFromSpherical(spherical)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
}

function rotateWithModifier(event: MouseEvent) {
  // Calculate mouse movement delta
  const currentMousePosition = new THREE.Vector2(event.clientX, event.clientY)
  const deltaX = currentMousePosition.x - lastMousePosition.x
  const deltaY = currentMousePosition.y - lastMousePosition.y
  
  // Update last mouse position
  lastMousePosition.copy(currentMousePosition)
  
  // Convert mouse movement to rotation angles
  const rotationSpeed = 0.005
  const deltaTheta = -deltaX * rotationSpeed
  const deltaPhi = deltaY * rotationSpeed
  
  // Use spherical coordinates for smooth orbital rotation
  const spherical = new THREE.Spherical()
  spherical.setFromVector3(camera.position)
  
  // Apply rotation deltas
  spherical.theta += deltaTheta
  spherical.phi += deltaPhi
  
  // Clamp phi to prevent flipping
  spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi))
  
  // Update camera position
  camera.position.setFromSpherical(spherical)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld()
}

function moveSelectedSegments(event: MouseEvent) {
  if (selectedSegments.value.length === 0) return
  
  const deltaX = event.movementX * 0.1
  const deltaY = -event.movementY * 0.1
  
  selectedSegments.value.forEach(segment => {
    segment.mesh.position.x += deltaX
    segment.mesh.position.y += deltaY
  })
}

function startMovementMode() {
  if (selectedSegments.value.length === 0) return
  
  isMovingSegment = true
  // Store initial position of the first selected segment for distance calculation
  if (selectedSegments.value[0]) {
    movementStartPosition.copy(selectedSegments.value[0].mesh.position)
  }
  
  // Reset movement distance
  totalMovementDistance.value = 0
  
  // Update cursor and mode indicator
  if (renderer?.domElement) {
    renderer.domElement.style.cursor = 'move'
  }
  
  console.log('Started 3D movement mode for', selectedSegments.value.length, 'segments')
}

function moveSegmentsIn3D(event: MouseEvent) {
  if (selectedSegments.value.length === 0) return
  
  // Calculate mouse movement delta
  const currentMousePosition = new THREE.Vector2(event.clientX, event.clientY)
  const deltaX = currentMousePosition.x - lastMousePosition.x
  const deltaY = currentMousePosition.y - lastMousePosition.y
  
  // Update last mouse position
  lastMousePosition.copy(currentMousePosition)
  
  // Calculate total mouse movement from start for axis determination
  const totalDeltaX = currentMousePosition.x - movementStartMousePosition.x
  const totalDeltaY = currentMousePosition.y - movementStartMousePosition.y
  
  // Determine constrained axis if not already set (threshold for axis lock)
  const axisThreshold = 15 // pixels
  if (!constrainedAxis && (Math.abs(totalDeltaX) > axisThreshold || Math.abs(totalDeltaY) > axisThreshold)) {
    const horizontalMovement = Math.abs(totalDeltaX)
    const verticalMovement = Math.abs(totalDeltaY)
    
    // Determine primary axis based on dominant movement direction
    if (horizontalMovement > verticalMovement * 1.5) {
      constrainedAxis = 'Transverse' // Horizontal movement = Transverse (side-to-side)
      movementAxis.value = 'Transverse'
    } else if (verticalMovement > horizontalMovement * 1.5) {
      constrainedAxis = 'Vertical' // Vertical movement = Vertical (up-down)  
      movementAxis.value = 'Vertical'
    } else {
      constrainedAxis = 'Anteroposterior' // Diagonal or mixed = Anteroposterior (front-back)
      movementAxis.value = 'Anteroposterior'
    }
    
    console.log(`Movement constrained to ${constrainedAxis} axis`)
  }
  
  // Get camera's right and up vectors for proper 3D movement
  const cameraDirection = new THREE.Vector3()
  camera.getWorldDirection(cameraDirection)
  
  const cameraRight = new THREE.Vector3()
  cameraRight.crossVectors(camera.up, cameraDirection).normalize()
  
  const cameraUp = new THREE.Vector3()
  cameraUp.crossVectors(cameraDirection, cameraRight).normalize()
  
  // Calculate movement sensitivity based on camera distance
  const distance = camera.position.length()
  const movementSensitivity = distance * 0.001 // Slightly increased for better control
  
  // Calculate movement vector based on constrained axis
  const movementVector = new THREE.Vector3()
  
  if (constrainedAxis === 'Transverse') {
    // Transverse movement (side-to-side, X-axis in 3D space)
    movementVector.addScaledVector(cameraRight, -deltaX * movementSensitivity)
  } else if (constrainedAxis === 'Vertical') {
    // Vertical movement (up-down, Y-axis in 3D space)
    movementVector.addScaledVector(cameraUp, deltaY * movementSensitivity)
  } else if (constrainedAxis === 'Anteroposterior') {
    // Anteroposterior movement (front-back, Z-axis in 3D space)
    const cameraForward = cameraDirection.clone().negate()
    movementVector.addScaledVector(cameraForward, (deltaX + deltaY) * 0.5 * movementSensitivity)
  }
  
  // Apply movement to all selected segments
  selectedSegments.value.forEach(segment => {
    segment.mesh.position.add(movementVector)
    segment.mesh.updateMatrixWorld()
  })
  
  // Calculate and update movement distances
  if (selectedSegments.value[0]) {
    const currentPosition = selectedSegments.value[0].mesh.position
    const totalDistance = movementStartPosition.distanceTo(currentPosition)
    totalMovementDistance.value = totalDistance
    
    // Update individual segment movement distance and history
    const segment = selectedSegments.value[0]
    if (segment.originalPosition) {
      segment.movementDistance = segment.originalPosition.distanceTo(currentPosition)
      // Update movement history
      updateSegmentMovementHistory(segment, 'drag')
    }
    
    // Calculate axis-specific distances using dental coordinate system
    const deltaPosition = currentPosition.clone().sub(movementStartPosition)
    axisMovementDistances.value = {
      transverse: deltaPosition.x,      // Side-to-side (X in 3D space)
      vertical: deltaPosition.y,        // Up-down (Y in 3D space)  
      anteroposterior: deltaPosition.z  // Front-back (Z in 3D space)
    }
    
    // Update movement axis display based on largest component
    const absTransverse = Math.abs(deltaPosition.x)
    const absVertical = Math.abs(deltaPosition.y)
    const absAnteroposterior = Math.abs(deltaPosition.z)
    
    if (absTransverse > absVertical && absTransverse > absAnteroposterior) {
      movementAxis.value = 'Transverse'
    } else if (absVertical > absTransverse && absVertical > absAnteroposterior) {
      movementAxis.value = 'Vertical'
    } else if (absAnteroposterior > absTransverse && absAnteroposterior > absVertical) {
      movementAxis.value = 'Anteroposterior'
    } else {
      movementAxis.value = 'Combined'
    }
  }
}

function resetSegmentPosition() {
  if (selectedSegments.value.length === 0) return
  
  selectedSegments.value.forEach(segment => {
    segment.mesh.position.copy(movementStartPosition)
    segment.mesh.updateMatrixWorld()
  })
  
  totalMovementDistance.value = 0
  movementAxis.value = 'None'
  axisMovementDistances.value = { anteroposterior: 0, vertical: 0, transverse: 0 }
  constrainedAxis = null
  isMovingSegment = false
  
  console.log('Reset segment positions to original location')
}

function disableMovementMode() {
  if (!isMovingSegment) return
  
  console.log('Disabling 3D movement mode')
  isMovingSegment = false
  constrainedAxis = null
  
  // Don't reset positions or distances when just disabling move mode
  // This preserves any movements that were made
  
  console.log('3D movement mode disabled (positions preserved)')
}

// Individual Segment Functions
function updateSegmentMovementHistory(segment: ToothSegment, movementType: 'drag' | 'directional' | 'manual') {
  if (!segment.originalPosition || !segment.movementHistory) return
  
  const currentPosition = segment.mesh.position
  const deltaPosition = currentPosition.clone().sub(segment.originalPosition)
  
  // Update movement history
  segment.movementHistory.totalDistance = segment.originalPosition.distanceTo(currentPosition)
  segment.movementHistory.axisMovements = {
    anteroposterior: deltaPosition.z,  // Front-back (Z-axis in 3D space)
    vertical: deltaPosition.y,         // Up-down (Y-axis in 3D space)
    transverse: deltaPosition.x        // Side-to-side (X-axis in 3D space)
  }
  segment.movementHistory.lastMovementType = movementType
  segment.movementHistory.movementCount += 1
  
  // Also update the legacy movementDistance for backward compatibility
  segment.movementDistance = segment.movementHistory.totalDistance
  
  console.log(`Updated movement history for ${segment.name}:`, segment.movementHistory)
}

function resetIndividualPosition(segment: ToothSegment) {
  if (!segment.originalPosition || !segment.isSelected) return
  
  segment.mesh.position.copy(segment.originalPosition)
  segment.mesh.updateMatrixWorld()
  
  // Reset movement distance and history
  segment.movementDistance = 0
  if (segment.movementHistory) {
    segment.movementHistory.totalDistance = 0
    segment.movementHistory.axisMovements = {
      anteroposterior: 0,
      vertical: 0,
      transverse: 0
    }
    segment.movementHistory.lastMovementType = undefined
    segment.movementHistory.movementCount = 0
  }
  
  console.log(`Reset position and movement history for segment: ${segment.name}`)
}

function toggleSegmentVisibility(segment: ToothSegment) {
  segment.mesh.visible = !segment.mesh.visible
  console.log(`Segment ${segment.name} ${segment.mesh.visible ? 'shown' : 'hidden'}`)
}

// Directional Movement Functions
function startDirectionalMove(axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number) {
  if (selectedSegments.value.length === 0) return
  
  isDirectionalMoving = true
  movementAxis.value = axis
  
  // Initialize movement start position if not already set
  if (totalMovementDistance.value === 0) {
    movementStartPosition.copy(selectedSegments.value[0].mesh.position)  
  }
  
  // Continuous movement while button is held
  const moveStep = 0.1 // mm per step
  const moveInterval = 50 // ms between moves
  
  directionalMoveInterval = window.setInterval(() => {
    if (!isDirectionalMoving) return
    
    moveSegmentInDirection(axis, direction * moveStep)
  }, moveInterval)
  
  console.log(`Started directional movement: ${axis} ${direction > 0 ? 'positive' : 'negative'}`)
}

function stopDirectionalMove() {
  isDirectionalMoving = false
  
  if (directionalMoveInterval) {
    clearInterval(directionalMoveInterval)
    directionalMoveInterval = null
  }
  
  console.log('Stopped directional movement')
}

function moveSegmentInDirection(axis: 'Anteroposterior' | 'Vertical' | 'Transverse', distance: number) {
  if (selectedSegments.value.length === 0) return
  
  // Get camera vectors for proper 3D movement
  const cameraDirection = new THREE.Vector3()
  camera.getWorldDirection(cameraDirection)
  
  const cameraRight = new THREE.Vector3()
  cameraRight.crossVectors(camera.up, cameraDirection).normalize()
  
  const cameraUp = new THREE.Vector3()
  cameraUp.crossVectors(cameraDirection, cameraRight).normalize()
  
  const cameraForward = cameraDirection.clone().negate()
  
  // Calculate movement vector based on axis
  const movementVector = new THREE.Vector3()
  
  if (axis === 'Transverse') {
    // Side-to-side movement (X-axis in 3D space)
    movementVector.addScaledVector(cameraRight, distance)
  } else if (axis === 'Vertical') {
    // Up-down movement (Y-axis in 3D space)
    movementVector.addScaledVector(cameraUp, distance)
  } else if (axis === 'Anteroposterior') {
    // Front-back movement (Z-axis in 3D space)
    movementVector.addScaledVector(cameraForward, distance)
  }
  
  // Apply movement to all selected segments
  selectedSegments.value.forEach(segment => {
    segment.mesh.position.add(movementVector)
    segment.mesh.updateMatrixWorld()
  })
  
  // Update distance tracking
  if (selectedSegments.value[0]) {
    const currentPosition = selectedSegments.value[0].mesh.position
    const totalDistance = movementStartPosition.distanceTo(currentPosition)
    totalMovementDistance.value = totalDistance
    
    // Update individual segment movement distance and history
    const segment = selectedSegments.value[0]
    if (segment.originalPosition) {
      segment.movementDistance = segment.originalPosition.distanceTo(currentPosition)
      // Update movement history
      updateSegmentMovementHistory(segment, 'directional')
    }
    
    // Calculate axis-specific distances using dental coordinate system
    const deltaPosition = currentPosition.clone().sub(movementStartPosition)
    axisMovementDistances.value = {
      transverse: deltaPosition.x,      // Side-to-side (X in 3D space)
      vertical: deltaPosition.y,        // Up-down (Y in 3D space)  
      anteroposterior: deltaPosition.z  // Front-back (Z in 3D space)
    }
  }
}

// Lasso Selection Functions
function startLassoSelection(event: MouseEvent) {
  isLassoActive = true
  lassoPoints = []
  
  // Get canvas coordinates
  const rect = renderer.domElement.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  lassoPoints.push(new THREE.Vector2(x, y))
  createLassoVisual()
  
  console.log('Started lasso selection')
}

function updateLassoSelection(event: MouseEvent) {
  if (!isLassoActive) return
  
  // Get canvas coordinates
  const rect = renderer.domElement.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  const newPoint = new THREE.Vector2(x, y)
  
  // Only add point if it's far enough from the last point (smooth the path)
  if (lassoPoints.length === 0 || lassoPoints[lassoPoints.length - 1].distanceTo(newPoint) > 5) {
    lassoPoints.push(newPoint)
    updateLassoVisual()
  }
}

function finalizeLassoSelection(event: MouseEvent) {
  if (!isLassoActive) return
  
  // Close the lasso path
  const rect = renderer.domElement.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  lassoPoints.push(new THREE.Vector2(x, y))
  
  console.log(`Finalizing lasso with ${lassoPoints.length} points`)
  console.log(`Dental model exists: ${!!dentalModel.value}`)
  console.log(`Original mesh exists: ${!!dentalModel.value?.originalMesh}`)
  console.log(`Segments count: ${dentalModel.value?.segments.length || 0}`)
  
  // Perform selection based on lasso area
  performLassoSelection()
  
  // Clean up
  isLassoActive = false
  removeLassoVisual()
  lassoPoints = []
  
  console.log('Completed lasso selection cleanup')
}

function createLassoVisual() {
  // Create SVG overlay for lasso visualization
  const canvas = renderer.domElement
  const rect = canvas.getBoundingClientRect()
  
  // Remove existing lasso if any
  removeLassoVisual()
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.style.position = 'absolute'
  svg.style.top = '0'
  svg.style.left = '0'
  svg.style.width = rect.width + 'px'
  svg.style.height = rect.height + 'px'
  svg.style.pointerEvents = 'none'
  svg.style.zIndex = '1000'
  svg.id = 'lasso-overlay'
  
  lassoPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  lassoPath.setAttribute('stroke', '#00ff00')
  lassoPath.setAttribute('stroke-width', '2')
  lassoPath.setAttribute('fill', 'rgba(0, 255, 0, 0.2)')
  lassoPath.setAttribute('stroke-dasharray', '3,3')
  
  svg.appendChild(lassoPath)
  
  canvas.parentElement?.appendChild(svg)
}

function updateLassoVisual() {
  if (!lassoPath || lassoPoints.length < 2) return
  
  let pathData = `M ${lassoPoints[0].x} ${lassoPoints[0].y}`
  for (let i = 1; i < lassoPoints.length; i++) {
    pathData += ` L ${lassoPoints[i].x} ${lassoPoints[i].y}`
  }
  
  // Close the path if we have enough points
  if (lassoPoints.length > 2) {
    pathData += ` Z` // Close the path
  }
  
  lassoPath.setAttribute('d', pathData)
}

function removeLassoVisual() {
  const overlay = document.getElementById('lasso-overlay')
  if (overlay) {
    overlay.remove()
  }
  lassoPath = null
}

function performLassoSelection() {
  if (!dentalModel.value || lassoPoints.length < 3) {
    console.log('Cannot perform lasso selection: insufficient points or no model')
    console.log(`Lasso points: ${lassoPoints.length}, Model exists: ${!!dentalModel.value}`)
    return
  }
  
  console.log(`Performing lasso selection. Segments exist: ${dentalModel.value.segments.length > 0}`)
  
  // ALWAYS create new segments from original mesh when using lasso tool
  // This allows creating multiple segments by always working from the original mesh
  console.log('Creating new segment from original mesh (allowing multiple segments)')
  performManualSegmentation()
}

async function performManualSegmentation() {
  if (!dentalModel.value?.originalMesh) return
  
  try {
    isLoading.value = true
    loadingMessage.value = 'Creating segment...'
    
    const selectedVertices = getVerticesInsideLasso(dentalModel.value.originalMesh)
    
    if (selectedVertices.length === 0) {
      alert('No vertices found inside lasso area.')
      return
    }
    
    console.log(`Creating segment ${dentalModel.value.segments.length + 1} with ${selectedVertices.length} vertices`)
    
    const newSegment = await createSegmentFromVertices(selectedVertices, dentalModel.value.originalMesh)
    
    if (newSegment) {
      // Add new segment to the model
      dentalModel.value.segments.push(newSegment)
      scene.add(newSegment.mesh)
      
      // IMPORTANT: Keep the original mesh visible for subsequent lasso operations
      dentalModel.value.originalMesh.visible = true
      
      // Make sure the original mesh is still in the scene
      if (!scene.children.includes(dentalModel.value.originalMesh)) {
        scene.add(dentalModel.value.originalMesh)
        console.log('Re-added original mesh to scene for continued segmentation')
      }
      
      // Add to selection instead of replacing it
      if (!selectedSegments.value.find(s => s.id === newSegment.id)) {
        selectedSegments.value.push(newSegment)
      }
      newSegment.isSelected = true
      updateSegmentAppearance(newSegment)
      
      console.log(`Successfully created segment ${newSegment.name}. Original mesh remains visible for more segmentations.`)
      alert(`Created "${newSegment.name}" - you can continue creating more segments`)
    }
    
  } catch (error) {
    console.error('Error creating segment:', error)
    alert('Error creating segment. Try selecting a smaller area.')
  } finally {
    isLoading.value = false
    loadingMessage.value = ''
  }
}

function isPointInPolygon(point: THREE.Vector2, polygon: THREE.Vector2[]): boolean {
  let inside = false
  
  // Ray casting algorithm - optimized version
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y
    
    if (((yi > point.y) !== (yj > point.y)) && 
        (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  
  return inside
}

function getVerticesInsideLasso(mesh: THREE.Mesh): number[] {
  const geometry = mesh.geometry
  const positions = geometry.getAttribute('position')
  const selectedIndices: number[] = []
  
  console.log(`Processing ${positions.count} vertices against lasso with ${lassoPoints.length} points`)
  console.log(`Mesh visible: ${mesh.visible}, in scene: ${scene.children.includes(mesh)}`)
  
  const rect = renderer.domElement.getBoundingClientRect()
  const vertex = new THREE.Vector3()
  const screenPoint = new THREE.Vector2()
  
  // Make sure we're using the mesh's world matrix
  mesh.updateMatrixWorld()
  
  for (let i = 0; i < positions.count; i++) {
    vertex.set(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    )
    
    // Apply the mesh's world transformation
    vertex.applyMatrix4(mesh.matrixWorld)
    
    // Project to screen coordinates
    vertex.project(camera)
    
    // Skip vertices behind the camera
    if (vertex.z < -1 || vertex.z > 1) continue
    
    // Convert NDC to screen coordinates
    screenPoint.x = (vertex.x + 1) * rect.width / 2
    screenPoint.y = (-vertex.y + 1) * rect.height / 2
    
    // Check if vertex is within screen bounds
    if (screenPoint.x >= 0 && screenPoint.x <= rect.width && 
        screenPoint.y >= 0 && screenPoint.y <= rect.height) {
      
      if (isPointInPolygon(screenPoint, lassoPoints)) {
        selectedIndices.push(i)
      }
    }
  }
  
  console.log(`Found ${selectedIndices.length} vertices inside lasso for segment creation`)
  return selectedIndices
}

async function createSegmentFromVertices(vertexIndices: number[], originalMesh: THREE.Mesh): Promise<ToothSegment | null> {
  if (vertexIndices.length === 0) return null
  
  console.log(`Creating segment from ${vertexIndices.length} vertices...`)
  
  const geometry = originalMesh.geometry
  const positions = geometry.getAttribute('position')
  const indices = geometry.index
  
  // Create a set of selected vertices for fast lookup
  const selectedVertices = new Set(vertexIndices)
  
  let selectedTriangles: number[] = []
  
  if (indices) {
    // Indexed geometry
    console.log('Processing indexed geometry...')
    const indexArray = indices.array
    
    for (let i = 0; i < indexArray.length; i += 3) {
      const v1 = indexArray[i]
      const v2 = indexArray[i + 1]
      const v3 = indexArray[i + 2]
      
      // Count how many vertices of this triangle are selected
      const selectedCount = [v1, v2, v3].filter(v => selectedVertices.has(v)).length
      
      // Include triangle if at least 2 vertices are selected
      if (selectedCount >= 2) {
        selectedTriangles.push(v1, v2, v3)
      }
    }
  } else {
    // Non-indexed geometry (common for STL files)
    console.log('Processing non-indexed geometry...')
    const vertexCount = positions.count
    
    for (let i = 0; i < vertexCount; i += 3) {
      const v1 = i
      const v2 = i + 1
      const v3 = i + 2
      
      // Count how many vertices of this triangle are selected
      const selectedCount = [v1, v2, v3].filter(v => selectedVertices.has(v)).length
      
      // Include triangle if at least 2 vertices are selected
      if (selectedCount >= 2) {
        selectedTriangles.push(v1, v2, v3)
      }
    }
  }
  
  if (selectedTriangles.length === 0) {
    console.warn('No triangles found for selected vertices')
    return null
  }
  
  // Create new geometry with proper triangles
  const newPositions = new Float32Array(selectedTriangles.length * 3)
  const newVertices: THREE.Vector3[] = []
  
  for (let i = 0; i < selectedTriangles.length; i++) {
    const vertexIndex = selectedTriangles[i]
    const baseIndex = i * 3
    
    const x = positions.getX(vertexIndex)
    const y = positions.getY(vertexIndex)
    const z = positions.getZ(vertexIndex)
    
    newPositions[baseIndex] = x
    newPositions[baseIndex + 1] = y
    newPositions[baseIndex + 2] = z
    
    newVertices.push(new THREE.Vector3(x, y, z))
  }
  
  // Create proper geometry with triangles
  const segmentGeometry = new THREE.BufferGeometry()
  segmentGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3))
  segmentGeometry.computeVertexNormals()
  segmentGeometry.computeBoundingBox()
  
  const centroid = new THREE.Vector3()
  if (segmentGeometry.boundingBox) {
    segmentGeometry.boundingBox.getCenter(centroid)
  }
  
  // Create material with proper shading
  const hue = (dentalModel.value?.segments.length || 0) * 0.3
  const color = new THREE.Color().setHSL(hue, 0.7, 0.5)
  const material = new THREE.MeshLambertMaterial({ 
    color: color,
    side: THREE.DoubleSide // Ensure both sides are rendered
  })
  
  // Create mesh
  const segmentMesh = new THREE.Mesh(segmentGeometry, material)
  segmentMesh.castShadow = true
  segmentMesh.receiveShadow = true
  markRaw(segmentMesh)
  
  // Create segment
  const segment: ToothSegment = {
    id: `segment_${Date.now()}`,
    name: `Segment ${(dentalModel.value?.segments.length || 0) + 1}`,
    mesh: segmentMesh,
    originalVertices: newVertices,
    centroid: centroid,
    color: color,
    toothType: 'molar',
    isSelected: false,
    movementDistance: 0,
    originalPosition: segmentMesh.position.clone(),
    movementHistory: {
      totalDistance: 0,
      axisMovements: {
        anteroposterior: 0,
        vertical: 0,
        transverse: 0
      },
      lastMovementType: undefined,
      movementCount: 0
    }
  }
  
  console.log(`Created solid segment with ${selectedTriangles.length / 3} triangles`)
  return segment
}

function animate() {
  try {
    // Ensure camera and renderer exist
    if (!camera || !renderer || !scene) {
      console.warn('Missing Three.js objects, stopping animation')
      return
    }
    
    // Ensure camera matrices are updated
    camera.updateMatrixWorld()
    
    // Update any mesh matrices that might be modified
    if (dentalModel.value) {
      dentalModel.value.segments.forEach(segment => {
        if (segment.mesh) {
          segment.mesh.updateMatrixWorld()
        }
      })
    }
    
    renderer.render(scene, camera)
    
    // Continue animation loop
    requestAnimationFrame(animate)
  } catch (error) {
    console.error('Animation error:', error)
    // Try to restart animation after a short delay to prevent infinite error loops
    setTimeout(() => {
      console.log('Attempting to restart animation...')
      requestAnimationFrame(animate)
    }, 1000)
  }
}

// File handling
function triggerFileUpload() {
  fileInput.value?.click()
}


async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (file) {
    console.log('File selected:', file.name, 'size:', file.size, 'type:', file.type)
    
    isLoading.value = true
    loadingMessage.value = 'Loading STL file...'
    
    try {
      console.log('Starting STL loading...')
      loadingMessage.value = 'Parsing STL file...'
      const mesh = await stlLoader.loadSTL(file)
      console.log('STL loaded successfully:', mesh)
      
      // Clear previous model
      if (dentalModel.value) {
        console.log('Clearing previous model segments:', dentalModel.value.segments.length)
        dentalModel.value.segments.forEach(segment => {
          scene.remove(segment.mesh)
        })
        // Also remove the original mesh if it exists
        if (dentalModel.value.originalMesh) {
          scene.remove(dentalModel.value.originalMesh)
        }
      }
      
      // Mark the mesh as raw to prevent Vue reactivity issues
      const rawMesh = markRaw(mesh)
      
      // Add original mesh to scene (visible)
      rawMesh.visible = true
      scene.add(rawMesh)
      console.log('Original mesh added to scene and made visible')
      
      // Create a simple dental model with just the original mesh (no segmentation yet)
      const geometry = mesh.geometry as any
      geometry.computeBoundingBox()
      const boundingBox = {
        min: geometry.boundingBox?.min.clone() || new THREE.Vector3(),
        max: geometry.boundingBox?.max.clone() || new THREE.Vector3()
      }
      
      // Create dental model without segments initially
      dentalModel.value = {
        originalMesh: rawMesh,
        segments: [], // Empty segments array - no segmentation applied yet
        boundingBox
      }
      
      const vertexCount = geometry.getAttribute('position')?.count || 0
      console.log(`STL model loaded with ${vertexCount.toLocaleString()} vertices (no segmentation applied)`)
      loadingMessage.value = 'Model loaded successfully'
      
      // Since we have no segments initially, skip segment rendering
      console.log('Model loaded without segmentation - ready for user interaction')
      
      // Focus camera on model
      focusOnModel()
      console.log('Camera focused on model')
      
    } catch (error) {
      console.error('Error loading STL file:', error)
      alert(`Error loading STL file: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
    } finally {
      isLoading.value = false
      loadingMessage.value = ''
      // Clear the input so the same file can be selected again
      if (input) {
        input.value = ''
      }
    }
  } else {
    console.log('No file selected')
  }
}

function focusOnModel() {
  if (!dentalModel.value) return
  
  const box = dentalModel.value.boundingBox
  const center = box.min.clone().add(box.max).multiplyScalar(0.5)
  const size = box.max.clone().sub(box.min)
  const maxDim = Math.max(size.x, size.y, size.z)
  
  camera.position.set(center.x, center.y, center.z + maxDim * 2)
  camera.lookAt(center)
  camera.updateMatrixWorld()
}

function toggleOriginalMesh() {
  if (!dentalModel.value?.originalMesh) return
  
  dentalModel.value.originalMesh.visible = !dentalModel.value.originalMesh.visible
  console.log(`Original mesh ${dentalModel.value.originalMesh.visible ? 'shown' : 'hidden'}`)
}

function toggleAllSegments() {
  if (!dentalModel.value?.segments.length) return
  
  const allVisible = areAllSegmentsVisible()
  
  dentalModel.value.segments.forEach(segment => {
    segment.mesh.visible = !allVisible
  })
  
  console.log(`All segments ${!allVisible ? 'shown' : 'hidden'}`)
}

function areAllSegmentsVisible(): boolean {
  if (!dentalModel.value?.segments.length) return false
  
  return dentalModel.value.segments.every(segment => segment.mesh.visible)
}

function setInteractionMode(mode: InteractionMode['mode']) {
  // Clean up any active lasso selection when changing modes
  if (currentMode.value === 'lasso' && isLassoActive) {
    isLassoActive = false
    removeLassoVisual()
    lassoPoints = []
  }
  
  // Clean up move mode when switching to another mode (preserves segment positions)
  if (currentMode.value === 'move' || isMovingSegment) {
    disableMovementMode()
  }
  
  currentMode.value = mode
  console.log(`Interaction mode changed to: ${mode}`)
  
  // Set appropriate cursor for the new mode
  if (renderer?.domElement) {
    const cursorMap = {
      lasso: 'crosshair',
      select: 'pointer',
      rotate: 'grab',
      move: 'move',
      brush: 'crosshair',
      merge: 'pointer',
      split: 'pointer'
    }
    renderer.domElement.style.cursor = cursorMap[mode] || 'default'
    console.log(`Cursor set to: ${cursorMap[mode] || 'default'} for mode: ${mode}`)
  }
}

function getModeIcon(mode: InteractionMode['mode']): string {
  const icons = {
    select: '👆',
    lasso: '⭕',
    brush: '🖌️',
    move: '↔️',
    rotate: '🔄',
    merge: '🔗',
    split: '✂️'
  }
  return icons[mode] || '📍'
}

function isInteractionModeDisabled(mode: InteractionMode['mode']): boolean {
  if (!dentalModel.value) return true
  
  // Modes that require existing segments to operate on
  const existingSegmentModes: InteractionMode['mode'][] = ['merge', 'split']
  
  if (existingSegmentModes.includes(mode)) {
    return dentalModel.value.segments.length === 0
  }
  
  // Lasso and select work on any model (original or segmented)
  return false
}

function getInteractionModeTitle(mode: InteractionMode['mode']): string {
  const titles = {
    select: 'Click to select individual segments',
    lasso: dentalModel.value?.segments.length === 0 
      ? 'Draw lasso to create new segments manually' 
      : 'Draw lasso to select multiple segments',
    brush: 'Brush to paint selection',
    move: 'Move selected segments',
    rotate: 'Rotate view (drag to orbit camera)',
    merge: 'Merge selected segments',
    split: 'Split selected segment'
  }
  return titles[mode] || mode.charAt(0).toUpperCase() + mode.slice(1)
}

function resetCamera() {
  if (dentalModel.value) {
    focusOnModel()
  } else {
    camera.position.set(0, 0, 50)
    camera.lookAt(0, 0, 0)
  }
}

function fitToScreen() {
  if (dentalModel.value) {
    const box = dentalModel.value.boundingBox
    const center = box.min.clone().add(box.max).multiplyScalar(0.5)
    const size = box.max.clone().sub(box.min)
    const maxDim = Math.max(size.x, size.y, size.z)
    
    // Position camera to fit the entire model
    camera.position.set(center.x, center.y, center.z + maxDim * 1.5)
    camera.lookAt(center)
  }
}

function setViewPreset(view: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') {
  if (!dentalModel.value) return
  
  const box = dentalModel.value.boundingBox
  const center = box.min.clone().add(box.max).multiplyScalar(0.5)
  const size = box.max.clone().sub(box.min)
  const maxDim = Math.max(size.x, size.y, size.z)
  const distance = maxDim * 2 // Distance from center
  
  let position: THREE.Vector3
  
  switch (view) {
    case 'top':
      position = new THREE.Vector3(center.x, center.y + distance, center.z)
      break
    case 'bottom':
      position = new THREE.Vector3(center.x, center.y - distance, center.z)
      break
    case 'front':
      position = new THREE.Vector3(center.x, center.y, center.z + distance)
      break
    case 'back':
      position = new THREE.Vector3(center.x, center.y, center.z - distance)
      break
    case 'left':
      position = new THREE.Vector3(center.x - distance, center.y, center.z)
      break
    case 'right':
      position = new THREE.Vector3(center.x + distance, center.y, center.z)
      break
    default:
      return
  }
  
  // Smooth transition to new position
  animateCameraToPosition(position, center)
}

function animateCameraToPosition(targetPosition: THREE.Vector3, lookAtTarget: THREE.Vector3) {
  const startPosition = camera.position.clone()
  const startTime = performance.now()
  const duration = 500 // Animation duration in ms
  
  function animate() {
    const currentTime = performance.now()
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    
    // Use easing function for smooth animation
    const easeProgress = 1 - Math.pow(1 - progress, 3) // Ease out cubic
    
    // Interpolate position
    camera.position.lerpVectors(startPosition, targetPosition, easeProgress)
    camera.lookAt(lookAtTarget)
    camera.updateMatrixWorld()
    
    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }
  
  animate()
}

function changeSegmentColor(segment: ToothSegment, event: Event) {
  const input = event.target as HTMLInputElement
  const color = new THREE.Color(input.value)
  
  segment.color = color
  const material = segment.mesh.material as THREE.MeshLambertMaterial
  material.color = color
}

function mergeSelectedSegments() {
  if (selectedSegments.value.length < 2) {
    alert('Select at least 2 segments to merge')
    return
  }
  
  // Implementation for merging segments
  console.log('Merging segments:', selectedSegments.value)
}

function splitSelectedSegment() {
  if (selectedSegments.value.length !== 1) {
    alert('Select exactly one segment to split')
    return
  }
  
  // Implementation for splitting segment
  console.log('Splitting segment:', selectedSegments.value[0])
}

function deleteSelectedSegments() {
  if (!dentalModel.value || selectedSegments.value.length === 0) return
  
  selectedSegments.value.forEach(segment => {
    scene.remove(segment.mesh)
    const index = dentalModel.value!.segments.findIndex(s => s.id === segment.id)
    if (index >= 0) {
      dentalModel.value!.segments.splice(index, 1)
    }
  })
  
  selectedSegments.value = []
}

function exportModel() {
  if (!dentalModel.value) return
  
  const exportData = {
    segments: dentalModel.value.segments.map(segment => ({
      id: segment.id,
      name: segment.name,
      vertices: segment.originalVertices.flatMap(v => [v.x, v.y, v.z]),
      faces: [], // You'd need to extract face indices
      color: '#' + segment.color.getHexString(),
      toothType: segment.toothType
    })),
    metadata: {
      originalFileName: 'dental_model.stl',
      segmentationMethod: 'manual',
      exportDate: new Date().toISOString()
    }
  }
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dental_segmentation.json'
  a.click()
  URL.revokeObjectURL(url)
}

function cleanup() {
  if (renderer) {
    renderer.dispose()
  }
  
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  
  // Remove keyboard event listeners
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', onWindowResize)
}
</script>

<style scoped>
/* Main Layout */
.dental-viewer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #1e1e1e;
  color: #ffffff;
  font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  overflow: hidden;
}

/* Top Toolbar */
.top-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #2d3748 0%, #4a5568 100%);
  border-bottom: 1px solid #4a5568;
  padding: 8px 16px;
  height: 56px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-center {
  flex: 1;
  justify-content: center;
  gap: 24px;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: #e2e8f0;
}

.app-icon {
  font-size: 24px;
}

.file-controls, .view-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 13px;
  font-weight: 500;
}

.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.toolbar-btn.primary {
  background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
  border-color: #3182ce;
}

.toolbar-btn.primary:hover {
  background: linear-gradient(135deg, #2c5282 0%, #2a4a7a 100%);
}

.toolbar-btn.active {
  background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
  border-color: #38a169;
}

.toolbar-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.05);
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.05);
}

.btn-icon {
  font-size: 14px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #a0aec0;
}

.segment-count, .selected-count {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-weight: 500;
}

/* Main Content */
.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left Sidebar */
.left-sidebar {
  width: 280px;
  min-width: 280px;
  background: #2d3748;
  border-right: 1px solid #4a5568;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
}

/* Panel Styles */
.panel {
  border-bottom: 1px solid #4a5568;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #1a202c;
  border-bottom: 1px solid #4a5568;
  font-weight: 600;
  font-size: 14px;
}

.panel-icon {
  font-size: 16px;
}

.panel-title {
  flex: 1;
}

.panel-badge {
  background: #3182ce;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.panel-content {
  padding: 16px;
}

/* Form Controls */
.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #a0aec0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  background: #1a202c;
  border: 1px solid #4a5568;
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 13px;
}

.form-control:focus {
  outline: none;
  border-color: #3182ce;
  box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.2);
}

.slider {
  width: 100%;
  height: 4px;
  background: #4a5568;
  border-radius: 2px;
  outline: none;
  appearance: none;
  -webkit-appearance: none;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #3182ce;
  border-radius: 50%;
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: #3182ce;
  border-radius: 50%;
  cursor: pointer;
  border: none;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-primary {
  background: linear-gradient(135deg, #3182ce 0%, #2c5282 100%);
  color: white;
}

.btn-primary:hover {
  background: linear-gradient(135deg, #2c5282 0%, #2a4a7a 100%);
}

.btn-secondary {
  background: #4a5568;
  color: #e2e8f0;
}

.btn-secondary:hover {
  background: #5a6578;
}

.btn-danger {
  background: #e53e3e;
  color: white;
}

.btn-danger:hover {
  background: #c53030;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.full-width {
  width: 100%;
}

/* Segment List */
.segment-list {
  margin-bottom: 16px;
  max-height: 320px;
  overflow-y: auto;
  padding: 4px;
}

.segment-item {
  display: flex;
  flex-direction: column;
  background: linear-gradient(145deg, #2d3748 0%, #1a202c 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  margin-bottom: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.segment-item:hover {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transform: translateY(-1px);
}

.segment-item.selected {
  border-color: #3182ce;
  box-shadow: 0 0 0 2px rgba(49, 130, 206, 0.2), 0 4px 16px rgba(0, 0, 0, 0.3);
}

.segment-header {
  display: flex;
  align-items: center;
  padding: 16px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s ease;
}

.segment-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.segment-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.segment-checkbox {
  display: flex;
  align-items: center;
}

.segment-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #3182ce;
  cursor: pointer;
  border-radius: 3px;
}

.segment-name {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
  margin-right: 8px;
}

.segment-type {
  font-size: 11px;
  color: #a0aec0;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.segment-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.segment-expanded {
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.segment-actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.segment-actions .btn {
  flex: 1;
  font-size: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.segment-actions .btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.segment-actions .btn-secondary {
  background: linear-gradient(145deg, #4a5568 0%, #2d3748 100%);
  color: #e2e8f0;
}

.segment-actions .btn-secondary:hover {
  background: linear-gradient(145deg, #5a6578 0%, #374151 100%);
}

.individual-movement-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(99, 102, 241, 0.05));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  padding: 10px 12px;
  margin-top: 8px;
}

.movement-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.individual-movement-info .movement-distance {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.individual-movement-info .distance-label {
  color: #6b7280;
  font-weight: 500;
}

.individual-movement-info .distance-value {
  color: #3b82f6;
  font-weight: 700;
  font-size: 13px;
  background: rgba(59, 130, 246, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.axis-breakdown {
  margin-bottom: 8px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.axis-movement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.axis-movement-item:last-child {
  margin-bottom: 0;
}

.axis-label {
  color: #4b5563;
  font-weight: 500;
  font-size: 10px;
}

.axis-value {
  font-weight: 600;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
}

.axis-value.positive {
  color: #059669;
  background: rgba(5, 150, 105, 0.1);
}

.axis-value.negative {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.segment-controls-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker {
  width: 36px;
  height: 36px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  cursor: pointer;
  background: none;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.color-picker:hover {
  border-color: rgba(255, 255, 255, 0.4);
  transform: scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

.segment-button {
  padding: 4px 8px;
  margin: 0;
  border: 1px solid #4a5568;
  border-radius: 4px;
  background: #1a202c;
  color: #e2e8f0;
  cursor: pointer;
  font-size: 11px;
  transition: all 0.2s ease;
}

.segment-button:hover {
  background: #2d3748;
  border-color: #5a6578;
}

.segment-button.primary {
  background: #3182ce;
  color: white;
  border-color: #3182ce;
}

.segment-button.primary:hover {
  background: #2c5282;
  border-color: #2c5282;
}

.segment-info {
  font-size: 10px;
  color: #a0aec0;
  margin-top: 4px;
  text-align: center;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.action-buttons .btn {
  flex: 1;
  margin: 0;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.action-buttons .btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.action-buttons .btn-secondary {
  background: linear-gradient(145deg, #4a5568 0%, #2d3748 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.action-buttons .btn-secondary:hover {
  background: linear-gradient(145deg, #5a6578 0%, #374151 100%);
}

.action-buttons .btn-danger {
  background: linear-gradient(145deg, #e53e3e 0%, #c53030 100%);
  border: 1px solid rgba(229, 62, 62, 0.3);
}

.action-buttons .btn-danger:hover {
  background: linear-gradient(145deg, #fc8181 0%, #e53e3e 100%);
}

/* Movement Controls */
.movement-controls {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 12px;
}

.movement-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  font-weight: 600;
  font-size: 12px;
  color: #3b82f6;
}

.movement-icon {
  font-size: 14px;
}

.movement-buttons {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.movement-btn {
  flex: 1;
  font-size: 10px;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.movement-btn span {
  font-size: 11px;
}

.movement-display {
  text-align: center;
  margin-top: 8px;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.total-distance {
  color: #48bb78;
  font-weight: 600;
  font-size: 11px;
}

/* Direction Controls */
.direction-controls {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 6px;
  padding: 8px;
  margin-top: 8px;
}

.axis-control-group {
  margin-bottom: 8px;
}

.axis-control-group:last-child {
  margin-bottom: 0;
}

.axis-label {
  font-size: 10px;
  color: #a0aec0;
  font-weight: 600;
  margin-bottom: 4px;
  text-align: center;
}

.axis-buttons {
  display: flex;
  gap: 3px;
}

.direction-btn {
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: white;
  font-size: 9px;
  padding: 6px 4px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  user-select: none;
}

.direction-btn:hover {
  background: rgba(16, 185, 129, 0.3);
  border-color: rgba(16, 185, 129, 0.6);
}

.direction-btn:active {
  background: rgba(16, 185, 129, 0.5);
  transform: scale(0.98);
}

.direction-btn.anterior:active, .direction-btn.posterior:active {
  background: rgba(255, 165, 0, 0.2);
  border-color: #ffa500;
}

.direction-btn.superior, .direction-btn.inferior {
  border-color: rgba(0, 191, 255, 0.3);
}

.direction-btn.superior:hover, .direction-btn.inferior:hover {
  border-color: rgba(0, 191, 255, 0.6);
}

.direction-btn.superior:active, .direction-btn.inferior:active {
  background: rgba(0, 191, 255, 0.2);
  border-color: #00bfff;
}

.direction-btn.left, .direction-btn.right {
  border-color: rgba(255, 20, 147, 0.3);
}

.direction-btn.left:hover, .direction-btn.right:hover {
  border-color: rgba(255, 20, 147, 0.6);
}

.direction-btn.left:active, .direction-btn.right:active {
  background: rgba(255, 20, 147, 0.2);
  border-color: #ff1493;
}

/* Info Items */
.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #4a5568;
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 12px;
  color: #a0aec0;
  font-weight: 500;
}

.info-value {
  font-size: 12px;
  color: #e2e8f0;
  font-weight: 600;
}

.info-text {
  font-size: 13px;
  line-height: 1.4;
  color: #cbd5e0;
}

.info-text p {
  margin: 0 0 12px 0;
}

.info-text p:last-child {
  margin-bottom: 0;
}

.info-text ol {
  margin: 8px 0;
  padding-left: 20px;
}

.info-text li {
  margin-bottom: 4px;
}

.info-text strong {
  color: #e2e8f0;
  font-weight: 600;
}

.info-text em {
  color: #90cdf4;
  font-style: italic;
}

.performance-tips {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.3);
  border-radius: 4px;
  padding: 8px;
  margin: 8px 0;
}

.performance-tips p {
  margin: 0 0 6px 0;
  color: #ffd700;
  font-size: 12px;
}

.performance-tips ul {
  margin: 4px 0 0 0;
  padding-left: 16px;
  font-size: 11px;
  color: #e2e8f0;
}

.performance-tips li {
  margin-bottom: 2px;
}

/* Viewport */
.viewport {
  flex: 1;
  position: relative;
  background: #0f0f0f;
  overflow: hidden;
}

.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.canvas-container canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

/* Cursor styles for different interaction modes */
.canvas-container canvas[data-mode="lasso"] {
  cursor: crosshair;
}

.canvas-container canvas[data-mode="select"] {
  cursor: pointer;
}

.canvas-container canvas[data-mode="rotate"] {
  cursor: grab;
}

.canvas-container canvas[data-mode="move"] {
  cursor: move;
}

/* Viewport Controls */
.viewport-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 100;
}

/* View Presets */
.view-presets {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 100;
}

.view-presets-title {
  font-size: 11px;
  font-weight: 600;
  color: white;
  background: rgba(0, 0, 0, 0.8);
  padding: 4px 8px;
  border-radius: 4px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.view-presets-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}

.preset-btn {
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.preset-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

.viewport-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.current-mode {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.mode-hint {
  background: rgba(255, 165, 0, 0.9);
  color: white;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.camera-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-btn {
  width: 44px;
  height: 44px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.control-btn:hover {
  background: rgba(0, 0, 0, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

/* Loading Overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(10px);
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top: 4px solid #3182ce;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: white;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
}

/* Scrollbar Styling */
.left-sidebar::-webkit-scrollbar,
.segment-list::-webkit-scrollbar {
  width: 6px;
}

.left-sidebar::-webkit-scrollbar-track,
.segment-list::-webkit-scrollbar-track {
  background: #1a202c;
}

.left-sidebar::-webkit-scrollbar-thumb,
.segment-list::-webkit-scrollbar-thumb {
  background: #4a5568;
  border-radius: 3px;
}

.left-sidebar::-webkit-scrollbar-thumb:hover,
.segment-list::-webkit-scrollbar-thumb:hover {
  background: #5a6578;
}

/* Responsive Design */
@media (max-width: 1200px) {
  .left-sidebar {
    width: 240px;
    min-width: 240px;
  }
  
  .toolbar-center {
    gap: 16px;
  }
}

@media (max-width: 768px) {
  .top-toolbar {
    flex-direction: column;
    height: auto;
    padding: 8px;
    gap: 8px;
  }
  
  .toolbar-section {
    width: 100%;
    justify-content: center;
  }
  
  .left-sidebar {
    width: 200px;
    min-width: 200px;
  }
  
  .panel-content {
    padding: 12px;
  }
}
</style>
