/* ===========================================================================
   auditoria.js — Registro de cambios — CBS4
   ---------------------------------------------------------------------------
   Rama de Firebase (hermana de 'cbs4', nunca dentro: lo que vive dentro de
   'cbs4' se descarga completo en cada cambio, y este registro solo crece):
     cbs4_auditoria/<pushId>   {ts,usuario,rol,seccion,accion,detalle,ref}

   Como funciona: savePath() (core.js) llama a auditarCambio() antes de escribir.
   Como quien llama ya mutó appData, el "antes" se toma de una copia profunda de
   lo que hay realmente en Firebase (_cbs4Raw), que se refresca en cada evento.

   LIMITE HONESTO: mientras las reglas de Firebase esten abiertas, cualquiera que
   conozca la URL de la base puede editar o borrar esta rama. El registro sirve
   para aclarar quien hizo que, no como prueba inalterable.
   =========================================================================== */
const AUD_PATH='cbs4_auditoria';
const AUD_MAX_POR_ESCRITURA=15;
const AUD_POR_HOJA=20;

const AUD_SECCIONES={pagos:'Gasto Común',gastosVariables:'Gastos',gastosFijos:'Gastos',conceptosGasto:'Gastos',
 ingresosExtra:'Ingresos Extra',multas:'Multas',formularios:'Formulario',departamentos:'Departamentos',
 mantenciones:'Mantenciones',mantencionesHechas:'Mantenciones',gastoComunHistorial:'Configuración',
 configuracion:'Configuración',proveedores:'Proveedores',rubrosProveedor:'Proveedores',
 certificados:'Certificados',novedades:'Novedades'};

