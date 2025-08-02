#!/bin/bash

# Development server startup script for the 3D Dental Segmentation API

echo "🦷 Starting 3D Dental Segmentation API Backend"
echo "============================================="

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if we're in a virtual environment
if [[ "$VIRTUAL_ENV" == "" ]]; then
    # Try to activate virtual environment if it exists
    if [ -f "venv/bin/activate" ]; then
        echo "🔄 Activating virtual environment..."
        source venv/bin/activate
    else
        echo "⚠️  Warning: No virtual environment detected."
        echo "It's recommended to use a virtual environment:"
        echo "python3 -m venv venv"
        echo "source venv/bin/activate"
        echo ""
    fi
fi

# Check if Open3D is available
echo "🔍 Checking dependencies..."
python3 -c "
try:
    import open3d
    print('✅ Open3D available - full segmentation enabled')
except ImportError:
    print('⚠️  Open3D not available - segmentation will fail')
    print('   Install with: pip install open3d')
" 

echo "🚀 Starting FastAPI development server..."
echo "📍 API will be available at: http://localhost:8000"
echo "📖 API docs will be available at: http://localhost:8000/docs"
echo "🔄 Auto-reload enabled for development"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run uvicorn with auto-reload for development
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
