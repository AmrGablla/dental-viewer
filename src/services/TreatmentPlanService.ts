import type { ToothSegment, MovementDirection, TreatmentPlan, ToothMovementPlan } from '../types/dental'

export const STANDARD_MOVEMENT_STEPS: Record<MovementDirection, number> = {
  anteroposterior: 5,
  vertical: 5,
  transverse: 5,
}

export class TreatmentPlanService {
  createPlan(segments: ToothSegment[]): TreatmentPlan {
    const teeth: ToothMovementPlan[] = segments.map(segment => ({
      toothId: segment.id,
      toothName: segment.name,
      schedules: [
        { direction: 'anteroposterior', startStep: 0, steps: STANDARD_MOVEMENT_STEPS.anteroposterior },
        { direction: 'vertical', startStep: 0, steps: STANDARD_MOVEMENT_STEPS.vertical },
        { direction: 'transverse', startStep: 0, steps: STANDARD_MOVEMENT_STEPS.transverse },
      ],
    }))
    return { teeth }
  }

  updateSchedule(
    plan: TreatmentPlan,
    toothId: string,
    direction: MovementDirection,
    startStep: number,
    steps: number
  ) {
    const tooth = plan.teeth.find(t => t.toothId === toothId)
    if (!tooth) return
    const schedule = tooth.schedules.find(s => s.direction === direction)
    if (schedule) {
      schedule.startStep = startStep
      schedule.steps = steps
    }
  }

  validatePlan(plan: TreatmentPlan): string[] {
    const warnings: string[] = []
    for (const tooth of plan.teeth) {
      for (const sched of tooth.schedules) {
        const min = STANDARD_MOVEMENT_STEPS[sched.direction]
        if (sched.steps < min) {
          warnings.push(
            `${tooth.toothName} ${sched.direction} movement has fewer steps (${sched.steps}) than recommended (${min}).`
          )
        }
      }
    }
    return warnings
  }

  exportStepSTL(_plan: TreatmentPlan) {
    // Placeholder for STL export logic per treatment step
    console.warn('exportStepSTL is not implemented.')
  }
}

export default new TreatmentPlanService()
