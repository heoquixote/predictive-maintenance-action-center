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

LANDING_PAGE = """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Predictive Maintenance Action Center</title>
<style>
  :root{--ink:#13213c;--muted:#68758a;--line:#dbe2ec;--surface:#fff;--bg:#f4f7fb;
    --blue:#1769e0;--warning:#b46900;--shadow:0 10px 30px rgba(29,51,84,.08)}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:15px/1.55 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  .wrap{max-width:720px;margin:auto;padding:44px 20px 64px}
  .eyebrow{margin:0 0 6px;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.12em}
  h1{margin:0 0 10px;font-size:30px;letter-spacing:-.02em}
  .lede{margin:0 0 28px;color:var(--muted)}
  .card{padding:20px;border:1px solid var(--line);border-radius:15px;
    background:var(--surface);box-shadow:var(--shadow);margin-bottom:14px}
  h2{margin:0 0 10px;font-size:17px}
  .actions{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 28px}
  .button{display:inline-block;padding:11px 17px;border-radius:9px;
    font-weight:700;text-decoration:none;font-size:14px}
  .primary{background:var(--blue);color:#fff}
  .secondary{border:1px solid #bac6d7;background:#fff;color:var(--ink)}
  ol,ul{margin:0;padding-left:20px} li{margin-bottom:6px}
  code{padding:1px 5px;border-radius:4px;background:#eef2f8;font-size:13px}
  .note{border-left:3px solid var(--warning);background:#fffaf2}
  .note h2{color:var(--warning)}
  footer{margin-top:30px;color:var(--muted);font-size:13px}
  a{color:var(--blue)}
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">TABLEAU DASHBOARD EXTENSION</p>
  <h1>Predictive Maintenance Action Center</h1>
  <p class="lede">설비 센서 이상을 위험 점수로 환산하고, 원인 분석과 권장 조치를 대시보드 안에서 바로 실행으로 연결하는 Tableau 익스텐션입니다.</p>

  <div class="actions">
    <a class="button primary" href="extension/predictive-maintenance.trex" download>.trex 파일 다운로드</a>
    <a class="button secondary" href="extension/index.html">익스텐션 미리보기</a>
  </div>

  <div class="card">
    <h2>Tableau Desktop에서 사용하기</h2>
    <ol>
      <li>위에서 <code>.trex</code> 파일을 다운로드합니다.</li>
      <li>대시보드에서 개체 영역의 <strong>확장 프로그램</strong>을 끌어다 놓습니다.</li>
      <li><strong>로컬 확장 프로그램 액세스</strong>를 선택하고 내려받은 <code>.trex</code>를 엽니다.</li>
      <li>데이터 접근 대화상자에서 <strong>액세스 허용</strong>을 누릅니다.</li>
      <li>워크시트 마크의 <strong>세부 정보</strong>에 <code>Machine ID</code>를 포함시킨 뒤 마크를 클릭합니다.</li>
    </ol>
  </div>

  <div class="card">
    <h2>연동이 안 될 때</h2>
    <p style="margin:0 0 8px">익스텐션 상단의 <strong>Tableau 연결 진단</strong> 패널을 펼치면 API 상태, 감지된 시트, 마지막 이벤트, 추출된 설비 ID가 실시간으로 표시됩니다. 마크를 클릭했을 때 <em>마지막 이벤트</em>와 <em>추출 설비 ID</em>가 갱신되는지 확인하세요.</p>
    <p style="margin:0">Tableau 없이 열면 자동으로 데모 모드로 전환되어 설비 600~605로 모든 기능을 시험할 수 있습니다.</p>
  </div>

  <div class="card note">
    <h2>알아두실 점</h2>
    <ul>
      <li><strong>Slack 발송 기능은 제외되어 있습니다.</strong> 정적 호스팅에서는 서버 릴레이를 실행할 수 없어, 작업지시와 알림은 조치 이력에만 기록됩니다.</li>
      <li><strong>Tableau Public에서는 사용할 수 없습니다.</strong> 직접 호스팅하는 network-enabled 익스텐션이기 때문입니다.</li>
      <li><strong>Tableau Server / Cloud</strong>에서는 관리자가 이 사이트 URL을 익스텐션 안전 목록에 추가해야 합니다.</li>
    </ul>
  </div>

  <footer>
    소스: <a href="https://github.com/heoquixote/predictive-maintenance-action-center">github.com/heoquixote/predictive-maintenance-action-center</a>
  </footer>
</div>
</body>
</html>
"""


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

    # 배포 루트 랜딩 페이지 (공유 링크로 쓰이는 URL 이므로 404 가 되지 않게 합니다).
    (BUILD_DIR / "index.html").write_text(LANDING_PAGE, encoding="utf-8")

    # GitHub Pages 의 Jekyll 처리를 건너뜁니다.
    (BUILD_DIR / ".nojekyll").write_text("", encoding="utf-8")

    print(f"빌드 완료: {BUILD_DIR}")
    print(f"  익스텐션 URL: {base_url}/extension/index.html")
    print(f"  .trex:        {BUILD_DIR / 'extension' / 'predictive-maintenance.trex'}")
    if not csv_src.exists():
        print("  참고: data/machine_latest_status.csv 가 없어 mock-data.js 폴백으로 동작합니다.")


if __name__ == "__main__":
    main()
