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
from services.gltf_converter import GLTFConverterService

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

# Initialize services
segmentation_service = DentalSegmentationService()
gltf_converter = GLTFConverterService()

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

@app.post("/convert/stl-to-gltf")
async def convert_stl_to_gltf(
    file: UploadFile = File(...), 
    binary: bool = Form(True),
    session_id: str = Form(None)
) -> JSONResponse:
    """
    Convert uploaded STL file to glTF or GLB format.
    
    Args:
        file: Uploaded STL file
        binary: True for GLB output, False for glTF
        session_id: Optional session ID to associate with conversion
        
    Returns:
        JSON response with conversion results and download information
    """
    try:
        # Validate file type
        if not file.filename or not file.filename.lower().endswith('.stl'):
            raise HTTPException(status_code=400, detail="Only STL files are supported")
        
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
        
        # Create output file path
        format_ext = '.glb' if binary else '.gltf'
        base_name = os.path.splitext(file.filename)[0]
        tmp_output = tempfile.NamedTemporaryFile(
            delete=False, 
            suffix=format_ext,
            prefix=f"{base_name}_"
        )
        tmp_output.close()
        
        try:
            # Perform conversion
            result = gltf_converter.stl_to_gltf(tmp_input.name, tmp_output.name, binary)
            
            if not result['success']:
                raise HTTPException(status_code=500, detail=result['error'])
            
            return JSONResponse({
                "success": True,
                "conversion_id": os.path.basename(tmp_output.name),
                "input_format": result['input_format'],
                "output_format": result['output_format'],
                "compression_ratio": result['compression_ratio'],
                "mesh_info": {
                    "vertices": result['vertex_count'],
                    "faces": result['face_count'],
                    "volume": result['volume'],
                    "surface_area": result['surface_area'],
                    "bounds": result['bounds'],
                    "is_watertight": result['is_watertight']
                },
                "file_info": {
                    "original_size": result['input_size'],
                    "converted_size": result['output_size'],
                    "original_name": file.filename,
                    "download_path": f"/download-converted/{os.path.basename(tmp_output.name)}"
                },
                "session_id": session_id,
                "message": f"STL successfully converted to {result['output_format']}"
            })
            
        finally:
            # Clean up temporary input file
            if os.path.exists(tmp_input.name):
                os.unlink(tmp_input.name)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during STL to glTF conversion: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Conversion failed: {str(e)}")

@app.post("/segment-to-gltf")
async def segment_and_convert_to_gltf(
    file: UploadFile = File(...), 
    config: str = Form(None),
    binary: bool = Form(True)
) -> JSONResponse:
    """
    Segment STL file and convert results to glTF/GLB format.
    
    Args:
        file: Uploaded STL file
        config: Optional JSON configuration string
        binary: True for GLB output, False for glTF
        
    Returns:
        JSON response with segmentation and conversion results
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
            # Perform segmentation
            segmentation_result = segmentation_service.segment_stl_file(tmp_input.name, file.filename, user_config)
            
            # Convert segments to glTF/GLB
            conversion_result = gltf_converter.process_segmented_meshes_to_gltf(
                segmentation_result.segments_data,  # This needs to be added to segmentation result
                segmentation_result.output_dir,
                segmentation_result.session_id,
                binary
            )
            
            if not conversion_result['success']:
                raise HTTPException(status_code=500, detail=conversion_result['error'])
            
            return JSONResponse({
                "success": True,
                "session_id": segmentation_result.session_id,
                "segmentation": {
                    "total_segments": len(segmentation_result.segments),
                    "segments": segmentation_result.segments
                },
                "conversion": {
                    "format": conversion_result['format'],
                    "converted_segments": conversion_result['converted_segments'],
                    "segments": conversion_result['segments']
                },
                "download_info": {
                    "base_path": f"/download/{segmentation_result.session_id}",
                    "format": conversion_result['format'].lower()
                },
                "message": f"Successfully segmented and converted {conversion_result['converted_segments']} segments to {conversion_result['format']}"
            })
            
        finally:
            # Clean up temporary input file
            if os.path.exists(tmp_input.name):
                os.unlink(tmp_input.name)

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during segment and convert operation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Operation failed: {str(e)}")

@app.get("/download-converted/{filename}")
async def download_converted_file(filename: str):
    """
    Download a converted glTF/GLB file.
    
    Args:
        filename: Name of the converted file
        
    Returns:
        File response with the converted file
    """
    try:
        # Look for the file in temp directory
        file_path = os.path.join(tempfile.gettempdir(), filename)
        
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Converted file not found")
        
        # Determine media type
        media_type = "application/octet-stream"
        if filename.endswith('.glb'):
            media_type = "model/gltf-binary"
        elif filename.endswith('.gltf'):
            media_type = "model/gltf+json"
        
        return FileResponse(
            path=file_path,
            filename=filename,
            media_type=media_type
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error downloading converted file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")

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
