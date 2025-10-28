import type { ToothSegment, DentalModel } from "../types/dental";

// Lazy load Three.js to avoid blocking initial bundle
let THREE: any = null;
const loadThreeJS = async () => {
  if (!THREE) {
    THREE = await import("three");
  }
  return THREE;
};

export type BrushMode = "create" | "add" | "subtract" | "select";

export interface BrushSettings {
  radius: number;
  strength: number;
  hardness: number;
  mode: BrushMode;
  dentalAwareMode: boolean;
  respectBoundaries: boolean;
  adaptiveSampling: boolean;
}

export interface BrushStrokePoint {
  x: number;
  y: number;
  worldPosition?: any; // THREE.Vector3
  normal?: any; // THREE.Vector3
  timestamp: number;
}

export interface BrushOperation {
  mode: BrushMode;
  points: BrushStrokePoint[];
  settings: BrushSettings;
  selectedVertices: Set<number>;
  targetSegmentId?: string;
}

interface SpatialCell {
  vertices: number[];
  bounds: { min: any; max: any };
}

export class EnhancedBrushService {
  private canvas: HTMLCanvasElement | null = null;
  private camera: any = null;
  private scene: any = null;
  private raycaster: any = null;

  // Brush state
  private isActive = false;
  private currentOperation: BrushOperation | null = null;
  private brushCursor: HTMLDivElement | null = null;
  private currentSettings: BrushSettings;

  // Performance optimization
  private spatialHash: Map<string, SpatialCell> = new Map();
  private vertexNormals: Map<number, any> = new Map();
  private lastUpdateTime = 0;

  // Dental-aware features
  private curvatureMap: Map<number, number> = new Map();
  private boundaryEdges: Set<string> = new Set();

  constructor(
    canvas: HTMLCanvasElement,
    camera: any,
    _renderer: any,
    scene: any
  ) {
    this.canvas = canvas;
    this.camera = camera;
    this.scene = scene;

    // Default settings - optimized for performance
    this.currentSettings = {
      radius: 1.5, // Very small default brush size for precision
      strength: 1.0,
      hardness: 0.9, // Very hard for precise edges
      mode: "create",
      dentalAwareMode: false, // Disabled by default for better performance
      respectBoundaries: false,
      adaptiveSampling: true,
    };
  }

  /**
   * Initialize the brush service
   */
  async initialize(): Promise<void> {
    const ThreeJS = await loadThreeJS();
    this.raycaster = new ThreeJS.Raycaster();
    this.raycaster.params.Points.threshold = 0.1;
    this.raycaster.params.Line.threshold = 0.1;
    // Set raycaster to work with large distances
    this.raycaster.near = 0;
    this.raycaster.far = Infinity;
  }

  /**
   * Start a brush operation
   */
  async startBrush(
    mode: BrushMode,
    startPoint: { x: number; y: number },
    dentalModel: DentalModel,
    targetSegmentId?: string
  ): Promise<void> {
    if (!this.raycaster) {
      await this.initialize();
    }

    this.isActive = true;
    this.currentOperation = {
      mode,
      points: [],
      settings: { ...this.currentSettings, mode },
      selectedVertices: new Set<number>(),
      targetSegmentId,
    };

    // Pre-compute spatial data for performance
    await this.computeSpatialData(dentalModel);

    // Add the first point
    await this.addBrushPoint(startPoint, dentalModel);

    // Create visual cursor
    this.createBrushCursor();
    this.updateBrushCursor(startPoint);
  }

  /**
   * Update the brush stroke with a new point
   */
  async updateBrush(
    point: { x: number; y: number },
    dentalModel: DentalModel
  ): Promise<void> {
    if (!this.isActive || !this.currentOperation) return;

    // Throttle updates for better performance (30fps)
    const now = Date.now();
    if (now - this.lastUpdateTime < 33) {
      this.updateBrushCursor(point);
      return;
    }
    this.lastUpdateTime = now;

    // Add point and update selection
    await this.addBrushPoint(point, dentalModel);
    this.updateBrushCursor(point);
  }

