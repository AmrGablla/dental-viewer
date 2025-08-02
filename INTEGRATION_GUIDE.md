# Frontend-Backend Integration Guide
## 3D Dental STL Segmentation Flow

This document explains how the Vue.js frontend communicates with the FastAPI backend for AI-powered teeth segmentation.

## 🔄 **Complete Integration Flow**

### **1. Frontend Architecture**

```
Frontend Components:
├── DentalViewer.vue          # Main 3D viewer component
├── AISegmentationPanel.vue   # AI segmentation interface
├── SegmentationService.ts    # Backend communication service
└── types/dental.ts          # TypeScript interfaces
```

### **2. Backend API Endpoints**

```
Backend Endpoints:
├── POST /segment            # Upload STL, get segmented teeth
├── GET /download/{session}/{file} # Download individual PLY files
├── GET /sessions/{session}  # Get segmentation session info
├── DELETE /sessions/{session} # Clean up session files
└── GET /health             # Check backend availability
```

## 🚀 **Step-by-Step Usage Flow**

### **Step 1: User Uploads STL File**

**Frontend (Vue.js):**
```typescript
// In AISegmentationPanel.vue or TopToolbar.vue
async function handleAISegmentation(event: Event) {
  const file = input.files?.[0]
  
  // Use SegmentationService to call backend
  const result = await segmentationService.segmentSTLFile(file)
  
  // Result contains segment information
  console.log('Segmentation complete:', result)
}
```

**What happens internally:**
```typescript
// In SegmentationService.ts
async segmentSTLFile(file: File): Promise<SegmentationResult> {
  // 1. Validate file type (.stl only)
  if (!file.name.toLowerCase().endsWith('.stl')) {
    throw new Error('Only STL files are supported')
  }

  // 2. Create FormData for multipart upload
  const formData = new FormData()
  formData.append('file', file)

  // 3. POST to backend API
  const response = await fetch('http://localhost:8000/segment', {
    method: 'POST',
    body: formData
  })

  // 4. Parse response and transform to frontend types
  const result = await response.json()
  return transformToFrontendTypes(result)
}
```

### **Step 2: Backend Processes STL File**

**Backend (FastAPI + Open3D):**
```python
# In main.py
@app.post("/segment")
async def segment_teeth(file: UploadFile = File(...)):
    # 1. Validate and save uploaded STL file
    tmp_file = save_uploaded_file(file)
    
    # 2. Use segmentation service
    result = segmentation_service.segment_stl_file(tmp_file, file.filename)
    
    # 3. Return session info and segment data
    return {
        "success": True,
        "session_id": result.session_id,
        "segments_count": len(result.segments),
        "segments": result.segments
    }
```

**Segmentation Process:**
```python
# In segmentation_service.py
def segment_stl_file(self, file_path: str, filename: str):
    # 1. Load STL mesh with Open3D
    mesh = o3d.io.read_triangle_mesh(file_path)
    
    # 2. Sample point cloud from mesh surface
    point_cloud = mesh.sample_points_poisson_disk(30000)
    
    # 3. Apply DBSCAN clustering to identify teeth
    labels = perform_dbscan_clustering(point_cloud)
    
    # 4. Export each cluster as PLY file
    segments = export_segments_as_ply(point_cloud, labels)
    
    # 5. Return session with downloadable segments
    return SegmentationResult(session_id, segments)
```

### **Step 3: Frontend Receives Results**

**Response Format:**
```json
{
  "success": true,
  "session_id": "uuid-string",
  "segments_count": 5,
  "segments": [
    {
      "id": 0,
      "filename": "tooth_00.ply",
      "point_count": 1250,
      "center": [x, y, z],
      "volume": 123.45,
      "download_url": "/download/session-id/tooth_00.ply"
    }
  ]
}
```

