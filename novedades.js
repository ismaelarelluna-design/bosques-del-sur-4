/* ===========================================================================
   Novedades (libro de novedades) — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   Reclamos, incidentes y sugerencias. Pueden llegar desde el Formulario de
   Google (un Apps Script las envia a Firebase) o registrarse a mano.

   Datos (Firebase):  cbs4/novedades/<pushId>
     Campos que envia el formulario (externos, NO confiables):
       origen:'formulario', ts(ms), nombre, depto, contacto, tipo, ubicacion,
       descripcion, prioridad?
     Campos internos (los pone la app):
       estado, prioridad, responsable, proveedorId, actualizado,
       historial/<key> {ts,usuario,estado,texto}

   Reglas:
   - El formulario escribe con POST a .../cbs4/novedades.json  (Firebase genera
     la clave). NUNCA como arreglo: dos escrituras se pisarian.
   - Todo texto externo se muestra con esc() y se normaliza/recorta al leerlo.
   - La app actualiza con update() (fusiona), asi jamas borra campos que el
     formulario agregue en el futuro.
   =========================================================================== */
const NOV_ESTADOS=['Nueva','En revisión','En proceso','Resuelta','Descartada'];
const NOV_TIPOS=['Reclamo','Incidente','Seguridad','Mantención','Aseo','Sugerencia','Otro'];
const NOV_PRIORIDADES=['Baja','Media','Alta','Urgente'];
const NOV_COLOR={'Nueva':'#0E7490','En revisión':'#B45309','En proceso':'#7C3AED','Resuelta':'#059669','Descartada':'#6B7280'};
const NOV_PRIO_COLOR={'Baja':'#6B7280','Media':'#0E7490','Alta':'#B45309','Urgente':'#DC2626'};
const NOV_ENDPOINT=((typeof firebaseConfig!=='undefined'&&firebaseConfig.databaseURL)?firebaseConfig.databaseURL.replace(/\/$/,''):'https://bosques-del-sur-4-default-rtdb.firebaseio.com')+'/cbs4/novedades.json';

