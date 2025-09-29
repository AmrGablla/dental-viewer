<template>
  <div v-if="isLoading" class="loading-overlay">
    <div class="loading-logo-container">
      <img src="/logo-1x.png" srcset="/logo-1x.png 1x, /logo.png 2x" alt="Logo" class="loading-logo" fetchpriority="high" />
    </div>
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
  background: linear-gradient(135deg, rgba(65, 67, 67, 0.95) 0%, rgba(45, 47, 47, 0.9) 50%, rgba(25, 27, 27, 0.85) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(12px);
  border-radius: 20px;
  box-shadow: inset 0 0 50px rgba(81, 202, 205, 0.1);
}

.loading-logo-container {
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-logo {
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(81, 202, 205, 0.4));
  animation: logoPulse 2s ease-in-out infinite;
}

@keyframes logoPulse {
  0%, 100% { 
    transform: scale(1);
    filter: drop-shadow(0 4px 12px rgba(81, 202, 205, 0.4));
  }
  50% { 
    transform: scale(1.05);
    filter: drop-shadow(0 6px 16px rgba(81, 202, 205, 0.6));
  }
}


.loading-text {
  color: #f1f5f9;
  font-size: 16px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: 0.5px;
}
</style>
