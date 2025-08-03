<template>
  <div class="movement-controls" v-if="selectedSegments.length > 0">
    <!-- 3D Directional Tool -->
    <div class="direction-tool">
      <!-- Vertical Controls (Top/Bottom) -->
      <div class="vertical-row">
        <button 
          class="control-btn vertical-btn top-btn" 
          @mousedown="startDirectionalMove('Vertical', 1)" 
          @mouseup="stopDirectionalMove" 
          @mouseleave="stopDirectionalMove"
          title="Move Superior"
        >
          <span class="btn-icon">⬆️</span>
        </button>
      </div>
      
      <!-- Horizontal Controls (Left/Center/Right) -->
      <div class="horizontal-row">
        <button 
          class="control-btn horizontal-btn left-btn" 
          @mousedown="startDirectionalMove('Transverse', -1)" 
          @mouseup="stopDirectionalMove" 
          @mouseleave="stopDirectionalMove"
          title="Move Left"
        >
          <span class="btn-icon">⬅️</span>
        </button>
        
        <div class="center-control">
          <button 
            class="control-btn center-btn back-btn" 
            @mousedown="startDirectionalMove('Anteroposterior', -1)" 
            @mouseup="stopDirectionalMove" 
            @mouseleave="stopDirectionalMove"
            title="Move Posterior"
          >
            <span class="btn-icon">🔙</span>
          </button>
          <button 
            class="control-btn center-btn forward-btn" 
            @mousedown="startDirectionalMove('Anteroposterior', 1)" 
            @mouseup="stopDirectionalMove" 
            @mouseleave="stopDirectionalMove"
            title="Move Anterior"
          >
            <span class="btn-icon">🔜</span>
          </button>
        </div>
        
        <button 
          class="control-btn horizontal-btn right-btn" 
          @mousedown="startDirectionalMove('Transverse', 1)" 
          @mouseup="stopDirectionalMove" 
          @mouseleave="stopDirectionalMove"
          title="Move Right"
        >
          <span class="btn-icon">➡️</span>
        </button>
      </div>
      
      <!-- Vertical Controls (Bottom) -->
      <div class="vertical-row">
        <button 
          class="control-btn vertical-btn bottom-btn" 
          @mousedown="startDirectionalMove('Vertical', -1)" 
          @mouseup="stopDirectionalMove" 
          @mouseleave="stopDirectionalMove"
          title="Move Inferior"
        >
          <span class="btn-icon">⬇️</span>
        </button>
      </div>
    </div>
    
    <!-- Movement Display -->
    <div v-if="totalMovementDistance > 0" class="movement-display">
      <span class="distance-text">{{ totalMovementDistance.toFixed(1) }}mm</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToothSegment } from '../types/dental'

// Props
interface Props {
  selectedSegments: ToothSegment[]
  totalMovementDistance: number
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  startDirectionalMove: [axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number]
  stopDirectionalMove: []
}>()

function startDirectionalMove(axis: 'Anteroposterior' | 'Vertical' | 'Transverse', direction: number) {
  emit('startDirectionalMove', axis, direction)
}

function stopDirectionalMove() {
  emit('stopDirectionalMove')
}
</script>

<style scoped>
.movement-controls {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 16px;
  padding: 12px;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  z-index: 100;
  transition: all 0.3s ease;
}

.direction-tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.3) 0%, rgba(51, 65, 85, 0.3) 100%);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 12px;
  padding: 8px;
  backdrop-filter: blur(8px);
}

.vertical-row {
  display: flex;
  justify-content: center;
}

.horizontal-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.center-control {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 4px;
}

.control-btn {
  background: linear-gradient(135deg, rgba(51, 65, 85, 0.8) 0%, rgba(71, 85, 105, 0.8) 100%);
  border: 1px solid rgba(6, 182, 212, 0.3);
  border-radius: 8px;
  color: #f1f5f9;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.control-btn:hover {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(8, 145, 178, 0.3) 100%);
  border-color: rgba(6, 182, 212, 0.6);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.4);
}

.control-btn:active {
  transform: translateY(0);
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.4) 0%, rgba(8, 145, 178, 0.4) 100%);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* Vertical buttons (up/down) */
.vertical-btn {
  width: 32px;
  height: 28px;
}

.top-btn {
  border-radius: 12px 12px 6px 6px;
}

.bottom-btn {
  border-radius: 6px 6px 12px 12px;
}

/* Horizontal buttons (left/right) */
.horizontal-btn {
  width: 28px;
  height: 32px;
}

.left-btn {
  border-radius: 12px 6px 6px 12px;
}

.right-btn {
  border-radius: 6px 12px 12px 6px;
}

/* Center buttons (forward/back) */
.center-btn {
  width: 24px;
  height: 16px;
  font-size: 10px;
}

.back-btn {
  border-radius: 6px 6px 2px 2px;
}

.forward-btn {
  border-radius: 2px 2px 6px 6px;
}

.btn-icon {
  font-size: 14px;
  line-height: 1;
}

.center-btn .btn-icon {
  font-size: 12px;
}

.movement-display {
  padding-left: 12px;
  border-left: 1px solid rgba(6, 182, 212, 0.2);
}

.distance-text {
  font-size: 11px;
  font-weight: 600;
  color: #06b6d4;
  background: rgba(6, 182, 212, 0.1);
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(6, 182, 212, 0.3);
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .movement-controls {
    top: 8px;
    left: 8px;
    gap: 8px;
    padding: 8px;
  }
  
  .direction-tool {
    padding: 6px;
    gap: 3px;
  }
  
  .vertical-btn {
    width: 28px;
    height: 24px;
  }
  
  .horizontal-btn {
    width: 24px;
    height: 28px;
  }
  
  .center-btn {
    width: 20px;
    height: 14px;
  }
  
  .btn-icon {
    font-size: 12px;
  }
  
  .center-btn .btn-icon {
    font-size: 10px;
  }
  
  .movement-display {
    padding-left: 8px;
  }
  
  .distance-text {
    font-size: 10px;
    padding: 4px 8px;
  }
}
</style>
