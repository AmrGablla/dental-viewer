# Alternative Backend Setup for Python 3.13

Since Open3D doesn't currently support Python 3.13, here are your options:

## Option 1: Use Python 3.12 (Recommended)

If you have Python 3.12 available:

```bash
# Check available Python versions
ls /usr/bin/python3*
# or
brew list | grep python

# Create virtual environment with Python 3.12
python3.12 -m venv venv_312
source venv_312/bin/activate
pip install -r requirements.txt
pip install open3d
```

## Option 2: Install Python 3.12 via Homebrew (macOS)

```bash
brew install python@3.12
python3.12 -m venv venv_312
source venv_312/bin/activate
pip install -r requirements.txt
pip install open3d
```

## Option 3: Use Conda

```bash
# Install conda if not available
# Download from: https://docs.conda.io/en/latest/miniconda.html

# Create environment with Python 3.12
conda create -n dental-backend python=3.12
conda activate dental-backend
pip install -r requirements.txt
conda install -c open3d-admin open3d
```

## Option 4: Run without Open3D (Current Setup)

Your current backend will run but segmentation will be disabled:

```bash
# Start the server (already working)
./start_dev.sh
```

The API will return HTTP 503 for segmentation endpoints with a clear message about installing Open3D.

## Checking Your Setup

After setting up with any of the above options, verify Open3D installation:

```python
python3 -c "import open3d; print(f'Open3D version: {open3d.__version__}')"
```

## Recommendation

For the best experience, use **Option 1** or **Option 2** to install Python 3.12, as Open3D is well-tested with that version.
