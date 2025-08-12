// Remove unused import

export function useCameraControls() {
  // Interaction state
  let isDragging = false;
  let isPanning = false;
  let lastMousePosition: any;
  let directionalMoveInterval: number | null = null;
  let isDirectionalMoving = false;
  let THREE: any = null;
  let lassoHandlers: any = null;

  function setupEventListeners(canvas: HTMLCanvasElement, camera: any, renderer: any, currentMode: any, threeJS: any, handlers?: any) {
    THREE = threeJS; // Store THREE instance
    lastMousePosition = new THREE.Vector2(); // Initialize lastMousePosition
    lassoHandlers = handlers; // Store lasso handlers
    
    canvas.addEventListener("mousedown", (event) => onMouseDown(event, camera, renderer, currentMode));
    canvas.addEventListener("mousemove", (event) => onMouseMove(event, camera, renderer, currentMode));
    canvas.addEventListener("mouseup", (event) => onMouseUp(event, camera, renderer, currentMode));
    canvas.addEventListener("click", (event) => onClick(event, camera, renderer, currentMode));
    canvas.addEventListener("wheel", (event) => onWheel(event, camera));

    // Add keyboard listeners for modifier keys
    window.addEventListener("keydown", (event) => onKeyDown(event, renderer));
    window.addEventListener("keyup", (event) => onKeyUp(event, renderer, currentMode));
    window.addEventListener("resize", () => onWindowResize(camera, renderer));
  }

  function onMouseDown(event: MouseEvent, _camera: any, renderer: any, currentMode: any) {
    // Handle lasso mode first
    if (currentMode.value === "lasso" && lassoHandlers?.handleLassoMouseDown) {
      lassoHandlers.handleLassoMouseDown(event);
      return;
    }

    isDragging = true;
    updateMousePosition(event, renderer);

    // Store initial mouse position for rotation and movement
    lastMousePosition.set(event.clientX, event.clientY);

    // Check if Cmd (Mac) or Ctrl (Windows/Linux) is held for rotation
    const isRotationRequested = event.metaKey || event.ctrlKey;
    console.log("MouseDown - isDragging:", isDragging, "isRotationRequested:", isRotationRequested, "metaKey:", event.metaKey, "ctrlKey:", event.ctrlKey);

    if (isRotationRequested) {
      isPanning = true; // Keep variable name for compatibility but use for rotation
      console.log("Setting isPanning to true for rotation");
      // Change cursor to indicate rotation mode
      if (renderer?.domElement) {
        renderer.domElement.style.cursor = "grabbing";
      }
    } else if (currentMode.value === "pan") {
      // Pan mode - change cursor to indicate panning
      if (renderer?.domElement) {
        renderer.domElement.style.cursor = "grabbing";
      }
    }
  }

  function onMouseMove(event: MouseEvent, camera: any, renderer: any, currentMode: any) {
    // Handle lasso mode first
    if (currentMode.value === "lasso" && lassoHandlers?.handleLassoMouseMove) {
      lassoHandlers.handleLassoMouseMove(event);
      return;
    }

    updateMousePosition(event, renderer);

    if (isDragging) {
      // Check for rotation modifier key (Cmd/Ctrl) during mouse move
      const isRotationRequested = event.metaKey || event.ctrlKey;
      console.log("MouseMove - isDragging:", isDragging, "isRotationRequested:", isRotationRequested, "isPanning:", isPanning, "metaKey:", event.metaKey, "ctrlKey:", event.ctrlKey);
      
      if (isRotationRequested || isPanning) {
        console.log("Calling rotateWithModifier");
        // Rotate the camera/model with modifier key
        rotateWithModifier(event, camera);
      } else if (currentMode.value === "pan") {
        // Implement pan logic for camera movement
        panCamera(event, camera);
      }
    }

    // Update cursor based on modifier keys (even when not dragging)
    if (renderer?.domElement) {
      if (event.metaKey || event.ctrlKey) {
        renderer.domElement.style.cursor = "grab";
      } else {
        // Reset cursor based on current mode
        const cursorMap: Record<string, string> = {
          lasso: "crosshair",
          pan: "grab",
        };
        renderer.domElement.style.cursor =
          cursorMap[currentMode.value] || "default";
      }
    }
  }

  function onMouseUp(event: MouseEvent, _camera: any, renderer: any, currentMode: any) {
    // Handle lasso mode first
    if (currentMode.value === "lasso" && lassoHandlers?.handleLassoMouseUp) {
      lassoHandlers.handleLassoMouseUp(event);
      return;
    }

    // Reset rotation state and cursor
    if (isPanning) {
      isPanning = false;
      if (renderer?.domElement) {
        renderer.domElement.style.cursor = "grab"; // Keep grab cursor if modifier still held
      }
    } else if (currentMode.value === "pan" && renderer?.domElement) {
      // Reset pan cursor back to grab
      renderer.domElement.style.cursor = "grab";
    }

    isDragging = false;
  }

  function onClick(event: MouseEvent, _camera: any, renderer: any, _currentMode: any) {
    updateMousePosition(event, renderer);
    // Click handling is managed by other services
  }

  function onWheel(event: WheelEvent, camera: any) {
    event.preventDefault(); // Prevent page scroll

    // Detect touchpad vs mouse wheel for different sensitivities
    const isTouchpad = Math.abs(event.deltaY) < 100 && event.deltaY % 1 !== 0;

    // Increased sensitivity for better accuracy and control
    const zoomSensitivity = isTouchpad ? 0.015 : 0.05;

    // REVERSED: Positive deltaY now zooms IN (closer), negative zooms OUT (farther)
    let zoomDelta = event.deltaY * zoomSensitivity;

    // Increased range for better accuracy
    zoomDelta = Math.max(-0.2, Math.min(0.2, zoomDelta));

    const zoomFactor = 1 + zoomDelta;

    // Get current distance from origin
    const currentDistance = camera.position.length();

    // Apply zoom with limits to prevent getting too close or too far
    const minDistance = 2; // Closer minimum for better detail inspection
    const maxDistance = 800; // Farther maximum for overview
    const newDistance = currentDistance * zoomFactor;

    // Only zoom if within reasonable bounds
    if (newDistance >= minDistance && newDistance <= maxDistance) {
      // More responsive interpolation for better accuracy
      const targetPosition = camera.position.clone().multiplyScalar(zoomFactor);

      // Increased lerp factor for more immediate response
      camera.position.lerp(targetPosition, 0.9);
      camera.updateMatrixWorld();
    }
  }

  function onWindowResize(camera: any, renderer: any) {
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

  function onKeyDown(event: KeyboardEvent, renderer: any) {
    // Update cursor when modifier keys are pressed
    if ((event.metaKey || event.ctrlKey) && renderer?.domElement && !isDragging) {
      renderer.domElement.style.cursor = "grab";
    }
  }

  function onKeyUp(event: KeyboardEvent, renderer: any, currentMode: any) {
    // Reset cursor when modifier keys are released
    if (!event.metaKey && !event.ctrlKey && renderer?.domElement && !isDragging) {
      // Reset cursor based on current mode
      const cursorMap: Record<string, string> = {
        lasso: "crosshair",
        pan: "grab",
      };
      renderer.domElement.style.cursor =
        cursorMap[currentMode.value] || "default";
    }
  }

  function updateMousePosition(event: MouseEvent, renderer: any) {
    if (!renderer) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
    return mouse;
  }

  function panCamera(event: MouseEvent, camera: any) {
    if (!THREE) return;
    
    // Pan camera by moving its position and target
    const deltaX = event.movementX * 0.01;
    const deltaY = event.movementY * 0.01;

    // Get camera's right and up vectors
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    const cameraRight = new THREE.Vector3();
    cameraRight.crossVectors(camera.up, cameraDirection).normalize();
    
    const cameraUp = new THREE.Vector3();
    cameraUp.copy(camera.up).normalize();

    // Calculate pan movement in world space
    const panMovement = new THREE.Vector3();
    panMovement.addScaledVector(cameraRight, deltaX);
    panMovement.addScaledVector(cameraUp, deltaY);

    // Apply movement to camera position
    camera.position.add(panMovement);
    
    // Update camera matrix
    camera.updateMatrixWorld();
  }

  function rotateWithModifier(event: MouseEvent, camera: any) {
    if (!THREE || !lastMousePosition) {
      console.log("rotateWithModifier - THREE or lastMousePosition not available");
      return;
    }
    
    // Calculate mouse movement delta using movementX and movementY for better accuracy
    const deltaX = event.movementX || 0;
    const deltaY = event.movementY || 0;

    console.log("rotateWithModifier - deltaX:", deltaX, "deltaY:", deltaY);

    // Only rotate if there's actual movement
    if (Math.abs(deltaX) < 0.1 && Math.abs(deltaY) < 0.1) {
      console.log("rotateWithModifier - movement too small, skipping");
      return;
    }

    // Convert mouse movement to rotation angles
    const rotationSpeed = 0.01; // Increased for more responsive rotation
    const deltaTheta = -deltaX * rotationSpeed;
    const deltaPhi = deltaY * rotationSpeed;

    console.log("rotateWithModifier - deltaTheta:", deltaTheta, "deltaPhi:", deltaPhi);

    // Use spherical coordinates for smooth orbital rotation
    const spherical = new THREE.Spherical();
    spherical.setFromVector3(camera.position);

    // Apply rotation deltas
    spherical.theta += deltaTheta;
    spherical.phi += deltaPhi;

    // Clamp phi to prevent flipping
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

    // Update camera position
    camera.position.setFromSpherical(spherical);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    console.log("rotateWithModifier - camera position updated:", camera.position);
  }

  function cleanup() {
    // Stop any ongoing directional movement
    if (directionalMoveInterval) {
      clearInterval(directionalMoveInterval);
      directionalMoveInterval = null;
    }

    // Remove keyboard event listeners - use proper function signatures
    window.removeEventListener("keydown", (event: KeyboardEvent) => onKeyDown(event, null));
    window.removeEventListener("keyup", (event: KeyboardEvent) => onKeyUp(event, null, null));
    window.removeEventListener("resize", () => onWindowResize(null, null));
  }

  return {
    // State
    isDragging: () => isDragging,
    isPanning: () => isPanning,
    isDirectionalMoving: () => isDirectionalMoving,
    
    // Methods
    setupEventListeners,
    updateMousePosition,
    cleanup,
  };
}
