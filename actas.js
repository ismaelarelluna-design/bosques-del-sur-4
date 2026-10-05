/* ===========================================================================
   Actas y acuerdos — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   Datos (Firebase):
     cbs4/actas/<id>  {id,folio,anio,n,tipo,titulo,fecha,hora,lugar,convoca,
                       asistentes:[depId],total,orden:[texto],
                       acuerdos:[{id,texto,responsable,plazo,estado,cumplidoTs?,publicable,votacion?{f,c,a}}],
                       desarrollo,publicada,firmados:[{archivoRef,nombre,tipo,ts,por}],
                       creadoPor,ts,editadoPor?,tsEdit?}
     cbs4/actaContador/<anio>  (correlativo, transaccion)

   Privacidad (decision de diseño):
   - Lo PRIVADO vive solo en cbs4: lista nominal de asistentes, "desarrollo" y las
     fotos del acta firmada. Nada de eso se copia a cbs4_publico.
   - Lo PUBLICO (solo actas con publicada=true) es un resumen sin datos personales:
     datos de la reunion, asistencia en cifras, orden del dia y acuerdos marcados
     como publicables. Ver actaPublica() y construirPublico() en core.js.
   - Las fotos del acta firmada se guardan en cbs4_adjuntos y su referencia solo
     queda en cbs4/actas (jamas en el espejo publico).
   Funciones compartidas con compromisos.js: docFirmadosModal() (subir/ver fotos firmadas).
   =========================================================================== */
const ACTA_TIPOS={ordinaria:'Asamblea ordinaria',extraordinaria:'Asamblea extraordinaria',directiva:'Reunión de directiva'};
const ACTA_RESP=['Presidenta','Tesorera','Administrador','Comité de Administración','Comunidad'];
let actaEd=null,actaPdfActual=null;

