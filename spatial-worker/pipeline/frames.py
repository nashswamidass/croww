from __future__ import annotations
import os
import subprocess
import logging
from pathlib import Path
from PIL import Image

logger = logging.getLogger(__name__)

DEFAULT_TARGET_FPS = float(os.getenv("SPATIAL_TARGET_FPS", "2.0"))
MIN_REQUIRED_FRAMES = int(os.getenv("SPATIAL_MIN_FRAMES", "20"))
MAX_ALLOWED_FRAMES = int(os.getenv("SPATIAL_MAX_FRAMES", "600"))

def get_video_duration_seconds(video_path: Path) -> float:
    """Uses ffprobe to obtain duration in seconds."""
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(video_path)
    ]
    try:
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        return float(res.stdout.strip())
    except Exception as e:
        logger.warning(f"Could not determine video duration with ffprobe: {e}")
        return 0.0

def extract_keyframes(
    video_path: Path,
    output_dir: Path,
    target_fps: float = DEFAULT_TARGET_FPS,
) -> list[Path]:
    """
    Extracts keyframes at target_fps using FFmpeg.
    Avoids extracting thousands of identical frames.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    pattern = str(output_dir / "frame_%05d.png")

    logger.info(f"Extracting frames from {video_path} at {target_fps} fps")

    # FFmpeg command to extract scaled frames (720p safe) at specified FPS
    cmd = [
        "ffmpeg",
        "-y",
        "-i", str(video_path),
        "-vf", f"fps={target_fps},scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease",
        "-q:v", "2",
        pattern,
    ]

    try:
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    except FileNotFoundError:
        # Fallback for environments without ffmpeg installed (e.g. testing mock)
        logger.warning("ffmpeg binary not found in PATH; using dummy frames if testing")
        if os.getenv("SPATIAL_MOCK_FFMPEG") == "1":
            for i in range(25):
                img_path = output_dir / f"frame_{i:05d}.png"
                img = Image.new("RGB", (640, 480), color=(i * 10, 100, 150))
                img.save(img_path)

    extracted = sorted(list(output_dir.glob("frame_*.png")))
    logger.info(f"Extracted {len(extracted)} frames")

    if len(extracted) < MIN_REQUIRED_FRAMES:
        raise ValueError(
            f"Insufficient extracted frames ({len(extracted)} < {MIN_REQUIRED_FRAMES}). "
            "Walkthrough is too short or lacks sufficient visual movement."
        )

    return extracted
