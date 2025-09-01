<template>
  <div class="toolbar-content">
    <div class="file-controls">
      <input 
        ref="fileInput" 
        type="file" 
        accept=".stl,.obj,.ply,.gltf,.glb" 
        @change="handleFileUpload"
        style="display: none"
      />
      <button @click="triggerFileUpload" :disabled="isLoading" class="toolbar-btn primary">
        <span class="btn-icon" :class="{ 'rotating': isLoading }">{{ isLoading ? '⟳' : '⬆' }}</span>
        {{ getUploadButtonText() }}
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
      
      <!-- Enhanced Lasso Controls -->
      <div v-if="currentMode === 'lasso'" class="lasso-controls">
        <div class="lasso-mode-selector">
          <button 
            v-for="lassoMode in lassoModes" 
            :key="lassoMode.id"
            @click="setLassoMode(lassoMode.id)"
            :class="{ 
              active: currentLassoMode === lassoMode.id,
              disabled: isLassoModeDisabled(lassoMode.id)
            }"
            class="lasso-mode-btn"
            :title="lassoMode.title"
            :disabled="isLassoModeDisabled(lassoMode.id)"
          >
            <span class="lasso-icon">{{ lassoMode.icon }}</span>
            <span class="lasso-label">{{ lassoMode.label }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DentalModel, ToothSegment, InteractionMode } from '../types/dental'
import type { LassoMode } from '../services/EnhancedLassoService'

// Props
interface Props {
  dentalModel: DentalModel | null
  selectedSegments: ToothSegment[]
  currentMode: InteractionMode['mode']
  isLoading: boolean
  interactionModes: InteractionMode['mode'][]
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  fileUpload: [event: Event, autoSegment: boolean]
  setInteractionMode: [mode: InteractionMode['mode']]
  setLassoMode: [mode: LassoMode]
}>()

// Refs
const fileInput = ref<HTMLInputElement>()
const currentLassoMode = ref<LassoMode>('create')

// Lasso modes configuration
const lassoModes = [
  {
    id: 'create' as LassoMode,
    label: 'Create',
    icon: '✨',
    title: 'Create new segment from selection'
  },
  {
    id: 'select' as LassoMode,
    label: 'Select',
    icon: '◯',
    title: 'Select multiple segments'
  },
  {
    id: 'add' as LassoMode,
    label: 'Add',
    icon: '➕',
    title: props.selectedSegments.length === 0 
      ? 'Select a segment first, then use lasso to add vertices to it'
      : `Add vertices to selected segment: ${props.selectedSegments[0]?.name}`
  },
  {
    id: 'subtract' as LassoMode,
    label: 'Remove',
    icon: '➖',
    title: props.selectedSegments.length === 0
      ? 'Select a segment first, then use lasso to remove vertices from it'
      : `Remove vertices from selected segment: ${props.selectedSegments[0]?.name}`
  }
]

// Methods
function triggerFileUpload() {
  fileInput.value?.click()
}

function handleFileUpload(event: Event) {
  const autoSegment = true;
  emit('fileUpload', event, autoSegment)
}

function setInteractionMode(mode: InteractionMode['mode']) {
  // Prevent activating lasso mode if no model is loaded
  if (mode === 'lasso' && !props.dentalModel) {
    return
  }
  console.log('Setting interaction mode:', mode)
  emit('setInteractionMode', mode)
}

function setLassoMode(mode: LassoMode) {
  currentLassoMode.value = mode
  emit('setLassoMode', mode)
}

function isLassoModeDisabled(mode: LassoMode): boolean {
  if (mode === 'add' || mode === 'subtract') {
    // Require both existing segments AND a selected segment for add/subtract operations
    return !props.dentalModel || 
           props.dentalModel.segments.length === 0 || 
           props.selectedSegments.length === 0
  }
  return !props.dentalModel
}

function getUploadButtonText(): string {
  if (props.isLoading) {
    return 'Processing...'
  }
  return 'Load 3D Model';
}

function getModeIcon(mode: InteractionMode['mode']): string {
  const icons = {
    lasso: '✏️',
    pan: '🤚'
  }
  return icons[mode] || '◈'
}

function isInteractionModeDisabled(_mode: InteractionMode['mode']): boolean {
  return !props.dentalModel
}

function getInteractionModeTitle(mode: InteractionMode['mode']): string {
  const titles = {
    lasso: getLassoModeDescription(),
    pan: 'Pan view (drag to move camera position)'
  }
  return titles[mode] || mode.charAt(0).toUpperCase() + mode.slice(1)
}

function getLassoModeDescription(): string {
  const hasSegments = props.dentalModel?.segments.length ?? 0 > 0
  const hasSelected = props.selectedSegments.length > 0
  
  switch (currentLassoMode.value) {
    case 'create':
      return hasSegments 
        ? 'Draw lasso to create new segment from original model'
        : 'Draw lasso to create segments manually'
    case 'select':
      return hasSegments
        ? 'Draw lasso to select multiple segments'
        : 'No segments available to select'
    case 'add':
      return hasSelected
        ? `Draw lasso to add vertices to "${props.selectedSegments[0]?.name}"`
        : 'Select a segment first, then draw lasso to add vertices to it'
    case 'subtract':
      return hasSelected
        ? `Draw lasso to remove vertices from "${props.selectedSegments[0]?.name}"`
        : 'Select a segment first, then draw lasso to remove vertices from it'
    default:
      return 'Enhanced lasso tool'
  }
}
</script>

<style scoped>
/* Toolbar Content */
.toolbar-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 32px;
  width: 100%;
}

.file-controls, .view-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  color: #f1f5f9;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  font-size: 14px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
}

.toolbar-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(148, 163, 184, 0.1), transparent);
  transition: left 0.6s ease;
}

.toolbar-btn:hover::before {
  left: 100%;
}

.toolbar-btn:hover {
  background: rgba(148, 163, 184, 0.2);
  border-color: rgba(148, 163, 184, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.toolbar-btn.primary {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  border-color: rgba(6, 182, 212, 0.5);
  color: #ffffff;
}

.toolbar-btn.primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.4);
}

.toolbar-btn.ai-btn {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  border-color: #10b981;
  color: white;
}

.toolbar-btn.ai-btn:hover {
  background: linear-gradient(135deg, #047857 0%, #065f46 100%);
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
}

.toolbar-btn.active {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  border-color: rgba(6, 182, 212, 0.8);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
}

.toolbar-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  font-size: 18px;
}

.btn-icon.rotating {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-info {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 600;
}

.segment-count, .selected-count {
  background: rgba(148, 163, 184, 0.1);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(4px);
}

.selected-count {
  color: #06b6d4;
  background: rgba(6, 182, 212, 0.2);
  border: 1px solid rgba(6, 182, 212, 0.3);
}

/* Enhanced Lasso Controls */
.lasso-controls {
   align-items: center; 
  background: rgba(30, 41, 59, 0.8);
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  backdrop-filter: blur(4px);
}

.lasso-mode-selector {
  display: flex;
  gap: 4px;
  background: rgba(15, 23, 42, 0.6);
  border-radius: 8px;
  padding: 4px;
}

.lasso-mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 12px;
  font-weight: 600;
}

.lasso-mode-btn:hover {
  background: rgba(148, 163, 184, 0.1);
  color: #f1f5f9;
}

.lasso-mode-btn.active {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  color: white;
}

.lasso-mode-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.lasso-icon {
  font-size: 14px;
}

.lasso-label {
  font-size: 11px;
}
</style>
