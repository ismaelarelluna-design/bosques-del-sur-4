/* ===========================================================================
   Certificados de gastos comunes — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   Datos (Firebase):
     cbs4/certificados/<id>  {id,folio,anio,n,depId,depNumero,representante,fecha,ts,
                              situacion:'aldia'|'deuda',total,detalle:[{t,v}],meses12:[{k,ok}],
                              desde,corte,obs,emitidoPor,rol,anulado?:{ts,por,motivo}}
     cbs4/certContador/<anio> (numero correlativo, se incrementa con transaccion)

   Reglas de diseno:
   - La situacion se calcula con calcularMorosidad('todo') (misma logica que Morosidad).
   - El detalle queda CONGELADO en el registro: reimprimir muestra lo emitido ese dia.
   - La fecha es siempre la de emision (no se puede retrotraer).
   - El JPG es editable por cualquiera; el control real es el folio en este registro.
   =========================================================================== */
function certificados(){return (appData.certificados||[]).slice();}
function certTipo(c){return c&&c.tipo==='morosidad'?'morosidad':'venta';}
function estadoCert(){if(!state.cert)state.cert={tab:'deptos',q:'',sit:'',hoja:1,fq:'',fsit:'',festado:'',ftipo:''};return state.cert;}
function certHoyISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function certFechaLarga(iso){const p=String(iso||'').split('-');if(p.length<3)return iso||'';return parseInt(p[2])+' de '+MESES[parseInt(p[1])-1].toLowerCase()+' de '+p[0];}

/* Situacion actual de todos los deptos (una sola pasada) */
/* Ventana de periodos: la MISMA que usa la pestaña Morosidad, para que ambas cifras coincidan. */
function certVentana(){return state.ventanaMorosidad||'12';}
function certVentanaLabel(){const t=certVentana();return t==='12'?'Últimos 12 meses':(t==='anio'?'Año en curso':'Todo el historial');}
function certSituaciones(){
 const v=certVentana();const mor=calcularMorosidad(v);const mapa=new Map();
 mor.forEach(m=>mapa.set(m.dep.id,m));
 const keys=clavesVentana(v);
 return (appData.departamentos||[]).map(dep=>{
  const m=mapa.get(dep.id);
  return {dep,deuda:!!m,total:m?m.total:0,m,nGC:m?m.gcMeses.length:0,nMul:m?m.multas.length:0,keys};
 }).sort((a,b)=>String(a.dep.numero).localeCompare(String(b.dep.numero),undefined,{numeric:true}));
}
function certDetalleDe(m){
 if(!m)return [];
 const rows=[];
 m.gcMeses.forEach(g=>rows.push({t:'Gasto común '+g.label,v:g.monto}));
 m.multas.forEach(x=>rows.push({t:'Multa '+(x.fecha_creacion||'')+(x.regla?' · '+x.regla:''),v:x.monto}));
 return rows;
}
function certUltimos12(dep){
 const keys=clavesVentana('12');
 return keys.map(k=>({k,ok:estaPagado(((appData.pagos||{})[k]||{})[dep.id])}));
}
function certUltimoPeriodo(){const k=clavesVentana('todo');return k.length?k[k.length-1]:null;}

