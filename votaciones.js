/* ===========================================================================
   Votaciones por departamento — Condominio Bosques del Sur 4   (panel de la directiva)
   ---------------------------------------------------------------------------
   Datos:
     cbs4/votaciones/<id>   registro PRIVADO (solo directiva):
        {id,folio,anio,n,titulo,descripcion,fecha,cierreTs,opciones:[{id,t}],codigo,estado,publicar,
         ts,por,abiertoTs,cerradoTs,cerradoPor,resultado,votos,anulados,reaperturas}
        estado: 'borrador' | 'abierta' | 'cerrada'
        Al cerrar se CONGELA `resultado` y `votos` (copia nominal) dentro de cbs4: asi
        queda en los respaldos JSON, que no incluyen las ramas hermanas.
     cbs4_votacion/<codigo>   espejo PUBLICO, solo lectura por codigo exacto (la pantalla del voto):
        {t,d,f,c,e,op:{o1:'Si'},ord:['o1',...],deps:{d1:'01',...},fo, r:[{t,n,p}] (solo si cerrada), tot, vot}
     cbs4_votos_reg/<codigo>/d<idDepto>   {n:nombre ingresado,o:idOpcion,ts}
        Lo escribe el vecino SIN sesion, una sola vez (regla !data.exists()); lo lee solo la directiva.
        NO existe ningun nodo publico que diga quien ya voto (evita presion sobre los que faltan).
   Transparencia: solo votaciones CERRADAS con publicar!==false; titulo, fecha, participacion y % por opcion.
   Nunca se publican nombres, deptos ni la opcion de cada uno.
   Depende de: core.js, certificados_pdf.js (motor PDF), informes.js (rendPdfActual / rendCompartir).
   =========================================================================== */
const VOT_REG='cbs4_votos_reg',VOT_PUB='cbs4_votacion';
const VOT_ALFA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const VOT_RE=/^[A-Z2-9]{6}$/;
const VOT_MAX_OPC=8;
let _votCache={},_votSubs={},_votDetId=null,_votFiltro='todas',_votForm=null,_votTimer=null;

