/* ===========================================================================
   Mantenciones — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   Modelo de datos (Firebase):
     cbs4/mantenciones       [{id,nombre,categoria,cicloMeses,inicio:'YYYY-MM',
                               costoEstimado,proveedor,notas,activa}]
     cbs4/mantencionesHechas [{id,mantencionId,periodo:'YYYY-MM',fecha:'YYYY-MM-DD',
                               costo,notas,gastoId}]

   Regla de agenda: el proximo vencimiento se ancla en la ULTIMA ejecucion
   registrada (+ cicloMeses). Si nunca se ha hecho, se ancla en 'inicio'.
   Asi la agenda refleja la realidad operativa y no un calendario teorico.
   =========================================================================== */

const MANT_CICLOS=[
 {v:1,label:'Todos los meses'},
 {v:2,label:'Cada 2 meses'},
 {v:3,label:'Cada 3 meses (trimestral)'},
 {v:4,label:'Cada 4 meses'},
 {v:6,label:'Cada 6 meses (semestral)'},
 {v:12,label:'Una vez al año'},
 {v:24,label:'Cada 2 años'}];

const MANTENCIONES_SUGERIDAS=[
 {nombre:'Mantención bomba de agua',categoria:'Mantención',cicloMeses:6,costoEstimado:0},
 {nombre:'Limpieza de estanque de agua',categoria:'Mantención',cicloMeses:12,costoEstimado:0},
 {nombre:'Corte de pasto',categoria:'Jardinería',cicloMeses:1,costoEstimado:0},
 {nombre:'Poda de arbustos',categoria:'Jardinería',cicloMeses:6,costoEstimado:0},
 {nombre:'Revisión de cámaras',categoria:'Telecomunicaciones',cicloMeses:6,costoEstimado:0},
 {nombre:'Revisión eléctrica de pasillos',categoria:'Electricidad',cicloMeses:12,costoEstimado:0}];

/* ---------- utilidades de periodo ---------- */
function mantSerie(p){const m=/^(\d{4})-(\d{2})$/.exec(String(p||''));if(!m)return null;return parseInt(m[1])*12+(parseInt(m[2])-1);}
function mantPeriodo(s){const y=Math.floor(s/12),m=s%12;return y+'-'+String(m+1).padStart(2,'0');}
function mantHoySerie(){const d=new Date();return d.getFullYear()*12+d.getMonth();}
function mantHoyISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function mantCicloLabel(n){const c=MANT_CICLOS.find(x=>x.v===Number(n));return c?c.label:('Cada '+n+' meses');}

/* ---------- acceso a datos ---------- */
function mantenciones(){return (appData.mantenciones||[]);}
function mantencionesActivas(){return mantenciones().filter(m=>m.activa!==false);}
function mantencionPorId(id){return mantenciones().find(m=>m.id===id)||null;}
function ejecucionesDe(id){return (appData.mantencionesHechas||[]).filter(h=>h.mantencionId===id).sort((a,b)=>String(b.periodo).localeCompare(String(a.periodo)));}
function ultimaEjecucion(id){const e=ejecucionesDe(id);return e.length?e[0]:null;}

/* proximo periodo exigible de una mantencion */
function proximaMantencion(m){
 if(!m)return null;
 const ciclo=Math.max(1,parseInt(m.cicloMeses)||1);
 const ue=ultimaEjecucion(m.id);
 if(ue){const s=mantSerie(ue.periodo);return s===null?null:mantPeriodo(s+ciclo);}
 return mantSerie(m.inicio)===null?null:m.inicio;
}

