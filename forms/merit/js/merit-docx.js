// 공적조서 → .docx 생성. 첨부된 원본 양식(.doc)에서 아래 항목을 직접 추출해 맞춘 값들이다.
//   · 표 구조 : 6칸 인적사항 / 2칸 소속·공적분야 / 전폭 섹션제목+본문 3쌍 / 7칸 확인자
//   · 라벨칸 채우기색 : D9D9D9 (원본 바이너리에서 확인)
//   · 우측 상단 kt is 로고 : 원본 내장 PNG가 shared/logo-data.js 로고와 동일한 이미지(1641x987)임을 확인
//   · 글머리표 : 대분류 "( ", 하위 "- " (원본 문자 그대로. U+0028이며 심볼폰트가 아님을 확인)
// 원본 양식이 바뀌면 이 파일과 forms/merit/docs/CODEMAP.md를 같이 고칠 것.
const MERIT_LOGO_EMU_W = 864000;   // 2.4cm
const MERIT_LOGO_EMU_H = 519661;   // 2.4cm * (987/1641)
const FILL_LABEL = 'D9D9D9';       // 라벨/섹션제목 칸 채우기색(원본에서 실측: 14277081 = D9D9D9)
const FONT = '맑은 고딕';           // 원본 전체가 맑은 고딕(글머리표 "(" 도 심볼폰트가 아닌 맑은 고딕)
// 원본 실측 글자크기(pt→half-point). 표 본문/라벨 11pt, 제목 20pt, 공적기간·하단주석 10pt.
const SZ_BODY = 22;   // 11pt
const SZ_TITLE = 40;  // 20pt
const SZ_SMALL = 20;  // 10pt

