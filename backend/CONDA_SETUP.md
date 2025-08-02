# Conda Setup Guide for 3D Dental Segmentation Backend

## Quick Setup

### 1. Create the Conda Environment
```bash
cd backend
conda env create -f environment.yml
```

### 2. Activate and Test
```bash
conda activate dental-backend
python -c "import open3d; print('Open3D version:', open3d.__version__)"
```

### 3. Start the Backend
```bash
./start_conda.sh
```

Or use npm scripts:
```bash
# From project root
npm run backend-setup  # Setup conda environment
npm run backend        # Start with conda
```

## Alternative Manual Setup

If the automatic setup fails:

```bash
# Create environment manually
conda create -n dental-backend python=3.12 -y
conda activate dental-backend

# Install Open3D from conda
conda install -c open3d-admin open3d -y

# Install Python dependencies
pip install fastapi uvicorn[standard] python-multipart numpy
```

## Verification

Test the setup:
```bash
conda activate dental-backend
cd backend
python -c "
import open3d as o3d
print('✅ Open3D version:', o3d.__version__)

import fastapi
print('✅ FastAPI available')

print('✅ Backend ready!')
"
```

## Environment Files

- `environment.yml` - Conda environment specification
- `setup_conda.sh` - Automated setup script  
- `start_conda.sh` - Start backend with conda environment

## Troubleshooting

### Open3D Installation Issues
- Use the open3d-admin channel: `conda install -c open3d-admin open3d`
- Python 3.12 is recommended (3.13 has compatibility issues)

### Permission Issues
```bash
chmod +x setup_conda.sh start_conda.sh
```

### Environment Already Exists
```bash
conda env remove -n dental-backend
conda env create -f environment.yml
```
