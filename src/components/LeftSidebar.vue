<template>
  <div class="left-sidebar">
    <!-- Tab Navig      <div class="panel segment-panel" v-if="dentalModel && dentalModel.segments.length > 0">
        <div class="panel-header">
          <Icon name="grid" :size="16" color="currentColor" class="panel-icon" />
          <span class="panel-title">Segments</span>le -->
    <div class="tab-navigation">
      <button 
        class="tab-button"
        :class="{ active: activeTab === 'segments' }"
        @click="activeTab = 'segments'"
      >
        <Icon name="layers" :size="16" color="currentColor" class="tab-icon" />
        <span>Segments</span>
        <span v-if="dentalModel && dentalModel.segments.length > 0" class="tab-badge">{{ dentalModel.segments.length }}</span>
      </button>
      <button 
        class="tab-button"
        :class="{ active: activeTab === 'treatment' }"
        @click="activeTab = 'treatment'"
      >
        <Icon name="file-text" :size="16" color="currentColor" class="tab-icon" />
        <span>Treatment Plan</span>
      </button>
    </div>

    <!-- Segments Tab -->
    <div v-show="activeTab === 'segments'">
      <!-- No segments message -->
      <div v-if="!dentalModel || dentalModel.segments.length === 0" class="no-segments">
        <div class="no-segments-content">
          <h4>No Segments Available</h4>
          <p>Load an STL file and use the lasso tool to create segments, or enable AI segmentation when uploading.</p>
        </div>
      </div>

      <!-- Visibility Controls -->
      <div class="panel" v-if="dentalModel && dentalModel.segments.length > 0">
        <div class="panel-header">
          <Icon name="eye" :size="16" color="currentColor" class="panel-icon" />
          <span class="panel-title">Visibility</span>
        </div>
        <div class="panel-content compact">
          <div class="visibility-buttons">
            <button 
              @click="toggleOriginalMesh" 
              class="btn btn-secondary btn-compact"
            >
              <Icon 
                :name="isOriginalMeshVisible ? 'eye-off' : 'eye'" 
                :size="14" 
                color="currentColor" 
                class="icon"
              />
              {{ isOriginalMeshVisible ? 'Hide' : 'Show' }} Original
            </button>
            <button 
              @click="toggleAllSegments" 
              class="btn btn-secondary btn-compact"
            >
              <Icon 
                :name="areAllSegmentsVisible ? 'eye-off' : 'eye'" 
                :size="14" 
                color="currentColor" 
                class="icon"
              />
              {{ areAllSegmentsVisible ? 'Hide All' : 'Show All' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Intersection Information -->
      <div class="panel intersection-panel" v-if="intersectionResults && intersectionResults.length > 0">
        <div class="panel-header">
          <svg 
            class="panel-icon" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27,6.96 12,12.01 20.73,6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span class="panel-title">Intersections</span>
          <span class="panel-badge intersection-badge">{{ intersectionResults.length }}</span>
        </div>
        <div class="panel-content">
          <div class="intersection-list">
            <div 
              v-for="(intersection, index) in intersectionResults" 
              :key="`${intersection.segment1.id}-${intersection.segment2.id}`"
              class="intersection-item"
            >
              <div class="intersection-header">
                <span class="intersection-number">{{ index + 1 }}</span>
                <span class="intersection-segments">
                  {{ intersection.segment1.name }} ↔ {{ intersection.segment2.name }}
                </span>
                <span class="intersection-severity" :class="intersection.severity">
                  {{ intersection.severity }}
                </span>
              </div>
              <div class="intersection-details">
                <div class="detail-row">
                  <span class="detail-label">Volume:</span>
                  <span class="detail-value">{{ intersection.intersectionVolume.toFixed(2) }} mm³</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Penetration:</span>
                  <span class="detail-value">{{ intersection.penetrationDepth.toFixed(2) }} mm</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Contact Area:</span>
                  <span class="detail-value">{{ intersection.contactArea.toFixed(2) }} mm²</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Segment Management -->
      <div class="panel segment-panel" v-if="dentalModel && dentalModel.segments.length > 0">
        <div class="panel-header">
          <!-- Grid icon for segments -->
          <svg 
            class="panel-icon" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
          <span class="panel-title">All Segments</span>
          <span class="panel-badge">{{ dentalModel.segments.length }}</span>
        </div>
        <div class="panel-content segment-content">
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
              @deleteSegment="handleDeleteSegment"
              @renameSegment="handleRenameSegment"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Treatment Plan Tab - Always available -->
    <div v-show="activeTab === 'treatment'" class="treatment-tab">
      <TreatmentPlanPanel
        :segments="dentalModel?.segments || []"
        :isVisible="activeTab === 'treatment'"
        :isFullScreenMode="false"
        :currentTreatmentPlan="currentTreatmentPlan"
        :reactivityKey="reactivityKey"
        @planCreated="handlePlanCreated"
        @planUpdated="handlePlanUpdated"
        @stepChanged="handleStepChanged"
        @toggleFullScreen="handleTreatmentPlanFullScreen"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Icon from './Icon.vue'
import SegmentItem from './SegmentItem.vue'
import TreatmentPlanPanel from './TreatmentPlanPanel.vue'
import type { DentalModel, ToothSegment, OrthodonticTreatmentPlan } from '../types/dental'

// Props
interface Props {
  dentalModel: DentalModel | null
  selectedSegments: ToothSegment[]
  currentTreatmentPlan?: OrthodonticTreatmentPlan | null
  intersectionResults?: any[] // IntersectionResult[]
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
  deleteSegment: [segment: ToothSegment]
  renameSegment: [segment: ToothSegment, newName: string]
  planCreated: [plan: OrthodonticTreatmentPlan]
  planUpdated: [plan: OrthodonticTreatmentPlan | null]
  stepChanged: [stepNumber: number]
  treatmentPlanFullScreen: [isFullScreen: boolean]
}>()

// Local state
const activeTab = ref<'segments' | 'treatment'>('segments')
const reactivityKey = ref(0)

function toggleOriginalMesh() {
  emit('toggleOriginalMesh')
}

function toggleAllSegments() {
  emit('toggleAllSegments')
}

const areAllSegmentsVisible = computed(() => {
  if (!props.dentalModel?.segments.length) return false
  return props.dentalModel.segments.every(segment => segment.mesh.visible)
})

const isOriginalMeshVisible = computed(() => {
  return props.dentalModel?.originalMesh?.visible ?? false
})

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

function handleDeleteSegment(segment: ToothSegment) {
  emit('deleteSegment', segment)
}

function handleRenameSegment(segment: ToothSegment, newName: string) {
  emit('renameSegment', segment, newName)
}

// Watch for changes in dentalModel to trigger reactivity updates
watch(() => props.dentalModel, () => {
  reactivityKey.value++
}, { deep: true })

// Also watch segments specifically for movement changes
watch(() => props.dentalModel?.segments, (segments) => {
  if (segments) {
    // Check if any segments have movement
    const hasMovement = segments.some(segment => 
      segment.movementHistory && 
      (Math.abs(segment.movementHistory.axisMovements?.anteroposterior || 0) > 0.1 ||
       Math.abs(segment.movementHistory.axisMovements?.vertical || 0) > 0.1 ||
       Math.abs(segment.movementHistory.axisMovements?.transverse || 0) > 0.1)
    )
    if (hasMovement) {
      reactivityKey.value++
    }
  }
}, { deep: true })

function handlePlanCreated(plan: OrthodonticTreatmentPlan) {
  emit('planCreated', plan)
}

function handlePlanUpdated(plan: OrthodonticTreatmentPlan | null) {
  emit('planUpdated', plan)
}

function handleStepChanged(stepNumber: number) {
  emit('stepChanged', stepNumber)
}



function handleTreatmentPlanFullScreen(isFullScreen: boolean) {
  emit('treatmentPlanFullScreen', isFullScreen)
}
</script>

<style scoped>
/* Left Sidebar */
.left-sidebar {
  width: 320px;
  min-width: 320px;
  max-width: 320px;
  height: calc(100vh - 64px); /* Subtract toolbar height */
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-right: 1px solid rgba(148, 163, 184, 0.2);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 20px rgba(0, 0, 0, 0.3);
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  background: rgba(30, 41, 59, 0.8);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.tab-button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: rgba(226, 232, 240, 0.7);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.tab-button:hover {
  background: rgba(51, 65, 85, 0.5);
  color: rgba(226, 232, 240, 0.9);
}

.tab-button.active {
  background: rgba(6, 182, 212, 0.1);
  color: #06b6d4;
  border-bottom: 2px solid #06b6d4;
}

.tab-icon {
  font-size: 16px;
}

.tab-badge {
  background: rgba(6, 182, 212, 0.2);
  color: #06b6d4;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

.tab-button.active .tab-badge {
  background: #06b6d4;
  color: white;
}

/* Treatment Tab */
.treatment-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}

/* No segments message */
.no-segments {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.no-segments-content {
  text-align: center;
  color: rgba(226, 232, 240, 0.7);
}

.no-segments-content h4 {
  margin: 0 0 15px 0;
  color: #f1f5f9;
  font-size: 18px;
  font-weight: 600;
}

.no-segments-content p {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  max-width: 280px;
}

/* Panel Styles - keeping existing styles but adjusting for tabs */
.panel {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.8) 100%);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 12px;
  overflow: visible;
  backdrop-filter: blur(12px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  position: relative;
  flex-shrink: 0;
  margin: 12px;
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
  padding: 10px 14px;
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
  padding: 12px;
}

.panel-content.compact {
  padding: 8px;
}

.visibility-buttons {
  display: flex;
  gap: 6px;
}

.btn-compact {
  padding: 8px 12px;
  font-size: 12px;
  flex: 1;
}

.btn-compact .icon {
  margin-right: 6px;
}

.segment-list {
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
  flex: 1;
  min-height: 0; /* Important for flexbox to work properly */
}

.segment-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Important for flexbox to work properly */
}

.segment-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Important for flexbox to work properly */
  padding: 8px 12px;
}

.segment-list::-webkit-scrollbar {
  width: 4px;
}

.segment-list::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.1);
  border-radius: 2px;
}

