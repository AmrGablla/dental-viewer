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
        manualChunks: {
          // Three.js and related 3D libraries
          'three-vendor': ['three', 'three-stdlib', 'three-mesh-bvh'],
          
          // Vue.js framework
          'vue-vendor': ['vue']
        }
      }
    },
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Use esbuild for faster minification
    minify: 'esbuild'
  },
  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'three',
      'three-stdlib', 
      'three-mesh-bvh',
      'vue'
    ]
  }
})
