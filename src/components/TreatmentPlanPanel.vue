<template>
  <div class="treatment-plan-panel" :class="{ 'fullscreen': isFullScreen }">
    <div class="panel-content">
      <!-- Fullscreen toggle button -->
      <div class="fullscreen-toggle">
        <button 
          @click="toggleFullScreen"
          class="btn-expand"
          :class="{ 'expanded': isFullScreen }"
          :title="isFullScreen ? 'Exit Full Screen' : 'Expand to Full Screen'"
        >
          <Icon 
            v-if="!isFullScreen" 
            name="maximize-2" 
            :size="16" 
            color="currentColor" 
          />
          <Icon 
            v-else 
            name="minimize-2" 
            :size="16" 
            color="currentColor" 
          />
        </button>
      </div>
      <!-- No movements state -->
      <div v-if="!currentPlan && !hasMovedSegments" class="no-movements">
        <div class="no-movements-content">
          <div class="icon-container">
            <Icon name="move" :size="48" color="#94a3b8" />
          </div>
          <h4>No Tooth Movements Detected</h4>
          <p>Move teeth in the 3D viewer to create a treatment plan.</p>
          <div class="movement-tips">
            <p><strong>How to move teeth:</strong></p>
            <ul>
              <li>Select a tooth segment</li>
              <li>Use the movement controls</li>
              <li>Or drag with your mouse</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Ready to create plan state -->
      <div v-if="!currentPlan && hasMovedSegments" class="create-plan-prompt">
        <div class="create-plan-content">
          <div class="icon-container success">
            <Icon name="check-circle" :size="48" color="#10b981" />
          </div>
          <h4>Ready to Create Treatment Plan</h4>
          <p><strong>{{ movedTeethCount }}</strong> teeth have been moved and are ready for treatment planning.</p>
          <div class="movement-summary">
            <div class="summary-item">
              <span class="summary-label">Teeth Moved:</span>
              <span class="summary-value">{{ movedTeethCount }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">Total Distance:</span>
              <span class="summary-value">{{ totalMovementDistance.toFixed(1) }}mm</span>
            </div>
          </div>
          <button
            @click="createPlan"
            class="btn-create-large"
            :disabled="!hasMovedSegments"
          >
            <Icon name="plus" :size="16" color="white" />
            Create Treatment Plan
          </button>
        </div>
      </div>

      <!-- Treatment plan view -->
      <TreatmentPlanView
        v-if="currentPlan"
        :plan="currentPlan"
        :segments="segments"
        @planUpdated="handlePlanUpdate"
        @stepChanged="handleStepChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onUnmounted, withDefaults, ref } from 'vue'
import Icon from './Icon.vue'
import TreatmentPlanView from './TreatmentPlanView.vue'
import { OrthodonticPlanService } from '../services/OrthodonticPlanService'
import type { ToothSegment, OrthodonticTreatmentPlan } from '../types/dental'

interface Props {
  segments: ToothSegment[]
  isVisible: boolean
  isFullScreenMode?: boolean
  currentTreatmentPlan?: OrthodonticTreatmentPlan | null
  reactivityKey?: number
}

const props = withDefaults(defineProps<Props>(), {
  isFullScreenMode: false,
  currentTreatmentPlan: null,
  reactivityKey: 0
})
const emit = defineEmits<{
  planCreated: [plan: OrthodonticTreatmentPlan]
  planUpdated: [plan: OrthodonticTreatmentPlan | null]
  stepChanged: [stepNumber: number]
  toggleFullScreen: [isFullScreen: boolean]
}>()

const planService = new OrthodonticPlanService()
// Use the current plan from props instead of internal state
const currentPlan = computed(() => props.currentTreatmentPlan)

// Use prop to determine if we're in full screen mode
const isFullScreen = computed(() => props.isFullScreenMode)

// Reactive movement tracker
const movementTracker = ref(0)

// Handle escape key to exit full screen
const handleEscapeKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isFullScreen.value) {
    toggleFullScreen()
  }
}

