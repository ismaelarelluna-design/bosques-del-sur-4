/* ===========================================================================
   respaldos.js — Respaldos automaticos, descarga y restauracion — CBS4
   ---------------------------------------------------------------------------
   Ramas de Firebase (hermanas de 'cbs4'):
     cbs4_respaldos/<clave>       {ts, data: <copia completa de cbs4>}
     cbs4_respaldos_meta/<clave>  {ts,por,motivo,tipo,bytes,alerta?}   <- lo que se lista (liviano)

   Dos capas, con alcances distintos (hay que decirlo claro):
    1) Instantaneas dentro de Firebase, automaticas cada 7 dias: deshacen errores
       humanos. NO protegen si se borra toda la base (viven en la misma base).
    2) Descarga a tu equipo: es la unica copia FUERA de Firebase. Se avisa en el
       Panel Central si pasan 14 dias sin descargar.
   Los comprobantes (cbs4_adjuntos) pesan varios MB: no entran en las instantaneas;
   solo se incluyen si se marca la casilla al descargar.
   =========================================================================== */
const RESP_PATH='cbs4_respaldos';
const RESP_META='cbs4_respaldos_meta';
const RESP_CADA_DIAS=7;
const RESP_MAX_AUTO=12;                /* se conservan las ultimas 12 automaticas (~3 meses) */
const RESP_AVISO_DESCARGA_DIAS=14;

function respaldoTamano(o){try{return JSON.stringify(o).length;}catch(e){return 0;}}
function respaldoEsSospechoso(data){
 /* Una base vacia no es un respaldo: si la base se borrara, una instantanea
    automatica posterior terminaria reemplazando con "nada" a las buenas al rotar. */
 return !data||!data.departamentos||!data.pagos||!Object.keys(data.pagos).length;
}
function respaldoListar(){
 return db.ref(RESP_META).once('value').then(s=>{
  const v=s.val()||{};
  return Object.entries(v).map(([clave,m])=>({clave,...m})).sort((a,b)=>(a.ts||0)-(b.ts||0));
 });
}
function respaldoCrear(motivo,opts){
 opts=opts||{};
 return db.ref('cbs4').once('value').then(s=>s.val()).then(data=>{
  if(!opts.forzar&&respaldoEsSospechoso(data))throw new Error('La base de datos parece vacía; no se creó el respaldo para no reemplazar uno bueno.');
  const clave=fechaClave(new Date())+(opts.sufijo||'');
  return respaldoListar().then(lista=>{
   const ultimo=lista[lista.length-1];
   const bytes=respaldoTamano(data);
   const meta={ts:Date.now(),por:checkSession()||'sistema',motivo:motivo||'manual',tipo:opts.tipo||'auto',bytes};
   if(ultimo&&ultimo.bytes&&bytes<ultimo.bytes*0.6)meta.alerta='El tamaño bajó más de un 40% respecto al respaldo anterior';
   const upd={};upd[RESP_PATH+'/'+clave]={ts:meta.ts,data:data||{}};upd[RESP_META+'/'+clave]=meta;
   return db.ref().update(upd).then(()=>({clave,meta}));
  });
 });
}
function respaldoPodar(){
 return respaldoListar().then(lista=>{
  const autos=lista.filter(x=>x.tipo==='auto');
  if(autos.length&&autos[autos.length-1].alerta)return;      /* si la ultima trae alerta, no se borra nada */
  const sobran=autos.slice(0,Math.max(0,autos.length-RESP_MAX_AUTO));
  if(!sobran.length)return;
  const upd={};sobran.forEach(x=>{upd[RESP_PATH+'/'+x.clave]=null;upd[RESP_META+'/'+x.clave]=null;});
  return db.ref().update(upd);
 });
}

