# 60초 데모 시나리오

| 시간 | 화면/동작 | 발표 멘트 |
|---:|---|---|
| 0–8초 | 전체 대시보드 | “현재 한 생산 라인의 6개 설비를 모니터링하고 있습니다.” |
| 8–16초 | Machine 600 선택 | “Tableau가 Critical 상태인 Machine 600을 우선순위 상단에 표시합니다.” |
| 16–27초 | Extension 위험/센서 카드 | “진동과 온도가 기준 분포에서 벗어났고 Sensor-based Risk Score는 92입니다. 이는 예측 확률이 아니라 이상 기반 유지보수 우선순위입니다.” |
| 27–36초 | 원인/권장 조치 | “AI-assisted Risk Assessment가 주요 원인을 High Vibration으로 설명하고 베어링과 정렬 점검을 권장합니다.” |
| 36–48초 | Create Work Order → Confirm | “분석 화면을 떠나지 않고 작업지시를 생성합니다.” |
| 48–55초 | 생성 ID/History | “`WO-20260730-0001` 형식의 Mock 작업지시가 생성되고 Action History에 기록됩니다.” |
| 55–60초 | 전체 화면 | “기존에는 별도 CMMS로 이동했지만, 이제 Tableau 안에서 탐지부터 다음 행동까지 이어집니다.” |

Work Order와 알림은 해커톤용 Mock이며, 실제 적용 시 Extension은 사내 API Gateway를 통해 CMMS/MES/협업 도구와 연결합니다.
