# Predictive Maintenance Action Center

Tableau에서 이상 설비를 선택한 뒤 원인 확인, 권장 조치, 작업지시 생성과 알림, 실행 이력 기록까지 한 화면에서 수행하는 해커톤용 Dashboard Extension MVP입니다. 기존 대시보드의 “탐지”를 현장의 “다음 행동”으로 연결합니다.

> **중요:** Risk Score는 미래 고장 확률이 아니라 샘플 데이터의 설비별 센서 편차를 조합한 **데모용 위험 점수**입니다. `Unplanned Maintenance Breakdown`은 해당 측정 시점의 상태 라벨로만 사용합니다.

## 사용자와 데이터

생산/설비 관리자와 유지보수 담당자가 대상입니다. 원본은 UTF-16, 탭 구분 센서 데이터이며 Machine ID, 시각, 소음, 오일, 온도, 진동 및 현재 고장 상태 라벨을 포함합니다.

## 구조

```text
원본 센서 CSV ── prepare_data.py ── machine_latest_status.csv ─┐
                                                              ├─ Tableau Dashboard
원본 센서 CSV ────────────────────────────────────────────────┤
Tableau 선택 이벤트 ── Machine ID ── Extension ── Mock Action ┘
```

- `scripts/prepare_data.py`: 설비별 robust z-score 기반 위험 점수와 요약 생성
- `data/machine_latest_status.csv`: 설비별 최신 상태
- `data/machine_summary.csv`: 설비별 집계
- `extension/`: Vanilla JS 기반 Dashboard Extension과 내장 데모 데이터
- `docs/`: Tableau 설정 및 60초 시연 가이드

## 설치 및 실행 (macOS)

```bash
cd "/Users/heojinseong/Documents/Tableau Hakathon/predictive-maintenance-action-center"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

원본 파일을 `data/VW_MACHINE_DATA(1).csv`에 넣은 뒤 실행합니다.

```bash
python scripts/prepare_data.py
```

다른 위치의 파일은 다음과 같이 지정할 수 있습니다.

```bash
python scripts/prepare_data.py --input "/absolute/path/VW_MACHINE_DATA(1).csv"
```

Extension 서버는 반드시 프로젝트 루트에서 실행합니다.

```bash
python3 server.py
```

브라우저 테스트: [http://localhost:8765/extension/index.html](http://localhost:8765/extension/index.html)

## Slack 연결 정보 입력

프로젝트 루트의 `.env.example`을 복사하여 `.env`를 생성합니다.

```bash
cp .env.example .env
```

`.env` 파일에 Slack Bot Token과 대상 Channel ID를 입력합니다.

```dotenv
SLACK_BOT_TOKEN=xoxb-여기에_새_Bot_Token_입력
SLACK_CHANNEL_ID=C로_시작하는_채널_ID
SLACK_ASSIGNEE_USER_ID=U로_시작하는_사용자_ID
```

`.env`는 `.gitignore`에 포함되어 있으며 Extension JavaScript로 전달되지 않습니다.
`python3 server.py`를 다시 시작한 후 `작업지시 생성`을 누르면 작업지시
요약이 Slack으로 전송됩니다. Slack App에는 `chat:write` 권한이 필요하고,
비공개 채널에서는 앱을 해당 채널에 초대해야 합니다.

## Demo Mode

브라우저에서 열면 Tableau API 초기화가 실패할 경우 자동으로 Demo Mode로 전환됩니다. 드롭다운에서 600~605 설비를 선택할 수 있고, 기본값 600으로 모든 액션을 테스트할 수 있습니다. Tableau 안에서도 `Demo Mode` 버튼으로 내장 데이터를 사용할 수 있습니다.

## Tableau 연결

1. Tableau Desktop에서 원본 CSV와 `machine_latest_status.csv`를 Machine ID 관계로 연결합니다.
2. `Machine Priority List` 워크시트를 만들고 Machine ID를 마크의 세부 정보에 포함합니다.
3. 대시보드에 Extension 객체를 추가하고 `extension/predictive-maintenance.trex`를 선택합니다.
4. 워크시트 이름이 다르면 `extension/app.js` 상단의 `TARGET_WORKSHEET_NAME`을 수정합니다.
5. 서버 포트/호스트를 바꾸면 `.trex`의 `<url>`도 수정합니다.

상세 절차는 [docs/tableau_setup.md](docs/tableau_setup.md)를 참고하십시오.

## 구현 기능

- UTF-16/탭 원본 로드, 데이터 타입/필수 컬럼 검증, 결측치 기본 처리
- 설비별 중앙값과 IQR 기반 센서 편차, 0~100 Risk Score
- Risk Level, 주요 원인, 센서 상태, 권장 조치 생성
- Tableau `MarkSelectionChanged` 및 `Machine ID`/`ATTR(Machine ID)`/`AGG(Machine ID)` 파싱
- CSV 조회 실패 시 `mock-data.js` fallback, 독립 Demo Mode
- 확인 UI가 포함된 Mock Work Order, Mock Maintenance Notification
- 원인별 샘플 SOP와 Warning/Critical 이슈 에스컬레이션
- 중복 클릭 방지, 로딩/성공/실패 메시지, 빈 선택/오류 처리
- localStorage 및 메모리 fallback Action History, 화면에는 최근 5건 표시

## 점수 산식

각 설비 분포에서 `robust_z = (x - median) / (IQR / 1.349)`를 계산합니다. 위험 방향의 편차만 남겨 `component = clip(robust_z, 0, 3) / 3 × 100`으로 변환합니다.

```text
Risk Score =
  Temperature Risk × 0.30 +
  Vibration Risk   × 0.30 +
  Oil Risk         × 0.25 +
  Noise Risk       × 0.15
```

오일은 낮은 방향을 위험으로 반전합니다. 현재 행의 Breakdown 라벨이 1이면 데모상 최소 85점을 적용합니다. 80 이상은 Critical, 60 이상은 Warning, 나머지는 Normal입니다.

## Mock 범위와 미구현 항목

1. Risk Score는 샘플 데이터 기반 데모 점수이며 검증된 예측 확률이 아닙니다.
2. Work Order는 실제 CMMS가 아닌 브라우저 내 Mock Action입니다.
3. Notify Maintenance는 실제 Slack/Teams 전송이 아닙니다.
4. SOP는 제조사가 승인한 절차서가 아닌 샘플입니다.
5. 실제 설비 정지 또는 제어 명령을 수행하지 않습니다.

MES/CMMS, PLC, 인증, 데이터베이스, 실시간 스트리밍, MLOps, LLM API는 구현하지 않았습니다. 외부 프레임워크 없이 pandas, NumPy, Tableau Extensions API와 Vanilla JS만 사용했습니다.

## 실제 적용 구조와 보안

```text
Tableau Extension
→ 사내 API Gateway
→ CMMS / MES / Slack / Teams
→ Action Result
→ 운영 DB 및 Tableau
```

Extension은 사용자 브라우저에서 실행되므로 API 키, webhook URL, 서비스 계정 정보를 JavaScript나 `.trex`에 저장하면 안 됩니다. 인증·권한·감사 로그·입력 검증·rate limit은 사내 API Gateway에서 처리하고 HTTPS와 짧은 수명의 사용자 토큰을 사용해야 합니다. 실제 제어 명령은 별도 승인 및 안전 인터록을 통과해야 합니다.
