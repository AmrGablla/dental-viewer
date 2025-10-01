<template>
  <TransitionGroup
    name="toast"
    tag="div"
    class="toast-container"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="[
        `toast-${toast.type}`,
        { 'toast-with-action': toast.action }
      ]"
    >
      <div class="toast-icon">
        <Icon 
          :name="getIconName(toast.type)" 
          :size="20" 
          :color="getIconColor(toast.type)" 
        />
      </div>
      
      <div class="toast-content">
        <div class="toast-title">{{ toast.title }}</div>
        <div v-if="toast.message" class="toast-message">{{ toast.message }}</div>
      </div>
      
      <div class="toast-actions">
        <button
          v-if="toast.action"
          @click="handleAction(toast)"
          class="toast-action-btn"
          :class="`action-${toast.action.type}`"
        >
          {{ toast.action.text }}
        </button>
        
        <button
          @click="removeToast(toast.id)"
          class="toast-close-btn"
          title="Dismiss"
        >
          <Icon name="x" :size="16" color="currentColor" />
        </button>
      </div>
      
      <div 
        v-if="toast.autoClose !== false"
        class="toast-progress"
        :style="{ animationDuration: `${toast.duration || 5000}ms` }"
      ></div>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Icon from './Icon.vue'
import type { Toast } from '../types/toast'

const toasts = ref<Toast[]>([])

const getIconName = (type: Toast['type']): string => {
  switch (type) {
    case 'success': return 'check-circle'
    case 'error': return 'alert-triangle'
    case 'warning': return 'alert-triangle'
    case 'info': return 'info'
    default: return 'info'
  }
}

const getIconColor = (type: Toast['type']): string => {
  switch (type) {
    case 'success': return '#10b981'
    case 'error': return '#ef4444'
    case 'warning': return '#f59e0b'
    case 'info': return '#06b6d4'
    default: return '#06b6d4'
  }
}

const removeToast = (id: string) => {
  const index = toasts.value.findIndex(toast => toast.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

const handleAction = (toast: Toast) => {
  if (toast.action) {
    toast.action.handler()
    removeToast(toast.id)
  }
}

const addToast = (toast: Omit<Toast, 'id'>) => {
  const id = Math.random().toString(36).substr(2, 9)
  const newToast: Toast = { ...toast, id }
  
  toasts.value.push(newToast)
  
  // Auto-remove toast after duration
  if (newToast.autoClose !== false) {
    setTimeout(() => {
      removeToast(id)
    }, newToast.duration || 5000)
  }
  
  return id
}

// Expose methods for external use
defineExpose({
  addToast,
  removeToast,
  toasts
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 400px;
  pointer-events: none;
}

.toast {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  color: #f1f5f9;
  min-width: 300px;
  max-width: 400px;
  pointer-events: auto;
  overflow: hidden;
}

.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  margin-top: 2px;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: #f8fafc;
}

.toast-message {
  font-size: 13px;
  color: #cbd5e1;
  line-height: 1.4;
  word-wrap: break-word;
}

.toast-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.toast-action-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.action-primary {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  color: white;
}

.action-primary:hover {
  background: linear-gradient(135deg, #0891b2, #0e7490);
  transform: translateY(-1px);
}

.action-secondary {
  background: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.action-secondary:hover {
  background: rgba(148, 163, 184, 0.3);
  border-color: rgba(148, 163, 184, 0.5);
}

.action-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: white;
}

.action-danger:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  transform: translateY(-1px);
}

.action-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}

.action-success:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
}

.toast-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(148, 163, 184, 0.2);
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.toast-close-btn:hover {
  background: rgba(148, 163, 184, 0.3);
  color: #e2e8f0;
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, #06b6d4, #0891b2);
  animation: progress linear forwards;
}

@keyframes progress {
  from { width: 100%; }
  to { width: 0%; }
}

/* Toast type variations */
.toast-success {
  border-left: 4px solid #10b981;
}

.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-warning {
  border-left: 4px solid #f59e0b;
}

.toast-info {
  border-left: 4px solid #06b6d4;
}

/* Animation classes */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.toast-move {
  transition: transform 0.3s ease;
}

/* Responsive design */
@media (max-width: 768px) {
  .toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }
  
  .toast {
    min-width: auto;
    max-width: none;
  }
}
</style>