/* ---------------------------------------------------------------- utilidades */
function votLista(){return comoListaConId(appData.votaciones).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||(b.ts||0)-(a.ts||0));}
function votPorId(id){return votLista().find(v=>String(v.id)===String(id))||null;}
function votOpciones(v){return comoLista(v&&v.opciones).filter(o=>o&&o.id);}
function votEnlace(codigo){return location.origin+location.pathname.replace(/index\.html$/,'')+'?v='+encodeURIComponent(codigo);}
function votNuevoCodigo(){
 const usados=new Set(votLista().map(v=>v.codigo));let c;
 do{const b=new Uint8Array(6);crypto.getRandomValues(b);c=Array.from(b).map(x=>VOT_ALFA[x%32]).join('');}while(usados.has(c));
 return c;
}
function votPct(n){return (Number(n)||0).toFixed(1).replace('.',',')+' %';}
function votHoyISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function votFecha(iso){const p=String(iso||'').split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:'';}
function votFechaHora(ts){return ts?fechaHoraCL(ts):'';}
function votDeptoNum(key){const id=String(key).replace(/^d/,'');const d=(appData.departamentos||[]).find(x=>String(x.id)===id);return d?String(d.numero):id;}
function votDepto(key){const id=String(key).replace(/^d/,'');return (appData.departamentos||[]).find(x=>String(x.id)===id)||null;}
function votTotal(v){return (v&&v.estado==='cerrada'&&v.resultado&&v.resultado.total)?v.resultado.total:((appData.departamentos||[]).length||totalDeptos());}
function votCierreTs(fecha,hora){
 if(!fecha)return 0;const p=fecha.split('-').map(Number),h=(hora||'23:59').split(':').map(Number);
 return new Date(p[0],p[1]-1,p[2],h[0]||0,h[1]||0).getTime();
}
function votPlazoVencido(v){return !!(v.cierreTs&&Date.now()>v.cierreTs);}
function votEstadoInfo(v){
 if(v.estado==='cerrada')return {t:'Cerrada',cls:'chip-cat'};
 if(v.estado==='abierta')return votPlazoVencido(v)?{t:'Plazo vencido · falta cerrar',cls:'fp-ambar'}:{t:'Abierta',cls:'fp-ok'};
 return {t:'Borrador',cls:'chip-mudo'};
}
function votAbiertasCount(){try{return votLista().filter(v=>v.estado==='abierta').length;}catch(e){return 0;}}
function votMsgCierre(v){
 if(!v.cierreTs)return 'Sin fecha límite: la directiva la cierra manualmente';
 const d=new Date(v.cierreTs);
 return 'Cierra el '+String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()+' a las '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

/* ----------------------------------------------------------- votos y conteo */
function votVotos(v){
 if(v.estado==='cerrada'&&v.votos)return v.votos;
 const c=_votCache[v.codigo];return (c&&c.votos)||{};
}
function votVotosCargados(v){return v.estado==='cerrada'?!!v.votos||!!v.resultado:!!(_votCache[v.codigo]&&!_votCache[v.codigo].err);}
function votConteo(v){
 const votos=votVotos(v),ops=votOpciones(v),cont={};ops.forEach(o=>{cont[o.id]=0;});
 let vot=0;Object.values(votos||{}).forEach(x=>{if(x&&cont[x.o]!==undefined){cont[x.o]++;vot++;}});
 const total=votTotal(v);
 return {total,vot,pend:Math.max(0,total-vot),part:total?vot/total*100:0,
  ops:ops.map(o=>({id:o.id,t:o.t,n:cont[o.id],pct:vot?cont[o.id]/vot*100:0,pctTot:total?cont[o.id]/total*100:0}))};
}
/* Compara el nombre ingresado con el representante registrado del depto (solo ayuda de revisión). */
const VOT_STOP=['de','del','la','los','las','y','e'];
function votTokens(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(w=>w.length>1&&!VOT_STOP.includes(w));}
function votVerif(key,nombre){
 const d=votDepto(key),rep=d&&String(d.representante||'').trim();
 if(!rep)return {k:'sinrep',t:'— sin representante registrado',cls:'chip-mudo',c:'—'};
 const a=votTokens(rep),b=votTokens(nombre),hits=b.filter(w=>a.includes(w)).length;
 if(hits>=2||(a.length<=1&&hits>=1))return {k:'ok',t:'✓ Coincide',cls:'fp-ok',c:'OK'};
 if(hits>=1)return {k:'parcial',t:'◐ Coincide en parte',cls:'fp-ambar',c:'Rev.'};
 return {k:'no',t:'⚠ No coincide',cls:'fp-rojo',c:'Rev.'};
}

/* ------------------------------------------------- suscripción a los votos */
function votSuscribir(v){
 if(!v||!v.codigo||modoDatos!=='privado'||v.estado!=='abierta'||_votSubs[v.codigo])return;
 try{
  const ref=db.ref(VOT_REG+'/'+v.codigo);
  ref.on('value',snap=>{_votCache[v.codigo]={votos:snap.val()||{}};votRefrescarUI(v.codigo);},err=>{console.warn('votos:',err);_votCache[v.codigo]={err:true,votos:{}};votRefrescarUI(v.codigo);});
  _votSubs[v.codigo]=ref;
 }catch(e){console.warn('votos:',e);}
}
function votDesuscribir(codigo){try{if(_votSubs[codigo]){_votSubs[codigo].off();delete _votSubs[codigo];}}catch(e){}}
function votRefrescarUI(codigo){
 clearTimeout(_votTimer);
 _votTimer=setTimeout(()=>{
  if(state.currentView==='votaciones'){const el=document.getElementById('vot-lista');if(el)el.innerHTML=votHtmlLista();}
  const v=_votDetId&&votPorId(_votDetId);if(v&&v.codigo===codigo&&document.getElementById('vot-det'))votDetalleRender();
 },250);
}

/* ----------------------------------------------------------------- espejo público */
function votEspejo(v){
 const deps={};(appData.departamentos||[]).forEach(d=>{deps['d'+d.id]=String(d.numero);});
 const op={},ord=[];votOpciones(v).forEach(o=>{op[o.id]=String(o.t).slice(0,80);ord.push(o.id);});
 const e={t:String(v.titulo).slice(0,140),d:String(v.descripcion||'').slice(0,600),f:v.fecha||'',c:v.cierreTs||0,e:v.estado==='cerrada'?'cerrada':'abierta',op,ord,deps,fo:v.folio||''};
 if(v.estado==='cerrada'&&v.resultado){e.r=comoLista(v.resultado.opciones).map(o=>({t:String(o.t).slice(0,80),n:o.n,p:Number(o.pct)||0}));e.tot=v.resultado.total;e.vot=v.resultado.votaron;}
 return e;
}
/* borrador => sin espejo (el enlace no funciona). */
async function votPublicarEspejo(v){
 if(!v.codigo)return;
 await db.ref(VOT_PUB+'/'+v.codigo).set(v.estado==='borrador'?null:votEspejo(v));
}
/* ---------------------------------------------------------- Transparencia */
function votacionesPublicas(){
 return votLista().filter(v=>v.estado==='cerrada'&&v.resultado&&v.publicar!==false).map(v=>({
  id:String(v.id),folio:String(v.folio||'').slice(0,30),titulo:String(v.titulo).slice(0,140),fecha:String(v.fecha||''),
  tot:v.resultado.total,vot:v.resultado.votaron,ts:v.cerradoTs||0,
  op:comoLista(v.resultado.opciones).map(o=>({t:String(o.t).slice(0,80),n:o.n,p:Number(o.pct)||0}))}));
}
function htmlVotacionesPublicas(){
 const l=(appData&&appData.__publico)?comoListaConId(appData.votaciones).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))):votacionesPublicas();
 if(!l.length)return '';
 const todas=!!state.votPubTodas,vis=todas?l:l.slice(0,6);
 return `<div class="section-label">🗳️ Votaciones</div><div class="comp-grid acta-pubgrid">${vis.map(v=>{
  const op=comoLista(v.op),max=Math.max(0,...op.map(o=>o.n)),ganadoras=op.filter(o=>o.n===max&&max>0),d=String(v.fecha||'').split('-'),part=v.tot?v.vot/v.tot*100:0;
  return `<div class="comp-card acta-card pub"><div class="comp-card-top"><div class="acta-fecha"><b>${esc(d[2]||'')}</b><span>${esc(d[1]?MESES[parseInt(d[1])-1].slice(0,3):'')} ${esc((d[0]||'').slice(2))}</span></div>
   <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--text);line-height:1.25">${esc(v.titulo)}</div><div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(v.folio)} · Votación cerrada</div></div></div>
   <div class="vt-pubres">${op.map(o=>`<div class="vt-pr"><div class="vt-pr-h"><span>${esc(o.t)}${ganadoras.length===1&&ganadoras[0]===o?' <b class="vt-win">✓</b>':''}</span><b>${esc(votPct(o.p))}</b></div><div class="fp-pb"><i style="width:${Math.min(100,Number(o.p)||0).toFixed(1)}%"></i></div><div class="fp-mut">${o.n} voto${o.n===1?'':'s'}</div></div>`).join('')}</div>
   <div class="acta-meta"><span>👥 Participación: ${v.vot} de ${v.tot} departamentos (${esc(votPct(part))})</span></div></div>`;}).join('')}</div>
  ${l.length>6?`<div style="text-align:center;margin:4px 0 8px"><button class="btn btn-ghost btn-sm" onclick="state.votPubTodas=${!todas};renderView()">${todas?'Mostrar solo las últimas':'Ver todas las votaciones ('+l.length+')'}</button></div>`:''}`;
}

