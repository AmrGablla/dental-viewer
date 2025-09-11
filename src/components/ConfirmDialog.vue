<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="isVisible"
        class="confirm-dialog-overlay"
        @click="handleOverlayClick"
      >
        <div class="confirm-dialog" @click.stop>
          <div class="confirm-dialog-header">
            <div class="confirm-dialog-icon">
              <Icon 
                :name="getIconName(type)" 
                :size="24" 
                :color="getIconColor(type)" 
              />
            </div>
            <h3 class="confirm-dialog-title">{{ title }}</h3>
          </div>
          
          <div class="confirm-dialog-content">
            <p class="confirm-dialog-message">{{ message }}</p>
          </div>
          
          <div class="confirm-dialog-actions">
            <button
              v-if="showCancelButton"
              @click="handleCancel"
              class="confirm-dialog-btn cancel-btn"
            >
              {{ cancelText }}
            </button>
            
            <button
              @click="handleConfirm"
              class="confirm-dialog-btn confirm-btn"
              :class="`confirm-${type}`"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import Icon from './Icon.vue'

interface ConfirmDialogOptions {
  title: string
  message: string
  type?: 'danger' | 'warning' | 'info' | 'success'
  confirmText?: string
  cancelText?: string
  showCancelButton?: boolean
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  isVisible: boolean
}

const props = withDefaults(defineProps<ConfirmDialogProps>(), {
  type: 'warning',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  showCancelButton: true
})

const emit = defineEmits<{
  confirm: []
  cancel: []
  close: []
}>()

const getIconName = (type: string): string => {
  switch (type) {
    case 'danger': return 'alert-triangle'
    case 'warning': return 'alert-triangle'
    case 'info': return 'info'
    case 'success': return 'check-circle'
    default: return 'alert-triangle'
  }
}

const getIconColor = (type: string): string => {
  switch (type) {
    case 'danger': return '#ef4444'
    case 'warning': return '#f59e0b'
    case 'info': return '#06b6d4'
    case 'success': return '#10b981'
    default: return '#f59e0b'
  }
}

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}

const handleOverlayClick = () => {
  emit('close')
}

// Handle escape key
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.isVisible) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 20px;
}

.confirm-dialog {
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 16px;
  padding: 24px;
  max-width: 480px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(12px);
  color: #f1f5f9;
}

.confirm-dialog-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.confirm-dialog-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: rgba(148, 163, 184, 0.1);
  border-radius: 12px;
  flex-shrink: 0;
}

.confirm-dialog-title {
  font-size: 20px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
}

.confirm-dialog-content {
  margin-bottom: 24px;
}

.confirm-dialog-message {
  font-size: 16px;
  line-height: 1.6;
  color: #cbd5e1;
  margin: 0;
}

.confirm-dialog-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.confirm-dialog-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 100px;
}

.cancel-btn {
  background: rgba(148, 163, 184, 0.2);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.cancel-btn:hover {
  background: rgba(148, 163, 184, 0.3);
  border-color: rgba(148, 163, 184, 0.5);
}

.confirm-btn {
  color: white;
}

.confirm-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
}

.confirm-danger:hover {
  background: linear-gradient(135deg, #dc2626, #b91c1c);
  transform: translateY(-1px);
}

.confirm-warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
}

.confirm-warning:hover {
  background: linear-gradient(135deg, #d97706, #b45309);
  transform: translateY(-1px);
}

.confirm-info {
  background: linear-gradient(135deg, #06b6d4, #0891b2);
}

.confirm-info:hover {
  background: linear-gradient(135deg, #0891b2, #0e7490);
  transform: translateY(-1px);
}

.confirm-success {
  background: linear-gradient(135deg, #10b981, #059669);
}

.confirm-success:hover {
  background: linear-gradient(135deg, #059669, #047857);
  transform: translateY(-1px);
}

/* Animation classes */
.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.confirm-dialog-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

.confirm-dialog-leave-to {
  opacity: 0;
  transform: scale(0.9) translateY(-20px);
}

/* Responsive design */
@media (max-width: 768px) {
  .confirm-dialog-overlay {
    padding: 16px;
  }
  
  .confirm-dialog {
    padding: 20px;
  }
  
  .confirm-dialog-actions {
    flex-direction: column;
  }
  
  .confirm-dialog-btn {
    width: 100%;
  }
}
</style>
