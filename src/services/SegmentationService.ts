import { markRaw } from 'vue';
import type { 
  SegmentationResult, 
  SegmentData, 
  ToothSegment, 
  ToothType,
  DentalModel 
} from '../types/dental';

export class SegmentationService {
  private backendService: any;
  private scene: any;
  private THREE: any;

  constructor(backendService: any, scene: any, THREE?: any) {
    this.backendService = backendService;
    this.scene = scene;
    this.THREE = THREE;
  }

  async startBackgroundAISegmentation(
    file: File,
    dentalModel: DentalModel,
    onStatusUpdate?: (status: { isRunning: boolean; message: string; progress?: number }) => void,
    onComplete?: (result: SegmentationResult) => void,
    onError?: (error: Error) => void,
    onSegmentsCreated?: (updatedDentalModel: DentalModel) => void
  ): Promise<void> {
    try {
      // Update background status
      onStatusUpdate?.({
        isRunning: true,
        message: "AI analyzing dental structure...",
        progress: 0,
      });

      console.log("🤖 Starting background AI segmentation...");

      // Check if backend is available
      const isHealthy = await this.backendService.checkHealth();
      if (!isHealthy) {
        throw new Error("Backend service unavailable");
      }

      onStatusUpdate?.({
        isRunning: true,
        message: "Uploading to AI service...",
        progress: 25,
      });

      // Perform AI segmentation
      const result = await this.backendService.segmentSTLFile(file);

      onStatusUpdate?.({
        isRunning: true,
        message: "Processing segmentation results...",
        progress: 75,
      });

      // Wait a bit for the 3D model to be fully loaded and rendered
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Clear existing manual segments (keep original mesh visible)
      if (dentalModel.segments.length > 0) {
        console.log("🧹 Clearing manual segments for AI results...");
        this.clearExistingSegments(dentalModel);
      }

      // Create AI-segmented tooth segments
      console.log("🔍 Backend result structure:", result);
      console.log("🔍 session_id:", result.session_id);
      console.log("🔍 sessionId:", result.sessionId);
      
      // Convert snake_case to camelCase for frontend compatibility
      const frontendResult = {
        ...result,
        sessionId: result.session_id || result.sessionId,
        segmentsCount: result.segments_count || result.segmentsCount
      };
      console.log("🔍 Frontend result with sessionId:", frontendResult.sessionId);
      
      // Map backend segment data to frontend format with unique colors
      const colors = [
        '#FF6B6B', // Red
        '#4ECDC4', // Teal
        '#45B7D1', // Blue
        '#96CEB4', // Green
        '#FFEAA7', // Yellow
        '#DDA0DD', // Plum
        '#98D8C8', // Mint
        '#F7DC6F', // Gold
        '#BB8FCE', // Purple
        '#85C1E9', // Light Blue
        '#F8C471', // Orange
        '#82E0AA'  // Light Green
      ];
      
      const mappedSegments = result.segments.map((segment: any, index: number) => {
        const color = colors[index % colors.length];
        console.log(`🎨 Assigning color ${color} to segment ${segment.tooth_type === 'gum' ? 'Gum' : `Tooth ${segment.tooth_number}`}`);
        
        return {
          id: segment.id,
          name: segment.tooth_type === 'gum' ? 'Gum' : `Tooth ${segment.tooth_number}`,
          filename: segment.filename,
          pointCount: segment.vertex_count || 0,
          center: segment.center || [0, 0, 0],
          volume: segment.volume || 0,
          boundingBox: segment.bounding_box,
          downloadUrl: segment.download_url || `/download/${frontendResult.sessionId}/${segment.filename}`,
          visible: true,
          selected: false,
          color: color, // Assign unique color based on index
          toothType: segment.tooth_type || 'molar'
        };
      });
      
      const finalResult = {
        ...frontendResult,
        segments: mappedSegments
      };
      
      console.log("🔍 Mapped segments:", mappedSegments);
      const updatedDentalModel = await this.createAISegments(finalResult, dentalModel);
      
      // Notify the caller about the updated dental model to trigger reactivity
      if (updatedDentalModel && onSegmentsCreated) {
        onSegmentsCreated(updatedDentalModel);
        console.log("🔄 Notified caller about updated dental model");
      }

      onStatusUpdate?.({
        isRunning: true,
        message: "AI segmentation completed!",
        progress: 100,
      });

      console.log(`✅ Background AI Segmentation completed: ${result.segments.length} teeth found`);
      
      onComplete?.(result);

    } catch (error) {
      console.error("Background AI Segmentation failed:", error);
      onError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  private clearExistingSegments(dentalModel: DentalModel) {
    // Remove all existing segments from scene
    dentalModel.segments.forEach((segment) => {
      this.scene.remove(segment.mesh);
    });
    
    // Clear segments array
    dentalModel.segments = [];
    dentalModel = { ...dentalModel };
    
    console.log("Cleared existing manual segments for AI segmentation");
  }

  async createAISegments(result: SegmentationResult, dentalModel: DentalModel): Promise<DentalModel> {
    try {
      console.log("🎨 Creating 3D tooth segments from backend result:", result);
      console.log("📊 Number of segments to create:", result.segments.length);

      for (let i = 0; i < result.segments.length; i++) {
        const segmentData = result.segments[i];
        console.log(`🦷 Creating segment ${i + 1}/${result.segments.length}:`, segmentData);

        const segment = await this.createSegmentFromData(result.sessionId, segmentData);

        if (segment) {
          console.log(`✅ Successfully created segment: ${segment.name}`);
          dentalModel.segments.push(segment);
          this.scene.add(segment.mesh);
          console.log(`📊 Added segment to dentalModel. Total segments: ${dentalModel.segments.length}`);
          console.log(`🎭 Added mesh to scene. Scene children count: ${this.scene.children.length}`);
        } else {
          console.error(`❌ Failed to create segment ${i + 1}:`, segmentData);
        }
      }

      // Force reactivity update so sidebar reflects new segments
      // Since dentalModel is a shallowRef, we need to trigger reactivity by creating a new object
      const updatedDentalModel = { ...dentalModel };
      console.log(`🔄 Forced reactivity update. Updated model segments: ${updatedDentalModel.segments.length}`);
      
      // Trigger Vue reactivity by reassigning the entire object
      // This will be handled by the caller (DentalViewer) since we can't directly modify the ref here
      console.log(`🎉 Created ${dentalModel.segments.length} AI-segmented tooth segments`);
      console.log(`📋 Session ID: ${result.sessionId} - Use this to download individual STL files`);
      console.log(`📋 Final dentalModel segments:`, dentalModel.segments.map(s => ({ id: s.id, name: s.name })));
      
      // Return the updated model so the caller can update the ref
      return updatedDentalModel;

    } catch (error) {
      console.error("❌ Error creating AI segments:", error);
      throw error;
    }
  }

  async createSegmentFromData(sessionId: string, segmentData: SegmentData): Promise<ToothSegment | null> {
    try {
      console.log(`🔧 Creating segment from data:`, segmentData);
      
      // Load actual segment mesh from backend
      let mesh = await this.backendService.loadSegmentAsMesh(sessionId, segmentData.filename, segmentData.color);
      console.log(`📦 Loaded mesh for segment:`, mesh);

      // Apply color from segmentation result
      if (!this.THREE) {
        console.error("❌ THREE is not available in SegmentationService");
        return null;
      }
      
      const color = new this.THREE.Color(segmentData.color || '#00ff00');
      const material = mesh.material as any;
      material.color = color;
      material.side = this.THREE.DoubleSide;

      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh = markRaw(mesh);

      const centroid = new this.THREE.Vector3(
        segmentData.center?.[0] || 0,
        segmentData.center?.[1] || 0,
        segmentData.center?.[2] || 0
      );

      const segment: ToothSegment = {
        id: `ai_segment_${segmentData.id}`,
        name: segmentData.name,
        mesh: mesh,
        originalVertices: [],
        centroid: centroid,
        color: color,
        toothType: (segmentData.toothType as ToothType) || 'molar',
        isSelected: false,
        movementDistance: 0,
        originalPosition: mesh.position.clone(),
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

      console.log(`✅ Created AI segment: ${segment.name} from ${segmentData.filename}`);
      return segment;

    } catch (error) {
      console.error('❌ Error loading segment:', error);
      return null;
    }
  }
}