<template>
  <div class="left-sidebar">
    <!-- Visibility Controls -->
    <div class="panel" v-if="dentalModel && dentalModel.segments.length > 0">
      <div class="panel-header">
        <span class="panel-icon">◑</span>
        <span class="panel-title">Visibility</span>
      </div>
      <div class="panel-content">
        <button 
          @click="toggleOriginalMesh" 
          class="btn btn-secondary full-width"
          style="margin-bottom: 8px;"
        >
          {{ dentalModel?.originalMesh?.visible ? 'Hide Original' : 'Show Original' }}
        </button>
        <button 
          @click="toggleAllSegments" 
          class="btn btn-secondary full-width"
        >
          {{ areAllSegmentsVisible() ? 'Hide All' : 'Show All' }}
        </button>
      </div>
    </div>

    <!-- Segment Management -->
    <div class="panel" v-if="dentalModel && dentalModel.segments.length > 0">
      <div class="panel-header">
        <span class="panel-icon">◉</span>
        <span class="panel-title">All Segments</span>
        <span class="panel-badge">{{ dentalModel.segments.length }}</span>
      </div>
      <div class="panel-content">
        <div class="segment-list">
          <SegmentItem
            v-for="segment in dentalModel.segments"
            :key="segment.id"
            :segment="segment"
            :selectedSegments="selectedSegments"
            @toggleSegmentSelection="handleToggleSegmentSelection"
            @changeSegmentColor="handleChangeSegmentColor"
            @resetIndividualPosition="handleResetIndividualPosition"
            @toggleSegmentVisibility="handleToggleSegmentVisibility"
          />
        </div>
        
        <MovementControls
          :selectedSegments="selectedSegments"
          :totalMovementDistance="totalMovementDistance"
          @resetSegmentPosition="handleResetSegmentPosition"
          @startDirectionalMove="handleStartDirectionalMove"
          @stopDirectionalMove="handleStopDirectionalMove"
        />
        
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
  </div>
</template>

<script setup lang="ts">
import SegmentItem from './SegmentItem.vue'
import MovementControls from './MovementControls.vue'
import type { DentalModel, ToothSegment } from '../types/dental'

// Props
interface Props {
  dentalModel: DentalModel | null
  selectedSegments: ToothSegment[]
  totalMovementDistance: number
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  toggleOriginalMesh: []
  toggleAllSegments: []
  toggleSegmentSelection: [segment: ToothSegment]
  changeSegmentColor: [segment: ToothSegment, event: Event]
  resetIndividualPosition: [segment: ToothSegment]
  toggleSegmentVisibility: [segment: ToothSegment]
  resetSegmentPosition: []
  startDirectionalMove: [axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number]
  stopDirectionalMove: []
  mergeSelectedSegments: []
  splitSelectedSegment: []
  deleteSelectedSegments: []
}>()

function toggleOriginalMesh() {
  emit('toggleOriginalMesh')
}

function toggleAllSegments() {
  emit('toggleAllSegments')
}

function areAllSegmentsVisible(): boolean {
  if (!props.dentalModel?.segments.length) return false
  return props.dentalModel.segments.every(segment => segment.mesh.visible)
}

function handleToggleSegmentSelection(segment: ToothSegment) {
  emit('toggleSegmentSelection', segment)
}

function handleChangeSegmentColor(segment: ToothSegment, event: Event) {
  emit('changeSegmentColor', segment, event)
}

function handleResetIndividualPosition(segment: ToothSegment) {
  emit('resetIndividualPosition', segment)
}

function handleToggleSegmentVisibility(segment: ToothSegment) {
  emit('toggleSegmentVisibility', segment)
}

function handleResetSegmentPosition() {
  emit('resetSegmentPosition')
}

function handleStartDirectionalMove(axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number) {
  emit('startDirectionalMove', axis, direction)
}

function handleStopDirectionalMove() {
  emit('stopDirectionalMove')
}

function mergeSelectedSegments() {
  emit('mergeSelectedSegments')
}

function splitSelectedSegment() {
  emit('splitSelectedSegment')
}

function deleteSelectedSegments() {
  emit('deleteSelectedSegments')
}
</script>

<style scoped>
/* Left Sidebar */
.left-sidebar {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-right: 1px solid rgba(148, 163, 184, 0.2);
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
}

/* Panel Styles */
.panel {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.8) 100%);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 16px;
  overflow: visible;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  position: relative;
  flex-shrink: 0;
}

.panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.5), transparent);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(8, 145, 178, 0.1) 100%);
  border-bottom: 1px solid rgba(6, 182, 212, 0.2);
}

.panel-icon {
  font-size: 16px;
  color: #06b6d4;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: #f1f5f9;
  flex: 1;
}

.panel-badge {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
  min-width: 20px;
  text-align: center;
}

.panel-content {
  padding: 14px;
}

.segment-list {
  max-height: none;
  overflow-y: visible;
  margin-bottom: 16px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(6, 182, 212, 0.2);
}

.action-buttons .btn {
  flex: 1;
  min-width: 80px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.info-item:last-child {
  border-bottom: none;
}

.info-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
}

.info-value {
  font-size: 12px;
  color: #f1f5f9;
  font-weight: 600;
}

/* Button styles */
.btn {
  padding: 12px 16px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid;
  position: relative;
  overflow: visible;
  white-space: nowrap;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
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

.btn-danger {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.8) 100%);
  border-color: rgba(239, 68, 68, 0.5);
  color: #ffffff;
}

.btn-danger:hover {
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.9) 0%, rgba(185, 28, 28, 0.9) 100%);
  border-color: rgba(239, 68, 68, 0.8);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.3);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.full-width {
  width: 100%;
}
</style>
