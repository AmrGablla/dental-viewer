#!/bin/bash

echo "🦷 Starting 3D Dental Viewer Development Server"
echo "============================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
fi

echo "🚀 Starting development server..."
npm run dev
