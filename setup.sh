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
python -m pip install "skypilot[ssh]"
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

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
npm install lucide-react
cd ..
npm install

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
