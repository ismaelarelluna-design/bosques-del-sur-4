/* ===========================================================================
   Rendición de cuentas — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   Informe financiero en PDF (mensual o anual) con el mismo motor, logo y estilo
   que los certificados y actas (certificados_pdf.js).

   Decisiones de diseño:
   - NO se guarda nada en Firebase: el informe se calcula al momento con los
     registros vigentes y el PDF indica la fecha de generación. Si después se
     corrige un pago, se vuelve a generar. (Un informe "congelado" con folio
     solo tendría sentido si se presenta formalmente; si lo necesitan, se agrega.)
   - Usa las MISMAS fórmulas que el resto de la app (balanceMes, getGC,
     contarPagos, calcularMorosidad) para que las cifras coincidan con Panel,
     Gasto Común y Transparencia.
   - El detalle de morosidad por departamento es opcional y desactivado por
     defecto: son datos personales y el informe suele presentarse en asamblea.
   - Folio informativo derivado del período (RDC-AAAA-MM / RDA-AAAA).
   =========================================================================== */
function estadoRend(){
 if(!state.rend){const l=ultimoPeriodoExigible();state.rend={tipo:'mensual',anio:l.anio,mes:l.mes,det:false};}
 return state.rend;
}
const REND_MES_CORTO=m=>MESES[m].slice(0,3);

/* ---------- cálculo ---------- */
function rendComponentes(a,m){
 const k=mkKey(a,m),gc=getGC(a,m),pg=contarPagos((appData.pagos||{})[k]||{});
 const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===a&&g.mes===m).reduce((s,g)=>s+(Number(g.monto)||0),0);
 const mp=(appData.multas||[]).filter(x=>x.anio===a&&x.mes===m&&x.estado==='Pagada').reduce((s,x)=>s+(Number(x.monto)||0),0);
 const fijos=comoLista(((appData.gastosFijos||{})[k])||[]).map(g=>({...g,tipo:'Fijo'}));
 const vars=(appData.gastosVariables||[]).filter(g=>g.anio===a&&g.mes===m).map(g=>({...g,tipo:'Variable'}));
 const gastos=fijos.concat(vars);
 const egr=gastos.reduce((s,g)=>s+(Number(g.monto)||0),0);
 const ing=pg*gc+ex+mp;
 return {a,m,k,gc,pg,ingGC:pg*gc,ex,mp,ing,gastos,egr,saldo:ing-egr};
}
function rendCategorias(gastos){
 const mapa={};gastos.forEach(g=>{const c=categoriaDeGasto(g);mapa[c]=(mapa[c]||0)+(Number(g.monto)||0);});
 return mapa;
}
function rendSaldoAcumulado(a,m){let t=0;for(let y=2018;y<=a;y++){const lim=(y===a)?m:11;for(let i=0;i<=lim;i++)t+=balanceMes(y,i);}return t;}
function rendPeriodoAnterior(a,m){return m===0?{a:a-1,m:11}:{a,m:m-1};}
/* Deuda acumulada hasta el período indicado (mismos criterios que Morosidad / "todo el historial") */
function rendMorosidad(a,m){
 const tope=mkKey(a,m);const keys=clavesVentana('todo').filter(k=>k<=tope);
 const out=[];
 (appData.departamentos||[]).forEach(dep=>{
  let n=0,tot=0;
  keys.forEach(k=>{if(!estaPagado(((appData.pagos||{})[k]||{})[dep.id])){n++;tot+=getGC(parseInt(k.slice(0,4)),parseInt(k.slice(5,7))-1);}});
  const mul=(appData.multas||[]).filter(x=>x.unidad_id===dep.id&&x.estado!=='Pagada'&&x.estado!=='Anulada'&&mkKey(x.anio,x.mes)<=tope);
  const tm=mul.reduce((s,x)=>s+(Number(x.monto)||0),0);
  if(tot+tm>0)out.push({dep,n,gc:tot,multas:mul.length,tm,total:tot+tm});
 });
 return out.sort((x,y)=>y.total-x.total);
}
function rendDatosMensual(a,m){
 const cur=rendComponentes(a,m),p=rendPeriodoAnterior(a,m),prev=rendComponentes(p.a,p.m);
 const cats=rendCategorias(cur.gastos),catsP=rendCategorias(prev.gastos);
 const mor=rendMorosidad(a,m);
 let ingA=0,egrA=0;for(let i=0;i<=m;i++){const c=rendComponentes(a,i);ingA+=c.ing;egrA+=c.egr;}
 const serie=[];for(let i=5;i>=0;i--){const d=new Date(a,m-i,1);const c=rendComponentes(d.getFullYear(),d.getMonth());serie.push({l:REND_MES_CORTO(d.getMonth())+' '+String(d.getFullYear()).slice(2),ing:c.ing,egr:c.egr});}
 return {tipo:'mensual',a,m,cur,prev,p,cats,catsP,mor,total:(appData.departamentos||[]).length||TOTAL_DEPTOS,
  acum:{ing:ingA,egr:egrA,saldo:ingA-egrA},saldoAcum:rendSaldoAcumulado(a,m),serie,
  compVig:(typeof compromisosLista==='function')?compromisosLista().filter(c=>compEstado(c)==='vigente').length:0,
  compInc:(typeof compromisosLista==='function')?compromisosLista().filter(c=>compEstado(c)==='incumplido').length:0,
  acuPend:(typeof acuerdosPendientes==='function')?acuerdosPendientes().length:0,
  folio:'RDC-'+a+'-'+String(m+1).padStart(2,'0')};
}
function rendDatosAnual(a){
 const lx=ultimoPeriodoExigible(),ultimo=a<lx.anio?11:(a===lx.anio?lx.mes:0);
 const meses=[];let cats={},ing=0,egr=0,gastos=[];
 for(let i=0;i<=ultimo;i++){const c=rendComponentes(a,i);meses.push(c);ing+=c.ing;egr+=c.egr;gastos=gastos.concat(c.gastos);}
 cats=rendCategorias(gastos);
 const mor=rendMorosidad(a,ultimo);
 return {tipo:'anual',a,ultimo,meses,cats,ing,egr,saldo:ing-egr,saldoAcum:rendSaldoAcumulado(a,ultimo),mor,total:(appData.departamentos||[]).length||TOTAL_DEPTOS,folio:'RDA-'+a};
}

