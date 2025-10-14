<template>
  <div class="selection-toolbar" v-if="currentMode === 'lasso' || currentMode === 'brush'">
    <div class="tool-section">
      <h4>Selection Tool</h4>
      <div class="tool-selector">
        <button 
          v-for="tool in selectionTools"
          :key="tool.id"
          @click="setSelectionTool(tool.id)"
          :class="{ active: currentTool === tool.id }"
          class="tool-btn"
          :title="tool.description"
        >
          <span class="tool-icon">{{ tool.icon }}</span>
          <span class="tool-label">{{ tool.label }}</span>
        </button>
      </div>
    </div>

    <!-- Lasso Mode Controls -->
    <div v-if="currentMode === 'lasso'" class="mode-section">
      <h4>Lasso Mode</h4>
      <div class="mode-selector">
        <button 
          v-for="lassoMode in lassoModes" 
          :key="lassoMode.id"
          @click="setLassoMode(lassoMode.id)"
          :class="{ 
            active: currentLassoMode === lassoMode.id,
            disabled: isLassoModeDisabled(lassoMode.id)
          }"
          class="mode-btn"
          :title="lassoMode.title"
          :disabled="isLassoModeDisabled(lassoMode.id)"
        >
          <span class="mode-icon">{{ lassoMode.icon }}</span>
          <span class="mode-label">{{ lassoMode.label }}</span>
        </button>
      </div>
    </div>

    <!-- Brush Controls -->
    <div v-if="currentMode === 'brush'" class="brush-section">
      <h4>Brush Settings</h4>
      <div class="brush-controls">
        <div class="brush-size-control">
          <label for="brush-size">Size: {{ brushRadius }}px</label>
          <input 
            id="brush-size"
            type="range" 
            :value="brushRadius" 
            @input="updateBrushRadius($event)"
            min="5" 
            max="100" 
            step="1"
            class="brush-slider"
          />
        </div>
        <div class="brush-actions">
          <button 
            @click="clearBrushSelection"
            class="brush-action-btn clear-btn"
            title="Clear current brush selection"
          >
            <span>🧹</span> Clear
          </button>
        </div>
      </div>
    </div>

    <!-- Tool Settings -->
    <div class="settings-section">
      <h4>Settings</h4>
      <div class="settings-controls">
        <label class="setting-checkbox">
          <input 
            type="checkbox" 
            :checked="depthAware" 
            @change="toggleDepthAware"
          />
          <span>Depth Aware Selection</span>
          <small>Only select visible surfaces</small>
        </label>
        <label class="setting-checkbox">
          <input 
            type="checkbox" 
            :checked="surfaceOnly" 
            @change="toggleSurfaceOnly"
          />
          <span>Surface Only</span>
          <small>Exclude back-facing vertices</small>
        </label>
      </div>
    </div>

    <!-- Selection Info -->
    <div v-if="selectionInfo" class="info-section">
      <h4>Selection Info</h4>
      <div class="selection-stats">
        <div class="stat">
          <span class="stat-label">Vertices:</span>
          <span class="stat-value">{{ selectionInfo.vertexCount || 0 }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Tool:</span>
          <span class="stat-value">{{ getCurrentToolName() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DentalModel, ToothSegment, InteractionMode, SelectionToolSettings } from '../types/dental'
import type { LassoMode } from '../services/EnhancedLassoService'

// Props
interface Props {
  dentalModel: DentalModel | null
  selectedSegments: ToothSegment[]
  currentMode: InteractionMode['mode']
  toolSettings: SelectionToolSettings
  selectionInfo?: {
    vertexCount: number
    toolUsed: string
  } | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  setLassoMode: [mode: LassoMode]
  updateToolSettings: [settings: Partial<SelectionToolSettings>]
  clearBrushSelection: []
}>()

// Refs
const currentLassoMode = ref<LassoMode>('create')
const currentTool = ref<SelectionToolSettings['tool']>('depth-aware-lasso')
const brushRadius = ref(15)
const depthAware = ref(true)
const surfaceOnly = ref(true)

// Selection tools configuration
const selectionTools = [
  {
    id: 'enhanced-lasso' as const,
    label: 'Enhanced Lasso',
    icon: '✏️',
    description: 'Original enhanced lasso tool with basic selection'
  },
  {
    id: 'depth-aware-lasso' as const,
    label: 'Smart Lasso',
    icon: '🎯',
    description: 'Depth-aware lasso that only selects visible surfaces'
  },
  {
    id: 'surface-brush' as const,
    label: 'Surface Brush',
    icon: '🖌️',
    description: 'Brush tool for continuous surface selection'
  }
]

// Lasso modes configuration
const lassoModes = [
  {
    id: 'create' as LassoMode,
    label: 'Create',
    icon: '➕',
    title: 'Create new segment from selection'
  },
  {
    id: 'select' as LassoMode,
    label: 'Select',
    icon: '👆',
    title: 'Select existing segments'
  },
  {
    id: 'add' as LassoMode,
    label: 'Add',
    icon: '📎',
    title: props.selectedSegments.length > 0 
      ? 'Add selection to current segment'
      : 'Select a segment first, then use lasso to add vertices to it'
  },
  {
    id: 'subtract' as LassoMode,
    label: 'Remove',
    icon: '✂️',
    title: props.selectedSegments.length > 0 
      ? 'Remove selection from current segment'
      : 'Select a segment first, then use lasso to remove vertices from it'
  }
]

// Computed
const getCurrentToolName = computed(() => {
  const tool = selectionTools.find(t => t.id === currentTool.value)
  return tool?.label || 'Unknown'
})

// Methods
function setSelectionTool(toolId: SelectionToolSettings['tool']) {
  currentTool.value = toolId
  emit('updateToolSettings', { tool: toolId })
}

function setLassoMode(mode: LassoMode) {
  currentLassoMode.value = mode
  emit('setLassoMode', mode)
}

function isLassoModeDisabled(mode: LassoMode): boolean {
  // Add and subtract modes require a selected segment
  if ((mode === 'add' || mode === 'subtract') && props.selectedSegments.length === 0) {
    return true
  }
  return false
}

function updateBrushRadius(event: Event) {
  const target = event.target as HTMLInputElement
  brushRadius.value = parseInt(target.value)
  emit('updateToolSettings', { brushRadius: brushRadius.value })
}

function toggleDepthAware() {
  depthAware.value = !depthAware.value
  emit('updateToolSettings', { depthAware: depthAware.value })
}

function toggleSurfaceOnly() {
  surfaceOnly.value = !surfaceOnly.value
  emit('updateToolSettings', { surfaceOnly: surfaceOnly.value })
}

function clearBrushSelection() {
  emit('clearBrushSelection')
}
</script>

<style scoped>
.selection-toolbar {
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 16px;
  margin: 8px 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.tool-section,
.mode-section,
.brush-section,
.settings-section,
.info-section {
  margin-bottom: 16px;
}

.tool-section h4,
.mode-section h4,
.brush-section h4,
.settings-section h4,
.info-section h4 {
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-selector,
.mode-selector {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tool-btn,
.mode-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tool-btn:hover,
.mode-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

.tool-btn.active,
.mode-btn.active {
  background: #51CACD;
  border-color: #51CACD;
  color: #000000;
}

.tool-btn.disabled,
.mode-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.05);
}

.tool-icon,
.mode-icon {
  font-size: 14px;
}

.tool-label,
.mode-label {
  font-weight: 500;
}

.brush-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brush-size-control {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.brush-size-control label {
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
}

.brush-slider {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.2);
  outline: none;
  -webkit-appearance: none;
}

.brush-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #51CACD;
  cursor: pointer;
}

.brush-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #51CACD;
  cursor: pointer;
  border: none;
}

.brush-actions {
  display: flex;
  gap: 8px;
}

.brush-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.brush-action-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.brush-action-btn.clear-btn:hover {
  background: rgba(255, 68, 68, 0.2);
  border-color: rgba(255, 68, 68, 0.4);
}

.settings-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-checkbox {
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
}

.setting-checkbox input[type="checkbox"] {
  margin-right: 8px;
  width: 14px;
  height: 14px;
}

.setting-checkbox small {
  color: rgba(255, 255, 255, 0.6);
  font-size: 10px;
  margin-left: 22px;
}

.selection-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #ffffff;
}

.stat-label {
  color: rgba(255, 255, 255, 0.7);
}

.stat-value {
  font-weight: 600;
  color: #51CACD;
}
</style>