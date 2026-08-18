// ⚠️ 정적 배포 빌드입니다. Slack 발송 기능이 제거되었습니다.
// 조치는 브라우저 로컬 조치 이력에만 기록됩니다.
// 원본은 main 브랜치의 extension/app.js 이며, scripts/build_static.py 로 생성됩니다.
"use strict";

const TARGET_WORKSHEET_NAME = "Machine Priority List";
const MACHINE_ID_FIELDS = ["Machine ID", "ATTR(Machine ID)", "AGG(Machine ID)"];
const HISTORY_KEY = "pm-action-center-history-v1";
const MAX_HISTORY = 5;
const SENSOR_THRESHOLDS = {
  temperature: {value: 190, unit: "°F", direction: "이상"},
  vibration: {value: 0.20, unit: "", direction: "이상"},
  noise: {value: 100, unit: " dB", direction: "이상"},
  oil: {value: 0.80, unit: "", direction: "미만"},
};
const SOP = {
  "High Temperature": ["설비 운전 상태를 확인합니다.", "냉각 시스템을 점검합니다.", "오일 수준과 누유 여부를 확인합니다.", "온도가 계속 상승하면 부하를 낮춥니다.", "임계값 초과가 지속되면 작업지시를 생성합니다."],
  "High Vibration": ["설비 부하를 낮춥니다.", "베어링 상태를 점검합니다.", "축 정렬 상태를 확인합니다.", "느슨해진 부품을 점검합니다.", "유지보수 작업지시를 생성합니다."],
  "Low Oil Level": ["오일 누유 여부를 확인합니다.", "오일이 위험 수준보다 낮으면 설비를 정지합니다.", "승인된 윤활유를 보충합니다.", "윤활 시스템을 점검합니다.", "조치 결과를 기록합니다."],
  "High Noise": ["이상 소음의 발생 위치를 확인합니다.", "베어링과 회전 부품을 점검합니다.", "볼트와 덮개의 풀림을 확인합니다.", "설비 부하를 낮춥니다.", "유지보수팀에 알립니다."],
  "No Significant Anomaly": ["정기 모니터링을 계속합니다.", "작업자 관찰 사항을 기록합니다.", "다음 예정 점검에서 상태를 재확인합니다."]
};
const KOREAN = {
  Critical:"위험", Warning:"주의", Normal:"정상",
  High:"높음", Created:"생성됨", Sent:"기록됨",
  "Escalated":"상향 보고됨", "Escalated with warning":"주의 상태로 상향 보고됨",
  "High Temperature":"고온", "High Vibration":"고진동",
  "Low Oil Level":"오일 부족", "High Noise":"고소음",
  "No Significant Anomaly":"유의한 이상 없음",
  "Inspect cooling system":"냉각 시스템 점검",
  "Check lubrication":"윤활 상태 확인",
  "Create maintenance work order":"유지보수 작업지시 생성",
  "Inspect bearing and alignment":"베어링 및 축 정렬 점검",
  "Reduce machine load":"설비 부하 감소",
  "Schedule vibration inspection":"진동 점검 일정 등록",
  "Check oil leakage":"오일 누유 확인",
  "Refill lubrication oil":"윤활유 보충",
  "Inspect lubrication system":"윤활 시스템 점검",
  "Inspect loose components":"느슨한 부품 점검",
  "Check bearing wear":"베어링 마모 확인",
  "Notify maintenance":"유지보수팀 알림",
  "Continue monitoring":"모니터링 계속",
  "CREATE_WORK_ORDER":"작업지시 생성",
  "NOTIFY_MAINTENANCE":"유지보수팀 알림",
  "ESCALATE_ISSUE":"이슈 상향 보고"
};
const DETAILED_ACTIONS = {
  "High Vibration": [
    "설비 부하를 안전 운전 범위까지 낮추고 진동·소음·온도의 추가 상승 여부를 확인합니다.",
    "베어링의 마모, 유격, 윤활 상태와 이상 발열 여부를 점검합니다.",
    "커플링과 축 정렬 상태를 측정하고 체결부·마운트의 풀림 여부를 확인합니다.",
    "휴대용 진동계로 정밀 진동 측정을 수행하고 필요하면 베어링 교체 작업을 예약합니다.",
    "점검 결과와 측정값을 작업지시에 기록하고 조치 후 진동값을 재확인합니다.",
  ],
  "High Temperature": [
    "설비 부하를 낮추고 온도가 계속 상승하는지 확인합니다.",
    "냉각팬, 냉각수, 필터와 열교환 계통의 막힘 또는 작동 불량을 점검합니다.",
    "오일 수준, 윤활 상태와 누유 여부를 확인합니다.",
    "베어링과 모터의 국부 발열 지점을 확인하고 필요하면 열화상 점검을 수행합니다.",
    "조치 후 온도가 관리 기준 아래로 복귀하는지 확인하고 결과를 기록합니다.",
  ],
  "Low Oil Level": [
    "사이트 글라스 또는 계측값으로 실제 오일 수준을 재확인합니다.",
    "씰, 배관, 연결부와 오일 팬의 누유 흔적을 점검합니다.",
    "위험 수준이면 설비를 안전하게 정지하고 승인된 규격의 윤활유를 보충합니다.",
    "윤활 펌프, 필터와 공급 라인의 막힘 또는 압력 이상을 점검합니다.",
    "보충 후 오일 수준과 압력을 재확인하고 누유 원인 및 조치 내용을 기록합니다.",
  ],
  "High Noise": [
    "안전거리에서 이상 소음의 위치와 발생 조건을 확인합니다.",
    "베어링, 기어, 커플링과 회전 부품의 마모 또는 간섭 여부를 점검합니다.",
    "볼트, 커버, 가드와 마운트의 풀림 여부를 확인하고 규정 토크로 체결합니다.",
    "진동값과 온도를 함께 확인하여 회전체 이상 가능성을 교차 검증합니다.",
    "조치 후 소음값을 다시 측정하고 관리 기준 복귀 여부를 기록합니다.",
  ],
  "No Significant Anomaly": [
    "현재 운전 상태와 작업자 관찰 사항을 기록합니다.",
    "정기 모니터링을 유지하고 다음 측정값의 변화 방향을 확인합니다.",
    "동일 이상이 반복되면 정밀 점검을 위한 작업지시를 생성합니다.",
  ],
};

