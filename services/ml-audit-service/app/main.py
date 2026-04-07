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


def _deterministic_prediction(input_data: dict[str, Any]) -> PredictResponse:
    canonical = json.dumps(input_data, sort_keys=True, default=str)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    seed = int(digest[:10], 16)
    score = 1 / (1 + math.exp(-(((seed % 1000) / 1000.0) * 4 - 2)))
    confidence = round(float(score), 4)
    prediction = "approved" if confidence >= 0.5 else "rejected"
    return PredictResponse(prediction=prediction, confidence=confidence)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "ml-audit-service",
        "vertex_available": vertex_client.available,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(payload: PredictRequest):
    input_data = payload.inputData or {}
    if not isinstance(input_data, dict) or not input_data:
        raise HTTPException(status_code=400, detail="inputData must be a non-empty object")
    if len(input_data) > MAX_INPUT_KEYS:
        raise HTTPException(status_code=400, detail=f"inputData must have at most {MAX_INPUT_KEYS} keys")

    return _deterministic_prediction(input_data)
