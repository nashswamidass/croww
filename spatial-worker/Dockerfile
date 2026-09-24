# Croww Spatial Walkthrough GPU Worker Dockerfile
# Provides CUDA, FFmpeg, COLMAP, Nerfstudio (splatfacto / gsplat)

FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies: FFmpeg, COLMAP, Git, Python
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ffmpeg \
    colmap \
    python3 \
    python3-pip \
    python3-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch with CUDA 12.1 support
RUN python3 -m pip install --no-cache-dir \
    torch==2.2.1 torchvision==0.17.1 --index-url https://download.pytorch.org/whl/cu121

# Install gsplat and Nerfstudio
RUN python3 -m pip install --no-cache-dir gsplat==0.1.8 nerfstudio==1.1.0

# Copy worker application
COPY pyproject.toml .
RUN python3 -m pip install --no-cache-dir -e .

COPY . .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