/* estado: vencida | hoy | pronto | ok  (pronto = dentro de los proximos 2 meses) */
function estadoMantencion(m){
 const p=proximaMantencion(m);
 if(!p)return {periodo:null,delta:null,estado:'ok',label:'Sin agenda',color:'var(--text3)'};
 const delta=mantSerie(p)-mantHoySerie();
 if(delta<0) return {periodo:p,delta,estado:'vencida',label:'Atrasada',color:'var(--danger)'};
 if(delta===0)return {periodo:p,delta,estado:'hoy',label:'Este mes',color:'#B45309'};
 if(delta<=2) return {periodo:p,delta,estado:'pronto',label:'Próxima',color:'var(--navy,#0E7490)'};
 return {periodo:p,delta,estado:'ok',label:'Al día',color:'var(--green)'};
}

/* ocurrencias de una mantencion dentro de un año: ejecuciones reales + proyeccion */
function ocurrenciasAnio(m,anio){
 const ini=anio*12, fin=anio*12+11, out=[];
 ejecucionesDe(m.id).forEach(h=>{const s=mantSerie(h.periodo);if(s!==null&&s>=ini&&s<=fin)out.push({serie:s,periodo:h.periodo,hecha:true,registro:h});});
 const ciclo=Math.max(1,parseInt(m.cicloMeses)||1);
 let s=mantSerie(proximaMantencion(m));
 if(s!==null){let guard=0;while(s<=fin&&guard++<400){if(s>=ini)out.push({serie:s,periodo:mantPeriodo(s),hecha:false,registro:null});s+=ciclo;}}
 return out.sort((a,b)=>a.serie-b.serie);
}

/* mantenciones a la vista para el Panel Central (atrasadas + este mes + proximo mes) */
function mantencionesProximas(){
 return mantencionesActivas().map(m=>({m,e:estadoMantencion(m)}))
  .filter(x=>x.e.delta!==null&&x.e.delta<=1)
  .sort((a,b)=>a.e.delta-b.e.delta);
}

/* ---------- tarjeta para el Panel Central ---------- */
function cardMantencionesProximas(){
 const items=mantencionesProximas();
 if(!mantencionesActivas().length){
  return `<div class="card mant-card-vacia"><div class="card-title">🔧 Mantenciones</div>
  <div class="empty-state"><div class="empty-ico">🔧</div><div class="empty-txt">Aún no hay mantenciones programadas</div>
  ${state.isTransparencia?'':`<button class="btn btn-primary" onclick="goTo('mantenciones')">Configurar mantenciones</button>`}</div></div>`;}
 if(!items.length){
  return `<div class="card"><div class="card-title">🔧 Mantenciones</div>
  <div style="padding:14px 4px;color:var(--text3);font-size:13px;">Todo al día — no hay mantenciones pendientes este mes. <a href="javascript:goTo('mantenciones')" style="color:var(--navy,#0E7490);font-weight:600;">Ver agenda</a></div></div>`;}
 const total=items.reduce((s,x)=>s+(parseInt(x.m.costoEstimado)||0),0);
 return `<div class="card"><div class="card-title">🔧 Mantenciones próximas</div>
 <div class="mant-mini-list">${items.map(({m,e})=>`
  <div class="mant-mini ${e.estado}">
   <div class="mant-mini-ico">${e.estado==='vencida'?'⚠️':(e.estado==='hoy'?'📌':'🗓')}</div>
   <div class="mant-mini-body">
     <div class="mant-mini-nom">${m.nombre}</div>
     <div class="mant-mini-meta">${formatPeriodo(e.periodo)} · ${e.label}${m.costoEstimado?' · est. '+fmt(m.costoEstimado):''}</div>
   </div>
   ${state.isTransparencia?'':`<button class="btn btn-sm btn-success" onclick="marcarMantencionHecha(${m.id})">✅ Realizada</button>`}
  </div>`).join('')}</div>
 ${total>0?`<div class="mant-mini-total">Costo estimado del período: <strong>${fmt(total)}</strong></div>`:''}
 </div>`;
}

/* ---------- vista principal ---------- */
function estadoMant(){if(!state.mant)state.mant={tab:'activas'};return state.mant;}
function setMantTab(t){estadoMant().tab=t;renderView();}

