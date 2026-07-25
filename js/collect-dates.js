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
function getWeeksOfMonth(year, month){
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
function findWeekOfMonth(date){
  const year = date.getFullYear(), month = date.getMonth()+1;
  const weeks = getWeeksOfMonth(year, month);
  let w = weeks.find(w => date >= w.mon && date <= w.sun);
  if(!w) w = weeks[weeks.length-1];
  return {year, month, weeks, week:w};
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
