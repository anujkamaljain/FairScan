from __future__ import annotations

import os
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
        self.credentials, self.auth_mode = self._build_credentials()

    def _build_credentials(self):
        # Priority 1: Explicit service account fields from environment.
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

        # Priority 2/3: ADC from GOOGLE_APPLICATION_CREDENTIALS file or runtime identity.
        creds, _project = google_auth_default(scopes=_SCOPES)
        if os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
            return creds, "adc_credentials_file"
        return creds, "adc_runtime_identity"

    def _access_token(self) -> str:
        request = Request()
        self.credentials.refresh(request)
        return self.credentials.token

    def generate_content(self, prompt: str) -> dict[str, Any]:
        if not self.settings.vertex_project_id:
            raise ValueError("VERTEX_AI_PROJECT_ID is required")

        endpoint = (
            f"https://{self.settings.vertex_location}-aiplatform.googleapis.com/v1/"
            f"projects/{self.settings.vertex_project_id}/locations/{self.settings.vertex_location}/"
            f"publishers/google/models/{self.settings.gemini_model}:generateContent"
        )

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": prompt}],
                }
            ]
        }
        token = self._access_token()
        response = requests.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=45,
        )

        if not response.ok:
            raise RuntimeError(f"Vertex request failed ({response.status_code}): {response.text}")
        return response.json()