function vMantenciones(){
 const tab=estadoMant().tab;
 const act=mantencionesActivas();
 const atrasadas=act.filter(m=>estadoMantencion(m).estado==='vencida').length;
 const esteMes=act.filter(m=>estadoMantencion(m).estado==='hoy').length;
 return `<div class="page-title">Mantenciones</div>
 <div class="page-sub">Plan preventivo del condominio — qué toca, cuándo y cuánto cuesta</div>
 <div class="stats-grid mant-stats">
   <div class="stat-card"><div class="stat-label"><span class="stat-icon">🔧</span>Programadas</div><div class="stat-value" data-plain>${act.length}</div></div>
   <div class="stat-card"><div class="stat-label"><span class="stat-icon">📌</span>Este mes</div><div class="stat-value" data-plain style="color:#B45309">${esteMes}</div></div>
   <div class="stat-card"><div class="stat-label"><span class="stat-icon">⚠️</span>Atrasadas</div><div class="stat-value" data-plain style="color:var(--danger)">${atrasadas}</div></div>
 </div>
 <div class="toolbar">
   <div class="seg">
     <button class="seg-btn ${tab==='activas'?'on':''}" onclick="setMantTab('activas')">🔧 Programadas</button>
     <button class="seg-btn ${tab==='agenda'?'on':''}" onclick="setMantTab('agenda')">🗓 Agenda ${state.currentYear}</button>
   </div>
   ${state.isTransparencia?'':`<button class="btn btn-success" onclick="openNuevaMantencion()">+ Nueva mantención</button>`}
 </div>
 ${tab==='activas'?htmlMantActivas():htmlMantAgenda()}`;
}

function htmlMantActivas(){
 const lista=mantenciones().slice().sort((a,b)=>{
   const ea=estadoMantencion(a),eb=estadoMantencion(b);
   if(ea.delta===null)return 1; if(eb.delta===null)return -1;
   return ea.delta-eb.delta;});
 if(!lista.length){
  return `<div class="card"><div class="empty-state">
   <div class="empty-ico">🔧</div>
   <div class="empty-txt">Todavía no hay mantenciones programadas.<br>Agrega las que ya haces hoy (bomba de agua, pasto, cámaras) y la app te avisará sola.</div>
   ${state.isTransparencia?'':`<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
     <button class="btn btn-success" onclick="openNuevaMantencion()">+ Crear la primera</button>
     <button class="btn btn-outline" onclick="openSugeridasMantencion()">✨ Usar sugeridas</button></div>`}
  </div></div>`;}
 return `<div class="mant-grid">${lista.map(m=>{
  const e=estadoMantencion(m);
  const ue=ultimaEjecucion(m.id);
  const off=m.activa===false;
  return `<div class="mant-card ${e.estado} ${off?'off':''}">
   <div class="mant-head">
     <div class="mant-nom">${m.nombre}</div>
     <span class="chip chip-cat">${m.categoria||SIN_CATEGORIA}</span>
   </div>
   <div class="mant-badges">
     <span class="mant-badge" style="--c:${e.color}">${e.estado==='vencida'?'⚠️':(e.estado==='hoy'?'📌':'🗓')} ${e.label}${e.periodo?' · '+formatPeriodo(e.periodo):''}</span>
     ${off?'<span class="chip chip-mudo">Pausada</span>':''}
   </div>
   <div class="mant-datos">
     <div><span class="mant-k">Frecuencia</span><span class="mant-v">${mantCicloLabel(m.cicloMeses)}</span></div>
     <div><span class="mant-k">Última vez</span><span class="mant-v">${ue?formatPeriodo(ue.periodo):'Nunca registrada'}</span></div>
     <div><span class="mant-k">Costo estimado</span><span class="mant-v">${m.costoEstimado?fmt(m.costoEstimado):'—'}</span></div>
     <div><span class="mant-k">Responsable</span><span class="mant-v">${esc(((typeof proveedorNombre==='function'&&proveedorNombre(m.proveedorId))||m.proveedor)||'—')}</span></div>
   </div>
   ${m.notas?`<div class="mant-notas">${m.notas}</div>`:''}
   ${state.isTransparencia?'':`<div class="mant-acciones">
     <button class="btn btn-sm btn-success" onclick="marcarMantencionHecha(${m.id})">✅ Marcar realizada</button>
     <button class="btn btn-sm btn-outline" onclick="openNuevaMantencion(${m.id})">✎ Editar</button>
     <button class="btn btn-sm btn-ghost" onclick="verHistorialMantencion(${m.id})">🕑 Historial (${ejecucionesDe(m.id).length})</button>
     <button class="btn btn-sm btn-danger" onclick="delMantencion(${m.id})">🗑 Eliminar</button>
   </div>`}
  </div>`;}).join('')}</div>`;
}

