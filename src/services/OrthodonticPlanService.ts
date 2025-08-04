import type { 
  ToothSegment, 
  OrthodonticTreatmentPlan, 
  ToothMovementPlan, 
  MovementDirection,
  TreatmentStep,
  MovementStandards 
} from '../types/dental'

export class OrthodonticPlanService {
  private movementStandards: MovementStandards = {
    maxMovementPerStep: {
      anteroposterior: 0.25, // mm per step
      vertical: 0.2, // mm per step  
      transverse: 0.25 // mm per step
    },
    safetyFactors: {
      normal: 1.2,
      complex: 1.5
    },
    minStepsForDistance: {
      small: 8,   // minimum steps for < 2mm movement
      medium: 15, // minimum steps for 2-5mm movement
      large: 25   // minimum steps for > 5mm movement
    }
  }

  createTreatmentPlan(segments: ToothSegment[], planName: string): OrthodonticTreatmentPlan {
    const movedSegments = segments.filter(segment => this.hasSignificantMovement(segment))
    
    if (movedSegments.length === 0) {
      throw new Error('No significant tooth movements found')
    }

    const teethMovements = movedSegments.map(segment => this.createToothMovementPlan(segment))
    const treatmentSteps = this.calculateTreatmentSteps(teethMovements)
    
    const plan: OrthodonticTreatmentPlan = {
      id: `plan-${Date.now()}`,
      name: planName,
      createdDate: new Date(),
      lastModified: new Date(),
      totalSteps: Math.max(...teethMovements.map(tm => tm.totalSteps)),
      currentStep: 1,
      estimatedDuration: this.calculateEstimatedDuration(treatmentSteps),
      teethMovements,
      treatmentSteps,
      metadata: {
        complexity: this.assessComplexity(teethMovements),
        notes: `Treatment plan for ${movedSegments.length} teeth`
      }
    }

    return plan
  }

  private hasSignificantMovement(segment: ToothSegment): boolean {
    if (!segment.movementHistory) return false
    
    const { axisMovements } = segment.movementHistory
    return (
      Math.abs(axisMovements.anteroposterior) > 0.1 ||
      Math.abs(axisMovements.vertical) > 0.1 ||
      Math.abs(axisMovements.transverse) > 0.1
    )
  }

  private createToothMovementPlan(segment: ToothSegment): ToothMovementPlan {
    if (!segment.movementHistory) {
      throw new Error(`Segment ${segment.name} has no movement history`)
    }

    const movements: MovementDirection[] = []
    const { axisMovements } = segment.movementHistory

    // Create movement directions for each axis with significant movement
    if (Math.abs(axisMovements.anteroposterior) > 0.1) {
      movements.push(this.createMovementDirection('anteroposterior', axisMovements.anteroposterior))
    }
    
    if (Math.abs(axisMovements.vertical) > 0.1) {
      movements.push(this.createMovementDirection('vertical', axisMovements.vertical))
    }
    
    if (Math.abs(axisMovements.transverse) > 0.1) {
      movements.push(this.createMovementDirection('transverse', axisMovements.transverse))
    }

    const totalSteps = Math.max(...movements.map(m => m.userSteps || m.recommendedSteps))

    return {
      toothId: segment.id,
      toothName: segment.name,
      startStep: 1,
      movements,
      totalSteps,
      isCompleted: false
    }
  }

