# Tableau 설정 가이드

## 1. 데이터 연결

1. `data/VW_MACHINE_DATA(1).csv`를 텍스트 파일로 연결합니다. Tableau가 구분자를 자동 인식하지 못하면 탭, 인코딩은 UTF-16으로 지정합니다.
2. `Reading Timestamp`가 날짜 및 시간 형식인지 확인합니다.
3. `data/machine_latest_status.csv`를 추가합니다.
4. 논리 계층에서 두 테이블의 `Machine ID = Machine ID` 관계를 만듭니다. 센서 시계열의 행 수를 보존하므로 물리 Join보다 Relationship을 권장합니다.
5. Join을 사용한다면 원본 데이터(다)에서 최신 상태(1)로 Left Join하고, 최신 상태 파일의 Machine ID가 유일한지 확인합니다.

원본 센서 테이블은 추세 차트에, 최신 상태 테이블은 우선순위·KPI·원인 분석에 사용합니다.

## 2. 워크시트

1. `Machine Priority List` 시트를 생성합니다.
2. 최신 상태의 `Machine ID`를 행 또는 마크의 **세부 정보**에 놓습니다.
3. `Risk Score`를 색상과 텍스트에, `Risk Level`과 `Primary Cause`를 도구 설명에 놓습니다.
4. 색상은 Critical=red, Warning=amber, Normal=green으로 설정하고 텍스트 레이블도 유지합니다.
5. KPI 시트: Critical Machines, Warning Machines, Breakdown Count, Average Risk Score를 만듭니다.
6. 원본 데이터로 Sensor Trend를 만들고 Machine ID 필터를 적용합니다.
7. 최신 상태로 Risk Score와 Sensor Cause Breakdown을 만듭니다.

## 3. 대시보드와 Extension

1. 1440×900 또는 1366×768 고정 크기 대시보드를 만듭니다.
2. `Machine Priority List`와 관련 시트를 배치합니다.
3. 대시보드의 필터 동작에서 Machine Priority List 선택이 다른 시트를 필터링하도록 설정합니다.
4. **Objects → Extension**을 오른쪽 패널에 끌어놓습니다.
5. **Local Extension**에서 `extension/predictive-maintenance.trex`를 선택합니다.
6. 프로젝트 루트에서 `python3 -m http.server 8765`가 실행 중인지 확인합니다.
7. Machine Priority List의 마크를 클릭합니다.
8. Extension의 Machine ID, 위험도, 원인과 센서 상태가 갱신되는지 확인합니다.

시트명이 다르면 `extension/app.js`의 `TARGET_WORKSHEET_NAME`을 변경합니다. 마크에는 `Machine ID`, `ATTR(Machine ID)`, `AGG(Machine ID)` 중 하나가 포함되어야 합니다. Extension에는 선택값의 Machine ID만 전달되어도 되며 나머지는 내장 데이터 또는 최신 상태 CSV에서 조회합니다.

## 문제 해결

- `Demo Mode`가 표시됨: Tableau API 로드, `.trex` URL, 로컬 서버 및 시트명을 확인합니다.
- 선택해도 갱신 안 됨: Machine ID가 마크 세부 정보에 포함됐는지 확인합니다.
- CSV 데이터 대신 샘플 표시: `prepare_data.py` 실행 여부와 `data/machine_latest_status.csv` 경로를 확인합니다. 내장 600~605 데이터가 우선 fallback 역할을 합니다.
- Tableau Server 배포: HTTPS 호스팅 URL로 `.trex`를 수정하고 관리자의 Extension allowlist 정책을 확인합니다.
