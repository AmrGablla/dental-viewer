<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue'
import SplashScreen from './components/SplashScreen.vue'

// Lazy load the DentalViewer component
const DentalViewer = defineAsyncComponent(() => 
  import('./components/DentalViewer.vue')
)

const isLoading = ref(true)
const loadingProgress = ref(0)
const loadingMessage = ref('Initializing 3D Engine...')

onMounted(async () => {
  // Simulate progressive loading with actual steps
  const loadingSteps = [
    { progress: 20, message: 'Loading Three.js Library...' },
    { progress: 40, message: 'Initializing WebGL Context...' },
    { progress: 60, message: 'Setting up 3D Scene...' },
    { progress: 80, message: 'Loading UI Components...' },
    { progress: 100, message: 'Ready!' }
  ]

  for (const step of loadingSteps) {
    loadingProgress.value = step.progress
    loadingMessage.value = step.message
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  // Small delay to ensure smooth transition
  await new Promise(resolve => setTimeout(resolve, 500))
  isLoading.value = false
})
</script>

<template>
  <div>
    <!-- Show splash screen while loading -->
    <SplashScreen 
      v-if="isLoading"
      :progress="loadingProgress"
      :loading-message="loadingMessage"
    />
    
    <!-- Show dental viewer when loaded -->
    <Suspense v-else>
      <template #default>
        <DentalViewer />
      </template>
      <template #fallback>
        <SplashScreen 
          :progress="90"
          loading-message="Finalizing..."
        />
      </template>
    </Suspense>
  </div>
</template>

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