**Frontend Processing:**
```typescript
// Transform backend response to frontend types
const segmentationResult: SegmentationResult = {
  sessionId: result.session_id,
  originalFile: file.name,
  segments: result.segments.map((segment: any) => ({
    id: segment.id,
    name: `Tooth ${segment.id + 1}`,
    filename: segment.filename,
    pointCount: segment.point_count,
    center: segment.center,
    downloadUrl: segment.download_url,
    color: generateSegmentColor(segment.id)
  })),
  timestamp: new Date(),
  status: 'completed'
}
```

### **Step 4: Download Individual Segments**

**Frontend:**
```typescript
// Download a specific tooth as PLY file
async function downloadSegment(segment: SegmentData) {
  const blob = await segmentationService.downloadSegment(
    sessionId, 
    segment.filename
  )
  
  // Create download link
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = segment.filename
  a.click()
}
```

**Backend:**
```python
@app.get("/download/{session_id}/{filename}")
async def download_segment(session_id: str, filename: str):
    # Validate session and file exist
    file_path = get_segment_file_path(session_id, filename)
    
    # Return PLY file as download
    return FileResponse(
        file_path,
        media_type='application/octet-stream',
        filename=filename
    )
```

## 🛠 **Integration Example**

### **Add AI Segmentation to Main Component:**

```vue
<!-- In DentalViewer.vue -->
<template>
  <div class="dental-viewer">
    <!-- Existing components -->
    <LeftSidebar>
      <!-- Add AI Segmentation Panel -->
      <AISegmentationPanel 
        @segmentationComplete="handleAISegmentationComplete"
      />
      <!-- Existing sidebar content -->
    </LeftSidebar>
  </div>
</template>

<script setup lang="ts">
import AISegmentationPanel from './AISegmentationPanel.vue'

async function handleAISegmentationComplete(result: SegmentationResult) {
  console.log('AI Segmentation completed:', result)
  
  // Option 1: Display segmentation results in UI
  displaySegmentationResults(result)
  
  // Option 2: Load segments as 3D meshes (requires PLYLoader)
  // await loadSegmentsAs3DMeshes(result)
  
  // Option 3: Show download links for PLY files
  showDownloadOptions(result)
}
</script>
```

## 🔍 **Current Status & Next Steps**

### **✅ What's Working:**
- ✅ STL file upload and validation
- ✅ Backend segmentation with Open3D + DBSCAN
- ✅ PLY file generation and download
- ✅ Session management and cleanup
- ✅ Error handling and health checks

### **🚧 What Needs Implementation:**
- 🔄 PLY file loading in frontend (requires PLYLoader from three-stdlib)
- 🔄 3D visualization of segmented teeth
- 🔄 Integration with existing manual segmentation tools

### **📋 To Complete Full Integration:**

1. **Install PLYLoader:**
   ```bash
   npm install three-stdlib
   ```

2. **Implement PLY Loading:**
   ```typescript
   import { PLYLoader } from 'three-stdlib'
   
   async loadSegmentAsMesh(sessionId: string, filename: string) {
     const blob = await this.downloadSegment(sessionId, filename)
     const arrayBuffer = await blob.arrayBuffer()
     
     const loader = new PLYLoader()
     const geometry = loader.parse(arrayBuffer)
     const material = new THREE.MeshLambertMaterial({ color: 0xffffff })
     
     return new THREE.Mesh(geometry, material)
   }
   ```

3. **Add to Main Component:**
   ```typescript
   // Load AI-segmented teeth as 3D meshes
   async function loadAISegments(result: SegmentationResult) {
     for (const segment of result.segments) {
       const mesh = await segmentationService.loadSegmentAsMesh(
         result.sessionId, 
         segment.filename
       )
       scene.add(mesh)
     }
   }
   ```

## 🌐 **Required Running Services**

1. **Backend:** `npm run backend` (Port 8000)
2. **Frontend:** `npm run dev` (Port 5173)
3. **Access:** http://localhost:5173

The frontend will automatically communicate with the backend API for AI-powered segmentation!
