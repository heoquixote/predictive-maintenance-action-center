#!/usr/bin/env python3
"""Serve the Tableau extension and relay Slack messages without exposing tokens."""

from __future__ import annotations

import json
import os
import ssl
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import certifi

HOST = "localhost"
PORT = 8765
PROJECT_ROOT = Path(__file__).resolve().parent
SLACK_API_URL = "https://slack.com/api/chat.postMessage"


def load_local_env() -> None:
    """Load simple KEY=VALUE entries from a local, git-ignored .env file."""
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


class ExtensionHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def do_POST(self) -> None:
        if self.path != "/api/slack/notify":
            self.send_error(404)
            return

        token = os.environ.get("SLACK_BOT_TOKEN", "").strip()
        channel = os.environ.get("SLACK_CHANNEL_ID", "").strip()
        if not token or not channel:
            self._send_json(
                503,
                {
                    "ok": False,
                    "error": "SLACK_BOT_TOKEN 또는 SLACK_CHANNEL_ID가 설정되지 않았습니다.",
                },
            )
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            text = str(payload.get("text", "")).strip()
            if not text:
                self._send_json(400, {"ok": False, "error": "알림 메시지가 비어 있습니다."})
                return
            assignee_id = os.environ.get("SLACK_ASSIGNEE_USER_ID", "").strip()
            assignee_mention = f"<@{assignee_id}>" if assignee_id else "@Jinseong Heo"
            slack_payload = {
                "channel": channel,
                "text": text,
                "link_names": True,
            }
            blocks = payload.get("blocks")
            if isinstance(blocks, list):
                slack_payload["blocks"] = blocks

            # Replace the server-side assignee placeholder in both fallback
            # text and Block Kit fields without exposing the user ID in JS.
            serialized = json.dumps(slack_payload, ensure_ascii=False)
            slack_payload = json.loads(
                serialized.replace("{{ASSIGNEE}}", assignee_mention)
            )

            dashboard_url = os.environ.get("TABLEAU_DASHBOARD_URL", "").strip()
            if dashboard_url.startswith(("https://", "http://")):
                slack_payload.setdefault("blocks", []).append(
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Tableau 대시보드 열기",
                                    "emoji": True,
                                },
                                "url": dashboard_url,
                                "action_id": "open_tableau_dashboard",
                                "style": "primary",
                            }
                        ],
                    }
                )

            request = urllib.request.Request(
                SLACK_API_URL,
                data=json.dumps(slack_payload).encode("utf-8"),
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json; charset=utf-8",
                },
                method="POST",
            )
            ssl_context = ssl.create_default_context(cafile=certifi.where())
            with urllib.request.urlopen(request, timeout=10, context=ssl_context) as response:
                result = json.loads(response.read())
            if not result.get("ok"):
                self._send_json(502, {"ok": False, "error": result.get("error", "Slack API 오류")})
                return
            self._send_json(
                200,
                {"ok": True, "channel": result.get("channel"), "timestamp": result.get("ts")},
            )
        except (ValueError, json.JSONDecodeError):
            self._send_json(400, {"ok": False, "error": "잘못된 JSON 요청입니다."})
        except urllib.error.HTTPError as error:
            self._send_json(502, {"ok": False, "error": f"Slack HTTP 오류: {error.code}"})
        except (urllib.error.URLError, TimeoutError) as error:
            self._send_json(502, {"ok": False, "error": f"Slack 연결 실패: {error.reason}"})

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    load_local_env()
    print(f"Extension 서버: http://{HOST}:{PORT}/extension/index.html")
    print("Slack 토큰은 SLACK_BOT_TOKEN 환경변수에서만 읽습니다.")
    ThreadingHTTPServer((HOST, PORT), ExtensionHandler).serve_forever()
