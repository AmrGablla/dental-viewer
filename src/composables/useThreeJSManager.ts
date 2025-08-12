import { ref, onUnmounted } from 'vue';
import type { DentalModel } from '../types/dental';

export function useThreeJSManager() {
  // Three.js objects
  let scene: any;
  let camera: any;
  let renderer: any;
  let mouse: any;
  let resizeObserver: ResizeObserver | null = null;
  let animationId: number | null = null;
  let THREE: any = null;

  // Reactive state
  const isLoading = ref(false);
  const loadingMessage = ref("");

  function initThreeJS(container: HTMLDivElement, threeJS: any) {
    if (!container) return;
    
    THREE = threeJS; // Store THREE instance

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);

    // Get container dimensions
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    console.log("Container dimensions:", containerWidth, "x", containerHeight);

    // Camera
    camera = new THREE.PerspectiveCamera(
      75,
      containerWidth / containerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 50);

    // Ensure camera matrices are properly initialized
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerWidth, containerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Ensure canvas fills container
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    container.appendChild(renderer.domElement);

    // Enhanced Multi-Directional Lighting System
    setupEnhancedLighting();

    mouse = new THREE.Vector2();

    // Initialize movement tracking variables
    // Note: These are now handled in useCameraControls

    // Start render loop
    animate();

    return { scene, camera, renderer, mouse };
  }

  function setupEnhancedLighting() {
    if (!THREE) return;
    
    // Clear any existing lights
    const lightsToRemove = scene.children.filter((child: any) => 
      child instanceof THREE.Light || 
      child.type.includes('Light')
    );
    lightsToRemove.forEach((light: any) => scene.remove(light));

    // Enhanced ambient lighting for overall base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Main directional light (key light) - from top-front
    const mainDirectionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainDirectionalLight.position.set(40, 60, 40);
    mainDirectionalLight.castShadow = true;
    mainDirectionalLight.shadow.mapSize.width = 4096;
    mainDirectionalLight.shadow.mapSize.height = 4096;
    mainDirectionalLight.shadow.camera.near = 0.1;
    mainDirectionalLight.shadow.camera.far = 200;
    mainDirectionalLight.shadow.camera.left = -100;
    mainDirectionalLight.shadow.camera.right = 100;
    mainDirectionalLight.shadow.camera.top = 100;
    mainDirectionalLight.shadow.camera.bottom = -100;
    mainDirectionalLight.shadow.bias = -0.0001;
    scene.add(mainDirectionalLight);

    // Fill light - from opposite side to reduce harsh shadows
    const fillLight = new THREE.DirectionalLight(0xe6f3ff, 0.6);
    fillLight.position.set(-30, 20, -30);
    scene.add(fillLight);

    // Back light - subtle rim lighting effect
    const backLight = new THREE.DirectionalLight(0xfff5e6, 0.4);
    backLight.position.set(0, -20, -40);
    scene.add(backLight);

    // Multiple point lights for comprehensive coverage
    const pointLights = [
      { position: [50, 50, 50], color: 0xffffff, intensity: 0.8 },
      { position: [-50, 50, 50], color: 0xf0f8ff, intensity: 0.6 },
      { position: [50, -50, 50], color: 0xfff8f0, intensity: 0.6 },
      { position: [-50, -50, 50], color: 0xf8f0ff, intensity: 0.6 },
      { position: [0, 0, -50], color: 0xffffff, intensity: 0.5 },
      { position: [0, 80, 0], color: 0xffffff, intensity: 0.7 },
      { position: [0, -80, 0], color: 0xffffff, intensity: 0.5 }
    ];

    pointLights.forEach(({ position, color, intensity }) => {
      const pointLight = new THREE.PointLight(color, intensity, 200, 2);
      pointLight.position.set(position[0], position[1], position[2]);
      scene.add(pointLight);
    });

    // Hemisphere light for natural sky/ground lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x8b7355, 0.3);
    hemisphereLight.position.set(0, 100, 0);
    scene.add(hemisphereLight);

    // Enhanced renderer settings for better lighting
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    // Modern Three.js color space settings
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  function animate() {
    try {
      // Ensure camera and renderer exist
      if (!camera || !renderer || !scene) {
        console.warn("Missing Three.js objects, stopping animation");
        return;
      }

      // Ensure camera matrices are updated
      camera.updateMatrixWorld();

      renderer.render(scene, camera);

      // Continue animation loop
      animationId = requestAnimationFrame(animate);
    } catch (error) {
      console.error("Animation error:", error);
      // Try to restart animation after a short delay to prevent infinite error loops
      setTimeout(() => {
        console.log("Attempting to restart animation...");
        animationId = requestAnimationFrame(animate);
      }, 1000);
    }
  }

  function setupResizeObserver(container: HTMLDivElement) {
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === container) {
            onWindowResize();
          }
        }
      });
      resizeObserver.observe(container);
    }
  }

  function onWindowResize() {
    if (!camera || !renderer) return;

    const container = renderer.domElement.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    camera.aspect = containerWidth / containerHeight;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    renderer.setSize(containerWidth, containerHeight);

    // Ensure canvas still fills container after resize
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
  }

  function focusOnModel(dentalModel: DentalModel) {
    if (!dentalModel || !camera || !THREE) return;

    const box = dentalModel.boundingBox;
    const center = box.min.clone().add(box.max).multiplyScalar(0.5);
    const size = box.max.clone().sub(box.min);
    const maxDim = Math.max(size.x, size.y, size.z);

    camera.position.set(center.x, center.y, center.z + maxDim * 2);
    camera.lookAt(center);
    camera.updateMatrixWorld();
  }

  function setViewPreset(
    view: "top" | "bottom" | "front" | "back" | "left" | "right",
    dentalModel: DentalModel
  ) {
    if (!dentalModel || !camera || !THREE) return;

    const box = dentalModel.boundingBox;
    const center = box.min.clone().add(box.max).multiplyScalar(0.5);
    const size = box.max.clone().sub(box.min);
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 2; // Distance from center

    let position: any;

    switch (view) {
      case "top":
        position = new THREE.Vector3(center.x, center.y + distance, center.z);
        break;
      case "bottom":
        position = new THREE.Vector3(center.x, center.y - distance, center.z);
        break;
      case "front":
        position = new THREE.Vector3(center.x, center.y, center.z + distance);
        break;
      case "back":
        position = new THREE.Vector3(center.x, center.y, center.z - distance);
        break;
      case "left":
        position = new THREE.Vector3(center.x - distance, center.y, center.z);
        break;
      case "right":
        position = new THREE.Vector3(center.x + distance, center.y, center.z);
        break;
      default:
        return;
    }

    // Smooth transition to new position
    animateCameraToPosition(position, center);
  }

  function animateCameraToPosition(targetPosition: any, lookAtTarget: any) {
    if (!camera) return;

    const startPosition = camera.position.clone();
    const startTime = performance.now();
    const duration = 500; // Animation duration in ms

    function animate() {
      const currentTime = performance.now();
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Use easing function for smooth animation
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

      // Interpolate position
      camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
      camera.lookAt(lookAtTarget);
      camera.updateMatrixWorld();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    animate();
  }

  function updateMousePosition(event: MouseEvent) {
    if (!renderer) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    if (renderer) {
      renderer.dispose();
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  }

  onUnmounted(() => {
    cleanup();
  });

  return {
    // State
    isLoading,
    loadingMessage,
    
    // Methods
    initThreeJS,
    setupResizeObserver,
    focusOnModel,
    setViewPreset,
    updateMousePosition,
    cleanup,
    
    // Getters
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
    getMouse: () => mouse,
  };
}
