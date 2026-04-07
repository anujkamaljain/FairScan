from fastapi import FastAPI, HTTPException

from .config import get_settings
from .vertex_client import VertexClient

app = FastAPI(
    title="FairSight ML Audit Service",
    version="0.1.0",
    description="Placeholder microservice for Python-based fairness ML tasks."
)

settings = get_settings()
vertex_client = VertexClient(settings)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ml-audit-service",
        "vertex_project_id": settings.vertex_project_id,
        "vertex_location": settings.vertex_location,
        "gemini_model": settings.gemini_model,
        "auth_mode": vertex_client.auth_mode,
    }


@app.get("/vertex-test")
def vertex_test():
    try:
        raw = vertex_client.generate_content("Reply with pong only")
        text = (
            raw.get("candidates", [{}])[0]
            .get("content", {})
            .get("parts", [{}])[0]
            .get("text", "")
        )
        return {
            "status": "ok",
            "auth_mode": vertex_client.auth_mode,
            "model": raw.get("modelVersion", settings.gemini_model),
            "response_text": text,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
