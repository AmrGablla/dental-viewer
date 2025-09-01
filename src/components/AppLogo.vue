<template>
  <div 
    class="app-logo" 
    :class="{ 'centered': centered, 'large': large, 'clickable': clickable }"
    @click="handleClick"
  >
    <span class="app-icon">◈</span>
    <div v-if="showText" class="brand-text">
      <h1 v-if="title">{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title?: string
  description?: string
  showText?: boolean
  centered?: boolean
  large?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Aligner',
  description: 'Advanced 3D dental model viewer',
  showText: true,
  centered: false,
  large: false,
  clickable: false
})

const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  if (props.clickable) {
    emit('click')
  }
}
</script>

<style scoped>
.app-logo {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-logo.centered {
  justify-content: center;
  flex-direction: column;
  gap: 12px;
}

.app-logo.large .app-icon {
  font-size: 48px;
}

.app-logo.large .brand-text h1 {
  font-size: 32px;
}

.app-logo.large .brand-text p {
  font-size: 18px;
}

.app-icon {
  font-size: 32px;
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.brand-text h1 {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 700;
  color: #f1f5f9;
}

.brand-text p {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
  font-weight: 400;
}

.app-logo.centered .brand-text {
  text-align: center;
}

.app-logo.clickable {
  cursor: pointer;
  transition: all 0.3s ease;
}

.app-logo.clickable:hover {
  transform: scale(1.05);
  filter: brightness(1.1);
}

.app-logo.clickable:active {
  transform: scale(0.98);
}
</style>
