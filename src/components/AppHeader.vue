<template>
  <div class="app-header">
    <div class="header-content">
      <!-- Left Section: Logo and Title -->
      <div class="header-left">
        <div class="app-brand">
          <span class="app-icon">◈</span>
          <div class="brand-text">
            <h1 v-if="title">{{ title }}</h1>
            <p v-if="description">{{ description }}</p>
          </div>
        </div>
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
interface Props {
  title?: string
  description?: string
}

defineProps<Props>()
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
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
  max-width: 1200px;
  margin: 0 auto;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.app-icon {
  font-size: 28px;
  background: linear-gradient(135deg, #06b6d4, #0891b2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.brand-text h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #f1f5f9;
}

.brand-text p {
  margin: 0;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 400;
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
