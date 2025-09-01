<template>
  <div 
    class="segment-item"
    :class="{ selected: isSelected }"
    @click="toggleSegmentSelection"
  >
    <div class="segment-header">
      <div class="segment-info">
        <span class="segment-selection-indicator">
          <span class="selection-dot" :class="{ active: isSelected }"></span>
        </span>
        <span 
          v-if="!isEditing" 
          class="segment-name" 
          @dblclick.stop="startEditing"
        >
          {{ segment.name }}
        </span>
        <input
          v-else
          ref="nameInput"
          v-model="editingName"
          class="segment-name-input"
          @blur="saveName"
          @keyup.enter="saveName"
          @keyup.esc="cancelEditing"
          @click.stop
        />
        <span class="segment-type">{{ segment.toothType }}</span>
      </div>
      <div class="segment-controls">
        <input 
          type="color" 
          :value="segmentColorHex"
          @change="changeSegmentColor"
          @click.stop
          class="color-picker"
        />
        <button 
          class="btn btn-sm btn-random-color" 
          @click.stop="generateRandomColor"
          title="Generate random color"
          :style="{ backgroundColor: segmentColorHex }"
        >
          <Icon name="shuffle" :size="12" color="currentColor" />
        </button>
      </div>
    </div>
    
    <!-- Always show segment controls -->
    <div class="segment-expanded">
      <div class="segment-actions">
        <button 
          class="btn btn-sm btn-secondary" 
          @click.stop="resetIndividualPosition"
          :disabled="!isSelected"
        >
          <Icon name="rotate-ccw" :size="14" color="currentColor" />
          Reset
        </button>
        <button 
          class="btn btn-sm btn-secondary" 
          @click.stop="toggleSegmentVisibility"
        >
          <Icon 
            v-if="segment.mesh.visible"
            name="eye" 
            :size="14" 
            color="currentColor" 
          />
          <Icon 
            v-else
            name="eye-off" 
            :size="14" 
            color="currentColor" 
          />
        </button>
        <button 
          class="btn btn-sm btn-danger" 
          @click.stop="deleteSegment"
          title="Delete segment"
        >
          <Icon name="trash-2" :size="14" color="currentColor" />
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
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import Icon from './Icon.vue'
import type { ToothSegment } from '../types/dental'

// Props
interface Props {
  segment: ToothSegment
  selectedSegments: ToothSegment[]
}

const props = defineProps<Props>()

// Reactive state for editing
const isEditing = ref(false)
const editingName = ref('')
const nameInput = ref<HTMLInputElement>()

// Computed property to check if segment is selected
const isSelected = computed(() => {
  return props.selectedSegments.some(s => s.id === props.segment.id)
})

// Computed property for segment color hex
const segmentColorHex = computed(() => {
  return getSegmentColorHex();
})

// Emits
const emit = defineEmits<{
  toggleSegmentSelection: [segment: ToothSegment]
  changeSegmentColor: [segment: ToothSegment, event: Event]
  resetIndividualPosition: [segment: ToothSegment]
  toggleSegmentVisibility: [segment: ToothSegment]
  deleteSegment: [segment: ToothSegment]
  renameSegment: [segment: ToothSegment, newName: string]
  generateRandomColor: [segment: ToothSegment]
}>()

function toggleSegmentSelection() {
  emit('toggleSegmentSelection', props.segment)
}

function changeSegmentColor(event: Event) {
  emit('changeSegmentColor', props.segment, event)
}

function resetIndividualPosition() {
  emit('resetIndividualPosition', props.segment)
}

function toggleSegmentVisibility() {
  emit('toggleSegmentVisibility', props.segment)
}

function deleteSegment() {
  emit('deleteSegment', props.segment)
}

// Rename functionality
function startEditing() {
  editingName.value = props.segment.name
  isEditing.value = true
  nextTick(() => {
    nameInput.value?.focus()
    nameInput.value?.select()
  })
}

function saveName() {
  const newName = editingName.value.trim()
  if (newName && newName !== props.segment.name) {
    emit('renameSegment', props.segment, newName)
  }
  isEditing.value = false
}

