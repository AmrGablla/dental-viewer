import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  build: {
    // Increase chunk size warning limit for 3D applications
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Manual chunking strategy for better loading performance
        manualChunks: (id) => {
          // Three.js and related 3D libraries in separate chunk
          if (id.includes('three') || id.includes('three-mesh-bvh') || id.includes('three-stdlib')) {
            return 'three-vendor'
          }
          
          // Vue.js framework
          if (id.includes('vue') || id.includes('@vue')) {
            return 'vue-vendor'
          }
          
          // Router and routing logic
          if (id.includes('vue-router')) {
            return 'router-vendor'
          }
          
          // Large components that are not immediately needed
          if (id.includes('DentalViewer') || id.includes('useThreeJS') || id.includes('useThreeJSManager')) {
            return 'viewer-chunk'
          }
          
          // Services and utilities
          if (id.includes('services/') || id.includes('utils/')) {
            return 'services-chunk'
          }
          
          // Composables
          if (id.includes('composables/')) {
            return 'composables-chunk'
          }
        }
      }
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Use esbuild for faster minification
    minify: 'esbuild',
    // Target modern browsers for better optimization
    target: 'esnext'
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'vue',
      'vue-router'
    ],
    // Exclude Three.js from pre-bundling to enable lazy loading
    exclude: [
      'three',
      'three-stdlib', 
      'three-mesh-bvh'
    ]
  }
})
