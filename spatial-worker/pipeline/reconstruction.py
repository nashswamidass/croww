import os
import subprocess
import logging
from pathlib import Path
import json

logger = logging.getLogger(__name__)

MIN_REGISTERED_FRAMES = int(os.getenv("SPATIAL_MIN_REGISTERED_FRAMES", "20"))

def run_reconstruction(
    frames_dir: Path,
    output_dir: Path,
) -> dict:
    """
    Runs COLMAP camera pose estimation via Nerfstudio process-data.
    Returns reconstruction metrics (registered camera count, transforms path).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    transforms_path = output_dir / "transforms.json"

    logger.info(f"Running camera pose estimation from {frames_dir} into {output_dir}")

    cmd = [
        "ns-process-data",
        "images",
        "--data", str(frames_dir),
        "--output-dir", str(output_dir),
        "--matching-method", "sequential",
        "--skip-image-processing",
    ]

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        logger.info("Reconstruction completed successfully")
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        logger.warning(f"ns-process-data failed or not installed: {e}")
        if os.getenv("SPATIAL_MOCK_PIPELINE") == "1":
            # Testing fallback: generate mock transforms.json
            mock_data = {
                "camera_model": "PINHOLE",
                "fl_x": 1000.0,
                "fl_y": 1000.0,
                "cx": 640.0,
                "cy": 360.0,
                "w": 1280,
                "h": 720,
                "frames": [
                    {
                        "file_path": f"images/frame_{i:05d}.png",
                        "transform_matrix": [
                            [1.0, 0.0, 0.0, float(i) * 0.1],
                            [0.0, 1.0, 0.0, 0.0],
                            [0.0, 0.0, 1.0, 2.0],
                            [0.0, 0.0, 0.0, 1.0],
                        ],
                    }
                    for i in range(30)
                ],
            }
            with open(transforms_path, "w") as f:
                json.dump(mock_data, f)
        else:
            raise RuntimeError(f"Reconstruction failed: {e}")

    if not transforms_path.exists():
        raise RuntimeError("Reconstruction produced no transforms.json")

    with open(transforms_path, "r") as f:
        transforms = json.load(f)

    registered_frames = len(transforms.get("frames", []))
    logger.info(f"Registered {registered_frames} cameras in reconstruction")

    if registered_frames < MIN_REGISTERED_FRAMES:
        raise ValueError(
            f"Too few cameras registered ({registered_frames} < {MIN_REGISTERED_FRAMES}). "
            "The walkthrough could not be mapped into a 3D coordinate space."
        )

    return {
        "transforms_path": transforms_path,
        "registered_frames": registered_frames,
    }
