/* ===========================================================================
   Proveedores — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   Datos (Firebase):
     cbs4/proveedores/<id>  {id,nombre,rubro,contacto,telefono,email,notas,valoracion,activo,creado}
     cbs4/rubrosProveedor   ['Rubro propio', ...]   (se suman a la lista base)
   Vinculo opcional: un gasto o una mantencion puede llevar `proveedorId`.
   Se guarda por registro (proveedores/<id>) para que dos administradores
   editando a la vez no se pisen entre si.
   =========================================================================== */
const RUBROS_BASE=['Jardinería','Electricidad','Gasfitería','Aseo','Portería y seguridad','Bombas de agua','Pintura','Cerrajería','Telecomunicaciones','Control de plagas','Construcción y reparaciones','Administración y contabilidad','Otro'];
function proveedores(){return (appData.proveedores||[]).slice();}
function proveedorPorId(id){if(id===undefined||id===null||id==='')return null;return (appData.proveedores||[]).find(p=>String(p.id)===String(id))||null;}
function proveedorNombre(id){const p=proveedorPorId(id);return p?p.nombre:'';}
function rubrosProveedor(){const s=new Set(RUBROS_BASE);(appData.rubrosProveedor||[]).forEach(r=>{if(r)s.add(r);});proveedores().forEach(p=>{if(p.rubro)s.add(p.rubro);});return [...s].sort((a,b)=>a==='Otro'?1:b==='Otro'?-1:a.localeCompare(b,'es'));}
function estadoProv(){if(!state.prov)state.prov={q:'',rubro:'',estado:'activos',orden:'nombre',hoja:1};return state.prov;}
function provIniciales(n){const p=String(n||'?').trim().split(/\s+/).filter(Boolean);return ((p[0]||'?')[0]+((p[1]||'')[0]||'')).toUpperCase();}
function provColor(s){let h=0;String(s||'').split('').forEach(c=>{h=(h*31+c.charCodeAt(0))%360;});return h;}
function provStars(n){n=parseInt(n)||0;return n?'★'.repeat(n)+'☆'.repeat(5-n):'';}

/* gastos y mantenciones vinculados a un proveedor */
function provMovimientos(id){
 const out=[];const sid=String(id);
 (appData.gastosVariables||[]).forEach(g=>{if(String(g.proveedorId||'')===sid)out.push({t:'Gasto',desc:g.descripcion||'',periodo:mkKey(g.anio,g.mes),monto:g.monto||0});});
 Object.entries(appData.gastosFijos||{}).forEach(([k,l])=>comoLista(l).forEach(g=>{if(g&&String(g.proveedorId||'')===sid)out.push({t:'Gasto fijo',desc:g.descripcion||g.nombre||'',periodo:k,monto:g.monto||0});}));
 (appData.mantencionesHechas||[]).forEach(h=>{const m=(appData.mantenciones||[]).find(x=>x.id===h.mantencionId);if(m&&String(m.proveedorId||'')===sid)out.push({t:'Mantención',desc:m.nombre,periodo:h.periodo,monto:h.costo||0});});
 return out.sort((a,b)=>String(b.periodo).localeCompare(String(a.periodo)));
}
function provResumen(id){const mv=provMovimientos(id);return {n:mv.length,total:mv.reduce((s,x)=>s+x.monto,0),ultimo:mv.length?mv[0].periodo:''};}