  /**
   * Complete the brush operation
   */
  async finishBrush(
    dentalModel: DentalModel
  ): Promise<BrushOperationResult | null> {
    if (
      !this.isActive ||
      !this.currentOperation ||
      this.currentOperation.selectedVertices.size === 0
    ) {
      this.cleanup();
      return null;
    }

    const result = await this.processBrushOperation(dentalModel);
    this.cleanup();
    return result;
  }

  /**
   * Cancel the current brush operation
   */
  cancelBrush(): void {
    this.cleanup();
  }

  /**
   * Check if brush is currently active
   */
  isBrushActive(): boolean {
    return this.isActive;
  }

  /**
   * Update brush settings
   */
  updateSettings(settings: Partial<BrushSettings>): void {
    this.currentSettings = { ...this.currentSettings, ...settings };
  }

  /**
   * Get current settings
   */
  getSettings(): BrushSettings {
    return { ...this.currentSettings };
  }

  /**
   * Add a point to the brush stroke
   */
  private async addBrushPoint(
    screenPoint: { x: number; y: number },
    dentalModel: DentalModel
  ): Promise<void> {
    if (!this.currentOperation || !this.canvas) return;

    const ThreeJS = await loadThreeJS();

    // Get the actual canvas element's bounding rect
    const rect = this.canvas.getBoundingClientRect();

    // Convert screen coordinates to normalized device coordinates
    const mouse = new ThreeJS.Vector2(
      (screenPoint.x / rect.width) * 2 - 1,
      -(screenPoint.y / rect.height) * 2 + 1
    );

    // Update mesh matrices before raycasting
    dentalModel.originalMesh.updateMatrixWorld(true);

    // Raycast to find intersection with mesh
    this.raycaster.setFromCamera(mouse, this.camera);

    // Update all scene object matrices
    this.scene.updateMatrixWorld(true);

    // Try raycasting with the original mesh first
    let intersects = this.raycaster.intersectObject(
      dentalModel.originalMesh,
      false
    );

    // If original mesh didn't work, try all objects in the scene
    if (intersects.length === 0) {
      const allIntersects = this.raycaster.intersectObjects(
        this.scene.children,
        true
      );
      const meshIntersects = allIntersects.filter(
        (i: any) => i.object.type === "Mesh"
      );
      if (meshIntersects.length > 0) {
        intersects = [meshIntersects[0]];
      }
    }

    if (intersects.length === 0) {
      return;
    }

    const intersection = intersects[0];
    const worldPosition = intersection.point;
    const normal = intersection.face?.normal || new ThreeJS.Vector3(0, 1, 0);

    // Create brush point
    const brushPoint: BrushStrokePoint = {
      x: screenPoint.x,
      y: screenPoint.y,
      worldPosition: worldPosition.clone(),
      normal: normal.clone(),
      timestamp: Date.now(),
    };

    this.currentOperation.points.push(brushPoint);

    // Select vertices within brush radius
    await this.selectVerticesAtPoint(worldPosition, dentalModel);
  }

