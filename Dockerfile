# Multi-stage Dockerfile for Lattice Full-Stack Application

# Stage 1: Build the React frontend
FROM node:20 AS frontend-builder

# Stage 2: Python backend setup - Using Ubuntu for better SSH/SkyPilot support
FROM ubuntu:22.04 AS backend

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    DEBIAN_FRONTEND=noninteractive

# Set work directory
WORKDIR /app

# Copy root package.json and package-lock.json for dev scripts
COPY package*.json ./

# Install system dependencies including Python 3.11, SSH, Node.js 20, kubectl, socat, and uv
RUN apt-get update && apt-get install -y \
    # Python and build tools
    python3.11 \
    python3.11-dev \
    python3.11-venv \
    python3-pip \
    # SSH and networking tools (required for SkyPilot)
    openssh-client \
    openssh-server \
    ssh \
    rsync \
    # Build and development tools
    build-essential \
    curl \
    wget \
    git \
    apt-transport-https \
    ca-certificates \
    gnupg \
    software-properties-common \
    # Network utilities
    socat \
    netcat-openbsd \
    iputils-ping \
    jq \
    rsync \
    vim \
    tini \
    autossh \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.31/deb/Release.key | gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg \
    && chmod 644 /etc/apt/keyrings/kubernetes-apt-keyring.gpg \
    && echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.31/deb/ /' | tee /etc/apt/sources.list.d/kubernetes.list \
    && chmod 644 /etc/apt/sources.list.d/kubernetes.list \
    && apt-get update \
    && apt-get install -y kubectl \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

# Create symlink for python command
RUN ln -s /usr/bin/python3.11 /usr/bin/python

# Configure SSH for SkyPilot
RUN mkdir -p /root/.ssh \
    && chmod 700 /root/.ssh \
    && ssh-keygen -t rsa -b 4096 -f /root/.ssh/id_rsa -N "" \
    && cat /root/.ssh/id_rsa.pub >> /root/.ssh/authorized_keys \
    && chmod 600 /root/.ssh/authorized_keys \
    && echo "Host *\n\tStrictHostKeyChecking no\n\tUserKnownHostsFile=/dev/null" > /root/.ssh/config

# Add uv to PATH
ENV PATH="/root/.local/bin:$PATH"

# Copy setup script and run it
COPY setup.sh ./
COPY backend/ ./backend/
COPY frontend/ ./frontend/
RUN chmod +x setup.sh && ./setup.sh

# Add sky command to PATH
ENV PATH="/app/backend/.venv/bin:$PATH"


# Copy and setup startup script
COPY start.sh ./
RUN chmod +x start.sh

# Expose port 8000 for the combined frontend/backend
EXPOSE 8000
# Expose port 46580 for skypilot
EXPOSE 46580

# Check Skypilot installation and run
RUN sky --version || (echo "Skypilot not installed, skipping..." && exit 0)

# Run a sky check to see if something else needs to be installed for ssh
RUN sky check || (echo "Sky check failed, printing log file contents:" && cat ~/.sky/api_server/server.log 2>/dev/null || echo "Log file not found or empty")

# Create RunPod config directory
RUN mkdir -p /root/.runpod

# # Make file at /root/.sky/ssh_node_pools.yaml
# RUN mkdir -p /root/.sky && touch /root/.sky/ssh_node_pools.yaml

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/v1/').raise_for_status()" || exit 1

# Run start.sh as the container entrypoint
CMD ["./start.sh"]

