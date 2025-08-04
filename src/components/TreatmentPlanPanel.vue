<template>
  <div class="panel treatment-plan" v-if="plan.teeth.length">
    <div class="panel-header">
      <span class="panel-icon">🗓️</span>
      <span class="panel-title">Treatment Plan</span>
    </div>
    <div class="panel-content">
      <table class="plan-table">
        <thead>
          <tr>
            <th>Tooth</th>
            <th v-for="dir in directions" :key="dir">{{ dirLabels[dir] }} Start</th>
            <th v-for="dir in directions" :key="dir + '-steps'">{{ dirLabels[dir] }} Steps</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tooth in plan.teeth" :key="tooth.toothId">
            <td>{{ tooth.toothName }}</td>
            <td v-for="dir in directions" :key="tooth.toothId + dir + 'start'">
              <input type="number" min="0" v-model.number="getSchedule(tooth, dir).startStep" />
            </td>
            <td v-for="dir in directions" :key="tooth.toothId + dir + 'steps'">
              <input type="number" min="1" v-model.number="getSchedule(tooth, dir).steps" />
              <span class="warning" v-if="getSchedule(tooth, dir).steps < standardSteps[dir]">⚠️</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="panel-footer">
      <button class="btn btn-secondary btn-compact" @click="exportPlan">Export Step STLs</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ToothSegment, TreatmentPlan, MovementDirection, ToothMovementPlan } from '../types/dental'
import TreatmentPlanService, { STANDARD_MOVEMENT_STEPS } from '../services/TreatmentPlanService'

interface Props {
  segments: ToothSegment[]
}

const props = defineProps<Props>()

const directions: MovementDirection[] = ['anteroposterior', 'vertical', 'transverse']
const dirLabels: Record<MovementDirection, string> = {
  anteroposterior: 'AP',
  vertical: 'Vertical',
  transverse: 'Transverse',
}

const standardSteps = STANDARD_MOVEMENT_STEPS

const plan = reactive<TreatmentPlan>(TreatmentPlanService.createPlan(props.segments))

watch(
  () => props.segments,
  (newSegs) => {
    const newPlan = TreatmentPlanService.createPlan(newSegs)
    plan.teeth.splice(0, plan.teeth.length, ...newPlan.teeth)
  }
)

function getSchedule(tooth: ToothMovementPlan, dir: MovementDirection) {
  return tooth.schedules.find(s => s.direction === dir) as any
}

function exportPlan() {
  TreatmentPlanService.exportStepSTL(plan)
}
</script>

<style scoped>
.plan-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.plan-table th,
.plan-table td {
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 4px;
  text-align: center;
}
.warning {
  color: #fbbf24;
  margin-left: 4px;
}
.panel-footer {
  padding: 8px 12px;
  display: flex;
  justify-content: flex-end;
}
</style>
