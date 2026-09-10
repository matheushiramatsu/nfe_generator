def test_full_lifecycle(client, invoice):
    assert client.get("/api/health").status_code == 200
    assert client.get("/openapi.json").status_code == 200
    data = invoice.model_dump(mode="json")
    data["number"] = None
    validation = client.post("/api/invoices/validate", json=data).json()
    assert validation["valid"] is True
    response = client.post("/api/invoices/generate", json=data)
    assert response.status_code == 200, response.text
    saved = response.json()
    id = saved["id"]
    assert saved["number"] == 1
    detail = client.get("/api/invoices/" + id).json()
    assert detail["invoice"]["recipient"] == data["recipient"]
    assert detail["invoice"]["items"] == data["items"]
    xml = client.get("/api/invoices/" + id + "/xml")
    assert xml.status_code == 200
    assert xml.headers["content-type"].startswith("application/xml")
    assert "NFe-HOM-" in xml.headers["content-disposition"]
    exported = client.get("/api/invoices/" + id + "/json")
    assert exported.json() == detail["invoice"]
    copy = client.post("/api/invoices/" + id + "/duplicate").json()
    assert copy["number"] is None
    copy["recipient"]["name"] = "DESTINATARIO NOVO TESTE"
    second = client.post("/api/invoices/generate", json=copy).json()
    assert second["number"] == 2
    assert (
        client.get("/api/invoices/" + id).json()["invoice"]["recipient"]["name"] == data["recipient"]["name"]
    )
    assert client.get("/api/invoices?q=DESTINATARIO NOVO").json()["total"] == 1
    assert client.get("/api/invoices?series=999").json()["total"] == 0
    assert client.get("/api/dashboard").json()["today"] == 2
    assert client.delete("/api/invoices/" + id).status_code == 200
    assert client.get("/api/invoices/" + id).status_code == 404


def test_duplicate_number_blocked(client, invoice):
    value = invoice.model_dump(mode="json")
    assert client.post("/api/invoices/generate", json=value).status_code == 200
    assert client.post("/api/invoices/generate", json=value).status_code == 409


def test_failed_generation_has_history_without_xml(client, invoice):
    invoice.items[0].ncm = ""
    response = client.post("/api/invoices/generate", json=invoice.model_dump(mode="json"))
    assert response.status_code == 422
    id = response.json()["record_id"]
    assert client.get("/api/invoices/" + id + "/xml").status_code == 409
    assert client.get("/api/invoices?status=validation_error").json()["total"] == 1
    assert client.get("/api/dashboard").json()["errors"] == 1


def test_input_hardening(client, invoice):
    data = invoice.model_dump(mode="json")
    data["environment"] = "1"
    response = client.post("/api/invoices/generate", json=data)
    assert response.status_code == 422
    assert response.json()["detail"][0]["path"] == "environment"
    assert client.post("/api/invoices/generate", content="x" * 2_000_001).status_code == 413
    assert client.get("/api/invoices?start=bad-date").status_code == 422
    assert client.post("/api/invoices/generate-random", json={"existing_only": True}).status_code == 422


def test_catalog_crud_and_default_issuer(client, invoice):
    data = invoice.issuer.model_dump(mode="json")
    data["is_default"] = True
    first = client.post("/api/issuers", json=data).json()
    data["name"] = "SEGUNDA EMPRESA TESTE"
    second = client.post("/api/issuers", json=data).json()
    listing = client.get("/api/issuers").json()
    assert sum(p["is_default"] for p in listing) == 1
    assert next(p for p in listing if p["id"] == second["id"])["is_default"] is True
    data["name"] = "NOME ATUALIZADO"
    assert client.put("/api/issuers/" + first["id"], json=data).status_code == 200
    assert len(client.get("/api/issuers?q=ATUALIZADO").json()) == 1
    assert client.delete("/api/issuers/" + first["id"]).status_code == 200


def test_test_data_and_random_endpoint(client):
    assert client.post("/api/test-data").status_code == 200
    assert len(client.get("/api/products").json()) == 4
    value = client.post("/api/invoices/generate-random", json={"existing_only": True}).json()
    assert value["issuer"]["is_test"]
    assert client.post("/api/invoices/validate", json=value).json()["valid"]


def test_settings(client):
    settings = client.get("/api/settings").json()
    settings["developer_mode"] = True
    settings["series"] = 9
    assert client.put("/api/settings", json=settings).status_code == 200
    assert client.get("/api/settings").json()["series"] == 9
    settings["environment"] = "1"
    assert client.put("/api/settings", json=settings).status_code == 422


def test_missing_endpoints(client):
    assert client.get("/api/invoices/missing/json").status_code == 404
    assert client.delete("/api/products/missing").status_code == 404


def test_operation_suggestions_are_server_owned(client, invoice):
    invoice.recipient.address.uf = "RJ"
    response = client.post("/api/invoices/operation", json=invoice.model_dump(mode="json"))
    assert response.json()["destination"] == "2"
    assert all(code.startswith("6") for code in response.json()["cfops"])