/* ---------- automatico ---------- */
let _respaldoIntentado=false;
function programarRespaldoAutomatico(){
 if(_respaldoIntentado||state.isTransparencia||!checkSession()||!_cbs4Raw)return;
 _respaldoIntentado=true;
 setTimeout(respaldoAutomatico,6000);
}
function respaldoAutomatico(){
 return respaldoListar().then(lista=>{
  const autos=lista.filter(x=>x.tipo==='auto');
  const ultimo=autos[autos.length-1];
  const dias=ultimo?(Date.now()-ultimo.ts)/86400000:Infinity;
  if(dias<RESP_CADA_DIAS)return null;
  return respaldoCrear('automático',{tipo:'auto'}).then(r=>{
   registrarAuditoria({seccion:'Sistema',accion:'respaldo',detalle:'Respaldo automático '+r.clave+(r.meta.alerta?' ⚠ '+r.meta.alerta:'')});
   return respaldoPodar();
  });
 }).catch(e=>console.warn('respaldo automatico:',e.message));
}
function respaldoManual(){
 showToast('Creando instantánea…','');
 respaldoCrear('manual',{tipo:'manual',sufijo:'_'+new Date().toTimeString().slice(0,5).replace(':','')+'_manual'}).then(r=>{
  registrarAuditoria({seccion:'Sistema',accion:'respaldo',detalle:'Instantánea manual '+r.clave});
  showToast('Instantánea creada ✓','success');cargarListaRespaldos();
 }).catch(e=>showToast(e.message,'error'));
}

/* ---------- descarga a este equipo ---------- */
function ultimaDescargaTs(){try{return parseInt(localStorage.getItem('cbs4_ultima_descarga'))||0;}catch(e){return 0;}}
function descargarRespaldoJSON(conAdjuntos,clave){
 showToast('Preparando respaldo…','');
 const leer=clave?db.ref(RESP_PATH+'/'+clave).once('value').then(s=>{const r=s.val();return r?r.data:null;}):db.ref('cbs4').once('value').then(s=>s.val());
 leer.then(async data=>{
  if(!data)throw new Error('No se encontró el respaldo');
  let adj=null;
  if(conAdjuntos)adj=await db.ref(ADJ_PATH).once('value').then(s=>s.val());
  const pack={version:1,generado:new Date().toISOString(),por:checkSession()||'',origen:clave||'base actual',cbs4:data,cbs4_adjuntos:adj};
  descargarBlob(JSON.stringify(pack),'application/json','Respaldo_CBS4_'+(clave||fechaClave(new Date()))+(adj?'_con_comprobantes':'')+'.json');
  if(!clave){try{localStorage.setItem('cbs4_ultima_descarga',String(Date.now()));}catch(e){}}
  registrarAuditoria({seccion:'Sistema',accion:'respaldo',detalle:'Descarga de respaldo '+(clave||'de la base actual')+(adj?' (con comprobantes)':'')});
  showToast('Respaldo descargado ✓','success');
  if(state.currentView==='config'||state.currentView==='dashboard')renderView();
 }).catch(e=>showToast('No se pudo descargar: '+e.message,'error'));
}

