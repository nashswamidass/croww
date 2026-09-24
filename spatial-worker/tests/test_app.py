import pytest
from fastapi.testclient import TestClient
from app import app, JOB_REGISTRY

client = TestClient(app)

def test_health_check():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "spatial-worker"

def test_submit_job_and_idempotency():
    payload = {
        "jobId": "test_job_123",
        "mediaId": "media_456",
        "propertyId": "prop_789",
        "sourceUrl": "https://storage.example.com/source.mp4",
        "uploadUrls": {},
        "outputPaths": {},
    }

    # First submission
    res1 = client.post("/v1/jobs/test_job_123", json=payload)
    assert res1.status_code == 202
    assert res1.json()["accepted"] is True

    # Duplicate submission (idempotency)
    res2 = client.post("/v1/jobs/test_job_123", json=payload)
    assert res2.status_code == 202
    assert res2.json().get("resumed") is True

def test_submit_job_mismatched_id():
    payload = {
        "jobId": "job_A",
        "mediaId": "media_1",
        "propertyId": "prop_1",
        "sourceUrl": "https://example.com/a.mp4",
    }
    res = client.post("/v1/jobs/job_B", json=payload)
    assert res.status_code == 400
