<template>
  <div v-if="isLoading" class="loading-overlay">
    <div class="loading-spinner"></div>
    <div class="loading-text">{{ loadingMessage }}</div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isLoading: boolean
  loadingMessage: string
}

defineProps<Props>()
</script>

<style scoped>
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(15, 23, 42, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(8px);
  border-radius: 20px;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(6, 182, 212, 0.2);
  border-top: 4px solid #06b6d4;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-text {
  color: #f1f5f9;
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}
</style>
