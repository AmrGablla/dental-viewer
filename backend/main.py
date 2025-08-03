# FastAPI backend for segmenting STL teeth models using Open3D
# Segment teeth using point cloud clustering (DBSCAN)

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import tempfile
import os
from typing import Dict

from config import settings
from services.segmentation_service import DentalSegmentationService

app = FastAPI(
    title=settings.API_TITLE,
    description=settings.API_DESCRIPTION,
    version=settings.API_VERSION
)

# Add CORS middleware to allow requests from Vue.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize segmentation service
segmentation_service = DentalSegmentationService()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "3D Dental Segmentation API is running"}

@app.post("/segment")
async def segment_teeth(file: UploadFile = File(...), config: str = Form(None)) -> JSONResponse:
    """
    Segment teeth from an uploaded STL file using DBSCAN clustering.
    
    Args:
        file: Uploaded STL file
        config: Optional JSON configuration string with user parameters
        
    Returns:
        JSON response with session_id and segment information
    """
    try:
        # Validate file type
        if not file.filename or not file.filename.lower().endswith('.stl'):
            raise HTTPException(status_code=400, detail="Only STL files are supported")
        
        # Parse configuration if provided
        user_config = {}
        if config:
            try:
                import json
                user_config = json.loads(config)
                print(f"Using user configuration: {user_config}")
            except json.JSONDecodeError:
                print("Invalid JSON configuration, using defaults")
        
        # Check file size
        content = await file.read()
        file_size = len(content)
        
        if file_size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File too large. Maximum size is {settings.MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Save uploaded file to temporary location
        tmp_input = tempfile.NamedTemporaryFile(delete=False, suffix=".stl")
        tmp_input.write(content)
        tmp_input.close()
        
        try:
            # Perform segmentation with user configuration
            result = segmentation_service.segment_stl_file(tmp_input.name, file.filename, user_config)
            
            return JSONResponse({
                "success": True,
                **result.to_dict(),
                "message": f"Successfully segmented {len(result.segments)} teeth using {user_config.get('archType', 'auto')} configuration"
            })
            
        finally:
            # Clean up temporary input file
            if os.path.exists(tmp_input.name):
                os.unlink(tmp_input.name)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during segmentation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {str(e)}")

@app.get("/download/{session_id}/{filename}")
async def download_segment(session_id: str, filename: str):
    """
    Download a specific segmented tooth file.
    
    Args:
        session_id: Session ID from segmentation request
        filename: Name of the segment file to download
        
    Returns:
        File response with the PLY file
    """
    file_path = segmentation_service.get_file_path(session_id, filename)
    
    if not file_path:
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=file_path,
        media_type='application/octet-stream',
        filename=filename
    )

@app.get("/sessions/{session_id}")
async def get_session_info(session_id: str):
    """
    Get information about a segmentation session.
    
    Args:
        session_id: Session ID from segmentation request
        
    Returns:
        Session information and available segments
    """
    session_info = segmentation_service.get_session_info(session_id)
    
    if not session_info:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return JSONResponse(session_info)

@app.delete("/sessions/{session_id}")
async def cleanup_session(session_id: str):
    """
    Clean up a segmentation session and remove temporary files.
    
    Args:
        session_id: Session ID to clean up
        
    Returns:
        Cleanup confirmation
    """
    success = segmentation_service.cleanup_session(session_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return JSONResponse({
        "success": True,
        "message": f"Session {session_id} cleaned up successfully"
    })

@app.get("/health")
async def health_check():
    """Extended health check with system information"""
    try:
        # Test Open3D import
        import open3d as o3d
        
        return JSONResponse({
            "status": "healthy",
            "segmentation_available": True,
            "open3d_version": o3d.__version__,
            "active_sessions": len(segmentation_service.active_sessions),
            "temp_dir": tempfile.gettempdir(),
            "config": {
                "max_file_size_mb": settings.MAX_FILE_SIZE // (1024*1024),
                "point_cloud_samples": settings.POINT_CLOUD_SAMPLES,
                "dbscan_eps": settings.DBSCAN_EPS,
                "dbscan_min_points": settings.DBSCAN_MIN_POINTS
            }
        })
    except Exception as e:
        return JSONResponse({
            "status": "unhealthy",
            "error": str(e)
        }, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.HOST, 
        port=settings.PORT,
        reload=settings.AUTO_RELOAD
    )
