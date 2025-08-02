# 3D Dental Viewer App

A comprehensive web-based 3D dental viewer application with AI-powered segmentation capabilities. Built with Vue.js 3 and Three.js for the frontend, and FastAPI with Open3D for the backend segmentation service.

## 🏗️ Architecture

- **Frontend**: Vue.js 3 + Three.js + TypeScript (Port 5173)
- **Backend**: FastAPI + Open3D + Python (Port 8000)
- **Segmentation**: DBSCAN clustering with point cloud analysis
- **File Format**: STL input, PLY segment output

## 🚀 Quick Start

### 1. Backend Setup (Required for Segmentation)

**Recommended: Using Conda (most reliable for Open3D)**
```bash
# Setup backend with conda environment
npm run backend-setup

# Start backend server  
npm run backend
```

### 2. Frontend Development Server

```bash
# Start frontend development server
npm run dev
```

### 3. Using the Application

1. Open http://localhost:5173 in your browser
2. Backend API will be available at http://localhost:8000
3. Upload STL files for automatic segmentation
4. Use 3D controls to navigate and inspect results

## 📦 NPM Scripts

- `npm run dev` - Start Vue.js frontend development server
- `npm run backend` - Start FastAPI backend with conda environment
- `npm run backend-setup` - Create conda environment with Open3D
- `npm run build` - Build frontend for production
- `npm run preview` - Preview production build
## Features

### 🦷 Core Functionality
- **STL File Loading**: Load and render STL files of full jaw models (teeth + gums)
- **3D Visualization**: Real-time 3D rendering with lighting and shadows
- **Interactive Camera**: Orbit, zoom, and pan controls

### 🤖 AI-Powered Segmentation
- **Automatic Teeth Segmentation**: Upload STL files to backend for automatic segmentation
- **DBSCAN Clustering**: Uses point cloud clustering to identify individual teeth
- **Watershed Refinement**: Applies distance-transform watershed on voxel grids to split touching teeth
- **Session Management**: Track segmentation sessions and results
- **Segment Download**: Download individual teeth as PLY files

### 🔧 Manual Segmentation Tools (Frontend)
- **Geometric Segmentation**:
  - Curvature-based segmentation
  - Concavity detection
  - K-means clustering
  - Region growing algorithms

### 🎨 Manual Refinement Tools
- **Selection Methods**:
  - Click selection
  - Lasso selection tool
  - Brush selection
  - Rectangle selection
  - Region-based selection

- **Segment Operations**:
  - Merge segments
  - Split segments
  - Delete segments
  - Color assignment
  - Tooth type classification

### 🎯 Interactive Manipulation
- **Transform Controls**:
  - Move individual teeth
  - Rotate teeth around axes
  - Transform gizmos with axis handles
  - Multi-segment operations

### 🎨 Visual Features
- **Color Coding**:
  - Different colors for each tooth
  - Separate color for gums (pink by default)
  - Custom color picker for segments
  - Visual feedback for selections

### 💾 Export Options
- Export segmentation data as JSON
- Include vertex data, colors, and metadata
- Preserves tooth classifications

## Tech Stack

- **Frontend Framework**: Vue.js 3 with Composition API
- **3D Graphics**: Three.js
- **Performance**: three-mesh-bvh for fast mesh operations
- **Language**: TypeScript for type safety
- **Build Tool**: Vite for fast development

## Project Structure

```
src/
├── components/
│   └── DentalViewer.vue        # Main 3D viewer component
├── services/
│   ├── STLLoader.ts            # STL file loading service
│   ├── SegmentationService.ts  # Geometric segmentation algorithms
│   └── InteractionService.ts   # Manual interaction tools
├── types/
│   └── dental.ts               # TypeScript type definitions
└── utils/
    └── GeometryUtils.ts        # Geometric computation utilities
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser to `http://localhost:5173`

## Usage

### Loading STL Files
1. Click "Load STL File" button
2. Select an STL file containing a dental model
3. The model will be automatically loaded and rendered

### Automatic Segmentation
1. After loading a model, choose a segmentation method:
   - **Curvature**: Segments based on surface curvature
   - **Concavity**: Detects concave regions (tooth boundaries)
   - **K-Means**: Clusters vertices by spatial proximity
   - **Region Growing**: Grows regions from seed points

2. Adjust parameters using the sliders
3. Click "Apply Segmentation" to update the segmentation

### Manual Refinement
1. Select an interaction mode:
   - **Select**: Click to select individual segments
   - **Lasso**: Draw a freehand selection area
   - **Brush**: Paint-style selection
   - **Move**: Translate selected segments
   - **Rotate**: Rotate selected segments

2. Use the segment list to:
   - Change colors
   - Merge segments
   - Split segments
   - Delete segments

### Exporting Results
1. Click "Export Model" to download segmentation data
2. The JSON file contains vertex data, colors, and metadata

## Segmentation Algorithms

### Curvature-Based Segmentation
Uses mean and Gaussian curvature to identify tooth boundaries. High curvature areas typically correspond to edges between teeth.

### Concavity Detection
Identifies concave regions where teeth meet the gums or adjacent teeth.

### K-Means Clustering
Spatially clusters vertices into a specified number of groups, useful for separating individual teeth.

### Region Growing
Starts from seed points and grows regions based on geometric similarity (normal vectors, curvature).

### DBSCAN Clustering
Density-based clustering that can handle irregular tooth shapes and automatically determine the number of clusters.

## Advanced Features

### Transform Gizmos
Interactive 3D handles for precise tooth movement and rotation with visual feedback.

### BVH Acceleration
Uses Bounding Volume Hierarchy for fast ray-mesh intersection testing, enabling smooth interaction with complex models.

### Multi-Selection Support
Select multiple teeth simultaneously for batch operations.

### Undo/Redo System
(Planned) Track changes for easy revision of segmentation decisions.

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Requires WebGL 2.0 support for optimal performance.

## Performance Considerations

- STL files up to 50MB are handled efficiently
- Large models (>100k vertices) may experience slower segmentation
- Consider using Web Workers for heavy computations (future enhancement)

## Future Enhancements

### Backend Integration
For complex models, consider integrating with a Python backend using:
- **FastAPI** for REST API
- **Open3D** for advanced geometric processing
- **Trimesh** for mesh operations
- **NumPy/SciPy** for mathematical computations

### Machine Learning Integration
- Neural network-based tooth segmentation
- Automatic tooth numbering
- Pathology detection

### Additional File Formats
- PLY files
- OBJ files with materials
- DICOM integration for CT scans

## Development

### Adding New Segmentation Methods
1. Extend `SegmentationService.ts`
2. Add method to `SegmentationParams` type
3. Update UI controls in `DentalViewer.vue`

### Custom Interaction Tools
1. Extend `InteractionService.ts`
2. Add new interaction modes
3. Implement event handlers

### Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Three.js community for excellent 3D library
- Vue.js team for the reactive framework
- Open source dental imaging research community