/* ---------- vista ---------- */
function vCertificados(){
 const e=estadoCert();
 const sit=certSituaciones();
 const vigentes=certificados().filter(c=>!c.anulado);
 const aldia=sit.filter(s=>!s.deuda).length,conDeuda=sit.length-aldia;
 const tabs=`<div class="seg">
  <button class="seg-btn ${e.tab==='deptos'?'on':''}" onclick="setCert({tab:'deptos'})">🏠 Departamentos</button>
  <button class="seg-btn ${e.tab==='hist'?'on':''}" onclick="setCert({tab:'hist'})">📜 Emitidos (${vigentes.length})</button></div>`;
 return `<div class="page-title">Certificados de gastos comunes</div>
 <div class="page-sub">Certificados en PDF con logo y folio: gastos comunes (venta y trámites) y morosidad con fundamentos legales</div>
 <div class="stats-grid mant-stats">
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">✅</span>Al día</div><div class="stat-value" data-plain style="color:var(--green)">${aldia}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">⚠️</span>Con deuda</div><div class="stat-value" data-plain style="color:var(--danger)">${conDeuda}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">📜</span>Emitidos</div><div class="stat-value" data-plain>${vigentes.length}</div></div>
 </div>
 <div class="toolbar">${tabs}<div style="margin-left:auto;display:flex;align-items:center;gap:8px"><span style="font-size:12px;color:var(--text3)">Período a certificar</span><select class="fi" style="width:auto" onchange="state.ventanaMorosidad=this.value;renderView()"><option value="12" ${certVentana()==='12'?'selected':''}>Últimos 12 meses</option><option value="anio" ${certVentana()==='anio'?'selected':''}>Año en curso</option><option value="todo" ${certVentana()==='todo'?'selected':''}>Todo el historial</option></select></div></div>
 ${e.tab==='deptos'?htmlCertDeptos(sit):htmlCertHist()}
 <div style="font-size:11px;color:var(--text3);margin-top:12px;">La situación considera «${esc(certVentanaLabel())}» (${esc((()=>{const k=clavesVentana(certVentana());return k.length?formatPeriodo(k[0])+' a '+formatPeriodo(k[k.length-1]):'—';})())}), el mismo período de la pestaña Morosidad, y respeta el plazo de pago del mes en curso. Para venta se recomienda «Todo el historial»: la deuda anterior sigue a la unidad. El certificado lo emite el comité con sus propios registros; para trámites que exijan un documento con validez legal específica, consulta los requisitos del caso.</div>`;
}
function setCert(p){Object.assign(estadoCert(),p);if(p.q!==undefined||p.sit!==undefined||p.fq!==undefined||p.fsit!==undefined||p.festado!==undefined||p.ftipo!==undefined)estadoCert().hoja=1;renderView();}
function buscarCert(v){const e=estadoCert();e.q=v;const el=document.getElementById('cert-grid');if(el)el.innerHTML=htmlCertTarjetas(certSituaciones());}
function buscarCertHist(v){const e=estadoCert();e.fq=v;e.hoja=1;const el=document.getElementById('cert-hist');if(el)el.innerHTML=htmlCertTabla();}
function hojaCert(n){estadoCert().hoja=n;const el=document.getElementById('cert-hist');if(el)el.innerHTML=htmlCertTabla();}

function htmlCertDeptos(sit){
 const e=estadoCert();
 return `<div class="toolbar">
  <div class="buscador"><span class="buscador-ico">🔎</span><input class="fi buscador-input" placeholder="Buscar depto o nombre…" value="${esc(e.q)}" oninput="buscarCert(this.value)"/></div>
  <select class="fi" style="width:auto" onchange="setCert({sit:this.value})"><option value="">Todos</option><option value="aldia" ${e.sit==='aldia'?'selected':''}>Al día</option><option value="deuda" ${e.sit==='deuda'?'selected':''}>Con deuda</option></select>
 </div><div class="comp-grid" id="cert-grid">${htmlCertTarjetas(sit)}</div>`;
}
function htmlCertTarjetas(sit){
 const e=estadoCert();const q=(e.q||'').toLowerCase().trim();
 const l=sit.filter(s=>(!e.sit||(e.sit==='deuda')===s.deuda)&&(!q||(String(s.dep.numero)+' '+(s.dep.representante||'')).toLowerCase().includes(q)));
 if(!l.length)return '<div class="card" style="grid-column:1/-1"><div class="empty-state"><div class="empty-ico">🔎</div><div class="empty-txt">Sin resultados</div></div></div>';
 return l.map(s=>{
  const n=certificados().filter(c=>String(c.depId)===String(s.dep.id)&&!c.anulado).length;
  const det=s.deuda?`${s.nGC?s.nGC+' mes'+(s.nGC>1?'es':'')+' de gasto común':''}${s.nGC&&s.nMul?' + ':''}${s.nMul?s.nMul+' multa'+(s.nMul>1?'s':''):''}`:'Sin deuda exigible';
  return `<div class="comp-card cert-card ${s.deuda?'deuda':'aldia'}">
   <div class="comp-card-top"><div class="cert-num">${esc(s.dep.numero)}</div>
    <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--text)">Depto ${esc(s.dep.numero)}</div>
     <div style="font-size:12px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.dep.representante||'Sin representante')}</div></div>
    <span class="cert-chip ${s.deuda?'deuda':'aldia'}">${s.deuda?'Con deuda':'Al día'}</span></div>
   <div class="cert-det"><span>${esc(det)}</span>${s.deuda?`<strong>${fmt(s.total)}</strong>`:''}</div>
   <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap">
    <button class="btn btn-primary btn-sm" onclick="openEmitirCert('${esc(s.dep.id)}','venta')">📜 Certificado para venta</button>
    ${s.deuda?`<button class="btn btn-danger btn-sm" onclick="openEmitirCert('${esc(s.dep.id)}','morosidad')">⚠️ Certificado de morosidad</button>`:''}
    ${n?`<span style="font-size:11px;color:var(--text3)">${n} emitido${n>1?'s':''}</span>`:''}</div></div>`;}).join('');
}