function htmlMantAgenda(){
 const anio=state.currentYear;
 const porMes=Array.from({length:12},()=>[]);
 mantencionesActivas().forEach(m=>{
   ocurrenciasAnio(m,anio).forEach(o=>{porMes[o.serie%12].push({m,o});});});
 const hay=porMes.some(x=>x.length);
 if(!hay)return `<div class="card"><div class="empty-state"><div class="empty-ico">🗓</div><div class="empty-txt">No hay mantenciones agendadas para ${anio}.</div></div></div>`;
 const hoySerie=mantHoySerie();
 return `<div class="mant-agenda">${porMes.map((items,i)=>{
   const serie=anio*12+i;
   const esActual=serie===hoySerie;
   if(!items.length)return `<div class="mant-mes vacio ${esActual?'actual':''}"><div class="mant-mes-tit">${MESES[i]}</div><div class="mant-mes-vacio">—</div></div>`;
   const total=items.reduce((s,x)=>s+(parseInt(x.o.hecha?(x.o.registro.costo||0):(x.m.costoEstimado||0))||0),0);
   return `<div class="mant-mes ${esActual?'actual':''}">
     <div class="mant-mes-tit">${MESES[i]}${esActual?' <span class="mant-hoy">hoy</span>':''}</div>
     ${items.map(({m,o})=>`<div class="mant-item ${o.hecha?'hecha':(serie<hoySerie?'atrasada':'')}">
        <span class="mant-item-ico">${o.hecha?'✅':(serie<hoySerie?'⚠️':'🗓')}</span>
        <span class="mant-item-nom" title="${m.nombre}">${m.nombre}</span>
        <span class="mant-item-monto">${o.hecha?fmt(o.registro.costo||0):(m.costoEstimado?'est. '+fmt(m.costoEstimado):'')}</span>
     </div>`).join('')}
     ${total>0?`<div class="mant-mes-total">${fmt(total)}</div>`:''}
   </div>`;}).join('')}</div>`;
}