/* ======================================================================= lista */
function vVotaciones(){
 const l=votLista(),ab=l.filter(v=>v.estado==='abierta').length,ce=l.filter(v=>v.estado==='cerrada').length,bo=l.filter(v=>v.estado==='borrador').length;
 const tab=(k,t,n)=>`<button class="seg-btn ${_votFiltro===k?'on':''}" onclick="_votFiltro='${k}';renderView()">${t}<span class="seg-n">${n}</span></button>`;
 return `<div class="page-title">Votaciones</div>
 <div class="page-sub">Consultas y votaciones por departamento: un voto por depto, con enlace para compartir y resultado en Transparencia</div>
 <div class="stats-grid mant-stats">
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">🟢</span>Abiertas</div><div class="stat-value" data-plain style="color:var(--green)">${ab}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">🔒</span>Cerradas</div><div class="stat-value" data-plain>${ce}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">📝</span>Borradores</div><div class="stat-value" data-plain>${bo}</div></div></div>
 <div class="toolbar"><div class="seg">${tab('todas','Todas',l.length)}${tab('abierta','Abiertas',ab)}${tab('cerrada','Cerradas',ce)}${tab('borrador','Borradores',bo)}</div><div class="toolbar-sep"></div><button class="btn btn-success" onclick="votForm()">+ Nueva votación</button></div>
 <div id="vot-lista">${votHtmlLista()}</div>`;
}
function votHtmlLista(){
 const todas=votLista(),l=todas.filter(v=>_votFiltro==='todas'||v.estado===_votFiltro);
 todas.forEach(votSuscribir);
 if(!todas.length)return `<div class="card"><div class="empty-state"><div class="empty-ico">🗳️</div><div class="empty-txt">Aún no hay votaciones. Crea la primera: eliges las opciones, compartes un enlace y cada departamento vota una sola vez.</div><button class="btn btn-primary" onclick="votForm()">+ Nueva votación</button></div></div>`;
 if(!l.length)return '<div class="card"><div class="empty-state"><div class="empty-ico">🔎</div><div class="empty-txt">No hay votaciones en esta categoría</div></div></div>';
 return `<div class="comp-grid">${l.map(votTarjeta).join('')}</div>`;
}
function votTarjeta(v){
 const e=votEstadoInfo(v),c=votConteo(v),d=String(v.fecha||'').split('-'),cargado=votVotosCargados(v),err=_votCache[v.codigo]&&_votCache[v.codigo].err;
 const ganadora=v.estado==='cerrada'?c.ops.filter(o=>o.n===Math.max(...c.ops.map(x=>x.n))&&o.n>0):[];
 return `<div class="comp-card acta-card"><div class="comp-card-top"><div class="acta-fecha"><b>${esc(d[2]||'')}</b><span>${esc(d[1]?MESES[parseInt(d[1])-1].slice(0,3):'')} ${esc((d[0]||'').slice(2))}</span></div>
  <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--text);line-height:1.25">${esc(v.titulo)}</div><div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(v.folio||'')} · <span class="chip ${e.cls}">${esc(e.t)}</span></div></div></div>
  ${v.estado==='borrador'?`<div class="fp-mut" style="margin-top:10px">${votOpciones(v).map(o=>esc(o.t)).join(' · ')}</div>`
  :(err?'<div class="fp-aviso">No se pudieron leer los votos. ¿Ya pegaste las reglas nuevas de Firebase?</div>'
  :`<div class="vt-mini">${cargado?c.ops.map(o=>`<div class="vt-pr"><div class="vt-pr-h"><span>${esc(o.t)}${ganadora.length===1&&ganadora[0].id===o.id?' <b class="vt-win">✓</b>':''}</span><b>${o.n} · ${esc(votPct(o.pct))}</b></div><div class="fp-pb"><i style="width:${o.pct.toFixed(1)}%"></i></div></div>`).join(''):'<div class="fp-mut">Cargando votos…</div>'}</div>
  <div class="acta-meta"><span>👥 ${c.vot} de ${c.total} deptos (${esc(votPct(c.part))})</span>${v.estado==='abierta'?`<span>⏰ ${esc(votMsgCierre(v))}</span>`:''}</div>`)}
  <div class="acta-acc"><button class="btn btn-primary btn-sm" onclick="votDetalle('${esc(v.id)}')">📊 Resumen</button>${v.estado==='borrador'?`<button class="btn btn-success btn-sm" onclick="votAbrir('${esc(v.id)}')">▶ Abrir</button><button class="btn btn-ghost btn-sm" onclick="votForm('${esc(v.id)}')">✏️ Editar</button>`:`<button class="btn btn-ghost btn-sm" onclick="votCopiar('${esc(v.id)}')">🔗 Link</button>`}</div></div>`;
}