/* ---------- vista ---------- */
function vRendicion(){
 const e=estadoRend();
 const tabs=`<div class="seg"><button class="seg-btn ${e.tipo==='mensual'?'on':''}" onclick="setRend({tipo:'mensual'})">📅 Mensual</button><button class="seg-btn ${e.tipo==='anual'?'on':''}" onclick="setRend({tipo:'anual'})">📆 Anual</button></div>`;
 const d=e.tipo==='mensual'?rendDatosMensual(e.anio,e.mes):rendDatosAnual(e.anio);
 const ing=e.tipo==='mensual'?d.cur.ing:d.ing,egr=e.tipo==='mensual'?d.cur.egr:d.egr,sal=ing-egr;
 const yrs=YEARS.map(y=>`<option value="${y}" ${y===e.anio?'selected':''}>${y}</option>`).join('');
 return `<div class="page-title">Rendición de cuentas</div>
 <div class="page-sub">Informe financiero en PDF con logo y folio, listo para presentar o compartir. Se calcula con los registros actuales.</div>
 <div class="toolbar">${tabs}
  ${e.tipo==='mensual'?`<select class="fi" style="width:auto" onchange="setRend({mes:parseInt(this.value)})">${MESES.map((n,i)=>`<option value="${i}" ${i===e.mes?'selected':''}>${n}</option>`).join('')}</select>`:''}
  <select class="fi" style="width:auto" onchange="setRend({anio:parseInt(this.value)})">${yrs}</select>
  <div class="toolbar-sep"></div><button class="btn btn-primary" onclick="rendGenerarPDF()">📄 Generar PDF</button></div>
 <div class="stats-grid mant-stats">
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">📥</span>Ingresos</div><div class="stat-value small" data-plain style="color:var(--green)">${fmt(ing)}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">📤</span>Egresos</div><div class="stat-value small" data-plain style="color:var(--danger)">${fmt(egr)}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">⚖️</span>${e.tipo==='mensual'?'Saldo del mes':'Saldo del año'}</div><div class="stat-value small" data-plain style="color:${sal>=0?'var(--green)':'var(--danger)'}">${fmt(sal)}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">💰</span>Saldo acumulado</div><div class="stat-value small" data-plain>${fmt(d.saldoAcum)}</div></div></div>
 <div class="card" style="margin-bottom:14px"><div class="card-title">Contenido del PDF</div>
  <div style="font-size:13px;color:var(--text2);line-height:1.7">${e.tipo==='mensual'
   ?'Resumen del período · ingresos y egresos comparados con el mes anterior · egresos por categoría y detalle · cobranza y deuda acumulada · evolución de los últimos 6 meses · acumulado del año · firmas de la directiva.'
   :'Resumen del año · tabla mes a mes (ingresos, egresos, saldo y departamentos al día) · egresos por categoría · deuda acumulada al cierre · firmas de la directiva.'}</div>
  <label class="cp-it" style="border:none;padding:10px 0 0;cursor:pointer"><input type="checkbox" ${e.det?'checked':''} onchange="setRend({det:this.checked})"/><span>Incluir detalle de deuda por departamento <em style="color:var(--text3);font-style:normal">(datos personales: solo uso interno de la directiva)</em></span></label></div>
 <div style="font-size:11px;color:var(--text3);line-height:1.6">Las cifras usan las mismas fórmulas del Panel, Gasto Común y Transparencia, por lo que coinciden. El informe es una fotografía de los registros al momento de generarlo (queda la fecha en el documento). Si corriges un pago o un gasto después, vuelve a generarlo.</div>`;
}
function setRend(p){Object.assign(estadoRend(),p);renderView();}

