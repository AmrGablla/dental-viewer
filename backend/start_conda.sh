#!/bin/bash

# Conda-based development server startup script

echo "🦷 Starting 3D Dental Segmentation API Backend (Conda)"
echo "====================================================="

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "❌ Conda is not available or not in PATH."
    echo "Please install conda and run: conda init zsh"
    exit 1
fi

# Check if environment exists
if ! conda env list | grep -q "dental-backend"; then
    echo "❌ Conda environment 'dental-backend' not found."
    echo "Please run: ./setup_conda.sh"
    exit 1
fi

echo "🔍 Checking dependencies in conda environment..."
conda run -n dental-backend python -c "
try:
    import open3d
    print('✅ Open3D available - full segmentation enabled')
except ImportError:
    print('⚠️  Open3D not available in conda environment')
    print('   Run: conda activate dental-backend && conda install -c open3d-admin open3d')
"

echo "🚀 Starting FastAPI development server with conda..."
echo "📍 API will be available at: http://localhost:8000"
echo "📖 API docs will be available at: http://localhost:8000/docs"
echo "🔄 Auto-reload enabled for development"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run uvicorn with conda environment
conda run -n dental-backend uvicorn main:app --host 0.0.0.0 --port 8000 --reload
