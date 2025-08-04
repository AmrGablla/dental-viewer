<!-- AI Segmentation Integration Component -->
<template>
  <div class="ai-segmentation-panel">
    <div class="panel-header">
      <span class="panel-icon">
        <Icon name="bot" :size="16" color="currentColor" />
      </span>
      <span class="panel-title">AI Segmentation</span>
    </div>
    
    <div class="panel-content">
      <!-- Upload for AI Segmentation -->
      <!-- Upload for AI Segmentation -->
      <div class="upload-section">
        <button 
          @click="triggerAIUpload" 
          :disabled="isProcessing || !backendHealthy"
          class="ai-btn"
        >
          <span class="btn-icon">
            <Icon name="bot" :size="16" color="currentColor" />
          </span>
          {{ isProcessing ? 'Processing...' : 'AI Segment STL' }}
        </button>
        
        <!-- Hidden file input -->
        <input 
          ref="aiFileInput"
          type="file" 
          accept=".stl"
          @change="handleAISegmentation"
          style="display: none"
        />
      </div>

      <!-- Segmentation Configuration -->
      <div class="config-section">
        <div class="config-header">
          <span class="config-icon">⚙️</span>
          <span class="config-title">Segmentation Parameters</span>
        </div>
        
        <div class="config-form">
          <!-- Arch Type -->
          <div class="form-group">
            <label class="form-label">Dental Arch Type</label>
            <select v-model="segmentationConfig.archType" class="form-select">
              <option value="full">Full Arch (Upper & Lower)</option>
              <option value="upper">Upper Arch Only</option>
              <option value="lower">Lower Arch Only</option>
              <option value="partial">Partial Arch</option>
            </select>
          </div>

          <!-- Expected Tooth Count -->
          <div class="form-group">
            <label class="form-label">Expected Number of Teeth</label>
            <div class="tooth-count-controls">
              <input 
                v-model.number="segmentationConfig.expectedToothCount" 
                type="range" 
                min="1" 
                max="32" 
                class="tooth-count-slider"
              />
              <span class="tooth-count-display">{{ segmentationConfig.expectedToothCount }}</span>
            </div>
          </div>

          <!-- Tooth Types Present -->
          <div class="form-group">
            <label class="form-label">Tooth Types Present</label>
            <div class="tooth-types-grid">
              <label class="checkbox-item" v-for="toothType in availableToothTypes" :key="toothType.value">
                <input 
                  type="checkbox" 
                  :value="toothType.value"
                  v-model="segmentationConfig.toothTypesPresent"
                  class="checkbox-input"
                />
                <span class="checkbox-label">{{ toothType.icon }} {{ toothType.label }}</span>
              </label>
            </div>
          </div>

          <!-- Model Quality -->
          <div class="form-group">
            <label class="form-label">STL Model Quality</label>
            <select v-model="segmentationConfig.modelQuality" class="form-select">
              <option value="high">High Quality (Dense mesh, clear boundaries)</option>
              <option value="medium">Medium Quality (Standard scan)</option>
              <option value="low">Low Quality (Sparse mesh, unclear boundaries)</option>
            </select>
          </div>

          <!-- Separation Level -->
          <div class="form-group">
            <label class="form-label">Tooth Separation</label>
            <select v-model="segmentationConfig.separationLevel" class="form-select">
              <option value="natural">Natural Gaps (Teeth are separated)</option>
              <option value="touching">Touching Teeth (Minimal gaps)</option>
              <option value="connected">Connected/Merged (No clear separation)</option>
            </select>
          </div>

          <!-- Advanced Options -->
          <details class="advanced-options">
            <summary class="advanced-toggle">Advanced Options</summary>
            <div class="advanced-content">
              <div class="form-group">
                <label class="form-label">Clustering Sensitivity</label>
                <div class="tooth-count-controls">
                  <input 
                    v-model.number="segmentationConfig.clusteringSensitivity" 
                    type="range" 
                    min="0.1" 
                    max="3.0" 
                    step="0.1"
                    class="sensitivity-slider"
                  />
                  <span class="sensitivity-display">{{ segmentationConfig.clusteringSensitivity }}</span>
                </div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Minimum Tooth Size</label>
                <div class="tooth-count-controls">
                  <input 
                    v-model.number="segmentationConfig.minToothSize" 
                    type="range" 
                    min="50" 
                    max="500" 
                    step="10"
                    class="size-slider"
                  />
                  <span class="size-display">{{ segmentationConfig.minToothSize }}</span>
                </div>
              </div>
            </div>
          </details>
        </div>
      </div>      <!-- Backend Status -->
      <div class="status-section">
        <div class="status-indicator" :class="{ healthy: backendHealthy, unhealthy: !backendHealthy }">
          <span class="status-dot"></span>
          <span class="status-text">
            {{ backendHealthy ? 'Backend Ready' : 'Backend Offline' }}
          </span>
        </div>
        <button @click="checkBackendHealth" class="btn btn-sm btn-secondary">
          Refresh Status
        </button>
      </div>

      <!-- Processing Progress -->
      <div v-if="isProcessing" class="processing-section">
        <div class="progress-info">
          <span>{{ processingMessage }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </div>

      <!-- Segmentation Results -->
      <div v-if="lastSegmentationResult" class="results-section">
        <h4>Last Segmentation Results</h4>
        <div class="result-info">
          <div class="info-item">
            <span>File:</span>
            <span>{{ lastSegmentationResult.originalFile }}</span>
          </div>
          <div class="info-item">
            <span>Segments Found:</span>
            <span>{{ lastSegmentationResult.segments.length }} teeth</span>
          </div>
          <div class="info-item">
            <span>Session ID:</span>
            <span>{{ lastSegmentationResult.sessionId.slice(0, 8) }}...</span>
          </div>
        </div>
        
        <!-- Download Individual Segments -->
        <div class="download-section">
          <h5>Download Segments</h5>
          <div class="segment-downloads">
            <button 
              v-for="segment in lastSegmentationResult.segments.slice(0, 5)"
              :key="segment.id"
              @click="downloadSegment(segment)"
              class="btn btn-sm btn-outline"
            >
              {{ segment.name }} ({{ segment.pointCount }} pts)
            </button>
            <span v-if="lastSegmentationResult.segments.length > 5">
              ...and {{ lastSegmentationResult.segments.length - 5 }} more
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Icon from './Icon.vue'
import { SegmentationService } from '../services/SegmentationService'
import type { SegmentationResult, SegmentData } from '../types/dental'

// Create segmentation service instance
const segmentationService = new SegmentationService()

// Reactive state
const aiFileInput = ref<HTMLInputElement>()
const isProcessing = ref(false)
const processingMessage = ref('')
const progressPercent = ref(0)
const backendHealthy = ref(false)
const lastSegmentationResult = ref<SegmentationResult | null>(null)

// Segmentation configuration
const segmentationConfig = ref({
  archType: 'full',
  expectedToothCount: 28,
  toothTypesPresent: ['incisors', 'canines', 'premolars', 'molars'],
  modelQuality: 'medium',
  separationLevel: 'touching',
  clusteringSensitivity: 1.5,
  minToothSize: 100
})

// Available tooth types
const availableToothTypes = [
  { value: 'incisors', label: 'Incisors', icon: '🦷' },
  { value: 'canines', label: 'Canines', icon: '🔺' },
  { value: 'premolars', label: 'Premolars', icon: '⬜' },
  { value: 'molars', label: 'Molars', icon: '⬛' }
]

// Emits
const emit = defineEmits<{
  segmentationComplete: [result: SegmentationResult]
}>()

// Check backend health on mount
onMounted(async () => {
  await checkBackendHealth()
})

async function triggerAIUpload() {
  aiFileInput.value?.click()
}

async function handleAISegmentation(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  
  if (!file) return

  try {
    isProcessing.value = true
    processingMessage.value = 'Uploading STL file...'
    progressPercent.value = 10

    // Check backend health first
    const isHealthy = await segmentationService.checkHealth()
    if (!isHealthy) {
      throw new Error('Backend service is not available. Please check server status.')
    }

    processingMessage.value = 'Analyzing mesh geometry with your parameters...'
    progressPercent.value = 30

    // Perform segmentation with user configuration
    const result = await segmentationService.segmentSTLFileWithConfig(file, segmentationConfig.value)
    
    processingMessage.value = 'Creating 3D segments...'
    progressPercent.value = 80

    // Store result and emit to parent
    lastSegmentationResult.value = result
    emit('segmentationComplete', result)
    
    processingMessage.value = `Segmentation complete! Found ${result.segments.length} teeth`
    progressPercent.value = 100

    console.log('✅ AI Segmentation successful:', result)

  } catch (error) {
    console.error('❌ AI Segmentation failed:', error)
    alert(`AI Segmentation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    isProcessing.value = false
    progressPercent.value = 0
    
    // Clear file input
    if (input) input.value = ''
    
    // Hide processing message after delay
    setTimeout(() => {
      processingMessage.value = ''
    }, 3000)
  }
}

async function checkBackendHealth() {
  try {
    backendHealthy.value = await segmentationService.checkHealth()
  } catch (error) {
    backendHealthy.value = false
    console.error('Backend health check failed:', error)
  }
}

async function downloadSegment(segment: SegmentData) {
  try {
    if (!lastSegmentationResult.value) return
    
    const blob = await segmentationService.downloadSegment(
      lastSegmentationResult.value.sessionId,
      segment.filename
    )
    
    // Create download link
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = segment.filename
    a.click()
    URL.revokeObjectURL(url)
    
    console.log(`Downloaded segment: ${segment.filename}`)
  } catch (error) {
    console.error('Download failed:', error)
    alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
</script>

<style scoped>
.ai-segmentation-panel {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(51, 65, 85, 0.4) 100%);
  border: 1px solid rgba(6, 182, 212, 0.15);
  border-radius: 12px;
  margin-bottom: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.panel-icon {
  font-size: 16px;
}

.panel-title {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 14px;
}

.panel-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.upload-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ai-btn {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: 1px solid #2563eb;
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 0.3s ease;
  cursor: pointer;
}

.ai-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.ai-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.status-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.status-indicator.healthy .status-dot {
  background: #10b981;
}

.status-text {
  color: #94a3b8;
}

.processing-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-info {
  font-size: 12px;
  color: #06b6d4;
  text-align: center;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #06b6d4, #0891b2);
  transition: width 0.3s ease;
}

.results-section {
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  padding-top: 16px;
}

.results-section h4,
.results-section h5 {
  color: #f1f5f9;
  margin-bottom: 8px;
  font-size: 14px;
}

.result-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #94a3b8;
}

.segment-downloads {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(6, 182, 212, 0.3);
  color: #06b6d4;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 11px;
  transition: all 0.3s ease;
}

.btn-outline:hover {
  background: rgba(6, 182, 212, 0.1);
  border-color: #06b6d4;
}

.btn-sm {
  padding: 4px 8px;
  font-size: 11px;
}

.config-section {
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  padding-top: 16px;
}

.config-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.config-icon {
  font-size: 14px;
}

.config-title {
  font-weight: 600;
  color: #f1f5f9;
  font-size: 13px;
}

.config-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-select {
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 6px;
  padding: 8px 10px;
  color: #f1f5f9;
  font-size: 12px;
  transition: all 0.3s ease;
}

.form-select:focus {
  outline: none;
  border-color: #06b6d4;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
}

.tooth-count-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tooth-count-slider {
  flex: 1;
  appearance: none;
  height: 4px;
  background: rgba(148, 163, 184, 0.3);
  border-radius: 2px;
  outline: none;
}

.tooth-count-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #0f172a;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.tooth-count-display {
  font-size: 12px;
  font-weight: 700;
  color: #06b6d4;
  min-width: 24px;
  text-align: center;
  background: rgba(6, 182, 212, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.tooth-types-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.checkbox-item:hover {
  background: rgba(6, 182, 212, 0.1);
}

.checkbox-input {
  appearance: none;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(148, 163, 184, 0.5);
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  transition: all 0.3s ease;
}

.checkbox-input:checked {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  border-color: #06b6d4;
}

.checkbox-input:checked::after {
  content: '✓';
  display: block;
  color: white;
  font-size: 10px;
  font-weight: bold;
  text-align: center;
  line-height: 10px;
}

.checkbox-label {
  font-size: 11px;
  color: #f1f5f9;
  user-select: none;
}

.advanced-options {
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  padding: 8px;
  background: rgba(15, 23, 42, 0.4);
}

.advanced-toggle {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  cursor: pointer;
  list-style: none;
  padding: 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.advanced-toggle::before {
  content: '▶';
  transition: transform 0.3s ease;
}

.advanced-options[open] .advanced-toggle::before {
  transform: rotate(90deg);
}

.advanced-content {
  padding-top: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.1);
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sensitivity-slider,
.size-slider {
  flex: 1;
  appearance: none;
  height: 3px;
  background: rgba(148, 163, 184, 0.3);
  border-radius: 2px;
  outline: none;
}

.sensitivity-slider::-webkit-slider-thumb,
.size-slider::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: linear-gradient(135deg, #6b7280, #4b5563);
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid #374151;
}

.sensitivity-display,
.size-display {
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  min-width: 40px;
  text-align: center;
}
</style>