let currentMachine = null;
let actionHistory = loadHistory();

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  populateMachineSelect();
  bindUiEvents();
  renderActionHistory();
  initializeExtension();
});

async function initializeExtension() {
  if (!window.tableau?.extensions) {
    updateDebug({ apiStatus: "실패: Tableau Extensions API 없음" });
    initializeDemoMode("Tableau Extensions API를 불러오지 못했습니다.");
    return;
  }
  try {
    await tableau.extensions.initializeAsync();
    updateDebug({ apiStatus: "연결됨" });
    await bindTableauEvents();
    $("modeBadge").textContent = "TABLEAU 모드";
    $("demoControls").hidden = true;
    await handleSelection();
  } catch (error) {
    console.error("Tableau initialization failed; using Demo Mode.", error);
    updateDebug({ apiStatus: `초기화 실패: ${error.message || error}` });
    initializeDemoMode("Tableau 초기화 실패 — 데모 모드로 전환했습니다.");
  }
}

async function bindTableauEvents() {
  const dashboard = tableau.extensions.dashboardContent.dashboard;
  const preferredWorksheet = dashboard.worksheets.find(
    (sheet) => sheet.name === TARGET_WORKSHEET_NAME
  );
  const worksheets = preferredWorksheet
    ? [preferredWorksheet, ...dashboard.worksheets.filter((sheet) => sheet !== preferredWorksheet)]
    : dashboard.worksheets;

  if (!worksheets.length) throw new Error("대시보드에서 워크시트를 찾을 수 없습니다.");
  updateDebug({ worksheets: worksheets.map((sheet) => sheet.name).join(", ") });

  // Listen to every worksheet so the extension also works with existing
  // dashboards whose sheet names differ from the recommended default.
  worksheets.forEach((worksheet) => {
    worksheet.addEventListener(
      tableau.TableauEventType.MarkSelectionChanged,
      () => handleSelection(worksheet)
    );
  });
  window.targetWorksheets = worksheets;
}

async function handleSelection(selectedWorksheet = null) {
  try {
    let machineId = null;
    if (selectedWorksheet) {
      const marks = await selectedWorksheet.getSelectedMarksAsync();
      machineId = parseSelectedMachineId(marks);
      updateDebug({
        event: `${selectedWorksheet.name} · ${new Date().toLocaleTimeString("ko-KR")}`,
        machineId: machineId || "추출 실패",
        payload: summarizeMarks(marks),
      });
    } else {
      // On startup, inspect all sheets because Tableau may restore an existing
      // selection before the extension finishes initializing.
      for (const worksheet of window.targetWorksheets || []) {
        const marks = await worksheet.getSelectedMarksAsync();
        machineId = parseSelectedMachineId(marks);
        if (machineId) {
          updateDebug({
            event: `${worksheet.name} · 초기 선택`,
            machineId,
            payload: summarizeMarks(marks),
          });
        }
        if (machineId) break;
      }
    }
    if (!machineId) {
      renderEmpty("Tableau에서 설비를 선택하세요.");
      return;
    }
    const machine = await loadMachineData(machineId);
    if (!machine) throw new Error(`설비 ${machineId} 데이터를 찾을 수 없습니다.`);
    renderMachine(machine);
  } catch (error) {
    console.error("Selection handling failed.", error);
    showStatusMessage(error.message, true);
  }
}

