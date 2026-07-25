const HANGUL_ORD = '가나다라마바사아자차카타파하'.split('');
function isAttachedCodeParen(inner){
  const t = String(inner).trim();
  if(/^\d{1,4}석?$/.test(t)) return true;       // 62, 3석, 178
  if(/^\d{1,4}[A-Za-z]?$/.test(t)) return true;
  if(/^[A-Za-z]{1,6}\d{0,3}$/.test(t) && t.length<=6) return true;
  return false;
}
function tokenizeParens(text){
  const runs = [];
  const re = /\([^)]*\)/g;
  let last=0, m;
  while((m = re.exec(text)) !== null){
    if(m.index > last) runs.push({text:text.slice(last, m.index), super:false});
    const full = m[0];
    const inner = full.slice(1,-1);
    const before = m.index>0 ? text[m.index-1] : ' ';
    const attached = before && !/\s/.test(before);
    const keep = attached && isAttachedCodeParen(inner);
    runs.push({text:full, super:!keep});
    last = m.index + full.length;
  }
  if(last < text.length) runs.push({text:text.slice(last), super:false});
  if(!runs.length) runs.push({text:'', super:false});
  return runs;
}
function runsToHtml(runs, bold){
  return runs.map(r=>{
    const t = escapeHtml(r.text);
    if(r.super) return `<span class="paren-super">${t}</span>`;
    return t;
  }).join('');
}
function parseContentToLines(rawText){
  if(!rawText || !rawText.trim()) return [];
  const lines = rawText.replace(/\r\n/g,'\n').split('\n');
  const out = [];
  for(let line of lines){
    const trimmed = line.trim();
    if(!trimmed) continue;
    if(/^[가-힣]\.\s*/.test(trimmed)){
      out.push({type:'title', text:trimmed});
    } else if(/^○\s*/.test(trimmed) || /^o\s+/i.test(trimmed)){
      out.push({type:'o', text:trimmed.replace(/^[○oO]\s*/,'').trim()});
    } else if(/^※\s*/.test(trimmed)){
      out.push({type:'note', text:trimmed.replace(/^※\s*/,'').trim()});
    } else {
      // 자유 문장 → 제목 후보(짧은 첫 줄) 또는 ○
      out.push({type:'free', text:trimmed});
    }
  }
  return out;
}
function guessCategory(text){
  if(/재계약|리텐션|연장|계약\s*체결/.test(text)) return '리텐션';
  if(/인력|채용|인건비|퇴사|이탈/.test(text)) return '인력';
  if(/계약|입찰|수의/.test(text)) return '계약';
  return '기타';
}
function isCenterOpsTitle(text){
  return /소관센터\s*운영/.test(text);
}
function cleanBullet(t){
  return String(t||'').replace(/^[○oO]\s*/,'').replace(/^※\s*/,'').trim();
}
function isMajorTopic(t){
  return /재계약|원복공사|운영종료|계약\s*체결|계약체결|입찰|수의\s*계약|리텐션|프로세스\s*재정비|상담\s*프로세스/.test(t);
}
function isOpsBullet(t){
  if(isMajorTopic(t)) return false;
  if(isCenterOpsTitle(t)) return true;
  // 짧은 센터 운영·협의성 문구
  return /VOC|협의|미팅|개선|해피콜|운영관련|운영 관련|업무확대|보이스봇/.test(t) && t.length < 120;
}
function aggregateSection(kind){
  const meta = currentMeta();
  const members = visibleMembers();
  const items = []; // {category, title, bullets:[{text, notes:[]}]}
  const centerBullets = [];

  members.forEach(m=>{
    const r = memberReport(meta.weekKey, m.id);
    const text = kind==='perf' ? (r&&r.perf) : (r&&r.plan);
    if(!text || !text.trim()) return;

    const parsed = parseContentToLines(text);
    const hasStruct = parsed.some(p=>p.type==='title');
    let cur = null; // {center:true} | item ref

    function startItem(category, title){
      if(isCenterOpsTitle(title)){
        cur = {center:true};
        return;
      }
      cur = {category, title, bullets:[]};
      items.push(cur);
    }
    function addBullet(bt){
      if(!bt) return;
      if(cur && cur.center) centerBullets.push({text:bt, notes:[]});
      else if(cur && cur.bullets) cur.bullets.push({text:bt, notes:[]});
      else centerBullets.push({text:bt, notes:[]});
    }
    function addNote(nt){
      if(!nt) return;
      if(cur && cur.center && centerBullets.length){
        centerBullets[centerBullets.length-1].notes.push(nt);
      } else if(cur && cur.bullets && cur.bullets.length){
        cur.bullets[cur.bullets.length-1].notes.push(nt);
      } else if(cur && !cur.center){
        cur.bullets.push({text:'', notes:[nt]});
      } else {
        centerBullets.push({text:'', notes:[nt]});
      }
    }

    if(hasStruct){
      parsed.forEach(p=>{
        if(p.type==='title'){
          const t = p.text.replace(/^[가-힣]\.\s*/,'').trim();
          let category='기타', title=t;
          const cm = t.match(/^\[([^\]]+)\]\s*(.*)$/);
          if(cm){ category=cm[1]; title=(cm[2]||'').trim()||cm[1]; }
          startItem(category, title);
        } else if(p.type==='note'){
          addNote(cleanBullet(p.text));
        } else {
          addBullet(cleanBullet(p.text));
        }
      });
      return;
    }

    // 비구조화: 제목줄 + ○/※ 상세, 운영성 문구는 소관센터로
    parsed.forEach(p=>{
      const t = cleanBullet(p.text);
      if(!t) return;

      if(p.type==='note'){
        addNote(t);
        return;
      }
      if(p.type==='o'){
        // 현재 항목 상세. 없으면 운영/단독 판단
        if(cur && !cur.center){ addBullet(t); return; }
        if(isOpsBullet(t)){ centerBullets.push({text:t, notes:[]}); cur={center:true}; return; }
        startItem(guessCategory(t), makeTitleFromBody(t));
        return;
      }

      // free line
      if(isCenterOpsTitle(t)){ cur={center:true}; return; }
      if(isOpsBullet(t) && !isMajorTopic(t)){
        centerBullets.push({text:t, notes:[]});
        cur={center:true};
        return;
      }
      // 새 안건 제목
      startItem(guessCategory(t), makeTitleFromBody(t));
    });
  });

  if(centerBullets.length){
    const seen = new Set();
    const uniq = [];
    centerBullets.forEach(b=>{
      const k = (b.text||'')+'|'+(b.notes||[]).join('|');
      if(!b.text && !(b.notes&&b.notes.length)) return;
      if(seen.has(k)) return;
      seen.add(k);
      uniq.push(b);
    });
    if(uniq.length) items.push({category:'기타', title:'소관센터 운영 관련', bullets:uniq});
  }

  return itemsToDocLines(items.filter(it=>it.title || (it.bullets&&it.bullets.length)));
}
function summarizeTitle(t){
  let s = t.replace(/^[가-힣]\.\s*/,'').replace(/^\[([^\]]+)\]\s*/,'').trim();
  if(s.length > 60) s = s.slice(0, 57)+'…';
  return s;
}
function makeTitleFromBody(t){
  // 첫 문장 또는 첫 줄 — 단, "7.20" "1.5" 같은 날짜/숫자 사이 마침표는 문장 구분자로 보지 않는다
  const firstLine = t.split(/\n/)[0];
  const first = firstLine.split(/(?<!\d)\.(?!\d)/)[0].trim();
  return summarizeTitle(first || t);
}
function extractDetail(full, title){
  if(full.startsWith(title)){
    const rest = full.slice(title.length).replace(/^[.\s]+/,'').trim();
    return rest || '';
  }
  return '';
}
function itemsToDocLines(items){
  const lines = [];
  items.forEach((it, i)=>{
    const ord = HANGUL_ORD[i] || String(i+1);
    const title = `${ord}. [${it.category||'기타'}] ${it.title}`;
    lines.push({type:'title', text:title});
    (it.bullets||[]).forEach(b=>{
      if(b.text) lines.push({type:'o', text:b.text});
      (b.notes||[]).forEach(n=> lines.push({type:'note', text:n}));
    });
  });
  return lines;
}
function docLinesToHtml(lines){
  if(!lines || !lines.length) return '';
  return lines.map(line=>{
    if(line.type==='title'){
      const runs = tokenizeParens(line.text);
      return `<div class="doc-line title-line">${runsToHtml(runs, true)}</div>`;
    }
    if(line.type==='o'){
      const runs = tokenizeParens(' ○ '+line.text);
      return `<div class="doc-line o-line">${runsToHtml(runs, false)}</div>`;
    }
    if(line.type==='note'){
      const runs = tokenizeParens('  ※ '+line.text);
      return `<div class="doc-line note-line">${runsToHtml(runs, false)}</div>`;
    }
    const runs = tokenizeParens(line.text||'');
    return `<div class="doc-line">${runsToHtml(runs, false)}</div>`;
  }).join('');
}
function domToDocLines(el){
  if(!el) return [];
  return [...el.querySelectorAll(':scope > .doc-line')].map(div=>{
    const cls = div.className || '';
    const raw = (div.textContent || '').trim();
    if(!raw) return null;
    if(cls.includes('title-line')) return {type:'title', text:raw};
    if(cls.includes('o-line')) return {type:'o', text:cleanBullet(raw)};
    if(cls.includes('note-line')) return {type:'note', text:cleanBullet(raw)};
    return {type:'free', text:raw};
  }).filter(Boolean);
}
function docLinesToRaw(lines){
  return (lines||[]).map(l=>{
    if(l.type==='title') return l.text;
    if(l.type==='o') return ' ○ '+l.text;
    if(l.type==='note') return '  ※ '+l.text;
    return l.text||'';
  }).join('\n');
}
