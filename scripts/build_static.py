#!/usr/bin/env python3
"""Build a static, Slack-free copy of the extension for GitHub Pages.

The main branch keeps the full Slack relay (it needs server.py). GitHub Pages
serves static files only, so this build strips the Slack send path and every
UI string that promises a Slack delivery. Actions still record to the local
action history.

Usage:
    python3 scripts/build_static.py --base-url https://<user>.github.io/<repo>
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BUILD_DIR = PROJECT_ROOT / "build"
CACHE_TAG = "static-1"

BUILD_BANNER = (
    "// ⚠️ 정적 배포 빌드입니다. Slack 발송 기능이 제거되었습니다.\n"
    "// 조치는 브라우저 로컬 조치 이력에만 기록됩니다.\n"
    "// 원본은 main 브랜치의 extension/app.js 이며, scripts/build_static.py 로 생성됩니다.\n"
)

# (설명, 찾을 문자열, 바꿀 문자열) — 하나라도 못 찾으면 빌드를 실패시킵니다.
APP_JS_PATCHES: list[tuple[str, str, str]] = [
    (
        "sendSlackMessage 함수 제거",
        """async function sendSlackMessage(message) {
  const payload = typeof message === "string" ? {text: message} : message;
  const response = await fetch("/api/slack/notify", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `Slack 전송 실패 (${response.status})`);
  }
  return result;
}

""",
        "",
    ),
    (
        "작업지시: Slack 발송 호출 제거",
        "    await sendSlackMessage(buildWorkOrderSlackPayload(actionId, currentMachine));\n",
        "",
    ),
    (
        "유지보수팀 알림: Slack 발송 호출 제거",
        "    await sendSlackMessage(buildMaintenanceNotificationPayload(actionId, currentMachine));\n",
        "",
    ),
    (
        "확인 다이얼로그: Slack 전송 항목 제거",
        "    <dt>Slack 전송</dt><dd>#작업-지시 채널</dd>\n",
        "",
    ),
    (
        "확인 다이얼로그: 안내 문구 수정",
        '<p class="muted">아래 버튼을 누르면 작업지시가 생성되고 Slack 채널에 즉시 전송됩니다.</p>',
        '<p class="muted">아래 버튼을 누르면 작업지시가 생성되어 조치 이력에 기록됩니다.</p>',
    ),
    (
        "확인 버튼 라벨 수정",
        'confirm.textContent = "작업지시 생성 및 Slack 전송";',
        'confirm.textContent = "작업지시 생성";',
    ),
    (
        "작업지시 완료 토스트 문구 수정",
        "showStatusMessage(`${actionId} 작업지시를 생성하고 Slack에 알렸습니다.`);",
        "showStatusMessage(`${actionId} 작업지시를 생성했습니다.`);",
    ),
    (
        "알림 완료 토스트 문구 수정",
        "showStatusMessage(`${actionId} Slack 알림을 전송했습니다.`);",
        "showStatusMessage(`${actionId} 유지보수팀 알림을 이력에 기록했습니다.`);",
    ),
    (
        "이력 상태 라벨: 전송됨 → 기록됨",
        'Sent:"전송됨"',
        'Sent:"기록됨"',
    ),
]

TREX_TEMPLATE_SUB = ("<url>http://localhost:8765/extension/index.html</url>", "<url>{url}</url>")


def apply_patches(source: str, patches: list[tuple[str, str, str]], label: str) -> str:
    for description, find, replace in patches:
        if find not in source:
            sys.exit(f"빌드 실패: {label} 패치를 적용할 수 없습니다 → {description}\n"
                     f"원본이 변경된 것 같습니다. scripts/build_static.py 의 패치 문자열을 갱신하세요.")
        source = source.replace(find, replace, 1)
    return source


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-url",
        required=True,
        help="배포 루트 URL (예: https://heoquixote.github.io/predictive-maintenance-action-center)",
    )
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    if not base_url.startswith("https://"):
        sys.exit("빌드 실패: Tableau는 https:// 를 요구합니다 (localhost 제외).")

    if BUILD_DIR.exists():
        shutil.rmtree(BUILD_DIR)
    (BUILD_DIR / "extension").mkdir(parents=True)
    (BUILD_DIR / "data").mkdir(parents=True)

    src_ext = PROJECT_ROOT / "extension"

    # 그대로 복사하는 정적 자산
    for name in ("style.css", "mock-data.js", "tableau.extensions.1.latest.min.js"):
        shutil.copy2(src_ext / name, BUILD_DIR / "extension" / name)

    # app.js: Slack 발송 경로 제거
    app_js = (src_ext / "app.js").read_text(encoding="utf-8")
    app_js = apply_patches(app_js, APP_JS_PATCHES, "app.js")
    if "/api/slack/notify" in app_js or "sendSlackMessage" in app_js:
        sys.exit("빌드 실패: app.js 에 Slack 발송 코드가 남아 있습니다.")
    (BUILD_DIR / "extension" / "app.js").write_text(BUILD_BANNER + app_js, encoding="utf-8")

    # index.html: 캐시 무효화 태그 갱신
    index_html = (src_ext / "index.html").read_text(encoding="utf-8")
    index_html = index_html.replace("?v=20260730-17", f"?v={CACHE_TAG}")
    (BUILD_DIR / "extension" / "index.html").write_text(index_html, encoding="utf-8")

    # .trex: source-location 을 배포 URL 로 교체
    trex = (src_ext / "predictive-maintenance.trex").read_text(encoding="utf-8")
    find, replace = TREX_TEMPLATE_SUB
    if find not in trex:
        sys.exit("빌드 실패: .trex 의 source-location 을 찾을 수 없습니다.")
    trex = trex.replace(find, replace.format(url=f"{base_url}/extension/index.html"), 1)
    (BUILD_DIR / "extension" / "predictive-maintenance.trex").write_text(trex, encoding="utf-8")

    # CSV 폴백 경로(../data/)가 404 대신 빈 응답을 받도록 자리를 만들어 둡니다.
    csv_src = PROJECT_ROOT / "data" / "machine_latest_status.csv"
    if csv_src.exists():
        shutil.copy2(csv_src, BUILD_DIR / "data" / "machine_latest_status.csv")
    else:
        (BUILD_DIR / "data" / ".gitkeep").write_text("", encoding="utf-8")

    # GitHub Pages 의 Jekyll 처리를 건너뜁니다.
    (BUILD_DIR / ".nojekyll").write_text("", encoding="utf-8")

    print(f"빌드 완료: {BUILD_DIR}")
    print(f"  익스텐션 URL: {base_url}/extension/index.html")
    print(f"  .trex:        {BUILD_DIR / 'extension' / 'predictive-maintenance.trex'}")
    if not csv_src.exists():
        print("  참고: data/machine_latest_status.csv 가 없어 mock-data.js 폴백으로 동작합니다.")


if __name__ == "__main__":
    main()
