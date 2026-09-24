# Croww Spatial Walkthrough — GPU Reconstruction Worker

This standalone Python microservice processes walkthrough video captures into interactive 3D Gaussian Splats (`.splat` / `.ksplat`) for the Croww property platform.

## Architecture

```
Croww App (Phone Recording / Upload)
    ↓
Firebase Storage (property_spatial/ private source)
    ↓
Cloud Function (onSpatialJobCreated)
    ↓ Signed source read URL + upload URLs
GPU Worker (/v1/jobs/{jobId})
    ↓
FFmpeg (2 fps keyframe extraction)
    ↓
COLMAP / Nerfstudio (Pose estimation)
    ↓
Splatfacto / gsplat (Gaussian Splatting training)
    ↓
Optimization (mobile <= 25MB, desktop, poster)
    ↓
Quality Gate (camera count, frames, byte sizes)
    ↓
GCS Upload (property_spatial_public/ derivatives)
    ↓
Cloud Function Callback (/spatialWorkerCallback)
    ↓
Firestore (status: READY, spatialTourAvailable: true)
    ↓
Croww Spatial Viewer (WebView / Web lazy viewer)
```

## Running Locally with Docker

### 1. Build the Docker Image
```bash
cd spatial-worker
docker build -t croww-spatial-worker:latest .
```

### 2. Run the Container
```bash
docker run -d \
  --name croww-spatial-worker \
  --gpus all \
  -p 8080:8080 \
  -e SPATIAL_WORKER_SECRET="your-staging-secret" \
  -e SPATIAL_TARGET_FPS=2 \
  -e SPATIAL_MAX_TRAIN_STEPS=5000 \
  -e SPATIAL_MOBILE_MAX_ASSET_BYTES=26214400 \
  croww-spatial-worker:latest
```

*(Note: On systems without an NVIDIA GPU, omit `--gpus all` and set `SPATIAL_MOCK_PIPELINE=1` for testing).*

### 3. Check Health
```bash
curl http://localhost:8080/health
```
Expected response:
```json
{
  "status": "ok",
  "service": "spatial-worker",
  "version": "1.0.0",
  "active_jobs": 0
}
```

### 4. Submit a Job
```bash
curl -X POST http://localhost:8080/v1/jobs/test_job_1 \
  -H "Content-Type: application/json" \
  -H "x-worker-secret: your-staging-secret" \
  -d '{
    "jobId": "test_job_1",
    "mediaId": "media_abc123",
    "propertyId": "prop_xyz789",
    "sourceUrl": "https://storage.googleapis.com/.../input_walkthrough.mp4?signedParams",
    "uploadUrls": {
      "mobile": "https://storage.googleapis.com/.../mobile.splat?signedParams",
      "desktop": "https://storage.googleapis.com/.../desktop.splat?signedParams",
      "poster": "https://storage.googleapis.com/.../poster.jpg?signedParams"
    },
    "outputPaths": {
      "mobile": "property_spatial_public/media_abc123/mobile.splat",
      "desktop": "property_spatial_public/media_abc123/desktop.splat",
      "poster": "property_spatial_public/media_abc123/poster.jpg"
    },
    "callbackUrl": "https://us-central1-croww-staging-2026.cloudfunctions.net/spatialWorkerCallback"
  }'
```

## Running Unit Tests

```bash
cd spatial-worker
python3 -m pytest tests/
```

## Quality Gate Criteria

The pipeline enforces Phase 8 Quality Gate checks before finalizing any asset:
1. Minimum 20 extracted keyframes.
2. Minimum 20 successfully registered camera poses.
3. Non-empty mobile splat derivative within the 25 MB budget.
4. Non-empty desktop splat derivative.
5. Valid poster JPEG generated.
