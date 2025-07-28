<template>
  <div class="movement-controls" v-if="selectedSegments.length > 0">
    <div class="movement-header">
      <span class="movement-icon">◈</span>
      <span class="movement-title">Movement</span>
    </div>
    
    <!-- Movement Reset Button -->
    <div class="movement-buttons">
      <button 
        @click="resetSegmentPosition" 
        :disabled="totalMovementDistance === 0"
        class="btn btn-secondary movement-btn"
      >
        <span>⟲</span> Reset
      </button>
    </div>
    
    <!-- Directional Controls -->
    <div class="direction-controls">
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
</template>

<script setup lang="ts">
import type { ToothSegment } from '../types/dental'

// Props
interface Props {
  selectedSegments: ToothSegment[]
  totalMovementDistance: number
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  resetSegmentPosition: []
  startDirectionalMove: [axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number]
  stopDirectionalMove: []
}>()

function resetSegmentPosition() {
  emit('resetSegmentPosition')
}

function startDirectionalMove(axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number) {
  emit('startDirectionalMove', axis, direction)
}

function stopDirectionalMove() {
  emit('stopDirectionalMove')
}
</script>

<style scoped>
.movement-controls {
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 16px;
  padding: 16px;
  margin-top: 16px;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.movement-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(6, 182, 212, 0.2);
}

.movement-icon {
  font-size: 16px;
  color: #06b6d4;
}

.movement-title {
  font-size: 14px;
  font-weight: 700;
  color: #f1f5f9;
}

.movement-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.movement-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  width: 100%;
}

.direction-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.axis-control-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.axis-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.axis-buttons {
  display: flex;
  gap: 4px;
}

.direction-btn {
  flex: 1;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(51, 65, 85, 0.8) 0%, rgba(71, 85, 105, 0.8) 100%);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.direction-btn:hover {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(8, 145, 178, 0.2) 100%);
  border-color: rgba(6, 182, 212, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.3);
}

.direction-btn:active {
  transform: translateY(0);
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(8, 145, 178, 0.3) 100%);
}

.movement-display {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(6, 182, 212, 0.2);
}

.total-distance {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: #06b6d4;
  background: rgba(6, 182, 212, 0.1);
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid rgba(6, 182, 212, 0.3);
}

/* Button styles */
.btn {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid;
  position: relative;
  overflow: hidden;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.6s ease;
}

.btn:hover::before {
  left: 100%;
}

.btn-secondary {
  background: linear-gradient(135deg, rgba(51, 65, 85, 0.8) 0%, rgba(71, 85, 105, 0.8) 100%);
  border-color: rgba(148, 163, 184, 0.3);
  color: #f1f5f9;
}

.btn-secondary:hover {
  background: linear-gradient(135deg, rgba(71, 85, 105, 0.9) 0%, rgba(100, 116, 139, 0.9) 100%);
  border-color: rgba(148, 163, 184, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}
</style>
