<template>
  <div class="app-header">
    <div class="header-content">
      <!-- Left Section: Logo and Title -->
      <div class="header-left">
        <AppLogo
          :title="title"
          :description="description"
          :clickable="clickable"
          @click="handleLogoClick"
        />
      </div>

      <!-- Center Section: Optional Content -->
      <div v-if="$slots.center" class="header-center">
        <slot name="center" />
      </div>

      <!-- Right Section: Actions -->
      <div class="header-right">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppLogo from "./AppLogo.vue";

interface Props {
  title?: string;
  description?: string;
  clickable?: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  logoClick: [];
}>();

function handleLogoClick() {
  emit("logoClick");
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #414343 0%, #414343 100%);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  padding: 12px 20px;
  height: 64px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(10px);
  z-index: 1000;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  margin: 0 auto;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

/* Responsive */
@media (max-width: 768px) {
  .header-content {
    flex-direction: column;
    gap: 16px;
    text-align: center;
  }

  .header-center {
    order: 3;
    width: 100%;
  }

  .header-right {
    order: 2;
  }
}
</style>
