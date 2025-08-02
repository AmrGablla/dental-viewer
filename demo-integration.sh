#!/bin/bash

# Demo script showing frontend-backend communication for STL segmentation

echo "🦷 3D Dental STL Segmentation Demo"
echo "=================================="

echo ""
echo "📋 This demo shows how the frontend calls the backend to segment STL files:"
echo ""

echo "1️⃣ Frontend Process (Vue.js + TypeScript):"
echo "   • User selects STL file in browser"
echo "   • SegmentationService.segmentSTLFile(file) is called"
echo "   • Creates FormData with the STL file"
echo "   • POST request to http://localhost:8000/segment"
echo ""

echo "2️⃣ Backend Process (FastAPI + Open3D):"
echo "   • Receives STL file upload"
echo "   • Loads mesh with Open3D"
echo "   • Samples 30,000 points from mesh surface"
echo "   • Applies DBSCAN clustering to identify teeth"
echo "   • Exports each cluster as PLY file"
echo "   • Returns session ID and segment metadata"
echo ""

echo "3️⃣ Frontend Response:"
echo "   • Receives JSON with segment information"
echo "   • Transforms to TypeScript types"
echo "   • Shows download links for individual teeth"
echo "   • Optionally loads PLY files as 3D meshes"
echo ""

echo "🌐 API Endpoints Used:"
echo "   POST /segment              - Upload STL and get segments"
echo "   GET /download/{session}/{file} - Download individual PLY files"
echo "   GET /health               - Check backend availability"
echo ""

echo "📝 Code Example:"
echo ""
echo "// Frontend TypeScript"
echo "const segmentationService = new SegmentationService()"
echo "const result = await segmentationService.segmentSTLFile(stlFile)"
echo ""
echo "// Result contains:"
echo "// - sessionId: string"
echo "// - segments: Array of teeth with download URLs"
echo "// - metadata: timestamp, status, etc."
echo ""

echo "🚀 To run the full system:"
echo "   Terminal 1: npm run backend     # Start FastAPI server (port 8000)"
echo "   Terminal 2: npm run dev         # Start Vue.js app (port 5173)"
echo "   Browser:    http://localhost:5173"
echo ""

echo "✅ The frontend automatically communicates with the backend for AI segmentation!"
echo ""

# Check if backend is running
echo "🔍 Checking backend status..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Backend is running and healthy!"
else
    echo "❌ Backend is not running. Start with: npm run backend"
fi

echo ""
echo "📚 For detailed integration guide, see: INTEGRATION_GUIDE.md"
