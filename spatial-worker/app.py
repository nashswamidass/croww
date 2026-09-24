from __future__ import annotations
import os
import shutil
import time
import logging
import asyncio
from pathlib import Path
from typing import Optional, Dict

import httpx
from fastapi import FastAPI, Header, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field

from pipeline import (
    download_source,
    extract_keyframes,
    run_reconstruction,
    train_gaussian_splat,
    optimize_splat_variants,
    generate_poster,
    validate_reconstruction_outputs,
    upload_outputs,
)
from pipeline.validation import QualityGateError

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [spatial-worker] %(message)s"
)
logger = logging.getLogger("spatial-worker")

app = FastAPI(title="Croww Spatial Walkthrough Worker", version="1.0.0")

SPATIAL_WORKER_SECRET = os.getenv("SPATIAL_WORKER_SECRET", "")
SPATIAL_CALLBACK_URL = os.getenv("SPATIAL_CALLBACK_URL", "")

# In-memory job state tracker for idempotency
# Map[job_id, {"status": str, "stage": str, "timestamp": float}]
JOB_REGISTRY: Dict[str, dict] = {}

class JobPayload(BaseModel):
    jobId: str
    mediaId: str
    propertyId: str
    sourceUrl: str
    uploadUrls: Dict[str, str] = Field(default_factory=dict)
    outputPaths: Dict[str, str] = Field(default_factory=dict)
    callbackUrl: Optional[str] = None