function summarizeMarks(marks) {
  const tables = marks?.data || [];
  if (!tables.length) return "선택된 마크가 없습니다.";
  return tables.map((table, tableIndex) => {
    const columns = table.columns || [];
    const rows = (table.data || []).slice(0, 3).map((row) =>
      Object.fromEntries(columns.map((column, index) => {
        const cell = row[index];
        return [
          column.fieldName || column.caption || `Column ${index + 1}`,
          cell?.formattedValue ?? cell?.value ?? cell ?? null,
        ];
      }))
    );
    return `데이터 표 ${tableIndex + 1}\n${JSON.stringify(rows, null, 2)}`;
  }).join("\n\n");
}

function updateDebug({apiStatus, worksheets, event, machineId, payload}) {
  if (apiStatus !== undefined) {
    $("debugApiStatus").textContent = apiStatus;
    const failed = apiStatus.includes("실패") || apiStatus.includes("없음");
    $("debugSummaryStatus").textContent = failed ? "연결 오류" : apiStatus;
    $("debugPanel").open = failed;
  }
  if (worksheets !== undefined) $("debugWorksheets").textContent = worksheets || "-";
  if (event !== undefined) $("debugEvent").textContent = event || "-";
  if (machineId !== undefined) $("debugMachineId").textContent = machineId || "-";
  if (payload !== undefined) $("debugPayload").textContent = payload;
}

function parseSelectedMachineId(marks) {
  for (const table of marks?.data || []) {
    const columns = table.columns || [];
    const index = columns.findIndex((column) => {
      const names = [column.fieldName, column.caption]
        .filter(Boolean)
        .map((value) => String(value).trim());
      return names.some(
        (name) =>
          MACHINE_ID_FIELDS.includes(name) ||
          name.replace(/^(ATTR|AGG|MIN|MAX)\((.+)\)$/i, "$2") === "Machine ID"
      );
    });
    if (index >= 0 && table.data?.length) {
      const cell = table.data[0][index];
      const value = cell?.value ?? cell?.formattedValue ?? cell;
      if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
    }
  }
  return null;
}

async function loadMachineData(machineId) {
  const id = String(machineId).trim();
  if (window.MACHINE_DATA?.[id]) return window.MACHINE_DATA[id];
  try {
    const response = await fetch("../data/machine_latest_status.csv");
    if (!response.ok) return null;
    const rows = parseCsv(await response.text());
    const row = rows.find((item) => String(item["Machine ID"]).trim() === id);
    return row ? normalizeCsvRow(row) : null;
  } catch (error) {
    console.warn("CSV fallback unavailable.", error);
    return null;
  }
}

function initializeDemoMode(message) {
  $("modeBadge").textContent = "데모 모드";
  $("demoControls").hidden = false;
  $("demoButton").hidden = true;
  renderMachine(window.MACHINE_DATA[$("machineSelect").value || "600"]);
  if (message) showStatusMessage(message);
}

function populateMachineSelect() {
  $("machineSelect").innerHTML = Object.keys(window.MACHINE_DATA || {}).map(
    (id) => `<option value="${escapeHtml(id)}">설비 ${escapeHtml(id)}</option>`
  ).join("");
}

function bindUiEvents() {
  $("machineSelect").addEventListener("change", (event) => renderMachine(window.MACHINE_DATA[event.target.value]));
  $("demoButton").addEventListener("click", () => initializeDemoMode("데모 모드가 활성화되었습니다."));
  $("workOrderButton").addEventListener("click", openWorkOrderConfirmation);
  $("notifyButton").addEventListener("click", notifyMaintenance);
  $("sopButton").addEventListener("click", openSop);
  $("escalateButton").addEventListener("click", escalateIssue);
  $("clearHistoryButton").addEventListener("click", clearHistory);
}

function renderEmpty(title) {
  $("machinePanel").hidden = true;
  $("emptyState").hidden = false;
  $("emptyState").style.display = "grid";
  $("emptyState").querySelector("h2").textContent = title;
}

