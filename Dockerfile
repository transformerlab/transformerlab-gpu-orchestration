# Multi-stage Dockerfile for Lattice Full-Stack Application with SkyPilot

# Use miniconda3 as base for better Python environment management (required for SkyPilot)
FROM continuumio/miniconda3:23.3.1-0

ARG DEBIAN_FRONTEND=noninteractive
# Detect architecture for kubectl installation
ARG TARGETARCH

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend

# Set work directory
WORKDIR /app

# Copy root package.json for dev scripts
COPY package*.json ./

# Install system dependencies including SSH, Node.js 20, kubectl, and other SkyPilot requirements
RUN apt update -y && \
    apt install -y \
    build-essential \
    curl \
    apt-transport-https \
    ca-certificates \
    gnupg \
    git \
    gcc \
    rsync \
    sudo \
    patch \
    openssh-server \
    pciutils \
    nano \
    fuse \
    socat \
    netcat-openbsd \
    autossh \
    jq \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/* \
    && apt remove -y python3 \
    && conda init

# Setup SSH server for SkyPilot cluster communication
RUN mkdir -p /var/run/sshd && \
    sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd && \
    cd /etc/ssh/ && \
    ssh-keygen -A

# Setup new user named sky and add to sudoers with conda path
RUN useradd -m -s /bin/bash sky && \
    echo "sky ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers && \
    echo 'Defaults        secure_path="/opt/conda/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"' > /etc/sudoers.d/sky

# Switch to sky user for SkyPilot setup
USER sky

# Set HOME environment variable for sky user
ENV HOME=/home/sky

# Set current working directory
WORKDIR /home/sky

SHELL ["/bin/bash", "-c"]

# Install uv and setup SkyPilot environment
RUN conda init && \
    export PIP_DISABLE_PIP_VERSION_CHECK=1 && \
    curl -LsSf https://astral.sh/uv/install.sh | sh && \
    $HOME/.local/bin/uv venv ~/skypilot-runtime --seed --python=3.10 && \
    source ~/skypilot-runtime/bin/activate && \
    $HOME/.local/bin/uv pip install 'skypilot[remote,kubernetes]' 'ray[default]==2.9.3' 'pycryptodome==3.12.0' && \
    ARCH=${TARGETARCH:-$(case "$(uname -m)" in \
    "x86_64") echo "amd64" ;; \
    "aarch64") echo "arm64" ;; \
    *) echo "$(uname -m)" ;; \
    esac)} && \
    curl -LO "https://dl.k8s.io/release/v1.31.6/bin/linux/$ARCH/kubectl" && \
    chmod +x kubectl && \
    mkdir -p $HOME/.local/bin && \
    mv kubectl $HOME/.local/bin/ && \
    echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.bashrc

# Copy application files to /app (switching back to /app for application)
WORKDIR /app
USER root

# Copy setup script and application files
COPY setup.sh ./
COPY backend/ ./backend/
COPY frontend/ ./frontend/
RUN chmod +x setup.sh

# Run setup script to install application dependencies
RUN ./setup.sh

# Add both sky venv and backend venv to PATH
ENV PATH="/home/sky/skypilot-runtime/bin:/app/backend/.venv/bin:$PATH"

# Copy and setup startup script
COPY start.sh ./
RUN chmod +x start.sh

# Expose port 8000 for the combined frontend/backend
EXPOSE 8000
# Expose port 46580 for skypilot
EXPOSE 46580

# Switch back to sky user for SkyPilot operations
USER sky
WORKDIR /home/sky

# Check Skypilot installation
RUN sky --version || (echo "Skypilot not installed, skipping..." && exit 0)

# Run a sky check to see if something else needs to be installed for ssh
RUN sky check || (echo "Sky check failed, printing log file contents:" && cat ~/.sky/api_server/server.log 2>/dev/null || echo "Log file not found or empty")

# Switch back to root for final setup
USER root
WORKDIR /app

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/v1/').raise_for_status()" || exit 1

# Run start.sh as the container entrypoint
CMD ["./start.sh"]

