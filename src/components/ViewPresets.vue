<template>
  <div class="view-presets">
    <div class="view-presets-title">Views</div>
    <div class="view-presets-grid">
      <button class="preset-btn" @click="setViewPreset('top')" title="Top View">
        <span>⬆️</span>
      </button>
      <button class="preset-btn" @click="setViewPreset('bottom')" title="Bottom View">
        <span>⬇️</span>
      </button>
      <button class="preset-btn" @click="setViewPreset('front')" title="Front View">
        <span>👁️</span>
      </button>
      <button class="preset-btn" @click="setViewPreset('back')" title="Back View">
        <span>👁️‍🗨️</span>
      </button>
      <button class="preset-btn" @click="setViewPreset('left')" title="Left View">
        <span>⬅️</span>
      </button>
      <button class="preset-btn" @click="setViewPreset('right')" title="Right View">
        <span>➡️</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// Emits
const emit = defineEmits<{
  setViewPreset: [view: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right']
}>()

function setViewPreset(view: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') {
  emit('setViewPreset', view)
}
</script>

<style scoped>
/* View Presets */
.view-presets {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  z-index: 100;
}

.view-presets-title {
  font-size: 9px;
  font-weight: 700;
  color: rgba(241, 245, 249, 0.8);
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.6) 100%);
  padding: 3px 6px;
  border-radius: 6px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(6, 182, 212, 0.2);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.2);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.view-presets-title::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.1), transparent);
  transition: left 0.6s ease;
}

.view-presets-title:hover::before {
  left: 100%;
}

.view-presets-grid {
  display: flex;
  flex-direction: row;
  gap: 3px;
  padding: 2px;
  background: linear-gradient(135deg, rgba(15, 23, 42, 0.5) 0%, rgba(30, 41, 59, 0.5) 100%);
  border-radius: 8px;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(6, 182, 212, 0.15);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
}

.preset-btn {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, rgba(51, 65, 85, 0.5) 0%, rgba(71, 85, 105, 0.5) 100%);
  border: 1px solid rgba(6, 182, 212, 0.2);
  border-radius: 6px;
  color: rgba(241, 245, 249, 0.8);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(6px);
  position: relative;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.preset-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(6, 182, 212, 0.15), transparent);
  transition: left 0.5s ease;
}

.preset-btn:hover::before {
  left: 100%;
}

.preset-btn:hover {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(8, 145, 178, 0.15) 100%);
  border-color: rgba(6, 182, 212, 0.4);
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.preset-btn:active {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}
</style>