function renderMachine(machine) {
  if (!machine) return renderEmpty("설비 데이터를 찾을 수 없습니다.");
  currentMachine = machine;
  $("emptyState").hidden = true;
  $("emptyState").style.display = "none";
  $("machinePanel").hidden = false;
  $("machineId").textContent = machine.machineId;
  $("lastReading").textContent = `라인 ${machine.line} · ${machine.readingTimestamp}`;
  $("riskScore").textContent = Math.round(machine.riskScore);
  $("riskBadge").textContent = translate(machine.riskLevel);
  $("riskBadge").className = `risk-badge ${machine.riskLevel.toLowerCase()}`;
  $("heroCard").className = `hero-card hero-${machine.riskLevel.toLowerCase()}`;
  $("primaryCause").textContent = translate(machine.primaryCause);
  $("breakdownStatus").textContent = machine.breakdown ? "● 현재 고장 상태: 예" : "현재 고장 상태: 아니요";
  $("recommendations").innerHTML = calculateRecommendation(machine).map((item) => `<li>${escapeHtml(translate(item))}</li>`).join("");
  const sensors = [
    ["온도", `${machine.temperature} °F`, machine.statuses.temperature],
    ["소음", `${machine.noise} dB`, machine.statuses.noise],
    ["오일 수준", machine.oilLevel, machine.statuses.oil],
    ["진동 변화량", machine.vibration, machine.statuses.vibration]
  ];
  $("sensorGrid").innerHTML = sensors.map(([name, value, status]) =>
    `<div class="sensor sensor-${escapeHtml(status)}"><span>${escapeHtml(name)}</span><strong>${escapeHtml(value)}</strong><em class="status-${escapeHtml(status)}">${escapeHtml(translate(status))}</em></div>`
  ).join("");
  renderAdvancedAnalysis(machine);
  $("escalateButton").disabled = machine.riskLevel === "Normal";
  renderActionHistory();
}

function renderAdvancedAnalysis(machine) {
  const analytics = window.MACHINE_ANALYTICS?.[String(machine.machineId)] || {
    trend:{temperature:0, noise:0, oil:0, vibration:0},
    similar:{machine:"-", match:0, condition:"사례 없음", action:"정기 모니터링", result:"-"},
  };
  const rawComponents = [
    {name:"온도", score:sensorSeverity(machine.temperature, SENSOR_THRESHOLDS.temperature.value, "high")},
    {name:"진동", score:sensorSeverity(machine.vibration, SENSOR_THRESHOLDS.vibration.value, "high")},
    {name:"소음", score:sensorSeverity(machine.noise, SENSOR_THRESHOLDS.noise.value, "high")},
    {name:"오일", score:sensorSeverity(machine.oilLevel, SENSOR_THRESHOLDS.oil.value, "low")},
  ];
  const total = rawComponents.reduce((sum, item) => sum + item.score, 0) || 1;
  const contributions = rawComponents
    .map((item) => ({...item, percent:Math.round(item.score / total * 100)}))
    .sort((a, b) => b.percent - a.percent);
  $("causeContribution").innerHTML = contributions.map((item) =>
    `<div class="contribution-row"><span>${item.name}</span><div class="bar-track"><div class="bar-fill" style="width:${item.percent}%"></div></div><strong>${item.percent}%</strong></div>`
  ).join("");

  const thresholds = [
    ["온도", `${machine.temperature}°F`, "190°F", machine.statuses.temperature],
    ["진동", machine.vibration, "0.20", machine.statuses.vibration],
    ["소음", `${machine.noise} dB`, "100 dB", machine.statuses.noise],
    ["오일", machine.oilLevel, "0.80", machine.statuses.oil],
  ];
  $("thresholdTable").innerHTML =
    `<div class="threshold-row header"><span>센서</span><span>현재</span><span>기준</span><span>상태</span></div>` +
    thresholds.map(([name, current, threshold, status]) =>
      `<div class="threshold-row"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(current)}</span><span>${escapeHtml(threshold)}</span><span class="status-dot status-${escapeHtml(status)}">● ${escapeHtml(translate(status))}</span></div>`
    ).join("");

  const trends = [
    ["온도", analytics.trend.temperature, "°F"],
    ["진동", analytics.trend.vibration, ""],
    ["소음", analytics.trend.noise, " dB"],
    ["오일", analytics.trend.oil, ""],
  ];
  $("trendGrid").innerHTML = trends.map(([name, value, unit]) => {
    const direction = value > 0 ? "↑" : value < 0 ? "↓" : "→";
    const sign = value > 0 ? "+" : "";
    const riskDirection = name === "오일" ? value < 0 : value > 0;
    return `<div class="trend-item"><span>${name}</span><strong class="${riskDirection ? "trend-up" : "trend-down"}">${direction} ${sign}${value}${unit}</strong></div>`;
  }).join("");

  const incident = analytics.similar;
  $("similarIncident").innerHTML = `<div class="incident-box">
    <div class="incident-match"><strong>설비 ${escapeHtml(incident.machine)}</strong><span>패턴 유사도 ${escapeHtml(incident.match)}%</span></div>
    <div class="incident-details">
      <span>유사 조건</span><strong>${escapeHtml(incident.condition)}</strong>
      <span>당시 조치</span><strong>${escapeHtml(incident.action)}</strong>
      <span>조치 결과</span><strong>${escapeHtml(incident.result)}</strong>
    </div>
  </div>`;

  const downtime = Math.max(0.3, machine.riskScore / 38).toFixed(1);
  const cost = Math.round(machine.riskScore * 10000 / 10000) * 10000;
  const loss = Math.round(machine.riskScore * 4.7);
  const health = Math.max(0, 100 - Math.round(machine.riskScore));
  $("impactGrid").innerHTML = [
    ["예상 중단시간", `${downtime}시간`],
    ["예상 비용", `${cost.toLocaleString("ko-KR")}원`],
    ["생산 손실", `${loss.toLocaleString("ko-KR")}개`],
    ["설비 건강도", `${health}점`],
  ].map(([label, value]) => `<div class="impact-item"><span>${label}</span><strong>${value}</strong></div>`).join("");

  const topCause = contributions[0];
  $("analysisSummary").innerHTML = `<strong>분석 요약</strong><p>설비 ${escapeHtml(machine.machineId)}의 위험 점수는 ${escapeHtml(machine.riskScore)}점이며, 가장 큰 이상 기여 센서는 ${escapeHtml(topCause.name)}(${topCause.percent}%)입니다. ${escapeHtml(translate(machine.primaryCause))} 패턴과 유사하므로 ${escapeHtml(translate(calculateRecommendation(machine)[0]))}을 우선 실행하십시오.</p>`;
}