/* ---------- alta / edicion ---------- */
function openNuevaMantencion(editId){
 const m=editId?mantencionPorId(editId):null;
 const hoy=mkKey(new Date().getFullYear(),new Date().getMonth());
 const cats=(typeof CATEGORIAS_GASTO!=='undefined'?CATEGORIAS_GASTO:['Mantención']);
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal">
 <div class="modal-title">${m?'Editar mantención':'Nueva mantención'}</div>
 <div class="form-row"><div><label class="fl">Nombre</label><input class="fi" id="mt-n" placeholder="Ej: Mantención bomba de agua" value="${m?String(m.nombre).replace(/"/g,'&quot;'):''}"/></div></div>
 <div class="form-row form-row-2">
   <div><label class="fl">Categoría</label><select class="fi" id="mt-c">${cats.map(c=>`<option ${m?(m.categoria===c?'selected':''):(c==='Mantención'?'selected':'')}>${c}</option>`).join('')}</select></div>
   <div><label class="fl">Frecuencia</label><select class="fi" id="mt-ciclo">${MANT_CICLOS.map(c=>`<option value="${c.v}" ${m&&Number(m.cicloMeses)===c.v?'selected':(!m&&c.v===6?'selected':'')}>${c.label}</option>`).join('')}</select></div>
 </div>
 <div class="form-row form-row-2">
   <div><label class="fl">${m?'Próxima desde':'Primera vez que toca'}</label><input class="fi" id="mt-ini" type="month" value="${m&&m.inicio?m.inicio:hoy}"/></div>
   <div><label class="fl">Costo estimado ($)</label><input class="fi" id="mt-costo" type="number" placeholder="0" value="${m&&m.costoEstimado?m.costoEstimado:''}"/></div>
 </div>
 ${typeof selectProveedor==='function'?selectProveedor('mtp',m&&m.proveedorId):''}
 <div class="form-row"><div><label class="fl">Responsable (texto libre, opcional)</label><input class="fi" id="mt-prov" value="${m&&m.proveedor?String(m.proveedor).replace(/"/g,'&quot;'):''}"/></div></div>
 <div class="form-row"><div><label class="fl">Notas (opcional)</label><input class="fi" id="mt-notas" value="${m&&m.notas?String(m.notas).replace(/"/g,'&quot;'):''}"/></div></div>
 <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer;margin-top:4px;"><input type="checkbox" id="mt-activa" ${!m||m.activa!==false?'checked':''} style="width:16px;height:16px;"/>Mantención activa (aparece en la agenda y en el Panel Central)</label>
 <div style="font-size:11px;color:var(--text3);margin-top:8px;">La fecha de la próxima se recalcula sola cada vez que marques la mantención como realizada.</div>
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-success" onclick="saveMantencion(${editId||'null'})">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div>
 </div></div>`;
}

function saveMantencion(editId){
 const n=document.getElementById('mt-n').value.trim();
 if(!n){showToast('Escribe el nombre de la mantención','error');return;}
 const reg={
  nombre:n,
  categoria:document.getElementById('mt-c').value,
  cicloMeses:parseInt(document.getElementById('mt-ciclo').value)||6,
  inicio:document.getElementById('mt-ini').value||mkKey(new Date().getFullYear(),new Date().getMonth()),
  costoEstimado:parseInt(document.getElementById('mt-costo').value)||0,
  proveedor:document.getElementById('mt-prov').value.trim()||((typeof proveedorNombre==='function'&&proveedorNombre(leerProveedor('mtp')))||''),
  proveedorId:((typeof leerProveedor==='function'&&leerProveedor('mtp'))||null),
  notas:document.getElementById('mt-notas').value.trim(),
  activa:document.getElementById('mt-activa').checked};
 const lista=mantenciones().slice();
 if(editId){const i=lista.findIndex(x=>x.id===editId);if(i<0){showToast('No se encontró la mantención','error');return;}lista[i]={...lista[i],...reg};}
 else lista.push({id:Date.now(),...reg});
 appData.mantenciones=lista;
 savePath('mantenciones',lista);
 closeModal();renderView();showToast(editId?'Mantención actualizada ✓':'Mantención creada ✓','success');
}

function openSugeridasMantencion(){
 const hoy=mkKey(new Date().getFullYear(),new Date().getMonth());
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal">
 <div class="modal-title">Mantenciones sugeridas</div>
 <p style="font-size:13px;color:var(--text3);margin-bottom:12px;">Marca las que aplican al condominio. Después puedes editar frecuencia y costo de cada una.</p>
 ${MANTENCIONES_SUGERIDAS.map((s,i)=>`<label style="display:flex;align-items:center;gap:10px;font-size:13px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;"><input type="checkbox" class="mt-sug" data-i="${i}" ${i===0?'checked':''} style="width:16px;height:16px;"/><span style="flex:1"><strong>${s.nombre}</strong><br><span style="color:var(--text3);font-size:11px;">${s.categoria} · ${mantCicloLabel(s.cicloMeses)}</span></span></label>`).join('')}
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-success" onclick="crearSugeridasMantencion('${hoy}')">Agregar seleccionadas</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div>
 </div></div>`;
}

