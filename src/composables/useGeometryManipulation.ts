import { markRaw } from 'vue';
import type { ToothSegment, DentalModel } from '../types/dental';

export function useGeometryManipulation() {
  async function createSegmentFromVertices(
    vertexIndices: number[],
    originalMesh: any,
    dentalModel: DentalModel,
    THREE: any
  ): Promise<ToothSegment | null> {
    if (vertexIndices.length === 0) return null;

    console.log(`Creating segment from ${vertexIndices.length} vertices...`);

    const geometry = originalMesh.geometry;
    const positions = geometry.getAttribute("position");
    const indices = geometry.index;

    // Create a set of selected vertices for fast lookup
    const selectedVertices = new Set(vertexIndices);

    let selectedTriangles: number[] = [];

    if (indices) {
      // Indexed geometry
      console.log("Processing indexed geometry...");
      const indexArray = indices.array;

      for (let i = 0; i < indexArray.length; i += 3) {
        const v1 = indexArray[i];
        const v2 = indexArray[i + 1];
        const v3 = indexArray[i + 2];

        // Count how many vertices of this triangle are selected
        const selectedCount = [v1, v2, v3].filter((v) =>
          selectedVertices.has(v)
        ).length;

        // Include triangle if at least 2 vertices are selected
        if (selectedCount >= 2) {
          selectedTriangles.push(v1, v2, v3);
        }
      }
    } else {
      // Non-indexed geometry (common for STL files)
      console.log("Processing non-indexed geometry...");
      const vertexCount = positions.count;

      for (let i = 0; i < vertexCount; i += 3) {
        const v1 = i;
        const v2 = i + 1;
        const v3 = i + 2;

        // Count how many vertices of this triangle are selected
        const selectedCount = [v1, v2, v3].filter((v) =>
          selectedVertices.has(v)
        ).length;

        // Include triangle if at least 2 vertices are selected
        if (selectedCount >= 2) {
          selectedTriangles.push(v1, v2, v3);
        }
      }
    }

    if (selectedTriangles.length === 0) {
      console.warn("No triangles found for selected vertices");
      return null;
    }

    // Create new geometry with proper triangles
    const newPositions = new Float32Array(selectedTriangles.length * 3);
    const newVertices: any[] = [];

    for (let i = 0; i < selectedTriangles.length; i++) {
      const vertexIndex = selectedTriangles[i];
      const baseIndex = i * 3;

      const x = positions.getX(vertexIndex);
      const y = positions.getY(vertexIndex);
      const z = positions.getZ(vertexIndex);

      newPositions[baseIndex] = x;
      newPositions[baseIndex + 1] = y;
      newPositions[baseIndex + 2] = z;

      newVertices.push(new THREE.Vector3(x, y, z));
    }

    // Create proper geometry with triangles
    const segmentGeometry = new THREE.BufferGeometry();
    segmentGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(newPositions, 3)
    );
    segmentGeometry.computeVertexNormals();
    segmentGeometry.computeBoundingBox();

    const centroid = new THREE.Vector3();
    if (segmentGeometry.boundingBox) {
      segmentGeometry.boundingBox.getCenter(centroid);
    }

    // Create material with proper shading
    const hue = (dentalModel.segments.length || 0) * 0.3;
    const color = new THREE.Color().setHSL(hue, 0.7, 0.5);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      side: THREE.DoubleSide, // Ensure both sides are rendered
      roughness: 0.4,
      metalness: 0.05,
      transparent: true,
      opacity: 0.95
    });

    // Create mesh
    const segmentMesh = new THREE.Mesh(segmentGeometry, material);
    segmentMesh.castShadow = true;
    segmentMesh.receiveShadow = true;
    markRaw(segmentMesh);

    // Create segment
    const segment: ToothSegment = {
      id: `segment_${Date.now()}`,
      name: `Segment ${(dentalModel.segments.length || 0) + 1}`,
      mesh: segmentMesh,
      originalVertices: newVertices,
      centroid: centroid,
      color: color,
      toothType: "molar",
      isSelected: false,
      movementDistance: 0,
      originalPosition: segmentMesh.position.clone(),
      movementHistory: {
        totalDistance: 0,
        axisMovements: {
          anteroposterior: 0,
          vertical: 0,
          transverse: 0,
        },
        lastMovementType: undefined,
        movementCount: 0,
      },
    };

    console.log(
      `Created solid segment with ${selectedTriangles.length / 3} triangles`
    );
    return segment;
  }

  async function addVerticesToSegment(
    targetSegment: ToothSegment,
    selectedVertices: number[],
    originalMesh: any,
    THREE: any
  ) {
    if (!originalMesh || selectedVertices.length === 0) {
      console.warn("No original mesh or vertices to add");
      return;
    }

    try {
      // Get the original mesh geometry
      const originalGeometry = originalMesh.geometry;
      const originalPositions = originalGeometry.getAttribute("position");
      
      if (!originalPositions) {
        throw new Error("Original mesh has no position attribute");
      }

      console.log(`Processing vertex addition for segment ${targetSegment.name}`);
      console.log(`Original mesh vertices: ${originalPositions.count}`);
      console.log(`Selected vertices to add: ${selectedVertices.length}`);
      
      // Use a more efficient approach based on geometry type
      if (originalGeometry.index) {
        await addVerticesIndexedGeometry(targetSegment, selectedVertices, originalGeometry, originalPositions, THREE);
      } else {
        await addVerticesNonIndexedGeometry(targetSegment, selectedVertices, originalPositions, THREE);
      }

    } catch (error) {
      console.error("Error adding vertices to segment:", error);
      throw error;
    }
  }

  async function removeVerticesFromSegment(
    targetSegment: ToothSegment,
    selectedVertices: number[],
    originalMesh: any,
    THREE: any
  ) {
    if (!originalMesh || selectedVertices.length === 0) {
      console.warn("No original mesh or vertices to remove");
      return;
    }

    try {
      const originalGeometry = originalMesh.geometry;
      const originalPositions = originalGeometry.getAttribute("position");
      const segmentGeometry = targetSegment.mesh.geometry;
      
      console.log(`Processing vertex removal for segment ${targetSegment.name}`);
      console.log(`Selected vertices to remove: ${selectedVertices.length}`);
      
      let newGeometry: any = null;
      
      if (originalGeometry.index && segmentGeometry.index) {
        newGeometry = await createRemovedVerticesGeometry(targetSegment, selectedVertices, originalPositions, true, THREE);
      } else {
        newGeometry = await createRemovedVerticesGeometry(targetSegment, selectedVertices, originalPositions, false, THREE);
      }

      if (!newGeometry) {
        throw new Error("Could not create updated geometry");
      }

      // Update the segment mesh safely
      const scene = targetSegment.mesh.parent;
      if (scene) {
        scene.remove(targetSegment.mesh);
      }
      
      // Create new mesh with updated geometry
      const originalMaterial = targetSegment.mesh.material;
      const material = Array.isArray(originalMaterial) ? originalMaterial[0].clone() : originalMaterial.clone();
      const newMesh = new THREE.Mesh(newGeometry, material);
      newMesh.name = targetSegment.name;
      
      // Update segment
      targetSegment.mesh = newMesh;
      
      // Add new mesh to scene
      if (scene) {
        scene.add(newMesh);
      }
      
      console.log(`Successfully removed vertices from segment ${targetSegment.name}`);

    } catch (error) {
      console.error("Error removing vertices from segment:", error);
      throw error;
    }
  }

  // Helper functions for geometry manipulation
  async function addVerticesIndexedGeometry(
    targetSegment: ToothSegment, 
    selectedVertices: number[], 
    originalGeometry: any, 
    originalPositions: any,
    THREE: any
  ) {
    const segmentGeometry = targetSegment.mesh.geometry;
    let segmentIndices = segmentGeometry.index;
    
    if (!segmentIndices) {
      // Convert segment to indexed geometry first
      console.log("Converting segment to indexed geometry...");
      segmentGeometry.computeBoundingBox();
      segmentGeometry.computeVertexNormals();
      if (!segmentGeometry.index) {
        // Simple indexed conversion - create sequential indices
        const vertexCount = segmentGeometry.getAttribute('position').count;
        const indices = [];
        for (let i = 0; i < vertexCount; i++) {
          indices.push(i);
        }
        segmentGeometry.setIndex(indices);
      }
      segmentIndices = segmentGeometry.index!;
    }
    
    // Create efficient lookup sets
    const selectedVertexSet = new Set(selectedVertices);
    
    // Use simpler existing vertex set instead of complex triangle comparison
    const existingVerticesSet = new Set(Array.from(segmentIndices.array));
    
    // Find triangles from original mesh that contain selected vertices
    const originalIndexArray = originalGeometry.index.array;
    const newIndices = [];
    
    console.log("Finding relevant triangles...");
    console.log(`Selected vertices: ${selectedVertices.length}`);
    
    // Single pass: collect triangles with selected vertices that aren't fully in existing segment
    for (let i = 0; i < originalIndexArray.length; i += 3) {
      const v1 = originalIndexArray[i];
      const v2 = originalIndexArray[i + 1];
      const v3 = originalIndexArray[i + 2];
      
      // Check if triangle contains any selected vertices
      const hasSelectedVertex = selectedVertexSet.has(v1) || selectedVertexSet.has(v2) || selectedVertexSet.has(v3);
      
      // Check if triangle is already fully in the segment (all vertices exist)
      const isFullyInSegment = existingVerticesSet.has(v1) && existingVerticesSet.has(v2) && existingVerticesSet.has(v3);
      
      if (hasSelectedVertex && !isFullyInSegment) {
        newIndices.push(v1, v2, v3);
      }
    }
    
    if (newIndices.length === 0) {
      throw new Error("No new geometry found to add to segment");
    }
    
    console.log(`Found ${newIndices.length / 3} new triangles to add`);
    
    // Efficiently combine indices
    const combinedIndices = new Array(segmentIndices.array.length + newIndices.length);
    let index = 0;
    
    // Copy existing indices
    for (let i = 0; i < segmentIndices.array.length; i++) {
      combinedIndices[index++] = segmentIndices.array[i];
    }
    
    // Add new indices
    for (let i = 0; i < newIndices.length; i++) {
      combinedIndices[index++] = newIndices[i];
    }
    
    // Create optimized geometry
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', originalPositions.clone());
    newGeometry.setIndex(combinedIndices);
    
    // Compute normals efficiently
    newGeometry.computeVertexNormals();
    
    await updateSegmentMesh(targetSegment, newGeometry, combinedIndices, originalPositions, THREE);
    
    console.log(`Successfully added ${newIndices.length / 3} triangles to segment`);
  }

  async function addVerticesNonIndexedGeometry(
    targetSegment: ToothSegment,
    selectedVertices: number[],
    originalPositions: any,
    THREE: any
  ) {
    console.log("Processing non-indexed geometry addition...");
    
    const segmentGeometry = targetSegment.mesh.geometry;
    const segmentPositions = segmentGeometry.getAttribute("position");
    
    // Create efficient vertex lookup using spatial hashing for existing vertices
    const PRECISION = 6;
    const existingVertexKeys = new Set<string>();
    
    // Build set of existing vertex coordinates
    for (let i = 0; i < segmentPositions.count; i++) {
      const x = segmentPositions.getX(i).toFixed(PRECISION);
      const y = segmentPositions.getY(i).toFixed(PRECISION);
      const z = segmentPositions.getZ(i).toFixed(PRECISION);
      existingVertexKeys.add(`${x},${y},${z}`);
    }
    
    // Collect new triangles more efficiently
    const newVertices = [];
    const selectedVertexSet = new Set(selectedVertices);
    const vertexCount = originalPositions.count;
    
    console.log(`Selected vertices: ${selectedVertices.length}`);
    
    // Single pass: process triangles and collect new ones
    for (let i = 0; i < vertexCount; i += 3) {
      if (i + 2 >= vertexCount) break;
      
      // Check if triangle contains selected vertices
      const hasSelectedVertex = selectedVertexSet.has(i) || 
                               selectedVertexSet.has(i + 1) || 
                               selectedVertexSet.has(i + 2);
      
      if (hasSelectedVertex) {
        const vertices = [
          {
            x: originalPositions.getX(i),
            y: originalPositions.getY(i),
            z: originalPositions.getZ(i)
          },
          {
            x: originalPositions.getX(i + 1),
            y: originalPositions.getY(i + 1),
            z: originalPositions.getZ(i + 1)
          },
          {
            x: originalPositions.getX(i + 2),
            y: originalPositions.getY(i + 2),
            z: originalPositions.getZ(i + 2)
          }
        ];
        
        // Check if triangle has any new vertices (simpler check than full triangle comparison)
        const hasNewVertex = vertices.some(v => {
          const key = `${v.x.toFixed(PRECISION)},${v.y.toFixed(PRECISION)},${v.z.toFixed(PRECISION)}`;
          return !existingVertexKeys.has(key);
        });
        
        if (hasNewVertex) {
          newVertices.push(...vertices.flatMap(v => [v.x, v.y, v.z]));
        }
      }
    }
    
    if (newVertices.length === 0) {
      throw new Error("No new vertices found to add to segment");
    }
    
    console.log(`Found ${newVertices.length / 9} new triangles to add`);
    
    // Efficiently combine vertex arrays
    const existingVertices = Array.from(segmentPositions.array);
    const combinedVertices = new Float32Array(existingVertices.length + newVertices.length);
    
    combinedVertices.set(existingVertices, 0);
    combinedVertices.set(newVertices, existingVertices.length);
    
    // Create optimized geometry
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.BufferAttribute(combinedVertices, 3));
    newGeometry.computeVertexNormals();
    
    await updateSegmentMeshNonIndexed(targetSegment, newGeometry, THREE);
    
    console.log(`Successfully added ${newVertices.length / 9} triangles to segment`);
  }

  async function createRemovedVerticesGeometry(
    targetSegment: ToothSegment, 
    selectedVertices: number[], 
    originalPositions: any,
    isIndexed: boolean,
    THREE: any
  ): Promise<any> {
    const segmentGeometry = targetSegment.mesh.geometry;
    
    if (isIndexed) {
      const segmentIndices = segmentGeometry.index;
      
      if (!segmentIndices) {
        throw new Error("Segment must have indexed geometry for indexed removal");
      }
      
      const selectedVertexSet = new Set(selectedVertices);
      const segmentIndexArray = segmentIndices.array;
      const remainingIndices = [];
      
      // Keep triangles that don't contain any selected vertices
      for (let i = 0; i < segmentIndexArray.length; i += 3) {
        if (i + 2 >= segmentIndexArray.length) break;
        
        const v1 = segmentIndexArray[i];
        const v2 = segmentIndexArray[i + 1];
        const v3 = segmentIndexArray[i + 2];
        
        // Keep triangle only if none of its vertices are selected for removal
        const shouldKeep = !selectedVertexSet.has(v1) && 
                          !selectedVertexSet.has(v2) && 
                          !selectedVertexSet.has(v3);
        
        if (shouldKeep) {
          remainingIndices.push(v1, v2, v3);
        }
      }
      
      if (remainingIndices.length === 0) {
        console.warn("All triangles would be removed - keeping at least one triangle");
        // Keep the first triangle to avoid empty geometry
        remainingIndices.push(segmentIndexArray[0], segmentIndexArray[1], segmentIndexArray[2]);
      }
      
      // Create geometry with remaining triangles
      const newGeometry = new THREE.BufferGeometry();
      newGeometry.setAttribute('position', originalPositions.clone());
      newGeometry.setIndex(remainingIndices);
      newGeometry.computeVertexNormals();
      
      return newGeometry;
      
    } else {
      // Non-indexed geometry
      const segmentPositions = segmentGeometry.getAttribute("position");
      
      // Create spatial hash for quick vertex lookup
      const PRECISION = 6;
      const selectedVertexCoords = new Set<string>();
      
      // Build hash of selected vertex coordinates
      for (const vertexIndex of selectedVertices) {
        if (vertexIndex < originalPositions.count) {
          const x = originalPositions.getX(vertexIndex).toFixed(PRECISION);
          const y = originalPositions.getY(vertexIndex).toFixed(PRECISION);
          const z = originalPositions.getZ(vertexIndex).toFixed(PRECISION);
          selectedVertexCoords.add(`${x},${y},${z}`);
        }
      }
      
      const remainingVertices = [];
      const vertexCount = segmentPositions.count;
      
      // Process triangles and keep those without selected vertices
      for (let i = 0; i < vertexCount; i += 3) {
        if (i + 2 >= vertexCount) break;
        
        // Get triangle vertices
        const vertices = [
          {
            x: segmentPositions.getX(i),
            y: segmentPositions.getY(i),
            z: segmentPositions.getZ(i)
          },
          {
            x: segmentPositions.getX(i + 1),
            y: segmentPositions.getY(i + 1),
            z: segmentPositions.getZ(i + 1)
          },
          {
            x: segmentPositions.getX(i + 2),
            y: segmentPositions.getY(i + 2),
            z: segmentPositions.getZ(i + 2)
          }
        ];
        
        // Check if any vertex should be removed
        const shouldRemove = vertices.some(v => {
          const key = `${v.x.toFixed(PRECISION)},${v.y.toFixed(PRECISION)},${v.z.toFixed(PRECISION)}`;
          return selectedVertexCoords.has(key);
        });
        
        // Keep triangle if none of its vertices should be removed
        if (!shouldRemove) {
          remainingVertices.push(...vertices.flatMap(v => [v.x, v.y, v.z]));
        }
      }
      
      if (remainingVertices.length === 0) {
        console.warn("All triangles would be removed - keeping original segment");
        throw new Error("Cannot remove all vertices from segment");
      }
      
      // Create geometry with remaining vertices
      const newGeometry = new THREE.BufferGeometry();
      newGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(remainingVertices), 3));
      newGeometry.computeVertexNormals();
      
      return newGeometry;
    }
  }

  // Helper function to update segment mesh with indexed geometry
  async function updateSegmentMesh(targetSegment: ToothSegment, newGeometry: any, combinedIndices: number[], originalPositions: any, THREE: any) {
    // Remove old mesh from scene
    const scene = targetSegment.mesh.parent;
    if (scene) {
      scene.remove(targetSegment.mesh);
    }
    targetSegment.mesh.geometry.dispose();

    // Create new mesh with the combined geometry
    const newMesh = new THREE.Mesh(newGeometry, targetSegment.mesh.material);
    newMesh.name = targetSegment.name;
    newMesh.castShadow = true;
    newMesh.receiveShadow = true;

    // Update segment properties
    targetSegment.mesh = newMesh;
    
    // Update originalVertices to include all vertices referenced by the new indices
    const allVertexIndices = new Set(combinedIndices);
    targetSegment.originalVertices = Array.from(allVertexIndices).map(index => {
      return new THREE.Vector3(
        originalPositions.getX(index),
        originalPositions.getY(index), 
        originalPositions.getZ(index)
      );
    });

    // Recalculate centroid
    targetSegment.centroid = calculateCentroid(targetSegment.originalVertices, THREE);

    // Add new mesh to scene
    if (scene) {
      scene.add(newMesh);
    }
  }

  // Helper function to update segment mesh with non-indexed geometry
  async function updateSegmentMeshNonIndexed(targetSegment: ToothSegment, newGeometry: any, THREE: any) {
    // Remove old mesh from scene
    const scene = targetSegment.mesh.parent;
    if (scene) {
      scene.remove(targetSegment.mesh);
    }
    targetSegment.mesh.geometry.dispose();

    // Create new mesh with the combined geometry
    const newMesh = new THREE.Mesh(newGeometry, targetSegment.mesh.material);
    newMesh.name = targetSegment.name;
    newMesh.castShadow = true;
    newMesh.receiveShadow = true;

    // Update segment properties
    targetSegment.mesh = newMesh;
    
    // Update originalVertices from the new geometry
    const positions = newGeometry.getAttribute('position');
    const vertices = [];
    for (let i = 0; i < positions.count; i++) {
      vertices.push(new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      ));
    }
    targetSegment.originalVertices = vertices;

    // Recalculate centroid
    targetSegment.centroid = calculateCentroid(targetSegment.originalVertices, THREE);

    // Add new mesh to scene
    if (scene) {
      scene.add(newMesh);
    }
  }

  // Utility function to calculate centroid of vertices
  function calculateCentroid(vertices: any[], THREE: any): any {
    if (vertices.length === 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    const centroid = new THREE.Vector3(0, 0, 0);
    
    vertices.forEach(vertex => {
      centroid.add(vertex);
    });
    
    centroid.divideScalar(vertices.length);
    return centroid;
  }

  return {
    createSegmentFromVertices,
    addVerticesToSegment,
    removeVerticesFromSegment,
  };
}
