<template>
  <div class="viewport">
    <div ref="canvasContainer" class="canvas-container">
      <LoadingOverlay :isLoading="isLoading" :loadingMessage="loadingMessage" />
      
      <!-- Movement Controls -->
      <MovementControls
        v-if="dentalModel && selectedSegments.length > 0"
        :selectedSegments="selectedSegments"
        :totalMovementDistance="totalMovementDistance"
        @startDirectionalMove="handleStartDirectionalMove"
        @stopDirectionalMove="handleStopDirectionalMove"
      />
      
      <ViewPresets v-if="dentalModel" @setViewPreset="handleSetViewPreset" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineExpose } from 'vue'
import type { DentalModel, InteractionMode, ToothSegment } from '../types/dental'
import LoadingOverlay from './LoadingOverlay.vue'
import ViewPresets from './ViewPresets.vue'
import MovementControls from './MovementControls.vue'

interface Props {
  dentalModel: DentalModel | null
  currentMode: InteractionMode['mode']
  isLoading: boolean
  loadingMessage: string
  selectedSegments: ToothSegment[]
  totalMovementDistance: number
}

interface Emits {
  (e: 'setViewPreset', preset: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right'): void
  (e: 'startDirectionalMove', axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number): void
  (e: 'stopDirectionalMove'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const canvasContainer = ref<HTMLDivElement>()

// Functions
function getModeIcon(mode: InteractionMode['mode']): string {
  const icons = {
    select: '🖱️',
    lasso: '✏️',
    move: '✋',
    rotate: '🔄'
  }
  return icons[mode] || '◈'
}

function handleSetViewPreset(preset: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') {
  emit('setViewPreset', preset)
}

function handleStartDirectionalMove(axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number) {
  emit('startDirectionalMove', axis, direction)
}

function handleStopDirectionalMove() {
  emit('stopDirectionalMove')
}

// Expose the canvas container ref to parent component
defineExpose({
  canvasContainer
})
</script>

<style scoped>
/* Viewport */
.viewport {
  flex: 1;
  position: relative;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  overflow: hidden;
  border-radius: 20px;
  margin: 8px;
  box-shadow: inset 0 2px 20px rgba(0, 0, 0, 0.4);
}

.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 20px;
  overflow: hidden;
}

.canvas-container :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  border-radius: 20px;
}

/* Cursor styles for different interaction modes */
.canvas-container :deep(canvas[data-mode="lasso"]) {
  cursor: crosshair;
}

.canvas-container :deep(canvas[data-mode="select"]) {
  cursor: pointer;
}

.canvas-container :deep(canvas[data-mode="rotate"]) {
  cursor: grab;
}

.canvas-container :deep(canvas[data-mode="move"]) {
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
</style>