  private createMovementDirection(
    direction: 'anteroposterior' | 'vertical' | 'transverse', 
    distance: number
  ): MovementDirection {
    const absDistance = Math.abs(distance)
    const maxPerStep = this.movementStandards.maxMovementPerStep[direction]
    
    // Calculate recommended steps based on distance and safety
    let recommendedSteps = Math.ceil(absDistance / maxPerStep)
    
    // Apply minimum steps based on distance ranges
    if (absDistance < 2) {
      recommendedSteps = Math.max(recommendedSteps, this.movementStandards.minStepsForDistance.small)
    } else if (absDistance <= 5) {
      recommendedSteps = Math.max(recommendedSteps, this.movementStandards.minStepsForDistance.medium)
    } else {
      recommendedSteps = Math.max(recommendedSteps, this.movementStandards.minStepsForDistance.large)
    }

    const safetyFactor = absDistance > 3 ? 
      this.movementStandards.safetyFactors.complex : 
      this.movementStandards.safetyFactors.normal

    const warnings: string[] = []
    
    if (absDistance > 5) {
      warnings.push('Large movement distance - consider extended treatment time')
    }
    
    if (absDistance / recommendedSteps > maxPerStep) {
      warnings.push('Movement per step exceeds recommended maximum')
    }

    return {
      direction,
      distance,
      recommendedSteps,
      safetyFactor,
      warnings
    }
  }

  private calculateTreatmentSteps(teethMovements: ToothMovementPlan[]): TreatmentStep[] {
    const maxSteps = Math.max(...teethMovements.map(tm => tm.totalSteps))
    const steps: TreatmentStep[] = []

    for (let stepNumber = 1; stepNumber <= maxSteps; stepNumber++) {
      const movements = teethMovements
        .filter(tm => stepNumber >= tm.startStep && stepNumber <= tm.startStep + tm.totalSteps - 1)
        .map(tm => ({
          toothId: tm.toothId,
          movement: tm.movements[0] // Simplified - could be more complex
        }))

      if (movements.length > 0) {
        steps.push({
          stepNumber,
          description: `Step ${stepNumber}: Move ${movements.length} teeth`,
          teethInvolved: movements.map(m => m.toothId),
          estimatedDuration: 14, // 2 weeks per step
          movements
        })
      }
    }

    return steps
  }

  private calculateEstimatedDuration(steps: TreatmentStep[]): number {
    return steps.reduce((total, step) => total + step.estimatedDuration, 0)
  }

  private assessComplexity(teethMovements: ToothMovementPlan[]): 'simple' | 'moderate' | 'complex' {
    const totalTeeth = teethMovements.length
    const maxDistance = Math.max(...teethMovements.flatMap(tm => 
      tm.movements.map(m => Math.abs(m.distance))
    ))
    const totalSteps = Math.max(...teethMovements.map(tm => tm.totalSteps))

    if (totalTeeth <= 3 && maxDistance <= 2 && totalSteps <= 15) {
      return 'simple'
    } else if (totalTeeth <= 8 && maxDistance <= 5 && totalSteps <= 30) {
      return 'moderate'
    } else {
      return 'complex'
    }
  }

  updateMovementSteps(plan: OrthodonticTreatmentPlan, toothId: string, movementIndex: number, newSteps: number): OrthodonticTreatmentPlan {
    const tooth = plan.teethMovements.find(tm => tm.toothId === toothId)
    if (!tooth || !tooth.movements[movementIndex]) {
      throw new Error('Invalid tooth or movement index')
    }

    const movement = tooth.movements[movementIndex]
    const minSteps = movement.recommendedSteps
    
    // Validate step count
    if (newSteps < minSteps) {
      movement.warnings = [...(movement.warnings || []), `Steps reduced below recommended minimum of ${minSteps}`]
    } else {
      movement.warnings = (movement.warnings || []).filter(w => !w.includes('reduced below recommended'))
    }

    movement.userSteps = newSteps
    tooth.totalSteps = Math.max(...tooth.movements.map(m => m.userSteps || m.recommendedSteps))
    
    // Recalculate plan totals
    plan.totalSteps = Math.max(...plan.teethMovements.map(tm => tm.totalSteps))
    plan.treatmentSteps = this.calculateTreatmentSteps(plan.teethMovements)
    plan.estimatedDuration = this.calculateEstimatedDuration(plan.treatmentSteps)
    plan.lastModified = new Date()

    return plan
  }
}
