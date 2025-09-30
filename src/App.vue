<template>
  <div id="app">
    <router-view />
    
    <!-- Global Toast Notifications -->
    <ToastNotification ref="toastRef" />
    
    <!-- Global Confirmation Dialog -->
    <ConfirmDialog
      :isVisible="confirmDialogState.isVisible"
      :title="confirmDialogState.title"
      :message="confirmDialogState.message"
      :type="confirmDialogState.type"
      :confirmText="confirmDialogState.confirmText"
      :cancelText="confirmDialogState.cancelText"
      :showCancelButton="confirmDialogState.showCancelButton"
      @confirm="handleConfirm"
      @cancel="handleCancel"
      @close="handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ToastNotification from '@/components/ToastNotification.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { useToast } from '@/composables/useToast'
import { useConfirmDialog } from '@/composables/useConfirmDialog'

// Router view will handle all routing

// Initialize global services
const toastRef = ref()
const toastService = useToast()
const confirmDialogService = useConfirmDialog()

const confirmDialogState = confirmDialogService.getDialogState()

const handleConfirm = () => {
  confirmDialogService.handleConfirm()
}

const handleCancel = () => {
  confirmDialogService.handleCancel()
}

const handleClose = () => {
  confirmDialogService.handleClose()
}

onMounted(() => {
  // Set refs for global services
  toastService.setToastRef(toastRef.value)
  // Note: confirmDialogService doesn't need a ref as it manages its own state
})
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  width: 100%;
  overflow: hidden;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

#app {
  height: 100vh;
  width: 100vw;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>