  /**
   * Select vertices within the brush radius at a given point
   */
  private async selectVerticesAtPoint(
    worldPosition: any,
    dentalModel: DentalModel
  ): Promise<void> {
    if (!this.currentOperation) return;

    const ThreeJS = await loadThreeJS();
    const mesh = dentalModel.originalMesh;
    const positions = mesh.geometry.attributes.position;
    const radius = this.currentSettings.radius;
    const mode = this.currentOperation.mode;

    // Use spatial hashing for performance
    const cellKey = this.getHashKey(worldPosition);
    const nearbyVertices = this.getSpatialNeighbors(cellKey);

    // If no spatial hash available or empty, fall back to checking nearby vertices only
    const verticesToCheck =
      nearbyVertices.length > 0
        ? nearbyVertices
        : Array.from({ length: Math.min(positions.count, 10000) }, (_, i) => i);

    const selectedInStroke: number[] = [];
    const vector = new ThreeJS.Vector3();

    // Optimized vertex checking loop
    for (let i = 0; i < verticesToCheck.length; i++) {
      const vertexIndex = verticesToCheck[i];
      vector.fromBufferAttribute(positions, vertexIndex);
      vector.applyMatrix4(mesh.matrixWorld);

      const distance = worldPosition.distanceTo(vector);

      if (distance <= radius) {
        // Apply hardness falloff
        const falloff = this.calculateFalloff(distance, radius);

        if (falloff >= 1 - this.currentSettings.strength) {
          // Dental-aware filtering (only if enabled)
          if (this.currentSettings.dentalAwareMode) {
            const isValid = await this.isDentalValid(
              vertexIndex,
              worldPosition,
              mesh
            );
            if (!isValid) {
              continue;
            }
          }

          selectedInStroke.push(vertexIndex);

          // Add or remove from selection based on mode
          if (mode === "subtract") {
            this.currentOperation.selectedVertices.delete(vertexIndex);
          } else {
            this.currentOperation.selectedVertices.add(vertexIndex);
          }
        }
      }
    }

    // If dental-aware mode, expand to connected regions
    if (this.currentSettings.dentalAwareMode && selectedInStroke.length > 0) {
      await this.expandToConnectedRegion(selectedInStroke, mesh);
    }
  }

  /**
   * Calculate falloff based on distance and hardness
   */
  private calculateFalloff(distance: number, radius: number): number {
    const normalizedDistance = distance / radius;
    const hardness = this.currentSettings.hardness;

    // Smooth falloff with hardness control
    if (normalizedDistance >= 1) return 0;

    const t = 1 - normalizedDistance;
    return Math.pow(t, 1 / (hardness + 0.1));
  }

  /**
   * Check if vertex selection is valid based on dental anatomy
   */
  private async isDentalValid(
    vertexIndex: number,
    brushCenter: any,
    mesh: any
  ): Promise<boolean> {
    const ThreeJS = await loadThreeJS();

    // Check boundary respect
    if (this.currentSettings.respectBoundaries) {
      const edgeKey = `${vertexIndex}`;
      if (this.boundaryEdges.has(edgeKey)) {
        // Allow boundary vertices but with reduced weight
        return true;
      }
    }

    // Check normal alignment (prevent selection across sharp edges)
    const positions = mesh.geometry.attributes.position;
    const vector = new ThreeJS.Vector3();
    vector.fromBufferAttribute(positions, vertexIndex);
    vector.applyMatrix4(mesh.matrixWorld);

    const normal = await this.getVertexNormal(vertexIndex, mesh);
    const toBrush = new ThreeJS.Vector3()
      .subVectors(brushCenter, vector)
      .normalize();
    const normalAlignment = normal.dot(toBrush);

    // Reject vertices facing away from brush (backface culling for teeth)
    if (normalAlignment < -0.3) return false;

    // Check curvature (teeth have characteristic curvature)
    const curvature = this.curvatureMap.get(vertexIndex) || 0;

    // Allow vertices with moderate curvature (typical for teeth)
    // Reject extremely high curvature (likely noise or artifacts)
    if (Math.abs(curvature) > 2.0) return false;

    return true;
  }

