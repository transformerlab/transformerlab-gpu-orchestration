#!/bin/bash

# Lattice Setup Script for Docker Environment

echo "🚀 Setting up Lattice in Docker..."

# Check if uv is installed (should be available in sky user's environment)
if ! command -v uv &> /dev/null; then
    echo "❌ uv is required but not installed."
    echo "💡 Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create Python virtual environment and install backend dependencies
echo "📦 Creating Python virtual environment with uv..."
cd backend || exit
echo "📦 Installing backend dependencies with uv..."
uv venv --seed --python 3.10
source .venv/bin/activate
uv pip install -r requirements.txt
echo "✅ Backend dependencies installed (including WorkOS 5.24.0 and SkyPilot)"
cd ..

# In Docker, kubectl is already installed by the sky user setup
echo "✅ kubectl already installed in Docker environment"

echo "✅ Backend dependencies installed"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend || exit
npm install

# Now build frontend
echo "� Building frontend..."
npm run build

echo "🎉 Setup complete!"
echo ""
echo "📝 Docker environment ready!"
echo "🌤️ SkyPilot environment configured for sky user"
echo "🐳 Container will start with both backend and SkyPilot services"
echo ""
echo "🌐 URLs (when container is running):"
echo "  Frontend: http://localhost:8000"
echo "  Backend:  http://localhost:8000/api/v1"
echo "  API Docs: http://localhost:8000/docs"
echo "  SkyPilot Dashboard: http://localhost:46580"