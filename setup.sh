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
uv pip install .
echo "✅ Backend dependencies installed (including WorkOS 5.24.0 and SkyPilot with kubernetes/runpod extras)"

# Run database migrations
echo "🗄️  Running database migrations..."
alembic upgrade head
echo "✅ Database migrations completed"

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

# Check if required environment variables are set
if [ -f .env ]; then
    source .env
fi

# if [ -z "$WORKOS_API_KEY" ] || [ -z "$WORKOS_CLIENT_ID" ]; then
#     echo "❌ Error: WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables must be set"
#     echo "Please set these variables when running the container:"
#     echo "docker run -e WORKOS_API_KEY=your_key -e WORKOS_CLIENT_ID=your_client_id -p 8000:8000 lattice"
#     exit 1
# fi

# Now that we know the .env file exists, copy it exactly as is
# to backend/.env and frontend/.env
echo "📄 Copying .env to backend/.env and frontend/.env..."
cp .env backend/.env
cp .env frontend/.env

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
echo "1. Start the backend server: ./start.sh --dev"
echo "2. Start the frontend server: cd frontend && npm run dev"
