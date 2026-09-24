from __future__ import annotations
import logging
from pathlib import Path
import httpx

logger = logging.getLogger(__name__)

async def upload_file_to_signed_url(local_path: Path, signed_upload_url: str, content_type: str = "application/octet-stream"):
    """
    Uploads a file to a Google Cloud Storage signed upload URL via HTTP PUT.
    """
    logger.info(f"Uploading {local_path.name} ({local_path.stat().st_size} bytes)")
    data = local_path.read_bytes()
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.put(
            signed_upload_url,
            content=data,
            headers={"Content-Type": content_type},
        )
        response.raise_for_status()
    logger.info(f"Successfully uploaded {local_path.name}")

async def upload_outputs(
    variants: dict[str, Path],
    poster_path: Path,
    upload_urls: dict[str, str],
    output_paths: dict[str, str],
) -> dict:
    """
    Uploads all derivatives to their pre-authorized signed upload URLs.
    Returns the structured outputs object.
    """
    # 1. Upload mobile splat
    if "mobile" in upload_urls and "mobile" in variants:
        await upload_file_to_signed_url(
            variants["mobile"],
            upload_urls["mobile"],
            content_type="application/octet-stream",
        )

    # 2. Upload desktop splat
    if "desktop" in upload_urls and "desktop" in variants:
        await upload_file_to_signed_url(
            variants["desktop"],
            upload_urls["desktop"],
            content_type="application/octet-stream",
        )

    # 3. Upload poster
    if "poster" in upload_urls and poster_path.exists():
        await upload_file_to_signed_url(
            poster_path,
            upload_urls["poster"],
            content_type="image/jpeg",
        )

    # Clean public URL generation without query parameters
    def clean_url(signed_url: str) -> str:
        return signed_url.split("?")[0] if signed_url else ""

    outputs = {
        "mobile": {
            "storagePath": output_paths.get("mobile", ""),
            "url": clean_url(upload_urls.get("mobile", "")),
            "format": "gaussian_splat",
            "bytes": variants["mobile"].stat().st_size if "mobile" in variants else 0,
        },
        "desktop": {
            "storagePath": output_paths.get("desktop", ""),
            "url": clean_url(upload_urls.get("desktop", "")),
            "format": "gaussian_splat",
            "bytes": variants["desktop"].stat().st_size if "desktop" in variants else 0,
        },
        "poster": {
            "storagePath": output_paths.get("poster", ""),
            "url": clean_url(upload_urls.get("poster", "")),
            "bytes": poster_path.stat().st_size if poster_path.exists() else 0,
        },
    }

    return outputs