/* ---------- copia local de lo que hay en Firebase ---------- */
let _cbs4Raw=null;
function clonarJSON(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
function guardarInstantaneaLocal(val){_cbs4Raw=clonarJSON(val)||{};}
function rutaGet(obj,ruta){
 let o=obj;
 for(const s of String(ruta).split('/')){if(o===null||o===undefined||typeof o!=='object')return undefined;o=o[s];}
 return o;
}
function rutaSet(obj,ruta,valor){
 if(!obj)return;
 const seg=String(ruta).split('/');let o=obj;
 for(let i=0;i<seg.length-1;i++){
  if(o[seg[i]]===null||typeof o[seg[i]]!=='object')o[seg[i]]={};
  o=o[seg[i]];}
 if(valor===null||valor===undefined)delete o[seg[seg.length-1]];
 else o[seg[seg.length-1]]=clonarJSON(valor);
}

/* ---------- descripcion de cambios ---------- */
function audTitulo(r){
 if(!r||typeof r!=='object')return String(r);
 if(r.folio)return r.folio+(r.depNumero?' · Depto '+r.depNumero:'');
 if(r.mantencionId&&r.periodo){const m=(typeof mantencionPorId==='function')?mantencionPorId(r.mantencionId):null;return 'Realizada: '+(m?m.nombre:'mantención')+' ('+r.periodo+')';}
 if(r.desde&&r.valor!==undefined)return 'Gasto común desde '+r.desde+': '+fmt(r.valor);
 if(r.numero&&!r.descripcion)return 'Depto '+r.numero+(r.representante?' — '+r.representante:'');
 return r.descripcion||r.nombre||r.regla||r.asunto||r.label||('#'+(r.id!==undefined?r.id:'?'));
}
function audResumenValor(v){
 if(v===null||v===undefined)return '∅';
 if(typeof v==='object')return '…';
 const s=String(v);return s.length>40?s.slice(0,37)+'…':s;
}
function audCampos(a,b){
 const ks=new Set([...Object.keys(a||{}),...Object.keys(b||{})]);const out=[];
 ks.forEach(k=>{
  if(k==='id'||k==='archivo')return;
  const x=(a||{})[k],y=(b||{})[k];
  if(JSON.stringify(x)===JSON.stringify(y))return;
  if(k==='archivoRef'||k==='archivoNombre'||k==='evidenciaRef'){out.push('comprobante');return;}
  if(typeof x==='object'||typeof y==='object'){out.push(k);return;}
  out.push(k+': '+audResumenValor(x)+' → '+audResumenValor(y));
 });
 return [...new Set(out)];
}
function audDiffLista(prev,next,extra){
 const idx=l=>{const m=new Map();comoLista(l).forEach((r,i)=>{if(r&&typeof r==='object')m.set(r.id!==undefined?'id:'+r.id:'i:'+i,r);});return m;};
 const P=idx(prev),N=idx(next),out=[];
 N.forEach((r,k)=>{
  if(!P.has(k)){out.push({accion:'crear',detalle:audTitulo(r)+(typeof r.monto==='number'?' · '+fmt(r.monto):'')+(extra||'')});return;}
  const campos=audCampos(P.get(k),r);
  if(campos.length)out.push({accion:'editar',detalle:audTitulo(r)+' — '+campos.slice(0,4).join('; ')+(extra||'')});
 });
 P.forEach((r,k)=>{if(!N.has(k))out.push({accion:'eliminar',detalle:audTitulo(r)+(typeof r.monto==='number'?' · '+fmt(r.monto):'')+(extra||'')});});
 return out;
}
function audDiffRegistro(prev,next){
 if((prev===null||prev===undefined)&&next)return [{accion:'crear',detalle:audTitulo(next)}];
 if(prev&&(next===null||next===undefined))return [{accion:'eliminar',detalle:audTitulo(prev)}];
 if(prev&&next){const c=audCampos(prev,next);if(c.length)return [{accion:'editar',detalle:audTitulo(next)+' — '+c.slice(0,4).join('; ')}];}
 return [];
}
function audDescribir(seg,prev,valor){
 const rama=seg[0];
 if(rama==='pagos'&&seg.length===3){
  const a=normalizarPago(prev),b=normalizarPago(valor);
  if(a.pagado===b.pagado&&a.tipo===b.tipo)return [];
  const dep=(appData.departamentos||[]).find(d=>String(d.id)===String(seg[2]));
  const quien='Depto '+(dep?dep.numero:seg[2])+' — '+((typeof formatPeriodo==='function')?formatPeriodo(seg[1]):seg[1]);
  return b.pagado?[{accion:'pago',detalle:quien+': marcado pagado ('+(b.tipo||'transferencia')+')'}]
                 :[{accion:'anular pago',detalle:quien+': pago desmarcado'}];
 }
 if(rama==='gastosFijos'&&seg.length===2)return audDiffLista(prev,valor,' · fijo '+seg[1]);
 if(['gastosVariables','ingresosExtra','multas','formularios','departamentos','mantenciones','mantencionesHechas','conceptosGasto','gastoComunHistorial'].includes(rama)&&seg.length===1)
  return audDiffLista(prev,valor);
 if(['proveedores','certificados','novedades'].includes(rama)&&seg.length===2)return audDiffRegistro(prev,valor);
 if(rama==='rubrosProveedor'||rama==='configuracion'){
  const c=(rama==='configuracion')?audCampos(prev,valor):(JSON.stringify(prev)===JSON.stringify(valor)?[]:['lista de rubros']);
  return c.length?[{accion:'editar',detalle:c.slice(0,4).join('; ')}]:[];
 }
 return [{accion:'editar',detalle:'Modificó '+seg.join('/')}];
}

/* ---------- escritura del registro ---------- */
function registrarAuditoria(e){
 try{
  const u=checkSession();if(!u)return Promise.resolve();
  const adm=(typeof ADMINS!=='undefined')?ADMINS.find(a=>a.u===u):null;
  const rec={ts:Date.now(),usuario:u,rol:adm?adm.rol:'',seccion:e.seccion||'Sistema',accion:e.accion||'editar',
   detalle:String(e.detalle||'').slice(0,260),ref:e.ref||''};
  return db.ref(AUD_PATH).push(rec).then(()=>{
    if(state.aud&&state.aud.cargado){state.aud.items.unshift({id:'_'+rec.ts,...rec});if(state.currentView==='auditoria')refrescarListaAuditoria();}
  }).catch(err=>console.warn('auditoria:',err));
 }catch(err){console.warn('auditoria:',err);return Promise.resolve();}
}
function auditarCambio(ruta,valor){
 if(!checkSession())return;
 const seg=String(ruta).split('/');
 const prev=rutaGet(_cbs4Raw,ruta);
 const items=audDescribir(seg,prev,valor);
 rutaSet(_cbs4Raw||(_cbs4Raw={}),ruta,valor);   /* evita duplicar si se escribe dos veces seguidas */
 if(!items.length)return;
 const seccion=AUD_SECCIONES[seg[0]]||'Sistema';
 const visibles=items.slice(0,AUD_MAX_POR_ESCRITURA);
 visibles.forEach(i=>registrarAuditoria({seccion,accion:i.accion,detalle:i.detalle,ref:ruta}));
 if(items.length>visibles.length)registrarAuditoria({seccion,accion:'editar',detalle:'…y '+(items.length-visibles.length)+' cambios más en la misma operación',ref:ruta});
}

/* ---------- utilidades compartidas ---------- */
function fechaClave(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fechaHoraCL(ts){
 const d=new Date(ts||0);
 return d.toLocaleDateString('es-CL',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
}
function descargarBlob(contenido,tipo,nombre){
 const url=URL.createObjectURL(new Blob([contenido],{type:tipo}));
 const a=document.createElement('a');a.href=url;a.download=nombre;document.body.appendChild(a);a.click();
 setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},400);
}

/* ---------- vista: Registro de cambios ---------- */
function estadoAud(){if(!state.aud)state.aud={items:[],cargado:false,cargando:false,error:'',q:'',usuario:'',seccion:'',accion:'',rango:'30',hoja:1};return state.aud;}
const AUD_ACCION_ESTILO={crear:['#047857','rgba(16,185,129,.14)'],editar:['#B45309','rgba(245,158,11,.16)'],eliminar:['#B91C1C','rgba(239,68,68,.14)'],
 pago:['#0E7490','rgba(6,182,212,.14)'],'anular pago':['#9A3412','rgba(249,115,22,.16)'],respaldo:['#4338CA','rgba(99,102,241,.14)'],restaurar:['#B91C1C','rgba(239,68,68,.14)']};

function cargarAuditoria(){
 const e=estadoAud();if(e.cargando)return;
 e.cargando=true;e.error='';
 db.ref(AUD_PATH).orderByKey().limitToLast(1000).once('value').then(s=>{
  const v=s.val()||{};
  e.items=Object.entries(v).map(([id,r])=>({id,...r})).sort((a,b)=>(b.ts||0)-(a.ts||0));
  e.cargado=true;e.cargando=false;
  if(state.currentView==='auditoria')renderView();
 }).catch(err=>{e.cargando=false;e.error=err.message;if(state.currentView==='auditoria')renderView();});
}
function recargarAuditoria(){const e=estadoAud();e.cargado=false;renderView();}
function auditoriaFiltrada(){
 const e=estadoAud();const q=normalizarTexto(e.q);
 const desde=e.rango==='todo'?0:Date.now()-parseInt(e.rango)*86400000;
 return e.items.filter(r=>{
  if((r.ts||0)<desde)return false;
  if(e.usuario&&r.usuario!==e.usuario)return false;
  if(e.seccion&&r.seccion!==e.seccion)return false;
  if(e.accion&&r.accion!==e.accion)return false;
  if(q&&!normalizarTexto([r.detalle,r.usuario,r.seccion,r.accion].join(' ')).includes(q))return false;
  return true;});
}
function htmlListaAuditoria(){
 const e=estadoAud();const l=auditoriaFiltrada();
 const pags=Math.max(1,Math.ceil(l.length/AUD_POR_HOJA));if(e.hoja>pags)e.hoja=pags;
 const pg=l.slice((e.hoja-1)*AUD_POR_HOJA,e.hoja*AUD_POR_HOJA);
 if(!l.length)return `<div class="empty-state"><div class="empty-ico">🕵️</div><div class="empty-txt">${e.items.length?'Ningún cambio coincide con los filtros.':'Todavía no hay cambios registrados. Aparecerán aquí desde ahora.'}</div></div>`;
 const filas=pg.map(r=>{const [c,bg]=AUD_ACCION_ESTILO[r.accion]||['#475569','rgba(100,116,139,.14)'];
  return `<tr><td style="white-space:nowrap;font-size:12px;color:var(--text3)">${esc(fechaHoraCL(r.ts))}</td>
  <td><strong>${esc(r.usuario||'—')}</strong><div style="font-size:10px;color:var(--text3)">${esc(r.rol||'')}</div></td>
  <td><span class="chip chip-cat">${esc(r.seccion||'')}</span></td>
  <td><span class="aud-acc" style="color:${c};background:${bg}">${esc(r.accion||'')}</span></td>
  <td style="font-size:13px;color:var(--text2)">${esc(r.detalle||'')}</td></tr>`;}).join('');
 let pag='';
 if(pags>1){
  const nums=[];for(let i=1;i<=pags;i++){if(i===1||i===pags||Math.abs(i-e.hoja)<=1)nums.push(i);else if(nums[nums.length-1]!=='…')nums.push('…');}
  pag=`<div class="pg-wrap"><button class="pg-btn" ${e.hoja<=1?'disabled':''} onclick="hojaAuditoria(${e.hoja-1})">← Anterior</button>${nums.map(n=>n==='…'?'<span class="pg-sep">…</span>':`<button class="pg-btn ${n===e.hoja?'activa':''}" onclick="hojaAuditoria(${n})">${n}</button>`).join('')}<button class="pg-btn" ${e.hoja>=pags?'disabled':''} onclick="hojaAuditoria(${e.hoja+1})">Siguiente →</button><span class="pg-info">Hoja ${e.hoja} de ${pags}</span></div>`;}
 return `<div class="table-wrap"><table><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Sección</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>${filas}</tbody></table></div>${pag}`;
}
function htmlResumenAuditoria(){
 const e=estadoAud();const l=auditoriaFiltrada();
 return `${l.length} cambio${l.length===1?'':'s'}${e.items.length!==l.length?' de '+e.items.length+' cargados':''}`;
}
function refrescarListaAuditoria(){
 const a=document.getElementById('aud-lista'),b=document.getElementById('aud-resumen');
 if(a)a.innerHTML=htmlListaAuditoria();if(b)b.textContent=htmlResumenAuditoria();
}
function setAuditoria(c){Object.assign(estadoAud(),c,{hoja:1});renderView();}
function buscarAuditoria(v){const e=estadoAud();e.q=v;e.hoja=1;refrescarListaAuditoria();}
function hojaAuditoria(n){estadoAud().hoja=n;refrescarListaAuditoria();const el=document.getElementById('aud-lista');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
function exportarAuditoriaCSV(){
 const l=auditoriaFiltrada();
 const cel=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
 const filas=[['Fecha','Usuario','Rol','Sección','Acción','Detalle'].map(cel).join(';')]
  .concat(l.map(r=>[fechaHoraCL(r.ts),r.usuario,r.rol,r.seccion,r.accion,r.detalle].map(cel).join(';')));
 descargarBlob('﻿'+filas.join('\r\n'),'text/csv;charset=utf-8','Registro_de_cambios_CBS4_'+fechaClave(new Date())+'.csv');
}

function vAuditoria(){
 const e=estadoAud();
 if(!e.cargado&&!e.cargando)setTimeout(cargarAuditoria,0);
 const hoy=Date.now()-86400000,sem=Date.now()-7*86400000;
 const nHoy=e.items.filter(r=>r.ts>=hoy).length,nSem=e.items.filter(r=>r.ts>=sem).length;
 const usuarios=[...new Set(e.items.map(r=>r.usuario).filter(Boolean))].sort();
 const secciones=[...new Set(e.items.map(r=>r.seccion).filter(Boolean))].sort();
 const acciones=[...new Set(e.items.map(r=>r.accion).filter(Boolean))].sort();
 const opt=(l,sel)=>l.map(x=>`<option value="${esc(x)}" ${sel===x?'selected':''}>${esc(x)}</option>`).join('');
 return `<div class="page-title">Registro de cambios</div>
 <div class="page-sub">Quién modificó qué y cuándo — pagos, gastos, multas, certificados y más</div>
 <div class="stats-grid mant-stats">
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">🕐</span>Últimas 24 h</div><div class="stat-value" data-plain>${nHoy}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">📅</span>Últimos 7 días</div><div class="stat-value" data-plain>${nSem}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">👥</span>Usuarios activos</div><div class="stat-value" data-plain>${usuarios.length}</div></div>
 </div>
 <div class="toolbar">
  <div class="buscador"><span class="buscador-ico">🔎</span><input class="fi buscador-input" placeholder="Buscar en el detalle…" value="${esc(e.q)}" oninput="buscarAuditoria(this.value)"/></div>
  <select class="fi" style="width:auto" onchange="setAuditoria({usuario:this.value})"><option value="">Todos los usuarios</option>${opt(usuarios,e.usuario)}</select>
  <select class="fi" style="width:auto" onchange="setAuditoria({seccion:this.value})"><option value="">Todas las secciones</option>${opt(secciones,e.seccion)}</select>
  <select class="fi" style="width:auto" onchange="setAuditoria({accion:this.value})"><option value="">Todas las acciones</option>${opt(acciones,e.accion)}</select>
  <select class="fi" style="width:auto" onchange="setAuditoria({rango:this.value})">
   <option value="1" ${e.rango==='1'?'selected':''}>Último día</option><option value="7" ${e.rango==='7'?'selected':''}>Últimos 7 días</option>
   <option value="30" ${e.rango==='30'?'selected':''}>Últimos 30 días</option><option value="todo" ${e.rango==='todo'?'selected':''}>Todo lo cargado</option></select>
  <div class="toolbar-sep"></div>
  <button class="btn btn-outline btn-sm" onclick="recargarAuditoria()">↻ Actualizar</button>
  <button class="btn btn-outline btn-sm" onclick="exportarAuditoriaCSV()">⬇ Exportar CSV</button>
 </div>
 <div class="toolbar-resumen" id="aud-resumen">${e.cargando?'Cargando…':htmlResumenAuditoria()}</div>
 ${e.error?`<div class="card" style="color:var(--danger)">No se pudo cargar el registro: ${esc(e.error)}</div>`:''}
 <div class="card" id="aud-lista">${e.cargando&&!e.cargado?'<div class="empty-state"><div class="empty-ico">⏳</div><div class="empty-txt">Cargando registro…</div></div>':htmlListaAuditoria()}</div>
 <div style="font-size:11px;color:var(--text3);margin-top:10px;">Este registro se guarda aparte de los datos del condominio, así que no hace más lenta la app. Muestra los últimos 1.000 movimientos. Mientras la base de datos siga abierta, no es una prueba inalterable: sirve para aclarar quién hizo qué.</div>`;
}
