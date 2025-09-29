<template>
  <div 
    class="app-logo" 
    :class="{ 'centered': centered, 'large': large, 'extra-large': extraLarge, 'clickable': clickable }"
    @click="handleClick"
  >
    <img 
      src="/logo-1x.png" 
      srcset="/logo-1x.png 1x, /logo.png 2x"
      alt="Logo" 
      class="app-icon"
      :class="{ 'large': large }"
      fetchpriority="high"
    />
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
  extraLarge?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: 'My Line',
  description: 'Advanced 3D dental model viewer',
  showText: true,
  centered: false,
  large: false,
  extraLarge: false,
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
  width: 48px;
  height: 48px;
}

.app-logo.large .brand-text h1 {
  font-size: 32px;
}

.app-logo.large .brand-text p {
  font-size: 18px;
}

.app-logo.extra-large .app-icon {
  width: 120px;
  height: 120px;
}

.app-logo.extra-large .brand-text h1 {
  font-size: 40px;
}

.app-logo.extra-large .brand-text p {
  font-size: 20px;
}

.app-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  transition: all 0.3s ease;
}

.app-icon.large {
  width: 48px;
  height: 48px;
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
}

.app-logo.clickable:hover .app-icon {
  filter: drop-shadow(0 4px 8px rgba(81, 202, 205, 0.4)) brightness(1.1);
}

.app-logo.clickable:active {
  transform: scale(0.98);
}
</style>
