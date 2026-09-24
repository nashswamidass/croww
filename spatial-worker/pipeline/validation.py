from __future__ import annotations
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

MIN_SOURCE_FRAMES = int(os.getenv("SPATIAL_MIN_FRAMES", "20"))
MIN_REGISTERED_CAMERAS = int(os.getenv("SPATIAL_MIN_REGISTERED_FRAMES", "20"))
MIN_SPLAT_BYTES = 1024 # At least 1 KB of splat data

class QualityGateError(Exception):
    def __init__(self, message: str, user_facing: Optional[str] = None):
        super().__init__(message)
        self.user_facing = user_facing or "Spatial Walkthrough could not be created from this capture. Try a slower walkthrough with more overlapping views."

def validate_reconstruction_outputs(
    source_frame_count: int,
    registered_camera_count: int,
    mobile_splat: Path,
    desktop_splat: Path,
    poster: Path,
) -> dict:
    """
    Enforces Phase 8 Quality Gate.
    Verifies that the reconstruction satisfies minimum criteria before declaring READY.
    """
    logger.info("Executing Quality Gate checks")

    # 1. Enough source frames
    if source_frame_count < MIN_SOURCE_FRAMES:
        raise QualityGateError(
            f"Source frame count too low ({source_frame_count} < {MIN_SOURCE_FRAMES})",
            "Walkthrough is too short. Try recording for at least 30 seconds."
        )

    # 2. Enough registered cameras
    if registered_camera_count < MIN_REGISTERED_CAMERAS:
        raise QualityGateError(
            f"Registered camera count too low ({registered_camera_count} < {MIN_REGISTERED_CAMERAS})",
            "Spatial Walkthrough could not be created from this capture. Try a slower walkthrough with more overlapping views."
        )

    # 3. Check mobile splat existence and valid byte size
    if not mobile_splat.exists() or mobile_splat.stat().st_size < MIN_SPLAT_BYTES:
        raise QualityGateError(
            f"Mobile splat is missing or empty ({mobile_splat.stat().st_size if mobile_splat.exists() else 0} bytes)",
            "Spatial Walkthrough could not be created from this capture."
        )

    # 4. Check desktop splat existence and valid byte size
    if not desktop_splat.exists() or desktop_splat.stat().st_size < MIN_SPLAT_BYTES:
        raise QualityGateError(
            f"Desktop splat is missing or empty ({desktop_splat.stat().st_size if desktop_splat.exists() else 0} bytes)",
            "Spatial Walkthrough could not be created from this capture."
        )

    # 5. Check poster existence and valid image file
    if not poster.exists() or poster.stat().st_size < 512:
        raise QualityGateError(
            f"Poster image is missing or invalid ({poster.stat().st_size if poster.exists() else 0} bytes)",
            "Spatial Walkthrough could not be created from this capture."
        )

    # Overall reconstruction quality score assessment
    quality_score = "good"
    if registered_camera_count > 60 and source_frame_count > 80:
        quality_score = "high"
    elif registered_camera_count < 30:
        quality_score = "adequate"

    logger.info(f"Quality gate PASSED (quality={quality_score}, cameras={registered_camera_count})")

    return {
        "passed": True,
        "quality": quality_score,
        "sourceFrameCount": source_frame_count,
        "registeredFrameCount": registered_camera_count,
        "mobileBytes": mobile_splat.stat().st_size,
        "desktopBytes": desktop_splat.stat().st_size,
        "posterBytes": poster.stat().st_size,
    }
