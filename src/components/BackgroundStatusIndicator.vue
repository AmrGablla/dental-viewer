<template>
  <div 
    v-if="status.isRunning || status.message" 
    class="background-status-indicator"
    :class="{ 'status-visible': status.isRunning || status.message }"
  >
    <div class="status-content">
      <div class="status-icon">
        <div v-if="status.isRunning" class="loading-spinner">
          <Icon name="bot" :size="16" color="currentColor" />
        </div>
        <div v-else-if="status.message.includes('completed')" class="success-icon">
          <Icon name="check-circle" :size="16" color="#10b981" />
        </div>
        <div v-else-if="status.message.includes('failed')" class="error-icon">
          <Icon name="alert-triangle" :size="16" color="#ef4444" />
        </div>
        <div v-else class="info-icon">
          <Icon name="info" :size="16" color="#51CACD" />
        </div>
      </div>
      
      <div class="status-text">
        <div class="status-message">{{ status.message }}</div>
        <div v-if="status.progress !== undefined" class="progress-container">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${status.progress}%` }"
            ></div>
          </div>
          <span class="progress-text">{{ status.progress }}%</span>
        </div>
      </div>
      
      <button 
        v-if="!status.isRunning && status.message" 
        @click="$emit('dismiss')"
        class="dismiss-btn"
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Icon from './Icon.vue'

interface BackgroundStatus {
  isRunning: boolean
  message: string
  progress?: number
}

interface Props {
  status: BackgroundStatus
}

defineProps<Props>()

defineEmits<{
  dismiss: []
}>()
</script>

<style scoped>
.background-status-indicator {
  position: fixed;
  top: 80px;
  right: 20px;
  max-width: 400px;
  background: linear-gradient(135deg, #414343 0%, #414343 100%);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  z-index: 1100;
  transform: translateX(100%);
  opacity: 0;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.background-status-indicator.status-visible {
  transform: translateX(0);
  opacity: 1;
}

.status-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  color: #f1f5f9;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.loading-spinner {
  animation: spin 2s linear infinite;
  font-size: 20px;
}

.success-icon {
  color: #10b981;
  font-size: 18px;
}

.error-icon {
  color: #ef4444;
  font-size: 18px;
}

.info-icon {
  color: #51CACD;
  font-size: 18px;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  flex: 1;
  min-width: 0;
}

.status-message {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
  word-wrap: break-word;
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #51CACD, #51CACD);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  min-width: 32px;
  text-align: right;
}

.dismiss-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-size: 14px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dismiss-btn:hover {
  background: rgba(148, 163, 184, 0.2);
  color: #f1f5f9;
}

@media (max-width: 768px) {
  .background-status-indicator {
    right: 12px;
    left: 12px;
    max-width: none;
    top: 70px;
  }
}
</style>
