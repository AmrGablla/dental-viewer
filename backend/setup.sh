#!/bin/bash

# Setup script for the 3D Dental Segmentation API Backend

echo "🔧 Setting up 3D Dental Segmentation API Backend"
echo "================================================"

# Navigate to backend directory
cd "$(dirname "$0")"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "Please install Python 3.8 or higher."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "🐍 Python version: $PYTHON_VERSION"

# Check if we're in a virtual environment
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "⚠️  No virtual environment detected."
    echo "Creating a virtual environment..."
    
    # Create virtual environment
    python3 -m venv venv
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create virtual environment"
        exit 1
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    echo "✅ Virtual environment created and activated"
else
    echo "✅ Virtual environment detected: $VIRTUAL_ENV"
fi

# Upgrade pip
echo "� Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "📦 Installing dependencies..."

# First try minimal dependencies
echo "Installing basic dependencies..."
pip install fastapi uvicorn[standard] python-multipart numpy

if [ $? -ne 0 ]; then
    echo "❌ Failed to install basic dependencies"
    exit 1
fi

# Try to install Open3D
echo "Installing Open3D..."
pip install open3d

if [ $? -ne 0 ]; then
    echo "⚠️  Open3D installation failed."
    echo ""
    echo "This is common with newer Python versions (3.13+)."
    echo "Try these alternatives:"
    echo ""
    echo "1. Use conda:"
    echo "   conda install -c open3d-admin open3d"
    echo ""
    echo "2. Use older Python version (3.11 or 3.12):"
    echo "   python3.11 -m venv venv_311"
    echo "   source venv_311/bin/activate"
    echo "   pip install -r requirements.txt open3d"
    echo ""
    echo "3. Continue without Open3D (API will run but segmentation disabled)"
    echo ""
fi

# Test installation
echo ""
echo "🧪 Testing installation..."
python3 -c "
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
    open3d_available = True
except ImportError:
    print('⚠️  Open3D not available - please install for segmentation functionality')
    open3d_available = False

if missing_packages:
    print(f'❌ Missing packages: {missing_packages}')
    sys.exit(1)
else:
    print('✅ Core dependencies installed successfully!')
    if not open3d_available:
        print('⚠️  Note: Install Open3D for full segmentation functionality')
"

INSTALL_SUCCESS=$?

if [ $INSTALL_SUCCESS -eq 0 ]; then
    echo ""
    echo "🎉 Backend setup completed successfully!"
    echo ""
    echo "To start the development server:"
    echo "  ./start_dev.sh"
    echo ""
    echo "Or manually:"
    echo "  source venv/bin/activate  # (if using virtual environment)"
    echo "  uvicorn main:app --reload"
    echo ""
    echo "The API will be available at:"
    echo "  📍 http://localhost:8000"
    echo "  📖 http://localhost:8000/docs (API documentation)"
else
    echo ""
    echo "❌ Setup failed. Please check the error messages above."
    exit 1
fi
