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

    // Add touch events for better trackpad support
    canvas.addEventListener("touchstart", (event) => onTouchStart(event, camera, renderer, currentMode));
    canvas.addEventListener("touchmove", (event) => onTouchMove(event, camera, renderer, currentMode));
    canvas.addEventListener("touchend", (event) => onTouchEnd(event, camera, renderer, currentMode));

    // Add keyboard listeners for modifier keys
    window.addEventListener("keydown", (event) => onKeyDown(event, renderer));
    window.addEventListener("keyup", (event) => onKeyUp(event, renderer, currentMode));
    window.addEventListener("resize", () => onWindowResize(camera, renderer));
  }

  function onMouseDown(event: MouseEvent, _camera: any, renderer: any, currentMode: any) {
    
    // Check if modifier keys are pressed for rotation (should override lasso mode)
    const isRotationRequested = event.metaKey || event.ctrlKey;
    
    // Handle lasso mode first, but only if not rotating
    if (currentMode.value === "lasso" && lassoHandlers?.handleLassoMouseDown && !isRotationRequested) {
      lassoHandlers.handleLassoMouseDown(event);
      return;
    }

    isDragging = true;
    updateMousePosition(event, renderer);

    // Store initial mouse position for rotation and movement
    lastMousePosition.set(event.clientX, event.clientY);
    
    if (isRotationRequested) {
      isPanning = true; // Keep variable name for compatibility but use for rotation
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
    
    // Check if modifier keys are pressed for rotation (should override lasso mode)
    const isRotationRequested = event.metaKey || event.ctrlKey;
    
    // Handle lasso mode first, but only if not rotating
    if (currentMode.value === "lasso" && lassoHandlers?.handleLassoMouseMove && !isRotationRequested) {
      lassoHandlers.handleLassoMouseMove(event);
      return;
    }

    updateMousePosition(event, renderer);

    if (isDragging) {
      
      if (isRotationRequested || isPanning) {
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

  function onTouchStart(event: TouchEvent, camera: any, renderer: any, currentMode: any) {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        metaKey: event.ctrlKey || event.metaKey,
        ctrlKey: event.ctrlKey || event.metaKey
      });
      onMouseDown(mouseEvent, camera, renderer, currentMode);
    }
  }

  function onTouchMove(event: TouchEvent, camera: any, renderer: any, currentMode: any) {
    event.preventDefault();
    
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        metaKey: event.ctrlKey || event.metaKey,
        ctrlKey: event.ctrlKey || event.metaKey
      });
      onMouseMove(mouseEvent, camera, renderer, currentMode);
    }
  }

  function onTouchEnd(event: TouchEvent, camera: any, renderer: any, currentMode: any) {
    event.preventDefault();
    
    const mouseEvent = new MouseEvent('mouseup', {
      clientX: 0,
      clientY: 0
    });
    onMouseUp(mouseEvent, camera, renderer, currentMode);
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
    if (event.metaKey || event.ctrlKey) {
      if (renderer?.domElement && !isDragging) {
        renderer.domElement.style.cursor = "grab";
      }
    }
  }

  function onKeyUp(event: KeyboardEvent, renderer: any, currentMode: any) {
    // Reset cursor when modifier keys are released
    if (!event.metaKey && !event.ctrlKey) {
      if (renderer?.domElement && !isDragging) {
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
    
    // Calculate mouse movement delta
    const currentMousePosition = new THREE.Vector2(event.clientX, event.clientY);
    const deltaX = currentMousePosition.x - lastMousePosition.x;
    const deltaY = currentMousePosition.y - lastMousePosition.y;

    // Update last mouse position
    lastMousePosition.copy(currentMousePosition);

    // Convert mouse movement to rotation angles
    const rotationSpeed = 0.005;
    const deltaTheta = -deltaX * rotationSpeed;
    const deltaPhi = deltaY * rotationSpeed;

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
