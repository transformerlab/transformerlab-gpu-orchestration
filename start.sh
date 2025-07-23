#!/bin/bash
set -e

# Check if required environment variables are set
if [ -f .env ]; then
    source .env
fi

if [ -z "$WORKOS_API_KEY" ] || [ -z "$WORKOS_CLIENT_ID" ]; then
    echo "❌ Error: WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables must be set"
    echo "Please set these variables when running the container:"
    echo "docker run -e WORKOS_API_KEY=your_key -e WORKOS_CLIENT_ID=your_client_id -p 8000:8000 lattice"
    exit 1
fi

# Set default values for optional environment variables

# Check for --dev parameter
if [[ "$1" == "--dev" ]]; then
    export DEBUG="True"
    export WORKOS_REDIRECT_URI="http://localhost:8000/api/v1/auth/callback"
    export FRONTEND_URL="http://localhost:3000"
else
    export WORKOS_REDIRECT_URI=${WORKOS_REDIRECT_URI:-"http://localhost:8000/api/v1/auth/callback"}
    export DEBUG=${DEBUG:-"False"}
fi
export WORKOS_COOKIE_PASSWORD=${WORKOS_COOKIE_PASSWORD:-$(openssl rand -base64 32)}

echo "🚀 Starting Lattice application..."
if [ -n "$FRONTEND_URL" ]; then
    echo "📦 Frontend: $FRONTEND_URL"
else
    echo "📦 Frontend: http://localhost:8000"
fi
echo "🔧 Backend API: http://localhost:8000/api/v1"
echo "📝 API Documentation: http://localhost:8000/docs"
echo "🔑 WorkOS Client ID: ${WORKOS_CLIENT_ID}"
echo "🔗 Redirect URI: ${WORKOS_REDIRECT_URI}"

# Start SSH service for SkyPilot cluster communication
echo "🔑 Starting SSH service for SkyPilot..."
sudo service ssh start

# Initialize SkyPilot as sky user
echo "🌤️ Initializing SkyPilot..."
sudo -u sky bash -c "source /home/sky/skypilot-runtime/bin/activate && sky check" || echo "⚠️ SkyPilot check failed, continuing..."

# Start SkyPilot dashboard in background as sky user
echo "📊 Starting SkyPilot dashboard..."
sudo -u sky bash -c "source /home/sky/skypilot-runtime/bin/activate && sky dashboard --address 0.0.0.0 --port 46580" &

echo "🔄 Activating Python virtual environment..."
cd ./backend

# Activate the uv virtual environment
source .venv/bin/activate

echo "✅ Virtual environment activated"
python main.py