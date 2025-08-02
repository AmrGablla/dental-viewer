#!/bin/bash

# Conda-based setup script for the 3D Dental Segmentation API Backend

echo "🔧 Setting up 3D Dental Segmentation API Backend with Conda"
echo "========================================================="

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if conda is available
if ! command -v conda &> /dev/null; then
    echo "❌ Conda is not available or not in PATH."
    echo "Please install conda/miniconda and ensure it's initialized in your shell."
    echo "Run: conda init zsh (or your shell)"
    exit 1
fi

echo "🐍 Conda found: $(conda --version)"

# Check if environment already exists
if conda env list | grep -q "dental-backend"; then
    echo "⚠️  Environment 'dental-backend' already exists."
    read -p "Do you want to remove and recreate it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️ Removing existing environment..."
        conda env remove -n dental-backend -y
    else
        echo "📦 Using existing environment..."
    fi
fi

if ! conda env list | grep -q "dental-backend"; then
    echo "📦 Creating conda environment from environment.yml..."
    conda env create -f environment.yml
    
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create conda environment"
        echo "Trying alternative method..."
        
        # Alternative: create environment and install packages manually
        conda create -n dental-backend python=3.12 -y
        conda activate dental-backend
        conda install -c open3d-admin open3d -y
        pip install fastapi uvicorn[standard] python-multipart numpy
        
        if [ $? -ne 0 ]; then
            echo "❌ Alternative installation also failed"
            exit 1
        fi
    fi
fi

# Activate environment and test installation
echo "🧪 Testing installation..."
conda run -n dental-backend python -c "
import sys
missing_packages = []

try:
    import fastapi
    print('✅ FastAPI:', fastapi.__version__)
except ImportError:
    missing_packages.append('fastapi')
    print('❌ FastAPI not installed')

try:
    import uvicorn
    print('✅ Uvicorn available')
except ImportError:
    missing_packages.append('uvicorn')
    print('❌ Uvicorn not installed')

try:
    import numpy
    print('✅ NumPy:', numpy.__version__)
except ImportError:
    missing_packages.append('numpy')
    print('❌ NumPy not installed')

try:
    import open3d
    print('✅ Open3D:', open3d.__version__)
except ImportError:
    missing_packages.append('open3d')
    print('❌ Open3D not installed')

if missing_packages:
    print(f'❌ Missing packages: {missing_packages}')
    sys.exit(1)
else:
    print('✅ All dependencies installed successfully!')
"

INSTALL_SUCCESS=$?

if [ $INSTALL_SUCCESS -eq 0 ]; then
    echo ""
    echo "🎉 Backend setup completed successfully!"
    echo ""
    echo "To activate the environment and start the server:"
    echo "  conda activate dental-backend"
    echo "  ./start_conda.sh"
    echo ""
    echo "The API will be available at:"
    echo "  📍 http://localhost:8000"
    echo "  📖 http://localhost:8000/docs (API documentation)"
else
    echo ""
    echo "❌ Setup failed. Please check the error messages above."
    exit 1
fi
