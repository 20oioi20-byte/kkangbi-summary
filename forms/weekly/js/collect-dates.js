function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function getMonday(d){
  const x=new Date(d); x.setHours(0,0,0,0);
  const day=x.getDay();
  x.setDate(x.getDate() + (day===0 ? -6 : 1-day));
  return x;
}
function fmtMD(d){ return `${d.getMonth()+1}.${d.getDate()}`; }
function fmtISO(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function pad2(n){ return String(n).padStart(2,'0'); }

// 응대율(collect-rate-panel.js) 전용 주차 계산 — 주간보고 본문(아래 getWeeksOfMonth)과 기준이
// 다르다(2026-07-30 사용자 요청으로 분리). 응대율은 매월 1일에 주차가 다시 시작하고 말일에서
// 잘리는 "월 anchored" 방식을 그대로 쓴다 — 예: 7월은 1주 7.1~7.5(1일~그 주 일요일),
// 2주 7.6~7.12, 3주 7.13~7.19, 4주 7.20~7.26, 5주 7.27~7.31(월말이라 7일 안 채우고 자름).
// 주간보고 쪽(getWeeksOfMonth)은 월 경계를 무시하고 항상 월~일 7일이 이어지도록 이미 바뀌었으니
// 절대 이 둘을 하나로 합치지 말 것 — 서로 다른 화면의 서로 다른 요구사항이다.
function getRateWeeksOfMonth(year, month){
  const first = new Date(year, month-1, 1);
  const lastDate = new Date(year, month, 0); // 월의 마지막 날
  const weeks = [];
  let cursor = new Date(first);
  let idx = 1;
  while(cursor <= lastDate && idx <= 7){
    const weekStart = new Date(cursor);
    let weekEnd;
    if(idx === 1){
      // getDay(): 0=일 1=월 ... 6=토. 1일부터 그 주 일요일까지.
      const daysUntilSunday = (7 - weekStart.getDay()) % 7;
      weekEnd = addDays(weekStart, daysUntilSunday);
    } else {
      weekEnd = addDays(weekStart, 6);
    }
    if(weekEnd > lastDate) weekEnd = new Date(lastDate);
    weeks.push({
      index: idx,
      mon: new Date(weekStart),   // 이 주의 시작일 (1주차는 월요일이 아닐 수 있음)
      sun: new Date(weekEnd),     // 이 주의 종료일
      labelEnd: new Date(weekEnd),
      rangeLabel: `${fmtMD(weekStart)}~${fmtMD(weekEnd)}`
    });
    cursor = addDays(weekEnd, 1);
    idx++;
  }
  return weeks;
}

// 주간보고 본문(담당자 탭 실적/계획 기간)용 주차 계산. 주차는 항상 월요일~일요일 7일 고정이며,
// 월 경계에서 끊기거나 다시 시작하지 않고 계속 이어진다
// (예: 7.27~8.2, 8.3~8.9, ... 8.31~9.6 — 월이 바뀌어도 주 중간에 잘리지 않는다. 2026-07-30 변경).
// "이 달의 N주차"는 이 달에 월요일이 속한 주들을 순서대로 센 것이다 — 그래서 1일이 월요일이
// 아닌 달은 1주차가 1일보다 늦게(그 달의 첫 월요일부터) 시작하고, 그 앞의 며칠(예: 8/1~8/2)은
// 전달의 마지막 주(월 경계를 넘어 이어지는 주)에 속한다. findWeekOfMonth가 이 케이스를 처리한다.
// 참고: 이 함수를 바꾸면 예전에 저장된 weekKey(예: "2026-07-W4")가 가리키는 날짜 범위도 같이
// 바뀐다 — 과거 데이터 자체가 지워지진 않지만, 그 주차 번호가 가리키는 날짜가 달라질 수 있다.
function getWeeksOfMonth(year, month){
  const lastDate = new Date(year, month, 0); // 월의 마지막 날
  const weeks = [];
  let monday = getMonday(new Date(year, month-1, 1)); // 1일이 속한 주의 월요일(전달일 수 있음)
  if(monday.getMonth()+1 !== month || monday.getFullYear() !== year){
    monday = addDays(monday, 7); // 1일이 화~일요일이면 이 달의 첫 월요일로 건너뜀
  }
  let idx = 1;
  while(monday <= lastDate){
    const weekEnd = addDays(monday, 6); // 항상 월~일 7일 — 월 말이라도 자르지 않는다
    weeks.push({
      index: idx,
      mon: new Date(monday),
      sun: new Date(weekEnd),
      labelEnd: new Date(weekEnd),
      rangeLabel: `${fmtMD(monday)}~${fmtMD(weekEnd)}`
    });
    monday = addDays(monday, 7);
    idx++;
  }
  return weeks;
}
function findWeekOfMonth(date){
  const year = date.getFullYear(), month = date.getMonth()+1;
  const weeks = getWeeksOfMonth(year, month);
  let w = weeks.find(w => date >= w.mon && date <= w.sun);
  if(w) return {year, month, weeks, week:w};
  // 이 달 첫 주(월요일 기준)가 시작되기 전 며칠(예: 1일이 화~일요일이면 그 1~며칠)은
  // 전달의 마지막 주(월 경계를 넘어 이어지는 주)에 속한다 — 전달 기준으로 다시 찾는다.
  let py=year, pm=month-1;
  if(pm<1){ pm=12; py--; }
  const prevWeeks = getWeeksOfMonth(py, pm);
  w = prevWeeks.find(w => date >= w.mon && date <= w.sun);
  if(w) return {year:py, month:pm, weeks:prevWeeks, week:w};
  // 안전장치(정상 흐름에서는 도달하지 않음)
  return {year, month, weeks, week:weeks[weeks.length-1]};
}
function nextWeekEntry(year, month, weekIdx){
  const weeks = getWeeksOfMonth(year, month);
  const curPos = weeks.findIndex(w=>w.index===weekIdx);
  if(curPos>=0 && curPos+1 < weeks.length) return {year, month, week:weeks[curPos+1]};
  let ny=year, nm=month+1;
  if(nm>12){ nm=1; ny++; }
  const nextWeeks = getWeeksOfMonth(ny, nm);
  return {year:ny, month:nm, week:nextWeeks[0]};
}
function prevWeekEntry(year, month, weekIdx){
  const weeks = getWeeksOfMonth(year, month);
  const curPos = weeks.findIndex(w=>w.index===weekIdx);
  if(curPos>0) return {year, month, week:weeks[curPos-1]};
  let py=year, pm=month-1;
  if(pm<1){ pm=12; py--; }
  const prevWeeks = getWeeksOfMonth(py, pm);
  return {year:py, month:pm, week:prevWeeks[prevWeeks.length-1]};
}
function weekMetaFromDate(d){
  const date = new Date(d); date.setHours(0,0,0,0);
  const {year, month, weeks, week} = findWeekOfMonth(date);
  const weekOfMonth = week.index;
  const weekKey = `${year}-${pad2(month)}-W${weekOfMonth}`;
  const nextEntry = nextWeekEntry(year, month, weekOfMonth);
  const nextWeek = nextEntry.week;

  return {
    mon: week.mon, sun: week.sun,
    nextMon: nextWeek.mon, nextSun: nextWeek.sun,
    year, month, weekOfMonth,
    weekKey,
    monthKey: `${year}-${pad2(month)}`,
    label: `${month}월 ${weekOfMonth}주차`,
    fullLabel: `${year}년 ${month}월 ${weekOfMonth}주차`,
    perfRange: `${fmtMD(week.mon)} ~ ${fmtMD(week.sun)}`,
    planRange: `${fmtMD(nextWeek.mon)} ~ ${fmtMD(nextWeek.sun)}`,
    weeksInMonth: weeks
  };
}
function currentMeta(){ return weekMetaFromDate(anchorDate); }
