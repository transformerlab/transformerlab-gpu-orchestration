#!/bin/bash

# Lattice Setup Script

echo "🚀 Setting up Lattice..."

# Check if uv is installed
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

# Install kubectl
echo "📦 Installing kubectl..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if ! command -v kubectl &> /dev/null; then
        if command -v brew &> /dev/null; then
            brew install kubectl
        else
            echo "Installing kubectl via curl to ~/.local/bin..."
            mkdir -p ~/.local/bin
            curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/amd64/kubectl"
            chmod +x ./kubectl
            mv ./kubectl ~/.local/bin/kubectl
            echo "✅ kubectl installed to ~/.local/bin (add to PATH if needed)"
            echo "💡 Run: export PATH=\$PATH:~/.local/bin"
        fi
        echo "✅ kubectl installed"
    else
        echo "✅ kubectl already installed"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if ! command -v kubectl &> /dev/null; then
        echo "Installing kubectl via curl to ~/.local/bin..."
        mkdir -p ~/.local/bin
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        chmod +x ./kubectl
        mv ./kubectl ~/.local/bin/kubectl
        echo "✅ kubectl installed to ~/.local/bin (add to PATH if needed)"
        echo "💡 Run: export PATH=\$PATH:~/.local/bin"
    else
        echo "✅ kubectl already installed"
    fi
else
    echo "⚠️  Please install kubectl manually for your OS"
fi

echo "✅ Backend dependencies installed (including WorkOS 5.24.0)"
# cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend || exit
npm install

# Now build frontend
echo "🔨 Building frontend..."
npm run build

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
