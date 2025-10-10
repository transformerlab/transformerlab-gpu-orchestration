#!/bin/bash
set -e

# Check if required environment variables are set
if [ -f .env ]; then
    source .env
fi
# default port (can be overridden via ENV)
export PORT=${PORT:-8000}

if [ -z "$AUTH_API_KEY" ] || [ -z "$AUTH_CLIENT_ID" ]; then
    echo "❌ Error: AUTH_API_KEY and AUTH_CLIENT_ID environment variables must be set"
    echo "Please set these variables when running the container:"
    echo "docker run -e AUTH_API_KEY=your_key -e AUTH_CLIENT_ID=your_client_id -p 8000:8000 lattice"
    exit 1
fi

# Set environment variables based on --dev parameter
if [[ "$1" == "--dev" ]]; then
    export DEBUG="True"
    export AUTH_REDIRECT_URI="http://localhost:8000/api/v1/auth/callback"
    export FRONTEND_URL="http://localhost:3000"
    # In development mode, use a fixed, known cookie password for convenience
    export AUTH_COOKIE_PASSWORD="uX2+8A0+KO0UFR131I6eyehwZmZSt2V5wul6x5QiJYU="

    # Dev-friendly security defaults
    export COOKIE_SECURE=${COOKIE_SECURE:-false}
    export COOKIE_SAMESITE=${COOKIE_SAMESITE:-lax}
    export CSRF_ENABLED=${CSRF_ENABLED:-false}
    # CORS explicit fallback to frontend URL
    export CORS_ALLOW_ORIGINS=${CORS_ALLOW_ORIGINS:-$FRONTEND_URL}
    # WebSocket default: do not allow null Origin unless explicitly set
    export WS_ALLOW_NULL_ORIGIN=${WS_ALLOW_NULL_ORIGIN:-false}
else
    echo "🔨 Building frontend..."
    cd frontend || exit
    npm run build
    echo "✅ Frontend built successfully"
    export FRONTEND_URL=${FRONTEND_URL:-"http://localhost:8000"}
    cd ..

    echo "Now build the backend..."
    # I know it is weird to build the backend again but skypilot hardcodes the path to python
    # so if you are building locally, and then switch to docker, the sky command will not work
    # Create Python virtual environment and install backend dependencies
    # echo "📦 Creating Python virtual environment with uv..."
    # echo "📦 Installing backend dependencies with uv..."
    # uv venv --seed --python 3.10 --clear
    # source .venv/bin/activate
    # uv pip install .
    # echo "✅ Backend dependencies installed"

    # Run database migrations
    # echo "🗄️  Running database migrations..."
    # pushd src/lattice
    # alembic upgrade head
    # popd
    # echo "✅ Database migrations completed"

    export AUTH_REDIRECT_URI=${AUTH_REDIRECT_URI:-"http://localhost:8000/api/v1/auth/callback"}
    export DEBUG=${DEBUG:-"False"}
    # In production (or non-dev), ensure AUTH_COOKIE_PASSWORD is set securely
    if [ -z "$AUTH_COOKIE_PASSWORD" ]; then
        # If .env already has a value, use it
        if grep -q '^AUTH_COOKIE_PASSWORD=' .env 2>/dev/null; then
            export AUTH_COOKIE_PASSWORD=$(grep '^AUTH_COOKIE_PASSWORD=' .env | cut -d '=' -f2-)
        else
            # Otherwise, generate a new secure password, save to .env, and export it
            GENERATED_COOKIE_PASSWORD=$(openssl rand -base64 32)
            echo "AUTH_COOKIE_PASSWORD=$GENERATED_COOKIE_PASSWORD" >> .env
            export AUTH_COOKIE_PASSWORD=$GENERATED_COOKIE_PASSWORD
        fi
    fi

    # Prod-friendly security defaults
    if [ -z "$COOKIE_SECURE" ]; then
        if [[ "$FRONTEND_URL" == https://* ]]; then
            export COOKIE_SECURE=true
        else
            export COOKIE_SECURE=false
        fi
    fi
    export COOKIE_SAMESITE=${COOKIE_SAMESITE:-lax}
    export CSRF_ENABLED=${CSRF_ENABLED:-true}
    # CORS explicit fallback to frontend URL
    export CORS_ALLOW_ORIGINS=${CORS_ALLOW_ORIGINS:-$FRONTEND_URL}
    # WebSocket default: do not allow null Origin unless explicitly set
    export WS_ALLOW_NULL_ORIGIN=${WS_ALLOW_NULL_ORIGIN:-false}
fi

# Preflight validation: SameSite=None requires Secure=true (fail fast)
# Use portable lowercase conversion (Bash 3 compatible)
samesite_lc=$(printf '%s' "${COOKIE_SAMESITE:-}" | tr '[:upper:]' '[:lower:]')
cookiesecure_lc=$(printf '%s' "${COOKIE_SECURE:-}" | tr '[:upper:]' '[:lower:]')
if [[ "$samesite_lc" == "none" ]] && [[ "$cookiesecure_lc" != "true" && "$COOKIE_SECURE" != "1" ]]; then
    echo "❌ Misconfiguration: COOKIE_SAMESITE=None requires COOKIE_SECURE=true"
    exit 1
fi

if [ -n "$FRONTEND_URL" ]; then
    echo "📦 Frontend: $FRONTEND_URL"
else
    echo "📦 Frontend: http://localhost:$PORT"
fi
echo "🔧 Backend API: http://localhost:$PORT/api/v1"
echo "📝 API Documentation: http://localhost:$PORT/docs"
echo "🔑 AUTH Client ID: ${AUTH_CLIENT_ID}"
echo "🔗 Redirect URI: ${AUTH_REDIRECT_URI}"
echo "🍪 Cookies: secure=${COOKIE_SECURE} samesite=${COOKIE_SAMESITE} csrf_enabled=${CSRF_ENABLED}"
echo "🌐 CORS Allow Origins: ${CORS_ALLOW_ORIGINS}"
echo "🛰️  WS Allow Null Origin: ${WS_ALLOW_NULL_ORIGIN}"

echo "🔄 Activating Python virtual environment..."

# RUN sky stuff for proper setup
export PATH=".venv/bin:$PATH"
which sky
echo $PATH
sky check

echo "✅ Virtual environment activated"

# Start SSH proxy server in the background only if START_SSH_PROXY_SERVER is true
if [[ "$START_SSH_PROXY_SERVER" == "true" ]]; then
    echo "🔄 Starting SSH proxy server..."
    cd src/lattice
    uv run ssh_proxy_server/main.py &
    SSH_PROXY_PID=$!
    cd -
    trap 'echo "🔴 Killing SSH proxy server..."; kill $SSH_PROXY_PID' EXIT
else
    echo "🚫 START_SSH_PROXY_SERVER is not set to true. Skipping SSH proxy server startup."
fi

# Start the application with uvicorn instead of running main.py directly
if [[ "$DEBUG" == "True" ]]; then
    uv run ./src/lattice/main.py --host 0.0.0.0 --port "$PORT" --reload
else
    uv run ./src/lattice/main.py --host 0.0.0.0 --port "$PORT"
fi
