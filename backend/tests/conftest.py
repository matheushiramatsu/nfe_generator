from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.domain.models import AutomationOptions, Settings
from app.main import app, requests_by_ip
from app.persistence.database import Base, get_session
from app.services.automation import generate_random


@pytest.fixture
def invoice():
    value = generate_random(
        AutomationOptions(
            min_products=2, max_products=2, min_value=Decimal("100.00"), max_value=Decimal("100.00")
        ),
        [],
        [],
        [],
        Settings(),
    )
    value.number = 1
    return value


@pytest.fixture
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)

    def session_override():
        with sessions() as session:
            yield session

    requests_by_ip.clear()
    app.dependency_overrides[get_session] = session_override
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    engine.dispose()
