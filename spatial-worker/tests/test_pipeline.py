import os
import pytest
from pathlib import Path
from PIL import Image

from pipeline.validation import validate_reconstruction_outputs, QualityGateError
from pipeline.optimize import optimize_splat_variants, generate_poster

def test_quality_gate_passes_valid_reconstruction(tmp_path):
    mobile = tmp_path / "mobile.splat"
    desktop = tmp_path / "desktop.splat"
    poster = tmp_path / "poster.jpg"

    # Write dummy valid files
    mobile.write_bytes(b"splat_data_" * 200)
    desktop.write_bytes(b"splat_data_" * 500)
    poster.write_bytes(b"fake_jpeg_data_" * 100)

    res = validate_reconstruction_outputs(
        source_frame_count=50,
        registered_camera_count=45,
        mobile_splat=mobile,
        desktop_splat=desktop,
        poster=poster,
    )
    assert res["passed"] is True
    assert res["quality"] in ["good", "high"]
    assert res["mobileBytes"] > 0

def test_quality_gate_rejects_insufficient_cameras(tmp_path):
    mobile = tmp_path / "mobile.splat"
    desktop = tmp_path / "desktop.splat"
    poster = tmp_path / "poster.jpg"

    mobile.write_bytes(b"splat_data_" * 200)
    desktop.write_bytes(b"splat_data_" * 500)
    poster.write_bytes(b"fake_jpeg_data_" * 100)

    with pytest.raises(QualityGateError) as exc:
        validate_reconstruction_outputs(
            source_frame_count=40,
            registered_camera_count=5, # Too few
            mobile_splat=mobile,
            desktop_splat=desktop,
            poster=poster,
        )
    assert "could not be created" in exc.value.user_facing

def test_quality_gate_rejects_empty_splat(tmp_path):
    mobile = tmp_path / "mobile.splat"
    desktop = tmp_path / "desktop.splat"
    poster = tmp_path / "poster.jpg"

    mobile.write_bytes(b"") # Empty
    desktop.write_bytes(b"splat_data_" * 500)
    poster.write_bytes(b"fake_jpeg_data_" * 100)

    with pytest.raises(QualityGateError):
        validate_reconstruction_outputs(
            source_frame_count=40,
            registered_camera_count=35,
            mobile_splat=mobile,
            desktop_splat=desktop,
            poster=poster,
        )

def test_optimize_splat_variants_respects_mobile_budget(tmp_path):
    raw_ply = tmp_path / "raw.ply"
    raw_ply.write_bytes(b"0" * (1024 * 100)) # 100 KB

    out_dir = tmp_path / "variants"
    variants = optimize_splat_variants(raw_ply, out_dir)

    assert variants["mobile"].exists()
    assert variants["desktop"].exists()
    assert variants["mobile"].stat().st_size <= 25 * 1024 * 1024

def test_generate_poster(tmp_path):
    frames_dir = tmp_path / "frames"
    frames_dir.mkdir()
    # Create 5 test frames
    for i in range(5):
        im = Image.new("RGB", (640, 480), color=(i * 20, 50, 80))
        im.save(frames_dir / f"frame_{i:05d}.png")

    poster_path = tmp_path / "poster.jpg"
    generate_poster(frames_dir, poster_path)

    assert poster_path.exists()
    assert poster_path.stat().st_size > 500