/* ---------- utilidades ---------- */
function actaHoyISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function actaFechaLarga(iso){const p=String(iso||'').split('-');if(p.length<3||!p[1])return iso||'';return parseInt(p[2])+' de '+MESES[parseInt(p[1])-1].toLowerCase()+' de '+p[0];}
function actaFechaCorta(iso){const p=String(iso||'').split('-');return p.length<3?(iso||''):p[2]+'/'+p[1]+'/'+p[0];}
function actaNuevoId(p){return p+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function actaNorm(a){
 if(!a)return null;
 return {...a,asistentes:comoLista(a.asistentes),orden:comoLista(a.orden).map(String),
  acuerdos:comoLista(a.acuerdos).map(x=>({...x})),firmados:comoLista(a.firmados)};
}
function actasLista(){return comoListaConId(appData.actas).map(actaNorm);}
function actaPorId(id){return actasLista().find(a=>String(a.id)===String(id))||null;}
function actaAsistN(a){return a.asistentesN!=null?Number(a.asistentesN)||0:comoLista(a.asistentes).length;}
function actaTotal(a){return Number(a.total)||(appData.departamentos||[]).length||TOTAL_DEPTOS;}
function actaPct(a){const t=actaTotal(a);return t?Math.round(actaAsistN(a)/t*100):0;}
function actaTipoLabel(t){return ACTA_TIPOS[t]||ACTA_TIPOS.ordinaria;}
function actaPlazoInfo(a){
 if(!a.plazo)return {txt:'Sin plazo',cls:''};
 const h=actaHoyISO();
 if(a.estado==='cumplido')return {txt:actaFechaCorta(a.plazo),cls:''};
 if(a.plazo<h)return {txt:'Vencido '+actaFechaCorta(a.plazo),cls:'venc'};
 if(a.plazo===h)return {txt:'Vence hoy',cls:'hoy'};
 return {txt:'Hasta '+actaFechaCorta(a.plazo),cls:''};
}
function actaResultado(v){
 if(!v)return '';
 const f=Number(v.f)||0,c=Number(v.c)||0,ab=Number(v.a)||0;
 return 'A favor '+f+' · En contra '+c+' · Abstención '+ab+' — '+(f>c?'Aprobado':(f<c?'Rechazado':'Empate'));
}
function actaEstado(){if(!state.actas)state.actas={tab:'actas',q:'',anio:''};return state.actas;}

/* Resumen SIN datos personales que se publica en Transparencia. Acepta registros
   privados y tambien registros ya publicados (idempotente). */
function actaPublica(a){
 a=actaNorm(a);const cut=(s,n)=>String(s==null?'':s).slice(0,n);
 return {id:String(a.id),publicada:true,folio:cut(a.folio,30),tipo:ACTA_TIPOS[a.tipo]?a.tipo:'ordinaria',titulo:cut(a.titulo,200),
  fecha:cut(a.fecha,10),hora:cut(a.hora,5),lugar:cut(a.lugar,120),convoca:cut(a.convoca,120),
  asistentesN:actaAsistN(a),total:actaTotal(a),
  orden:a.orden.filter(x=>String(x).trim()).slice(0,20).map(x=>cut(x,300)),
  acuerdos:a.acuerdos.filter(x=>x&&x.publicable!==false&&String(x.texto||'').trim()).slice(0,30).map(x=>{
   const o={id:cut(x.id,40),texto:cut(x.texto,1500),responsable:cut(x.responsable,80),plazo:cut(x.plazo,10),estado:x.estado==='cumplido'?'cumplido':'pendiente',publicable:true};
   if(x.votacion)o.votacion={f:Number(x.votacion.f)||0,c:Number(x.votacion.c)||0,a:Number(x.votacion.a)||0};
   return o;})};
}
function actasPublicadas(){return actasLista().filter(a=>a.publicada===true).sort((x,y)=>String(y.fecha).localeCompare(String(x.fecha)));}

/* ===========================================================================
   Vista principal (administracion)
   =========================================================================== */
function acuerdosPendientes(){
 const out=[];
 actasLista().forEach(a=>a.acuerdos.forEach(x=>{if(x&&x.estado!=='cumplido'&&String(x.texto||'').trim())out.push({a,x});}));
 return out.sort((p,q)=>{const pp=p.x.plazo||'9999',qq=q.x.plazo||'9999';return pp.localeCompare(qq);});
}
/* Aviso del menú: acuerdos pendientes cuyo plazo ya venció */
function acuerdosVencidosCount(){const h=actaHoyISO();return acuerdosPendientes().filter(p=>p.x.plazo&&p.x.plazo<h).length;}
function vActas(){
 const e=actaEstado(),l=actasLista(),pend=acuerdosPendientes();
 const venc=pend.filter(p=>p.x.plazo&&p.x.plazo<actaHoyISO()).length;
 const tabs=`<div class="seg">
  <button class="seg-btn ${e.tab==='actas'?'on':''}" onclick="setActas({tab:'actas'})">📋 Actas <span class="seg-n">${l.length}</span></button>
  <button class="seg-btn ${e.tab==='pend'?'on':''}" onclick="setActas({tab:'pend'})">✅ Acuerdos pendientes <span class="seg-n">${pend.length}</span></button>
  <button class="seg-btn ${e.tab==='conv'?'on':''}" onclick="setActas({tab:'conv'})">📣 Convocatorias <span class="seg-n">${typeof convLista==='function'?convLista().length:0}</span></button></div>`;
 return `<div class="page-title">Actas y acuerdos</div>
 <div class="page-sub">Registro de reuniones y asambleas: asistencia, orden del día, acuerdos, PDF con folio y respaldo del acta firmada</div>
 <div class="stats-grid mant-stats">
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">📋</span>Actas</div><div class="stat-value" data-plain>${l.length}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">🌐</span>Publicadas</div><div class="stat-value" data-plain style="color:var(--green)">${l.filter(a=>a.publicada).length}</div></div>
  <div class="stat-card"><div class="stat-label"><span class="stat-icon">⏳</span>Acuerdos pendientes</div><div class="stat-value" data-plain style="color:${venc?'var(--danger)':'var(--text)'}">${pend.length}</div>${venc?`<div class="stat-meta" style="color:var(--danger)">${venc} vencido${venc>1?'s':''}</div>`:''}</div>
 </div>
 <div class="toolbar">${tabs}${e.tab==='actas'?`<div class="buscador"><span class="buscador-ico">🔎</span><input class="fi buscador-input" placeholder="Buscar acta, folio o acuerdo…" value="${esc(e.q)}" oninput="buscarActas(this.value)"/></div>`:''}
  <div class="toolbar-sep"></div>${e.tab==='conv'?'<button class="btn btn-primary" onclick="openConvocatoria(null)">➕ Nueva convocatoria</button>':'<button class="btn btn-primary" onclick="openActa(null)">➕ Nueva acta</button>'}</div>
 <div id="actas-cont">${e.tab==='actas'?htmlActasTarjetas():(e.tab==='conv'?htmlConvocatorias():htmlActasPendientes())}</div>`;
}
function setActas(p){Object.assign(actaEstado(),p);renderView();}
function buscarActas(v){actaEstado().q=v;const el=document.getElementById('actas-cont');if(el)el.innerHTML=htmlActasTarjetas();}
function htmlActasTarjetas(){
 const e=actaEstado(),q=(e.q||'').toLowerCase().trim();
 const l=actasLista().sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))).filter(a=>!q||
  (a.folio+' '+a.titulo+' '+actaTipoLabel(a.tipo)+' '+a.acuerdos.map(x=>x.texto).join(' ')).toLowerCase().includes(q));
 if(!l.length)return `<div class="card"><div class="empty-state"><div class="empty-ico">📋</div><div class="empty-txt">${q?'Sin resultados':'Aún no hay actas registradas. Crea la primera con «Nueva acta».'}</div></div></div>`;
 return '<div class="comp-grid">'+l.map(a=>{
  const p=a.acuerdos.filter(x=>x.estado!=='cumplido').length;const d=String(a.fecha||'').split('-');
  return `<div class="comp-card acta-card ${a.publicada?'pub':'borr'}">
   <div class="comp-card-top"><div class="acta-fecha"><b>${esc(d[2]||'')}</b><span>${esc(d[1]?MESES[parseInt(d[1])-1].slice(0,3):'')}</span></div>
    <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--text);line-height:1.25">${esc(a.titulo)}</div>
     <div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(a.folio)} · ${esc(actaTipoLabel(a.tipo))}</div></div>
    <span class="cert-chip ${a.publicada?'aldia':'borrador'}">${a.publicada?'Publicada':'Borrador'}</span></div>
   <div class="acta-meta"><span title="Asistencia">👥 ${actaAsistN(a)}/${actaTotal(a)}</span><span>📌 ${a.acuerdos.length} acuerdo${a.acuerdos.length===1?'':'s'}${p?` · <b style="color:var(--warning,#B45309)">${p} pendiente${p>1?'s':''}</b>`:''}</span>
    <span title="Acta firmada">${a.firmados.length?'📎 firmada ('+a.firmados.length+')':'<i style="opacity:.7">sin acta firmada</i>'}</span></div>
   <div class="acta-acc">
    <button class="btn btn-ghost btn-sm" onclick="previsualizarActa('${esc(a.id)}',false)">👁 Previsualizar</button>
    <button class="btn btn-ghost btn-sm" onclick="openActa('${esc(a.id)}')">✏️ Editar</button>
    <button class="btn btn-ghost btn-sm" onclick="docFirmadosModal('actas','${esc(a.id)}')">📸 Acta firmada</button>
    <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="openBorrarActa('${esc(a.id)}')">🗑 Borrar</button></div></div>`;}).join('')+'</div>';
}
function htmlActasPendientes(){
 const l=acuerdosPendientes();
 if(!l.length)return '<div class="card"><div class="empty-state"><div class="empty-ico">🎉</div><div class="empty-txt">No hay acuerdos pendientes</div></div></div>';
 return '<div class="card">'+l.map(({a,x})=>{const pi=actaPlazoInfo(x);
  return `<div class="acta-pend">
   <div style="flex:1;min-width:0"><div class="acta-pend-t">${esc(x.texto)}</div>
    <div style="font-size:11px;color:var(--text3);margin-top:3px">${esc(a.folio)} · ${esc(actaFechaCorta(a.fecha))}${x.responsable?' · Resp.: '+esc(x.responsable):''}${x.publicable===false?' · interno':''}</div></div>
   <span class="acta-plazo ${pi.cls}">${esc(pi.txt)}</span>
   <button class="btn btn-success btn-sm" onclick="actaMarcarCumplido('${esc(a.id)}','${esc(x.id)}')">✓ Cumplido</button>
   <button class="btn btn-ghost btn-sm" onclick="previsualizarActa('${esc(a.id)}',false)">Ver acta</button></div>`;}).join('')+'</div>';
}
function actaGuardarRec(rec){
 appData.actas=actasLista().filter(x=>String(x.id)!==String(rec.id)).concat([rec]);
 return savePath('actas/'+rec.id,rec);
}
function actaMarcarCumplido(aid,xid,volver){
 const a=actaPorId(aid);if(!a)return;
 a.acuerdos=a.acuerdos.map(x=>String(x.id)===String(xid)?{...x,estado:'cumplido',cumplidoTs:Date.now()}:x);
 actaGuardarRec(a);showToast('Acuerdo marcado como cumplido ✓','success');
 if(volver){previsualizarActa(aid,false);}else renderView();
}
function actaReabrir(aid,xid){
 const a=actaPorId(aid);if(!a)return;
 a.acuerdos=a.acuerdos.map(x=>{if(String(x.id)!==String(xid))return x;const y={...x,estado:'pendiente'};delete y.cumplidoTs;return y;});
 actaGuardarRec(a);previsualizarActa(aid,false);
}
function actaTogglePublicada(id){
 const a=actaPorId(id);if(!a)return;
 const nueva=!a.publicada;
 if(nueva&&!a.acuerdos.some(x=>x.publicable!==false)&&!a.orden.some(x=>String(x).trim()))showToast('Se publicará solo con los datos de la reunión (no tiene orden del día ni acuerdos publicables)','');
 a.publicada=nueva;if(nueva)a.tsPublicada=Date.now();
 actaGuardarRec(a);showToast(nueva?'Acta publicada en Transparencia ✓':'Acta retirada de Transparencia','success');
 previsualizarActa(id,false);
}

