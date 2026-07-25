const KT_LOGO_EMU_W = 864000;   // 2.4cm
const KT_LOGO_EMU_H = 519661;   // 2.4cm * (987/1641)
function xmlEsc(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function wRunsFromText(text, {bold=false, baseSz=24}={}){
  const runs = tokenizeParens(text);
  return runs.map(r=>{
    const sz = r.super ? 20 : baseSz; // 10pt / 12pt
    const rPr = [
      '<w:rPr>',
      '<w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕"/>',
      bold ? '<w:b/>' : '',
      '<w:snapToGrid w:val="0"/>',
      r.super ? '<w:vertAlign w:val="superscript"/>' : '',
      `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`,
      '<w:color w:val="000000"/>',
      '</w:rPr>'
    ].join('');
    const space = r.text.match(/^\s|\s$/) ? ' xml:space="preserve"' : '';
    return `<w:r>${rPr}<w:t${space}>${xmlEsc(r.text)}</w:t></w:r>`;
  }).join('');
}
function wParagraph(line){
  // line: {type, text}
  let ind = '';
  let bold = false;
  let baseSz = 24;
  let display = line.text || '';

  if(line.type==='title'){
    bold = true; baseSz = 24;
  } else if(line.type==='o'){
    baseSz = 22;
    display = ' ○ ' + (line.text||'');
  } else if(line.type==='note'){
    baseSz = 22;
    display = '  ※ ' + (line.text||'');
  }

  const pPr = `<w:pPr>
    <w:widowControl/><w:wordWrap/>
    <w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/>
    ${ind}
    <w:snapToGrid w:val="0"/>
    <w:spacing w:after="0" w:before="0" w:line="276" w:lineRule="auto"/>
    <w:jc w:val="left"/>
    <w:rPr><w:rFonts w:eastAsia="맑은 고딕"/><w:snapToGrid w:val="0"/><w:sz w:val="${baseSz}"/></w:rPr>
  </w:pPr>`;

  return `<w:p>${pPr}${wRunsFromText(display, {bold, baseSz})}</w:p>`;
}
function wHeaderCell(text, gridSpan, fill){
  fill = fill || 'D9D9D9';
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${gridSpan===2?9354:9354}" w:type="dxa"/>
      ${gridSpan===2?'<w:gridSpan w:val="2"/>':''}
      <w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p>
      <w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:snapToGrid w:val="0"/><w:jc w:val="center"/><w:rPr><w:b/><w:snapToGrid w:val="0"/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="맑은 고딕" w:eastAsia="맑은 고딕"/><w:b/><w:snapToGrid w:val="0"/><w:color w:val="000000"/><w:sz w:val="24"/></w:rPr>
      <w:t>${xmlEsc(text)}</w:t></w:r>
    </w:p>
  </w:tc>`;
}
function wTeamCell(){
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="1271" w:type="dxa"/>
      <w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>
      <w:vAlign w:val="center"/>
    </w:tcPr>
    <w:p>
      <w:pPr><w:autoSpaceDE w:val="0"/><w:autoSpaceDN w:val="0"/><w:snapToGrid w:val="0"/><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:rFonts w:ascii="맑은 고딕" w:eastAsia="맑은 고딕"/><w:b/><w:snapToGrid w:val="0"/><w:sz w:val="22"/></w:rPr>
      <w:t>사업5팀</w:t></w:r>
    </w:p>
  </w:tc>`;
}
function wContentCell(lines){
  const body = (lines&&lines.length) ? lines.map(wParagraph).join('') :
    `<w:p><w:r><w:t></w:t></w:r></w:p>`;
  return `<w:tc>
    <w:tcPr><w:tcW w:w="8083" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>
    ${body}
  </w:tc>`;
}
async function buildDocxBlob(meta, linesPerf, linesPlan){
  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9354" w:type="dxa"/>
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
      <w:tblGrid>
        <w:gridCol w:w="1271"/>
        <w:gridCol w:w="8083"/>
      </w:tblGrid>
      <w:tr>
        ${wHeaderCell('AICC사업2단', 2, 'D9D9D9')}
      </w:tr>
      <w:tr>
        ${wHeaderCell(`실 적(${meta.perfRange.replace(/\s/g,'')})`, 2, 'EFEFEF')}
      </w:tr>
      <w:tr>
        ${wTeamCell()}
        ${wContentCell(linesPerf)}
      </w:tr>
      <w:tr>
        ${wHeaderCell(`계 획(${meta.planRange.replace(/\s/g,'')})`, 2, 'EFEFEF')}
      </w:tr>
      <w:tr>
        ${wTeamCell()}
        ${wContentCell(linesPlan)}
      </w:tr>
    </w:tbl>
    <w:p/>
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rIdHeader"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="567" w:footer="851" w:gutter="0"/>
      <w:docGrid w:type="default" w:linePitch="360"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  // 우측 상단 kt is 로고 (문서 헤더에 삽입)
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
          <wp:extent cx="${KT_LOGO_EMU_W}" cy="${KT_LOGO_EMU_H}"/>
          <wp:effectExtent l="0" t="0" r="0" b="0"/>
          <wp:docPr id="1" name="kt is logo"/>
          <wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>
          <a:graphic>
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic>
                <pic:nvPicPr>
                  <pic:cNvPr id="1" name="ktis.png"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="rIdLogo"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm><a:off x="0" y="0"/><a:ext cx="${KT_LOGO_EMU_W}" cy="${KT_LOGO_EMU_H}"/></a:xfrm>
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
      <w:rFonts w:ascii="맑은 고딕" w:eastAsia="맑은 고딕" w:hAnsi="맑은 고딕"/>
      <w:sz w:val="22"/><w:szCs w:val="22"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:jc w:val="left"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:jc w:val="left"/></w:pPr>
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
function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
function base64ToBlob(b64, mime){
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr], {type:mime||'application/octet-stream'});
}
function downloadBlob(blob, fileName){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 2000);
}
function makeDocFileName(meta){
  // AICC본부주간자료_AICC사업5팀_(저장일자) 형태 — 저장(다운로드)하는 오늘 날짜 기준
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const md = pad2(now.getMonth()+1)+pad2(now.getDate());
  return `AICC본부주간자료_AICC사업5팀_${y}${md}.docx`;
}
