<template>
  <div class="splash-screen">
    <div class="splash-content">
      <div class="logo-container">
        <div class="dental-icon">🦷</div>
        <h1 class="app-title">3D Dental Viewer</h1>
        <p class="app-subtitle">STL Segmentation Tool</p>
      </div>
      
      <div class="loading-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <p class="loading-text">{{ loadingMessage }}</p>
      </div>
      
      <div class="features-preview">
        <div class="feature-item">
          <span class="feature-icon">📐</span>
          <span>Precise Measurements</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">🎨</span>
          <span>Interactive Segmentation</span>
        </div>
        <div class="feature-item">
          <span class="feature-icon">🔧</span>
          <span>Advanced Tools</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  progress: number
  loadingMessage: string
}

defineProps<Props>()
</script>

<style scoped>
.splash-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: white;
}

.splash-content {
  text-align: center;
  max-width: 500px;
  padding: 2rem;
}

.logo-container {
  margin-bottom: 3rem;
}

.dental-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  display: block;
  animation: pulse 2s ease-in-out infinite;
}

.app-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #60a5fa, #34d399);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.app-subtitle {
  font-size: 1.1rem;
  color: #94a3b8;
  margin-bottom: 0;
}

.loading-container {
  margin-bottom: 3rem;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 1rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #34d399);
  border-radius: 2px;
  transition: width 0.3s ease;
  animation: shimmer 2s infinite;
}

.loading-text {
  color: #cbd5e1;
  font-size: 0.9rem;
  margin: 0;
}

.features-preview {
  display: flex;
  justify-content: space-around;
  gap: 1rem;
  flex-wrap: wrap;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #cbd5e1;
  font-size: 0.85rem;
  opacity: 0;
  animation: fadeInUp 0.6s ease forwards;
}

.feature-item:nth-child(1) { animation-delay: 0.2s; }
.feature-item:nth-child(2) { animation-delay: 0.4s; }
.feature-item:nth-child(3) { animation-delay: 0.6s; }

.feature-icon {
  font-size: 1.5rem;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 640px) {
  .app-title {
    font-size: 2rem;
  }
  
  .features-preview {
    flex-direction: column;
    align-items: center;
  }
}
</style>
