import os
from dataclasses import dataclass
from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    vertex_project_id: str
    vertex_location: str
    gemini_model: str
    use_vertex_inference: bool
    allow_deterministic_fallback: bool
    vertex_timeout_seconds: int
    google_cloud_project_id: str | None
    google_cloud_private_key_id: str | None
    google_cloud_private_key: str | None
    google_cloud_client_email: str | None
    google_cloud_client_id: str | None


def get_settings() -> Settings:
    is_prod = os.getenv("NODE_ENV", "development").strip().lower() == "production"
    return Settings(
        vertex_project_id=os.getenv("VERTEX_AI_PROJECT_ID", "").strip(),
        vertex_location=os.getenv("VERTEX_AI_LOCATION", "us-central1").strip(),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-pro").strip(),
        use_vertex_inference=os.getenv("USE_VERTEX_INFERENCE", "true").strip().lower() == "true",
        allow_deterministic_fallback=(
            os.getenv("ALLOW_DETERMINISTIC_FALLBACK", "false" if is_prod else "true").strip().lower() == "true"
        ),
        vertex_timeout_seconds=max(5, int(os.getenv("VERTEX_TIMEOUT_SECONDS", "45"))),
        google_cloud_project_id=os.getenv("GOOGLE_CLOUD_PROJECT_ID"),
        google_cloud_private_key_id=os.getenv("GOOGLE_CLOUD_PRIVATE_KEY_ID"),
        google_cloud_private_key=os.getenv("GOOGLE_CLOUD_PRIVATE_KEY"),
        google_cloud_client_email=os.getenv("GOOGLE_CLOUD_CLIENT_EMAIL"),
        google_cloud_client_id=os.getenv("GOOGLE_CLOUD_CLIENT_ID"),
    )
