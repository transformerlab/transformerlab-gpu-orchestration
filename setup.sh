#!/bin/bash

# Lattice Setup Script

echo "🚀 Setting up Lattice..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
python -m pip install -r requirements.txt
echo "✅ Backend dependencies installed (including WorkOS 5.24.0)"
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

echo "🎉 Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Copy backend/.env.example to backend/.env and configure your WorkOS credentials"
echo "2. Copy frontend/.env.example to frontend/.env.local (optional, has defaults)"
echo "3. Run 'npm run dev' to start both frontend and backend"
echo ""
echo "🌐 URLs:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