/* ---------- historial ---------- */
function certFiltrados(){
 const e=estadoCert();const q=(e.fq||'').toLowerCase().trim();
 return certificados().sort((a,b)=>(b.ts||0)-(a.ts||0)).filter(c=>
  (!e.ftipo||certTipo(c)===e.ftipo)&&(!e.fsit||c.situacion===e.fsit)&&(!e.festado||(e.festado==='anulado')===!!c.anulado)&&
  (!q||(c.folio+' '+c.depNumero+' '+(c.representante||'')).toLowerCase().includes(q)));
}
function htmlCertHist(){
 const e=estadoCert();
 return `<div class="toolbar">
  <div class="buscador"><span class="buscador-ico">🔎</span><input class="fi buscador-input" placeholder="Buscar folio, depto o nombre…" value="${esc(e.fq)}" oninput="buscarCertHist(this.value)"/></div>
  <select class="fi" style="width:auto" onchange="setCert({ftipo:this.value})"><option value="">Todos los tipos</option><option value="venta" ${e.ftipo==='venta'?'selected':''}>Para venta</option><option value="morosidad" ${e.ftipo==='morosidad'?'selected':''}>Morosidad</option></select>
  <select class="fi" style="width:auto" onchange="setCert({fsit:this.value})"><option value="">Toda situación</option><option value="aldia" ${e.fsit==='aldia'?'selected':''}>Al día</option><option value="deuda" ${e.fsit==='deuda'?'selected':''}>Con deuda</option></select>
  <select class="fi" style="width:auto" onchange="setCert({festado:this.value})"><option value="">Vigentes y anulados</option><option value="vigente" ${e.festado==='vigente'?'selected':''}>Solo vigentes</option><option value="anulado" ${e.festado==='anulado'?'selected':''}>Solo anulados</option></select>
 </div><div class="card" id="cert-hist">${htmlCertTabla()}</div>`;
}
function htmlCertTabla(){
 const e=estadoCert();const l=certFiltrados();const POR=15;
 const pags=Math.max(1,Math.ceil(l.length/POR));if(e.hoja>pags)e.hoja=pags;
 if(!l.length)return '<div class="empty-state"><div class="empty-ico">📜</div><div class="empty-txt">Aún no hay certificados emitidos</div></div>';
 const filas=l.slice((e.hoja-1)*POR,e.hoja*POR).map(c=>`<tr class="${c.anulado?'cert-anulado':''}">
  <td><strong>${esc(c.folio)}</strong><div><span class="cert-chip tipo-${certTipo(c)}">${certTipo(c)==='morosidad'?'Morosidad':'Venta'}</span></div></td><td>Depto ${esc(c.depNumero)}<div style="font-size:11px;color:var(--text3)">${esc(c.representante||'')}</div></td>
  <td>${esc(certFechaLarga(c.fecha))}</td>
  <td>${c.anulado?'<span class="cert-chip anulado">Anulado</span>':`<span class="cert-chip ${c.situacion==='aldia'?'aldia':'deuda'}">${c.situacion==='aldia'?'Al día':'Con deuda'}</span>`}${c.situacion==='deuda'?`<div style="font-size:11px;color:var(--text3)">${fmt(c.total)}</div>`:''}</td>
  <td style="font-size:12px;color:var(--text2)">${esc(c.emitidoPor||'')}${c.anulado?`<div style="color:var(--danger)">Anulado: ${esc(c.anulado.motivo||'')}</div>`:''}</td>
  <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="verCertificado('${esc(c.id)}')">Ver</button>${c.anulado?'':` <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="openAnularCert('${esc(c.id)}')">Anular</button>`}</td></tr>`).join('');
 let pag='';
 if(pags>1){const nums=[];for(let i=1;i<=pags;i++){if(i===1||i===pags||Math.abs(i-e.hoja)<=1)nums.push(i);else if(nums[nums.length-1]!=='…')nums.push('…');}
  pag=`<div class="pg-wrap"><button class="pg-btn" ${e.hoja<=1?'disabled':''} onclick="hojaCert(${e.hoja-1})">← Anterior</button>${nums.map(n=>n==='…'?'<span class="pg-sep">…</span>':`<button class="pg-btn ${n===e.hoja?'activa':''}" onclick="hojaCert(${n})">${n}</button>`).join('')}<button class="pg-btn" ${e.hoja>=pags?'disabled':''} onclick="hojaCert(${e.hoja+1})">Siguiente →</button><span class="pg-info">Hoja ${e.hoja} de ${pags}</span></div>`;}
 return `<div class="table-wrap"><table><thead><tr><th>Folio</th><th>Unidad</th><th>Fecha</th><th>Situación</th><th>Emitido por</th><th></th></tr></thead><tbody>${filas}</tbody></table></div>${pag}`;
}