/* ===========================================================================
   Editor (formulario)
   =========================================================================== */
function openActa(id,pre){
 const a=id?actaPorId(id):null;if(id&&!a)return;
 actaEd=a?JSON.parse(JSON.stringify(a)):{id:null,tipo:'ordinaria',titulo:'',fecha:actaHoyISO(),hora:'19:00',lugar:'',convoca:'Comité de Administración',
  asistentes:[],orden:[''],acuerdos:[],desarrollo:'',publicada:false,firmados:[]};
 if(!a&&pre)Object.assign(actaEd,pre);
 if(!actaEd.orden.length)actaEd.orden=[''];
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open"><div class="modal acta-modal">
 <div class="modal-title">${a?'✏️ Editar acta '+esc(a.folio):'📋 Nueva acta'}</div>
 <div class="ac-sec"><span>1</span>Datos de la reunión</div>
 <div class="form-row form-row-2"><div><label class="fl">Tipo</label><select class="fi" id="ac-tipo">${Object.keys(ACTA_TIPOS).map(k=>`<option value="${k}" ${actaEd.tipo===k?'selected':''}>${esc(ACTA_TIPOS[k])}</option>`).join('')}</select></div>
  <div><label class="fl">Título (opcional)</label><input class="fi" id="ac-titulo" maxlength="200" value="${esc(actaEd.titulo)}" placeholder="Si lo dejas vacío se genera solo"/></div></div>
 <div class="form-row ac-row3"><div><label class="fl">Fecha</label><input class="fi" id="ac-fecha" type="date" value="${esc(actaEd.fecha)}"/></div>
  <div><label class="fl">Hora</label><input class="fi" id="ac-hora" type="time" value="${esc(actaEd.hora)}"/></div>
  <div><label class="fl">Lugar</label><input class="fi" id="ac-lugar" maxlength="120" value="${esc(actaEd.lugar)}" placeholder="Ej: Sede social"/></div></div>
 <div class="form-row"><div><label class="fl">Convocada por</label><input class="fi" id="ac-convoca" maxlength="120" value="${esc(actaEd.convoca)}"/></div></div>
 <div class="ac-sec"><span>2</span>Asistencia <em id="ac-asist-n"></em></div>
 <div class="ac-asist-tools"><button type="button" class="btn btn-ghost btn-sm" onclick="actaAsistTodos(true)">Marcar todos</button><button type="button" class="btn btn-ghost btn-sm" onclick="actaAsistTodos(false)">Limpiar</button><span style="font-size:11px;color:var(--text3)">Marca las unidades presentes (o representadas). La lista de nombres no se publica: solo la cifra.</span></div>
 <div id="ac-asist" class="ac-asist">${actaHtmlAsist()}</div>
 <div class="ac-sec"><span>3</span>Orden del día</div>
 <div id="ac-orden">${actaHtmlOrden()}</div>
 <button type="button" class="btn btn-ghost btn-sm" onclick="actaAgregarOrden()">➕ Agregar punto</button>
 <div class="ac-sec"><span>4</span>Acuerdos <em>cada punto que se acuerde en la reunión</em></div>
 <div id="ac-acuerdos">${actaHtmlAcuerdos()}</div>
 <button type="button" class="btn btn-primary btn-sm" onclick="actaAgregarAcuerdo()">➕ Agregar acuerdo</button>
 <div class="ac-sec"><span>5</span>Desarrollo y observaciones <em>solo directiva · no se publica</em></div>
 <textarea class="fi" id="ac-desarrollo" rows="4" maxlength="6000" placeholder="Resumen de lo conversado, incidencias, quórum, etc.">${esc(actaEd.desarrollo)}</textarea>
 <div class="ac-pub"><label><input type="checkbox" id="ac-publicada" ${actaEd.publicada?'checked':''}/> <b>Publicar en Transparencia</b></label>
  <div style="font-size:11px;color:var(--text3);margin-top:3px">Los vecinos verán: datos de la reunión, asistencia en cifras, orden del día y solo los acuerdos marcados como «publicables». Nunca el desarrollo, los nombres de asistentes ni las fotos firmadas.</div></div>
 <datalist id="ac-resp">${ACTA_RESP.map(r=>`<option value="${esc(r)}">`).join('')}</datalist>
 <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-success" id="ac-save" onclick="guardarActa()">Guardar acta</button><button class="btn btn-ghost" onclick="actaCancelar()">Cancelar</button></div>
 <div style="font-size:11px;color:var(--text3);margin-top:8px">Tras guardar podrás generar el PDF, imprimirlo para las firmas y subir la foto del acta firmada.</div>
 </div></div>`;
 actaContarAs();
}
function actaCancelar(){if(!confirm('¿Cerrar sin guardar los cambios?'))return;actaEd=null;closeModal();}
function actaHtmlAsist(){
 const sel=new Set((actaEd.asistentes||[]).map(String));
 return (appData.departamentos||[]).slice().sort((a,b)=>String(a.numero).localeCompare(String(b.numero),undefined,{numeric:true})).map(d=>
  `<label class="ac-as-it"><input type="checkbox" class="ac-as" value="${esc(d.id)}" ${sel.has(String(d.id))?'checked':''} onchange="actaContarAs()"/><b>${esc(d.numero)}</b><span>${esc(d.representante||'—')}</span></label>`).join('');
}
function actaContarAs(){
 const n=document.querySelectorAll('#ac-asist .ac-as:checked').length,t=(appData.departamentos||[]).length||TOTAL_DEPTOS;
 const el=document.getElementById('ac-asist-n');if(el)el.textContent=n+' de '+t+' unidades ('+(t?Math.round(n/t*100):0)+'%)';
}
function actaAsistTodos(v){document.querySelectorAll('#ac-asist .ac-as').forEach(c=>{c.checked=!!v;});actaContarAs();}
function actaHtmlOrden(){
 return actaEd.orden.map((t,i)=>`<div class="ac-ord-row"><span class="ac-n">${i+1}</span><input class="fi ac-ord" maxlength="300" value="${esc(t)}" placeholder="Punto de la tabla"/><button type="button" class="btn btn-ghost btn-sm" onclick="actaQuitarOrden(${i})" title="Quitar">✕</button></div>`).join('');
}
function actaHtmlAcuerdos(){
 if(!actaEd.acuerdos.length)return '<div style="font-size:12px;color:var(--text3);padding:6px 0 10px">Aún no hay acuerdos. Agrégalos a medida que se vayan tomando.</div>';
 return actaEd.acuerdos.map((x,i)=>{const v=x.votacion;return `<div class="ac-acu" data-id="${esc(x.id)}">
  <div class="ac-acu-top"><span class="ac-n">Acuerdo ${i+1}</span><button type="button" class="btn btn-ghost btn-sm" onclick="actaQuitarAcuerdo(${i})">✕ Quitar</button></div>
  <textarea class="fi aa-t" rows="3" maxlength="1500" placeholder="¿Qué se acordó?">${esc(x.texto||'')}</textarea>
  <div class="ac-row3" style="margin-top:8px"><div><label class="fl">Responsable</label><input class="fi aa-r" list="ac-resp" maxlength="80" value="${esc(x.responsable||'')}"/></div>
   <div><label class="fl">Plazo</label><input class="fi aa-p" type="date" value="${esc(x.plazo||'')}"/></div>
   <div><label class="fl">Estado</label><select class="fi aa-e"><option value="pendiente" ${x.estado!=='cumplido'?'selected':''}>Pendiente</option><option value="cumplido" ${x.estado==='cumplido'?'selected':''}>Cumplido</option></select></div></div>
  <div class="ac-chk"><label><input type="checkbox" class="aa-pub" ${x.publicable!==false?'checked':''}/> Publicable en Transparencia</label>
   <label><input type="checkbox" class="aa-v" ${v?'checked':''} onchange="actaToggleVoto(this)"/> Registrar votación</label></div>
  <div class="aa-vbox" style="display:${v?'grid':'none'}"><div><label class="fl">A favor</label><input class="fi aa-f" type="number" min="0" max="999" value="${v?Number(v.f)||0:0}"/></div><div><label class="fl">En contra</label><input class="fi aa-c" type="number" min="0" max="999" value="${v?Number(v.c)||0:0}"/></div><div><label class="fl">Abstención</label><input class="fi aa-a" type="number" min="0" max="999" value="${v?Number(v.a)||0:0}"/></div></div>
 </div>`;}).join('');
}
function actaToggleVoto(cb){const box=cb.closest('.ac-acu').querySelector('.aa-vbox');box.style.display=cb.checked?'grid':'none';}
function actaLeer(){
 const g=id=>{const el=document.getElementById(id);return el?el.value:'';},e=actaEd;
 e.tipo=g('ac-tipo');e.titulo=g('ac-titulo').trim();e.fecha=g('ac-fecha');e.hora=g('ac-hora');e.lugar=g('ac-lugar').trim();e.convoca=g('ac-convoca').trim();
 e.desarrollo=g('ac-desarrollo');e.publicada=!!(document.getElementById('ac-publicada')||{}).checked;
 e.orden=[...document.querySelectorAll('#ac-orden .ac-ord')].map(i=>i.value);
 const deps=appData.departamentos||[];
 e.asistentes=[...document.querySelectorAll('#ac-asist .ac-as:checked')].map(i=>{const d=deps.find(x=>String(x.id)===i.value);return d?d.id:i.value;});
 e.acuerdos=[...document.querySelectorAll('#ac-acuerdos .ac-acu')].map(el=>{
  const q=s=>el.querySelector(s),o={id:el.dataset.id,texto:q('.aa-t').value,responsable:q('.aa-r').value.trim(),plazo:q('.aa-p').value,
   estado:q('.aa-e').value==='cumplido'?'cumplido':'pendiente',publicable:q('.aa-pub').checked};
  const prev=(e.acuerdos||[]).find(x=>String(x.id)===String(o.id));if(prev&&prev.cumplidoTs&&o.estado==='cumplido')o.cumplidoTs=prev.cumplidoTs;
  if(q('.aa-v').checked)o.votacion={f:Math.max(0,parseInt(q('.aa-f').value)||0),c:Math.max(0,parseInt(q('.aa-c').value)||0),a:Math.max(0,parseInt(q('.aa-a').value)||0)};
  return o;});
}
function actaAgregarOrden(){actaLeer();actaEd.orden.push('');document.getElementById('ac-orden').innerHTML=actaHtmlOrden();const l=document.querySelectorAll('#ac-orden .ac-ord');if(l.length)l[l.length-1].focus();}
function actaQuitarOrden(i){actaLeer();actaEd.orden.splice(i,1);if(!actaEd.orden.length)actaEd.orden=[''];document.getElementById('ac-orden').innerHTML=actaHtmlOrden();}
function actaAgregarAcuerdo(){actaLeer();actaEd.acuerdos.push({id:actaNuevoId('a'),texto:'',responsable:'',plazo:'',estado:'pendiente',publicable:true});document.getElementById('ac-acuerdos').innerHTML=actaHtmlAcuerdos();const l=document.querySelectorAll('#ac-acuerdos .aa-t');if(l.length)l[l.length-1].focus();}
function actaQuitarAcuerdo(i){
 actaLeer();const x=actaEd.acuerdos[i];
 if(x&&String(x.texto||'').trim().length>3&&!confirm('¿Quitar este acuerdo?'))return;
 actaEd.acuerdos.splice(i,1);document.getElementById('ac-acuerdos').innerHTML=actaHtmlAcuerdos();
}
async function guardarActa(){
 actaLeer();const e=actaEd;
 if(!e.fecha){showToast('Indica la fecha de la reunión','error');return;}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha)){showToast('Fecha inválida','error');return;}
 const acu=e.acuerdos.filter(x=>String(x.texto||'').trim());
 const vac=e.acuerdos.length-acu.length;
 if(vac&&!confirm(vac+' acuerdo'+(vac>1?'s':'')+' sin texto se descartará'+(vac>1?'n':'')+'. ¿Continuar?'))return;
 const btn=document.getElementById('ac-save');if(btn){btn.disabled=true;btn.textContent='Guardando…';}
 try{
  const prev=e.id?actaPorId(e.id):null,u=checkSession()||'';
  let id=e.id,folio=prev?prev.folio:'',n=prev?prev.n:0,anio=prev?prev.anio:parseInt(e.fecha.slice(0,4));
  if(!prev){
   anio=parseInt(e.fecha.slice(0,4));
   const maxN=actasLista().filter(a=>a.anio===anio).reduce((m,a)=>Math.max(m,parseInt(a.n)||0),0);
   const tr=await db.ref('cbs4/actaContador/'+anio).transaction(v=>Math.max(parseInt(v)||0,maxN)+1);
   if(!tr.committed)throw new Error('No se pudo asignar folio');
   n=tr.snapshot.val();folio='ACT-'+anio+'-'+String(n).padStart(3,'0');id=db.ref('cbs4/actas').push().key;
  }
  const titulo=e.titulo||(actaTipoLabel(e.tipo)+' — '+actaFechaLarga(e.fecha));
  const rec={id,folio,anio,n,tipo:e.tipo,titulo,fecha:e.fecha,hora:e.hora,lugar:e.lugar,convoca:e.convoca,
   asistentes:e.asistentes,total:(appData.departamentos||[]).length||TOTAL_DEPTOS,orden:e.orden.map(s=>s.trim()).filter(Boolean),acuerdos:acu,
   desarrollo:e.desarrollo,publicada:!!e.publicada,firmados:prev?prev.firmados:[],convocatoriaId:(prev?prev.convocatoriaId:e.convocatoriaId)||'',
   creadoPor:prev?prev.creadoPor:u,ts:prev?prev.ts:Date.now()};
  if(prev){rec.editadoPor=u;rec.tsEdit=Date.now();}
  if(rec.publicada)rec.tsPublicada=(prev&&prev.tsPublicada)||Date.now();
  await actaGuardarRec(rec);
  if(rec.convocatoriaId&&typeof convVincularActa==='function'){try{await convVincularActa(rec.convocatoriaId,rec.id);}catch(x){console.error(x);}}
  actaEd=null;closeModal();renderView();showToast('Acta '+folio+' guardada ✓','success');
 }catch(err){console.error(err);showToast('No se pudo guardar: '+err.message,'error');if(btn){btn.disabled=false;btn.textContent='Guardar acta';}}
}

/* ---------- borrar ---------- */
function openBorrarActa(id){
 const a=actaPorId(id);if(!a)return;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:480px">
 <div class="modal-title">🗑 Borrar acta ${esc(a.folio)}</div>
 <div style="font-size:13px;color:var(--text2);line-height:1.6"><b>${esc(a.titulo)}</b> (${esc(actaFechaLarga(a.fecha))}) se eliminará junto con sus acuerdos${a.firmados.length?` y las <b>${a.firmados.length} foto(s) del acta firmada</b>`:''}. Si estaba publicada, dejará de verse en Transparencia.</div>
 <div style="font-size:12px;color:var(--danger);margin-top:10px">El folio no se reutiliza. El borrado queda anotado en el Registro de cambios y el respaldo automático permite recuperar los datos (no las fotos si pasan días).</div>
 <div style="display:flex;gap:10px;margin-top:16px"><button class="btn btn-danger" onclick="confirmarBorrarActa('${esc(id)}')">Sí, borrar acta</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
async function confirmarBorrarActa(id){
 const a=actaPorId(id);if(!a)return;
 appData.actas=actasLista().filter(x=>String(x.id)!==String(id));
 await savePath('actas/'+id,null);
 a.firmados.forEach(f=>{try{borrarAdjunto(f.archivoRef);}catch(e){}});
 closeModal();renderView();showToast('Acta eliminada','success');
}

/* ===========================================================================
   Previsualizacion (misma pantalla para directiva y para vecinos)
   =========================================================================== */
function htmlActaDoc(a,pub){
 const dep=(appData.departamentos||[]);
 const ord=a.orden.filter(x=>String(x).trim());
 const acus=pub?a.acuerdos.filter(x=>x.publicable!==false):a.acuerdos;
 return `<div class="acta-doc">
  <div class="acta-doc-top"><div><div class="acta-doc-folio">${esc(a.folio)}</div><div class="acta-doc-t">${esc(a.titulo)}</div></div>
   <span class="cert-chip ${a.publicada||pub?'aldia':'borrador'}">${pub?'Publicada':(a.publicada?'Publicada':'Borrador')}</span></div>
  <div class="acta-datos">
   <div><span>Tipo</span><b>${esc(actaTipoLabel(a.tipo))}</b></div>
   <div><span>Fecha y hora</span><b>${esc(actaFechaLarga(a.fecha))}${a.hora?' · '+esc(a.hora)+' h':''}</b></div>
   <div><span>Lugar</span><b>${esc(a.lugar||'—')}</b></div>
   <div><span>Convocada por</span><b>${esc(a.convoca||'—')}</b></div>
   <div><span>Asistencia</span><b>${actaAsistN(a)} de ${actaTotal(a)} unidades (${actaPct(a)}%)</b></div></div>
  ${ord.length?`<div class="acta-sec">Orden del día</div><ol class="acta-ol">${ord.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>`:''}
  <div class="acta-sec">Acuerdos${acus.length?' ('+acus.length+')':''}</div>
  ${acus.length?acus.map((x,i)=>{const pi=actaPlazoInfo(x);return `<div class="acta-acuerdo ${x.estado==='cumplido'?'ok':''}">
    <div class="acta-ac-top"><b>Acuerdo ${i+1}</b><span>${x.estado==='cumplido'?'<span class="cert-chip aldia">Cumplido</span>':'<span class="cert-chip pend">Pendiente</span>'}</span></div>
    <div class="acta-ac-txt">${esc(x.texto)}</div>
    <div class="acta-ac-meta">${x.responsable?'Responsable: <b>'+esc(x.responsable)+'</b>':''}${x.plazo?' · Plazo: <b class="'+pi.cls+'">'+esc(pi.txt.replace('Hasta ',''))+'</b>':''}${!pub&&x.publicable===false?' · <i>interno (no se publica)</i>':''}</div>
    ${x.votacion?`<div class="acta-ac-meta">🗳 ${esc(actaResultado(x.votacion))}</div>`:''}
    ${!pub?`<div style="margin-top:6px">${x.estado==='cumplido'?`<button class="btn btn-ghost btn-sm" onclick="actaReabrir('${esc(a.id)}','${esc(x.id)}')">↺ Reabrir</button>`:`<button class="btn btn-success btn-sm" onclick="actaMarcarCumplido('${esc(a.id)}','${esc(x.id)}',true)">✓ Marcar cumplido</button>`}</div>`:''}</div>`;}).join(''):'<div style="font-size:12px;color:var(--text3)">Sin acuerdos registrados.</div>'}
  ${!pub&&a.desarrollo?`<div class="acta-sec">Desarrollo y observaciones <em>(interno)</em></div><div class="acta-desarrollo">${esc(a.desarrollo)}</div>`:''}
  ${!pub?`<div class="acta-sec">Asistentes <em>(interno)</em></div><div style="font-size:12px;color:var(--text2);line-height:1.7">${a.asistentes.length?a.asistentes.map(id=>{const d=dep.find(x=>String(x.id)===String(id));return esc(d?'Depto '+d.numero:'#'+id);}).join(' · '):'Sin asistentes registrados.'}</div>`:''}
 </div>`;
}
function previsualizarActa(id,pub){
 let a=actaPorId(id);if(!a)return;
 const publico=!!pub||state.isTransparencia;
 if(publico)a=actaNorm(actaPublica(a));
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal acta-modal">
  ${htmlActaDoc(a,publico)}
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
   <button class="btn btn-primary" onclick="actaVerPDF('${esc(id)}',${publico})">📄 Ver / descargar PDF</button>
   ${publico?'':`<button class="btn btn-ghost" onclick="openActa('${esc(id)}')">✏️ Editar</button><button class="btn btn-ghost" onclick="docFirmadosModal('actas','${esc(id)}')">📸 Acta firmada${a.firmados.length?' ('+a.firmados.length+')':''}</button>
   <button class="btn ${a.publicada?'btn-ghost':'btn-success'}" onclick="actaTogglePublicada('${esc(id)}')">${a.publicada?'🚫 Retirar de Transparencia':'🌐 Publicar en Transparencia'}</button>`}
   <button class="btn btn-ghost" onclick="closeModal();renderView()">Cerrar</button></div></div></div>`;
}