.segment-list::-webkit-scrollbar-thumb {
  background: rgba(6, 182, 212, 0.3);
  border-radius: 2px;
}

.segment-list::-webkit-scrollbar-thumb:hover {
  background: rgba(6, 182, 212, 0.5);
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
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  z-index: 0;
  outline: none;
}

.btn:focus {
  outline: none;
}

.btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
  transition: left 0.3s ease;
  pointer-events: none;
  z-index: 1;
}

.btn > * {
  position: relative;
  z-index: 2;
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

/* Intersection Panel Styles */
.intersection-panel {
  margin-bottom: 12px;
}

.intersection-badge {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #ffffff;
}

.intersection-list {
  max-height: 200px;
  overflow-y: auto;
}

.intersection-item {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 10px;
}

.intersection-item:last-child {
  margin-bottom: 0;
}

.intersection-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.intersection-number {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
  font-size: 12px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 50%;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.intersection-segments {
  flex: 1;
  font-size: 12px;
  color: #f1f5f9;
  font-weight: 600;
}

.intersection-severity {
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.intersection-severity.low {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.intersection-severity.medium {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.3);
}

.intersection-severity.high {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.intersection-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.detail-value {
  font-size: 11px;
  color: #f1f5f9;
  font-weight: 600;
}

.intersection-list::-webkit-scrollbar {
  width: 4px;
}

.intersection-list::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.1);
  border-radius: 2px;
}

.intersection-list::-webkit-scrollbar-thumb {
  background: rgba(239, 68, 68, 0.3);
  border-radius: 2px;
}

.intersection-list::-webkit-scrollbar-thumb:hover {
  background: rgba(239, 68, 68, 0.5);
}
</style>
