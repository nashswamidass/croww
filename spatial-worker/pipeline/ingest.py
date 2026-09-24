import os
import logging
from pathlib import Path
import httpx

logger = logging.getLogger(__name__)

async def download_source(source_url: str, dest_dir: Path) -> Path:
    """
    Downloads source walkthrough video from signed URL.
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_file = dest_dir / "input_walkthrough.mp4"

    logger.info(f"Downloading source video to {dest_file}")
    async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
        async with client.stream("GET", source_url) as response:
            response.raise_for_status()
            with open(dest_file, "wb") as f:
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    f.write(chunk)

    size_bytes = dest_file.stat().st_size
    logger.info(f"Downloaded source video ({size_bytes / (1024 * 1024):.2f} MB)")
    if size_bytes == 0:
        raise ValueError("Downloaded source video is empty (0 bytes)")

    return dest_file
