import io
import os
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/healthz")
    assert r.status_code == 200


def test_segment_sync():
    path = Path("samples/sample.stl")
    with path.open("rb") as f:
        files = {"file": ("sample.stl", f, "application/sla")}
        r = client.post("/segment?sync=1", files=files)
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    status = client.get(f"/jobs/{job_id}").json()
    assert status["status"] == "done"
    res = client.get(f"/jobs/{job_id}/result")
    z = zipfile.ZipFile(io.BytesIO(res.content))
    data = z.read("labels.npy").decode()
    values = [int(x) for x in data.split() if x]
    assert max(values) >= 0