/* ---------- emitir ---------- */
function certDepto(id){return (appData.departamentos||[]).find(d=>String(d.id)===String(id))||null;}
function openEmitirCert(depId,tipo){
 tipo=tipo==='morosidad'?'morosidad':'venta';
 const s=certSituaciones().find(x=>String(x.dep.id)===String(depId));if(!s)return;
 if(tipo==='morosidad'&&!s.deuda){showToast('El depto no registra deuda: no corresponde certificado de morosidad','error');return;}
 const det=certDetalleDe(s.m),mor=tipo==='morosidad';
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:520px;">
 <div class="modal-title">${mor?'⚠️ Certificado de morosidad':'📜 Certificado para venta'} — Depto ${esc(s.dep.numero)}</div>
 <div class="cert-resumen ${s.deuda?'deuda':'aldia'}"><div><strong>${esc(s.dep.representante||'Sin representante')}</strong></div>
  <span class="cert-chip ${s.deuda?'deuda':'aldia'}">${s.deuda?'Con deuda · '+fmt(s.total):'Al día'}</span></div>
 ${s.deuda?`<div style="font-size:12px;color:var(--text2);margin:10px 0;max-height:130px;overflow:auto">${det.map(r=>`• ${esc(r.t)} — ${fmt(r.v)}`).join('<br>')}</div>`:'<div style="font-size:12px;color:var(--text2);margin:10px 0">No registra gastos comunes ni multas pendientes.</div>'}
 <div style="font-size:12px;color:var(--text2);margin:6px 0 10px">Período certificado: <strong>${esc(certVentanaLabel())}</strong>${s.keys.length?' ('+esc(formatPeriodo(s.keys[0]))+' a '+esc(formatPeriodo(s.keys[s.keys.length-1]))+')':''}${!mor&&certVentana()!=='todo'?'<div style="color:var(--danger);margin-top:4px">Ojo: para venta conviene «Todo el historial» (cámbialo arriba antes de emitir), pues la deuda anterior sigue a la unidad.</div>':''}</div>
 <div class="form-row">${mor?`<div style="max-width:170px"><label class="fl">Plazo para regularizar (días)</label><input class="fi" id="ce-plazo" type="number" min="1" max="90" value="10"/></div>`:''}
  <div><label class="fl">Observación (opcional, aparece en el documento)</label><input class="fi" id="ce-obs" maxlength="140" placeholder="${mor?'Ej: Segundo aviso':'Ej: Se emite para trámite de venta'}"/></div></div>
 <div style="font-size:11px;color:var(--text3)">Se asignará un folio correlativo ${mor?'(CMD)':'(CGC)'} y el documento quedará registrado. La fecha es la de hoy.${mor?' Es informativo y no reemplaza al aviso de cobro firmado por el administrador.':''}</div>
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-success" id="ce-btn" onclick="emitirCert('${esc(s.dep.id)}','${tipo}')">Emitir PDF</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
async function emitirCert(depId,tipo){
 tipo=tipo==='morosidad'?'morosidad':'venta';
 const btn=document.getElementById('ce-btn');if(btn){btn.disabled=true;btn.textContent='Emitiendo…';}
 try{
  const s=certSituaciones().find(x=>String(x.dep.id)===String(depId));if(!s)throw new Error('Depto no encontrado');
  if(tipo==='morosidad'&&!s.deuda)throw new Error('El depto no registra deuda');
  const obs=(document.getElementById('ce-obs')||{value:''}).value.trim().slice(0,140);
  const plazoDias=tipo==='morosidad'?Math.min(90,Math.max(1,parseInt((document.getElementById('ce-plazo')||{}).value)||10)):0;
  const ruta=tipo==='morosidad'?'cbs4/certContadorMor/':'cbs4/certContador/',pref=tipo==='morosidad'?'CMD-':'CGC-';
  const hoy=certHoyISO(),anio=parseInt(hoy.slice(0,4));
  const maxN=certificados().filter(c=>c.anio===anio&&certTipo(c)===tipo).reduce((m,c)=>Math.max(m,parseInt(c.n)||0),0);
  const tr=await db.ref(ruta+anio).transaction(v=>Math.max(parseInt(v)||0,maxN)+1);
  if(!tr.committed)throw new Error('No se pudo asignar folio');
  const n=tr.snapshot.val();
  const u=checkSession()||'';const adm=(ADMINS.find(a=>a.u===u)||{});
  const keys=s.keys;
  const id=db.ref('cbs4/certificados').push().key;
  const rec={id,tipo,plazoDias,ventana:certVentana(),folio:pref+anio+'-'+String(n).padStart(3,'0'),anio,n,depId:s.dep.id,depNumero:s.dep.numero,representante:String(s.dep.representante||'').trim(),
   fecha:hoy,ts:Date.now(),situacion:s.deuda?'deuda':'aldia',total:s.total,detalle:certDetalleDe(s.m),meses12:certUltimos12(s.dep),
   desde:keys.length?keys[0]:'',corte:keys.length?keys[keys.length-1]:'',obs,emitidoPor:u,rol:adm.rol||''};
  appData.certificados=certificados().concat([rec]);
  await savePath('certificados/'+id,rec);
  closeModal();
  showToast('Certificado '+rec.folio+' emitido','success');
  await verCertificado(id);
 }catch(err){console.error(err);showToast('No se pudo emitir: '+err.message,'error');closeModal();}
}

/* ---------- anular ---------- */
function openAnularCert(id){
 const c=certificados().find(x=>x.id===id);if(!c)return;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:460px;">
 <div class="modal-title">Anular ${esc(c.folio)}</div>
 <div style="font-size:13px;color:var(--text2);margin-bottom:10px">El folio no se reutiliza ni se borra: queda marcado como anulado en el registro.</div>
 <div class="form-row"><div><label class="fl">Motivo (obligatorio)</label><input class="fi" id="ca-m" maxlength="120" placeholder="Ej: Emitido con datos erróneos"/></div></div>
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-danger" onclick="confirmarAnularCert('${esc(id)}')">Anular certificado</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
function confirmarAnularCert(id){
 const c=certificados().find(x=>x.id===id);if(!c)return;
 const motivo=(document.getElementById('ca-m').value||'').trim();
 if(motivo.length<3){showToast('Indica el motivo','error');return;}
 const rec={...c,anulado:{ts:Date.now(),por:checkSession()||'',motivo:motivo.slice(0,120)}};
 appData.certificados=certificados().map(x=>x.id===id?rec:x);
 savePath('certificados/'+id,rec);
 closeModal();renderView();showToast('Certificado anulado','success');
}

/* ---------- dibujo ---------- */
function certLineas(ctx,texto,maxW){
 const pal=String(texto).split(/\s+/),out=[];let l='';
 pal.forEach(p=>{const t=l?l+' '+p:p;if(ctx.measureText(t).width>maxW&&l){out.push(l);l=p;}else l=t;});
 if(l)out.push(l);return out;
}
function certTextoWA(c){
 const dep=certDepto(c.depId)||{};
 if(certTipo(c)==='morosidad')return `Hola ${c.representante||''} 👋\nCONDOMINIO BOSQUES DEL SUR 4\nLe enviamos el Certificado de Morosidad N° ${c.folio} de la unidad ${c.depNumero}, emitido el ${certFechaLarga(c.fecha)}.\nTotal adeudado: ${fmt(c.total)}. Plazo para regularizar: ${c.plazoDias||10} días.`;
 return `Hola ${c.representante||''} 👋\nCONDOMINIO BOSQUES DEL SUR 4\nLe enviamos el Certificado de Gastos Comunes N° ${c.folio} de la unidad ${c.depNumero}, emitido el ${certFechaLarga(c.fecha)}.\nSituación: ${c.situacion==='aldia'?'AL DÍA ✅':'CON DEUDA ('+fmt(c.total)+')'}`;
}
async function dibujarCertificado(c){
 const logo=await cargarLogoVoucher();
 const W=900,M=60,cv=document.createElement('canvas');cv.width=W;cv.height=3200;const ctx=cv.getContext('2d');
 ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,3200);
 let y=dibujarEncabezado(ctx,W,logo,'Certificado de Gastos Comunes');
 const F='Inter, Arial';
 y+=48;
 ctx.textAlign='left';ctx.fillStyle='#155E75';ctx.font='bold 18px '+F;ctx.fillText('Folio N° '+c.folio,M,y);
 ctx.textAlign='right';ctx.fillStyle='#4B5563';ctx.font='14px '+F;ctx.fillText('Emitido el '+certFechaLarga(c.fecha),W-M,y);
 y+=16;ctx.strokeStyle='#E5E7EB';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();
 y+=38;ctx.textAlign='left';ctx.fillStyle='#111827';ctx.font='15px '+F;
 const per=c.desde&&c.corte?(formatPeriodo(c.desde)+' a '+formatPeriodo(c.corte)):'los períodos registrados';
 const txt='El Comité de Administración del Condominio Bosques del Sur 4 certifica que, de acuerdo con los registros de gastos comunes vigentes a la fecha de emisión, la unidad N° '+c.depNumero+(c.representante?', a nombre de '+c.representante+',':',')+' '+(c.situacion==='aldia'?'se encuentra AL DÍA en el pago de los gastos comunes y multas exigibles':'registra DEUDA por gastos comunes y/o multas exigibles')+', considerando el período de '+per+'.';
 certLineas(ctx,txt,W-M*2).forEach(l=>{ctx.fillText(l,M,y);y+=25;});
 y+=14;
 const aldia=c.situacion==='aldia';
 ctx.fillStyle=aldia?'#10b981':'#DC2626';roundRect(ctx,W/2-150,y,300,60,30);ctx.fill();
 ctx.fillStyle='#FFFFFF';ctx.textAlign='center';ctx.font='bold 26px '+F;ctx.fillText(aldia?'✓ AL DÍA':'✗ CON DEUDA',W/2,y+40);
 y+=60+34;
 /* datos de la unidad */
 ctx.fillStyle='#F3F4F6';roundRect(ctx,M,y,W-M*2,100,12);ctx.fill();
 const fila=(k,v,yy)=>{ctx.textAlign='left';ctx.fillStyle='#6B7280';ctx.font='13px '+F;ctx.fillText(k,M+22,yy);ctx.fillStyle='#111827';ctx.font='bold 14px '+F;ctx.fillText(String(v),M+190,yy);};
 fila('Unidad',c.depNumero,y+32);fila('Representante',c.representante||'—',y+58);fila('Período considerado',per,y+84);
 y+=100+34;
 if(!aldia){
  ctx.textAlign='left';ctx.fillStyle='#155E75';ctx.font='bold 15px '+F;ctx.fillText('Detalle de la deuda',M,y);y+=12;
  (c.detalle||[]).forEach((r,i)=>{y+=26;if(i%2===0){ctx.fillStyle='#F9FAFB';ctx.fillRect(M,y-18,W-M*2,26);}
   ctx.fillStyle='#374151';ctx.font='13px '+F;ctx.textAlign='left';ctx.fillText(r.t,M+10,y);ctx.textAlign='right';ctx.fillText(fmt(r.v),W-M-10,y);});
  y+=14;ctx.strokeStyle='#D1D5DB';ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();y+=28;
  ctx.fillStyle='#DC2626';ctx.font='bold 17px '+F;ctx.textAlign='left';ctx.fillText('TOTAL ADEUDADO',M+10,y);ctx.textAlign='right';ctx.fillText(fmt(c.total),W-M-10,y);y+=38;
 }else{
  ctx.textAlign='left';ctx.fillStyle='#374151';ctx.font='14px '+F;
  certLineas(ctx,'La unidad no registra gastos comunes ni multas pendientes de pago en el período considerado.',W-M*2).forEach(l=>{ctx.fillText(l,M,y);y+=22;});y+=14;
 }
 if(c.obs){ctx.fillStyle='#374151';ctx.font='italic 13px '+F;ctx.textAlign='left';certLineas(ctx,'Observación: '+c.obs,W-M*2).forEach(l=>{ctx.fillText(l,M,y);y+=20;});y+=12;}
 /* ultimos 12 periodos */
 if((c.meses12||[]).length){
  ctx.textAlign='left';ctx.fillStyle='#155E75';ctx.font='bold 15px '+F;ctx.fillText('Últimos 12 períodos',M,y);y+=14;
  const cw=(W-M*2)/12;
  c.meses12.forEach((m,i)=>{const x=M+i*cw;
   ctx.fillStyle=m.ok?'rgba(16,185,129,.14)':'rgba(220,38,38,.12)';roundRect(ctx,x+2,y,cw-4,58,8);ctx.fill();
   ctx.textAlign='center';ctx.fillStyle='#4B5563';ctx.font='11px '+F;
   const mm=parseInt(m.k.slice(5,7))-1;ctx.fillText(MESES[mm].slice(0,3)+' '+m.k.slice(2,4),x+cw/2,y+18);
   ctx.fillStyle=m.ok?'#059669':'#DC2626';ctx.font='bold 20px '+F;ctx.fillText(m.ok?'✓':'✗',x+cw/2,y+44);});
  y+=58+40;
 }
 /* firmas */
 y+=34;const roles=['Presidenta','Tesorera','Administrador'];const sw=(W-M*2)/3;
 roles.forEach((r,i)=>{const cx=M+sw*i+sw/2;ctx.strokeStyle='#9CA3AF';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-sw/2+22,y);ctx.lineTo(cx+sw/2-22,y);ctx.stroke();
  ctx.textAlign='center';ctx.fillStyle='#374151';ctx.font='bold 13px '+F;ctx.fillText(r,cx,y+20);ctx.fillStyle='#9CA3AF';ctx.font='11px '+F;ctx.fillText('Comité de Administración',cx,y+36);});
 y+=74;
 ctx.textAlign='center';ctx.fillStyle='#6B7280';ctx.font='11px '+F;
 certLineas(ctx,'Documento emitido por el Comité de Administración del Condominio Bosques del Sur 4 con los registros disponibles a la fecha de emisión. Su autenticidad puede verificarse con el Comité indicando el folio '+c.folio+'.',W-M*2).forEach(l=>{ctx.fillText(l,W/2,y);y+=16;});
 y+=22;
 const H=y+8;
 ctx.fillStyle=gradienteBanner(ctx,W,8);ctx.fillRect(0,y,W,8);
 if(c.anulado){ctx.save();ctx.translate(W/2,H/2);ctx.rotate(-Math.PI/7);ctx.fillStyle='rgba(220,38,38,.22)';ctx.font='bold 150px '+F;ctx.textAlign='center';ctx.fillText('ANULADO',0,50);ctx.restore();}
 const out=document.createElement('canvas');out.width=W;out.height=H;out.getContext('2d').drawImage(cv,0,0,W,H,0,0,W,H);
 return out.toDataURL('image/jpeg',0.93);
}
function certNombreArchivo(c,ext){return (certTipo(c)==='morosidad'?'Certificado morosidad_':'Certificado ventas_')+String(c.depNumero).replace(/[\\/:*?"<>|]/g,'-')+'.'+ext;}
let certPdfActual=null;
async function verCertificado(id){
 const c=certificados().find(x=>x.id===id);if(!c)return;
 let bytes;
 try{bytes=certTipo(c)==='morosidad'?await pdfCertMorosidad(c):await pdfCertVenta(c);}
 catch(e){console.error(e);showToast('No se pudo generar el PDF: '+e.message,'error');if(certTipo(c)==='venta')return verCertificadoImagen(id);return;}
 if(certPdfActual&&certPdfActual.url)URL.revokeObjectURL(certPdfActual.url);
 certPdfActual={bytes,nombre:certNombreArchivo(c,'pdf'),url:pdfUrl(bytes),id};
 const vista=window.innerWidth>=820?`<iframe src="${certPdfActual.url}#view=FitH&toolbar=0" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:10px;background:#fff" title="Vista previa"></iframe>`
  :'<div style="padding:18px;text-align:center;font-size:13px;color:var(--text2);border:1px dashed var(--border);border-radius:10px">PDF generado. Usa los botones para descargarlo o abrirlo.</div>';
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:760px;"><div class="modal-title">${certTipo(c)==='morosidad'?'⚠️':'📜'} ${esc(c.folio)} — Depto ${esc(c.depNumero)}${c.anulado?' · ANULADO':''}</div>
 <div style="margin-bottom:14px;">${vista}</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="certDescargarPDF()">⬇ Descargar PDF</button><button class="btn btn-ghost" onclick="certAbrirPDF()">↗ Abrir en pestaña nueva</button><button class="btn btn-success" onclick="certCompartirPDF('${esc(id)}')">📤 Compartir</button>${certTipo(c)==='venta'?`<button class="btn btn-ghost" onclick="verCertificadoImagen('${esc(id)}')">🖼 Versión imagen (JPG)</button>`:''}<button class="btn btn-ghost" onclick="closeModal();renderView()">Cerrar</button></div></div></div>`;
}
function certDescargarPDF(){if(certPdfActual)pdfDescargar(certPdfActual.bytes,certPdfActual.nombre);}
function certAbrirPDF(){if(certPdfActual)window.open(certPdfActual.url,'_blank');}
async function certCompartirPDF(id){
 const c=certificados().find(x=>x.id===id);if(!c||!certPdfActual)return;
 try{
  const f=new File([certPdfActual.bytes],certPdfActual.nombre,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:c.folio,text:certTextoWA(c)});return;}
 }catch(e){if(e&&e.name==='AbortError')return;}
 const dep=certDepto(c.depId)||{};const tel=String(dep.contacto||'').replace(/\D/g,'');
 certDescargarPDF();showToast('Este dispositivo no permite compartir archivos: PDF descargado, adjúntalo en WhatsApp','success');
 window.open('https://wa.me/'+tel+'?text='+encodeURIComponent(certTextoWA(c)),'_blank');
}
async function verCertificadoImagen(id){
 const c=certificados().find(x=>x.id===id);if(!c)return;
 let url;try{url=await dibujarCertificado(c);}catch(e){console.error(e);showToast('Error generando certificado','error');return;}
 const dep=certDepto(c.depId)||{numero:c.depNumero,contacto:'',representante:c.representante};
 lastVoucher={img:url,tipo:'certificado',depto:dep,texto:certTextoWA(c)};
 lastDownload={url:url,filename:certNombreArchivo(c,'jpg')};
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:640px;"><div class="modal-title">📜 ${esc(c.folio)} — Depto ${esc(c.depNumero)}</div>
 <div class="holo-wrap" style="margin-bottom:16px;"><img src="${url}" style="width:100%;border-radius:10px;border:1px solid var(--border);"/></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar JPG</button><button class="btn btn-success" onclick="compartirUltimoVoucher()">📤 Compartir por WhatsApp</button><button class="btn btn-ghost" onclick="verCertificado('${esc(id)}')">← Volver al PDF</button><button class="btn btn-ghost" onclick="closeModal();renderView()">Cerrar</button></div></div></div>`;
}
