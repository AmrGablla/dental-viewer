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

    <!-- View Mode Selector -->
    <div class="view-mode-selector">
      <button 
        v-for="mode in viewModes" 
        :key="mode.value"
        @click="currentViewMode = mode.value"
        class="view-mode-btn"
        :class="{ active: currentViewMode === mode.value }"
      >
        <Icon :name="mode.icon" :size="16" color="currentColor" />
        {{ mode.label }}
      </button>
    </div>

    <!-- Gantt Chart View -->
    <div v-if="currentViewMode === 'gantt'" class="gantt-chart-section">
      <h5>Treatment Gantt Chart</h5>
      <div class="gantt-container">
        <!-- Timeline Header -->
        <div class="gantt-header">
          <div class="gantt-sidebar-header">Tooth</div>
          <div class="gantt-timeline-header">
            <div 
              v-for="week in totalWeeks" 
              :key="week"
              class="week-header"
              :class="{ current: isCurrentWeek(week) }"
            >
              Week {{ week }}
            </div>
          </div>
        </div>

        <!-- Gantt Chart Body -->
        <div class="gantt-body">
          <div 
            v-for="tooth in plan.teethMovements" 
            :key="tooth.toothId"
            class="gantt-row"
          >
            <!-- Tooth Info Sidebar -->
            <div class="gantt-sidebar">
              <div class="tooth-info">
                <span class="tooth-name">{{ tooth.toothName }}</span>
                <span class="movement-count">{{ tooth.movements.length }} movements</span>
              </div>
            </div>

            <!-- Timeline Bar -->
            <div class="gantt-timeline">
              <div 
                class="timeline-bar"
                :style="getTimelineBarStyle(tooth)"
              >
                <div class="bar-content">
                  <span class="bar-label">{{ tooth.totalSteps }} steps</span>
                  <div class="movement-indicators">
                    <div 
                      v-for="movement in tooth.movements" 
                      :key="movement.direction"
                      class="movement-indicator"
                      :class="getMovementColor(movement.direction)"
                      :title="`${formatDirection(movement.direction)}: ${Math.abs(movement.distance).toFixed(2)}mm`"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Project Timeline View -->
    <div v-if="currentViewMode === 'timeline'" class="project-timeline-section">
      <h5>Project Timeline</h5>
      <div class="timeline-container">
        <div class="timeline-track">
          <div 
            v-for="step in plan.totalSteps" 
            :key="step"
            class="timeline-milestone"
            :class="{ 
              active: step === plan.currentStep,
              completed: step < plan.currentStep,
              future: step > plan.currentStep
            }"
            @click="setCurrentStep(step)"
          >
            <div class="milestone-marker">
              <div class="milestone-number">{{ step }}</div>
            </div>
            <div class="milestone-details">
              <div class="milestone-title">Step {{ step }}</div>
              <div class="milestone-info">
                <span class="teeth-count">{{ getTeethInStep(step).length }} teeth</span>
                <span class="duration">2 weeks</span>
              </div>
              <div class="milestone-teeth">
                <div 
                  v-for="tooth in getTeethInStep(step).slice(0, 3)" 
                  :key="tooth.toothId"
                  class="milestone-tooth"
                >
                  {{ tooth.toothName }}
                </div>
                <div v-if="getTeethInStep(step).length > 3" class="more-teeth">
                  +{{ getTeethInStep(step).length - 3 }} more
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Kanban Board View -->
    <div v-if="currentViewMode === 'kanban'" class="kanban-board-section">
      <h5>Treatment Progress Board</h5>
      <div class="kanban-container">
        <div 
          v-for="status in kanbanColumns" 
          :key="status.key"
          class="kanban-column"
        >
          <div class="column-header">
            <Icon :name="status.icon" :size="16" :color="status.color" />
            <h6>{{ status.title }}</h6>
            <span class="column-count">{{ getTeethByStatus(status.key).length }}</span>
          </div>
          <div class="column-content">
            <div 
              v-for="tooth in getTeethByStatus(status.key)" 
              :key="tooth.toothId"
              class="kanban-card"
              @click="selectTooth(tooth)"
            >
              <div class="card-header">
                <span class="tooth-name">{{ tooth.toothName }}</span>
                <span class="steps-badge">{{ tooth.totalSteps }}</span>
              </div>
              <div class="card-movements">
                <div 
                  v-for="movement in tooth.movements" 
                  :key="movement.direction"
                  class="movement-chip"
                  :class="getMovementColor(movement.direction)"
                >
                  {{ formatDirection(movement.direction) }}
                </div>
              </div>
              <div class="card-progress">
                <div class="progress-bar">
                  <div 
                    class="progress-fill"
                    :style="{ width: getToothProgress(tooth) + '%' }"
                  ></div>
                </div>
                <span class="progress-text">{{ Math.round(getToothProgress(tooth)) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detailed Movement Chart (Original) -->
    <div v-if="currentViewMode === 'detailed'" class="movement-chart">
      <h5>Detailed Teeth Movement</h5>
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
import { ref, computed } from 'vue'
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

// View mode management
const currentViewMode = ref<'gantt' | 'timeline' | 'kanban' | 'detailed'>('gantt')

const viewModes = [
  { value: 'gantt' as const, label: 'Gantt Chart', icon: 'grid' },
  { value: 'timeline' as const, label: 'Timeline', icon: 'layers' },
  { value: 'kanban' as const, label: 'Progress Board', icon: 'file-text' },
  { value: 'detailed' as const, label: 'Detailed View', icon: 'maximize-2' }
]

// Kanban board columns
const kanbanColumns = [
  { key: 'not-started', title: 'Not Started', icon: 'info', color: '#6c757d' },
  { key: 'in-progress', title: 'In Progress', icon: 'arrow-right', color: '#0d6efd' },
  { key: 'completed', title: 'Completed', icon: 'check-circle', color: '#198754' }
]

// Computed properties for Gantt chart
const totalWeeks = computed(() => Math.ceil(props.plan.totalSteps * 2 / 7))

const isCurrentWeek = (week: number) => {
  const currentStepWeek = Math.ceil(props.plan.currentStep * 2 / 7)
  return week === currentStepWeek
}

const getTimelineBarStyle = (tooth: any) => {
  const startWeek = Math.ceil(tooth.startStep * 2 / 7)
  const durationWeeks = Math.ceil(tooth.totalSteps * 2 / 7)
  const leftPercent = ((startWeek - 1) / totalWeeks.value) * 100
  const widthPercent = (durationWeeks / totalWeeks.value) * 100
  
  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`
  }
}

// Kanban board functions
const getTeethByStatus = (status: string) => {
  const currentStep = props.plan.currentStep
  
  return props.plan.teethMovements.filter(tooth => {
    const toothStartStep = tooth.startStep
    const toothEndStep = tooth.startStep + tooth.totalSteps - 1
    
    switch (status) {
      case 'not-started':
        return currentStep < toothStartStep
      case 'in-progress':
        return currentStep >= toothStartStep && currentStep <= toothEndStep
      case 'completed':
        return currentStep > toothEndStep
      default:
        return false
    }
  })
}

const getToothProgress = (tooth: any) => {
  const currentStep = props.plan.currentStep
  const toothStartStep = tooth.startStep
  const toothEndStep = tooth.startStep + tooth.totalSteps - 1
  
  if (currentStep < toothStartStep) return 0
  if (currentStep > toothEndStep) return 100
  
  return ((currentStep - toothStartStep + 1) / tooth.totalSteps) * 100
}

const selectTooth = (tooth: any) => {
  // Emit tooth selection event or navigate to tooth details
  console.log('Selected tooth:', tooth.toothName)
}

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

/* View Mode Selector */
.view-mode-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 25px;
  padding: 8px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.view-mode-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6c757d;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
  font-weight: 500;
}

.view-mode-btn:hover {
  background: #f8f9fa;
  color: #495057;
}

.view-mode-btn.active {
  background: #007bff;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

/* Gantt Chart Styles */
.gantt-chart-section {
  margin-bottom: 25px;
}

.gantt-chart-section h5 {
  margin: 0 0 15px 0;
  color: #212529;
  font-weight: 600;
  font-size: 18px;
}

.gantt-container {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.gantt-header {
  display: flex;
  background: #f8f9fa;
  border-bottom: 2px solid #e9ecef;
}

.gantt-sidebar-header {
  width: 200px;
  padding: 15px 20px;
  font-weight: 600;
  color: #495057;
  border-right: 1px solid #e9ecef;
}

.gantt-timeline-header {
  flex: 1;
  display: flex;
  border-right: 1px solid #e9ecef;
}

.week-header {
  flex: 1;
  padding: 15px 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: #6c757d;
  border-right: 1px solid #e9ecef;
}

.week-header.current {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 600;
}

.gantt-body {
  max-height: 400px;
  overflow-y: auto;
}

.gantt-row {
  display: flex;
  border-bottom: 1px solid #e9ecef;
}

.gantt-row:hover {
  background: #f8f9fa;
}

.gantt-sidebar {
  width: 200px;
  padding: 15px 20px;
  border-right: 1px solid #e9ecef;
}

.tooth-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tooth-info .tooth-name {
  font-weight: 600;
  color: #212529;
}

.movement-count {
  font-size: 12px;
  color: #6c757d;
}

.gantt-timeline {
  flex: 1;
  position: relative;
  padding: 10px 0;
  min-height: 60px;
}

.timeline-bar {
  position: absolute;
  top: 15px;
  height: 30px;
  background: linear-gradient(135deg, #007bff, #0056b3);
  border-radius: 4px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  color: white;
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.3);
}

.bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.movement-indicators {
  display: flex;
  gap: 2px;
}

.movement-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.5);
}

/* Project Timeline Styles */
.project-timeline-section {
  margin-bottom: 25px;
}

.project-timeline-section h5 {
  margin: 0 0 15px 0;
  color: #212529;
  font-weight: 600;
  font-size: 18px;
}

.timeline-container {
  background: white;
  border-radius: 8px;
  padding: 30px 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.timeline-track {
  position: relative;
  padding: 20px 0;
}

.timeline-track::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: #e9ecef;
  transform: translateY(-50%);
}

.timeline-milestone {
  position: relative;
  display: inline-block;
  width: calc(100% / var(--total-steps, 10));
  text-align: center;
  cursor: pointer;
}

.milestone-marker {
  position: relative;
  display: inline-block;
  z-index: 2;
}

.milestone-number {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e9ecef;
  color: #6c757d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  margin: 0 auto 10px;
  transition: all 0.3s ease;
  border: 3px solid white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.timeline-milestone.active .milestone-number {
  background: #007bff;
  color: white;
  transform: scale(1.1);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.4);
}

.timeline-milestone.completed .milestone-number {
  background: #28a745;
  color: white;
}

.timeline-milestone.future .milestone-number {
  background: #f8f9fa;
  color: #adb5bd;
}

.milestone-details {
  text-align: center;
  padding: 0 5px;
}

.milestone-title {
  font-weight: 600;
  color: #495057;
  margin-bottom: 5px;
}

.milestone-info {
  display: flex;
  justify-content: center;
  gap: 8px;
  font-size: 11px;
  color: #6c757d;
  margin-bottom: 8px;
}

.milestone-teeth {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 10px;
}

.milestone-tooth {
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 8px;
  color: #495057;
}

.more-teeth {
  color: #6c757d;
  font-style: italic;
}

/* Kanban Board Styles */
.kanban-board-section {
  margin-bottom: 25px;
}

.kanban-board-section h5 {
  margin: 0 0 15px 0;
  color: #212529;
  font-weight: 600;
  font-size: 18px;
}

.kanban-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.kanban-column {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 15px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.column-header h6 {
  margin: 0;
  flex: 1;
  color: #495057;
  font-weight: 600;
}

.column-count {
  background: #e9ecef;
  color: #6c757d;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.column-content {
  padding: 15px;
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
}

.kanban-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.kanban-card:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.card-header .tooth-name {
  font-weight: 600;
  color: #212529;
}

.steps-badge {
  background: #007bff;
  color: white;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.card-movements {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.movement-chip {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
  color: white;
}

.card-progress {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e9ecef;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 11px;
  font-weight: 600;
  color: #6c757d;
  min-width: 30px;
}

@media (max-width: 768px) {
  .kanban-container {
    grid-template-columns: 1fr;
  }
  
  .gantt-container {
    overflow-x: auto;
  }
  
  .view-mode-selector {
    flex-wrap: wrap;
  }
}
</style>