async def send_callback(callback_url: str, payload: dict):
    """Sends status/progress/completion payload to Croww Cloud Function."""
    if not callback_url:
        logger.warning("No callback URL provided; skipping callback")
        return
    try:
        headers = {
            "Content-Type": "application/json",
            "x-worker-secret": SPATIAL_WORKER_SECRET,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(callback_url, json=payload, headers=headers)
            logger.info(f"Callback sent to {callback_url} -> HTTP {res.status_code}")
    except Exception as e:
        logger.error(f"Failed to send callback to {callback_url}: {e}")

async def process_spatial_job(job: JobPayload):
    """
    Asynchronous end-to-end reconstruction execution worker.
    """
    job_id = job.jobId
    media_id = job.mediaId
    property_id = job.propertyId
    callback_url = job.callbackUrl or SPATIAL_CALLBACK_URL

    start_time = time.time()
    work_dir = Path(f"/tmp/croww_spatial_{job_id}")
    work_dir.mkdir(parents=True, exist_ok=True)

    JOB_REGISTRY[job_id]["status"] = "RUNNING"
    JOB_REGISTRY[job_id]["stage"] = "PREPARING"

    logger.info(f"Starting reconstruction pipeline for job {job_id} (media: {media_id})")

    try:
        # Phase 6: Frame Extraction
        await send_callback(callback_url, {
            "jobId": job_id,
            "mediaId": media_id,
            "status": "RUNNING",
            "stage": "PREPARING",
            "progress": 10,
        })
        video_path = await download_source(job.sourceUrl, work_dir)

        frames_dir = work_dir / "frames"
        keyframes = extract_keyframes(video_path, frames_dir)
        source_frame_count = len(keyframes)

        # Phase 7: COLMAP Pose Estimation / Reconstruction
        JOB_REGISTRY[job_id]["stage"] = "RECONSTRUCTING"
        await send_callback(callback_url, {
            "jobId": job_id,
            "mediaId": media_id,
            "status": "RUNNING",
            "stage": "RECONSTRUCTING",
            "progress": 30,
        })
        recon_dir = work_dir / "recon"
        recon_meta = run_reconstruction(frames_dir, recon_dir)
        registered_frame_count = recon_meta["registered_frames"]

        # Phase 7: Gaussian Splat Training
        JOB_REGISTRY[job_id]["stage"] = "SPLATTING"
        await send_callback(callback_url, {
            "jobId": job_id,
            "mediaId": media_id,
            "status": "RUNNING",
            "stage": "SPLATTING",
            "progress": 60,
        })
        train_dir = work_dir / "train"
        raw_splat_path = train_gaussian_splat(recon_dir, train_dir)

        # Phase 4: Output Variants & Poster Generation
        JOB_REGISTRY[job_id]["stage"] = "OPTIMIZING"
        await send_callback(callback_url, {
            "jobId": job_id,
            "mediaId": media_id,
            "status": "RUNNING",
            "stage": "OPTIMIZING",
            "progress": 80,
        })
        variants_dir = work_dir / "variants"
        variants = optimize_splat_variants(raw_splat_path, variants_dir)
        poster_path = generate_poster(frames_dir, variants_dir / "poster.jpg")

        # Phase 8: Quality Gate
        gate_res = validate_reconstruction_outputs(
            source_frame_count=source_frame_count,
            registered_camera_count=registered_frame_count,
            mobile_splat=variants["mobile"],
            desktop_splat=variants["desktop"],
            poster=poster_path,
        )

        # Phase 10: Upload Derivatives to pre-authorized signed URLs
        outputs = await upload_outputs(
            variants=variants,
            poster_path=poster_path,
            upload_urls=job.uploadUrls,
            output_paths=job.outputPaths,
        )

        # Finalize READY
        duration_sec = time.time() - start_time
        JOB_REGISTRY[job_id]["status"] = "READY"
        JOB_REGISTRY[job_id]["stage"] = "READY"

        logger.info(f"Job {job_id} completed successfully in {duration_sec:.1f}s")
        await send_callback(callback_url, {
            "jobId": job_id,
            "mediaId": media_id,
            "status": "READY",
            "stage": "READY",
            "progress": 100,
            "outputs": outputs,
            "reconstructionQuality": gate_res["quality"],
            "sourceFrameCount": source_frame_count,
            "registeredFrameCount": registered_frame_count,
            "provenance": {
                "type": "REAL_RECONSTRUCTION",
                "processor": "nerfstudio_splatfacto",
                "registeredFrames": registered_frame_count,
                "sourceFrameCount": source_frame_count,
            },
        })

    except QualityGateError as qe:
        logger.error(f"Job {job_id} failed quality gate: {qe}")
        JOB_REGISTRY[job_id]["status"] = "FAILED"
        JOB_REGISTRY[job_id]["stage"] = "FAILED"
        await send_callback(callback_url, {
            "jobId": job_id,
            "mediaId": media_id,
            "status": "FAILED",
            "stage": "FAILED",
            "publicError": qe.user_facing,
            "internalReason": str(qe),
        })

    except Exception as e:
        logger.exception(f"Job {job_id} encountered unexpected pipeline failure: {e}")
        JOB_REGISTRY[job_id]["status"] = "FAILED"
        JOB_REGISTRY[job_id]["stage"] = "FAILED"
        await send_callback(callback_url, {
            "jobId": job_id,
            "mediaId": media_id,
            "status": "FAILED",
            "stage": "FAILED",
            "publicError": "We couldn't create this walkthrough.",
            "internalReason": str(e),
        })

    finally:
        # Phase 30: Cleanup temporary files
        if os.getenv("SPATIAL_RETAIN_TEMP") != "1" and work_dir.exists():
            try:
                shutil.rmtree(work_dir)
                logger.info(f"Cleaned up temporary directory {work_dir}")
            except Exception as ce:
                logger.warning(f"Could not remove temp dir {work_dir}: {ce}")

@app.get("/health")
def health():
    """Liveness & readiness probe."""
    return {
        "status": "ok",
        "service": "spatial-worker",
        "version": "1.0.0",
        "active_jobs": sum(1 for j in JOB_REGISTRY.values() if j.get("status") == "RUNNING"),
    }

@app.post("/v1/jobs/{jobId}", status_code=status.HTTP_202_ACCEPTED)
async def submit_job(
    jobId: str,
    payload: JobPayload,
    background_tasks: BackgroundTasks,
    x_worker_secret: Optional[str] = Header(None),
):
    """
    Submits a reconstruction job.
    Idempotent: if job is already processing or completed, returns existing status.
    """
    # Authenticate caller
    if SPATIAL_WORKER_SECRET and x_worker_secret != SPATIAL_WORKER_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid worker secret",
        )

    if jobId != payload.jobId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Path jobId does not match payload jobId",
        )

    # Idempotency check (Phase 29)
    existing = JOB_REGISTRY.get(jobId)
    if existing:
        logger.info(f"Job {jobId} already submitted (status: {existing['status']})")
        return {
            "jobId": jobId,
            "status": existing["status"],
            "stage": existing.get("stage", "QUEUED"),
            "resumed": True,
        }

    JOB_REGISTRY[jobId] = {
        "status": "QUEUED",
        "stage": "QUEUED",
        "timestamp": time.time(),
    }

    # Queue async processing task
    background_tasks.add_task(process_spatial_job, payload)

    return {
        "jobId": jobId,
        "status": "QUEUED",
        "stage": "QUEUED",
        "accepted": True,
    }