/* ============================================================= crear / editar */
function votForm(id){
 const v=id?votPorId(id):null;
 if(v&&v.estado==='cerrada'){showToast('Una votación cerrada no se edita. Reábrela con motivo si hay que corregir algo.','error');return;}
 const bloqueaOp=!!v&&v.estado==='abierta';
 _votForm={id:id||null,opts:v?votOpciones(v).map(o=>o.t):['Sí','No'],bloqueaOp};
 const cd=v&&v.cierreTs?new Date(v.cierreTs):null;
 const cf=cd?cd.getFullYear()+'-'+String(cd.getMonth()+1).padStart(2,'0')+'-'+String(cd.getDate()).padStart(2,'0'):'',ch=cd?String(cd.getHours()).padStart(2,'0')+':'+String(cd.getMinutes()).padStart(2,'0'):'20:00';
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px">
 <div class="modal-title">${v?'Editar votación':'Nueva votación'}</div>
 <div class="form-row"><div><label class="fl">Título de la votación *</label><input class="fi" id="vf-t" maxlength="140" value="${v?esc(v.titulo):''}" placeholder="Ej: ¿Aprueban cambiar la empresa de aseo?"/></div></div>
 <div class="form-row"><div><label class="fl">Detalle para los vecinos (opcional)</label><textarea class="fi" id="vf-d" rows="3" maxlength="600" placeholder="Contexto, montos, fechas…" style="resize:vertical">${v?esc(v.descripcion||''):''}</textarea></div></div>
 <div class="form-row form-row-2"><div><label class="fl">Fecha de la votación *</label><input class="fi" type="date" id="vf-f" value="${v?esc(v.fecha):votHoyISO()}"/></div>
  <div><label class="fl">Cierra (opcional)</label><div style="display:flex;gap:6px"><input class="fi" type="date" id="vf-cf" value="${cf}"/><input class="fi" type="time" id="vf-ch" value="${ch}" style="max-width:110px"/></div></div></div>
 <div class="fl" style="margin-top:4px">Opciones de voto * <span class="fp-mut" style="font-weight:500">(2 a ${VOT_MAX_OPC})</span></div>
 ${bloqueaOp?'<div class="fp-aviso">La votación ya está abierta: no se pueden cambiar las opciones.</div>':`<div style="display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px"><button class="btn btn-ghost btn-sm" onclick="votFPlantilla(['Sí','No'])">Sí / No</button><button class="btn btn-ghost btn-sm" onclick="votFPlantilla(['Sí','No','Abstención'])">Sí / No / Abstención</button></div>`}
 <div id="vf-ops">${votHtmlOpciones()}</div>
 <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer;margin-top:10px"><input type="checkbox" id="vf-pub" ${!v||v.publicar!==false?'checked':''} style="width:16px;height:16px"/>Publicar el resultado en Transparencia al cerrar</label>
 <div class="fp-mut" style="margin:8px 0 0;line-height:1.5">Cada departamento vota una sola vez. Como pediste, la directiva verá cada voto con el nombre ingresado.</div>
 <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-success" onclick="votGuardar(${v?`'${esc(v.id)}'`:'null'},${v&&v.estado==='abierta'?'false':'true'})">${v&&v.estado==='abierta'?'Guardar cambios':'Guardar y abrir'}</button>${!v||v.estado==='borrador'?`<button class="btn btn-outline" onclick="votGuardar(${v?`'${esc(v.id)}'`:'null'},false)">Guardar borrador</button>`:''}<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
function votHtmlOpciones(){
 const f=_votForm;
 return f.opts.map((t,i)=>`<div style="display:flex;gap:6px;margin-bottom:6px"><input class="fi vf-o" maxlength="80" value="${esc(t)}" placeholder="Opción ${i+1}" ${f.bloqueaOp?'disabled':''}/>${f.bloqueaOp||f.opts.length<=2?'':`<button class="btn btn-ghost btn-sm" onclick="votFQuitar(${i})" title="Quitar">✕</button>`}</div>`).join('')
  +(f.bloqueaOp||f.opts.length>=VOT_MAX_OPC?'':`<button class="btn btn-outline btn-sm" onclick="votFAgregar()">➕ Agregar otra opción</button>`);
}
function votFLeer(){if(_votForm&&!_votForm.bloqueaOp)_votForm.opts=[...document.querySelectorAll('.vf-o')].map(i=>i.value);}
function votFAgregar(){votFLeer();if(_votForm.opts.length<VOT_MAX_OPC)_votForm.opts.push('');document.getElementById('vf-ops').innerHTML=votHtmlOpciones();const l=document.querySelectorAll('.vf-o');if(l.length)l[l.length-1].focus();}
function votFQuitar(i){votFLeer();_votForm.opts.splice(i,1);document.getElementById('vf-ops').innerHTML=votHtmlOpciones();}
function votFPlantilla(a){_votForm.opts=a.slice();document.getElementById('vf-ops').innerHTML=votHtmlOpciones();}
async function votGuardar(id,abrir){
 votFLeer();
 const titulo=document.getElementById('vf-t').value.trim();
 if(titulo.length<3){showToast('Escribe el título de la votación','error');return;}
 const fecha=document.getElementById('vf-f').value;if(!fecha){showToast('Indica la fecha de la votación','error');return;}
 const cf=document.getElementById('vf-cf').value,cierreTs=votCierreTs(cf,document.getElementById('vf-ch').value);
 const prev=id?votPorId(id):null;
 let opciones;
 if(prev&&prev.estado==='abierta')opciones=votOpciones(prev);
 else{
  const txt=_votForm.opts.map(t=>t.trim()).filter(Boolean);
  if(txt.length<2){showToast('Define al menos 2 opciones','error');return;}
  if(new Set(txt.map(t=>t.toLowerCase())).size!==txt.length){showToast('Hay opciones repetidas','error');return;}
  opciones=txt.map((t,i)=>({id:'o'+(i+1),t}));
 }
 if(abrir&&cierreTs&&cierreTs<=Date.now()){showToast('La fecha de cierre ya pasó','error');return;}
 try{
  let rec;
  if(prev){rec={...prev};}
  else{
   const anio=parseInt(fecha.slice(0,4))||new Date().getFullYear();
   const maxN=votLista().filter(x=>x.anio===anio).reduce((m,x)=>Math.max(m,parseInt(x.n)||0),0);
   const tr=await db.ref('cbs4/votContador/'+anio).transaction(c=>Math.max(parseInt(c)||0,maxN)+1);
   if(!tr.committed)throw new Error('No se pudo asignar el folio');
   const n=tr.snapshot.val(),nid=db.ref('cbs4/votaciones').push().key;
   rec={id:nid,anio,n,folio:'VOT-'+anio+'-'+String(n).padStart(3,'0'),codigo:votNuevoCodigo(),estado:'borrador',ts:Date.now(),por:checkSession()||''};
  }
  Object.assign(rec,{titulo:titulo.slice(0,140),descripcion:document.getElementById('vf-d').value.trim().slice(0,600),fecha,cierreTs,opciones,publicar:document.getElementById('vf-pub').checked});
  if(abrir&&rec.estado==='borrador'){rec.estado='abierta';rec.abiertoTs=Date.now();}
  appData.votaciones=votLista().filter(x=>String(x.id)!==String(rec.id)).concat([rec]);
  await savePath('votaciones/'+rec.id,rec);
  if(rec.estado==='abierta'){try{await votPublicarEspejo(rec);}catch(e){console.warn(e);showToast('Se guardó, pero no se pudo publicar el enlace. ¿Pegaste las reglas nuevas de Firebase?','error');}}
  closeModal();renderView();
  if(rec.estado==='abierta'){showToast('Votación abierta ✓ Comparte el enlace','success');votDetalle(rec.id);}else showToast('Borrador guardado','success');
 }catch(e){console.warn(e);showToast('No se pudo guardar: '+e.message,'error');}
}
async function votAbrir(id){
 const v=votPorId(id);if(!v||v.estado!=='borrador')return;
 if(v.cierreTs&&v.cierreTs<=Date.now()){showToast('La fecha de cierre ya pasó: edita la votación','error');votForm(id);return;}
 const rec={...v,estado:'abierta',abiertoTs:Date.now()};
 appData.votaciones=votLista().map(x=>String(x.id)===String(id)?rec:x);
 await savePath('votaciones/'+id,rec);
 try{await votPublicarEspejo(rec);}catch(e){console.warn(e);showToast('Se abrió, pero no se pudo publicar el enlace. ¿Pegaste las reglas nuevas de Firebase?','error');}
 renderView();showToast('Votación abierta ✓','success');votDetalle(id);
}

/* ====================================================================== detalle */
function votDetalle(id){_votDetId=id;const v=votPorId(id);if(!v)return;votSuscribir(v);votDetalleRender();}
function votCerrarDetalle(){_votDetId=null;closeModal();}
function votDetalleRender(){
 const v=votPorId(_votDetId);if(!v){closeModal();return;}
 const e=votEstadoInfo(v),c=votConteo(v),votos=votVotos(v),keys=Object.keys(votos).filter(k=>votos[k]).sort((a,b)=>parseInt(String(votDeptoNum(a)).replace(/\D/g,''))-parseInt(String(votDeptoNum(b)).replace(/\D/g,''))||String(votDeptoNum(a)).localeCompare(String(votDeptoNum(b))));
 const pendientes=(appData.departamentos||[]).filter(d=>!votos['d'+d.id]);
 const an=v.anulados?Object.entries(v.anulados).filter(([k,x])=>x):[];
 const err=_votCache[v.codigo]&&_votCache[v.codigo].err&&v.estado!=='cerrada';
 const maxN=Math.max(0,...c.ops.map(o=>o.n)),gan=c.ops.filter(o=>o.n===maxN&&maxN>0);
 const prev=document.querySelector('#vot-det'),st=prev?prev.scrollTop:0;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)votCerrarDetalle()"><div class="modal acta-modal" id="vot-det">
 <div class="fp-head"><div style="flex:1;min-width:0"><div class="fp-nombre">${esc(v.titulo)}</div>
  <div class="fp-chips"><span class="chip chip-cat">${esc(v.folio||'')}</span><span class="chip ${e.cls}">${esc(e.t)}</span><span class="chip chip-mudo">📅 ${esc(votFecha(v.fecha))}</span>${v.publicar===false?'<span class="chip chip-mudo">No se publica</span>':''}</div>
  ${v.descripcion?`<div class="fp-com" style="margin-top:8px">${esc(v.descripcion)}</div>`:''}</div><button class="fp-x" onclick="votCerrarDetalle()" aria-label="Cerrar">✕</button></div>
 ${v.estado!=='borrador'?`<div class="vt-linkbox"><div class="fp-mut" style="margin-bottom:4px">Enlace para compartir ${v.estado==='abierta'?'· '+esc(votMsgCierre(v)):'(votación cerrada: quien lo abra verá el resultado)'}</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap"><input class="fi" readonly id="vot-link" value="${esc(votEnlace(v.codigo))}" onclick="this.select()" style="flex:1;min-width:200px"/><button class="btn btn-primary btn-sm" onclick="votCopiar('${esc(v.id)}')">📋 Copiar</button><button class="btn btn-success btn-sm" onclick="votWhatsApp('${esc(v.id)}')">💬 WhatsApp</button></div></div>`:'<div class="fp-aviso">Es un borrador: el enlace se activa al abrir la votación.</div>'}
 ${err?'<div class="fp-aviso">⚠️ No se pudieron leer los votos. Revisa que las reglas de Firebase estén actualizadas (database.rules.json).</div>':''}
 <div class="fp-kpis"><div class="fp-kpi"><div class="fp-kl">Participación</div><div class="fp-kv">${esc(votPct(c.part))}</div><div class="fp-ks">${c.vot} de ${c.total} departamentos</div></div>
  <div class="fp-kpi"><div class="fp-kl">Votos emitidos</div><div class="fp-kv">${c.vot}</div></div>
  <div class="fp-kpi"><div class="fp-kl">Faltan por votar</div><div class="fp-kv">${c.pend}</div></div>
  <div class="fp-kpi"><div class="fp-kl">${v.estado==='cerrada'?'Resultado':'Va ganando'}</div><div class="fp-kv" style="font-size:15px">${gan.length===1?esc(gan[0].t):(gan.length>1?'Empate':'—')}</div></div></div>
 <div class="fp-sec">Resultado por opción</div>
 ${c.ops.map(o=>`<div class="vt-pr" style="margin-bottom:10px"><div class="vt-pr-h"><span><b>${esc(o.t)}</b>${gan.length===1&&gan[0].id===o.id?' <b class="vt-win">✓</b>':''}</span><b>${o.n} voto${o.n===1?'':'s'} · ${esc(votPct(o.pct))} <span class="fp-mut">(${esc(votPct(o.pctTot))} del total de deptos)</span></b></div><div class="fp-pb vt-big"><i style="width:${o.pct.toFixed(1)}%"></i></div></div>`).join('')}
 <div class="fp-sec">Quién votó (${keys.length})</div>
 ${keys.length?`<div class="table-wrap"><table><thead><tr><th>Depto</th><th>Representante registrado</th><th>Nombre ingresado</th><th>Opción</th><th>Fecha y hora</th><th>Revisión</th>${v.estado==='abierta'?'<th></th>':''}</tr></thead><tbody>${keys.map(k=>{const x=votos[k],d=votDepto(k),ver=votVerif(k,x.n),op=votOpciones(v).find(o=>o.id===x.o);
  return `<tr><td><b>${esc(votDeptoNum(k))}</b></td><td>${esc(d&&d.representante||'—')}</td><td>${esc(x.n)}</td><td>${esc(op?op.t:'(opción eliminada)')}</td><td style="white-space:nowrap">${esc(votFechaHora(x.ts))}</td><td><span class="chip ${ver.cls}">${esc(ver.t)}</span></td>${v.estado==='abierta'?`<td><button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="votAnular('${esc(v.id)}','${esc(k)}')" title="Anular este voto">Anular</button></td>`:''}</tr>`;}).join('')}</tbody></table></div>
  <div class="fp-mut" style="margin-top:6px">La columna «Revisión» compara el nombre ingresado con el representante del depto. Si no coincide, revisa si alguien votó por otro departamento y anula el voto: ese depto podrá votar de nuevo.</div>`
  :'<div class="fp-vacio">Todavía no hay votos registrados.</div>'}
 ${pendientes.length&&v.estado!=='borrador'?`<div class="fp-sec">Pendientes (${pendientes.length})</div><div class="vt-pend">${pendientes.map(d=>`<button class="btn btn-ghost btn-sm" onclick="votRecordar('${esc(v.id)}',${d.id})" title="Enviar recordatorio por WhatsApp">${esc(d.numero)}${d.contacto?' 💬':''}</button>`).join('')}</div><div class="fp-mut" style="margin-top:6px">Toca un depto para enviarle el enlace por WhatsApp.</div>`:''}
 ${an.length?`<div class="fp-sec">Votos anulados (${an.length})</div>${an.map(([k,x])=>`<div class="fp-item"><div class="fp-item-h"><b>Depto ${esc(votDeptoNum(k))}</b><span class="fp-mut">${esc(x.n||'')} · anulado el ${esc(votFechaHora(x.anuladoTs))} por ${esc(x.por||'—')}</span></div><div class="fp-com">Motivo: ${esc(x.motivo||'')}</div></div>`).join('')}`:''}
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">
  <button class="btn btn-primary" onclick="votGenerarPDF('${esc(v.id)}')">📄 Resumen en PDF</button>
  ${v.estado==='abierta'?`<button class="btn btn-danger" onclick="votCerrar('${esc(v.id)}')">🔒 Cerrar votación</button>`:''}
  ${v.estado==='cerrada'?`<button class="btn btn-outline" onclick="votReabrir('${esc(v.id)}')">🔓 Reabrir…</button>`:''}
  ${v.estado!=='cerrada'?`<button class="btn btn-ghost" onclick="votForm('${esc(v.id)}')">✏️ Editar</button>`:''}
  <button class="btn btn-ghost" style="margin-left:auto;color:var(--danger)" onclick="votEliminar('${esc(v.id)}')">🗑 Eliminar</button><button class="btn btn-ghost" onclick="votCerrarDetalle()">Cerrar ventana</button></div></div></div>`;
 const m=document.getElementById('vot-det');if(m&&st)m.scrollTop=st;
}

/* ------------------------------------------------------- compartir y recordar */
function votTexto(v){
 return `🗳️ *VOTACIÓN · Condominio Bosques del Sur 4*\n*${v.titulo}*\n${v.descripcion?v.descripcion+'\n':''}Vota con el enlace (1 voto por departamento):\n${votEnlace(v.codigo)}\n${v.cierreTs?'⏰ '+votMsgCierre(v):''}`.trim();
}
async function votCopiar(id){
 const v=votPorId(id);if(!v)return;
 try{await navigator.clipboard.writeText(votEnlace(v.codigo));showToast('Enlace copiado ✓','success');}
 catch(e){const i=document.getElementById('vot-link');if(i){i.select();document.execCommand('copy');showToast('Enlace copiado ✓','success');}else prompt('Copia el enlace:',votEnlace(v.codigo));}
}
function votWhatsApp(id){const v=votPorId(id);if(v)abrirWhatsApp('',votTexto(v));}
function votRecordar(id,depId){
 const v=votPorId(id),d=(appData.departamentos||[]).find(x=>x.id===depId);if(!v||!d)return;
 if(!d.contacto){showToast('El depto '+d.numero+' no tiene teléfono registrado. Se abrirá WhatsApp sin destinatario.','');}
 abrirWhatsApp(d.contacto||'',`Hola ${d.representante||''} 👋\n`+votTexto(v).replace('*VOTACIÓN','*RECORDATORIO · VOTACIÓN'));
}

/* ------------------------------------------------------ anular / cerrar / reabrir */
async function votAnular(id,key){
 const v=votPorId(id);if(!v||v.estado!=='abierta')return;
 const x=(_votCache[v.codigo]&&_votCache[v.codigo].votos||{})[key];if(!x)return;
 const motivo=(prompt('Anular el voto del depto '+votDeptoNum(key)+'. Ese depto podrá votar de nuevo.\n\nMotivo (obligatorio):','')||'').trim();
 if(motivo.length<3){showToast('Anulación cancelada: falta el motivo','error');return;}
 try{
  const rec={...v,anulados:{...(v.anulados||{}),[key]:{n:x.n,o:x.o,ts:x.ts||0,motivo:motivo.slice(0,200),por:checkSession()||'',anuladoTs:Date.now()}}};
  appData.votaciones=votLista().map(z=>String(z.id)===String(id)?rec:z);
  await savePath('votaciones/'+id+'/anulados/'+key,rec.anulados[key]);   /* primero la evidencia */
  await db.ref(VOT_REG+'/'+v.codigo+'/'+key).remove();
  showToast('Voto anulado. El depto '+votDeptoNum(key)+' puede votar de nuevo.','success');
 }catch(e){console.warn(e);showToast('No se pudo anular: '+e.message,'error');}
}
async function votCerrar(id){
 const v=votPorId(id);if(!v||v.estado!=='abierta')return;
 const c=votConteo(v);
 if(!confirm('¿Cerrar la votación «'+v.titulo+'»?\n\nVotaron '+c.vot+' de '+c.total+' departamentos ('+votPct(c.part)+').\nNadie más podrá votar y el resultado quedará congelado.'))return;
 try{
  const snap=await db.ref(VOT_REG+'/'+v.codigo).once('value');
  const votos=snap.val()||{};
  const tmp={...v,estado:'abierta'};_votCache[v.codigo]={votos};
  const cc=votConteo(tmp);
  const limpio={};Object.keys(votos).forEach(k=>{const x=votos[k];if(x&&typeof x==='object')limpio[k]={n:String(x.n||''),o:String(x.o||''),ts:Number(x.ts)||0};});
  const rec={...v,estado:'cerrada',cerradoTs:Date.now(),cerradoPor:checkSession()||'',votos:limpio,
   resultado:{total:cc.total,votaron:cc.vot,part:Math.round(cc.part*10)/10,opciones:cc.ops.map(o=>({id:o.id,t:o.t,n:o.n,pct:Math.round(o.pct*10)/10,pctTot:Math.round(o.pctTot*10)/10})),ts:Date.now(),por:checkSession()||''}};
  appData.votaciones=votLista().map(z=>String(z.id)===String(id)?rec:z);
  await savePath('votaciones/'+id,rec);
  try{await votPublicarEspejo(rec);}catch(e){console.warn(e);}
  votDesuscribir(v.codigo);
  renderView();votDetalleRender();showToast('Votación cerrada ✓'+(rec.publicar!==false?' Ya aparece en Transparencia.':''),'success');
 }catch(e){console.warn(e);showToast('No se pudo cerrar: '+e.message,'error');}
}
async function votReabrir(id){
 const v=votPorId(id);if(!v||v.estado!=='cerrada')return;
 const motivo=(prompt('Reabrir «'+v.titulo+'». El resultado dejará de estar congelado y saldrá de Transparencia hasta que la cierres de nuevo.\n\nMotivo (obligatorio):','')||'').trim();
 if(motivo.length<5){showToast('Reapertura cancelada: falta el motivo','error');return;}
 const rec={...v,estado:'abierta',reaperturas:comoLista(v.reaperturas).concat([{ts:Date.now(),por:checkSession()||'',motivo:motivo.slice(0,200)}])};
 delete rec.resultado;delete rec.votos;delete rec.cerradoTs;delete rec.cerradoPor;
 if(rec.cierreTs&&rec.cierreTs<=Date.now())rec.cierreTs=0;     /* el plazo anterior ya pasó: queda sin límite hasta que la directiva edite */
 appData.votaciones=votLista().map(z=>String(z.id)===String(id)?rec:z);
 try{
  /* El nodo hijo 'votos' se borra explícitamente: set() del registro completo ya lo reemplaza. */
  await savePath('votaciones/'+id,rec);
  await votPublicarEspejo(rec);
  votSuscribir(rec);renderView();votDetalleRender();showToast('Votación reabierta','success');
 }catch(e){console.warn(e);showToast('No se pudo reabrir: '+e.message,'error');}
}
async function votEliminar(id){
 const v=votPorId(id);if(!v)return;
 const c=votConteo(v);
 const t=prompt('Eliminar «'+v.titulo+'»'+(c.vot?' con sus '+c.vot+' voto(s)':'')+'. Esta acción no se puede deshacer.\n\nEscribe ELIMINAR para confirmar:','');
 if(t!=='ELIMINAR')return;
 try{
  votDesuscribir(v.codigo);
  appData.votaciones=votLista().filter(z=>String(z.id)!==String(id));
  await savePath('votaciones/'+id,null);
  await db.ref(VOT_PUB+'/'+v.codigo).remove().catch(()=>{});
  await db.ref(VOT_REG+'/'+v.codigo).remove().catch(()=>{});
  delete _votCache[v.codigo];_votDetId=null;closeModal();renderView();showToast('Votación eliminada','success');
 }catch(e){console.warn(e);showToast('No se pudo eliminar: '+e.message,'error');}
}

/* ========================================================================= PDF */
function votCortar(c,txt,w,size,font){
 const f=font||c.F;let t=pdfSan(String(txt==null?'':txt));
 if(f.widthOfTextAtSize(t,size)<=w)return t;
 while(t.length>1&&f.widthOfTextAtSize(t+'...',size)>w)t=t.slice(0,-1);
 return t+'...';
}
async function pdfVotacion(v){
 const c=await pdfNuevo('Resultado de votación',v.folio||'VOT');
 const cc=votConteo(v),votos=votVotos(v),ops=votOpciones(v);
 const keys=Object.keys(votos).filter(k=>votos[k]).sort((a,b)=>String(votDeptoNum(a)).localeCompare(String(votDeptoNum(b)),'es',{numeric:true}));
 const cerr=v.estado==='cerrada';
 pdfCabeceraFolio(c,{folio:v.folio||'',fecha:votHoyISO()});
 c.y+=4;pdfParrafo(c,v.titulo,{size:15,font:c.B,color:PDF_COL.marca,justify:false,despues:4});
 if(v.descripcion)pdfParrafo(c,v.descripcion,{size:10,color:PDF_COL.gris,justify:false,despues:8});
 pdfFicha(c,[
  ['Fecha de la votación',votFecha(v.fecha)],
  ['Estado',cerr?'Cerrada el '+votFechaHora(v.cerradoTs):(v.estado==='abierta'?'Abierta (resultado parcial)':'Borrador'),cerr?PDF_COL.verde:PDF_COL.texto],
  ['Plazo',v.cierreTs?'Hasta el '+votFechaHora(v.cierreTs):'Sin fecha límite'],
  ['Participación',cc.vot+' de '+cc.total+' departamentos ('+votPct(cc.part)+')',PDF_COL.marca],
  ['Criterio','1 departamento = 1 voto']]);
 pdfSeccion(c,'Resultado');
 pdfTabla(c,[{t:'Opción',w:215},{t:'Votos',w:60,align:'right'},{t:'% de votos emitidos',w:110,align:'right'},{t:'% del total de deptos',w:110,align:'right'}],
  cc.ops.map(o=>[votCortar(c,o.t,200,9.5),String(o.n),votPct(o.pct),votPct(o.pctTot)]));
 /* barras */
 const maxN=Math.max(0,...cc.ops.map(o=>o.n));
 pdfAsegurar(c,cc.ops.length*26+14);
 cc.ops.forEach(o=>{
  pdfTexto(c,votCortar(c,o.t,170,9.5),{x:PDF_M,size:9.5,y:c.y+13});
  const bx=PDF_M+180,bw=230;pdfRect(c,bx,c.y+3,bw,14,'#E5E7EB');
  if(o.pct>0)pdfRect(c,bx,c.y+3,Math.max(2,bw*o.pct/100),14,(o.n===maxN&&maxN>0)?PDF_COL.marca2:'#94A3B8');
  pdfTexto(c,o.n+' · '+votPct(o.pct),{x:bx+bw+10,size:9.5,font:c.B,y:c.y+13});c.y+=26;});
 c.y+=6;
 pdfSeccion(c,'Detalle: quién votó ('+keys.length+')');
 if(keys.length){
  pdfTabla(c,[{t:'Depto',w:45},{t:'Nombre ingresado',w:165},{t:'Opción',w:130},{t:'Fecha y hora',w:105},{t:'Rev.',w:50}],
   keys.map(k=>{const x=votos[k],op=ops.find(o=>o.id===x.o),ver=votVerif(k,x.n);
    return [votDeptoNum(k),votCortar(c,x.n,150,9.5),votCortar(c,op?op.t:'(eliminada)',118,9.5),votFechaHora(x.ts),ver.c];}));
  pdfParrafo(c,'Rev.: OK = el nombre ingresado coincide con el representante registrado del departamento; Rev. = conviene revisar; — = el departamento no tiene representante registrado.',{size:8,color:PDF_COL.gris,justify:false});
 }else pdfParrafo(c,'No se registraron votos.',{size:10,color:PDF_COL.gris,justify:false});
 const pend=(appData.departamentos||[]).filter(d=>!votos['d'+d.id]).map(d=>String(d.numero));
 if(pend.length){pdfSeccion(c,'Departamentos que no votaron ('+pend.length+')');pdfParrafo(c,pend.join(', '),{size:10,justify:false});}
 const an=v.anulados?Object.entries(v.anulados).filter(([k,x])=>x):[];
 if(an.length){pdfSeccion(c,'Votos anulados ('+an.length+')');
  pdfTabla(c,[{t:'Depto',w:45},{t:'Anulado el',w:105},{t:'Por',w:80},{t:'Motivo',w:265}],an.map(([k,x])=>[votDeptoNum(k),votFechaHora(x.anuladoTs),votCortar(c,x.por||'',70,9.5),votCortar(c,x.motivo||'',250,9.5)]));}
 pdfSeccion(c,'Notas');
 pdfParrafo(c,'Votación electrónica realizada mediante un enlace privado compartido por la directiva. Cada departamento puede emitir un único voto, registrado con el nombre ingresado por quien vota; la directiva puede anular votos que no correspondan y cada anulación queda registrada. Este documento refleja los votos registrados a la fecha de emisión y no reemplaza al acta de asamblea ni a los quórums y mayorías que exijan la ley y el reglamento de copropiedad, que deben ser revisados por la directiva o su asesor legal.',{size:9,color:PDF_COL.gris});
 pdfParrafo(c,'Documento confidencial: contiene nombres y la opción elegida por cada departamento. Para los vecinos se publica únicamente el resultado agregado en Transparencia.',{size:9,color:PDF_COL.rojo,justify:false});
 pdfFirmas(c,PDF_ROLES);
 pdfCerrar(c,'Resultado de votación');
 return await pdfBytes(c);
}
async function votGenerarPDF(id){
 const v=votPorId(id);if(!v)return;
 try{
  showToast('Generando PDF…','');
  const bytes=await pdfVotacion(v),nombre='Votacion_'+(v.folio||'VOT')+'.pdf',c=votConteo(v);
  if(rendPdfActual&&rendPdfActual.url)URL.revokeObjectURL(rendPdfActual.url);
  rendPdfActual={bytes,nombre,url:pdfUrl(bytes),texto:'CONDOMINIO BOSQUES DEL SUR 4\nResultado de votación: '+v.titulo+'\n'+c.ops.map(o=>o.t+': '+votPct(o.pct)+' ('+o.n+')').join(' · ')+'\nParticipación: '+c.vot+' de '+c.total+' ('+votPct(c.part)+')'};
  const vista=window.innerWidth>=820?`<iframe src="${rendPdfActual.url}#view=FitH&toolbar=0" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:10px;background:#fff" title="Vista previa"></iframe>`
   :'<div style="padding:18px;text-align:center;font-size:13px;color:var(--text2);border:1px dashed var(--border);border-radius:10px">PDF generado. Usa los botones para descargarlo o abrirlo.</div>';
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)votDetalleRender()"><div class="modal" style="max-width:760px">
   <div class="modal-title">🗳️ ${esc(v.folio||'')} — Resumen de votación</div><div style="margin-bottom:14px">${vista}</div>
   <div style="display:flex;gap:8px;flex-wrap:wrap">${pdfBtnDescargar(rendPdfActual,'rendPdfActual')}<button class="btn btn-ghost" onclick="pdfAbrir(rendPdfActual)">↗ Abrir en pestaña nueva</button><button class="btn btn-success" onclick="rendCompartir()">📤 Compartir</button><button class="btn btn-ghost" onclick="votDetalleRender()">← Volver</button></div>
   <div class="fp-mut" style="margin-top:10px">Contiene nombres y votos individuales: compártelo solo con la directiva.</div></div></div>`;
 }catch(e){console.error(e);showToast('No se pudo generar el PDF: '+e.message,'error');}
}
