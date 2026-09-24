import os
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

MAX_TRAIN_STEPS = int(os.getenv("SPATIAL_MAX_TRAIN_STEPS", "5000"))
IMAGE_SCALE = int(os.getenv("SPATIAL_IMAGE_SCALE", "1"))

def train_gaussian_splat(
    transforms_dir: Path,
    output_dir: Path,
    max_steps: int = MAX_TRAIN_STEPS,
) -> Path:
    """
    Trains Gaussian Splatting model using splatfacto / gsplat,
    then exports to PLY.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    export_ply = output_dir / "splat_raw.ply"

    logger.info(f"Training splatfacto for {max_steps} steps from {transforms_dir}")

    # 1. Train model
    train_cmd = [
        "ns-train", "splatfacto",
        "--data", str(transforms_dir),
        "--output-dir", str(output_dir),
        "--max-num-iterations", str(max_steps),
        "--viewer.quit-on-train-completion", "True",
        "--pipeline.model.sh-degree", "0",
    ]

    try:
        subprocess.run(train_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        # 2. Export splat to ply
        export_cmd = [
            "ns-export", "gaussian-splat",
            "--load-config", str(output_dir / "config.yml"),
            "--output-dir", str(output_dir),
        ]
        subprocess.run(export_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except (FileNotFoundError, subprocess.CalledProcessError) as e:
        logger.warning(f"ns-train/ns-export failed or not installed: {e}")
        if os.getenv("SPATIAL_MOCK_PIPELINE") == "1":
            # Testing fallback: generate valid PLY header/data
            with open(export_ply, "wb") as f:
                header = (
                    "ply\n"
                    "format binary_little_endian 1.0\n"
                    "element vertex 100\n"
                    "property float x\nproperty float y\nproperty float z\n"
                    "property float f_dc_0\nproperty float f_dc_1\nproperty float f_dc_2\n"
                    "property float opacity\n"
                    "property float scale_0\nproperty float scale_1\nproperty float scale_2\n"
                    "property float rot_0\nproperty float rot_1\nproperty float rot_2\nproperty float rot_3\n"
                    "end_header\n"
                )
                f.write(header.encode("ascii"))
                # Write dummy binary floats for 100 vertices
                dummy_floats = [0.0] * (100 * 14)
                import struct
                f.write(struct.pack(f"<{len(dummy_floats)}f", *dummy_floats))
        else:
            raise RuntimeError(f"Gaussian splat training failed: {e}")

    if not export_ply.exists():
        raise RuntimeError("Training completed but no exported splat file was generated")

    return export_ply
