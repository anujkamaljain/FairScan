import os
from dataclasses import dataclass
from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    vertex_project_id: str
    vertex_location: str
    gemini_model: str
    google_cloud_project_id: str | None
    google_cloud_private_key_id: str | None
    google_cloud_private_key: str | None
    google_cloud_client_email: str | None
    google_cloud_client_id: str | None


def get_settings() -> Settings:
    return Settings(
        vertex_project_id=os.getenv("VERTEX_AI_PROJECT_ID", "").strip(),
        vertex_location=os.getenv("VERTEX_AI_LOCATION", "us-central1").strip(),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-pro").strip(),
        google_cloud_project_id=os.getenv("GOOGLE_CLOUD_PROJECT_ID"),
        google_cloud_private_key_id=os.getenv("GOOGLE_CLOUD_PRIVATE_KEY_ID"),
        google_cloud_private_key=os.getenv("GOOGLE_CLOUD_PRIVATE_KEY"),
        google_cloud_client_email=os.getenv("GOOGLE_CLOUD_CLIENT_EMAIL"),
        google_cloud_client_id=os.getenv("GOOGLE_CLOUD_CLIENT_ID"),
    )
