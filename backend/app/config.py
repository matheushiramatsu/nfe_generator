from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Config(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./nfe.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    schema_directory: Path = Path(__file__).resolve().parents[1] / "schemas" / "PL_010f" / "PL_010f_v1.04"
    requests_per_minute: int = 240


config = Config()