function sensorSeverity(value, threshold, direction) {
  if (direction === "low") {
    return Math.max(5, Math.min(100, (threshold / Math.max(value, 0.01)) * 55));
  }
  return Math.max(5, Math.min(100, (value / threshold) * 55));
}

function calculateRecommendation(machine) {
  return String(machine.recommendedAction || "Continue monitoring").split(";").map((item) => item.trim()).filter(Boolean);
}

function openWorkOrderConfirmation() {
  if (!currentMachine) return;
  $("dialogTitle").textContent = "작업지시 생성";
  $("dialogBody").innerHTML = `<dl class="detail-list">
    <dt>설비 ID</dt><dd>${escapeHtml(currentMachine.machineId)}</dd>
    <dt>위험 수준</dt><dd>${escapeHtml(translate(currentMachine.riskLevel))}</dd>
    <dt>주요 원인</dt><dd>${escapeHtml(translate(currentMachine.primaryCause))}</dd>
    <dt>우선순위</dt><dd>${escapeHtml(translate(currentMachine.riskLevel))}</dd>
    <dt>요청 사유</dt><dd>${escapeHtml(translate(calculateRecommendation(currentMachine)[0]))}</dd>
  </dl>
  <p class="muted">아래 버튼을 누르면 작업지시가 생성되어 조치 이력에 기록됩니다.</p>`;
  const confirm = $("dialogConfirm");
  confirm.textContent = "작업지시 생성";
  confirm.onclick = (event) => { event.preventDefault(); createWorkOrder(); };
  $("actionDialog").showModal();
}

async function createWorkOrder() {
  await runButtonAction($("dialogConfirm"), async () => {
    const actionId = nextActionId("WO");
    addActionHistory({
      actionId, actionType:"CREATE_WORK_ORDER", machineId:currentMachine.machineId,
      priority:currentMachine.riskLevel, status:"Created", createdAt:new Date().toISOString(),
      primaryCause:currentMachine.primaryCause, riskScore:currentMachine.riskScore
    });
    $("actionDialog").close();
    $("dialogConfirm").textContent = "확인";
    showStatusMessage(`${actionId} 작업지시를 생성했습니다.`);
  });
}

