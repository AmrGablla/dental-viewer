<template>
  <div class="splash-screen">
    <div class="splash-content">
      <div class="logo-container">
        <img src="/logo-1x.png" srcset="/logo-1x.png 1x, /logo.png 2x" alt="Logo" class="dental-icon" fetchpriority="high" />
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
  background: linear-gradient(135deg, #414343 0%, #414343 50%, #414343 100%);
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
  width: 80px;
  height: 80px;
  margin-bottom: 1rem;
  display: block;
  animation: pulse 2s ease-in-out infinite;
  object-fit: contain;
  filter: drop-shadow(0 4px 8px rgba(81, 202, 205, 0.3));
}

.app-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, #51CACD, #51CACD);
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
  height: 8px;
  background: linear-gradient(135deg, rgba(45, 47, 47, 0.8) 0%, rgba(35, 37, 37, 0.6) 100%);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 1.5rem;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(81, 202, 205, 0.2);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #51CACD 0%, #4AB8BB 50%, #3FA4A7 100%);
  border-radius: 6px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  animation: shimmer 2s infinite;
  box-shadow: 0 0 12px rgba(81, 202, 205, 0.4);
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
