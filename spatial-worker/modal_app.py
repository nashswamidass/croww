"""
Croww Spatial Walkthrough — Modal Serverless GPU Deployment
Deploys spatial-worker to an NVIDIA A10G / L4 GPU on Modal (modal.com).

Cost profile:
- Zero idle cost (scales to 0 when inactive).
- ~$0.0003 / second during active reconstruction (~$0.03 - $0.08 per walkthrough).

Usage:
  pip install modal
  modal setup
  modal deploy spatial-worker/modal_app.py
"""
import os
import modal

app = modal.App("croww-spatial-worker")

# Define container image with CUDA 12.1, FFmpeg, COLMAP, Nerfstudio, and gsplat
image = (
    modal.Image.from_registry("nvidia/cuda:12.1.1-devel-ubuntu22.04", add_python="3.10")
    .apt_install("git", "cmake", "build-essential", "ffmpeg", "colmap", "curl")
    .pip_install(
        "torch==2.2.1",
        "torchvision==0.17.1",
        extra_index_url="https://download.pytorch.org/whl/cu121",
    )
    .pip_install("gsplat==0.1.8", "nerfstudio==1.1.0")
    .pip_install("fastapi>=0.110.0", "uvicorn>=0.28.0", "pydantic>=2.6.0", "httpx>=0.27.0", "pillow>=10.2.0")
    .add_local_dir("spatial-worker/pipeline", remote_path="/root/pipeline")
)

secret = modal.Secret.from_name("croww-spatial-secret", required_keys=["SPATIAL_WORKER_SECRET"])

@app.function(
    image=image,
    gpu="A10G", # 24GB VRAM
    timeout=900, # 15 minutes max per reconstruction
    secrets=[secret] if modal.Secret.from_name("croww-spatial-secret").exists() else [],
)
@modal.asgi_app()
def fastapi_app():
    from app import app as web_app
    return web_app
