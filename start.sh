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


# RUN sky stuff for proper setup
export PATH="./backend/.venv/bin:$PATH"
sky check

# Set environment variables based on --dev parameter
if [[ "$1" == "--dev" ]]; then
    export DEBUG="True"
    export WORKOS_REDIRECT_URI="http://localhost:8000/api/v1/auth/callback"
    export FRONTEND_URL="http://localhost:3000"
    # In development mode, use a fixed, known cookie password for convenience
    export WORKOS_COOKIE_PASSWORD="uX2+8A0+KO0UFR131I6eyehwZmZSt2V5wul6x5QiJYU="
else
    export WORKOS_REDIRECT_URI=${WORKOS_REDIRECT_URI:-"http://localhost:8000/api/v1/auth/callback"}
    export DEBUG=${DEBUG:-"False"}
    # In production (or non-dev), ensure WORKOS_COOKIE_PASSWORD is set securely
    if [ -z "$WORKOS_COOKIE_PASSWORD" ]; then
        # If .env already has a value, use it
        if grep -q '^WORKOS_COOKIE_PASSWORD=' .env 2>/dev/null; then
            export WORKOS_COOKIE_PASSWORD=$(grep '^WORKOS_COOKIE_PASSWORD=' .env | cut -d '=' -f2-)
        else
            # Otherwise, generate a new secure password, save to .env, and export it
            GENERATED_COOKIE_PASSWORD=$(openssl rand -base64 32)
            echo "WORKOS_COOKIE_PASSWORD=$GENERATED_COOKIE_PASSWORD" >> .env
            export WORKOS_COOKIE_PASSWORD=$GENERATED_COOKIE_PASSWORD
        fi
    fi
fi

echo "🚀 Starting Lattice application using npm run dev..."
if [ -n "$FRONTEND_URL" ]; then
    echo "📦 Frontend: $FRONTEND_URL"
else
    echo "📦 Frontend: http://localhost:8000"
fi
echo "🔧 Backend API: http://localhost:8000/api/v1"
echo "📝 API Documentation: http://localhost:8000/docs"
echo "🔑 WorkOS Client ID: ${WORKOS_CLIENT_ID}"
echo "🔗 Redirect URI: ${WORKOS_REDIRECT_URI}"

echo "🔄 Activating Python virtual environment..."
cd ./backend

# Activate the uv virtual environment
source .venv/bin/activate

echo "✅ Virtual environment activated"
python main.py