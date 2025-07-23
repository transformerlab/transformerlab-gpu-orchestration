#!/bin/bash
set -e

# Check if required environment variables are set
if [ -z "$WORKOS_API_KEY" ] || [ -z "$WORKOS_CLIENT_ID" ]; then
    echo "❌ Error: WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables must be set"
    echo "Please set these variables when running the container:"
    echo "docker run -e WORKOS_API_KEY=your_key -e WORKOS_CLIENT_ID=your_client_id -p 8000:8000 lattice"
    exit 1
fi


# Set default values for optional environment variables
export WORKOS_REDIRECT_URI=${WORKOS_REDIRECT_URI:-"http://localhost:8000/auth/callback"}
export WORKOS_COOKIE_PASSWORD=${WORKOS_COOKIE_PASSWORD:-$(openssl rand -base64 32)}
export DEBUG=${DEBUG:-"False"}

# Set API base URL for frontend from environment variable, default to http://localhost:8000
export VITE_API_BASE_URL=${VITE_API_BASE_URL:-"http://localhost:8000"}
echo "VITE_API_BASE_URL=${VITE_API_BASE_URL}" > /app/frontend/.env

echo "🚀 Starting Lattice application using npm run dev..."
echo "📦 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:8000"
echo "📝 API Documentation: http://localhost:8000/docs"
echo "🔑 WorkOS Client ID: ${WORKOS_CLIENT_ID}"
echo "🔗 Redirect URI: ${WORKOS_REDIRECT_URI}"

# Start both frontend and backend using the dev script
cd /app
exec npm run dev
