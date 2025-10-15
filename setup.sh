#!/bin/bash

# Transformer Lab GPU Orchestration Setup Script

echo "🚀 Setting up Transformer Lab GPU Orchestration..."

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
uv venv --seed --python 3.10
source .venv/bin/activate
uv pip install .
echo "✅ Backend dependencies installed"

# Run database migrations
echo "🗄️  Running database migrations..."
cd src/lattice || exit
alembic upgrade head
cd ../.. || exit
echo "✅ Database migrations completed"

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

# Install netcat-openbsd and rsync
echo "📦 Installing netcat-openbsd and rsync..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    if ! which netcat &> /dev/null || ! which socat &> /dev/null || ! which rsync &> /dev/null; then
        if command -v brew &> /dev/null; then
            brew install netcat socat rsync
            echo "✅ netcat, socat, and rsync installed"
        else
            echo "⚠️  Homebrew not found. Please install netcat, socat, and rsync manually."
        fi
    else
        echo "✅ netcat, socat, and rsync already installed"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    if ! which netcat &> /dev/null || ! which rsync &> /dev/null; then
        if command -v apt &> /dev/null; then
            sudo apt update
            sudo apt install -y netcat-openbsd rsync
            echo "✅ netcat-openbsd and rsync installed"
        else
            echo "⚠️  apt not found. Please install netcat-openbsd and rsync manually."
        fi
    else
        echo "✅ netcat and rsync already installed"
    fi
else
    echo "⚠️  Please install netcat-openbsd and rsync manually for your OS"
fi

echo "✅ Backend dependencies installed"

# Check if required environment variables are set
if [ -f .env ]; then
    source .env
fi

# Now that we know the .env file exists, copy it exactly as is
# to frontend/.env
echo "📄 Copying .env to frontend/.env..."
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
