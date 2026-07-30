window.MACHINE_DATA = {
  "600": { machineId:"600", line:"60A1B", readingTimestamp:"2026-07-30 14:35", noise:110.4, oilLevel:0.93, temperature:208.9, vibration:0.26, breakdown:1, riskScore:92, riskLevel:"Critical", primaryCause:"High Vibration", recommendedAction:"Inspect bearing and alignment; Reduce machine load; Schedule vibration inspection", statuses:{temperature:"High",noise:"Warning",oil:"Normal",vibration:"High"} },
  "601": { machineId:"601", line:"60A1B", readingTimestamp:"2026-07-30 14:35", noise:103.2, oilLevel:0.74, temperature:201.6, vibration:0.18, breakdown:0, riskScore:74, riskLevel:"Warning", primaryCause:"Low Oil Level", recommendedAction:"Check oil leakage; Refill lubrication oil; Inspect lubrication system", statuses:{temperature:"Warning",noise:"Warning",oil:"High",vibration:"Warning"} },
  "602": { machineId:"602", line:"60A1B", readingTimestamp:"2026-07-30 14:35", noise:89.1, oilLevel:1.08, temperature:178.2, vibration:0.05, breakdown:0, riskScore:31, riskLevel:"Normal", primaryCause:"No Significant Anomaly", recommendedAction:"Continue monitoring", statuses:{temperature:"Normal",noise:"Normal",oil:"Normal",vibration:"Normal"} },
  "603": { machineId:"603", line:"60A1B", readingTimestamp:"2026-07-30 14:35", noise:116.8, oilLevel:0.98, temperature:190.4, vibration:0.09, breakdown:0, riskScore:66, riskLevel:"Warning", primaryCause:"High Noise", recommendedAction:"Inspect loose components; Check bearing wear; Notify maintenance", statuses:{temperature:"Normal",noise:"High",oil:"Normal",vibration:"Normal"} },
  "604": { machineId:"604", line:"60A1B", readingTimestamp:"2026-07-30 14:35", noise:92.7, oilLevel:1.02, temperature:214.1, vibration:0.12, breakdown:1, riskScore:87, riskLevel:"Critical", primaryCause:"High Temperature", recommendedAction:"Inspect cooling system; Check lubrication; Create maintenance work order", statuses:{temperature:"High",noise:"Normal",oil:"Normal",vibration:"Warning"} },
  "605": { machineId:"605", line:"60A1B", readingTimestamp:"2026-07-30 14:35", noise:87.4, oilLevel:1.11, temperature:176.8, vibration:0.04, breakdown:0, riskScore:18, riskLevel:"Normal", primaryCause:"No Significant Anomaly", recommendedAction:"Continue monitoring", statuses:{temperature:"Normal",noise:"Normal",oil:"Normal",vibration:"Normal"} }
};

// 최근 30분 변화량과 유사 사례는 해커톤 시연을 위한 예시 데이터입니다.
window.MACHINE_ANALYTICS = {
  "600": {trend:{temperature:18.0,noise:12.1,oil:-0.08,vibration:0.11},similar:{machine:"602",match:87,condition:"고진동·고온 패턴",action:"베어링 교체 및 축 정렬",result:"정비 후 진동 정상화"}},
  "601": {trend:{temperature:4.2,noise:3.4,oil:-0.12,vibration:0.03},similar:{machine:"604",match:82,condition:"오일 저하 패턴",action:"누유 보수 및 윤활유 보충",result:"오일 수준 정상화"}},
  "602": {trend:{temperature:1.1,noise:-0.8,oil:0.01,vibration:0.00},similar:{machine:"605",match:71,condition:"정상 운전 패턴",action:"정기 모니터링",result:"이상 없음"}},
  "603": {trend:{temperature:2.8,noise:14.6,oil:-0.01,vibration:0.02},similar:{machine:"600",match:79,condition:"소음 증가 패턴",action:"체결부 및 베어링 점검",result:"소음 감소"}},
  "604": {trend:{temperature:21.4,noise:5.7,oil:-0.04,vibration:0.06},similar:{machine:"600",match:89,condition:"고온·진동 동반 패턴",action:"냉각 계통 점검 및 윤활",result:"온도 정상화"}},
  "605": {trend:{temperature:-0.6,noise:0.4,oil:0.00,vibration:0.00},similar:{machine:"602",match:73,condition:"정상 운전 패턴",action:"정기 모니터링",result:"이상 없음"}}
};
