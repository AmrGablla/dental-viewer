<template>
  <div class="treatment-plan-panel" :class="{ 'fullscreen': isFullScreen }">
    <div class="panel-header">
      <h3>Orthodontic Treatment Plan</h3>
      <div class="panel-actions">
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
            color="#475569" 
          />
          <Icon 
            v-else 
            name="minimize-2" 
            :size="16" 
            color="#475569" 
          />
        </button>
        <button 
          v-if="!currentPlan" 
          @click="createPlan" 
          class="btn-create"
          :disabled="!hasMovedSegments"
        >
          Create Treatment Plan
        </button>
        <button 
          v-if="currentPlan" 
          @click="clearPlan" 
          class="btn-clear"
        >
          Clear Plan
        </button>
      </div>
    </div>

    <div v-if="!currentPlan && !hasMovedSegments" class="no-movements">
      <p>Move teeth in the 3D viewer to create a treatment plan.</p>
    </div>

    <div v-if="!currentPlan && hasMovedSegments" class="create-plan-prompt">
      <p>{{ movedTeethCount }} teeth have been moved. Create a treatment plan to visualize the orthodontic process.</p>
    </div>

    <TreatmentPlanView
      v-if="currentPlan"
      :plan="currentPlan"
      :segments="segments"
      @planUpdated="handlePlanUpdate"
      @stepChanged="handleStepChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted, withDefaults } from 'vue'
import Icon from './Icon.vue'
import TreatmentPlanView from './TreatmentPlanView.vue'
import { OrthodonticPlanService } from '../services/OrthodonticPlanService'
import type { ToothSegment, OrthodonticTreatmentPlan } from '../types/dental'

interface Props {
  segments: ToothSegment[]
  isVisible: boolean
  isFullScreenMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isFullScreenMode: false
})
const emit = defineEmits<{
  planCreated: [plan: OrthodonticTreatmentPlan]
  planUpdated: [plan: OrthodonticTreatmentPlan]
  stepChanged: [stepNumber: number]
  toggleFullScreen: [isFullScreen: boolean]
}>()

const planService = new OrthodonticPlanService()
const currentPlan = ref<OrthodonticTreatmentPlan | null>(null)

// Use prop to determine if we're in full screen mode
const isFullScreen = computed(() => props.isFullScreenMode)

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

const movedTeethCount = computed(() => {
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

const createPlan = () => {
  if (!hasMovedSegments.value) return
  
  const plan = planService.createTreatmentPlan(
    props.segments,
    `Treatment Plan - ${new Date().toLocaleDateString()}`
  )
  
  currentPlan.value = plan
  emit('planCreated', plan)
}

const clearPlan = () => {
  currentPlan.value = null
}

const toggleFullScreen = () => {
  emit('toggleFullScreen', !isFullScreen.value)
}

const handlePlanUpdate = (plan: OrthodonticTreatmentPlan) => {
  currentPlan.value = plan
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
    
    currentPlan.value = updatedPlan
    emit('planUpdated', updatedPlan)
  }
}, { deep: true })
</script>

<style scoped>
.treatment-plan-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.treatment-plan-panel.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: #f8f9fa;
  animation: expandToFullscreen 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 50px rgba(0, 0, 0, 0.15);
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

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  transition: all 0.2s ease;
}

.treatment-plan-panel.fullscreen .panel-header {
  background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
  border-bottom: 1px solid #dee2e6;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-radius: 0;
}

.panel-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 18px;
}

.panel-actions {
  display: flex;
  gap: 10px;
}

.btn-create, .btn-clear, .btn-expand {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-expand {
  background: #6c757d;
  color: white;
  font-family: inherit;
  font-size: 14px;
  padding: 8px 12px;
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.btn-expand:hover {
  background: #5a6268;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn-expand:active {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-expand.expanded {
  background: #dc3545;
  animation: pulseExpanded 0.3s ease;
}

.btn-expand.expanded:hover {
  background: #c82333;
}

.btn-expand svg {
  transition: transform 0.2s ease;
}

.btn-expand:hover svg {
  transform: scale(1.1);
}

@keyframes pulseExpanded {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.btn-expand:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(108, 117, 125, 0.3);
}

.btn-expand.expanded:focus {
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.3);
}

.btn-create {
  background: #28a745;
  color: white;
}

.btn-create:hover:not(:disabled) {
  background: #218838;
}

.btn-create:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.btn-clear {
  background: #dc3545;
  color: white;
}

.btn-clear:hover {
  background: #c82333;
}

.no-movements, .create-plan-prompt {
  padding: 40px 20px;
  text-align: center;
  color: #666;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.treatment-plan-panel.fullscreen .no-movements,
.treatment-plan-panel.fullscreen .create-plan-prompt {
  padding: 80px 40px;
  font-size: 1.1em;
}

.create-plan-prompt {
  background: #e8f5e8;
  border: 1px dashed #28a745;
  margin: 20px;
  border-radius: 8px;
  color: #155724;
}

.create-plan-prompt p {
  margin: 0;
  font-size: 16px;
}

.no-movements p {
  margin: 0;
  font-size: 16px;
}
</style>