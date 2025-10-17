<template>
  <div class="brush-settings">
    <div class="brush-header">
      <div class="header-content">
        <Icon name="brush" :size="16" color="currentColor" />
        <span class="header-title">Brush Settings</span>
      </div>
      <button @click="$emit('close')" class="close-btn" title="Close Settings">
        <Icon name="x" :size="16" color="currentColor" />
      </button>
    </div>
    
    <div class="brush-body">
      <!-- Brush Size -->
      <div class="setting-group compact">
        <label class="setting-label">
          <Icon name="circle" :size="12" color="currentColor" />
          <span>Size: <strong>{{ settings.radius.toFixed(1) }}mm</strong></span>
        </label>
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.1"
          v-model.number="settings.radius"
          @input="emitUpdate"
          class="slider"
        />
      </div>
      
      <!-- Brush Strength -->
      <div class="setting-group compact">
        <label class="setting-label">
          <Icon name="zap" :size="12" color="currentColor" />
          <span>Strength: <strong>{{ Math.round(settings.strength * 100) }}%</strong></span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          v-model.number="settings.strength"
          @input="emitUpdate"
          class="slider"
        />
      </div>
      
      <!-- Brush Hardness -->
      <div class="setting-group compact">
        <label class="setting-label">
          <Icon name="target" :size="12" color="currentColor" />
          <span>Hardness: <strong>{{ Math.round(settings.hardness * 100) }}%</strong></span>
        </label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          v-model.number="settings.hardness"
          @input="emitUpdate"
          class="slider"
        />
      </div>
      
      <!-- Dental-Aware Mode -->
      <div class="setting-group compact">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="settings.dentalAwareMode"
            @change="emitUpdate"
            class="checkbox-input"
          />
          <div class="checkbox-custom">
            <Icon 
              v-if="settings.dentalAwareMode" 
              name="check" 
              :size="10" 
              color="white" 
            />
          </div>
          <span class="checkbox-text">
            <Icon name="brain" :size="12" color="currentColor" />
            Dental-Aware
          </span>
        </label>
      </div>
      
      <!-- Respect Boundaries -->
      <div class="setting-group compact">
        <label class="checkbox-label">
          <input
            type="checkbox"
            v-model="settings.respectBoundaries"
            @change="emitUpdate"
            class="checkbox-input"
          />
          <div class="checkbox-custom">
            <Icon 
              v-if="settings.respectBoundaries" 
              name="check" 
              :size="10" 
              color="white" 
            />
          </div>
          <span class="checkbox-text">
            <Icon name="shield" :size="12" color="currentColor" />
            Boundaries
          </span>
        </label>
      </div>
      
      <!-- Presets -->
      <div class="setting-group presets-group">
        <label class="setting-label">Presets</label>
        <div class="preset-buttons">
          <button 
            @click="applyPreset('fine')" 
            class="preset-btn"
            title="Fine: 1.0mm"
          >
            Fine
          </button>
          <button 
            @click="applyPreset('normal')" 
            class="preset-btn"
            title="Normal: 2.5mm"
          >
            Normal
          </button>
          <button 
            @click="applyPreset('large')" 
            class="preset-btn"
            title="Large: 5.0mm"
          >
            Large
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import Icon from './Icon.vue'
import type { BrushSettings } from '../services/EnhancedBrushService'

const props = defineProps<{
  initialSettings?: Partial<BrushSettings>
}>()

const emit = defineEmits<{
  (e: 'update', settings: BrushSettings): void
  (e: 'close'): void
}>()

const settings = reactive<BrushSettings>({
  radius: 1.5,
  strength: 1.0,
  hardness: 0.9,
  mode: 'create',
  dentalAwareMode: false,
  respectBoundaries: false,
  adaptiveSampling: true,
  ...props.initialSettings
})

// Watch for external changes
watch(() => props.initialSettings, (newSettings) => {
  if (newSettings) {
    Object.assign(settings, newSettings)
  }
}, { deep: true })

function emitUpdate() {
  emit('update', { ...settings })
}

function applyPreset(preset: 'fine' | 'normal' | 'large') {
  const presets = {
    fine: {
      radius: 1.0,
      strength: 0.8,
      hardness: 0.95,
      dentalAwareMode: false,
      respectBoundaries: false
    },
    normal: {
      radius: 2.5,
      strength: 1.0,
      hardness: 0.8,
      dentalAwareMode: false,
      respectBoundaries: false
    },
    large: {
      radius: 5.0,
      strength: 1.0,
      hardness: 0.6,
      dentalAwareMode: false,
      respectBoundaries: false
    }
  }
  
  Object.assign(settings, presets[preset])
  emitUpdate()
}
</script>

<style scoped>
.brush-settings {
  background: linear-gradient(135deg, rgba(65, 67, 67, 0.98) 0%, rgba(55, 57, 57, 0.95) 100%);
  border: 1px solid rgba(81, 202, 205, 0.3);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  width: 240px;
}

.brush-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(81, 202, 205, 0.15) 0%, rgba(81, 202, 205, 0.05) 100%);
  border-bottom: 1px solid rgba(81, 202, 205, 0.2);
  user-select: none;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #51CACD;
}

.header-title {
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
}

.brush-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: #e2e8f0;
}

.setting-label strong {
  color: #51CACD;
  font-weight: 600;
}

.slider-container {
  width: 100%;
}

.slider {
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(135deg, rgba(45, 47, 47, 0.8) 0%, rgba(35, 37, 37, 0.6) 100%);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #51CACD 0%, #4AB8BB 100%);
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(81, 202, 205, 0.4);
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(81, 202, 205, 0.6);
}

.slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: linear-gradient(135deg, #51CACD 0%, #4AB8BB 100%);
  cursor: pointer;
  border: none;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(81, 202, 205, 0.4);
}

.slider::-moz-range-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(81, 202, 205, 0.6);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #e2e8f0;
  cursor: pointer;
  user-select: none;
  padding: 2px 0;
}

.checkbox-input {
  display: none;
}

.checkbox-custom {
  width: 14px;
  height: 14px;
  border: 1.5px solid rgba(81, 202, 205, 0.4);
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(45, 47, 47, 0.6);
  transition: all 0.2s;
  flex-shrink: 0;
}

.checkbox-input:checked + .checkbox-custom {
  background: linear-gradient(135deg, #51CACD 0%, #4AB8BB 100%);
  border-color: #51CACD;
}

.checkbox-label:hover .checkbox-custom {
  border-color: rgba(81, 202, 205, 0.6);
}

.checkbox-text {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.setting-group.compact {
  gap: 2px;
}

.setting-hint {
  font-size: 9px;
  color: #94a3b8;
  margin: 0;
  padding-left: 20px;
  line-height: 1.3;
}

.presets-group {
  margin-top: 4px;
  padding-top: 10px;
  border-top: 1px solid rgba(81, 202, 205, 0.1);
}

.preset-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.preset-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 8px;
  background: linear-gradient(135deg, rgba(81, 202, 205, 0.1) 0%, rgba(81, 202, 205, 0.05) 100%);
  border: 1px solid rgba(81, 202, 205, 0.3);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-btn:hover {
  background: linear-gradient(135deg, rgba(81, 202, 205, 0.2) 0%, rgba(81, 202, 205, 0.1) 100%);
  border-color: rgba(81, 202, 205, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(81, 202, 205, 0.2);
}

.preset-btn:active {
  transform: translateY(0);
}
</style>


