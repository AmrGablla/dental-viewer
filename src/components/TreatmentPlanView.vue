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

    <!-- Gantt Chart View -->
    <div class="gantt-chart-section">
      <h5>Treatment Timeline - Gantt Chart</h5>
      <div class="gantt-container">
        <!-- Timeline Header -->
        <div class="gantt-header">
          <div class="gantt-sidebar-header">Tooth</div>
          <div class="gantt-timeline-header">
            <div 
              v-for="step in plan.totalSteps" 
              :key="step"
              class="step-header"
              :class="{ current: step === plan.currentStep }"
            >
              {{ step }}
            </div>
          </div>
        </div>

        <!-- Gantt Chart Body -->
        <div class="gantt-body">
          <div 
            v-for="tooth in plan.teethMovements" 
            :key="tooth.toothId"
            class="gantt-row"
            :class="{ 'has-conflicts': hasIntersectionConflicts(tooth) }"
          >
            <!-- Tooth Info Sidebar -->
            <div class="gantt-sidebar">
              <div class="tooth-info">
                <span class="tooth-name">{{ tooth.toothName }}</span>
                <span class="movement-count">{{ tooth.movements.length }} movements</span>
                <div v-if="hasIntersectionConflicts(tooth)" class="conflict-indicator">
                  <Icon name="alert-triangle" :size="14" color="#ef4444" />
                  <span>Conflicts</span>
                </div>
              </div>
            </div>

            <!-- Timeline Bar -->
            <div class="gantt-timeline">
              <!-- Individual Movement Bars -->
              <div 
                v-for="(movement, movementIndex) in tooth.movements" 
                :key="movement.direction"
                class="movement-timeline-bar"
                :class="{ 
                  'has-intersection': hasMovementIntersection(tooth, movement),
                  [`color-${movement.direction}`]: true,
                  'dragging': isDragging && draggedMovement?.toothId === tooth.toothId && draggedMovement?.movementIndex === movementIndex
                }"
                :style="getMovementTimelineStyle(tooth, movement)"
                :title="`${formatDirection(movement.direction)}: ${Math.abs(movement.distance).toFixed(2)}mm (Steps ${movement.startStep || tooth.startStep} - ${(movement.startStep || tooth.startStep) + (movement.userSteps || movement.recommendedSteps) - 1})`"
                @mousedown="startDragMovement($event, tooth.toothId, movementIndex)"
              >
                <div class="movement-bar-content">
                  <span class="movement-bar-label">{{ formatDirection(movement.direction) }}</span>
                  <span class="movement-bar-distance">{{ Math.abs(movement.distance).toFixed(1) }}mm</span>
                </div>
                
                <!-- Intersection indicator and controls -->
                <div v-if="hasMovementIntersection(tooth, movement)" class="intersection-indicator">
                  <Icon name="alert-triangle" :size="12" color="#fff" />
                  
                  <!-- Intersection warnings -->
                  <div class="intersection-popup">
                    <div 
                      v-for="intersection in getMovementIntersections(tooth, movement)" 
                      :key="intersection.conflictToothId"
                      class="intersection-warning"
                      :class="`severity-${intersection.severity}`"
                    >
                      <Icon 
                        name="alert-triangle" 
                        :size="12" 
                        :color="intersection.severity === 'high' ? '#ef4444' : intersection.severity === 'medium' ? '#f59e0b' : '#10b981'" 
                        style="margin-right: 4px; flex-shrink: 0;" 
                      />
                      <span>Conflicts with {{ intersection.conflictToothName }} in steps {{ intersection.conflictSteps.join(', ') }}</span>
                      <button 
                        @click="resolveIntersection(tooth.toothId, intersection)"
                        class="resolve-btn"
                      >
                        Auto-resolve
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import Icon from './Icon.vue'
import type { OrthodonticTreatmentPlan, ToothSegment, ToothIntersection } from '../types/dental'
import { STLExportService } from '../services/STLExportService'

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

// Drag state
const isDragging = ref(false)
const draggedMovement = ref<{ toothId: string, movementIndex: number } | null>(null)
const dragStartX = ref(0)
const dragStartStep = ref(0)

