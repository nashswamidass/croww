#!/bin/bash
set -euo pipefail

# ==============================================================================
# Croww Spatial Walkthrough — GCP GPU Worker Deployment Script
# Targets: croww-staging-2026 (STAGING ONLY)
# Hardware: NVIDIA L4 (24GB VRAM, Ada Lovelace) or NVIDIA T4 (16GB VRAM, Turing)
# Estimated Cost:
#   - NVIDIA T4: ~$0.35 / hour
#   - NVIDIA L4: ~$0.70 / hour
# ==============================================================================

PROJECT_ID="croww-staging-2026"
ZONE="us-central1-a"
INSTANCE_NAME="croww-spatial-worker-staging"
MACHINE_TYPE="g2-standard-4" # 4 vCPUs, 16GB RAM, 1x NVIDIA L4 (24GB VRAM)
ACCELERATOR="type=nvidia-l4,count=1"

echo "=== Deploying Croww Spatial Worker to GCP Compute Engine ($PROJECT_ID) ==="

# Check gcloud CLI
if ! command -v gcloud &> /dev/null; then
    echo "ERROR: gcloud CLI is not installed on this machine."
    echo "Install gcloud or use Modal / RunPod for serverless GPU deployment."
    exit 1
fi

gcloud config set project "$PROJECT_ID"

# 1. Create GPU VM instance with Container-Optimized OS or Ubuntu Deep Learning VM
gcloud compute instances create "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --accelerator="$ACCELERATOR" \
    --image-family="common-cu121-debian-11" \
    --image-project="deeplearning-platform-release" \
    --boot-disk-size="100GB" \
    --boot-disk-type="pd-ssd" \
    --maintenance-policy="TERMINATE" \
    --restart-on-failure \
    --metadata="install-nvidia-driver=True" \
    --tags="http-server,https-server,spatial-worker"

# 2. Add firewall rule for port 8080
gcloud compute firewall-rules create "allow-spatial-worker-8080" \
    --project="$PROJECT_ID" \
    --allow=tcp:8080 \
    --target-tags="spatial-worker" \
    --description="Allow incoming traffic to Croww spatial reconstruction worker" || true

echo "=== Instance created. Configure Firebase Functions: ==="
echo "EXTERNAL_IP=\$(gcloud compute instances describe $INSTANCE_NAME --zone=$ZONE --format='get(networkInterfaces[0].accessConfigs[0].natIP)')"
echo "firebase functions:config:set spatial.worker_url=\"http://\${EXTERNAL_IP}:8080\" --project=$PROJECT_ID"