function buildWorkOrderSlackPayload(actionId, machine) {
  const priority = machine.riskLevel === "Critical"
    ? {code:"P1", response:"30분"}
    : machine.riskLevel === "Warning"
      ? {code:"P2", response:"2시간"}
      : {code:"P4", response:"다음 정기점검"};
  const recommendations = numberedRecommendations(machine);
  const causeAnalysis = detailedCauseAnalysis(machine);
  const fallbackText = `작업지시 ${actionId} · 설비 ${machine.machineId} · ${translate(machine.riskLevel)} ${machine.riskScore}점 · 담당 {{ASSIGNEE}}`;
  return {
    text: fallbackText,
    blocks: [
      {type:"header", text:{type:"plain_text", text:"예지보전 작업지시 알림", emoji:false}},
      {type:"section", text:{type:"mrkdwn", text:`*작업지시 생성 완료*\n\`${actionId}\``}},
      {type:"section", fields:[
        {type:"mrkdwn", text:`*생산 라인*\n${machine.line}`},
        {type:"mrkdwn", text:`*설비*\nEQP-${machine.machineId}`},
        {type:"mrkdwn", text:`*위험도*\n${machine.riskLevel} (${machine.riskScore}점)`},
        {type:"mrkdwn", text:`*발생 시각*\n${machine.readingTimestamp}`},
        {type:"mrkdwn", text:`*우선순위*\n${priority.code}`},
        {type:"mrkdwn", text:`*대응 목표*\n${priority.response} 이내`},
      ]},
      {type:"divider"},
      {type:"section", text:{type:"mrkdwn", text:"*현재 센서 상태*"}},
      {type:"section", fields:[
        {type:"mrkdwn", text:`*온도*\n${statusIndicator(machine.statuses.temperature)} ${machine.temperature}°F · ${translate(machine.statuses.temperature)}\n_관리 기준: ${SENSOR_THRESHOLDS.temperature.value}°F 이상_`},
        {type:"mrkdwn", text:`*진동 변화량*\n${statusIndicator(machine.statuses.vibration)} ${machine.vibration} · ${translate(machine.statuses.vibration)}\n_관리 기준: ${SENSOR_THRESHOLDS.vibration.value} 이상_`},
        {type:"mrkdwn", text:`*소음*\n${statusIndicator(machine.statuses.noise)} ${machine.noise} dB · ${translate(machine.statuses.noise)}\n_관리 기준: ${SENSOR_THRESHOLDS.noise.value} dB 이상_`},
        {type:"mrkdwn", text:`*오일 수준*\n${statusIndicator(machine.statuses.oil)} ${machine.oilLevel} · ${translate(machine.statuses.oil)}\n_관리 기준: ${SENSOR_THRESHOLDS.oil.value} 미만_`},
      ]},
      {type:"divider"},
      {type:"section", text:{type:"mrkdwn", text:`*원인 분석*\n*${translate(machine.primaryCause)}*\n${causeAnalysis}`}},
      {type:"section", text:{type:"mrkdwn", text:`*권장 조치*\n${recommendations}`}},
      {type:"divider"},
      {type:"section", fields:[
        {type:"mrkdwn", text:"*담당자*\n{{ASSIGNEE}}"},
        {type:"mrkdwn", text:"*담당팀*\nMaintenance Team"},
        {type:"mrkdwn", text:"*유지보수 유형*\nPredictive"},
        {type:"mrkdwn", text:"*상태*\n생성됨"},
      ]},
      {type:"context", elements:[{type:"mrkdwn", text:"Tableau Manufacturing Action Center에서 자동 생성"}]},
    ],
  };
}

function statusIndicator(status) {
  return status === "High"
    ? ":red_circle:"
    : status === "Warning"
      ? ":large_yellow_circle:"
      : ":large_green_circle:";
}

async function notifyMaintenance() {
  if (!currentMachine) return;
  await runButtonAction($("notifyButton"), async () => {
    const actionId = nextActionId("NTF");
    addActionHistory({actionId, actionType:"NOTIFY_MAINTENANCE", machineId:currentMachine.machineId, status:"Sent", createdAt:new Date().toISOString(), primaryCause:currentMachine.primaryCause, riskScore:currentMachine.riskScore});
    showStatusMessage(`${actionId} 유지보수팀 알림을 이력에 기록했습니다.`);
  });
}

function buildMaintenanceNotificationPayload(actionId, machine) {
  const recommendations = numberedRecommendations(machine);
  const causeAnalysis = detailedCauseAnalysis(machine);
  const priority = machine.riskLevel === "Critical"
    ? {code:"긴급 확인", response:"30분"}
    : machine.riskLevel === "Warning"
      ? {code:"우선 확인", response:"2시간"}
      : {code:"일반 확인", response:"다음 정기점검"};
  return {
    text: `유지보수 점검 요청 ${actionId} · 설비 ${machine.machineId} · ${translate(machine.riskLevel)} ${machine.riskScore}점 · 담당 {{ASSIGNEE}}`,
    blocks: [
      {type:"header", text:{type:"plain_text", text:"유지보수팀 점검 요청", emoji:false}},
      {type:"section", text:{type:"mrkdwn", text:`*이상 설비 현장 확인 요청*\n알림 ID: \`${actionId}\``}},
      {type:"section", fields:[
        {type:"mrkdwn", text:`*생산 라인*\n${machine.line}`},
        {type:"mrkdwn", text:`*설비*\nEQP-${machine.machineId}`},
        {type:"mrkdwn", text:`*위험도*\n${machine.riskLevel} (${machine.riskScore}점)`},
        {type:"mrkdwn", text:`*발생 시각*\n${machine.readingTimestamp}`},
        {type:"mrkdwn", text:`*확인 수준*\n${priority.code}`},
        {type:"mrkdwn", text:`*확인 목표*\n${priority.response} 이내`},
      ]},
      {type:"divider"},
      {type:"section", text:{type:"mrkdwn", text:"*현재 센서 상태*"}},
      {type:"section", fields:[
        {type:"mrkdwn", text:`*온도*\n${statusIndicator(machine.statuses.temperature)} ${machine.temperature}°F · ${translate(machine.statuses.temperature)}\n_관리 기준: ${SENSOR_THRESHOLDS.temperature.value}°F 이상_`},
        {type:"mrkdwn", text:`*진동 변화량*\n${statusIndicator(machine.statuses.vibration)} ${machine.vibration} · ${translate(machine.statuses.vibration)}\n_관리 기준: ${SENSOR_THRESHOLDS.vibration.value} 이상_`},
        {type:"mrkdwn", text:`*소음*\n${statusIndicator(machine.statuses.noise)} ${machine.noise} dB · ${translate(machine.statuses.noise)}\n_관리 기준: ${SENSOR_THRESHOLDS.noise.value} dB 이상_`},
        {type:"mrkdwn", text:`*오일 수준*\n${statusIndicator(machine.statuses.oil)} ${machine.oilLevel} · ${translate(machine.statuses.oil)}\n_관리 기준: ${SENSOR_THRESHOLDS.oil.value} 미만_`},
      ]},
      {type:"divider"},
      {type:"section", text:{type:"mrkdwn", text:`*원인 분석 · ${translate(machine.primaryCause)}*\n${causeAnalysis}`}},
      {type:"section", text:{type:"mrkdwn", text:`*권장 확인사항*\n${recommendations}`}},
      {type:"divider"},
      {type:"section", fields:[
        {type:"mrkdwn", text:"*확인 담당자*\n{{ASSIGNEE}}"},
        {type:"mrkdwn", text:"*담당팀*\nMaintenance Team"},
        {type:"mrkdwn", text:"*알림 상태*\n전송됨"},
        {type:"mrkdwn", text:"*다음 단계*\n현장 확인 후 작업지시 전환 판단"},
      ]},
      {type:"context", elements:[{type:"mrkdwn", text:"이 알림은 작업지시가 아닙니다. 현장 확인 후 정비가 필요하면 작업지시를 생성하십시오."}]},
      {type:"context", elements:[{type:"mrkdwn", text:"Tableau Manufacturing Action Center에서 자동 생성"}]},
    ],
  };
}

