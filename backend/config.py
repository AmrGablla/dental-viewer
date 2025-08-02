"""
Configuration settings for the 3D Dental Segmentation API
"""

import os
from typing import List

class Settings:
    # API Configuration
    API_TITLE = "3D Dental Segmentation API"
    API_DESCRIPTION = "FastAPI backend for segmenting STL dental models using Open3D"
    API_VERSION = "1.0.0"
    
    # Server Configuration
    HOST = "0.0.0.0"
    PORT = 8000
    
    # CORS Configuration
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",  # Vite development server
        "http://localhost:3000",  # Alternative frontend port
        "http://localhost:8080",  # Vue CLI default
    ]
    
    # File Upload Configuration
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    ALLOWED_EXTENSIONS = [".stl"]
    
    # Segmentation Parameters
    POINT_CLOUD_SAMPLES = 50000  # Increased for better detail
    DBSCAN_EPS = 1.5  # Smaller for better tooth separation
    DBSCAN_MIN_POINTS = 50  # Reduced for more sensitive clustering
    MIN_CLUSTER_SIZE = 100  # Minimum points for a valid tooth
    
    # Temporary File Management
    TEMP_DIR = os.path.join(os.path.dirname(__file__), "temp")
    SESSION_CLEANUP_HOURS = 24  # Clean up sessions after 24 hours
    
    # Development Settings
    DEBUG = os.getenv("DEBUG", "true").lower() == "true"
    AUTO_RELOAD = DEBUG

# Create settings instance
settings = Settings()