/* ---------- restauracion (siempre con copia previa y confirmacion escrita) ---------- */
function restaurarRespaldo(clave){
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal">
 <div class="modal-title" style="color:var(--danger)">↩ Restaurar respaldo ${esc(clave)}</div>
 <p style="font-size:13px;color:var(--text2);margin-bottom:10px;">Esto <strong>reemplaza todos los datos actuales</strong> del condominio por los de ese respaldo. Lo que se haya ingresado después de esa fecha se perderá.</p>
 <p style="font-size:12px;color:var(--text3);margin-bottom:14px;">Antes de restaurar se guarda automáticamente una copia del estado actual, así que se puede deshacer.</p>
 <label class="fl">Para confirmar, escribe RESTAURAR</label><input class="fi" id="rs-conf" autocomplete="off"/>
 <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-danger" onclick="ejecutarRestauracion('${esc(clave)}')">Restaurar ahora</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
function ejecutarRestauracion(clave){
 if((document.getElementById('rs-conf').value||'').trim()!=='RESTAURAR'){showToast('Escribe RESTAURAR para confirmar','error');return;}
 db.ref(RESP_PATH+'/'+clave).once('value').then(s=>s.val()).then(rec=>{
  if(!rec||!rec.data)throw new Error('El respaldo no existe o está vacío');
  return aplicarRestauracion(rec.data,'respaldo '+clave);
 }).catch(e=>showToast('No se restauró: '+e.message,'error'));
}
function aplicarRestauracion(data,origen){
 if(respaldoEsSospechoso(data))return Promise.reject(new Error('El respaldo no tiene departamentos ni pagos; se cancela por seguridad.'));
 return respaldoCrear('previo a restauración',{tipo:'pre-restauracion',forzar:true,sufijo:'_'+new Date().toTimeString().slice(0,8).replace(/:/g,'')+'_pre'})
  .then(()=>db.ref('cbs4').set(data))
  .then(()=>{
   registrarAuditoria({seccion:'Sistema',accion:'restaurar',detalle:'Datos restaurados desde '+origen});
   closeModal();showToast('Datos restaurados ✓','success');cargarListaRespaldos();
  });
}
function restaurarDesdeArchivo(input){
 const f=input.files&&input.files[0];if(!f)return;
 const rd=new FileReader();
 rd.onload=()=>{
  try{
   const j=JSON.parse(rd.result);const data=j&&j.cbs4;
   if(!data||!data.departamentos||!data.pagos)throw new Error('El archivo no parece un respaldo de CBS4');
   window._restauracionArchivo=data;
   document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal">
   <div class="modal-title" style="color:var(--danger)">↩ Restaurar desde archivo</div>
   <p style="font-size:13px;color:var(--text2);margin-bottom:6px;">Archivo: <strong>${esc(f.name)}</strong></p>
   <p style="font-size:12px;color:var(--text3);margin-bottom:10px;">Generado: ${esc(j.generado||'—')} · por ${esc(j.por||'—')}</p>
   <p style="font-size:13px;color:var(--text2);margin-bottom:14px;">Reemplaza <strong>todos los datos actuales</strong>. Se guarda antes una copia del estado actual.</p>
   <label class="fl">Para confirmar, escribe RESTAURAR</label><input class="fi" id="rs-conf" autocomplete="off"/>
   <div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-danger" onclick="confirmarRestauracionArchivo()">Restaurar ahora</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
  }catch(e){showToast(e.message,'error');}
  input.value='';
 };
 rd.readAsText(f);
}
function confirmarRestauracionArchivo(){
 if((document.getElementById('rs-conf').value||'').trim()!=='RESTAURAR'){showToast('Escribe RESTAURAR para confirmar','error');return;}
 aplicarRestauracion(window._restauracionArchivo,'archivo').catch(e=>showToast('No se restauró: '+e.message,'error'));
}

/* ---------- UI: tarjeta en Configuracion + aviso en Panel Central ---------- */
function haceCuanto(ts){
 if(!ts)return 'nunca';
 const d=Math.floor((Date.now()-ts)/86400000);
 return d<=0?'hoy':(d===1?'ayer':'hace '+d+' días');
}
function cardRespaldos(){
 if(state.isTransparencia)return '';
 setTimeout(cargarListaRespaldos,60);
 const dl=ultimaDescargaTs();
 return `<div class="card mb-16" id="card-respaldos">
 <div class="config-section-title">🛡️ Respaldos</div>
 <p style="font-size:13px;color:var(--text2);margin:0 0 12px;">La app guarda sola una instantánea de los datos cada ${RESP_CADA_DIAS} días (se conservan las últimas ${RESP_MAX_AUTO}). Sirve para deshacer errores. <strong>No te protege si se borra toda la base:</strong> para eso descarga una copia a tu equipo de vez en cuando.</p>
 <div class="resp-estado"><div><span class="mant-k">Última descarga a este equipo</span><span class="mant-v">${esc(haceCuanto(dl))}</span></div>
  <div><span class="mant-k">Instantáneas guardadas</span><span class="mant-v" id="resp-n">…</span></div></div>
 <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);margin:12px 0 10px;cursor:pointer;"><input type="checkbox" id="resp-adj" style="width:16px;height:16px;"/>Incluir comprobantes adjuntos (archivo más pesado, varios MB)</label>
 <div style="display:flex;gap:8px;flex-wrap:wrap;">
  <button class="btn btn-primary" onclick="descargarRespaldoJSON(document.getElementById('resp-adj').checked)">⬇ Descargar respaldo ahora</button>
  <button class="btn btn-outline" onclick="respaldoManual()">📸 Crear instantánea</button>
  <button class="btn btn-outline" onclick="document.getElementById('resp-file').click()">📂 Restaurar desde archivo</button>
  <input type="file" id="resp-file" accept="application/json,.json" style="display:none" onchange="restaurarDesdeArchivo(this)"/>
 </div>
 <div id="resp-lista" style="margin-top:14px;"></div></div>`;
}
function cargarListaRespaldos(){
 const cont=document.getElementById('resp-lista');if(!cont)return;
 cont.innerHTML='<div style="font-size:12px;color:var(--text3)">Cargando instantáneas…</div>';
 respaldoListar().then(l=>{
  const n=document.getElementById('resp-n');if(n)n.textContent=String(l.length);
  const c=document.getElementById('resp-lista');if(!c)return;
  if(!l.length){c.innerHTML='<div style="font-size:12px;color:var(--text3)">Aún no hay instantáneas. La primera se crea sola al entrar como administrador.</div>';return;}
  const tipoLbl={auto:'Automática',manual:'Manual','pre-restauracion':'Previa a restaurar'};
  c.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Por</th><th>Tamaño</th><th></th></tr></thead><tbody>`+
   l.slice().reverse().map(r=>`<tr><td style="white-space:nowrap">${esc(fechaHoraCL(r.ts))}${r.alerta?` <span title="${esc(r.alerta)}" style="color:var(--danger)">⚠</span>`:''}</td>
   <td><span class="chip chip-cat">${esc(tipoLbl[r.tipo]||r.tipo||'')}</span></td><td style="font-size:12px">${esc(r.por||'')}</td>
   <td style="font-size:12px;color:var(--text3)">${Math.round((r.bytes||0)/1024)} KB</td>
   <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" onclick="descargarRespaldoJSON(false,'${esc(r.clave)}')">⬇ JSON</button> <button class="btn btn-outline btn-sm" onclick="restaurarRespaldo('${esc(r.clave)}')">↩ Restaurar</button></td></tr>`).join('')+`</tbody></table></div>`;
 }).catch(e=>{const c=document.getElementById('resp-lista');if(c)c.innerHTML='<div style="color:var(--danger);font-size:12px">No se pudo leer la lista: '+esc(e.message)+'</div>';});
}
function avisoRespaldo(){
 if(state.isTransparencia||!checkSession())return '';
 const dl=ultimaDescargaTs();
 const dias=dl?(Date.now()-dl)/86400000:Infinity;
 if(dias<RESP_AVISO_DESCARGA_DIAS)return '';
 return `<div class="card aviso-resp"><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
 <div style="font-size:22px">🛡️</div>
 <div style="flex:1;min-width:200px"><div style="font-weight:700;color:var(--text)">${dl?'Hace '+Math.floor(dias)+' días que no descargas un respaldo':'Aún no has descargado un respaldo a este equipo'}</div>
 <div style="font-size:12px;color:var(--text3)">Una copia fuera de la base de datos es lo único que te salva si algo la borra.</div></div>
 <button class="btn btn-primary btn-sm" onclick="descargarRespaldoJSON(false)">⬇ Descargar ahora</button></div></div>`;
}