  /**
   * Expand selection to connected region (tooth-aware)
   */
  private async expandToConnectedRegion(
    seedVertices: number[],
    mesh: any
  ): Promise<void> {
    if (!this.currentOperation || seedVertices.length === 0) return;

    const ThreeJS = await loadThreeJS();
    const positions = mesh.geometry.attributes.position;
    const maxExpansionDistance = this.currentSettings.radius * 0.5;
    const curvatureThreshold = 0.8;

    const visited = new Set<number>(this.currentOperation.selectedVertices);
    const queue = [...seedVertices];

    while (queue.length > 0 && visited.size < 10000) {
      // Safety limit
      const current = queue.shift()!;

      // Get neighboring vertices
      const neighbors = this.getVertexNeighbors(current, mesh);

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;

        // Check if neighbor should be included based on dental features
        const currentCurvature = this.curvatureMap.get(current) || 0;
        const neighborCurvature = this.curvatureMap.get(neighbor) || 0;
        const curvatureDiff = Math.abs(currentCurvature - neighborCurvature);

        // If curvature difference is small, likely same tooth region
        if (curvatureDiff < curvatureThreshold) {
          const currentPos = new ThreeJS.Vector3();
          const neighborPos = new ThreeJS.Vector3();
          currentPos.fromBufferAttribute(positions, current);
          neighborPos.fromBufferAttribute(positions, neighbor);

          const distance = currentPos.distanceTo(neighborPos);

          if (distance < maxExpansionDistance) {
            visited.add(neighbor);
            this.currentOperation.selectedVertices.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }

  /**
   * Get vertex neighbors using face connectivity
   */
  private getVertexNeighbors(vertexIndex: number, mesh: any): number[] {
    const geometry = mesh.geometry;
    const index = geometry.index;
    const neighbors: Set<number> = new Set();

    if (!index) return [];

    // Find all faces containing this vertex
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);

      if (a === vertexIndex) {
        neighbors.add(b);
        neighbors.add(c);
      } else if (b === vertexIndex) {
        neighbors.add(a);
        neighbors.add(c);
      } else if (c === vertexIndex) {
        neighbors.add(a);
        neighbors.add(b);
      }
    }

    return Array.from(neighbors);
  }

  /**
   * Get vertex normal
   */
  private async getVertexNormal(vertexIndex: number, mesh: any): Promise<any> {
    if (this.vertexNormals.has(vertexIndex)) {
      return this.vertexNormals.get(vertexIndex);
    }

    const ThreeJS = await loadThreeJS();
    const normals = mesh.geometry.attributes.normal;
    const normal = new ThreeJS.Vector3();

    if (normals) {
      normal.fromBufferAttribute(normals, vertexIndex);
      normal.normalize();
    }

    this.vertexNormals.set(vertexIndex, normal);
    return normal;
  }

  /**
   * Compute spatial data for performance optimization
   */
  private async computeSpatialData(dentalModel: DentalModel): Promise<void> {
    const ThreeJS = await loadThreeJS();
    const mesh = dentalModel.originalMesh;
    const positions = mesh.geometry.attributes.position;

    // Ensure mesh is set up for raycasting
    if (!mesh.geometry.boundingBox) {
      mesh.geometry.computeBoundingBox();
    }
    if (!mesh.geometry.boundingSphere) {
      mesh.geometry.computeBoundingSphere();
    }

    // Clear previous data
    this.spatialHash.clear();
    this.vertexNormals.clear();
    this.curvatureMap.clear();
    this.boundaryEdges.clear();

    // Build spatial hash
    const cellSize = this.currentSettings.radius * 2;
    const vector = new ThreeJS.Vector3();

    for (let i = 0; i < positions.count; i++) {
      vector.fromBufferAttribute(positions, i);
      vector.applyMatrix4(mesh.matrixWorld);

      const cellKey = this.getHashKey(vector, cellSize);

      if (!this.spatialHash.has(cellKey)) {
        this.spatialHash.set(cellKey, {
          vertices: [],
          bounds: {
            min: vector.clone(),
            max: vector.clone(),
          },
        });
      }

      const cell = this.spatialHash.get(cellKey)!;
      cell.vertices.push(i);
      cell.bounds.min.min(vector);
      cell.bounds.max.max(vector);
    }

    // Only compute curvature and boundaries if dental-aware mode is enabled
    if (this.currentSettings.dentalAwareMode) {
      await this.computeCurvatureMap(mesh);
      this.detectBoundaryEdges(mesh);
    }
  }

  /**
   * Compute curvature map for dental-aware selection
   */
  private async computeCurvatureMap(mesh: any): Promise<void> {
    const ThreeJS = await loadThreeJS();
    const positions = mesh.geometry.attributes.position;
    const normals = mesh.geometry.attributes.normal;

    if (!normals) {
      mesh.geometry.computeVertexNormals();
    }

    const normal = new ThreeJS.Vector3();

    // Simplified curvature estimation using normal variation
    for (let i = 0; i < positions.count; i++) {
      const neighbors = this.getVertexNeighbors(i, mesh);

      if (neighbors.length === 0) {
        this.curvatureMap.set(i, 0);
        continue;
      }

      normal.fromBufferAttribute(normals, i);
      let curvature = 0;

      // Compare normal with neighbor normals
      for (const neighbor of neighbors) {
        const neighborNormal = new ThreeJS.Vector3();
        neighborNormal.fromBufferAttribute(normals, neighbor);

        const normalDiff = 1 - normal.dot(neighborNormal);
        curvature += normalDiff;
      }

      curvature /= neighbors.length;
      this.curvatureMap.set(i, curvature);
    }
  }

  /**
   * Detect boundary edges (tooth boundaries)
   */
  private detectBoundaryEdges(mesh: any): void {
    const geometry = mesh.geometry;
    const index = geometry.index;

    if (!index) return;

    const edgeCount = new Map<string, number>();

    // Count edge occurrences
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);

      const edges = [
        [Math.min(a, b), Math.max(a, b)],
        [Math.min(b, c), Math.max(b, c)],
        [Math.min(c, a), Math.max(c, a)],
      ];

      for (const [v1, v2] of edges) {
        const key = `${v1}-${v2}`;
        edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
      }
    }

