from __future__ import annotations

import os
import random
import time
from typing import Any

import requests
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request
from google.oauth2 import service_account

from .config import Settings

_SCOPES = ["https://www.googleapis.com/auth/cloud-platform"]


class VertexClient:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.credentials = None
        self.auth_mode = "none"
        try:
            self.credentials, self.auth_mode = self._build_credentials()
        except Exception:
            self.auth_mode = "unavailable"

    @property
    def available(self) -> bool:
        return self.credentials is not None

    def _build_credentials(self):
        if (
            self.settings.google_cloud_private_key
            and self.settings.google_cloud_client_email
            and self.settings.google_cloud_private_key_id
        ):
            info = {
                "type": "service_account",
                "project_id": self.settings.google_cloud_project_id or self.settings.vertex_project_id,
                "private_key_id": self.settings.google_cloud_private_key_id,
                "private_key": self.settings.google_cloud_private_key.replace("\\n", "\n"),
                "client_email": self.settings.google_cloud_client_email,
                "client_id": self.settings.google_cloud_client_id or "",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
            creds = service_account.Credentials.from_service_account_info(info, scopes=_SCOPES)
            return creds, "env_service_account_fields"

        creds, _project = google_auth_default(scopes=_SCOPES)
        if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            return creds, "adc_credentials_file"
        return creds, "adc_runtime_identity"

    def _access_token(self) -> str:
        request = Request()
        self.credentials.refresh(request)
        return self.credentials.token

    def auth_headers(self) -> dict[str, str]:
        token = self._access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def post_json(
        self,
        endpoint: str,
        payload: dict[str, Any],
        timeout_seconds: float | None = None,
        *,
        retry_transient: bool = False,
        max_retries: int = 6,
    ) -> dict[str, Any]:
        timeout = timeout_seconds if timeout_seconds is not None else 120.0
        last_text = ""
        for attempt in range(max_retries):
            if attempt > 0:
                try:
                    self.credentials.refresh(Request())
                except Exception:
                    pass
            response = requests.post(
                endpoint,
                headers=self.auth_headers(),
                json=payload,
                timeout=timeout,
            )
            if response.ok:
                return response.json()
            last_text = response.text or ""
            code = response.status_code
            retryable = code in (408, 429, 500, 502, 503, 504)
            if retry_transient and retryable and attempt < max_retries - 1:
                wait = min(32.0, (2**attempt) * 1.0 + random.uniform(0, 0.75))
                time.sleep(wait)
                continue
            raise RuntimeError(f"Vertex request failed ({code}): {last_text[:4000]}")
        raise RuntimeError(f"Vertex request failed: {last_text[:4000]}")

    def get_json(self, endpoint: str, timeout_seconds: float | None = None) -> dict[str, Any]:
        response = requests.get(
            endpoint,
            headers=self.auth_headers(),
            timeout=timeout_seconds,
        )
        if not response.ok:
            raise RuntimeError(f"Vertex request failed ({response.status_code}): {response.text}")
        return response.json()

    def generate_content(self, prompt: str, *, system_instruction: str | None = None) -> dict[str, Any]:
        if not self.settings.vertex_project_id:
            raise ValueError("VERTEX_AI_PROJECT_ID is required")

        endpoint = (
            f"https://{self.settings.vertex_location}-aiplatform.googleapis.com/v1/"
            f"projects/{self.settings.vertex_project_id}/locations/{self.settings.vertex_location}/"
            f"publishers/google/models/{self.settings.gemini_model}:generateContent"
        )

        payload: dict[str, Any] = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 1024,
            },
        }
        if system_instruction and system_instruction.strip():
            payload["systemInstruction"] = {"parts": [{"text": system_instruction.strip()}]}
        return self.post_json(endpoint, payload, retry_transient=True, max_retries=6)