function crearSugeridasMantencion(inicio){
 const sel=Array.from(document.querySelectorAll('.mt-sug')).filter(c=>c.checked).map(c=>MANTENCIONES_SUGERIDAS[parseInt(c.dataset.i)]);
 if(!sel.length){showToast('No seleccionaste ninguna','error');return;}
 const lista=mantenciones().slice();
 sel.forEach((s,k)=>lista.push({id:Date.now()+k,nombre:s.nombre,categoria:s.categoria,cicloMeses:s.cicloMeses,inicio:inicio,costoEstimado:s.costoEstimado,proveedor:'',notas:'',activa:true}));
 appData.mantenciones=lista;
 savePath('mantenciones',lista);
 closeModal();renderView();showToast(sel.length+' mantenciones agregadas ✓','success');
}

function delMantencion(id){
 const m=mantencionPorId(id);if(!m)return;
 const hechas=ejecucionesDe(id).length;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal">
 <div class="modal-title">¿Eliminar "${m.nombre}"?</div>
 <p style="font-size:13px;color:var(--text3);margin-bottom:6px;">Se borrará la mantención${hechas?` y su historial de ${hechas} ejecución${hechas>1?'es':''}`:''}. Los gastos ya registrados en la app <strong>no</strong> se tocan.</p>
 <p style="font-size:12px;color:var(--text3);margin-bottom:16px;">Si solo quieres dejar de verla, edítala y desmarca "Mantención activa".</p>
 <div style="display:flex;gap:10px;"><button class="btn btn-danger" onclick="confirmarDelMantencion(${id})">Eliminar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div>
 </div></div>`;
}

function confirmarDelMantencion(id){
 const lista=mantenciones().filter(m=>m.id!==id);
 const hechas=(appData.mantencionesHechas||[]).filter(h=>h.mantencionId!==id);
 appData.mantenciones=lista;appData.mantencionesHechas=hechas;
 savePath('mantenciones',lista);savePath('mantencionesHechas',hechas);
 closeModal();renderView();showToast('Mantención eliminada','success');
}

/* ---------- marcar realizada ---------- */
function marcarMantencionHecha(id){
 const m=mantencionPorId(id);if(!m)return;
 const e=estadoMantencion(m);
 const per=e.periodo||mkKey(new Date().getFullYear(),new Date().getMonth());
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal">
 <div class="modal-title">Registrar: ${m.nombre}</div>
 <div class="form-row form-row-2">
   <div><label class="fl">Fecha en que se hizo</label><input class="fi" id="mh-f" type="date" value="${mantHoyISO()}"/></div>
   <div><label class="fl">Costo real ($)</label><input class="fi" id="mh-c" type="number" placeholder="0" value="${m.costoEstimado||''}"/></div>
 </div>
 <div class="form-row"><div><label class="fl">Período que cubre</label><input class="fi" id="mh-p" type="month" value="${per}"/></div></div>
 <div class="form-row"><div><label class="fl">Observaciones (opcional)</label><input class="fi" id="mh-n" placeholder="Ej: se cambió el sello mecánico"/></div></div>
 <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer;padding:10px;border:1px solid var(--border);border-radius:8px;"><input type="checkbox" id="mh-gasto" checked style="width:16px;height:16px;"/>Registrar también como gasto variable del mes</label>
 <div style="font-size:11px;color:var(--text3);margin-top:8px;">La próxima quedará agendada para <strong id="mh-prox">—</strong>.</div>
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-success" onclick="confirmarMantencionHecha(${id})">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div>
 </div></div>`;
 const pintar=()=>{const v=document.getElementById('mh-p').value;const s=mantSerie(v);const el=document.getElementById('mh-prox');if(el)el.textContent=(s===null)?'—':formatPeriodo(mantPeriodo(s+(Math.max(1,parseInt(m.cicloMeses)||1))));};
 document.getElementById('mh-p').addEventListener('change',pintar);pintar();
}

