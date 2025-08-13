#!/bin/bash

# Docker Build and Run Script for Lattice

set -e

echo "🐳 Lattice Docker Build & Run Script"
echo "==================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is required but not installed."
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
    echo "📝 Please edit .env file and add your auth credentials:"
    echo "   - AUTH_API_KEY"
    echo "   - AUTH_CLIENT_ID"
        echo ""
        echo "Then run this script again."
        exit 1
    else
    echo "❌ No .env template found. Please create a .env file with your auth credentials."
        exit 1
    fi
fi

# Source the .env file
source .env

# Check if required environment variables are set
if [ -z "$AUTH_API_KEY" ] || [ -z "$AUTH_CLIENT_ID" ]; then
    echo "❌ Required environment variables not set in .env file:"
    echo "   - AUTH_API_KEY"
    echo "   - AUTH_CLIENT_ID"
    echo ""
    echo "Please update your .env file with valid auth credentials."
    exit 1
fi

echo "✅ Environment variables configured"

# Check what action to perform
ACTION=${1:-"build-and-run"}

case $ACTION in
    "build")
        echo "🔨 Building Docker image..."
        docker build -t lattice .
        echo "✅ Image built successfully: lattice"
        ;;
    "run")
        echo "🚀 Running Lattice container..."
        docker run -p 8000:8000 -p 3000:3000 --env-file .env --name lattice-app lattice
        ;;
    "build-and-run"|"")
        echo "🔨 Building Docker image..."
        docker build -t lattice .
        echo "✅ Image built successfully"
        
        echo "🚀 Starting Lattice application..."
        echo "📍 Frontend:        http://localhost:3000"
        echo "📍 Backend (API):   http://localhost:8000"
        echo "📚 API Documentation: http://localhost:8000/docs"
        echo "🛑 Press Ctrl+C to stop"
        echo ""
        
        # Stop and remove existing container if it exists
        docker stop lattice-app 2>/dev/null || true
        docker rm lattice-app 2>/dev/null || true
        
        # Run the container
        docker run -p 8000:8000 -p 3000:3000 --env-file .env --name lattice-app lattice
        ;;
    "compose")
        echo "🔧 Using Docker Compose..."
        if [ ! -f "docker-compose.yml" ]; then
            echo "❌ docker-compose.yml not found"
            exit 1
        fi
        docker-compose up -d
        echo "✅ Application started with Docker Compose"
        echo "📍 Frontend:        http://localhost:3000"
        echo "📍 Backend (API):   http://localhost:8000"
        ;;
    "stop")
        echo "🛑 Stopping Lattice containers..."
        docker stop lattice-app 2>/dev/null || true
        docker-compose down 2>/dev/null || true
        echo "✅ Containers stopped"
        ;;
    "clean")
        echo "🧹 Cleaning up Docker resources..."
        docker stop lattice-app 2>/dev/null || true
        docker rm lattice-app 2>/dev/null || true
        docker rmi lattice 2>/dev/null || true
        docker-compose down 2>/dev/null || true
        echo "✅ Cleanup complete"
        ;;
    *)
        echo "Usage: $0 [build|run|build-and-run|compose|stop|clean]"
        echo ""
        echo "Commands:"
        echo "  build          - Build the Docker image only"
        echo "  run            - Run the existing Docker image"
        echo "  build-and-run  - Build and run (default)"
        echo "  compose        - Use Docker Compose"
        echo "  stop           - Stop running containers"
        echo "  clean          - Stop and remove all containers and images"
        ;;
esac
