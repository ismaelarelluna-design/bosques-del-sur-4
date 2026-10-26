/* ===== excel.js — Consolidado general en Excel (.xlsx) =====
   Genera el libro SIN librerías externas (un .xlsx es un ZIP de archivos XML):
   - Motor mínimo: ZIP sin compresión + estilos + hojas + imagen (logo) + fórmulas.
   - Las sumas, saldos y porcentajes son FÓRMULAS VIVAS: si se edita un valor en
     Excel, los totales se recalculan. Cada fórmula lleva además su valor ya
     calculado, para que también se vea bien en visores que no recalculan.
   - Datos personales (nombres y teléfonos): el libro lleva la leyenda
     «CONFIDENCIAL» y el botón solo existe para administradores.
   Hojas: Portada · Resumen · Balance Mensual · Pagos GC · Ingresos Extra · Gastos ·
          Multas · Morosidad · Departamentos · Exenciones · Proveedores · Mantenciones */

/* ---------- ZIP (método «stored») ---------- */
const XL_CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function xlCrc(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=XL_CRC[(c^u8[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function xlZip(archivos){
 const enc=new TextEncoder(),partes=[],central=[];let pos=0;
 const d=new Date(),dosT=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dosF=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
 archivos.forEach(a=>{
  const nom=enc.encode(a.nombre),dat=typeof a.datos==='string'?enc.encode(a.datos):a.datos,crc=xlCrc(dat);
  const lh=new DataView(new ArrayBuffer(30));
  lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(8,0,true);
  lh.setUint16(10,dosT,true);lh.setUint16(12,dosF,true);lh.setUint32(14,crc,true);lh.setUint32(18,dat.length,true);lh.setUint32(22,dat.length,true);
  lh.setUint16(26,nom.length,true);lh.setUint16(28,0,true);
  partes.push(new Uint8Array(lh.buffer),nom,dat);
  const ch=new DataView(new ArrayBuffer(46));
  ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(10,0,true);
  ch.setUint16(12,dosT,true);ch.setUint16(14,dosF,true);ch.setUint32(16,crc,true);ch.setUint32(20,dat.length,true);ch.setUint32(24,dat.length,true);
  ch.setUint16(28,nom.length,true);ch.setUint32(42,pos,true);
  central.push(new Uint8Array(ch.buffer),nom);
  pos+=30+nom.length+dat.length;
 });
 const tam=central.reduce((s,p)=>s+p.length,0);
 const fin=new DataView(new ArrayBuffer(22));
 fin.setUint32(0,0x06054b50,true);fin.setUint16(8,archivos.length,true);fin.setUint16(10,archivos.length,true);fin.setUint32(12,tam,true);fin.setUint32(16,pos,true);
 const todo=partes.concat(central,[new Uint8Array(fin.buffer)]);
 const out=new Uint8Array(todo.reduce((s,p)=>s+p.length,0));let o=0;todo.forEach(p=>{out.set(p,o);o+=p.length;});
 return out;
}

/* ---------- utilidades XML ---------- */
function xlEsc(s){return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function xlCol(n){let s='';while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;}
function xlRef(r,c,abs){return abs?'$'+xlCol(c)+'$'+r:xlCol(c)+r;}
function xlBytesDeDataUrl(du){const bin=atob(du.split(',')[1]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;}

/* ---------- libro: estilos + hojas ---------- */
function xlLibro(opc){
 opc=opc||{};
 const fuentes=['<font><sz val="10"/><color rgb="FF111827"/><name val="Calibri"/><family val="2"/></font>'];
 const rellenos=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>'];
 const bordes=['<border><left/><right/><top/><bottom/><diagonal/></border>'];
 const fmts=[],xfs=['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'],cache={};
 const pool=(arr,x)=>{let i=arr.indexOf(x);if(i<0){arr.push(x);i=arr.length-1;}return i;};
 const rgb=h=>'FF'+String(h).replace('#','').toUpperCase();
 function est(s){
  if(!s)return 0;const key=JSON.stringify(s);if(cache[key]!=null)return cache[key];
  const f=pool(fuentes,`<font>${s.b?'<b/>':''}${s.i?'<i/>':''}<sz val="${s.sz||10}"/><color rgb="${rgb(s.c||'#111827')}"/><name val="Calibri"/><family val="2"/></font>`);
  const r=s.bg?pool(rellenos,`<fill><patternFill patternType="solid"><fgColor rgb="${rgb(s.bg)}"/><bgColor indexed="64"/></patternFill></fill>`):0;
  const lado=(n,t,c)=>t?`<${n} style="${t}"><color rgb="${rgb(c||s.bc||'#D1D5DB')}"/></${n}>`:`<${n}/>`;
  const bd=s.bd,b=bd?pool(bordes,`<border>${lado('left',bd==='all'&&'thin')}${lado('right',bd==='all'&&'thin')}${lado('top',(bd==='all'||bd==='top')&&'thin')}${lado('bottom',bd==='all'||bd==='bottom'?'thin':(bd==='bottom2'?'medium':false),bd==='bottom2'?'#0891B2':null)}<diagonal/></border>`):0;
  let nf=0;if(s.fmt){let i=fmts.indexOf(s.fmt);if(i<0){fmts.push(s.fmt);i=fmts.length-1;}nf=164+i;}
  const al=(s.al||s.va||s.wrap||s.ind)?`<alignment${s.al?` horizontal="${s.al}"`:''} vertical="${s.va||'center'}"${s.wrap?' wrapText="1"':''}${s.ind?` indent="${s.ind}"`:''}/>`:'';
  xfs.push(`<xf numFmtId="${nf}" fontId="${f}" fillId="${r}" borderId="${b}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${al}</xf>`);
  return cache[key]=xfs.length-1;
 }
 const hojas=[];
 function hoja(nombre,tab){
  const H={nombre,tab,celdas:new Map(),anchos:{},altos:{},merges:[],links:[],freeze:null,filtro:null,maxR:1,maxC:1,logo:null,orient:'landscape'};
  H.set=(r,c,v,s,f)=>{H.celdas.set(r*1000+c,{r,c,v,s:est(s),f});if(r>H.maxR)H.maxR=r;if(c>H.maxC)H.maxC=c;};
  H.ancho=(c,w)=>{H.anchos[c]=w;};H.alto=(r,h)=>{H.altos[r]=h;};
  H.merge=(r1,c1,r2,c2)=>{H.merges.push(xlRef(r1,c1)+':'+xlRef(r2,c2));};
  H.link=(r,c,destino)=>{H.links.push({ref:xlRef(r,c),destino});};
  hojas.push(H);return H;
 }
 function xmlHoja(H,i){
  const filas={};H.celdas.forEach(c=>{(filas[c.r]=filas[c.r]||[]).push(c);});
  let sd='';
  Object.keys(filas).map(Number).sort((a,b)=>a-b).forEach(r=>{
   const alto=H.altos[r];
   sd+=`<row r="${r}"${alto?` ht="${alto}" customHeight="1"`:''}>`;
   filas[r].sort((a,b)=>a.c-b.c).forEach(c=>{
    const ref=xlRef(c.r,c.c),s=c.s?` s="${c.s}"`:'';
    const esNum=typeof c.v==='number'&&isFinite(c.v);
    if(c.f){
     const f=`<f>${xlEsc(c.f)}</f>`;
     if(opc.sinCache)sd+=`<c r="${ref}"${s}>${f}</c>`;
     else if(esNum)sd+=`<c r="${ref}"${s}>${f}<v>${c.v}</v></c>`;
     else sd+=`<c r="${ref}"${s} t="str">${f}<v>${xlEsc(c.v==null?'':c.v)}</v></c>`;
    }else if(esNum)sd+=`<c r="${ref}"${s}><v>${c.v}</v></c>`;
    else if(c.v!==undefined&&c.v!==null&&c.v!=='')sd+=`<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xlEsc(c.v)}</t></is></c>`;
    else sd+=`<c r="${ref}"${s}/>`;
   });
   sd+='</row>';
  });
  const cols=Object.keys(H.anchos).map(Number).sort((a,b)=>a-b).map(c=>`<col min="${c}" max="${c}" width="${H.anchos[c]}" customWidth="1"/>`).join('');
  const pane=H.freeze?`<pane${H.freeze.c>1?` xSplit="${H.freeze.c-1}"`:''}${H.freeze.r>1?` ySplit="${H.freeze.r-1}"`:''} topLeftCell="${xlRef(H.freeze.r,H.freeze.c)}" activePane="${H.freeze.r>1&&H.freeze.c>1?'bottomRight':(H.freeze.r>1?'bottomLeft':'topRight')}" state="frozen"/>`:'';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr>${H.tab?`<tabColor rgb="${rgb(H.tab)}"/>`:''}<pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${xlRef(H.maxR,H.maxC)}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"${i===0?' tabSelected="1"':''}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols?`<cols>${cols}</cols>`:''}<sheetData>${sd}</sheetData>${H.filtro?`<autoFilter ref="${H.filtro}"/>`:''}${H.merges.length?`<mergeCells count="${H.merges.length}">${H.merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:''}${H.links.length?`<hyperlinks>${H.links.map(l=>`<hyperlink ref="${l.ref}" location="${xlEsc(l.destino)}"/>`).join('')}</hyperlinks>`:''}<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${H.orient}" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;LCondominio Bosques del Sur 4 — CONFIDENCIAL&amp;RPágina &amp;P de &amp;N</oddFooter></headerFooter>${H.logo?'<drawing r:id="rId1"/>':''}</worksheet>`;
 }
 function xmlDibujo(l){
  const E=9525,cx=Math.round(l.w*E),cy=Math.round(l.h*E);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>${Math.round(l.dx*E)}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${Math.round(l.dy*E)}</xdr:rowOff></xdr:from><xdr:ext cx="${cx}" cy="${cy}"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo CBS4" descr="Logo Condominio Bosques del Sur 4"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;
 }
 function empaquetar(logoBytes,titulo,autor){
  const R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',N='http://schemas.openxmlformats.org/package/2006/relationships';
  const hdr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const conLogo=hojas.filter(h=>h.logo);
  const A=[];
  A.push({nombre:'[Content_Types].xml',datos:hdr+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>${hojas.map((h,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}${conLogo.map(h=>`<Override PartName="/xl/drawings/drawing${hojas.indexOf(h)+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('')}</Types>`});
  A.push({nombre:'_rels/.rels',datos:hdr+`<Relationships xmlns="${N}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`});
  const ahora=new Date().toISOString().replace(/\.\d+Z$/,'Z');
  A.push({nombre:'docProps/core.xml',datos:hdr+`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xlEsc(titulo)}</dc:title><dc:creator>${xlEsc(autor)}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${ahora}</dcterms:created></cp:coreProperties>`});
  A.push({nombre:'xl/workbook.xml',datos:hdr+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${hojas.map((h,i)=>`<sheet name="${xlEsc(h.nombre)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`});
  A.push({nombre:'xl/_rels/workbook.xml.rels',datos:hdr+`<Relationships xmlns="${N}">${hojas.map((h,i)=>`<Relationship Id="rId${i+1}" Type="${R}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length+1}" Type="${R}/styles" Target="styles.xml"/></Relationships>`});
  hojas.forEach((h,i)=>{
   A.push({nombre:`xl/worksheets/sheet${i+1}.xml`,datos:xmlHoja(h,i)});
   if(h.logo){
    A.push({nombre:`xl/worksheets/_rels/sheet${i+1}.xml.rels`,datos:hdr+`<Relationships xmlns="${N}"><Relationship Id="rId1" Type="${R}/drawing" Target="../drawings/drawing${i+1}.xml"/></Relationships>`});
    A.push({nombre:`xl/drawings/drawing${i+1}.xml`,datos:xmlDibujo(h.logo)});
    A.push({nombre:`xl/drawings/_rels/drawing${i+1}.xml.rels`,datos:hdr+`<Relationships xmlns="${N}"><Relationship Id="rId1" Type="${R}/image" Target="../media/logo.png"/></Relationships>`});
   }
  });
  if(conLogo.length)A.push({nombre:'xl/media/logo.png',datos:logoBytes});
  A.push({nombre:'xl/styles.xml',datos:hdr+`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${fmts.length?`<numFmts count="${fmts.length}">${fmts.map((f,i)=>`<numFmt numFmtId="${164+i}" formatCode="${xlEsc(f)}"/>`).join('')}</numFmts>`:''}<fonts count="${fuentes.length}">${fuentes.join('')}</fonts><fills count="${rellenos.length}">${rellenos.join('')}</fills><borders count="${bordes.length}">${bordes.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`});
  return xlZip(A);
 }
 return {hoja,empaquetar,hojas};
}

/* ---------- estilos del documento (misma paleta que los PDF) ---------- */
const XL_C={marca:'#155E75',marca2:'#0891B2',claro:'#F3F4F6',zebra:'#F9FAFB',borde:'#D1D5DB',gris:'#6B7280',verde:'#059669',verdeC:'#D1FAE5',rojo:'#DC2626',rojoC:'#FEE2E2',ambarC:'#FEF3C7',cian:'#CFFAFE'};
const XL_CLP='$#,##0;[Red]-$#,##0';
const XL_ST={
 th:{b:1,c:'#FFFFFF',bg:XL_C.marca,al:'center',va:'center',wrap:1,bd:'all',bc:XL_C.marca},
 td:{bd:'all'},tdC:{bd:'all',al:'center'},tdM:{bd:'all',fmt:XL_CLP,al:'right'},tdP:{bd:'all',fmt:'0%',al:'center'},tdW:{bd:'all',wrap:1,va:'top'},
 tot:{b:1,bg:XL_C.cian,bd:'all',bc:XL_C.marca2},totM:{b:1,bg:XL_C.cian,bd:'all',bc:XL_C.marca2,fmt:XL_CLP,al:'right'},totC:{b:1,bg:XL_C.cian,bd:'all',bc:XL_C.marca2,al:'center'},totP:{b:1,bg:XL_C.cian,bd:'all',bc:XL_C.marca2,fmt:'0%',al:'center'},
 nota:{i:1,c:XL_C.gris,sz:9,wrap:1,va:'top'},
 sec:{b:1,sz:12,c:XL_C.marca,bd:'bottom2'}
};

/* ---------- datos del consolidado ---------- */
function xlPeriodos(){
 const k=new Set(),add=x=>{if(/^\d{4}-\d{2}$/.test(x))k.add(x);};
 Object.keys(appData.pagos||{}).forEach(p=>{if(Object.values(appData.pagos[p]||{}).some(v=>estaPagado(v)))add(p);});
 (appData.ingresosExtra||[]).forEach(g=>add(mkKey(g.anio,g.mes)));
 (appData.multas||[]).forEach(g=>add(mkKey(g.anio,g.mes)));
 (appData.gastosVariables||[]).forEach(g=>add(mkKey(g.anio,g.mes)));
 Object.keys(appData.gastosFijos||{}).forEach(p=>{if(comoLista(appData.gastosFijos[p]).length)add(p);});
 const h=new Date(),hoy=mkKey(h.getFullYear(),h.getMonth());
 const orden=[...k].sort(),ini=orden[0]||hoy,fin=[hoy,orden[orden.length-1]||hoy].sort().pop();
 const out=[];let y=+ini.slice(0,4),m=+ini.slice(5,7)-1;
 while(mkKey(y,m)<=fin){out.push(mkKey(y,m));m++;if(m>11){m=0;y++;}}
 return out;
}
function xlNum(k){return {a:+k.slice(0,4),m:+k.slice(5,7)-1};}
function xlNombreProv(id){const p=(typeof proveedorPorId==='function')?proveedorPorId(id):null;return p?p.nombre:'';}

/* ---------- cabecera común (banner + logo) ---------- */
function xlCabecera(H,ncols,titulo,sub,logo){
 const n=Math.max(ncols,6);
 for(let r=1;r<=3;r++){for(let c=1;c<=n;c++)H.set(r,c,'',{bg:XL_C.marca});}
 H.alto(1,28);H.alto(2,20);H.alto(3,20);H.alto(4,8);
 H.set(1,2,'CONDOMINIO BOSQUES DEL SUR 4',{b:1,sz:16,c:'#FFFFFF',bg:XL_C.marca,va:'center'});H.merge(1,2,1,n);
 H.set(2,2,titulo,{b:1,sz:12,c:'#FFFFFF',bg:XL_C.marca,va:'center'});H.merge(2,2,2,n);
 H.set(3,2,sub,{sz:9,c:'#A5F3FC',bg:XL_C.marca,va:'center'});H.merge(3,2,3,n);
 H.ancho(1,Math.max(H.anchos[1]||0,12));
 H.logo={w:64,h:66,dx:10,dy:6};
}
function xlTabla(H,r0,cols,filas,opc){
 opc=opc||{};
 H.alto(r0,opc.altoHdr||30);
 cols.forEach((c,i)=>{H.set(r0,i+1,c.t,XL_ST.th);if(c.w)H.ancho(i+1,c.w);});
 filas.forEach((fila,j)=>{
  const r=r0+1+j,z=(j%2)?{bg:XL_C.zebra}:{};
  fila.forEach((cel,i)=>{
   const c=cols[i];let v=cel,f,extra;
   if(cel&&typeof cel==='object'){v=cel.v;f=cel.f;extra=cel.s;}
   H.set(r,i+1,v,Object.assign({},XL_ST[c.e||'td'],z,extra||{}),f);
  });
 });
 return r0+filas.length; /* última fila de datos */
}

/* ---------- construcción del libro ---------- */
async function xlConstruir(opc){
 const L=xlLibro(opc),q=n=>"'"+n+"'!";
 const NOM={por:'Portada',res:'Resumen',bal:'Balance Mensual',pag:'Pagos GC',ext:'Ingresos Extra',gas:'Gastos',mul:'Multas',mor:'Morosidad',dep:'Departamentos',exe:'Exenciones',prov:'Proveedores',man:'Mantenciones'};
 const H={};[['por',XL_C.marca],['res',XL_C.marca],['bal',XL_C.marca],['pag',XL_C.marca2],['ext',XL_C.marca2],['gas',XL_C.marca2],['mul',XL_C.marca2],['mor',XL_C.rojo],['dep',XL_C.gris],['exe',XL_C.gris],['prov',XL_C.gris],['man',XL_C.gris]].forEach(([k,c])=>{H[k]=L.hoja(NOM[k],c);});
 const per=xlPeriodos(),N=per.length,R0=7,RN=R0+N-1,RT=R0+N; /* filas de períodos y fila de totales */
 const deptos=(appData.departamentos||[]).slice().sort((a,b)=>a.id-b.id),nd=deptos.length;
 const hoyD=new Date(),stamp=hoyD.toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})+' '+hoyD.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
 const sub=`Generado el ${stamp} · versión ${typeof APP_VERSION!=='undefined'?APP_VERSION:''} · CONFIDENCIAL`;
 const lim=ultimoPeriodoExigible(),limKey=mkKey(lim.anio,lim.mes),pri=primerPeriodoRegistrado(),priKey=mkKey(pri.anio,pri.mes);
 const sumar=(a)=>a.reduce((s,x)=>s+x,0);
 const etiqueta=k=>formatPeriodo(k);

 /* ===== datos de lista (Ingresos extra, Gastos, Multas) ===== */
 const extras=(appData.ingresosExtra||[]).map(g=>({k:mkKey(g.anio,g.mes),g})).sort((a,b)=>a.k.localeCompare(b.k));
 const gastos=[];
 Object.keys(appData.gastosFijos||{}).sort().forEach(k=>{if(/^\d{4}-\d{2}$/.test(k))comoLista(appData.gastosFijos[k]).forEach(g=>{if(g&&typeof g==='object')gastos.push({k,t:'Fijo',g});});});
 (appData.gastosVariables||[]).forEach(g=>gastos.push({k:mkKey(g.anio,g.mes),t:'Variable',g}));
 gastos.sort((a,b)=>a.k.localeCompare(b.k)||a.t.localeCompare(b.t));
 const multas=(appData.multas||[]).map(m=>({k:mkKey(m.anio,m.mes),m})).sort((a,b)=>a.k.localeCompare(b.k));
 const rf=(n)=>R0+Math.max(n,1)-1; /* última fila de un rango (mínimo 1 fila para que el rango sea válido) */
 const EX_N=rf(extras.length),GA_N=rf(gastos.length),MU_N=rf(multas.length);

 /* ===== Pagos GC ===== */
 let PG,P;
 {
  const h=H.pag,c0=3,cP=c0+nd,cE=cP+1,cPe=cP+2,cV=cP+3,cR=cP+4,cX=cP+5,cPc=cP+6,ncols=cPc;
  xlCabecera(h,ncols,'Pagos de Gasto Común mes a mes',sub);
  h.set(5,1,'T = pagó por transferencia · E = pagó en efectivo · EX = eximido · – = sin cobro / sin datos / aún en plazo · casilla roja = pendiente',XL_ST.nota);h.merge(5,1,5,ncols);
  const cols=[{t:'Período',w:12,e:'tdC'},{t:'Mes',w:17}];
  deptos.forEach(d=>cols.push({t:String(d.numero||d.id),w:5.5,e:'tdC'}));
  cols.push({t:'Pagados',w:9,e:'tdC'},{t:'Exigibles',w:9,e:'tdC'},{t:'Pendientes',w:10,e:'tdC'},{t:'Valor GC',w:11,e:'tdM'},{t:'Recaudado',w:13,e:'tdM'},{t:'Por cobrar',w:13,e:'tdM'},{t:'% cobranza',w:11,e:'tdP'});
  const filas=[];
  const PP=[];P=PP;
  per.forEach((k,i)=>{
   const r=R0+i,a=xlNum(k),gc=getGC(a.a,a.m),pm=(appData.pagos||{})[k]||{},fila=[k,etiqueta(k)];
   let pag=0,ex=0,sin=0;
   deptos.forEach(d=>{
    let v='',s={};
    if(estaPagado(pm[d.id])){const ef=tipoDePago(pm[d.id])==='efectivo';v=ef?'E':'T';pag++;s=ef?{bg:'#DBEAFE',c:'#1D4ED8',b:1}:{bg:XL_C.verdeC,c:'#047857',b:1};}
    else if(mesSinCobro(k)||k<priKey||k>limKey){v='–';sin++;s={c:XL_C.gris};}
    else if(esExento(k,d.id)){v='EX';ex++;s={bg:'#E5E7EB',c:'#374151',b:1};}
    else s={bg:XL_C.rojoC};
    fila.push({v,s});
   });
   const exig=nd-ex-sin,pend=exig-pag,rng=xlCol(c0)+r+':'+xlCol(c0+nd-1)+r;
   fila.push({v:pag,f:`COUNTIF(${rng},"T")+COUNTIF(${rng},"E")`},{v:exig,f:`${nd}-COUNTIF(${rng},"EX")-COUNTIF(${rng},"–")`},{v:pend,f:`${xlCol(cE)}${r}-${xlCol(cP)}${r}`},gc,
    {v:pag*gc,f:`${xlCol(cP)}${r}*${xlCol(cV)}${r}`},{v:pend*gc,f:`${xlCol(cPe)}${r}*${xlCol(cV)}${r}`},{v:exig?pag/exig:'',f:`IF(${xlCol(cE)}${r}=0,"",${xlCol(cP)}${r}/${xlCol(cE)}${r})`});
   filas.push(fila);PP.push({k,pag,exig,pend,gc,rec:pag*gc});
  });
  xlTabla(h,6,cols,filas);
  /* totales */
  const T=RT;h.set(T,1,'TOTAL',XL_ST.tot);h.set(T,2,'',XL_ST.tot);
  deptos.forEach((d,i)=>{const col=xlCol(c0+i),rg=`${col}${R0}:${col}${RN}`,v=per.filter(k=>estaPagado(((appData.pagos||{})[k]||{})[d.id])).length;h.set(T,c0+i,v,XL_ST.totC,`COUNTIF(${rg},"T")+COUNTIF(${rg},"E")`);});
  [[cP,'pag'],[cE,'exig'],[cPe,'pend']].forEach(([c,key])=>h.set(T,c,sumar(P.map(x=>x[key])),XL_ST.totC,`SUM(${xlCol(c)}${R0}:${xlCol(c)}${RN})`));
  h.set(T,cV,'',XL_ST.tot);
  h.set(T,cR,sumar(P.map(x=>x.rec)),XL_ST.totM,`SUM(${xlCol(cR)}${R0}:${xlCol(cR)}${RN})`);
  h.set(T,cX,sumar(P.map(x=>x.pend*x.gc)),XL_ST.totM,`SUM(${xlCol(cX)}${R0}:${xlCol(cX)}${RN})`);
  const tp=sumar(P.map(x=>x.pag)),te=sumar(P.map(x=>x.exig));
  h.set(T,cPc,te?tp/te:'',XL_ST.totP,`IF(${xlCol(cE)}${T}=0,"",${xlCol(cP)}${T}/${xlCol(cE)}${T})`);
  h.freeze={r:R0,c:3};h.filtro=`A6:${xlCol(ncols)}${RN}`;
  PG={c0,cP,cE,cPe,cV,cR,cX,cPc};
 }

 /* ===== Ingresos extra ===== */
 {
  const h=H.ext;xlCabecera(h,8,'Ingresos extra',sub);
  h.set(5,1,'Ingresos distintos del gasto común (arriendos, cuotas especiales, monto inicial, etc.).',XL_ST.nota);h.merge(5,1,5,8);
  const cols=[{t:'Período',w:12,e:'tdC'},{t:'Mes',w:17},{t:'Descripción',w:42,e:'tdW'},{t:'Tipo',w:16},{t:'Monto',w:14,e:'tdM'},{t:'Monto unitario',w:14,e:'tdM'},{t:'Deptos. pagados',w:12,e:'tdC'},{t:'Deptos. eximidos',w:12,e:'tdC'}];
  const cnt=x=>Array.isArray(x)?x.length:(Number(x)||0);
  const filas=extras.map(({k,g})=>[k,etiqueta(k),g.descripcion||'',g.tipo||'',g.monto||0,g.montoUnitario||'',cnt(g.departamentosPagados),cnt(g.departamentosEximidos)]);
  xlTabla(h,6,cols,filas);
  const t=EX_N+1;h.set(t,1,'TOTAL',XL_ST.tot);[2,3,4].forEach(c=>h.set(t,c,'',XL_ST.tot));
  h.set(t,5,sumar(extras.map(x=>x.g.monto||0)),XL_ST.totM,`SUM(E${R0}:E${EX_N})`);[6,7,8].forEach(c=>h.set(t,c,'',XL_ST.tot));
  h.freeze={r:R0,c:1};if(extras.length)h.filtro=`A6:H${EX_N}`;
 }
 /* ===== Gastos ===== */
 {
  const h=H.gas;xlCabecera(h,9,'Gastos (fijos y variables)',sub);
  h.set(5,1,'Fijo = gasto recurrente del período · Variable = gasto puntual con boleta / comprobante.',XL_ST.nota);h.merge(5,1,5,9);
  const cols=[{t:'Período',w:12,e:'tdC'},{t:'Mes',w:17},{t:'Tipo',w:11,e:'tdC'},{t:'Categoría',w:20},{t:'Descripción',w:42,e:'tdW'},{t:'Proveedor',w:22},{t:'Tipo de pago',w:14},{t:'N° boleta / doc.',w:16},{t:'Monto',w:14,e:'tdM'}];
  const filas=gastos.map(({k,t,g})=>[k,etiqueta(k),t,g.categoria||'',g.descripcion||'',xlNombreProv(g.proveedorId),g.tipoPago||'',g.boleta||'',g.monto||0]);
  xlTabla(h,6,cols,filas);
  const t=GA_N+1;
  h.set(t,1,'TOTAL',XL_ST.tot);for(let c=2;c<=8;c++)h.set(t,c,'',XL_ST.tot);
  h.set(t,9,sumar(gastos.map(x=>x.g.monto||0)),XL_ST.totM,`SUM(I${R0}:I${GA_N})`);
  h.freeze={r:R0,c:1};if(gastos.length)h.filtro=`A6:I${GA_N}`;
 }
 /* ===== Multas ===== */
 {
  const h=H.mul;xlCabecera(h,10,'Multas',sub);
  h.set(5,1,'Solo las multas en estado «Pagada» cuentan como ingreso en el balance (se asignan al mes en que se cursó la multa).',XL_ST.nota);h.merge(5,1,5,10);
  const cols=[{t:'Período',w:12,e:'tdC'},{t:'Mes',w:17},{t:'Fecha multa',w:13,e:'tdC'},{t:'Depto.',w:9,e:'tdC'},{t:'Encargado',w:26},{t:'Regla',w:30,e:'tdW'},{t:'Motivo',w:36,e:'tdW'},{t:'Fecha pago',w:13,e:'tdC'},{t:'Monto',w:13,e:'tdM'},{t:'Estado',w:13,e:'tdC'}];
  const dnum=id=>{const d=deptos.find(x=>x.id===id);return d?String(d.numero||d.id):String(id);};
  const filas=multas.map(({k,m})=>[k,etiqueta(k),m.fecha_creacion||'',dnum(m.unidad_id),m.encargado||'',m.regla||'',m.motivo||'',m.fecha_pago||'',m.monto||0,m.estado||'']);
  xlTabla(h,6,cols,filas);
  const t=MU_N+1;h.set(t,1,'TOTAL',XL_ST.tot);for(let c=2;c<=10;c++)h.set(t,c,'',XL_ST.tot);
  h.set(t,9,sumar(multas.map(x=>x.m.monto||0)),XL_ST.totM,`SUM(I${R0}:I${MU_N})`);
  h.freeze={r:R0,c:1};if(multas.length)h.filtro=`A6:J${MU_N}`;
 }
 /* ===== Balance mensual ===== */
 const B=[];
 {
  const h=H.bal;xlCabecera(h,12,'Balance mensual y acumulado',sub);
  h.set(5,1,'Ingresos = Gasto común recaudado + Ingresos extra + Multas pagadas · Balance = Ingresos − Egresos · Acumulado = suma de los balances hasta cada mes.',XL_ST.nota);h.merge(5,1,5,12);
  const cols=[{t:'Período',w:12,e:'tdC'},{t:'Mes',w:17},{t:'Año',w:8,e:'tdC'},{t:'GC recaudado',w:15,e:'tdM'},{t:'Ingresos extra',w:15,e:'tdM'},{t:'Multas pagadas',w:15,e:'tdM'},{t:'Total ingresos',w:15,e:'tdM'},{t:'Gastos fijos',w:15,e:'tdM'},{t:'Gastos variables',w:15,e:'tdM'},{t:'Total egresos',w:15,e:'tdM'},{t:'Balance del mes',w:16,e:'tdM'},{t:'Balance acumulado',w:17,e:'tdM'}];
  const sx=(rangoSuma,rangoCrit,crit,extra)=>`SUMIFS(${rangoSuma},${rangoCrit},${crit}${extra||''})`;
  let acum=0;const filas=[];
  per.forEach((k,i)=>{
   const r=R0+i,a=xlNum(k);
   const e=sumar(extras.filter(x=>x.k===k).map(x=>x.g.monto||0));
   const mp=sumar(multas.filter(x=>x.k===k&&x.m.estado==='Pagada').map(x=>x.m.monto||0));
   const fi=sumar(gastos.filter(x=>x.k===k&&x.t==='Fijo').map(x=>x.g.monto||0));
   const va=sumar(gastos.filter(x=>x.k===k&&x.t==='Variable').map(x=>x.g.monto||0));
   const gcR=P[i].rec,ing=gcR+e+mp,egr=fi+va,bal=ing-egr;acum+=bal;B.push({k,a:a.a,gcR,e,mp,ing,fi,va,egr,bal,acum});
   filas.push([k,etiqueta(k),a.a,
    {v:gcR,f:`${q(NOM.pag)}${xlCol(PG.cR)}${r}`},
    {v:e,f:sx(`${q(NOM.ext)}$E$${R0}:$E$${EX_N}`,`${q(NOM.ext)}$A$${R0}:$A$${EX_N}`,`$A${r}`)},
    {v:mp,f:sx(`${q(NOM.mul)}$I$${R0}:$I$${MU_N}`,`${q(NOM.mul)}$A$${R0}:$A$${MU_N}`,`$A${r}`,`,${q(NOM.mul)}$J$${R0}:$J$${MU_N},"Pagada"`)},
    {v:ing,f:`D${r}+E${r}+F${r}`},
    {v:fi,f:sx(`${q(NOM.gas)}$I$${R0}:$I$${GA_N}`,`${q(NOM.gas)}$A$${R0}:$A$${GA_N}`,`$A${r}`,`,${q(NOM.gas)}$C$${R0}:$C$${GA_N},"Fijo"`)},
    {v:va,f:sx(`${q(NOM.gas)}$I$${R0}:$I$${GA_N}`,`${q(NOM.gas)}$A$${R0}:$A$${GA_N}`,`$A${r}`,`,${q(NOM.gas)}$C$${R0}:$C$${GA_N},"Variable"`)},
    {v:egr,f:`H${r}+I${r}`},{v:bal,f:`G${r}-J${r}`,s:{b:1}},
    {v:acum,f:i===0?`K${r}`:`L${r-1}+K${r}`,s:{b:1}}]);
  });
  xlTabla(h,6,cols,filas);
  const T=RT;h.set(T,1,'TOTAL',XL_ST.tot);h.set(T,2,'',XL_ST.tot);h.set(T,3,'',XL_ST.tot);
  ['gcR','e','mp','ing','fi','va','egr','bal'].forEach((key,j)=>{const c=4+j;h.set(T,c,sumar(B.map(x=>x[key])),XL_ST.totM,`SUM(${xlCol(c)}${R0}:${xlCol(c)}${RN})`);});
  h.set(T,12,B.length?B[B.length-1].acum:0,XL_ST.totM,`L${RN}`);
  h.freeze={r:R0,c:3};h.filtro=`A6:L${RN}`;
 }
 /* ===== Morosidad ===== */
 const mor=calcularMorosidad('todo'),MO_N=R0+Math.max(nd,1)-1;
 const morDe=id=>mor.find(x=>x.dep.id===id);
 {
  const h=H.mor;xlCabecera(h,8,'Morosidad vigente (deuda pendiente por departamento)',sub);
  h.set(5,1,`Gasto común impago desde ${formatPeriodo(priKey)} hasta ${formatPeriodo(limKey)} (excluye meses sin cobro y meses eximidos) más multas pendientes.`,XL_ST.nota);h.merge(5,1,5,8);
  const cols=[{t:'Depto.',w:12,e:'tdC'},{t:'Representante',w:28},{t:'Contacto',w:16},{t:'Meses GC adeudados',w:12,e:'tdC'},{t:'Detalle',w:46,e:'tdW'},{t:'Deuda GC',w:14,e:'tdM'},{t:'Multas pendientes',w:14,e:'tdM'},{t:'Total adeudado',w:16,e:'tdM'}];
  const filas=deptos.map((d,i)=>{
   const m=morDe(d.id),r=R0+i,g=m?m.gcMeses:[],gcT=sumar(g.map(x=>x.monto)),muT=m?sumar(m.multas.map(x=>x.monto)):0;
   const det=!g.length?'Al día':(g.length>6?`${g[0].label} → ${g[g.length-1].label} (${g.length} meses)`:g.map(x=>x.label).join(', '));
   return [String(d.numero||d.id),d.representante||'',d.contacto||'',g.length,det,gcT,muT,{v:gcT+muT,f:`F${r}+G${r}`,s:{b:1}}];
  });
  xlTabla(h,6,cols,filas);
  const t=MO_N+1;h.set(t,1,'TOTAL',XL_ST.tot);h.set(t,2,'',XL_ST.tot);h.set(t,3,'',XL_ST.tot);h.set(t,5,'',XL_ST.tot);
  h.set(t,4,sumar(mor.map(x=>x.gcMeses.length)),XL_ST.totC,`SUM(D${R0}:D${MO_N})`);
  [6,7,8].forEach(c=>{const key=c===6?x=>sumar(x.gcMeses.map(g=>g.monto)):c===7?x=>sumar(x.multas.map(m=>m.monto)):x=>x.total;h.set(t,c,sumar(mor.map(key)),XL_ST.totM,`SUM(${xlCol(c)}${R0}:${xlCol(c)}${MO_N})`);});
  h.freeze={r:R0,c:2};
 }
 const morTotal=sumar(mor.map(x=>x.total));
 /* ===== Departamentos ===== */
 {
  const h=H.dep;xlCabecera(h,7,'Departamentos',sub);
  h.set(5,1,'Datos de contacto: uso exclusivo de la directiva (datos personales).',XL_ST.nota);h.merge(5,1,5,7);
  const cols=[{t:'Depto.',w:12,e:'tdC'},{t:'Representante',w:30},{t:'Contacto',w:18},{t:'Meses pagados',w:12,e:'tdC'},{t:'Meses eximidos',w:12,e:'tdC'},{t:'Meses pendientes',w:12,e:'tdC'},{t:'Deuda actual',w:16,e:'tdM'}];
  const filas=deptos.map((d,i)=>{
   const r=R0+i,col=xlCol(PG.c0+i),rg=`${q(NOM.pag)}${col}$${R0}:${col}$${RN}`;
   const pag=per.filter(k=>estaPagado(((appData.pagos||{})[k]||{})[d.id])).length;
   const exm=per.filter(k=>!estaPagado(((appData.pagos||{})[k]||{})[d.id])&&!mesSinCobro(k)&&k>=priKey&&k<=limKey&&esExento(k,d.id)).length;
   const m=morDe(d.id),pend=m?m.gcMeses.length:0;
   return [String(d.numero||d.id),d.representante||'',d.contacto||'',
    {v:pag,f:`COUNTIF(${rg},"T")+COUNTIF(${rg},"E")`},{v:exm,f:`COUNTIF(${rg},"EX")`},{v:pend,f:`COUNTBLANK(${rg})`},
    {v:m?m.total:0,f:`IFERROR(INDEX(${q(NOM.mor)}$H$${R0}:$H$${MO_N},MATCH($A${r},${q(NOM.mor)}$A$${R0}:$A$${MO_N},0)),0)`}];
  });
  xlTabla(h,6,cols,filas);
  const t=R0+nd;h.set(t,1,'TOTAL',XL_ST.tot);[2,3].forEach(c=>h.set(t,c,'',XL_ST.tot));
  [4,5,6,7].forEach(c=>{const v=sumar(filas.map(f=>f[c-1].v));h.set(t,c,v,c===7?XL_ST.totM:XL_ST.totC,`SUM(${xlCol(c)}${R0}:${xlCol(c)}${R0+nd-1})`);});
  h.freeze={r:R0,c:2};
 }
 /* ===== Exenciones ===== */
 {
  const h=H.exe;xlCabecera(h,7,'Departamentos eximidos de gasto común',sub);
  const c=cfgCobro();
  h.set(5,1,`Un depto. eximido no participa de recaudación, morosidad ni contadores en ese mes.  Inicio de cobro: ${c.inicio?formatPeriodo(c.inicio):'sin definir'} (${c.bloqueo?'meses anteriores bloqueados':'bloqueo desactivado'}).`,XL_ST.nota);h.merge(5,1,5,7);
  const cols=[{t:'Depto.',w:12,e:'tdC'},{t:'Representante',w:28},{t:'Período',w:12,e:'tdC'},{t:'Mes',w:18},{t:'Motivo',w:34,e:'tdW'},{t:'Registrado por',w:18},{t:'Fecha de registro',w:20,e:'tdC'}];
  const filas=[];
  Object.keys(appData.exentos||{}).sort().forEach(k=>{Object.keys(appData.exentos[k]||{}).forEach(id=>{const rec=appData.exentos[k][id];if(!rec)return;const d=deptos.find(x=>String(x.id)===String(id));filas.push([d?String(d.numero||d.id):String(id),d?d.representante||'':'',k,etiqueta(k),(rec&&rec.m)||'',(rec&&rec.por)||'',(rec&&rec.ts)?fechaHoraCL(rec.ts):'']);});});
  filas.sort((a,b)=>a[2].localeCompare(b[2])||a[0].localeCompare(b[0],'es',{numeric:true}));
  if(!filas.length)filas.push(['','','','Sin exenciones registradas','','','']);
  const u=xlTabla(h,6,cols,filas);h.freeze={r:R0,c:1};if(filas.length>1)h.filtro=`A6:G${u}`;
 }
 /* ===== Proveedores ===== */
 {
  const h=H.prov;xlCabecera(h,8,'Proveedores',sub);
  const cols=[{t:'Nombre',w:30},{t:'Rubro',w:20},{t:'Contacto',w:22},{t:'Teléfono',w:16},{t:'Email',w:28},{t:'Valoración',w:11,e:'tdC'},{t:'Estado',w:11,e:'tdC'},{t:'Notas',w:40,e:'tdW'}];
  const filas=(appData.proveedores||[]).slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es')).map(p=>[p.nombre||'',p.rubro||'',p.contacto||'',p.telefono||'',p.email||'',p.valoracion||'',p.activo===false?'Inactivo':'Activo',p.notas||'']);
  if(!filas.length)filas.push(['Sin proveedores registrados','','','','','','','']);
  const u=xlTabla(h,6,cols,filas);h.freeze={r:R0,c:1};if(filas.length>1)h.filtro=`A6:H${u}`;
 }
 /* ===== Mantenciones ===== */
 {
  const h=H.man;xlCabecera(h,6,'Mantenciones programadas',sub);
  const cols=[{t:'Mantención',w:34},{t:'Categoría',w:20},{t:'Cada (meses)',w:12,e:'tdC'},{t:'Inicio',w:12,e:'tdC'},{t:'Última ejecución',w:16,e:'tdC'},{t:'Ejecuciones',w:12,e:'tdC'}];
  const hechas=appData.mantencionesHechas||[];
  const filas=(appData.mantenciones||[]).map(m=>{const e=hechas.filter(x=>x.mantencionId===m.id).map(x=>String(x.periodo||'')).sort();return [m.nombre||'',m.categoria||'',m.cicloMeses||'',m.inicio||'',e.length?e[e.length-1]:'',e.length];});
  if(!filas.length)filas.push(['Sin mantenciones registradas','','','','','']);
  const u=xlTabla(h,6,cols,filas);h.freeze={r:R0,c:1};
 }
 /* ===== Resumen ===== */
 const balApp=calcularBalanceGeneral(),balXl=B.length?B[B.length-1].acum:0;
 {
  const h=H.res;xlCabecera(h,10,'Resumen ejecutivo',sub);
  h.ancho(1,12);for(let c=2;c<=10;c++)h.ancho(c,15);
  const kp=[['Balance general acumulado',balXl,`${q(NOM.bal)}L${RN}`,XL_CLP],['Total ingresos',sumar(B.map(x=>x.ing)),`${q(NOM.bal)}G${RT}`,XL_CLP],['Total egresos',sumar(B.map(x=>x.egr)),`${q(NOM.bal)}J${RT}`,XL_CLP],['Morosidad vigente',morTotal,`${q(NOM.mor)}H${MO_N+1}`,XL_CLP]];
  const tp=sumar(P.map(x=>x.pag)),te=sumar(P.map(x=>x.exig));
  kp.push(['Cobranza histórica GC',te?tp/te:0,`IF(${q(NOM.pag)}${xlCol(PG.cE)}${RT}=0,0,${q(NOM.pag)}${xlCol(PG.cP)}${RT}/${q(NOM.pag)}${xlCol(PG.cE)}${RT})`,'0%']);
  kp.forEach(([t,v,f,fmt],i)=>{
   const c=1+i*2;
   h.set(6,c,t,{b:1,sz:9,c:'#FFFFFF',bg:XL_C.marca2,al:'center',wrap:1});h.set(6,c+1,'',{bg:XL_C.marca2});h.merge(6,c,6,c+1);
   h.set(7,c,v,{b:1,sz:16,c:XL_C.marca,bg:XL_C.cian,al:'center',fmt},f);h.set(7,c+1,'',{bg:XL_C.cian});h.merge(7,c,7,c+1);
  });
  h.alto(6,26);h.alto(7,34);
  /* tabla por año */
  const yrs=[...new Set(B.map(x=>x.a))],Y0=11;
  h.set(9,1,'Comparativo por año',XL_ST.sec);for(let c=2;c<=10;c++)h.set(9,c,'',XL_ST.sec);h.alto(9,22);
  const cols=['Año','GC recaudado','Ingresos extra','Multas pagadas','Total ingresos','Gastos fijos','Gastos variables','Total egresos','Balance del año','Acumulado al cierre'];
  h.alto(10,30);cols.forEach((t,i)=>h.set(10,i+1,t,XL_ST.th));
  const mapa=['gcR','e','mp','ing','fi','va','egr','bal'],colB=['D','E','F','G','H','I','J','K'];
  let ac=0;
  yrs.forEach((y,i)=>{
   const r=Y0+i,z=(i%2)?{bg:XL_C.zebra}:{};h.set(r,1,y,Object.assign({},XL_ST.tdC,{b:1},z));
   mapa.forEach((key,j)=>{h.set(r,2+j,sumar(B.filter(x=>x.a===y).map(x=>x[key])),Object.assign({},XL_ST.tdM,z),`SUMIFS(${q(NOM.bal)}$${colB[j]}$${R0}:$${colB[j]}$${RN},${q(NOM.bal)}$C$${R0}:$C$${RN},$A${r})`);});
   ac+=sumar(B.filter(x=>x.a===y).map(x=>x.bal));
   h.set(r,10,ac,Object.assign({},XL_ST.tdM,{b:1},z),i===0?`I${r}`:`J${r-1}+I${r}`);
  });
  const T=Y0+yrs.length;h.set(T,1,'TOTAL',XL_ST.tot);
  mapa.forEach((key,j)=>h.set(T,2+j,sumar(B.map(x=>x[key])),XL_ST.totM,`SUM(${xlCol(2+j)}${Y0}:${xlCol(2+j)}${T-1})`));
  h.set(T,10,ac,XL_ST.totM,`J${T-1}`);
  /* control de cuadratura */
  const C=T+3;h.set(C,1,'Control de cuadratura',XL_ST.sec);for(let c=2;c<=10;c++)h.set(C,c,'',XL_ST.sec);h.alto(C,22);
  const filaC=(r,t,v,f,fmt,b)=>{h.set(r,1,t,{bd:'all',b:b?1:0});h.merge(r,1,r,4);for(let c=2;c<=4;c++)h.set(r,c,'',{bd:'all'});h.set(r,5,v,{bd:'all',fmt:fmt||XL_CLP,al:'right',b:b?1:0},f);};
  filaC(C+1,'Balance acumulado de este libro',balXl,`${q(NOM.bal)}L${RN}`);
  filaC(C+2,'Balance general acumulado según la app',balApp,null);
  filaC(C+3,'Diferencia (debe ser $0)',balXl-balApp,`E${C+1}-E${C+2}`,XL_CLP,true);
  h.set(C+4,1,'La diferencia puede no ser $0 si existen registros anteriores a 2018 o posteriores a 2028, que la app no considera.',XL_ST.nota);h.merge(C+4,1,C+4,10);h.alto(C+4,28);
  h.freeze={r:8,c:1};
 }
 /* ===== Portada ===== */
 {
  const h=H.por;h.orient='portrait';
  h.ancho(1,12);h.ancho(2,34);h.ancho(3,64);h.ancho(4,6);h.ancho(5,6);h.ancho(6,6);
  xlCabecera(h,6,'Consolidado general de la aplicación',sub);
  h.set(6,2,'CONSOLIDADO GENERAL',{b:1,sz:22,c:XL_C.marca});h.merge(6,2,6,3);h.alto(6,38);
  h.set(7,2,'Historial completo de ingresos, egresos, pagos y morosidad',{sz:11,c:XL_C.gris});h.merge(7,2,7,3);h.alto(7,22);
  const info=[['Generado',stamp],['Generado por',(typeof checkSession==='function'&&checkSession())||'Administración'],['Versión de la aplicación',typeof APP_VERSION!=='undefined'?APP_VERSION:''],
   ['Período cubierto',per.length?`${formatPeriodo(per[0])} a ${formatPeriodo(per[per.length-1])} (${per.length} meses)`:'—'],['Departamentos',String(nd)],
   ['Gasto común vigente',fmt(getGC(hoyD.getFullYear(),hoyD.getMonth()))+' por departamento'],['Inicio de cobro',cfgCobro().inicio?formatPeriodo(cfgCobro().inicio):'sin definir']];
  info.forEach(([a,b],i)=>{const r=9+i;h.set(r,1,'',{bd:'bottom'});h.set(r,2,a,{b:1,c:XL_C.marca,bd:'bottom'});h.set(r,3,b,{bd:'bottom'});});
  const r1=9+info.length+1;
  h.set(r1,1,'Contenido',XL_ST.sec);h.set(r1,2,'',XL_ST.sec);h.set(r1,3,'',XL_ST.sec);h.alto(r1,22);
  const idx=[['res','Resumen ejecutivo: indicadores, comparativo por año y control de cuadratura'],['bal','Balance mensual y acumulado (todos los meses)'],['pag','Pagos de gasto común: quién pagó cada mes, cobranza y recaudación'],['ext','Ingresos extra'],['gas','Gastos fijos y variables'],['mul','Multas'],['mor','Morosidad vigente por departamento'],['dep','Departamentos y contactos'],['exe','Departamentos eximidos'],['prov','Proveedores'],['man','Mantenciones programadas']];
  idx.forEach(([k,d],i)=>{const r=r1+1+i;h.set(r,1,i+1,{al:'center',c:XL_C.gris});h.set(r,2,NOM[k],{c:'#0E7490',b:1});h.link(r,2,`'${NOM[k]}'!A1`);h.set(r,3,d,{c:'#374151'});});
  const r2=r1+idx.length+2;
  h.set(r2,1,'⚠ DOCUMENTO CONFIDENCIAL. Contiene nombres y teléfonos de residentes (datos personales). Uso exclusivo de la directiva: no reenviar ni publicar. Los totales son fórmulas: si modifica un dato, se recalculan.',{b:1,c:'#92400E',bg:XL_C.ambarC,wrap:1,va:'center',bd:'all',bc:'#F59E0B'});
  h.merge(r2,1,r2,3);for(let c=2;c<=3;c++)h.set(r2,c,'',{bg:XL_C.ambarC,bd:'all',bc:'#F59E0B'});h.alto(r2,52);
 }
 const logo=xlBytesDeDataUrl(LOGO_VOUCHER_DATA);
 return L.empaquetar(logo,'Consolidado general — Condominio Bosques del Sur 4',(typeof checkSession==='function'&&checkSession())||'Administración CBS4');
}

/* ---------- botón del Panel Central ---------- */
async function exportarExcelConsolidado(btn){
 if(state.isTransparencia){showToast('Solo para administradores','error');return;}
 const txt=btn&&btn.textContent;if(btn){btn.disabled=true;btn.textContent='Generando Excel…';}
 try{
  const bytes=await xlConstruir();
  const nombre='Consolidado_CBS4_'+fechaClave(new Date())+'.xlsx',mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  let hecho=false;
  if(typeof pdfEsIOS==='function'&&pdfEsIOS()){try{const f=new File([bytes],nombre,{type:mime});if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:nombre});hecho=true;}}catch(e){if(e&&e.name==='AbortError')hecho=true;}}
  if(!hecho){descargarBlob(bytes,mime,nombre);showToast('Excel generado ✓ — revisa tus Descargas','success');}
 }catch(e){console.error(e);showToast('No se pudo generar el Excel','error');}
 finally{if(btn){btn.disabled=false;btn.textContent=txt;}}
}