function confirmarMantencionHecha(id){
 const m=mantencionPorId(id);if(!m)return;
 const periodo=document.getElementById('mh-p').value;
 if(!mantSerie(periodo)){showToast('Revisa el período','error');return;}
 const costo=parseInt(document.getElementById('mh-c').value)||0;
 const fecha=document.getElementById('mh-f').value||mantHoyISO();
 const notas=document.getElementById('mh-n').value.trim();
 const crearGasto=document.getElementById('mh-gasto').checked;
 const hechas=(appData.mantencionesHechas||[]).slice();
 const yaIdx=hechas.findIndex(h=>h.mantencionId===id&&h.periodo===periodo);
 const reg={id:yaIdx>=0?hechas[yaIdx].id:Date.now(),mantencionId:id,periodo,fecha,costo,notas};

 if(crearGasto&&costo>0){
  const [y,mm]=periodo.split('-');
  const gastoId=Date.now()+1;
  const gastos=(appData.gastosVariables||[]).slice();
  gastos.push({id:gastoId,anio:parseInt(y),mes:parseInt(mm)-1,descripcion:m.nombre,categoria:m.categoria||SIN_CATEGORIA,tipoPago:'Transferencia',monto:costo,boleta:'',origen:'mantencion'});
  reg.gastoId=gastoId;
  appData.gastosVariables=gastos;
  savePath('gastosVariables',gastos);
 }
 if(yaIdx>=0)hechas[yaIdx]=reg;else hechas.push(reg);
 appData.mantencionesHechas=hechas;
 savePath('mantencionesHechas',hechas);
 closeModal();renderView();
 const ciclo=Math.max(1,parseInt(m.cicloMeses)||1);
 showToast('Registrada ✓ Próxima: '+formatPeriodo(mantPeriodo(mantSerie(periodo)+ciclo)),'success');
}

/* ---------- historial ---------- */
function verHistorialMantencion(id){
 const m=mantencionPorId(id);if(!m)return;
 const e=ejecucionesDe(id);
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal">
 <div class="modal-title">Historial — ${m.nombre}</div>
 ${e.length===0?'<p style="font-size:13px;color:var(--text3);">Todavía no hay ejecuciones registradas.</p>':
 `<div class="table-wrap"><table><thead><tr><th>Período</th><th>Fecha</th><th>Costo</th><th>Notas</th><th></th></tr></thead><tbody>
 ${e.map(h=>`<tr><td>${formatPeriodo(h.periodo)}</td><td>${h.fecha||'—'}</td><td><strong>${fmt(h.costo||0)}</strong></td><td style="font-size:12px;color:var(--text3)">${h.notas||''}</td><td>${state.isTransparencia?'':`<button class="btn btn-danger btn-sm" onclick="delEjecucionMantencion(${id},${h.id})">🗑</button>`}</td></tr>`).join('')}
 </tbody></table></div>
 <div style="font-size:11px;color:var(--text3);margin-top:8px;">Promedio por ejecución: <strong>${fmt(Math.round(e.reduce((s,h)=>s+(h.costo||0),0)/e.length))}</strong></div>`}
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div>
 </div></div>`;
}

function delEjecucionMantencion(mantId,hechaId){
 const hechas=(appData.mantencionesHechas||[]).filter(h=>h.id!==hechaId);
 appData.mantencionesHechas=hechas;
 savePath('mantencionesHechas',hechas);
 verHistorialMantencion(mantId);renderView();showToast('Registro eliminado','success');
}