// Add/remove event listeners for escape key
watch(isFullScreen, (newValue) => {
  if (newValue) {
    document.addEventListener('keydown', handleEscapeKey)
  } else {
    document.removeEventListener('keydown', handleEscapeKey)
  }
}, { immediate: true })

// Clean up on unmount
onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey)
})

const hasMovedSegments = computed(() => {
  // Access the tracker and reactivity key to ensure reactivity
  movementTracker.value
  props.reactivityKey
  
  return props.segments.some(segment => {
    if (!segment.movementHistory) return false
    
    const movements = segment.movementHistory.axisMovements
    return (
      Math.abs(movements.anteroposterior) > 0.1 ||
      Math.abs(movements.vertical) > 0.1 ||
      Math.abs(movements.transverse) > 0.1
    )
  })
})

// Force re-evaluation when tab becomes visible
watch(() => props.isVisible, (isVisible) => {
  if (isVisible) {
    // Trigger re-evaluation of computed properties
    hasMovedSegments.value
  }
})



const movedTeethCount = computed(() => {
  // Access the tracker and reactivity key to ensure reactivity
  movementTracker.value
  props.reactivityKey
  
  return props.segments.filter(segment => {
    if (!segment.movementHistory) return false
    
    const movements = segment.movementHistory.axisMovements
    return (
      Math.abs(movements.anteroposterior) > 0.1 ||
      Math.abs(movements.vertical) > 0.1 ||
      Math.abs(movements.transverse) > 0.1
    )
  }).length
})

const totalMovementDistance = computed(() => {
  // Access the tracker and reactivity key to ensure reactivity
  movementTracker.value
  props.reactivityKey
  
  return props.segments.reduce((total, segment) => {
    if (!segment.movementHistory) return total
    
    const movements = segment.movementHistory.axisMovements
    const distance = Math.sqrt(
      Math.pow(movements.anteroposterior, 2) +
      Math.pow(movements.vertical, 2) +
      Math.pow(movements.transverse, 2)
    )
    return total + distance
  }, 0)
})

const createPlan = () => {
  if (!hasMovedSegments.value) return
  
  const plan = planService.createTreatmentPlan(
    props.segments,
    `Treatment Plan - ${new Date().toLocaleDateString()}`
  )
  
  emit('planCreated', plan)
}

// const clearPlan = () => {
//   emit('planUpdated', null)
// }

const toggleFullScreen = () => {
  emit('toggleFullScreen', !isFullScreen.value)
}

const handlePlanUpdate = (plan: OrthodonticTreatmentPlan) => {
  emit('planUpdated', plan)
}

const handleStepChange = (stepNumber: number) => {
  if (currentPlan.value) {
    currentPlan.value.currentStep = stepNumber
    emit('stepChanged', stepNumber)
  }
}



// Watch for changes in segments to auto-update plan
watch(() => props.segments, (newSegments) => {
  if (currentPlan.value) {
    // Recreate plan with updated segment data
    const updatedPlan = planService.createTreatmentPlan(
      newSegments,
      currentPlan.value.name
    )
    
    // Preserve user customizations
    updatedPlan.id = currentPlan.value.id
    updatedPlan.createdDate = currentPlan.value.createdDate
    updatedPlan.currentStep = currentPlan.value.currentStep
    updatedPlan.metadata = currentPlan.value.metadata
    
    // Try to preserve user step customizations
    currentPlan.value.teethMovements.forEach(existingTooth => {
      const updatedTooth = updatedPlan.teethMovements.find(t => t.toothId === existingTooth.toothId)
      if (updatedTooth) {
        updatedTooth.startStep = existingTooth.startStep
        updatedTooth.movements.forEach((movement, index) => {
          if (existingTooth.movements[index]) {
            movement.userSteps = existingTooth.movements[index].userSteps
            movement.warnings = existingTooth.movements[index].warnings
          }
        })
      }
    })
    
    emit('planUpdated', updatedPlan)
  }
}, { deep: true })
</script>