// Computed properties for Gantt chart
const totalSteps = computed(() => props.plan.totalSteps)

const getMovementTimelineStyle = (tooth: any, movement: any) => {
  const movementStartStep = movement.startStep || tooth.startStep
  const movementDuration = movement.userSteps || movement.recommendedSteps
  const leftPercent = ((movementStartStep - 1) / totalSteps.value) * 100
  const widthPercent = (movementDuration / totalSteps.value) * 100
  
  // Stack movements vertically within the same tooth row
  const movementIndex = tooth.movements.findIndex((m: any) => m.direction === movement.direction)
  const topOffset = movementIndex * 12 // 12px per movement bar
  
  return {
    left: `${leftPercent}%`,
    width: `${widthPercent}%`,
    top: `${10 + topOffset}px`,
    height: '10px'
  }
}

const formatDirection = (direction: string) => {
  switch (direction) {
    case 'anteroposterior': return 'A-P'
    case 'vertical': return 'Vertical'
    case 'transverse': return 'Transverse'
    default: return direction
  }
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

// Movement timing and intersection functions
const startDragMovement = (event: MouseEvent, toothId: string, movementIndex: number) => {
  event.preventDefault()
  isDragging.value = true
  draggedMovement.value = { toothId, movementIndex }
  dragStartX.value = event.clientX
  
  // Get current start step
  const tooth = props.plan.teethMovements.find(t => t.toothId === toothId)
  const movement = tooth?.movements[movementIndex]
  dragStartStep.value = movement?.startStep || tooth?.startStep || 1
  
  // Add global mouse event listeners
  document.addEventListener('mousemove', handleDragMovement)
  document.addEventListener('mouseup', stopDragMovement)
}

const handleDragMovement = (event: MouseEvent) => {
  if (!isDragging.value || !draggedMovement.value) return
  
  // Calculate step change based on mouse movement
  const ganttTimeline = document.querySelector('.gantt-timeline')
  if (!ganttTimeline) return
  
  const timelineRect = ganttTimeline.getBoundingClientRect()
  const stepWidth = timelineRect.width / totalSteps.value
  const deltaX = event.clientX - dragStartX.value
  const stepChange = Math.round(deltaX / stepWidth)
  
  // Allow dragging beyond current total steps - we'll expand the plan automatically
  const newStartStep = Math.max(1, dragStartStep.value + stepChange)
  
  // Update the movement start step
  updateMovementStartStep(draggedMovement.value.toothId, draggedMovement.value.movementIndex, newStartStep)
}

const stopDragMovement = () => {
  isDragging.value = false
  draggedMovement.value = null
  dragStartX.value = 0
  dragStartStep.value = 0
  
  // Remove global mouse event listeners
  document.removeEventListener('mousemove', handleDragMovement)
  document.removeEventListener('mouseup', stopDragMovement)
}

const updateMovementStartStep = (toothId: string, movementIndex: number, newStartStep: number) => {
  if (newStartStep >= 1) {
    const tooth = props.plan.teethMovements.find(t => t.toothId === toothId)
    if (tooth && tooth.movements[movementIndex]) {
      const movement = tooth.movements[movementIndex]
      const movementEndStep = newStartStep + (movement.userSteps || movement.recommendedSteps) - 1
      
      // Calculate new total steps needed
      const maxStepNeeded = Math.max(
        movementEndStep,
        ...props.plan.teethMovements.flatMap(t => 
          t.movements.map(m => {
            const startStep = m.startStep || t.startStep
            return startStep + (m.userSteps || m.recommendedSteps) - 1
          })
        )
      )
      
      const updatedMovement = { ...movement, startStep: newStartStep }
      const updatedMovements = [...tooth.movements]
      updatedMovements[movementIndex] = updatedMovement
      
      const updatedTooth = { ...tooth, movements: updatedMovements }
      const updatedTeethMovements = props.plan.teethMovements.map(t => 
        t.toothId === toothId ? updatedTooth : t
      )
      
      // Update the plan with new total steps if needed
      const updatedPlan = { 
        ...props.plan, 
        teethMovements: updatedTeethMovements,
        totalSteps: Math.max(props.plan.totalSteps, maxStepNeeded)
      }
      emit('planUpdated', updatedPlan)
    }
  }
}

const hasIntersectionConflicts = (tooth: any): boolean => {
  return tooth.movements.some((movement: any) => hasMovementIntersection(tooth, movement))
}

const hasMovementIntersection = (tooth: any, movement: any): boolean => {
  const movementStartStep = movement.startStep || tooth.startStep
  const movementEndStep = movementStartStep + (movement.userSteps || movement.recommendedSteps) - 1
  
  return props.plan.teethMovements.some(otherTooth => {
    if (otherTooth.toothId === tooth.toothId) return false
    
    return otherTooth.movements.some(otherMovement => {
      const otherStartStep = otherMovement.startStep || otherTooth.startStep
      const otherEndStep = otherStartStep + (otherMovement.userSteps || otherMovement.recommendedSteps) - 1
      
      // Check if time ranges overlap
      const timeOverlap = !(movementEndStep < otherStartStep || movementStartStep > otherEndStep)
      
      if (timeOverlap) {
        // Check if movements are in conflicting directions or too close spatially
        return isMovementConflicting(tooth, movement, otherTooth, otherMovement)
      }
      
      return false
    })
  })
}

const isMovementConflicting = (tooth1: any, movement1: any, tooth2: any, movement2: any): boolean => {
  // Simple heuristic: teeth are conflicting if they're adjacent and moving toward each other
  const adjacentTeeth = getAdjacentTeeth(tooth1.toothName, tooth2.toothName)
  if (!adjacentTeeth) return false
  
  // Check if movements are in opposite directions
  if (movement1.direction === movement2.direction) {
    // Same direction movements can conflict if distances are large
    return Math.abs(movement1.distance) > 2 || Math.abs(movement2.distance) > 2
  }
  
  // Different directions - check for spatial conflicts
  return true
}

const getAdjacentTeeth = (tooth1: string, tooth2: string): boolean => {
  // Simplified tooth adjacency map (in real app, this would be more comprehensive)
  const adjacencyMap: { [key: string]: string[] } = {
    'Upper_Central_Incisor_1': ['Upper_Central_Incisor_2', 'Upper_Lateral_Incisor_1'],
    'Upper_Central_Incisor_2': ['Upper_Central_Incisor_1', 'Upper_Lateral_Incisor_2'],
    'Upper_Lateral_Incisor_1': ['Upper_Central_Incisor_1', 'Upper_Canine_1'],
    'Upper_Lateral_Incisor_2': ['Upper_Central_Incisor_2', 'Upper_Canine_2'],
    'Upper_Canine_1': ['Upper_Lateral_Incisor_1', 'Upper_Premolar_1_1'],
    'Upper_Canine_2': ['Upper_Lateral_Incisor_2', 'Upper_Premolar_1_2'],
  }
  
  return adjacencyMap[tooth1]?.includes(tooth2) || adjacencyMap[tooth2]?.includes(tooth1) || false
}

const getMovementIntersections = (tooth: any, movement: any): ToothIntersection[] => {
  const intersections: ToothIntersection[] = []
  const movementStartStep = movement.startStep || tooth.startStep
  const movementEndStep = movementStartStep + (movement.userSteps || movement.recommendedSteps) - 1
  
  props.plan.teethMovements.forEach(otherTooth => {
    if (otherTooth.toothId === tooth.toothId) return
    
    otherTooth.movements.forEach(otherMovement => {
      const otherStartStep = otherMovement.startStep || otherTooth.startStep
      const otherEndStep = otherStartStep + (otherMovement.userSteps || otherMovement.recommendedSteps) - 1
      
      // Check for time overlap
      const overlapStart = Math.max(movementStartStep, otherStartStep)
      const overlapEnd = Math.min(movementEndStep, otherEndStep)
      
      if (overlapStart <= overlapEnd) {
        if (isMovementConflicting(tooth, movement, otherTooth, otherMovement)) {
          const conflictSteps = []
          for (let step = overlapStart; step <= overlapEnd; step++) {
            conflictSteps.push(step)
          }
          
          intersections.push({
            conflictToothId: otherTooth.toothId,
            conflictToothName: otherTooth.toothName,
            conflictSteps,
            severity: getSeverity(movement, otherMovement),
            intersectionType: getIntersectionType(movement, otherMovement)
          })
        }
      }
    })
  })
  
  return intersections
}

const getSeverity = (movement1: any, movement2: any): 'low' | 'medium' | 'high' => {
  const totalDistance = Math.abs(movement1.distance) + Math.abs(movement2.distance)
  if (totalDistance > 5) return 'high'
  if (totalDistance > 2) return 'medium'
  return 'low'
}

const getIntersectionType = (movement1: any, movement2: any): 'contact' | 'overlap' | 'collision' => {
  const totalDistance = Math.abs(movement1.distance) + Math.abs(movement2.distance)
  if (totalDistance > 4) return 'collision'
  if (totalDistance > 2) return 'overlap'
  return 'contact'
}

const resolveIntersection = (toothId: string, intersection: ToothIntersection) => {
  // Auto-resolve by adjusting timing
  const tooth = props.plan.teethMovements.find(t => t.toothId === toothId)
  const conflictTooth = props.plan.teethMovements.find(t => t.toothId === intersection.conflictToothId)
  
  if (tooth && conflictTooth) {
    // Simple resolution: delay the second tooth's movement
    const updatedConflictTooth = {
      ...conflictTooth,
      startStep: Math.max(...intersection.conflictSteps) + 1
    }
    
    const updatedTeethMovements = props.plan.teethMovements.map(t => 
      t.toothId === intersection.conflictToothId ? updatedConflictTooth : t
    )
    
    const updatedPlan = { ...props.plan, teethMovements: updatedTeethMovements }
    emit('planUpdated', updatedPlan)
  }
}

// Cleanup drag listeners on unmount
onUnmounted(() => {
  document.removeEventListener('mousemove', handleDragMovement)
  document.removeEventListener('mouseup', stopDragMovement)
})
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

.step-header {
  flex: 1;
  padding: 15px 8px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: #6c757d;
  border-right: 1px solid #e9ecef;
}

.step-header.current {
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

.gantt-row.has-conflicts {
  background: rgba(239, 68, 68, 0.05);
  border-left: 3px solid #ef4444;
}

.gantt-row.has-conflicts:hover {
  background: rgba(239, 68, 68, 0.08);
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

.conflict-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #dc3545;
  font-weight: 500;
}

.gantt-timeline {
  flex: 1;
  position: relative;
  padding: 10px 0;
  min-height: 80px; /* Increased to accommodate multiple movement bars */
}

.movement-timeline-bar {
  position: absolute;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 6px;
  color: white;
  font-size: 10px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  cursor: grab;
  user-select: none;
}

.movement-timeline-bar:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.movement-timeline-bar.dragging {
  cursor: grabbing;
  z-index: 1000;
  opacity: 0.8;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.movement-timeline-bar.has-intersection {
  border: 2px solid #dc3545;
  box-shadow: 0 0 0 1px rgba(220, 53, 69, 0.3), 0 1px 3px rgba(0, 0, 0, 0.2);
}

.movement-timeline-bar.color-anteroposterior {
  background: linear-gradient(135deg, #e74c3c, #c0392b);
}

.movement-timeline-bar.color-vertical {
  background: linear-gradient(135deg, #2ecc71, #27ae60);
}

.movement-timeline-bar.color-transverse {
  background: linear-gradient(135deg, #3498db, #2980b9);
}

.movement-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-width: 0;
}

.movement-bar-label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.movement-bar-distance {
  font-size: 9px;
  opacity: 0.9;
  white-space: nowrap;
}

.intersection-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  background: #dc3545;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid white;
}

.intersection-popup {
  position: absolute;
  top: 100%;
  left: 0;
  background: white;
  border: 1px solid #dc3545;
  border-radius: 6px;
  padding: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 200px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.2s ease;
}

.intersection-indicator:hover .intersection-popup {
  opacity: 1;
  visibility: visible;
}

.intersection-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 4px;
  border-radius: 4px;
  font-size: 11px;
}

.intersection-warning:last-child {
  margin-bottom: 0;
}

.intersection-warning.severity-high {
  background: rgba(239, 68, 68, 0.1);
  border-left: 3px solid #ef4444;
}

.intersection-warning.severity-medium {
  background: rgba(245, 158, 11, 0.1);
  border-left: 3px solid #f59e0b;
}

.intersection-warning.severity-low {
  background: rgba(16, 185, 129, 0.1);
  border-left: 3px solid #10b981;
}

.resolve-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.resolve-btn:hover {
  background: #0056b3;
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
  
  .step-analysis-grid {
    grid-template-columns: 1fr;
  }
}

/* Intersection and Movement Control Styles */
.has-conflicts {
  border: 2px solid #dc3545 !important;
  background: linear-gradient(135deg, rgba(220, 53, 69, 0.05), rgba(255, 255, 255, 1));
}

.conflict-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #dc3545;
  font-size: 12px;
  font-weight: 500;
  background: rgba(220, 53, 69, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
}

.movement-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.movement-timing {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.movement-timing label {
  color: #495057;
  font-weight: 500;
}

.step-input {
  width: 50px;
  padding: 2px 6px;
  border: 1px solid #ced4da;
  border-radius: 3px;
  font-size: 11px;
  color: #212529;
}

.step-input:focus {
  outline: none;
  border-color: #80bdff;
  box-shadow: 0 0 0 1px rgba(0, 123, 255, 0.25);
}

.to-step {
  color: #6c757d;
  font-size: 11px;
}

.has-intersection {
  border-left: 3px solid #dc3545;
  background: rgba(220, 53, 69, 0.02);
}

.intersection-warnings {
  margin-top: 8px;
  padding: 8px;
  background: rgba(220, 53, 69, 0.05);
  border-radius: 4px;
  border-left: 3px solid #dc3545;
}

.intersection-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #dc3545;
  margin-bottom: 4px;
  padding: 4px 0;
}

.intersection-warning:last-child {
  margin-bottom: 0;
}

.resolve-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.resolve-btn:hover {
  background: #c82333;
}

/* Step Analysis Styles */
.intersection-analysis {
  margin-bottom: 25px;
}

.intersection-analysis h5 {
  margin: 0 0 15px 0;
  color: #212529;
  font-weight: 600;
  font-size: 18px;
}

.step-analysis-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 15px;
}

.step-analysis-card {
  background: white;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.2s ease;
}

.step-analysis-card.has-intersections {
  border-color: #dc3545;
  background: linear-gradient(135deg, rgba(220, 53, 69, 0.02), white);
}

.step-analysis-card.current-step {
  border-color: #007bff;
  background: linear-gradient(135deg, rgba(0, 123, 255, 0.05), white);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.2);
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.step-header h6 {
  margin: 0;
  color: #212529;
  font-weight: 600;
}

.step-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: right;
}

.active-teeth {
  font-size: 12px;
  color: #6c757d;
}

.intersection-count {
  font-size: 11px;
  color: #dc3545;
  font-weight: 500;
  background: rgba(220, 53, 69, 0.1);
  padding: 2px 6px;
  border-radius: 8px;
}

.step-intersections {
  margin-bottom: 12px;
}

.step-intersection {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #dc3545;
  margin-bottom: 4px;
  padding: 4px 6px;
  background: rgba(220, 53, 69, 0.05);
  border-radius: 4px;
}

.severity {
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
}

.severity.low {
  background: #d4edda;
  color: #155724;
}

.severity.medium {
  background: #fff3cd;
  color: #856404;
}

.severity.high {
  background: #f8d7da;
  color: #721c24;
}

.no-intersections {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #28a745;
  margin-bottom: 12px;
  padding: 6px;
  background: rgba(40, 167, 69, 0.05);
  border-radius: 4px;
}

.step-teeth {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.step-tooth-item {
  font-size: 10px;
  background: #e9ecef;
  color: #495057;
  padding: 2px 6px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.step-tooth-item.has-conflict {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
  border: 1px solid rgba(220, 53, 69, 0.2);
}
</style>
