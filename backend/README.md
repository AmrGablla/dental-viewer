# 3D Dental Segmentation API Backend

A FastAPI-based backend service for segmenting STL dental models into individual teeth using Open3D and advanced clustering strategies.

## Features

- **STL File Processing**: Upload and process STL dental models
- **Automatic Teeth Segmentation**: Combines connected-components, DBSCAN and voxel-based morphology to identify individual teeth
- **Point Cloud Analysis**: Converts mesh to point cloud for clustering analysis
- **RESTful API**: Clean REST endpoints for frontend integration
- **Session Management**: Track segmentation sessions and results
- **File Downloads**: Download individual segmented teeth as PLY files
- **CORS Support**: Configured for Vue.js frontend integration

## Technologies

- **FastAPI**: Modern, fast web framework for building APIs
- **Open3D**: 3D data processing and analysis
- **NumPy**: Numerical computing for point cloud operations
- **Uvicorn**: ASGI server for running the application

## Installation

### Prerequisites

- **Conda or Miniconda** (recommended) OR Python 3.12
- Open3D requires Python ≤ 3.12 (Python 3.13 not yet supported)

### Recommended Setup (Conda)

The easiest way to set up the backend with reliable Open3D installation:

1. **Automated Setup**:
   ```bash
   cd backend
   ./setup_conda.sh
   ```
   
   Or using npm from project root:
   ```bash
   npm run backend-setup
   ```

2. **Start the Backend**:
   ```bash
   cd backend
   ./start_conda.sh
   ```
   
   Or using npm:
   ```bash
   npm run backend
   ```

See [CONDA_SETUP.md](./CONDA_SETUP.md) for detailed conda setup instructions.

The API will be available at:
- **API**: http://localhost:8000
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Core Endpoints

#### `POST /segment`
Upload and segment an STL file into individual teeth.

**Request**: Multipart form data with STL file
**Response**: 
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
      "bounding_box": {
        "min": [x1, y1, z1],
        "max": [x2, y2, z2]
      },
      "download_url": "/download/session-id/tooth_00.ply"
    }
  ],
  "message": "Successfully segmented 5 teeth"
}
```

#### `GET /download/{session_id}/{filename}`
Download a specific segmented tooth file.

**Response**: PLY file download

#### `GET /sessions/{session_id}`
Get information about a segmentation session.

**Response**:
```json
{
  "session_id": "uuid-string",
  "output_directory": "/path/to/temp/dir",
  "segments": [
    {
      "filename": "tooth_00.ply",
      "size": 12345,
      "download_url": "/download/session-id/tooth_00.ply"
    }
  ]
}
```

#### `DELETE /sessions/{session_id}`
Clean up a segmentation session and remove temporary files.

### Utility Endpoints

#### `GET /`
Health check endpoint.

#### `GET /health`
Extended health check with system information.

**Response**:
```json
{
  "status": "healthy",
  "open3d_version": "0.18.0",
  "active_sessions": 2,
  "temp_dir": "/tmp",
  "config": {
    "max_file_size_mb": 100,
    "point_cloud_samples": 30000,
    "dbscan_eps": 2.5,
    "dbscan_min_points": 100
  }
}
```

## Configuration

The application can be configured via `config.py`:

```python
class Settings:
    # Segmentation Parameters
    POINT_CLOUD_SAMPLES = 30000      # Number of points to sample from mesh
    DBSCAN_EPS = 2.5                 # DBSCAN epsilon parameter
    DBSCAN_MIN_POINTS = 100          # DBSCAN minimum points per cluster
    MIN_CLUSTER_SIZE = 50            # Minimum cluster size to export
    
    # File Upload
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB maximum file size
    
    # CORS
    ALLOWED_ORIGINS = [
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative frontend port
    ]
```

## Algorithm Overview

### Segmentation Process

1. **STL Loading**: Load triangle mesh from STL file using Open3D
2. **Preprocessing**: 
   - Compute vertex normals
   - Remove duplicate vertices/triangles (optional)
3. **Point Sampling**: Sample points uniformly from mesh surface using Poisson disk sampling
4. **Clustering**: Apply DBSCAN clustering to identify teeth regions
5. **Post-processing**: 
   - Filter out small noise clusters
   - Calculate cluster statistics (center, volume, bounding box)
6. **Export**: Save each cluster as individual PLY point cloud file

### DBSCAN Parameters

- **eps (2.5)**: Maximum distance between points in a cluster
- **min_points (100)**: Minimum number of points required to form a cluster
- **min_cluster_size (50)**: Minimum cluster size to export as a tooth

These parameters may need adjustment based on:
- STL file scale and units
- Dental model quality and resolution
- Desired segmentation granularity

## Development

### Project Structure

```
backend/
├── main.py                    # FastAPI application
├── config.py                  # Configuration settings
├── segmentation_service.py    # Core segmentation logic
├── environment.yml            # Conda environment definition
├── setup_conda.sh             # Conda environment setup script
├── start_conda.sh             # Development server script
└── README.md                  # This file
```

### Adding Features

The modular structure makes it easy to add features:

- **New clustering algorithms**: Extend `segmentation_service.py`
- **Additional file formats**: Add loaders to handle other 3D formats
- **Advanced post-processing**: Add mesh reconstruction, smoothing, etc.
- **Database integration**: Store segmentation history and metadata

### Error Handling

The API includes comprehensive error handling:

- File validation (type, size)
- Mesh loading errors
- Clustering failures
- Session management errors

All errors return appropriate HTTP status codes with descriptive messages.

## Integration with Frontend

This backend is designed to work with the Vue.js 3D dental viewer frontend. The CORS configuration allows requests from the Vite development server.

### Frontend Usage Example

```typescript
// Upload STL file for segmentation
const formData = new FormData();
formData.append('file', stlFile);

const response = await fetch('http://localhost:8000/segment', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log('Segmentation complete:', result);

// Download individual tooth
const toothUrl = `http://localhost:8000${result.segments[0].download_url}`;
const toothResponse = await fetch(toothUrl);
const toothBlob = await toothResponse.blob();
```

## Troubleshooting

### Common Issues

1. **Open3D installation fails with Python 3.13**:
   - Open3D doesn't support Python 3.13 yet
   - Use Python 3.12: `brew install python@3.12`

2. **Open3D installation fails on other systems**:
   - Ensure Python 3.8+ is installed
   - Try installing in a fresh virtual environment
   - On macOS, you may need to install via conda

3. **Large file processing fails**:
   - Check file size limits in config
   - Monitor memory usage during processing
   - Consider reducing `POINT_CLOUD_SAMPLES` for very large models

4. **No clusters found**:
   - Adjust DBSCAN parameters (`eps`, `min_points`)
   - Check STL file scale and units
   - Verify the dental model has distinct teeth

5. **CORS errors**:
   - Ensure frontend URL is in `ALLOWED_ORIGINS`
   - Check that both frontend and backend are running

### Performance Tips

- For production, consider using a more robust file storage solution
- Implement background processing for large files
- Add caching for frequently processed models
- Monitor and limit concurrent segmentation requests

## License

This project is part of the 3D Dental Viewer application.