<style scoped>
.treatment-plan-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
}

.treatment-plan-panel.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  animation: expandToFullscreen 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.15);
  border-radius: 0;
}

@keyframes expandToFullscreen {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes collapseFromFullscreen {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.95);
  }
}

.fullscreen-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.panel-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  padding-top: 8px;
}

.btn-expand {
  background: linear-gradient(135deg, rgba(51, 65, 85, 0.8) 0%, rgba(71, 85, 105, 0.8) 100%);
  border: 1px solid rgba(148, 163, 184, 0.3);
  color: #f1f5f9;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  z-index: 10;
  pointer-events: auto;
}

.btn-expand:hover {
  background: linear-gradient(135deg, rgba(71, 85, 105, 0.9) 0%, rgba(100, 116, 139, 0.9) 100%);
  border-color: rgba(148, 163, 184, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.btn-expand.expanded {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.8) 100%);
  border-color: rgba(239, 68, 68, 0.5);
  animation: pulseExpanded 0.3s ease;
}

.btn-expand.expanded:hover {
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.9) 0%, rgba(185, 28, 28, 0.9) 100%);
  border-color: rgba(239, 68, 68, 0.8);
}

@keyframes pulseExpanded {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.btn-expand:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.3);
}

.btn-expand.expanded:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.3);
}

.no-movements, .create-plan-prompt {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  transition: all 0.3s ease;
}

.treatment-plan-panel.fullscreen .no-movements,
.treatment-plan-panel.fullscreen .create-plan-prompt {
  padding: 80px 40px;
  font-size: 1.1em;
}

.no-movements-content, .create-plan-content {
  text-align: center;
  max-width: 400px;
  width: 100%;
}

.icon-container {
  margin-bottom: 24px;
  display: flex;
  justify-content: center;
}

.icon-container.success {
  animation: successPulse 2s ease-in-out infinite;
}

@keyframes successPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

.no-movements-content h4 {
  margin: 0 0 16px 0;
  color: #f1f5f9;
  font-size: 20px;
  font-weight: 600;
}

.no-movements-content p {
  margin: 0 0 24px 0;
  color: #94a3b8;
  font-size: 16px;
  line-height: 1.5;
}

.movement-tips {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 20px;
  text-align: left;
}

.movement-tips p {
  margin: 0 0 12px 0;
  color: #f1f5f9;
  font-weight: 600;
}

.movement-tips ul {
  margin: 0;
  padding-left: 20px;
  color: #94a3b8;
}

.movement-tips li {
  margin-bottom: 8px;
  line-height: 1.4;
}

.create-plan-content h4 {
  margin: 0 0 16px 0;
  color: #f1f5f9;
  font-size: 20px;
  font-weight: 600;
}

.create-plan-content p {
  margin: 0 0 24px 0;
  color: #94a3b8;
  font-size: 16px;
  line-height: 1.5;
}

.movement-summary {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  gap: 20px;
  justify-content: center;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.summary-label {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.summary-value {
  font-size: 18px;
  color: #06b6d4;
  font-weight: 700;
}

.btn-create-large {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  color: white;
  padding: 16px 32px;
  border-radius: 12px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
  margin: 0 auto;
  width: fit-content;
}

.btn-create-large:hover:not(:disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(16, 185, 129, 0.4);
}

.btn-create-large:active {
  transform: translateY(0);
  box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
}

.btn-create-large:disabled {
  background: linear-gradient(135deg, rgba(108, 117, 125, 0.8) 0%, rgba(73, 80, 87, 0.8) 100%);
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-create-large:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.3);
}

/* Scrollbar styling */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.1);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(6, 182, 212, 0.3);
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(6, 182, 212, 0.5);
}
</style>