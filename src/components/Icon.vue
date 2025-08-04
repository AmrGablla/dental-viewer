<template>
  <svg 
    :width="size" 
    :height="size" 
    viewBox="0 0 24 24" 
    fill="none" 
    :stroke="color" 
    :stroke-width="strokeWidth" 
    stroke-linecap="round" 
    stroke-linejoin="round"
    :class="className"
  >
    <!-- ChevronUp -->
    <polyline v-if="name === 'chevron-up'" points="18,15 12,9 6,15"></polyline>
    
    <!-- ChevronDown -->
    <polyline v-if="name === 'chevron-down'" points="6,9 12,15 18,9"></polyline>
    
    <!-- ChevronLeft -->
    <polyline v-if="name === 'chevron-left'" points="15,18 9,12 15,6"></polyline>
    
    <!-- ChevronRight -->
    <polyline v-if="name === 'chevron-right'" points="9,18 15,12 9,6"></polyline>
    
    <!-- ArrowUp -->
    <g v-if="name === 'arrow-up'">
      <line x1="12" y1="19" x2="12" y2="5"></line>
      <polyline points="5,12 12,5 19,12"></polyline>
    </g>
    
    <!-- ArrowDown -->
    <g v-if="name === 'arrow-down'">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <polyline points="19,12 12,19 5,12"></polyline>
    </g>
    
    <!-- ArrowRight -->
    <g v-if="name === 'arrow-right'">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12,5 19,12 12,19"></polyline>
    </g>
    
    <!-- Eye -->
    <g v-if="name === 'eye'">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </g>
    
    <!-- EyeOff -->
    <g v-if="name === 'eye-off'">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
    </g>
    
    <!-- RotateCcw -->
    <g v-if="name === 'rotate-ccw'">
      <polyline points="1,4 1,10 7,10"></polyline>
      <path d="M3.51,15a9,9 0 1,0 2.13,-9.36L1,10"></path>
    </g>
    
    <!-- Trash2 -->
    <g v-if="name === 'trash-2'">
      <polyline points="3,6 5,6 21,6"></polyline>
      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </g>
    
    <!-- AlertTriangle -->
    <g v-if="name === 'alert-triangle'">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </g>
    
    <!-- Bot -->
    <g v-if="name === 'bot'">
      <rect x="3" y="11" width="18" height="10" rx="2" ry="2"></rect>
      <circle cx="12" cy="5" r="2"></circle>
      <path d="M12 7v4"></path>
      <line x1="8" y1="16" x2="8" y2="16"></line>
      <line x1="16" y1="16" x2="16" y2="16"></line>
    </g>
    
    <!-- CheckCircle -->
    <g v-if="name === 'check-circle'">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22,4 12,14.01 9,11.01"></polyline>
    </g>
    
    <!-- Info -->
    <g v-if="name === 'info'">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </g>
    
    <!-- Maximize2 -->
    <g v-if="name === 'maximize-2'">
      <polyline points="15,3 21,3 21,9"></polyline>
      <polyline points="9,21 3,21 3,15"></polyline>
      <line x1="21" y1="3" x2="14" y2="10"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </g>
    
    <!-- Minimize2 -->
    <g v-if="name === 'minimize-2'">
      <polyline points="4,14 10,14 10,20"></polyline>
      <polyline points="20,10 14,10 14,4"></polyline>
      <line x1="14" y1="10" x2="21" y2="3"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </g>
    
    <!-- Layers -->
    <g v-if="name === 'layers'">
      <polygon points="12,2 2,7 12,12 22,7"></polygon>
      <polyline points="2,17 12,22 22,17"></polyline>
      <polyline points="2,12 12,17 22,12"></polyline>
    </g>
    
    <!-- FileText -->
    <g v-if="name === 'file-text'">
      <path d="M14,2H6a2,2 0 0,0 -2,2V20a2,2 0 0,0 2,2H18a2,2 0 0,0 2,-2V8Z"></path>
      <polyline points="14,2 14,8 20,8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10,9 9,9 8,9"></polyline>
    </g>
    
    <!-- Grid -->
    <g v-if="name === 'grid'">
      <rect x="3" y="3" width="7" height="7"></rect>
      <rect x="14" y="3" width="7" height="7"></rect>
      <rect x="14" y="14" width="7" height="7"></rect>
      <rect x="3" y="14" width="7" height="7"></rect>
    </g>
  </svg>
</template>

<script setup lang="ts">
interface Props {
  name: string
  size?: number | string
  color?: string
  strokeWidth?: number | string
  className?: string
}

withDefaults(defineProps<Props>(), {
  size: 16,
  color: 'currentColor',
  strokeWidth: 2,
  className: ''
})
</script>

<style scoped>
svg {
  display: inline-block;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
