# Multi-stage Dockerfile for Lattice Full-Stack Application

# Stage 1: Build the React frontend
FROM node:20 AS frontend-builder

# Stage 2: Python backend setup
FROM python:3.11-slim AS backend

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PORT=3000

# Set work directory
WORKDIR /app

# Copy root package.json and package-lock.json for dev scripts
COPY package*.json ./

# Install system dependencies and Node.js 20
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy setup script and run it
COPY setup.sh ./
COPY backend/ ./backend/
COPY frontend/ ./frontend/
RUN chmod +x setup.sh && ./setup.sh

# # Copy built frontend from the previous stage
# COPY --from=frontend-builder /app/frontend/build ./frontend/build

# Copy and setup startup script
COPY start.sh ./
RUN chmod +x start.sh

# Expose backend port
EXPOSE 8000

# Expose frontend port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/').raise_for_status()" || exit 1

# Run start.sh as the container entrypoint
CMD ["./start.sh"]