function cancelEditing() {
  isEditing.value = false
  editingName.value = ''
}

function generateRandomColor() {
  emit('generateRandomColor', props.segment)
}

function getSegmentColorHex(): string {
  const color = props.segment.color;
  
  // If it's a THREE.js Color object
  if (color && typeof color.getHexString === 'function') {
    return '#' + color.getHexString();
  }
  
  // If it's already a hex string
  if (typeof color === 'string' && (color as string).startsWith('#')) {
    return color as string;
  }
  
  // If it's a number (hex value)
  if (typeof color === 'number') {
    return '#' + (color as number).toString(16).padStart(6, '0');
  }
  
  // Default fallback
  return '#00ff00';
}
</script>

<style scoped>
.segment-item {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(51, 65, 85, 0.4) 100%);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(8px);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.segment-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.5), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.segment-item.selected {
  border-color: rgba(6, 182, 212, 0.8);
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(8, 145, 178, 0.2) 100%);
  box-shadow: 0 4px 20px rgba(6, 182, 212, 0.3), 0 0 0 1px rgba(6, 182, 212, 0.3);
  transform: translateY(-1px);
}

.segment-item.selected::before {
  opacity: 1;
}

.segment-item:hover:not(.selected) {
  border-color: rgba(6, 182, 212, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
}

.segment-item:hover.selected {
  box-shadow: 0 6px 25px rgba(6, 182, 212, 0.4), 0 0 0 1px rgba(6, 182, 212, 0.4);
}

.segment-item:hover .selection-dot:not(.active) {
  border-color: rgba(6, 182, 212, 0.6);
  transform: scale(1.1);
}

.segment-item:hover .selection-dot.active {
  box-shadow: 0 0 16px rgba(6, 182, 212, 0.8), 0 0 6px rgba(6, 182, 212, 1);
}

.segment-item:active {
  transform: translateY(0);
}

.segment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.segment-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.segment-selection-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.selection-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(6, 182, 212, 0.3);
  background: transparent;
  transition: all 0.3s ease;
  position: relative;
  transform: scale(1);
  box-shadow: none;
}

.selection-dot.active {
  border-color: #06b6d4;
  background: #06b6d4;
  box-shadow: 0 0 12px rgba(6, 182, 212, 0.6), 0 0 4px rgba(6, 182, 212, 0.8);
  transform: scale(1.1);
}

.selection-dot.active::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ffffff;
}

.segment-name {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 13px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.segment-name:hover {
  background-color: rgba(6, 182, 212, 0.1);
}

.segment-name-input {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 13px;
  background: rgba(6, 182, 212, 0.2);
  border: 1px solid rgba(6, 182, 212, 0.5);
  border-radius: 4px;
  padding: 2px 4px;
  outline: none;
  min-width: 80px;
}

.segment-type {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: capitalize;
}

.segment-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: none;
  overflow: hidden;
}

.btn-random-color {
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: #ffffff;
  min-width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.btn-random-color::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.2);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.btn-random-color:hover::before {
  opacity: 1;
}

.btn-random-color:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.btn-random-color svg {
  position: relative;
  z-index: 1;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.segment-expanded {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.segment-actions {
  display: flex;
  gap: 6px;
}

.btn {
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid;
  display: flex;
  align-items: center;
  gap: 4px;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 10px;
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
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-danger {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.8) 100%);
  border-color: rgba(239, 68, 68, 0.5);
  color: #ffffff;
}

.btn-danger:hover {
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.9) 0%, rgba(185, 28, 28, 0.9) 100%);
  border-color: rgba(239, 68, 68, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.individual-movement-info {
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 8px;
  padding: 8px;
  margin-top: 8px;
}

.movement-summary {
  margin-bottom: 6px;
}

.movement-distance {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.distance-label {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 500;
}

.distance-value {
  font-size: 11px;
  font-weight: 700;
  color: #06b6d4;
}

.axis-breakdown {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.axis-movement-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 10px;
}

.axis-label {
  color: #94a3b8;
  font-weight: 500;
}

.axis-value {
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', monospace;
}

.axis-value.positive {
  color: #10b981;
}

.axis-value.negative {
  color: #ef4444;
}
</style>