/* ---------- vista ---------- */
function vProveedores(){
 const e=estadoProv();const todos=proveedores();
 const activos=todos.filter(p=>p.activo!==false).length;
 return `<div class="page-title">Proveedores</div>
 <div class="page-sub">Directorio de empresas y personas que trabajan para el condominio</div>
 <div class="stats-grid mant-stats">
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">🤝</span>Proveedores</div><div class="stat-value" data-plain>${todos.length}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">✅</span>Activos</div><div class="stat-value" data-plain style="color:var(--green)">${activos}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">🏷️</span>Rubros</div><div class="stat-value" data-plain>${new Set(todos.map(p=>p.rubro).filter(Boolean)).size}</div></div>
 </div>
 <div class="toolbar">
  <div class="buscador"><span class="buscador-ico">🔎</span><input class="fi buscador-input" placeholder="Buscar nombre, contacto o teléfono…" value="${esc(e.q)}" oninput="buscarProv(this.value)"/></div>
  <select class="fi" style="width:auto" onchange="setProv({rubro:this.value})"><option value="">Todos los rubros</option>${rubrosProveedor().map(r=>`<option value="${esc(r)}" ${e.rubro===r?'selected':''}>${esc(r)}</option>`).join('')}</select>
  <select class="fi" style="width:auto" onchange="setProv({estado:this.value})"><option value="activos" ${e.estado==='activos'?'selected':''}>Activos</option><option value="inactivos" ${e.estado==='inactivos'?'selected':''}>Inactivos</option><option value="todos" ${e.estado==='todos'?'selected':''}>Todos</option></select>
  <select class="fi" style="width:auto" onchange="setProv({orden:this.value})"><option value="nombre" ${e.orden==='nombre'?'selected':''}>Orden: nombre</option><option value="rubro" ${e.orden==='rubro'?'selected':''}>Orden: rubro</option><option value="gasto" ${e.orden==='gasto'?'selected':''}>Orden: mayor gasto</option><option value="reciente" ${e.orden==='reciente'?'selected':''}>Orden: más recientes</option></select>
  <div class="toolbar-sep"></div>
  <button class="btn btn-success" onclick="openProveedor()">+ Nuevo proveedor</button>
 </div>
 <div id="prov-resumen" class="toolbar-resumen"></div>
 <div id="prov-lista">${htmlProvLista()}</div>`;
}
function setProv(p){Object.assign(estadoProv(),p);estadoProv().hoja=1;renderView();}
function buscarProv(v){const e=estadoProv();e.q=v;e.hoja=1;const el=document.getElementById('prov-lista');if(el)el.innerHTML=htmlProvLista();}
function hojaProv(n){estadoProv().hoja=n;document.getElementById('prov-lista').innerHTML=htmlProvLista();window.scrollTo(0,0);}
function provFiltrados(){
 const e=estadoProv();const q=(e.q||'').toLowerCase().trim();
 let l=proveedores().filter(p=>(e.estado==='todos'||(e.estado==='inactivos')===(p.activo===false))&&(!e.rubro||p.rubro===e.rubro)&&
  (!q||[p.nombre,p.contacto,p.telefono,p.email,p.rubro].join(' ').toLowerCase().includes(q)));
 const res={};l.forEach(p=>{res[p.id]=provResumen(p.id);});
 const cmp={nombre:(a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'),rubro:(a,b)=>String(a.rubro||'').localeCompare(String(b.rubro||''),'es')||String(a.nombre).localeCompare(String(b.nombre),'es'),
  gasto:(a,b)=>res[b.id].total-res[a.id].total,reciente:(a,b)=>(b.creado||0)-(a.creado||0)};
 return {lista:l.sort(cmp[e.orden]||cmp.nombre),res};
}
function htmlProvLista(){
 const e=estadoProv();const {lista,res}=provFiltrados();const POR=12;
 const r=document.getElementById('prov-resumen');if(r)r.textContent=lista.length+' proveedor'+(lista.length===1?'':'es');
 if(!proveedores().length)return `<div class="card"><div class="empty-state"><div class="empty-ico">🤝</div><div class="empty-txt">Aún no hay proveedores. Agrega el primero: jardinero, gásfiter, electricista…</div><button class="btn btn-primary" onclick="openProveedor()">+ Nuevo proveedor</button></div></div>`;
 if(!lista.length)return '<div class="card"><div class="empty-state"><div class="empty-ico">🔎</div><div class="empty-txt">Ningún proveedor coincide con los filtros</div></div></div>';
 const pags=Math.ceil(lista.length/POR);if(e.hoja>pags)e.hoja=pags;
 const cards=lista.slice((e.hoja-1)*POR,e.hoja*POR).map(p=>{
  const rs=res[p.id],h=provColor(p.nombre),tel=String(p.telefono||'').trim();
  return `<div class="comp-card prov-card ${p.activo===false?'inactivo':''}">
   <div class="comp-card-top"><div class="prov-av" style="background:hsl(${h} 55% 42%)">${esc(provIniciales(p.nombre))}</div>
    <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis">${esc(p.nombre)}</div>
     <div style="margin-top:3px"><span class="chip chip-cat">${esc(p.rubro||'Sin rubro')}</span>${p.activo===false?' <span class="chip chip-mudo">Inactivo</span>':''}</div></div>
    ${p.valoracion?`<span class="prov-stars" title="Valoración">${provStars(p.valoracion)}</span>`:''}</div>
   <div class="prov-datos">${p.contacto?`<div>👤 ${esc(p.contacto)}</div>`:''}${tel?`<div>📞 ${esc(tel)}</div>`:''}${p.email?`<div>✉️ ${esc(p.email)}</div>`:''}${p.notas?`<div class="prov-notas">${esc(p.notas)}</div>`:''}</div>
   <div class="prov-mov">${rs.n?`${rs.n} trabajo${rs.n>1?'s':''} · <strong>${fmt(rs.total)}</strong>${rs.ultimo?' · último '+esc(formatPeriodo(rs.ultimo)):''}`:'<span style="color:var(--text3)">Sin trabajos registrados</span>'}</div>
   <div class="prov-acc">
    ${tel?`<a class="btn btn-outline btn-sm" href="tel:${esc(tel.replace(/[^\d+]/g,''))}">📞 Llamar</a><button class="btn btn-outline btn-sm" onclick="provWhatsApp('${esc(p.id)}')">💬 WhatsApp</button>`:''}
    ${p.email?`<a class="btn btn-outline btn-sm" href="mailto:${esc(p.email)}">✉️ Correo</a>`:''}
    <button class="btn btn-ghost btn-sm" onclick="verHistorialProv('${esc(p.id)}')">🧾 Historial</button>
    <button class="btn btn-ghost btn-sm" onclick="openProveedor('${esc(p.id)}')">✏️ Editar</button></div></div>`;}).join('');
 let pag='';
 if(pags>1){const nums=[];for(let i=1;i<=pags;i++){if(i===1||i===pags||Math.abs(i-e.hoja)<=1)nums.push(i);else if(nums[nums.length-1]!=='…')nums.push('…');}
  pag=`<div class="pg-wrap"><button class="pg-btn" ${e.hoja<=1?'disabled':''} onclick="hojaProv(${e.hoja-1})">← Anterior</button>${nums.map(n=>n==='…'?'<span class="pg-sep">…</span>':`<button class="pg-btn ${n===e.hoja?'activa':''}" onclick="hojaProv(${n})">${n}</button>`).join('')}<button class="pg-btn" ${e.hoja>=pags?'disabled':''} onclick="hojaProv(${e.hoja+1})">Siguiente →</button><span class="pg-info">Hoja ${e.hoja} de ${pags}</span></div>`;}
 return `<div class="comp-grid">${cards}</div>${pag}`;
}
function provWhatsApp(id){const p=proveedorPorId(id);if(!p)return;abrirWhatsApp(p.telefono,'Hola'+(p.contacto?' '+p.contacto:'')+', le escribimos del Condominio Bosques del Sur 4. ');}

/* ---------- alta / edicion ---------- */
function openProveedor(id){
 const p=id?proveedorPorId(id):null;
 const rubros=rubrosProveedor();
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:520px;">
 <div class="modal-title">${p?'Editar proveedor':'Nuevo proveedor'}</div>
 <div class="form-row"><div><label class="fl">Nombre o razón social *</label><input class="fi" id="pv-n" maxlength="80" value="${p?esc(p.nombre):''}" placeholder="Ej: Jardines del Sur SpA"/></div></div>
 <div class="form-row form-row-2">
  <div><label class="fl">Tipo de trabajo (rubro) *</label><select class="fi" id="pv-r" onchange="document.getElementById('pv-rn-w').style.display=this.value==='__nuevo'?'block':'none'">${rubros.map(r=>`<option value="${esc(r)}" ${p&&p.rubro===r?'selected':''}>${esc(r)}</option>`).join('')}<option value="__nuevo">➕ Crear rubro nuevo…</option></select></div>
  <div><label class="fl">Valoración</label><select class="fi" id="pv-v"><option value="">Sin valorar</option>${[5,4,3,2,1].map(n=>`<option value="${n}" ${p&&parseInt(p.valoracion)===n?'selected':''}>${'★'.repeat(n)}${'☆'.repeat(5-n)}</option>`).join('')}</select></div></div>
 <div class="form-row" id="pv-rn-w" style="display:none"><div><label class="fl">Nombre del rubro nuevo</label><input class="fi" id="pv-rn" maxlength="40" placeholder="Ej: Fumigación"/></div></div>
 <div class="form-row form-row-2"><div><label class="fl">Persona de contacto</label><input class="fi" id="pv-c" maxlength="60" value="${p?esc(p.contacto||''):''}"/></div>
  <div><label class="fl">Teléfono</label><input class="fi" id="pv-t" maxlength="20" inputmode="tel" placeholder="9 1234 5678" value="${p?esc(p.telefono||''):''}"/></div></div>
 <div class="form-row"><div><label class="fl">Correo</label><input class="fi" id="pv-e" type="email" maxlength="80" value="${p?esc(p.email||''):''}"/></div></div>
 <div class="form-row"><div><label class="fl">Notas (opcional)</label><input class="fi" id="pv-no" maxlength="200" placeholder="Horarios, tarifas, cómo trabaja…" value="${p?esc(p.notas||''):''}"/></div></div>
 <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer;margin-top:4px;"><input type="checkbox" id="pv-a" ${!p||p.activo!==false?'checked':''} style="width:16px;height:16px;"/>Proveedor activo (aparece al registrar gastos y mantenciones)</label>
 <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-success" onclick="guardarProveedor(${p?`'${esc(p.id)}'`:'null'})">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>${p?`<button class="btn btn-danger" style="margin-left:auto" onclick="eliminarProveedor('${esc(p.id)}')">Eliminar</button>`:''}</div></div></div>`;
}
function guardarProveedor(id){
 const nombre=document.getElementById('pv-n').value.trim();
 if(nombre.length<2){showToast('Ingresa el nombre del proveedor','error');return;}
 let rubro=document.getElementById('pv-r').value;
 if(rubro==='__nuevo'){rubro=document.getElementById('pv-rn').value.trim();if(!rubro){showToast('Escribe el nombre del rubro','error');return;}}
 const dup=proveedores().find(x=>String(x.id)!==String(id||'')&&String(x.nombre).toLowerCase()===nombre.toLowerCase());
 if(dup){showToast('Ya existe un proveedor con ese nombre','error');return;}
 const previo=id?proveedorPorId(id):null;
 const rec={id:id||db.ref('cbs4/proveedores').push().key,nombre,rubro,contacto:document.getElementById('pv-c').value.trim(),telefono:document.getElementById('pv-t').value.trim(),
  email:document.getElementById('pv-e').value.trim(),notas:document.getElementById('pv-no').value.trim(),valoracion:parseInt(document.getElementById('pv-v').value)||0,
  activo:document.getElementById('pv-a').checked,creado:previo?(previo.creado||Date.now()):Date.now()};
 if(!RUBROS_BASE.includes(rubro)&&!(appData.rubrosProveedor||[]).includes(rubro)){const l=(appData.rubrosProveedor||[]).concat([rubro]);appData.rubrosProveedor=l;savePath('rubrosProveedor',l);}
 appData.proveedores=id?proveedores().map(x=>String(x.id)===String(id)?rec:x):proveedores().concat([rec]);
 savePath('proveedores/'+rec.id,rec);
 closeModal();renderView();showToast(id?'Proveedor actualizado':'Proveedor agregado','success');
}
function eliminarProveedor(id){
 const p=proveedorPorId(id);if(!p)return;const rs=provResumen(id);
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:440px;">
 <div class="modal-title">Eliminar ${esc(p.nombre)}</div>
 <div style="font-size:13px;color:var(--text2);line-height:1.5">${rs.n?`Tiene <strong>${rs.n}</strong> trabajo${rs.n>1?'s':''} vinculado${rs.n>1?'s':''} (${fmt(rs.total)}). Si lo eliminas, esos gastos y mantenciones conservan su monto pero pierden el vínculo. <strong>Te recomiendo marcarlo como inactivo</strong> en vez de eliminarlo.`:'Se quitará del directorio. Esta acción no se puede deshacer.'}</div>
 <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-danger" onclick="confirmarEliminarProv('${esc(id)}')">Eliminar</button>${rs.n?`<button class="btn btn-outline" onclick="desactivarProv('${esc(id)}')">Marcar inactivo</button>`:''}<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
function desactivarProv(id){const p=proveedorPorId(id);if(!p)return;const rec={...p,activo:false};appData.proveedores=proveedores().map(x=>String(x.id)===String(id)?rec:x);savePath('proveedores/'+id,rec);closeModal();renderView();showToast('Proveedor marcado como inactivo','success');}
function confirmarEliminarProv(id){appData.proveedores=proveedores().filter(x=>String(x.id)!==String(id));savePath('proveedores/'+id,null);closeModal();renderView();showToast('Proveedor eliminado','success');}

/* ---------- historial ---------- */
function verHistorialProv(id){
 const p=proveedorPorId(id);if(!p)return;const mv=provMovimientos(id);const tot=mv.reduce((s,x)=>s+x.monto,0);
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px;">
 <div class="modal-title">🧾 ${esc(p.nombre)}</div><div style="font-size:12px;color:var(--text3);margin-bottom:10px">${esc(p.rubro||'')} · ${mv.length} trabajo${mv.length===1?'':'s'} · ${fmt(tot)}</div>
 ${mv.length?`<div class="table-wrap" style="max-height:340px;overflow:auto"><table><thead><tr><th>Período</th><th>Tipo</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead><tbody>${mv.map(x=>`<tr><td>${esc(formatPeriodo(x.periodo))}</td><td>${esc(x.t)}</td><td>${esc(x.desc)}</td><td style="text-align:right">${fmt(x.monto)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-txt">Sin gastos ni mantenciones vinculados. Al registrar un gasto o una mantención podrás elegir este proveedor.</div></div>'}
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
}

/* ---------- utilidades para otros formularios (gastos, mantenciones) ---------- */
function selectProveedor(pre,sel){
 const l=proveedores().filter(p=>p.activo!==false||String(p.id)===String(sel||'')).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
 return `<div class="form-row"><div><label class="fl">Proveedor (opcional)</label><select class="fi" id="${pre}-prov"><option value="">— Sin proveedor —</option>${l.map(p=>`<option value="${esc(p.id)}" ${String(p.id)===String(sel||'')?'selected':''}>${esc(p.nombre)}${p.rubro?' · '+esc(p.rubro):''}</option>`).join('')}</select></div></div>`;
}
function leerProveedor(pre){const el=document.getElementById(pre+'-prov');return el?el.value:'';}
function proveedorExtra(pre){const v=leerProveedor(pre);return v?{proveedorId:v}:{};}
