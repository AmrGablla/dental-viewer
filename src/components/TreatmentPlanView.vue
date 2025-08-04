<template>
  <div class="treatment-plan-view">
    <!-- Plan Overview -->
    <div class="plan-overview">
      <div class="plan-info">
        <h4>{{ plan.name }}</h4>
        <div class="plan-stats">
          <span class="stat">
            <strong>{{ plan.teethMovements.length }}</strong> teeth
          </span>
          <span class="stat">
            <strong>{{ plan.totalSteps }}</strong> steps
          </span>
          <span class="stat">
            <strong>{{ Math.round(plan.estimatedDuration / 7) }}</strong> weeks
          </span>
          <span class="complexity-badge" :class="plan.metadata.complexity">
            {{ plan.metadata.complexity }}
          </span>
        </div>
      </div>
      <div class="export-actions">
        <button @click="exportCurrentStep" class="btn-export">
          Export Step {{ plan.currentStep }}
        </button>
        <button @click="exportAllSteps" class="btn-export-all">
          Export All Steps
        </button>
      </div>
    </div>

    <!-- Step Timeline -->
    <div class="timeline-section">
      <h5>Treatment Timeline</h5>
      <div class="timeline">
        <div 
          v-for="step in plan.totalSteps" 
          :key="step"
          class="timeline-step"
          :class="{ 
            active: step === plan.currentStep,
            completed: step < plan.currentStep 
          }"
          @click="setCurrentStep(step)"
        >
          <div class="step-number">{{ step }}</div>
          <div class="step-info">
            <div class="step-duration">2 weeks</div>
            <div class="step-teeth">
              {{ getTeethInStep(step).length }} teeth
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Teeth Movement Chart -->
    <div class="movement-chart">
      <h5>Teeth Movement Overview</h5>
      <div class="teeth-grid">
        <div 
          v-for="tooth in plan.teethMovements" 
          :key="tooth.toothId"
          class="tooth-card"
        >
          <div class="tooth-header">
            <span class="tooth-name">{{ tooth.toothName }}</span>
            <span class="tooth-steps">{{ tooth.totalSteps }} steps</span>
          </div>
          
          <div class="movement-bars">
            <div 
              v-for="movement in tooth.movements" 
              :key="movement.direction"
              class="movement-bar"
            >
              <div class="movement-label">
                {{ formatDirection(movement.direction) }}
                <span class="movement-distance">{{ Math.abs(movement.distance).toFixed(2) }}mm</span>
              </div>
              
              <div class="bar-container">
                <div 
                  class="bar-fill"
                  :class="getMovementColor(movement.direction)"
                  :style="{ width: getBarWidth(movement) + '%' }"
                ></div>
              </div>
              
              <div class="movement-controls">
                <label>Steps:</label>
                <input 
                  type="number" 
                  :value="movement.userSteps || movement.recommendedSteps"
                  :min="movement.recommendedSteps"
                  @input="updateMovementSteps(tooth.toothId, movement, $event)"
                  class="steps-input"
                />
                <span class="recommended">(rec: {{ movement.recommendedSteps }})</span>
              </div>
              
              <div v-if="movement.warnings.length > 0" class="warnings">
                <div 
                  v-for="warning in movement.warnings" 
                  :key="warning"
                  class="warning"
                >
                  <Icon 
                    name="alert-triangle" 
                    :size="16" 
                    color="#d63384" 
                    style="margin-right: 4px; flex-shrink: 0;" 
                  />
                  {{ warning }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Current Step Details -->
    <div class="current-step-details">
      <h5>Step {{ plan.currentStep }} Details</h5>
      <div class="step-movements">
        <div 
          v-for="tooth in getActiveTeethInCurrentStep()" 
          :key="tooth.toothId"
          class="step-tooth"
        >
          <span class="tooth-name">{{ tooth.toothName }}</span>
          <div class="step-tooth-movements">
            <div 
              v-for="movement in tooth.movements"
              :key="movement.direction"
              class="step-movement"
            >
              {{ formatDirection(movement.direction) }}: 
              {{ (Math.abs(movement.distance) / (movement.userSteps || movement.recommendedSteps)).toFixed(3) }}mm
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from './Icon.vue'
import type { OrthodonticTreatmentPlan, ToothSegment, MovementDirection } from '../types/dental'
import { STLExportService } from '../services/STLExportService'
import { OrthodonticPlanService } from '../services/OrthodonticPlanService'

interface Props {
  plan: OrthodonticTreatmentPlan
  segments: ToothSegment[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  planUpdated: [plan: OrthodonticTreatmentPlan]
  stepChanged: [stepNumber: number]
}>()

const exportService = new STLExportService()
const planService = new OrthodonticPlanService()

const formatDirection = (direction: string) => {
  switch (direction) {
    case 'anteroposterior': return 'A-P'
    case 'vertical': return 'Vertical'
    case 'transverse': return 'Transverse'
    default: return direction
  }
}

const getMovementColor = (direction: string) => {
  switch (direction) {
    case 'anteroposterior': return 'color-ap'
    case 'vertical': return 'color-vertical'
    case 'transverse': return 'color-transverse'
    default: return 'color-default'
  }
}

const getBarWidth = (movement: MovementDirection) => {
  const maxDistance = 10 // Normalize to 10mm max for display
  return Math.min((Math.abs(movement.distance) / maxDistance) * 100, 100)
}

const getTeethInStep = (stepNumber: number) => {
  return props.plan.teethMovements.filter(tooth => 
    stepNumber >= tooth.startStep && 
    stepNumber <= tooth.startStep + tooth.totalSteps - 1
  )
}

const getActiveTeethInCurrentStep = () => {
  return getTeethInStep(props.plan.currentStep)
}

const setCurrentStep = (stepNumber: number) => {
  const updatedPlan = { ...props.plan, currentStep: stepNumber }
  emit('planUpdated', updatedPlan)
  emit('stepChanged', stepNumber)
}

const updateMovementSteps = (toothId: string, movement: MovementDirection, event: Event) => {
  const target = event.target as HTMLInputElement
  const newSteps = parseInt(target.value)
  
  if (newSteps > 0) {
    const tooth = props.plan.teethMovements.find(t => t.toothId === toothId)
    if (tooth) {
      const movementIndex = tooth.movements.findIndex(m => m.direction === movement.direction)
      if (movementIndex >= 0) {
        const updatedPlan = planService.updateMovementSteps(props.plan, toothId, movementIndex, newSteps)
        emit('planUpdated', updatedPlan)
      }
    }
  }
}

const exportCurrentStep = async () => {
  try {
    const stepSegments = getActiveTeethInCurrentStep()
      .map(tooth => props.segments.find(s => s.id === tooth.toothId))
      .filter(s => s !== undefined) as ToothSegment[]
    
    if (stepSegments.length > 0) {
      await exportService.exportStepSTL(stepSegments, props.plan.currentStep)
    }
  } catch (error) {
    console.error('Export failed:', error)
  }
}

const exportAllSteps = async () => {
  try {
    await exportService.exportTreatmentPlan(props.plan, props.segments)
  } catch (error) {
    console.error('Export failed:', error)
  }
}
</script>

<style scoped>
.treatment-plan-view {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  background: #f8f9fa;
}

.plan-overview {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 25px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.plan-info h4 {
  margin: 0 0 10px 0;
  color: #2c3e50;
}

.plan-stats {
  display: flex;
  gap: 15px;
  align-items: center;
}

.stat {
  font-size: 14px;
  color: #666;
}

.complexity-badge {
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  text-transform: uppercase;
}

.complexity-badge.simple {
  background: #d4edda;
  color: #155724;
}

.complexity-badge.moderate {
  background: #fff3cd;
  color: #856404;
}

.complexity-badge.complex {
  background: #f8d7da;
  color: #721c24;
}

.export-actions {
  display: flex;
  gap: 10px;
}

.btn-export, .btn-export-all {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn-export {
  background: #007bff;
  color: white;
}

.btn-export:hover {
  background: #0056b3;
}

.btn-export-all {
  background: #28a745;
  color: white;
}

.btn-export-all:hover {
  background: #218838;
}

.timeline-section {
  margin-bottom: 25px;
}

.timeline-section h5 {
  margin: 0 0 15px 0;
  color: #212529;
  font-weight: 600;
  font-size: 18px;
}

.timeline {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 10px 0;
}

.timeline-step {
  min-width: 80px;
  padding: 10px;
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.timeline-step:hover {
  border-color: #007bff;
}

.timeline-step.active {
  border-color: #007bff;
  background: #e3f2fd;
}

.timeline-step.active .step-number {
  color: #0056b3;
}

.timeline-step.completed {
  border-color: #28a745;
  background: #e8f5e8;
}

.timeline-step.completed .step-number {
  color: #1e7e34;
}

.step-number {
  font-weight: bold;
  font-size: 16px;
  margin-bottom: 5px;
  color: #212529;
}

.step-info {
  font-size: 12px;
  color: #495057;
  font-weight: 500;
}

.movement-chart {
  margin-bottom: 25px;
}

.movement-chart h5 {
  margin: 0 0 15px 0;
  color: #212529;
  font-weight: 600;
  font-size: 18px;
}

.teeth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 15px;
}

.tooth-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border: 1px solid #e9ecef;
}

.tooth-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e0e0e0;
}

.tooth-name {
  font-weight: 600;
  color: #212529;
  font-size: 14px;
}

.tooth-steps {
  font-size: 12px;
  color: #495057;
  background: #e9ecef;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.movement-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.movement-bar {
  font-size: 13px;
  padding: 8px 0;
}

.movement-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-weight: 500;
  color: #2c3e50;
}

.movement-distance {
  color: #495057;
  font-weight: 600;
}

.bar-container {
  height: 10px;
  background: #f8f9fa;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 8px;
  border: 1px solid #e9ecef;
}

.bar-fill {
  height: 100%;
  transition: width 0.3s ease;
  position: relative;
}

.bar-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.color-ap {
  background: linear-gradient(90deg, #e74c3c, #c0392b);
}

.color-vertical {
  background: linear-gradient(90deg, #2ecc71, #27ae60);
}

.color-transverse {
  background: linear-gradient(90deg, #3498db, #2980b9);
}

.movement-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.movement-controls label {
  font-size: 12px;
  color: #495057;
  font-weight: 500;
}

.steps-input {
  width: 60px;
  padding: 4px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 12px;
  color: #212529;
  background: #fff;
}

.steps-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.recommended {
  font-size: 11px;
  color: #495057;
  font-weight: 500;
}

.warnings {
  margin-top: 5px;
}

.warning {
  font-size: 11px;
  color: #d63384;
  background: #f8d7da;
  padding: 2px 6px;
  border-radius: 4px;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
}

.current-step-details {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.current-step-details h5 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.step-movements {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.step-tooth {
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.step-tooth-movements {
  margin-top: 5px;
}

.step-movement {
  font-size: 13px;
  color: #666;
  margin-bottom: 2px;
}
</style>
