#!/bin/bash

echo "🚀 Setting up Dental Viewer with Authentication"
echo "================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Create backend directory if it doesn't exist
if [ ! -d "backend-auth" ]; then
    echo "📁 Creating backend directory..."
    mkdir backend-auth
fi

# Navigate to backend directory
cd backend-auth

echo "📦 Installing backend dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "⚙️ Creating .env file..."
    cat > .env << EOF
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
EOF
    echo "✅ .env file created"
else
    echo "✅ .env file already exists"
fi

# Go back to root directory
cd ..

echo "📦 Installing frontend dependencies..."
npm install

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the backend:"
echo "   cd backend-auth && npm run dev"
echo ""
echo "2. Start the frontend (in a new terminal):"
echo "   npm run dev"
echo ""
echo "3. Open your browser to:"
echo "   http://localhost:5173"
echo ""
echo "4. Login with default credentials:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "Happy coding! 🦷"
