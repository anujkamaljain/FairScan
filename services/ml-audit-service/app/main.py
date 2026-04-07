from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import get_settings
from .vertex_client import VertexClient

MAX_INPUT_KEYS = 100
ALLOWED_LABELS = {"approved", "rejected"}

app = FastAPI(
    title="FairScan ML Audit Service",
    version="1.0.0",
    description="Microservice for ML-based fairness inference tasks.",
)

settings = get_settings()
vertex_client = VertexClient(settings)


class PredictRequest(BaseModel):
    inputData: dict[str, Any] = Field(default_factory=dict)


class PredictResponse(BaseModel):
    prediction: str
    confidence: float


class ValidateModelRequest(BaseModel):
    inputData: dict[str, Any] = Field(default_factory=lambda: {"income": 62000, "credit_score": 710, "tenure_years": 3})


class ValidateModelResponse(BaseModel):
    valid: bool
    provider: str
    vertex_available: bool
    fallback_enabled: bool
    prediction: str | None = None
    confidence: float | None = None
    issues: list[str] = Field(default_factory=list)


def _deterministic_prediction(input_data: dict[str, Any]) -> PredictResponse:
    canonical = json.dumps(input_data, sort_keys=True, default=str)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    seed = int(digest[:10], 16)
    score = 1 / (1 + math.exp(-(((seed % 1000) / 1000.0) * 4 - 2)))
    confidence = round(float(score), 4)
    prediction = "approved" if confidence >= 0.5 else "rejected"
    return PredictResponse(prediction=prediction, confidence=confidence)


def _extract_vertex_text(response: dict[str, Any]) -> str:
    candidates = response.get("candidates") or []
    if not candidates:
        raise ValueError("Vertex response has no candidates")
    parts = ((candidates[0].get("content") or {}).get("parts")) or []
    if not parts:
        raise ValueError("Vertex response has no content parts")
    text = parts[0].get("text")
    if not text or not isinstance(text, str):
        raise ValueError("Vertex response text is missing")
    return text.strip()


def _normalize_vertex_json_text(text: str) -> str:
    normalized = text.strip()
    if normalized.startswith("```json"):
        normalized = normalized[len("```json") :].strip()
    elif normalized.startswith("```"):
        normalized = normalized[len("```") :].strip()
    if normalized.endswith("```"):
        normalized = normalized[:-3].strip()
    return normalized


def _validated_prediction(prediction: Any, confidence: Any) -> PredictResponse:
    label = str(prediction or "").strip().lower()
    if label not in ALLOWED_LABELS:
        raise ValueError("prediction must be either 'approved' or 'rejected'")

    score = float(confidence)
    if score < 0 or score > 1:
        raise ValueError("confidence must be between 0 and 1")

    return PredictResponse(prediction=label, confidence=round(score, 4))


def _vertex_prediction(input_data: dict[str, Any]) -> PredictResponse:
    prompt = (
        "You are a strict prediction service. "
        "Given the JSON inputData below, return only strict JSON with keys "
        "'prediction' and 'confidence'. "
        "prediction must be either 'approved' or 'rejected'. "
        "confidence must be a float in [0,1]. No markdown.\n\n"
        f"inputData:\n{json.dumps(input_data, sort_keys=True, default=str)}"
    )
    response = vertex_client.generate_content(prompt)
    text = _extract_vertex_text(response)
    parsed = json.loads(_normalize_vertex_json_text(text))
    return _validated_prediction(parsed.get("prediction"), parsed.get("confidence"))


def _predict_with_runtime_policy(input_data: dict[str, Any]) -> PredictResponse:
    if not settings.use_vertex_inference:
        return _deterministic_prediction(input_data)

    if not vertex_client.available:
        if settings.allow_deterministic_fallback:
            return _deterministic_prediction(input_data)
        raise HTTPException(status_code=503, detail="Vertex inference is not available")

    try:
        return _vertex_prediction(input_data)
    except Exception as exc:
        if settings.allow_deterministic_fallback:
            return _deterministic_prediction(input_data)
        raise HTTPException(status_code=503, detail=f"Vertex inference failed: {exc}") from exc


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ml-audit-service",
        "vertex_available": vertex_client.available,
        "use_vertex_inference": settings.use_vertex_inference,
        "allow_deterministic_fallback": settings.allow_deterministic_fallback,
        "auth_mode": vertex_client.auth_mode,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    input_data = payload.inputData or {}
    if not isinstance(input_data, dict) or not input_data:
        raise HTTPException(status_code=400, detail="inputData must be a non-empty object")
    if len(input_data) > MAX_INPUT_KEYS:
        raise HTTPException(status_code=400, detail=f"inputData must have at most {MAX_INPUT_KEYS} keys")

    return _predict_with_runtime_policy(input_data)


@app.post("/validate-model", response_model=ValidateModelResponse)
def validate_model(payload: ValidateModelRequest):
    input_data = payload.inputData or {}
    issues: list[str] = []
    provider = "deterministic"
    prediction: PredictResponse | None = None

    if not settings.use_vertex_inference:
        issues.append("USE_VERTEX_INFERENCE is disabled; using deterministic mode")
        prediction = _deterministic_prediction(input_data)
    elif not vertex_client.available:
        issues.append("Vertex credentials/runtime identity unavailable")
        if settings.allow_deterministic_fallback:
            issues.append("Deterministic fallback is enabled")
            prediction = _deterministic_prediction(input_data)
        else:
            return ValidateModelResponse(
                valid=False,
                provider="vertex",
                vertex_available=False,
                fallback_enabled=False,
                issues=issues,
            )
    else:
        provider = "vertex"
        try:
            prediction = _vertex_prediction(input_data)
        except Exception as exc:
            issues.append(f"Vertex validation inference failed: {exc}")
            if settings.allow_deterministic_fallback:
                issues.append("Deterministic fallback used after Vertex validation failure")
                provider = "deterministic-fallback"
                prediction = _deterministic_prediction(input_data)
            else:
                return ValidateModelResponse(
                    valid=False,
                    provider="vertex",
                    vertex_available=True,
                    fallback_enabled=False,
                    issues=issues,
                )

    return ValidateModelResponse(
        valid=True,
        provider=provider,
        vertex_available=vertex_client.available,
        fallback_enabled=settings.allow_deterministic_fallback,
        prediction=prediction.prediction if prediction else None,
        confidence=prediction.confidence if prediction else None,
        issues=issues,
    )
