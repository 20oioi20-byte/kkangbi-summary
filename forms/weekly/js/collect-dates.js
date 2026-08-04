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
// 주차는 항상 월요일~일요일 7일 고정이며, 월 경계에서 끊기거나 다시 시작하지 않고 계속 이어진다
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