function numberedRecommendations(machine) {
  const actions = DETAILED_ACTIONS[machine.primaryCause]
    || calculateRecommendation(machine).map(translate);
  return actions.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function detailedCauseAnalysis(machine) {
  const analysis = {
    "High Vibration":
      `현재 진동 변화량은 *${machine.vibration}*로 관리 기준 *${SENSOR_THRESHOLDS.vibration.value}*를 초과했습니다. ` +
      `동시에 온도는 ${machine.temperature}°F, 소음은 ${machine.noise} dB로 확인됩니다.\n` +
      "이 조합은 회전체 불균형, 베어링 마모, 축 정렬 불량 또는 체결부 풀림 가능성과 연관될 수 있습니다. " +
      "센서값만으로 원인을 확정할 수 없으므로 베어링 상태와 축 정렬을 우선 점검해야 합니다.",
    "High Temperature":
      `현재 온도는 *${machine.temperature}°F*로 관리 기준 *${SENSOR_THRESHOLDS.temperature.value}°F*를 초과했습니다. ` +
      `오일 수준은 ${machine.oilLevel}, 진동 변화량은 ${machine.vibration}입니다.\n` +
      "냉각 성능 저하, 윤활 부족, 과부하 또는 베어링 마찰 증가 가능성이 있습니다. " +
      "냉각 계통과 윤활 상태를 우선 확인한 후 국부 발열 원인을 점검해야 합니다.",
    "Low Oil Level":
      `현재 오일 수준은 *${machine.oilLevel}*로 관리 하한 *${SENSOR_THRESHOLDS.oil.value}*와 비교해 낮은 방향의 이상이 감지되었습니다. ` +
      `현재 온도는 ${machine.temperature}°F, 진동 변화량은 ${machine.vibration}입니다.\n` +
      "누유, 윤활유 공급 불량 또는 오일 계측 이상 가능성이 있습니다. " +
      "실제 오일 수준을 재확인하고 누유 및 윤활 계통을 우선 점검해야 합니다.",
    "High Noise":
      `현재 소음은 *${machine.noise} dB*로 관리 기준 *${SENSOR_THRESHOLDS.noise.value} dB*를 초과했습니다. ` +
      `진동 변화량은 ${machine.vibration}, 온도는 ${machine.temperature}°F입니다.\n` +
      "베어링 또는 기어 마모, 회전 부품 간섭, 체결부 풀림 가능성이 있습니다. " +
      "소음 발생 위치를 확인하고 진동·온도와 함께 교차 점검해야 합니다.",
    "No Significant Anomaly":
      `현재 위험 점수는 ${machine.riskScore}점이며 센서값에서 즉시 정비가 필요한 중대한 이상은 확인되지 않았습니다. ` +
      "현재 상태를 기록하고 정기 모니터링을 유지하십시오.",
  };
  return analysis[machine.primaryCause] || analysis["No Significant Anomaly"];
}

function openSop() {
  if (!currentMachine) return;
  $("dialogTitle").textContent = `${translate(currentMachine.primaryCause)} 표준작업절차`;
  $("dialogBody").innerHTML = `<p class="muted">승인된 제조사 절차서가 아닌 해커톤용 샘플 표준작업절차입니다.</p><ol class="sop-list">${(SOP[currentMachine.primaryCause] || SOP["No Significant Anomaly"]).map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>`;
  $("dialogConfirm").onclick = () => $("actionDialog").close();
  $("dialogConfirm").textContent = "닫기";
  $("actionDialog").showModal();
  $("actionDialog").addEventListener("close", () => { $("dialogConfirm").textContent = "확인"; }, {once:true});
}

async function escalateIssue() {
  if (!currentMachine || currentMachine.riskLevel === "Normal") return;
  await runButtonAction($("escalateButton"), async () => {
    const actionId = nextActionId("ESC");
    addActionHistory({actionId, actionType:"ESCALATE_ISSUE", machineId:currentMachine.machineId, status:currentMachine.riskLevel === "Critical" ? "Escalated" : "Escalated with warning", createdAt:new Date().toISOString(), primaryCause:currentMachine.primaryCause, riskScore:currentMachine.riskScore});
    showStatusMessage(`${actionId} 이슈가 상향 보고되었습니다. (데모)`);
  });
}

function nextActionId(prefix) {
  const date = new Date();
  const day = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
  const used = actionHistory.filter((item) => item.actionId.startsWith(`${prefix}-${day}`)).length;
  return `${prefix}-${day}-${String(used + 1).padStart(4,"0")}`;
}

function addActionHistory(action) {
  actionHistory = [action, ...actionHistory].slice(0, 100);
  saveHistory();
  renderActionHistory();
}

function renderActionHistory() {
  const visible = actionHistory.filter((item) => !currentMachine || item.machineId === currentMachine.machineId).slice(0, MAX_HISTORY);
  $("historyList").innerHTML = visible.length ? visible.map((item) =>
    `<div class="history-item"><strong>${escapeHtml(item.actionId)} · ${escapeHtml(translate(item.actionType))}</strong><span>${escapeHtml(translate(item.status))}</span><span>설비 ${escapeHtml(item.machineId)} · 위험 점수 ${escapeHtml(item.riskScore)} · ${escapeHtml(translate(item.primaryCause))} · ${escapeHtml(formatDate(item.createdAt))}</span></div>`
  ).join("") : `<p class="history-empty">아직 실행된 액션이 없습니다.</p>`;
}

function clearHistory() {
  actionHistory = [];
  saveHistory();
  renderActionHistory();
  showStatusMessage("Action History를 삭제했습니다.");
}

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch (error) { console.warn("localStorage unavailable; using memory.", error); return []; }
}