function novTxt(v,max){return String(v==null?'':v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').trim().slice(0,max);}
function novNormalizar(r){
 const ts=Number(r.ts);
 const hist=r.historial&&typeof r.historial==='object'?Object.values(r.historial).filter(h=>h&&typeof h==='object').map(h=>({ts:Number(h.ts)||0,usuario:novTxt(h.usuario,40),estado:novTxt(h.estado,20),texto:novTxt(h.texto,400)})).sort((a,b)=>a.ts-b.ts):[];
 return {id:r.id,origen:r.origen==='manual'?'manual':'formulario',ts:isFinite(ts)&&ts>0?ts:0,
  nombre:novTxt(r.nombre,80),depto:novTxt(r.depto,20),contacto:novTxt(r.contacto,60),
  tipo:novTxt(r.tipo,40)||'Otro',ubicacion:novTxt(r.ubicacion,80),descripcion:novTxt(r.descripcion,1500),
  estado:NOV_ESTADOS.includes(r.estado)?r.estado:'Nueva',
  prioridad:NOV_PRIORIDADES.includes(r.prioridad)?r.prioridad:'Media',
  responsable:novTxt(r.responsable,60),proveedorId:r.proveedorId||'',actualizado:Number(r.actualizado)||0,historial:hist,creadoPor:novTxt(r.creadoPor,40)};
}
function novedades(){return (appData.novedades||[]).filter(r=>r&&typeof r==='object'&&r.id).map(novNormalizar).sort((a,b)=>b.ts-a.ts);}
function novPorId(id){return novedades().find(n=>String(n.id)===String(id))||null;}
function novActivas(){return novedades().filter(n=>['Nueva','En revisión','En proceso'].includes(n.estado));}
function novFecha(ts){if(!ts)return '—';const d=new Date(ts);return d.getDate()+' '+MESES[d.getMonth()].slice(0,3).toLowerCase()+' '+d.getFullYear()+' · '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
function estadoNov(){if(!state.nov)state.nov={tab:'activas',q:'',tipo:'',prio:'',origen:'',hoja:1,ayuda:false};return state.nov;}

/* ---------- tarjeta para el Panel Central ---------- */
function cardNovedades(){
 if(state.isTransparencia)return '';
 const act=novActivas();
 if(!act.length)return '';
 const nuevas=act.filter(n=>n.estado==='Nueva').length,urg=act.filter(n=>n.prioridad==='Urgente'||n.prioridad==='Alta').length;
 return `<div class="card"><div class="card-title">📨 Novedades por atender</div>
 <div class="nov-mini">${act.slice(0,4).map(n=>`<div class="nov-mini-fila" onclick="abrirNovedad('${esc(n.id)}')"><span class="nov-dot" style="background:${NOV_COLOR[n.estado]}"></span>
  <div style="flex:1;min-width:0"><div class="nov-mini-t">${esc(n.tipo)}${n.depto?' · Depto '+esc(n.depto):''}</div><div class="nov-mini-d">${esc(n.descripcion.slice(0,90))}</div></div>
  <span class="nov-chip" style="color:${NOV_PRIO_COLOR[n.prioridad]}">${esc(n.prioridad)}</span></div>`).join('')}</div>
 <div class="mant-mini-total">${nuevas} nueva${nuevas===1?'':'s'} · ${urg} de prioridad alta · <a href="javascript:goTo('novedades')" style="color:var(--navy,#0E7490);font-weight:600;">Ver todas</a></div></div>`;
}
function abrirNovedad(id){state.currentView='novedades';renderSidebar();renderBNav();renderView();setTimeout(()=>gestionarNovedad(id),0);}

/* ---------- vista ---------- */
function vNovedades(){
 const e=estadoNov();const todas=novedades();
 const cnt=t=>t==='activas'?novActivas().length:t==='resueltas'?todas.filter(n=>n.estado==='Resuelta').length:t==='descartadas'?todas.filter(n=>n.estado==='Descartada').length:todas.length;
 const tab=(k,l)=>`<button class="seg-btn ${e.tab===k?'on':''}" onclick="setNov({tab:'${k}'})">${l} <span class="seg-n">${cnt(k)}</span></button>`;
 const urg=novActivas().filter(n=>n.prioridad==='Urgente').length;
 return `<div class="page-title">Libro de novedades</div>
 <div class="page-sub">Reclamos, incidentes y sugerencias de los vecinos — con seguimiento hasta que se resuelven</div>
 <div class="stats-grid mant-stats">
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">📨</span>Por atender</div><div class="stat-value" data-plain>${novActivas().length}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">🚨</span>Urgentes</div><div class="stat-value" data-plain style="color:var(--danger)">${urg}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">✅</span>Resueltas</div><div class="stat-value" data-plain style="color:var(--green)">${cnt('resueltas')}</div></div>
 </div>
 <div class="toolbar"><div class="seg">${tab('activas','Por atender')}${tab('resueltas','Resueltas')}${tab('descartadas','Descartadas')}${tab('todas','Todas')}</div>
  <div class="toolbar-sep"></div><button class="btn btn-success" onclick="openNuevaNovedad()">+ Registrar novedad</button></div>
 <div class="toolbar">
  <div class="buscador"><span class="buscador-ico">🔎</span><input class="fi buscador-input" placeholder="Buscar en descripción, vecino o depto…" value="${esc(e.q)}" oninput="buscarNov(this.value)"/></div>
  <select class="fi" style="width:auto" onchange="setNov({tipo:this.value})"><option value="">Todos los tipos</option>${[...new Set(NOV_TIPOS.concat(todas.map(n=>n.tipo)))].map(t=>`<option value="${esc(t)}" ${e.tipo===t?'selected':''}>${esc(t)}</option>`).join('')}</select>
  <select class="fi" style="width:auto" onchange="setNov({prio:this.value})"><option value="">Toda prioridad</option>${NOV_PRIORIDADES.map(t=>`<option ${e.prio===t?'selected':''}>${t}</option>`).join('')}</select>
  <select class="fi" style="width:auto" onchange="setNov({origen:this.value})"><option value="">Todo origen</option><option value="formulario" ${e.origen==='formulario'?'selected':''}>📨 Formulario</option><option value="manual" ${e.origen==='manual'?'selected':''}>✍ Manual</option></select>
 </div>
 <div id="nov-lista">${htmlNovLista()}</div>
 ${htmlNovConexion()}`;
}
function setNov(p){Object.assign(estadoNov(),p);if(!('ayuda' in p))estadoNov().hoja=1;renderView();}
function buscarNov(v){const e=estadoNov();e.q=v;e.hoja=1;document.getElementById('nov-lista').innerHTML=htmlNovLista();}
function hojaNov(n){estadoNov().hoja=n;document.getElementById('nov-lista').innerHTML=htmlNovLista();}
function novFiltradas(){
 const e=estadoNov();const q=(e.q||'').toLowerCase().trim();
 return novedades().filter(n=>{
  if(e.tab==='activas'&&!['Nueva','En revisión','En proceso'].includes(n.estado))return false;
  if(e.tab==='resueltas'&&n.estado!=='Resuelta')return false;
  if(e.tab==='descartadas'&&n.estado!=='Descartada')return false;
  if(e.tipo&&n.tipo!==e.tipo)return false;if(e.prio&&n.prioridad!==e.prio)return false;if(e.origen&&n.origen!==e.origen)return false;
  return !q||[n.descripcion,n.nombre,n.depto,n.tipo,n.ubicacion].join(' ').toLowerCase().includes(q);});
}
function htmlNovLista(){
 const e=estadoNov();const l=novFiltradas();const POR=10;
 if(!novedades().length)return `<div class="card"><div class="empty-state"><div class="empty-ico">📨</div><div class="empty-txt">Aún no hay novedades. Cuando conectes el Formulario de Google llegarán solas; mientras tanto puedes registrarlas a mano.</div><button class="btn btn-primary" onclick="openNuevaNovedad()">+ Registrar novedad</button></div></div>`;
 if(!l.length)return '<div class="card"><div class="empty-state"><div class="empty-ico">🎉</div><div class="empty-txt">No hay novedades en esta vista</div></div></div>';
 const pags=Math.ceil(l.length/POR);if(e.hoja>pags)e.hoja=pags;
 const cards=l.slice((e.hoja-1)*POR,e.hoja*POR).map(n=>{
  const prov=novProvNombre(n);
  return `<div class="nov-card" style="border-left-color:${NOV_COLOR[n.estado]}">
   <div class="nov-top"><span class="nov-chip" style="background:${NOV_COLOR[n.estado]}22;color:${NOV_COLOR[n.estado]}">${esc(n.estado)}</span>
    <span class="chip chip-cat">${esc(n.tipo)}</span><span class="nov-chip" style="color:${NOV_PRIO_COLOR[n.prioridad]}">● ${esc(n.prioridad)}</span>
    <span class="nov-origen">${n.origen==='formulario'?'📨 Formulario':'✍ Manual'}</span><span class="nov-fecha">${esc(novFecha(n.ts))}</span></div>
   <div class="nov-desc">${esc(n.descripcion)||'<em>Sin descripción</em>'}</div>
   <div class="nov-meta">${n.depto?`<span>🏠 Depto ${esc(n.depto)}</span>`:''}${n.nombre?`<span>👤 ${esc(n.nombre)}</span>`:''}${n.ubicacion?`<span>📍 ${esc(n.ubicacion)}</span>`:''}${n.responsable?`<span>🧑‍🔧 ${esc(n.responsable)}</span>`:''}${prov?`<span>🤝 ${esc(prov)}</span>`:''}</div>
   <div class="nov-acc"><button class="btn btn-primary btn-sm" onclick="gestionarNovedad('${esc(n.id)}')">Gestionar</button>
    ${n.contacto?`<button class="btn btn-outline btn-sm" onclick="novWhatsApp('${esc(n.id)}')">💬 Responder</button>`:''}
    ${n.historial.length?`<span style="font-size:11px;color:var(--text3)">${n.historial.length} actualización${n.historial.length>1?'es':''}</span>`:''}</div></div>`;}).join('');
 let pag='';
 if(pags>1){const nums=[];for(let i=1;i<=pags;i++){if(i===1||i===pags||Math.abs(i-e.hoja)<=1)nums.push(i);else if(nums[nums.length-1]!=='…')nums.push('…');}
  pag=`<div class="pg-wrap"><button class="pg-btn" ${e.hoja<=1?'disabled':''} onclick="hojaNov(${e.hoja-1})">← Anterior</button>${nums.map(n=>n==='…'?'<span class="pg-sep">…</span>':`<button class="pg-btn ${n===e.hoja?'activa':''}" onclick="hojaNov(${n})">${n}</button>`).join('')}<button class="pg-btn" ${e.hoja>=pags?'disabled':''} onclick="hojaNov(${e.hoja+1})">Siguiente →</button><span class="pg-info">Hoja ${e.hoja} de ${pags}</span></div>`;}
 return cards+pag;
}
function novProvNombre(n){return (typeof proveedorNombre==='function'&&n.proveedorId)?proveedorNombre(n.proveedorId):'';}
function novWhatsApp(id){const n=novPorId(id);if(!n)return;abrirWhatsApp(n.contacto,'Hola'+(n.nombre?' '+n.nombre:'')+', le escribimos del Condominio Bosques del Sur 4 por su '+n.tipo.toLowerCase()+' ('+n.estado.toLowerCase()+'). ');}

/* ---------- registrar a mano ---------- */
function openNuevaNovedad(){
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:520px;">
 <div class="modal-title">Registrar novedad</div>
 <div class="form-row form-row-2"><div><label class="fl">Tipo</label><select class="fi" id="nn-t">${NOV_TIPOS.map(t=>`<option>${t}</option>`).join('')}</select></div>
  <div><label class="fl">Prioridad</label><select class="fi" id="nn-p">${NOV_PRIORIDADES.map(t=>`<option ${t==='Media'?'selected':''}>${t}</option>`).join('')}</select></div></div>
 <div class="form-row form-row-2"><div><label class="fl">Depto (opcional)</label><input class="fi" id="nn-d" maxlength="20"/></div><div><label class="fl">Vecino (opcional)</label><input class="fi" id="nn-n" maxlength="80"/></div></div>
 <div class="form-row form-row-2"><div><label class="fl">Ubicación (opcional)</label><input class="fi" id="nn-u" maxlength="80" placeholder="Ej: Estacionamiento norte"/></div><div><label class="fl">Contacto (opcional)</label><input class="fi" id="nn-c" maxlength="60" inputmode="tel"/></div></div>
 <div class="form-row"><div><label class="fl">Descripción *</label><textarea class="fi" id="nn-x" rows="4" maxlength="1500" placeholder="¿Qué ocurrió o qué se solicita?"></textarea></div></div>
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-success" onclick="guardarNuevaNovedad()">Registrar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
function guardarNuevaNovedad(){
 const desc=document.getElementById('nn-x').value.trim();
 if(desc.length<3){showToast('Escribe la descripción','error');return;}
 const id=db.ref('cbs4/novedades').push().key;
 const rec={id,origen:'manual',ts:Date.now(),nombre:document.getElementById('nn-n').value.trim(),depto:document.getElementById('nn-d').value.trim(),contacto:document.getElementById('nn-c').value.trim(),
  tipo:document.getElementById('nn-t').value,ubicacion:document.getElementById('nn-u').value.trim(),descripcion:desc,estado:'Nueva',prioridad:document.getElementById('nn-p').value,creadoPor:checkSession()||''};
 appData.novedades=(appData.novedades||[]).concat([rec]);
 savePath('novedades/'+id,rec);
 closeModal();renderView();showToast('Novedad registrada','success');
}

/* ---------- gestionar ---------- */
function gestionarNovedad(id){
 const n=novPorId(id);if(!n)return;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px;">
 <div class="modal-title">${esc(n.tipo)}${n.depto?' · Depto '+esc(n.depto):''}</div>
 <div class="nov-detalle"><div class="nov-desc">${esc(n.descripcion)||'<em>Sin descripción</em>'}</div>
  <div class="nov-meta">${n.nombre?`<span>👤 ${esc(n.nombre)}</span>`:''}${n.contacto?`<span>📞 ${esc(n.contacto)}</span>`:''}${n.ubicacion?`<span>📍 ${esc(n.ubicacion)}</span>`:''}<span>🕐 ${esc(novFecha(n.ts))}</span><span>${n.origen==='formulario'?'📨 Formulario':'✍ Manual'}</span></div></div>
 <div class="form-row form-row-2"><div><label class="fl">Estado</label><select class="fi" id="ng-e">${NOV_ESTADOS.map(t=>`<option ${n.estado===t?'selected':''}>${t}</option>`).join('')}</select></div>
  <div><label class="fl">Prioridad</label><select class="fi" id="ng-p">${NOV_PRIORIDADES.map(t=>`<option ${n.prioridad===t?'selected':''}>${t}</option>`).join('')}</select></div></div>
 <div class="form-row"><div><label class="fl">Responsable (opcional)</label><input class="fi" id="ng-r" maxlength="60" value="${esc(n.responsable)}" placeholder="Quién se encarga"/></div></div>
 ${typeof selectProveedor==='function'?selectProveedor('ng',n.proveedorId):''}
 <div class="form-row"><div><label class="fl">Nota de seguimiento (opcional)</label><textarea class="fi" id="ng-n" rows="2" maxlength="400" placeholder="Ej: Se llamó al gásfiter, viene el jueves"></textarea></div></div>
 ${n.historial.length?`<div class="nov-hist"><div class="fl">Seguimiento</div>${n.historial.map(h=>`<div class="nov-hist-fila"><span>${esc(novFecha(h.ts))} · ${esc(h.usuario)}${h.estado?' · '+esc(h.estado):''}</span>${h.texto?`<div>${esc(h.texto)}</div>`:''}</div>`).join('')}</div>`:''}
 <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-success" onclick="guardarGestionNov('${esc(id)}')">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
  <button class="btn btn-danger" style="margin-left:auto" onclick="eliminarNovedad('${esc(id)}')">Eliminar</button></div></div></div>`;
}
function guardarGestionNov(id){
 const n=novPorId(id);if(!n)return;
 const estado=document.getElementById('ng-e').value,prioridad=document.getElementById('ng-p').value,
  responsable=document.getElementById('ng-r').value.trim(),prov=(typeof leerProveedor==='function')?leerProveedor('ng'):'',nota=document.getElementById('ng-n').value.trim();
 const u=checkSession()||'',ahora=Date.now();
 const cambios={estado,prioridad,responsable:responsable||null,proveedorId:prov||null,actualizado:ahora};
 let hk=null,he=null;
 if(nota||estado!==n.estado){hk=db.ref('cbs4/novedades/'+id+'/historial').push().key;he={ts:ahora,usuario:u,estado,texto:nota};cambios['historial/'+hk]=he;}
 db.ref('cbs4/novedades/'+id).update(cambios).catch(e=>showToast('Error al guardar: '+e.message,'error'));
 /* reflejo inmediato en pantalla (el listener lo confirma despues) */
 appData.novedades=(appData.novedades||[]).map(r=>{if(String(r.id)!==String(id))return r;
  const c={...r,estado,prioridad,responsable,proveedorId:prov||'',actualizado:ahora};
  if(he){c.historial={...(r.historial&&typeof r.historial==='object'?r.historial:{}),[hk]:he};}return c;});
 const partes=[];if(estado!==n.estado)partes.push('estado: '+n.estado+' → '+estado);if(prioridad!==n.prioridad)partes.push('prioridad: '+n.prioridad+' → '+prioridad);if(responsable!==n.responsable)partes.push('responsable');if((prov||'')!==String(n.proveedorId||''))partes.push('proveedor');if(nota)partes.push('nota');
 if(partes.length&&typeof registrarAuditoria==='function')registrarAuditoria({seccion:'Novedades',accion:'editar',detalle:n.tipo+(n.depto?' Depto '+n.depto:'')+' — '+partes.join('; '),ref:'novedades/'+id});
 closeModal();renderView();showToast('Novedad actualizada','success');
}
function eliminarNovedad(id){
 const n=novPorId(id);if(!n)return;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:420px;"><div class="modal-title">Eliminar novedad</div>
 <div style="font-size:13px;color:var(--text2);line-height:1.5">Se borrará junto con su seguimiento y no se puede deshacer. Si solo quieres sacarla de la lista, cámbiala a <strong>Descartada</strong> o <strong>Resuelta</strong>.</div>
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-danger" onclick="confirmarEliminarNov('${esc(id)}')">Eliminar</button><button class="btn btn-ghost" onclick="gestionarNovedad('${esc(id)}')">Volver</button></div></div></div>`;
}
function confirmarEliminarNov(id){
 appData.novedades=(appData.novedades||[]).filter(r=>String(r.id)!==String(id));
 savePath('novedades/'+id,null);closeModal();renderView();showToast('Novedad eliminada','success');
}

/* ---------- conexion con el Formulario de Google ---------- */
const NOV_SCRIPT=[
'// === Apps Script del Formulario de Google (Extensiones > Apps Script) ===',
'// Envia cada respuesta nueva a la app (Libro de novedades). El correo de Google sigue llegando igual.',
'var URL_FIREBASE = "'+NOV_ENDPOINT+'";',
'',
'// Busca la respuesta por palabras del titulo de la pregunta (no importa el texto exacto).',
'function buscar_(r, claves) {',
'  for (var t in r) {',
'    var tl = t.toLowerCase();',
'    for (var i = 0; i < claves.length; i++) {',
'      if (tl.indexOf(claves[i]) !== -1) return String(r[t][0] || \'\').trim();',
'    }',
'  }',
'  return \'\';',
'}',
'function enviar_(novedad) {',
'  var resp = UrlFetchApp.fetch(URL_FIREBASE, {',
'    method: \'post\', contentType: \'application/json\',',
'    payload: JSON.stringify(novedad), muteHttpExceptions: true });',
'  if (resp.getResponseCode() !== 200) throw new Error(\'Firebase respondio \' + resp.getResponseCode() + \': \' + resp.getContentText());',
'}',
'// ACTIVADOR: \'Al enviar el formulario\' -> funcion alEnviarFormulario',
'function alEnviarFormulario(e) {',
'  var r = e.namedValues;',
'  var todo = Object.keys(r).map(function (k) { return k + \': \' + r[k][0]; }).join(\' | \');',
'  enviar_({',
'    origen: \'formulario\', ts: Date.now(),',
'    nombre: buscar_(r, [\'nombre\']),',
'    depto: buscar_(r, [\'depart\', \'depto\', \'unidad\', \'casa\']),',
'    contacto: buscar_(r, [\'tel\', \'cel\', \'contacto\', \'whatsapp\']),',
'    tipo: buscar_(r, [\'tipo\', \'categor\']),',
'    ubicacion: buscar_(r, [\'ubica\', \'lugar\', \'sector\']),',
'    descripcion: buscar_(r, [\'descri\', \'detalle\', \'relato\', \'comentario\', \'mensaje\']) || todo',
'  });',
'}',
'// PRUEBA: ejecutala a mano una vez; debe aparecer una novedad \'PRUEBA\' en la app.',
'function probarEnvio() {',
'  enviar_({ origen: \'formulario\', ts: Date.now(), nombre: \'PRUEBA\', depto: \'0\', contacto: \'\',',
'    tipo: \'Otro\', ubicacion: \'\', descripcion: \'Envio de prueba desde Apps Script. Puedes descartarla.\' });',
'}'
].join('\n');
function htmlNovConexion(){
 const e=estadoNov();
 return `<details class="card nov-conex" ${e.ayuda?'open':''} ontoggle="estadoNov().ayuda=this.open">
 <summary>🔗 Conectar el Formulario de Google</summary>
 <div class="nov-conex-b">
  <p>Cada respuesta del formulario se envía a la base de datos y aparece aquí como <strong>Nueva</strong>. La app ya está lista para recibirlas; falta pegar el script en el formulario.</p>
  <ol><li>Abre el formulario en Google → <strong>Respuestas</strong> → menú ⋮ → <strong>Vincular con Hojas de cálculo</strong> (opcional, deja un respaldo de todas las respuestas). Luego en el editor del formulario: menú ⋮ → <strong>Editor de secuencias de comandos</strong> (Apps Script).</li><li>Borra el código de ejemplo y pega el script de abajo. Guarda.</li><li>Selecciona la función <code>probarEnvio</code> y pulsa <strong>Ejecutar</strong>. Google pedirá autorización (acepta con tu cuenta). Debe aparecer una novedad “PRUEBA” aquí.</li><li>En <strong>Activadores</strong> (reloj, a la izquierda) → Añadir activador: función <code>alEnviarFormulario</code>, origen <em>Del formulario</em>, evento <em>Al enviar el formulario</em>.</li><li>Envía una respuesta real de prueba al formulario: llega el correo de siempre y además aparece aquí con alerta.</li></ol>
  <div class="fl">Dirección de recepción</div><pre class="nov-pre">${esc(NOV_ENDPOINT)}</pre>
  <div class="fl">Script para Google</div><pre class="nov-pre">${esc(NOV_SCRIPT)}</pre>
  <button class="btn btn-outline btn-sm" onclick="copiarScriptNov()">📋 Copiar script</button>
  <div class="nov-aviso">⚠️ Mientras las reglas de la base de datos sigan abiertas, cualquiera que conozca esa dirección podría enviar novedades falsas. Por eso todo texto que llega se muestra como texto plano, con largo limitado. Cuando se cierren las reglas, el script deberá enviar una clave; lo coordinamos en ese momento.</div>
 </div></details>`;
}
function copiarScriptNov(){navigator.clipboard.writeText(NOV_SCRIPT).then(()=>showToast('Script copiado ✓','success')).catch(()=>showToast('No se pudo copiar; selecciónalo a mano','error'));}

/* ---------- alerta de novedades nuevas ---------- */
const NOV_TITLE_BASE=document.title;
let _novVistas=null;           /* ids de novedades "Nueva" ya avisadas en esta sesion */
function novNuevasCount(){return novedades().filter(n=>n.estado==='Nueva').length;}
function novAvisoFlotante(msg){
 let el=document.getElementById('nov-alerta');
 if(!el){el=document.createElement('div');el.id='nov-alerta';el.className='nov-alerta';document.body.appendChild(el);}
 el.innerHTML='<span class="nov-alerta-ico">📨</span><div class="nov-alerta-txt"><strong>'+esc(msg)+'</strong><span>Toca para verlas</span></div><button class="nov-alerta-x" aria-label="Cerrar">✕</button>';
 el.onclick=function(ev){if(ev.target.closest&&ev.target.closest('.nov-alerta-x')){el.classList.remove('show');return;}el.classList.remove('show');goTo('novedades');};
 requestAnimationFrame(()=>el.classList.add('show'));
 clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),14000);
 try{if(navigator.vibrate)navigator.vibrate([120,60,120]);}catch(e){}
}
function novRefrescarAlerta(alInicio){
 try{
  if(state.isTransparencia||!checkSession())return;
  const nuevas=novedades().filter(n=>n.estado==='Nueva');
  const n=nuevas.length;
  document.title=(n?'('+n+') ':'')+NOV_TITLE_BASE;
  const ids=new Set(nuevas.map(x=>x.id));
  let aviso='';
  if(_novVistas===null){_novVistas=ids;if(n)aviso='Tienes '+n+' novedad'+(n>1?'es nuevas':' nueva')+' por revisar';}
  else{const recien=nuevas.filter(x=>!_novVistas.has(x.id));recien.forEach(x=>_novVistas.add(x.id));
   if(recien.length)aviso=recien.length===1?'Llegó una novedad nueva':'Llegaron '+recien.length+' novedades nuevas';}
  renderSidebar();if(typeof renderDrawerNav==='function')renderDrawerNav();
  if(aviso&&state.currentView!=='novedades')novAvisoFlotante(aviso);
 }catch(e){console.warn('alerta novedades:',e);}
}