/* ---------- PDF ---------- */
function rendTrunc(c,s,w,size){
 let t=pdfSan(String(s==null?'':s));const f=c.F;if(f.widthOfTextAtSize(t,size)<=w)return t;
 while(t.length>1&&f.widthOfTextAtSize(t+'…',size)>w)t=t.slice(0,-1);return t+'…';
}
function rendVar(cur,prev){
 const d=cur-prev;if(!prev&&!cur)return '—';if(!prev)return d>0?'nuevo':'—';
 const pct=Math.round(d/Math.abs(prev)*100);return (d>=0?'+':'-')+Math.abs(pct)+'%';
}
function pdfBarras(c,serie){
 if(!serie||!serie.length)return;
 const W=PDF_W-PDF_M*2,H=104,top=c.y;pdfAsegurar(c,H+46);
 const max=Math.max(1,...serie.map(s=>Math.max(s.ing,s.egr))),gw=W/serie.length,bw=Math.min(24,gw/2-6),base=c.y+H;
 pdfLinea(c,PDF_M,PDF_W-PDF_M,base,'#9CA3AF',0.8);
 serie.forEach((s,i)=>{
  const cx=PDF_M+gw*i+gw/2,hi=Math.max(1,s.ing/max*(H-16)),he=Math.max(1,s.egr/max*(H-16));
  pdfRect(c,cx-bw-1,base-hi,bw,hi,PDF_COL.marca2);pdfRect(c,cx+1,base-he,bw,he,'#F87171');
  const t=fmt(s.ing).replace('$','');pdfTexto(c,t,{x:cx-bw-1+bw/2-c.F.widthOfTextAtSize(pdfSan(t),6.5)/2,size:6.5,color:PDF_COL.gris,y:base-hi-3});
  const t2=fmt(s.egr).replace('$','');pdfTexto(c,t2,{x:cx+1+bw/2-c.F.widthOfTextAtSize(pdfSan(t2),6.5)/2,size:6.5,color:PDF_COL.gris,y:base-he-3});
  pdfTexto(c,s.l,{x:cx-c.F.widthOfTextAtSize(pdfSan(s.l),8)/2,size:8,color:PDF_COL.gris,y:base+12});
 });
 c.y=base+20;
 pdfRect(c,PDF_M,c.y,9,9,PDF_COL.marca2);pdfTexto(c,'Ingresos',{x:PDF_M+13,size:8.5,color:'#374151',y:c.y+8});
 pdfRect(c,PDF_M+70,c.y,9,9,'#F87171');pdfTexto(c,'Egresos',{x:PDF_M+83,size:8.5,color:'#374151',y:c.y+8});
 c.y+=22;
}
function rendFilaTotal(c,etiqueta,valor,color){
 pdfAsegurar(c,24);pdfTexto(c,etiqueta,{x:PDF_M+8,size:10.5,font:c.B,color:color||PDF_COL.marca,y:c.y+12});
 pdfTexto(c,valor,{size:10.5,font:c.B,color:color||PDF_COL.marca,align:'right',right:PDF_W-PDF_M-8,y:c.y+12});c.y+=22;
}
function rendTablaMorosidad(c,mor){
 pdfSeccion(c,'Detalle de deuda por departamento (uso interno)');
 if(!mor.length){pdfParrafo(c,'No hay departamentos con deuda a la fecha del informe.',{size:10,justify:false});return;}
 const W=PDF_W-PDF_M*2;
 pdfTabla(c,[{t:'Depto',w:70},{t:'Meses impagos',w:W-70-110-110,align:'right'},{t:'Multas',w:110,align:'right'},{t:'Deuda',w:110,align:'right'}],
  mor.map(x=>[String(x.dep.numero),String(x.n),x.multas?fmt(x.tm):'—',fmt(x.total)]));
}
async function pdfRendicionMensual(d){
 if(!pdfListo())throw new Error('Librería PDF no disponible');
 const c=await pdfNuevo('Rendición de Cuentas',d.folio),W=PDF_W-PDF_M*2,cur=d.cur,prev=d.prev;
 const hoy=actaFechaLarga(actaHoyISO());
 pdfTexto(c,'Folio N° '+d.folio,{size:12,font:c.B,color:PDF_COL.marca});
 pdfTexto(c,'Período: '+MESES[d.m]+' '+d.a,{size:9.5,color:PDF_COL.gris,align:'right'});
 c.y+=10;pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,PDF_COL.borde,0.8);c.y+=20;
 pdfParrafo(c,'El Comité de Administración del Condominio Bosques del Sur 4 presenta la rendición de cuentas correspondiente a '+MESES[d.m].toLowerCase()+' de '+d.a+', elaborada con los registros del sistema al '+hoy+'.',{size:10.5,lh:15.5,despues:10});
 pdfFranja(c,[['Ingresos del mes',fmt(cur.ing),PDF_COL.verde],['Egresos del mes',fmt(cur.egr),PDF_COL.rojo],['Saldo del mes',fmt(cur.saldo),cur.saldo>=0?PDF_COL.marca:PDF_COL.rojo],['Saldo acumulado',fmt(d.saldoAcum),PDF_COL.marca]]);
 /* 1. ingresos */
 pdfSeccion(c,'1. Ingresos');
 const cw=[W-120-120-70,120,120,70];
 pdfTabla(c,[{t:'Concepto',w:cw[0]},{t:MESES[d.m].slice(0,3)+' '+d.a,w:cw[1],align:'right'},{t:'Mes anterior',w:cw[2],align:'right'},{t:'Var.',w:cw[3],align:'right'}],[
  ['Gastos comunes ('+cur.pg+' de '+d.total+' deptos × '+fmt(cur.gc)+')',fmt(cur.ingGC),fmt(prev.ingGC),rendVar(cur.ingGC,prev.ingGC)],
  ['Ingresos extra',fmt(cur.ex),fmt(prev.ex),rendVar(cur.ex,prev.ex)],
  ['Multas cobradas',fmt(cur.mp),fmt(prev.mp),rendVar(cur.mp,prev.mp)]]);
 rendFilaTotal(c,'TOTAL INGRESOS',fmt(cur.ing),PDF_COL.verde);
 /* 2. egresos por categoría */
 pdfSeccion(c,'2. Egresos por categoría');
 const cats=Object.keys(Object.assign({},d.cats,d.catsP)).sort((x,y)=>(d.cats[y]||0)-(d.cats[x]||0));
 if(cats.length)pdfTabla(c,[{t:'Categoría',w:W-120-120-70},{t:'Monto',w:120,align:'right'},{t:'Mes anterior',w:120,align:'right'},{t:'% del mes',w:70,align:'right'}],
  cats.map(k=>[k,fmt(d.cats[k]||0),fmt(d.catsP[k]||0),cur.egr?Math.round((d.cats[k]||0)/cur.egr*100)+'%':'—']));
 else pdfParrafo(c,'No hay egresos registrados en el período.',{size:10,justify:false});
 rendFilaTotal(c,'TOTAL EGRESOS',fmt(cur.egr),PDF_COL.rojo);
 /* detalle */
 if(cur.gastos.length){
  pdfSeccion(c,'3. Detalle de egresos');
  pdfTabla(c,[{t:'Descripción',w:W-70-120-100},{t:'Tipo',w:70},{t:'Categoría',w:120},{t:'Monto',w:100,align:'right'}],
   cur.gastos.sort((x,y)=>(Number(y.monto)||0)-(Number(x.monto)||0)).map(g=>[rendTrunc(c,g.descripcion||'(sin descripción)',W-70-120-100-16,9.5),g.tipo,rendTrunc(c,categoriaDeGasto(g),120-16,9.5),fmt(Number(g.monto)||0)]));
 }
 /* cobranza */
 pdfAsegurar(c,210);pdfSeccion(c,(cur.gastos.length?'4':'3')+'. Cobranza y deuda acumulada');
 const deuda=d.mor.reduce((s,x)=>s+x.gc,0),multas=d.mor.reduce((s,x)=>s+x.tm,0);
 pdfFicha(c,[['Deptos al día en el mes',cur.pg+' de '+d.total+' ('+Math.round(cur.pg/d.total*100)+'%)'],['Deptos pendientes del mes',String(d.total-cur.pg)],
  ['Deptos con deuda acumulada',String(d.mor.length),d.mor.length?PDF_COL.rojo:PDF_COL.verde],['Gastos comunes adeudados',fmt(deuda),deuda?PDF_COL.rojo:PDF_COL.verde],['Multas pendientes',fmt(multas)],
  ['Compromisos de pago',d.compVig+' vigente'+(d.compVig===1?'':'s')+(d.compInc?' · '+d.compInc+' incumplido'+(d.compInc===1?'':'s'):'')]]);
 if(estadoRend().det)rendTablaMorosidad(c,d.mor);
 /* evolución */
 pdfSeccion(c,'Evolución de los últimos 6 meses');
 pdfBarras(c,d.serie);
 /* acumulado */
 pdfSeccion(c,'Acumulado del año '+d.a+' (enero a '+MESES[d.m].toLowerCase()+')');
 pdfFranja(c,[['Ingresos acumulados',fmt(d.acum.ing),PDF_COL.verde],['Egresos acumulados',fmt(d.acum.egr),PDF_COL.rojo],['Resultado del año',fmt(d.acum.saldo),d.acum.saldo>=0?PDF_COL.marca:PDF_COL.rojo]]);
 if(d.acuPend)pdfParrafo(c,'Acuerdos de asamblea y reuniones pendientes de cumplimiento: '+d.acuPend+'.',{size:9.5,color:'#374151',justify:false});
 pdfFirmas(c,PDF_ROLES);
 c.y+=8;pdfParrafo(c,'Informe elaborado con los registros del sistema al '+hoy+'. Los respaldos (boletas y comprobantes) están disponibles en la aplicación. No reemplaza los documentos contables que exija la ley o el reglamento de copropiedad.',{size:8,color:PDF_COL.gris,despues:0});
 pdfCerrar(c,'Rendición de Cuentas');
 return await pdfBytes(c);
}
async function pdfRendicionAnual(d){
 if(!pdfListo())throw new Error('Librería PDF no disponible');
 const c=await pdfNuevo('Balance Anual',d.folio),W=PDF_W-PDF_M*2,hoy=actaFechaLarga(actaHoyISO());
 pdfTexto(c,'Folio N° '+d.folio,{size:12,font:c.B,color:PDF_COL.marca});
 pdfTexto(c,'Año '+d.a+(d.ultimo<11?' (enero a '+MESES[d.ultimo].toLowerCase()+')':''),{size:9.5,color:PDF_COL.gris,align:'right'});
 c.y+=10;pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,PDF_COL.borde,0.8);c.y+=20;
 pdfParrafo(c,'El Comité de Administración del Condominio Bosques del Sur 4 presenta el balance de ingresos y egresos del año '+d.a+', elaborado con los registros del sistema al '+hoy+'.',{size:10.5,lh:15.5,despues:10});
 pdfFranja(c,[['Ingresos del año',fmt(d.ing),PDF_COL.verde],['Egresos del año',fmt(d.egr),PDF_COL.rojo],['Resultado del año',fmt(d.saldo),d.saldo>=0?PDF_COL.marca:PDF_COL.rojo],['Saldo acumulado',fmt(d.saldoAcum),PDF_COL.marca]]);
 pdfSeccion(c,'1. Movimiento mes a mes');
 pdfTabla(c,[{t:'Mes',w:W-100*3-90},{t:'Ingresos',w:100,align:'right'},{t:'Egresos',w:100,align:'right'},{t:'Saldo',w:100,align:'right'},{t:'Al día',w:90,align:'right'}],
  d.meses.map(x=>[MESES[x.m],fmt(x.ing),fmt(x.egr),fmt(x.saldo),x.pg+' de '+d.total]));
 rendFilaTotal(c,'TOTAL '+d.a,fmt(d.saldo),d.saldo>=0?PDF_COL.marca:PDF_COL.rojo);
 pdfSeccion(c,'2. Egresos por categoría');
 const cats=Object.keys(d.cats).sort((x,y)=>d.cats[y]-d.cats[x]);
 if(cats.length)pdfTabla(c,[{t:'Categoría',w:W-130-90},{t:'Monto',w:130,align:'right'},{t:'% del total',w:90,align:'right'}],cats.map(k=>[k,fmt(d.cats[k]),d.egr?Math.round(d.cats[k]/d.egr*100)+'%':'—']));
 else pdfParrafo(c,'No hay egresos registrados en el período.',{size:10,justify:false});
 pdfSeccion(c,'3. Deuda acumulada al cierre');
 const deuda=d.mor.reduce((s,x)=>s+x.gc,0),multas=d.mor.reduce((s,x)=>s+x.tm,0);
 pdfFranja(c,[['Deptos con deuda',String(d.mor.length),d.mor.length?PDF_COL.rojo:PDF_COL.verde],['Gastos comunes adeudados',fmt(deuda),deuda?PDF_COL.rojo:PDF_COL.verde],['Multas pendientes',fmt(multas),PDF_COL.marca]]);
 if(estadoRend().det)rendTablaMorosidad(c,d.mor);
 pdfFirmas(c,PDF_ROLES);
 c.y+=8;pdfParrafo(c,'Informe elaborado con los registros del sistema al '+hoy+'. No reemplaza los documentos contables que exija la ley o el reglamento de copropiedad.',{size:8,color:PDF_COL.gris,despues:0});
 pdfCerrar(c,'Balance Anual');
 return await pdfBytes(c);
}
let rendPdfActual=null;
async function rendGenerarPDF(){
 const e=estadoRend();
 try{
  const d=e.tipo==='mensual'?rendDatosMensual(e.anio,e.mes):rendDatosAnual(e.anio);
  const bytes=e.tipo==='mensual'?await pdfRendicionMensual(d):await pdfRendicionAnual(d);
  if(rendPdfActual&&rendPdfActual.url)URL.revokeObjectURL(rendPdfActual.url);
  const nombre=e.tipo==='mensual'?'Rendicion de cuentas_'+MESES[d.m]+' '+d.a+'.pdf':'Balance anual_'+d.a+'.pdf';
  const ing=e.tipo==='mensual'?d.cur.ing:d.ing,egr=e.tipo==='mensual'?d.cur.egr:d.egr;
  rendPdfActual={bytes,nombre,url:pdfUrl(bytes),texto:'CONDOMINIO BOSQUES DEL SUR 4\n'+(e.tipo==='mensual'?'Rendición de cuentas '+MESES[d.m]+' '+d.a:'Balance anual '+d.a)+'\nIngresos: '+fmt(ing)+' · Egresos: '+fmt(egr)+' · Saldo: '+fmt(ing-egr)};
  const vista=window.innerWidth>=820?`<iframe src="${rendPdfActual.url}#view=FitH&toolbar=0" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:10px;background:#fff" title="Vista previa"></iframe>`
   :'<div style="padding:18px;text-align:center;font-size:13px;color:var(--text2);border:1px dashed var(--border);border-radius:10px">PDF generado. Usa los botones para descargarlo o abrirlo.</div>';
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:760px">
   <div class="modal-title">📑 ${esc(d.folio)} — ${e.tipo==='mensual'?esc(MESES[d.m])+' '+d.a:'Año '+d.a}</div><div style="margin-bottom:14px">${vista}</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="pdfDescargar(rendPdfActual.bytes,rendPdfActual.nombre)">⬇ Descargar PDF</button><button class="btn btn-ghost" onclick="window.open(rendPdfActual.url,'_blank')">↗ Abrir en pestaña nueva</button><button class="btn btn-success" onclick="rendCompartir()">📤 Compartir</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
 }catch(err){console.error(err);showToast('No se pudo generar el PDF: '+err.message,'error');}
}
async function rendCompartir(){
 if(!rendPdfActual)return;
 try{
  const f=new File([rendPdfActual.bytes],rendPdfActual.nombre,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:rendPdfActual.nombre,text:rendPdfActual.texto});return;}
 }catch(e){if(e&&e.name==='AbortError')return;}
 pdfDescargar(rendPdfActual.bytes,rendPdfActual.nombre);showToast('Este dispositivo no permite compartir archivos: PDF descargado, adjúntalo en WhatsApp','success');
 window.open('https://wa.me/?text='+encodeURIComponent(rendPdfActual.texto),'_blank');
}
