<script setup lang="ts">
import DentalViewer from './components/DentalViewer.vue'
</script>

<template>
  <DentalViewer />
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
  font-family: 'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(circle at top left, #0f172a, #1e3a8a);
  color: #e2e8f0;
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
