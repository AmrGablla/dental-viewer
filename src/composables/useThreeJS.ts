import { ref } from 'vue'

/**
 * Composable for lazy loading Three.js and related heavy dependencies
 * This helps reduce initial bundle size by loading 3D libraries only when needed
 */
export function useThreeJS() {
  const isThreeLoaded = ref(false)
  const loadingError = ref<string | null>(null)

  // Lazy load Three.js and extensions
  const loadThreeJS = async () => {
    try {
      // Dynamic import for Three.js core
      const THREE = await import('three')
      
      // Dynamic import for Three.js mesh BVH
      const BVH = await import('three-mesh-bvh')
      
      // Add BVH extensions to THREE.js prototypes
      THREE.BufferGeometry.prototype.computeBoundsTree = BVH.computeBoundsTree
      THREE.BufferGeometry.prototype.disposeBoundsTree = BVH.disposeBoundsTree
      THREE.Mesh.prototype.raycast = BVH.acceleratedRaycast

      isThreeLoaded.value = true
      return { THREE, BVH }
    } catch (error) {
      loadingError.value = `Failed to load Three.js: ${error}`
      throw error
    }
  }

  // Lazy load services
  const loadServices = async () => {
    try {
      const [
        { STLLoaderService },
        { SegmentationService }
      ] = await Promise.all([
        import('../services/STLLoader'),
        import('../services/SegmentationService')
      ])

      return {
        STLLoaderService,
        SegmentationService
      }
    } catch (error) {
      loadingError.value = `Failed to load services: ${error}`
      throw error
    }
  }

  return {
    isThreeLoaded,
    loadingError,
    loadThreeJS,
    loadServices
  }
}
