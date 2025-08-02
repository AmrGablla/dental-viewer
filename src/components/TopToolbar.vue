<template>
  <div class="top-toolbar">
    <div class="toolbar-section">
      <div class="app-title">
        <span class="app-icon">◈</span>
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
          <span class="btn-icon" :class="{ 'rotating': isLoading }">{{ isLoading ? '⟳' : '⬆' }}</span>
          {{ getUploadButtonText() }}
        </button>
        <button @click="toggleAutoSegmentation" class="toolbar-btn toggle-btn" :class="{ active: autoSegmentationEnabled }">
          <span class="btn-icon">{{ autoSegmentationEnabled ? '🤖' : '⚙️' }}</span>
          Auto AI: {{ autoSegmentationEnabled ? 'ON' : 'OFF' }}
        </button>
        <button @click="exportModel" :disabled="!dentalModel || isLoading" class="toolbar-btn">
          <span class="btn-icon">⬇</span>
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { DentalModel, ToothSegment, InteractionMode } from '../types/dental'

// Props
interface Props {
  dentalModel: DentalModel | null
  selectedSegments: ToothSegment[]
  currentMode: InteractionMode['mode']
  isLoading: boolean
  interactionModes: InteractionMode['mode'][]
  autoSegmentationEnabled?: boolean
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  fileUpload: [event: Event, autoSegment: boolean]
  exportModel: []
  setInteractionMode: [mode: InteractionMode['mode']]
  toggleAutoSegmentation: []
}>()

// Refs
const fileInput = ref<HTMLInputElement>()

// Methods
function triggerFileUpload() {
  fileInput.value?.click()
}

function handleFileUpload(event: Event) {
  const autoSegment = props.autoSegmentationEnabled || false
  emit('fileUpload', event, autoSegment)
}

function exportModel() {
  emit('exportModel')
}

function toggleAutoSegmentation() {
  emit('toggleAutoSegmentation')
}

function setInteractionMode(mode: InteractionMode['mode']) {
  emit('setInteractionMode', mode)
}

function getUploadButtonText(): string {
  if (props.isLoading) {
    return 'Processing...'
  }
  
  if (props.autoSegmentationEnabled) {
    return 'Load & AI Segment'
  }
  
  return 'Load STL'
}

function getModeIcon(mode: InteractionMode['mode']): string {
  const icons = {
    select: '◉',
    lasso: '○',
    move: '⧨',
    rotate: '⟲'
  }
  return icons[mode] || '◈'
}

function isInteractionModeDisabled(_mode: InteractionMode['mode']): boolean {
  return !props.dentalModel
}

function getInteractionModeTitle(mode: InteractionMode['mode']): string {
  const titles = {
    select: 'Click to select individual segments',
    lasso: props.dentalModel?.segments.length === 0
      ? 'Draw lasso to create new segments manually'
      : 'Draw lasso to select multiple segments',
    move: 'Move selected segments',
    rotate: 'Rotate view (drag to orbit camera)'
  }
  return titles[mode] || mode.charAt(0).toUpperCase() + mode.slice(1)
}
</script>

<style scoped>
/* Top Toolbar */
.top-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding: 12px 20px;
  height: 64px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  z-index: 1000;
}

.toolbar-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toolbar-center {
  flex: 1;
  justify-content: center;
  gap: 32px;
}

.app-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.app-icon {
  font-size: 28px;
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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

.toolbar-btn.toggle-btn {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  border-color: #9ca3af;
  color: white;
}

.toolbar-btn.toggle-btn:hover {
  background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
  box-shadow: 0 4px 20px rgba(107, 114, 128, 0.4);
}

.toolbar-btn.toggle-btn.active {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  border-color: #10b981;
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
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
  font-size: 16px;
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
</style>