function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(actionHistory)); }
  catch (error) { console.warn("History is stored in memory only.", error); }
}

async function runButtonAction(button, action) {
  if (button.disabled) return;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "처리 중…";
  try { await new Promise((resolve) => setTimeout(resolve, 350)); await action(); }
  catch (error) { console.error("Action failed.", error); showStatusMessage(`실행 실패: ${error.message}`, true); }
  finally { button.disabled = false; button.textContent = original; }
}

function showStatusMessage(message, isError = false) {
  const toast = $("statusMessage");
  toast.textContent = message;
  toast.style.background = isError ? "#9f2929" : "#13213c";
  toast.hidden = false;
  clearTimeout(showStatusMessage.timer);
  showStatusMessage.timer = setTimeout(() => { toast.hidden = true; }, 5500);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const parse = (line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((cell) => cell.replace(/,$/,"").replace(/^"|"$/g,"").replace(/""/g,'"')) || [];
  const headers = parse(lines.shift());
  return lines.map((line) => Object.fromEntries(parse(line).map((value, index) => [headers[index], value])));
}

function normalizeCsvRow(row) {
  return {machineId:String(row["Machine ID"]),line:row.Line,readingTimestamp:row["Reading Timestamp"],noise:Number(row["Noise (Db)"]),oilLevel:Number(row["Oil Level"]),temperature:Number(row["Temperature (F)"]),vibration:Number(row["Vibration Delta"]),breakdown:Number(row["Unplanned Maintenance Breakdown"]),riskScore:Number(row["Risk Score"]),riskLevel:row["Risk Level"],primaryCause:row["Primary Cause"],recommendedAction:row["Recommended Action"],statuses:{temperature:row["Temperature Status"],noise:row["Noise Status"],oil:row["Oil Status"],vibration:row["Vibration Status"]}};
}

function formatDate(value) { return new Intl.DateTimeFormat("ko-KR",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)); }
function translate(value) { return KOREAN[String(value)] || String(value ?? ""); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[character])); }