    // Boundary edges appear only once
    for (const [key, count] of edgeCount.entries()) {
      if (count === 1) {
        const [v1, v2] = key.split("-");
        this.boundaryEdges.add(v1);
        this.boundaryEdges.add(v2);
      }
    }
  }

  /**
   * Get spatial hash key for a position
   */
  private getHashKey(position: any, cellSize?: number): string {
    const size = cellSize || this.currentSettings.radius * 2;
    const x = Math.floor(position.x / size);
    const y = Math.floor(position.y / size);
    const z = Math.floor(position.z / size);
    const key = `${x},${y},${z}`;
    return key;
  }

  /**
   * Get vertices in nearby spatial cells
   */
  private getSpatialNeighbors(cellKey: string): number[] {
    const [x, y, z] = cellKey.split(",").map(Number);
    const vertices: number[] = [];

    // Check current cell and 26 neighboring cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const key = `${x + dx},${y + dy},${z + dz}`;
          const cell = this.spatialHash.get(key);
          if (cell) {
            vertices.push(...cell.vertices);
          }
        }
      }
    }

    return vertices;
  }

  /**
   * Process the completed brush operation
   */
  private async processBrushOperation(
    dentalModel: DentalModel
  ): Promise<BrushOperationResult> {
    if (!this.currentOperation) {
      throw new Error("No active brush operation");
    }

    const selectedVertices = Array.from(this.currentOperation.selectedVertices);

    return {
      mode: this.currentOperation.mode,
      selectedVertices,
      targetSegmentId: this.currentOperation.targetSegmentId,
      affectedSegments: this.getAffectedSegments(dentalModel, selectedVertices),
      strokePoints: this.currentOperation.points.length,
    };
  }

  /**
   * Get segments affected by the brush operation
   */
  private getAffectedSegments(
    dentalModel: DentalModel,
    selectedVertices: number[]
  ): ToothSegment[] {
    if (!this.camera || !this.canvas || selectedVertices.length === 0)
      return [];

    const affectedSegments: ToothSegment[] = [];
    const selectedSet = new Set(selectedVertices);

    // For each segment, check if it has vertices in common with selection
    dentalModel.segments.forEach((segment) => {
      if (!segment.originalVertices || segment.originalVertices.length === 0)
        return;

      // Check if any of the segment's vertices are in the selection
      const hasOverlap = segment.originalVertices.some((_v, index) =>
        selectedSet.has(index)
      );

      if (hasOverlap) {
        affectedSegments.push(segment);
      }
    });

    return affectedSegments;
  }

  /**
   * Create visual brush cursor
   */
  private createBrushCursor(): void {
    if (!this.canvas) return;

    this.removeBrushCursor();

    const cursor = document.createElement("div");
    cursor.id = "enhanced-brush-cursor";
    cursor.style.position = "fixed"; // Changed from absolute to fixed
    cursor.style.pointerEvents = "none";
    cursor.style.zIndex = "1001";
    cursor.style.borderRadius = "50%";
    cursor.style.border = "2px solid";
    cursor.style.transition = "none"; // Remove transition for instant feedback
    cursor.style.willChange = "transform"; // Optimize for movement

    // Set color based on mode
    const modeColors = {
      create: "#51CACD",
      add: "#4AB8BB",
      subtract: "#ff4444",
      select: "#3FA4A7",
    };

    const color = modeColors[this.currentSettings.mode];
    cursor.style.borderColor = color;
    cursor.style.backgroundColor = `${color}20`;
    cursor.style.boxShadow = `0 0 10px ${color}40`;

    // Add inner dot
    const dot = document.createElement("div");
    dot.style.position = "absolute";
    dot.style.top = "50%";
    dot.style.left = "50%";
    dot.style.transform = "translate(-50%, -50%)";
    dot.style.width = "4px";
    dot.style.height = "4px";
    dot.style.borderRadius = "50%";
    dot.style.backgroundColor = color;
    cursor.appendChild(dot);

    this.brushCursor = cursor;
    document.body.appendChild(cursor); // Append to body instead of canvas parent
  }

  /**
   * Update brush cursor position and size
   */
  private updateBrushCursor(point: { x: number; y: number }): void {
    if (!this.brushCursor || !this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();

    // Calculate screen-space radius based on brush size
    // Use a better approximation based on camera distance
    const screenRadius = this.currentSettings.radius * 15; // Increased multiplier for visibility

    const size = screenRadius * 2;
    this.brushCursor.style.width = `${size}px`;
    this.brushCursor.style.height = `${size}px`;

    // Position cursor centered on mouse (using fixed positioning)
    const centerX = rect.left + point.x;
    const centerY = rect.top + point.y;

    this.brushCursor.style.left = `${centerX - screenRadius}px`;
    this.brushCursor.style.top = `${centerY - screenRadius}px`;
  }

  /**
   * Remove brush cursor
   */
  private removeBrushCursor(): void {
    if (this.brushCursor) {
      this.brushCursor.remove();
      this.brushCursor = null;
    }
  }

  /**
   * Clean up brush state
   */
  private cleanup(): void {
    this.isActive = false;
    this.currentOperation = null;
    this.removeBrushCursor();
    this.lastUpdateTime = 0;
  }

  /**
   * Get current mode
   */
  getCurrentMode(): BrushMode | null {
    return this.currentOperation?.mode || null;
  }

  /**
   * Show cursor (for hover state)
   */
  showCursor(point: { x: number; y: number }): void {
    if (!this.brushCursor) {
      this.createBrushCursor();
    }
    this.updateBrushCursor(point);
  }

  /**
   * Hide cursor
   */
  hideCursor(): void {
    this.removeBrushCursor();
  }
}

export interface BrushOperationResult {
  mode: BrushMode;
  selectedVertices: number[];
  targetSegmentId?: string;
  affectedSegments: ToothSegment[];
  strokePoints: number;
}
