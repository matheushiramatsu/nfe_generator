"""Integration smoke using the real configured database, including concurrent numbering."""

import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

with TestClient(app) as client:
    value = client.post("/api/invoices/generate-random", json={}).json()

    def generate(_):
        response = client.post("/api/invoices/generate", json=value)
        assert response.status_code == 200, response.text
        return response.json()

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(generate, range(8)))
    assert len({r["number"] for r in results}) == 8
    for result in results:
        assert client.get("/api/invoices/" + result["id"] + "/xml").status_code == 200
        assert client.delete("/api/invoices/" + result["id"]).status_code == 200
    print("PostgreSQL: concurrent numbering, persistence, XML export and cleanup passed.")