function mXmlEsc(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
/** 한 줄 → w:p. sz는 half-point(22 = 11pt). */
function mPara(text, {bold=false, sz=SZ_BODY, align='left', indent=0, spacing=0}={}){
  const t = String(text??'');
  const space = /^\s|\s$/.test(t) ? ' xml:space="preserve"' : '';
  return `<w:p>
    <w:pPr>
      <w:widowControl/><w:wordWrap/>
      <w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/>
      ${indent ? `<w:ind w:left="${indent}"/>` : ''}
      <w:snapToGrid w:val="0"/>
      <w:spacing w:after="${spacing}" w:before="0" w:line="264" w:lineRule="auto"/>
      <w:jc w:val="${align}"/>
      <w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}"/>${bold?'<w:b/>':''}<w:sz w:val="${sz}"/></w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}"/>${bold?'<w:b/>':''}<w:snapToGrid w:val="0"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:color w:val="000000"/></w:rPr>
      <w:t${space}>${mXmlEsc(t)}</w:t>
    </w:r>
  </w:p>`;
}
/** 여러 줄 본문 → 글머리표 들여쓰기를 반영한 w:p 묶음. */
function mBodyParas(text){
  const lines = String(text??'').replace(/\r\n/g,'\n').split('\n');
  const out = lines.map(raw=>{
    const s = raw.replace(/\s+$/,'');
    if(!s.trim()) return mPara('', {sz:SZ_BODY});
    const t = s.trim();
    // 대분류 "( ..." 는 들여쓰기 없음, 하위 "- ..." 는 한 단계 들여쓰기
    if(/^\(/.test(t)) return mPara(t, {sz:SZ_BODY, indent:0});
    return mPara(t, {sz:SZ_BODY, indent:170});
  });
  return out.length ? out.join('') : mPara('', {sz:SZ_BODY});
}
function mCell(width, contentXml, {fill=null, span=0, valign='center'}={}){
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${width}" w:type="dxa"/>
      ${span>1 ? `<w:gridSpan w:val="${span}"/>` : ''}
      ${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : '<w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>'}
      <w:vAlign w:val="${valign}"/>
    </w:tcPr>
    ${contentXml}
  </w:tc>`;
}
// 표 전체 폭 10260 dxa(=513pt, 원본 실측). 인적사항 행은 6칸, 확인자 행은 7칸으로 칸 수가 다르다.
// Word의 표는 모든 행이 "하나의 공통 tblGrid"를 gridSpan으로 나눠 쓰는 구조라, 두 행의 칸 경계를
// 모두 포함하는 마스터 그리드(아래 11칸)를 만들어 두고 각 행이 필요한 만큼 span으로 묶어 쓴다.
// (행마다 칸 수를 그냥 다르게 쓰면 gridSpan 합계가 그리드 칸 수와 어긋나 Word에서 표가 깨진다.)
//   인적사항 칸 경계 : 1280 3180 4500 6560 7860 10260
//   확인자   칸 경계 : 1040 1800 5260 6560 7980 8780 10260
const MERIT_GRID = [1040, 240, 520, 1380, 1320, 760, 1300, 1300, 120, 800, 1480]; // 합계 10260
const MERIT_W = 10260;
/** 원하는 칸 폭 배열을 마스터 그리드에 매핑해 각 칸의 gridSpan을 계산한다. */
function mSpans(widths){
  const spans = [];
  let gi = 0;
  for(const w of widths){
    let acc = 0, n = 0;
    while(gi < MERIT_GRID.length && acc < w){ acc += MERIT_GRID[gi]; gi++; n++; }
    spans.push(n);
  }
  return spans;
}

async function buildMeritDocxBlob(rec){
  const W = MERIT_W;
  // 원본 실측 칸 폭(pt→dxa, ×20). 합계는 둘 다 10260.
  const cPerson  = [1280, 1900, 1320, 2060, 1300, 2400];              // 사번/값/직급/값/성명/값
  const cConfirm = [1040, 760, 3460, 1300, 1420, 800, 1480];          // 확인자/소속/값/직급/값/성명/값
  const sPerson  = mSpans(cPerson);
  const sConfirm = mSpans(cConfirm);
  const nGrid    = MERIT_GRID.length;

  const labelCenter = (w, t, span)=> mCell(w, mPara(t, {bold:true, sz:SZ_BODY, align:'center'}), {fill:FILL_LABEL, span:span||0});
  const valueLeft   = (w, t, span)=> mCell(w, mPara(t, {sz:SZ_BODY, align:'left'}), {span:span||0});

  const rowPerson = `<w:tr><w:trPr><w:trHeight w:val="454"/></w:trPr>
    ${labelCenter(cPerson[0], '사번', sPerson[0])}${valueLeft(cPerson[1], rec.empNo, sPerson[1])}
    ${labelCenter(cPerson[2], '직급(호칭)', sPerson[2])}${valueLeft(cPerson[3], rec.rank, sPerson[3])}
    ${labelCenter(cPerson[4], '성명', sPerson[4])}${valueLeft(cPerson[5], rec.name, sPerson[5])}
  </w:tr>`;

  const rowAffil = `<w:tr><w:trPr><w:trHeight w:val="454"/></w:trPr>
    ${labelCenter(cPerson[0], '소속', sPerson[0])}
    ${valueLeft(W - cPerson[0], rec.affiliation, nGrid - sPerson[0])}
  </w:tr>`;

  const rowField = `<w:tr><w:trPr><w:trHeight w:val="454"/></w:trPr>
    ${labelCenter(cPerson[0], '공적 분야', sPerson[0])}
    ${valueLeft(W - cPerson[0], rec.meritField, nGrid - sPerson[0])}
  </w:tr>`;

  const sectionTitle = (t)=> `<w:tr><w:trPr><w:trHeight w:val="397"/></w:trPr>
    ${mCell(W, mPara(t, {bold:true, sz:SZ_BODY, align:'center'}), {fill:FILL_LABEL, span:nGrid})}
  </w:tr>`;
  const sectionBody = (t)=> `<w:tr>
    ${mCell(W, mBodyParas(t), {span:nGrid, valign:'top'})}
  </w:tr>`;

  const rowConfirm = `<w:tr><w:trPr><w:trHeight w:val="454"/></w:trPr>
    ${labelCenter(cConfirm[0], '확인자', sConfirm[0])}
    ${labelCenter(cConfirm[1], '소속', sConfirm[1])}${valueLeft(cConfirm[2], rec.confirmAffiliation, sConfirm[2])}
    ${labelCenter(cConfirm[3], '직급(호칭)', sConfirm[3])}${valueLeft(cConfirm[4], rec.confirmRank, sConfirm[4])}
    ${labelCenter(cConfirm[5], '성명', sConfirm[5])}${valueLeft(cConfirm[6], rec.confirmName, sConfirm[6])}
  </w:tr>`;

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${mPara('공 적 조 서', {bold:true, sz:SZ_TITLE, align:'center', spacing:120})}
    ${mPara(`*공적기간: ${rec.period}`, {sz:SZ_SMALL, align:'right', spacing:60})}
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="${W}" w:type="dxa"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tblBorders>
        <w:tblLayout w:type="fixed"/>
      </w:tblPr>
      <w:tblGrid>${MERIT_GRID.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>
      ${rowPerson}
      ${rowAffil}
      ${rowField}
      ${sectionTitle('실적 요약')}
      ${sectionBody(rec.s1)}
      ${sectionTitle('실적 달성을 위한 활동')}
      ${sectionBody(rec.s2)}
      ${sectionTitle('핵심가치 실천/기타사항')}
      ${sectionBody(rec.s3)}
      ${rowConfirm}
    </w:tbl>
    ${mPara('', {sz:SZ_SMALL})}
    ${mPara('※ 한 장 이내 작성 (실적 증빙자료 별도 제출)', {sz:SZ_SMALL, align:'center'})}
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rIdHeader"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <!-- 여백은 원본 실측값(pt→twips): 위 70.9 / 아래 63.8 / 왼 49.7 / 오른 63.7 -->
      <w:pgMar w:top="1418" w:right="1274" w:bottom="1276" w:left="994" w:header="567" w:footer="851" w:gutter="0"/>
      <w:docGrid w:type="default" w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:p>
    <w:pPr><w:jc w:val="right"/></w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0">
          <wp:extent cx="${MERIT_LOGO_EMU_W}" cy="${MERIT_LOGO_EMU_H}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="1" name="kt is logo"/>
          <wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
          <a:graphic>
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic>
                <pic:nvPicPr><pic:cNvPr id="1" name="ktis.png"/><pic:cNvPicPr/></pic:nvPicPr>
                <pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                <pic:spPr>
                  <a:xfrm><a:off x="0" y="0"/><a:ext cx="${MERIT_LOGO_EMU_W}" cy="${MERIT_LOGO_EMU_H}"/></a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>
</w:hdr>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
</Relationships>`;
  const headerRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`;
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="${FONT}" w:eastAsia="${FONT}" w:hAnsi="${FONT}"/>
      <w:sz w:val="${SZ_BODY}"/><w:szCs w:val="${SZ_BODY}"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr><w:jc w:val="left"/></w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="left"/></w:pPr>
  </w:style>
</w:styles>`;

  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypes);
  zip.folder('_rels').file('.rels', rels);
  const word = zip.folder('word');
  word.file('document.xml', docXml);
  word.file('styles.xml', styles);
  word.file('header1.xml', headerXml);
  word.folder('_rels').file('document.xml.rels', docRels);
  word.folder('_rels').file('header1.xml.rels', headerRels);
  word.folder('media').file('image1.png', KT_LOGO_DATAURI.split(',')[1], {base64:true});
  return await zip.generateAsync({type:'blob', mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}

function meritDownloadBlob(blob, fileName){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}
function meritFileName(rec){
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const p2 = n => String(n).padStart(2,'0');
  const who = (rec.name||'').trim() || '공적조서';
  return `공적조서_${who}_${y}${p2(now.getMonth()+1)}${p2(now.getDate())}.docx`;
}