/* ===========================================================================
   PDF del acta
   =========================================================================== */
function pdfFirmasX(c,items){
 pdfAsegurar(c,80);c.y+=36;const sw=(PDF_W-PDF_M*2)/items.length;
 items.forEach((r,i)=>{const cx=PDF_M+sw*i+sw/2;pdfLinea(c,cx-sw/2+16,cx+sw/2-16,c.y,'#9CA3AF',0.8);
  pdfTexto(c,r[0],{x:cx-c.B.widthOfTextAtSize(pdfSan(r[0]),9.5)/2,size:9.5,font:c.B,color:'#374151',y:c.y+14});
  if(r[1])pdfTexto(c,r[1],{x:cx-c.F.widthOfTextAtSize(pdfSan(r[1]),8)/2,size:8,color:PDF_COL.gris,y:c.y+26});});
 c.y+=34;
}
function pdfAcuerdoBloque(c,i,x,pub){
 const w=PDF_W-PDF_M*2-14,ls=pdfLineas(c,x.texto||'',{size:10,w});
 pdfAsegurar(c,30+Math.min(ls.length,3)*14.5+30);
 const ok=x.estado==='cumplido';
 pdfRect(c,PDF_M,c.y,2.5,16,ok?PDF_COL.verde:PDF_COL.marca2);
 pdfTexto(c,'Acuerdo N° '+(i+1),{x:PDF_M+9,size:10,font:c.B,color:PDF_COL.marca,y:c.y+12});
 pdfTexto(c,ok?'CUMPLIDO':'PENDIENTE',{size:8.5,font:c.B,color:ok?PDF_COL.verde:'#B45309',align:'right',y:c.y+12});
 c.y+=22;
 ls.forEach((l,k)=>{pdfAsegurar(c,15);c.y+=14.5;pdfTexto(c,l,{x:PDF_M+14,size:10,color:'#1F2937',just:k<ls.length-1?w:0});});
 const meta=[x.responsable?'Responsable: '+x.responsable:'',x.plazo?'Plazo: '+actaFechaCorta(x.plazo):'',(!pub&&x.publicable===false)?'Acuerdo interno (no publicable)':''].filter(Boolean).join('   ·   ');
 if(meta){pdfAsegurar(c,16);c.y+=15;pdfTexto(c,meta,{x:PDF_M+14,size:8.8,color:PDF_COL.gris});}
 if(x.votacion){pdfAsegurar(c,16);c.y+=14;pdfTexto(c,'Votación: '+actaResultado(x.votacion),{x:PDF_M+14,size:8.8,font:c.B,color:'#374151'});}
 c.y+=8;pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,'#E5E7EB',0.6);c.y+=10;
}
async function pdfActa(rec,pub){
 if(!pdfListo())throw new Error('Librería PDF no disponible');
 const a=actaNorm(rec),c=await pdfNuevo('Acta de Reunión',a.folio);
 pdfTexto(c,'Folio N° '+a.folio,{size:12,font:c.B,color:PDF_COL.marca});
 pdfTexto(c,'Reunión del '+actaFechaLarga(a.fecha),{size:9.5,color:PDF_COL.gris,align:'right'});
 c.y+=10;pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,PDF_COL.borde,0.8);c.y+=22;
 pdfParrafo(c,a.titulo,{size:15,font:c.B,color:PDF_COL.marca,lh:19,despues:10,justify:false});
 pdfFicha(c,[['Tipo de reunión',actaTipoLabel(a.tipo)],['Fecha y hora',actaFechaLarga(a.fecha)+(a.hora?' · '+a.hora+' h':'')],['Lugar',a.lugar||'—'],['Convocada por',a.convoca||'—'],
  ['Asistencia',actaAsistN(a)+' de '+actaTotal(a)+' unidades ('+actaPct(a)+'%)']]);
 const ord=a.orden.filter(x=>String(x).trim());
 if(ord.length){pdfSeccion(c,'1. Orden del día');ord.forEach((t,i)=>{pdfParrafo(c,(i+1)+'.  '+t,{size:10,x:PDF_M+8,w:PDF_W-PDF_M*2-8,despues:3,justify:false});});c.y+=4;}
 const acus=(pub?a.acuerdos.filter(x=>x.publicable!==false):a.acuerdos).filter(x=>String(x.texto||'').trim());
 pdfSeccion(c,(ord.length?'2':'1')+'. Acuerdos adoptados');
 if(acus.length)acus.forEach((x,i)=>pdfAcuerdoBloque(c,i,x,pub));
 else pdfParrafo(c,'No se registraron acuerdos'+(pub?' publicables':'')+' en esta reunión.',{size:10,color:'#374151',justify:false});
 if(!pub&&String(a.desarrollo||'').trim()){
  pdfSeccion(c,(ord.length?'3':'2')+'. Desarrollo y observaciones');
  String(a.desarrollo).split(/\n+/).forEach(p=>{if(p.trim())pdfParrafo(c,p.trim(),{size:10,lh:14.5,despues:5});});
 }
 if(pub){
  c.y+=6;pdfNotaCaja(c,'VERSIÓN INFORMATIVA','Resumen publicado en Transparencia para los residentes. Contiene los datos de la reunión, la asistencia en cifras, el orden del día y los acuerdos publicables. El acta con las firmas de los asistentes se conserva en el archivo del Comité de Administración.','#0891B2');
 }else{
  /* hoja de asistencia y firmas: se imprime, los vecinos firman y se sube la foto */
  pdfPagina(c);pdfSeccion(c,'Registro de asistencia y firmas');
  pdfParrafo(c,'Los asistentes firman en la columna correspondiente. Luego de la reunión, fotografíe esta hoja y súbala en «Acta firmada» de la aplicación.',{size:9,font:c.I,color:PDF_COL.gris,despues:6,justify:false});
  const total=PDF_W-PDF_M*2,cols=[34,52,170,52,total-34-52-170-52],rh=24;
  const cab=()=>{pdfAsegurar(c,rh*2);pdfRect(c,PDF_M,c.y,total,rh,PDF_COL.marca);let x=PDF_M;['N°','Depto','Representante','Asiste','Firma'].forEach((t,j)=>{pdfTexto(c,t,{x:x+8,size:8.5,font:c.B,color:'#FFFFFF',y:c.y+15.5});x+=cols[j];});c.y+=rh;};
  cab();const sel=new Set(a.asistentes.map(String));
  (appData.departamentos||[]).slice().sort((p,q)=>String(p.numero).localeCompare(String(q.numero),undefined,{numeric:true})).forEach((d,i)=>{
   if(c.y+rh>PDF_H-70){pdfPagina(c);cab();}
   if(i%2===0)pdfRect(c,PDF_M,c.y,total,rh,'#F9FAFB');
   let x=PDF_M;[String(i+1),String(d.numero),String(d.representante||'—').slice(0,34),sel.has(String(d.id))?'Sí':'—',''].forEach((t,j)=>{pdfTexto(c,t,{x:x+8,size:9.3,color:PDF_COL.texto,y:c.y+15.5,font:(j===3&&t==='Sí')?c.B:c.F});x+=cols[j];});
   pdfLinea(c,PDF_M+total-cols[4]+6,PDF_M+total-8,c.y+rh-5,'#9CA3AF',0.6);
   pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y+rh,'#E5E7EB',0.5);c.y+=rh;});
  c.y+=6;pdfParrafo(c,'Asistencia registrada: '+actaAsistN(a)+' de '+actaTotal(a)+' unidades ('+actaPct(a)+'%).',{size:9.5,font:c.B,color:'#374151',justify:false});
  pdfFirmasX(c,[['Presidenta','Comité de Administración'],['Tesorera','Comité de Administración'],['Administrador','Comité de Administración']]);
 }
 pdfCerrar(c,'Acta de Reunión');
 return await pdfBytes(c);
}
function actaNombrePDF(a,pub){return 'Acta '+a.folio+(pub?' (publica)':'')+'.pdf';}
async function actaVerPDF(id,pub){
 let a=actaPorId(id);if(!a)return;
 const publico=!!pub||state.isTransparencia;
 if(publico)a=actaNorm(actaPublica(a));
 let bytes;
 try{bytes=await pdfActa(a,publico);}catch(e){console.error(e);showToast('No se pudo generar el PDF: '+e.message,'error');return;}
 if(actaPdfActual&&actaPdfActual.url)URL.revokeObjectURL(actaPdfActual.url);
 actaPdfActual={bytes,nombre:actaNombrePDF(a,publico),url:pdfUrl(bytes),id,publico};
 const vista=window.innerWidth>=820?`<iframe src="${actaPdfActual.url}#view=FitH&toolbar=0" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:10px;background:#fff" title="Vista previa"></iframe>`
  :'<div style="padding:18px;text-align:center;font-size:13px;color:var(--text2);border:1px dashed var(--border);border-radius:10px">PDF generado. Usa los botones para descargarlo o abrirlo.</div>';
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:760px">
  <div class="modal-title">📋 ${esc(a.folio)} — ${esc(a.titulo)}</div><div style="margin-bottom:14px">${vista}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="actaDescargarPDF()">⬇ Descargar PDF</button><button class="btn btn-ghost" onclick="actaAbrirPDF()">↗ Abrir en pestaña nueva</button><button class="btn btn-success" onclick="actaCompartirPDF('${esc(id)}')">📤 Compartir</button><button class="btn btn-ghost" onclick="previsualizarActa('${esc(id)}',${publico})">← Volver al acta</button></div></div></div>`;
}
function actaDescargarPDF(){if(actaPdfActual)pdfDescargar(actaPdfActual.bytes,actaPdfActual.nombre);}
function actaAbrirPDF(){if(actaPdfActual)window.open(actaPdfActual.url,'_blank');}
async function actaCompartirPDF(id){
 const a=actaPorId(id);if(!a||!actaPdfActual)return;
 try{
  const f=new File([actaPdfActual.bytes],actaPdfActual.nombre,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:a.folio,text:'Condominio Bosques del Sur 4 — '+a.titulo+' ('+actaFechaLarga(a.fecha)+')'});return;}
 }catch(e){if(e&&e.name==='AbortError')return;}
 actaDescargarPDF();showToast('Este dispositivo no permite compartir archivos: PDF descargado','success');
}

/* ===========================================================================
   Seccion publica dentro de Transparencia (se inserta desde vReportes)
   =========================================================================== */
function htmlActasPublicas(){
 const l=actasPublicadas();
 if(!l.length)return '';
 const todas=!!(state.actasPubTodas);const vis=todas?l:l.slice(0,6);
 return `<div class="section-label">📋 Actas y acuerdos</div><div class="comp-grid acta-pubgrid">${vis.map(a=>{
  const p=a.acuerdos.filter(x=>x.publicable!==false);const pe=p.filter(x=>x.estado!=='cumplido').length;const d=String(a.fecha||'').split('-');
  return `<div class="comp-card acta-card pub"><div class="comp-card-top"><div class="acta-fecha"><b>${esc(d[2]||'')}</b><span>${esc(d[1]?MESES[parseInt(d[1])-1].slice(0,3):'')} ${esc((d[0]||'').slice(2))}</span></div>
   <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--text);line-height:1.25">${esc(a.titulo)}</div><div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(a.folio)} · ${esc(actaTipoLabel(a.tipo))}</div></div></div>
   <div class="acta-meta"><span>👥 ${actaAsistN(a)}/${actaTotal(a)} unidades</span><span>📌 ${p.length} acuerdo${p.length===1?'':'s'}${pe?` · ${pe} pendiente${pe>1?'s':''}`:(p.length?' · todos cumplidos':'')}</span></div>
   <div class="acta-acc"><button class="btn btn-primary btn-sm" onclick="previsualizarActa('${esc(a.id)}',true)">👁 Ver acta</button><button class="btn btn-ghost btn-sm" onclick="actaVerPDF('${esc(a.id)}',true)">📄 PDF</button></div></div>`;}).join('')}</div>
  ${l.length>6?`<div style="text-align:center;margin:4px 0 8px"><button class="btn btn-ghost btn-sm" onclick="state.actasPubTodas=${!todas};renderView()">${todas?'Mostrar solo las últimas':'Ver todas las actas ('+l.length+')'}</button></div>`:''}`;
}

/* ===========================================================================
   Foto / archivo del documento firmado (compartido: actas y compromisos)
   col: 'actas' | 'compromisos' — el registro guarda firmados:[{archivoRef,nombre,tipo,ts,por}]
   =========================================================================== */
const FIRMADOS_MAX=8,FIRMADOS_PDF_MAX=3*1024*1024;
function docGetCol(col){return col==='compromisos'?(typeof compromisosLista==='function'?compromisosLista():[]):actasLista();}
function docGuardar(col,rec){
 if(col==='compromisos'){appData.compromisos=compromisosLista().filter(x=>String(x.id)!==String(rec.id)).concat([rec]);return savePath('compromisos/'+rec.id,rec);}
 return actaGuardarRec(rec);
}
/* Un escaneo debe seguir siendo legible: mas resolucion que los comprobantes (1800 px) */
function firmadoComprimir(file){
 return new Promise((res,rej)=>{
  if(!file)return rej(new Error('Sin archivo'));
  const rd=new FileReader();
  rd.onerror=()=>rej(new Error('No se pudo leer el archivo'));
  if(!/^image\//.test(file.type)){
   if(file.type!=='application/pdf')return rej(new Error('Solo imágenes o PDF'));
   if(file.size>FIRMADOS_PDF_MAX)return rej(new Error('El PDF pesa más de 3 MB: sube fotos o comprímelo'));
   rd.onload=e=>res({name:file.name,type:file.type,data:e.target.result});rd.readAsDataURL(file);return;}
  rd.onload=ev=>{const img=new Image();
   img.onerror=()=>rej(new Error('Imagen no válida'));
   img.onload=()=>{const M=1800;let w=img.width,h=img.height;const k=Math.min(1,M/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(img,0,0,w,h);
    let q=0.74,data=cv.toDataURL('image/jpeg',q);while(data.length>1500000&&q>0.4){q-=0.08;data=cv.toDataURL('image/jpeg',q);}
    res({name:file.name.replace(/\.[^/.]+$/,'')+'.jpg',type:'image/jpeg',data});};
   img.src=ev.target.result;};
  rd.readAsDataURL(file);
 });
}
function docFirmadosModal(col,id,msg){
 const r=docGetCol(col).find(x=>String(x.id)===String(id));if(!r)return;
 const tit=col==='compromisos'?'compromiso '+r.folio:'acta '+r.folio;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:640px">
  <div class="modal-title">📸 Firmado — ${esc(tit)}</div>
  <div style="font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:12px">Sube la foto (o PDF) del documento firmado. Queda guardado <b>solo para la directiva</b>: no se publica en Transparencia. Para páginas varias, sube una foto por hoja.</div>
  <div id="fm-lista" class="fm-lista">${(r.firmados||[]).length?'<div style="font-size:12px;color:var(--text3)">Cargando…</div>':'<div style="font-size:12px;color:var(--text3);padding:6px 0">Aún no hay archivos subidos.</div>'}</div>
  <div class="fm-subir">
   <label class="btn btn-primary btn-sm" style="cursor:pointer">📷 Tomar foto<input type="file" accept="image/*" capture="environment" style="display:none" onchange="docSubirFirmados('${esc(col)}','${esc(id)}',this)"/></label>
   <label class="btn btn-ghost btn-sm" style="cursor:pointer">🖼 Elegir archivos<input type="file" accept="image/*,application/pdf" multiple style="display:none" onchange="docSubirFirmados('${esc(col)}','${esc(id)}',this)"/></label>
   <span id="fm-estado" style="font-size:12px;color:var(--text3)">${esc(msg||'')}</span></div>
  <div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-ghost" onclick="${col==='compromisos'?`verCompromiso('${esc(id)}')`:`previsualizarActa('${esc(id)}',false)`}">← Volver</button><button class="btn btn-ghost" onclick="closeModal();renderView()">Cerrar</button></div></div></div>`;
 (r.firmados||[]).forEach((f,i)=>{
  cargarAdjunto(f.archivoRef).then(d=>{
   const cont=document.getElementById('fm-lista');if(!cont)return;
   if(i===0)cont.innerHTML='';
   const fila=document.createElement('div');fila.className='fm-item';
   const img=d&&/^image\//.test(d.type||'');
   fila.innerHTML=`${img?`<img src="${d.data}" alt="Hoja ${i+1}"/>`:'<div class="fm-pdf">📄 PDF</div>'}
    <div class="fm-info"><b>Hoja ${i+1}</b><span>${esc(f.nombre||'archivo')} · ${esc(new Date(f.ts||0).toLocaleDateString('es-CL'))}${f.por?' · '+esc(f.por):''}</span>${d?'':'<span style="color:var(--danger)">No se pudo cargar</span>'}</div>
    <div class="fm-btns">${d?`<button class="btn btn-ghost btn-sm" onclick="docVerFirmado('${esc(f.archivoRef)}')">Ver</button>`:''}<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="docBorrarFirmado('${esc(col)}','${esc(id)}','${esc(f.archivoRef)}')">Quitar</button></div>`;
   cont.appendChild(fila);
  }).catch(()=>{});
 });
}
async function docSubirFirmados(col,id,input){
 const files=[...(input.files||[])];input.value='';if(!files.length)return;
 const r=docGetCol(col).find(x=>String(x.id)===String(id));if(!r)return;
 const est=document.getElementById('fm-estado');
 if((r.firmados||[]).length+files.length>FIRMADOS_MAX){if(est)est.textContent='Máximo '+FIRMADOS_MAX+' archivos por documento';showToast('Máximo '+FIRMADOS_MAX+' archivos por documento','error');return;}
 let ok=0;const u=checkSession()||'';let rec=r;
 for(let i=0;i<files.length;i++){
  try{
   if(est)est.textContent='Subiendo '+(i+1)+' de '+files.length+'…';
   const d=await firmadoComprimir(files[i]);
   const ref=await subirAdjunto(d);
   rec={...rec,firmados:(rec.firmados||[]).concat([{archivoRef:ref,nombre:d.name,tipo:d.type,ts:Date.now(),por:u}])};
   ok++;
  }catch(err){console.error(err);showToast(err.message||'No se pudo subir','error');}
 }
 if(ok){await docGuardar(col,rec);showToast(ok+' archivo'+(ok>1?'s':'')+' subido'+(ok>1?'s':'')+' ✓','success');}
 docFirmadosModal(col,id,ok?'Listo ✓':'');
}
function docVerFirmado(ref){
 cargarAdjunto(ref).then(d=>{
  if(!d){showToast('No se pudo cargar','error');return;}
  lastDownload={url:d.data,filename:d.name||'firmado'};
  const img=/^image\//.test(d.type||'');
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:720px"><div class="modal-title">📎 ${esc(d.name||'Archivo')}</div>
   ${img?`<img src="${d.data}" style="width:100%;border-radius:8px;margin-bottom:12px"/>`:'<div style="padding:20px;text-align:center;color:var(--text3)">📄 Archivo PDF</div>'}
   <div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar</button><button class="btn btn-ghost" onclick="closeModal();renderView()">Cerrar</button></div></div></div>`;
 });
}
async function docBorrarFirmado(col,id,ref){
 if(!confirm('¿Quitar este archivo del documento? No se podrá recuperar.'))return;
 const r=docGetCol(col).find(x=>String(x.id)===String(id));if(!r)return;
 const rec={...r,firmados:(r.firmados||[]).filter(f=>f.archivoRef!==ref)};
 await docGuardar(col,rec);try{borrarAdjunto(ref);}catch(e){}
 docFirmadosModal(col,id,'Archivo quitado');
}
