/* ===========================================================================
   ESTADO DE CUENTA POR CÓDIGO (consulta del vecino, sin iniciar sesión)
   - Privado: cbs4/codigosEstado/<depId> = {codigo, ts, por}  (solo directiva)
   - Público: cbs4_estado/<codigo> = resumen mínimo SIN nombre ni contacto:
       {n: nº depto, ts, ult: 'YYYY-MM', g: '1101…' (12 meses), deuda, gc:[{l,m}], mu:[{l,m}], cp:{lim,m}|null}
   - El código es un secreto de portador: «NN-XXXXXXXX» (8 caracteres al azar, 40 bits).
     Las reglas de Firebase solo permiten leer UN código exacto, nunca listar el nodo.
   - Pantalla pública: ?estado=<codigo>  (no carga datos privados ni Transparencia).
   Depende de: core.js (appData, calcularMorosidad, clavesVentana, savePath), compromisos.js.
   =========================================================================== */
const EST_ALFA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';/* 32 símbolos, sin I/O/0/1 */
const EST_RE=/^[A-Z0-9]{1,6}-[A-Z2-9]{8}$/;
const EST_PATH='cbs4_estado';
let _estHash='';

function estCodigos(){const o=appData.codigosEstado;return (o&&typeof o==='object'&&!Array.isArray(o))?o:{};}
function estCodigoDe(depId){const r=estCodigos()[depId];return r&&r.codigo?String(r.codigo):'';}
function estNuevoCodigo(dep){
 const b=new Uint8Array(8);crypto.getRandomValues(b);
 const num=String(dep.numero||dep.id).replace(/[^A-Za-z0-9]/g,'').toUpperCase().slice(0,6)||('D'+dep.id);
 return num+'-'+Array.from(b).map(x=>EST_ALFA[x%32]).join('');
}
function estEnlace(codigo){return location.origin+location.pathname.replace(/index\.html$/,'')+'?estado='+encodeURIComponent(codigo);}

/* ---------- datos públicos de un departamento ---------- */
function estDatosDepto(dep){
 const keys12=clavesVentana('12'),ult=keys12[keys12.length-1];
 const g=keys12.map(k=>estaPagado(((appData.pagos||{})[k]||{})[dep.id])?'1':'0').join('');
 const m=calcularMorosidad('todo').find(x=>x.dep.id===dep.id);
 const gc=m?m.gcMeses.map(x=>({l:x.label,m:x.monto})):[],mu=m?m.multas.map(x=>({l:String(x.regla||'Multa').slice(0,60),m:x.monto})):[];
 const cp=(typeof compVigenteDe==='function')?compVigenteDe(dep.id):null;
 return {n:String(dep.numero),ts:Date.now(),ult,g,deuda:m?m.total:0,gc:gc.slice(-36),mu:mu.slice(0,20),cp:cp?{lim:cp.fechaLimite,m:cp.monto}:null};
}
function estMapaPublico(){
 const out={};
 (appData.departamentos||[]).forEach(d=>{const c=estCodigoDe(d.id);if(EST_RE.test(c))out[c]=estDatosDepto(d);});
 return out;
}
/* Publica el espejo. Mismo patrón que publicarTransparencia: hash para no escribir de más y guardas contra publicar vacío. */
function publicarEstados(forzar){
 try{
  if(modoDatos!=='privado'||!authUsuarioActual()||appData.__publico)return;
  if(!Object.keys(appData.pagos||{}).length)return;
  const mapa=estMapaPublico(),n=Object.keys(mapa).length;
  if(!n&&!_estHash)return;
  const h=JSON.stringify(mapa,(k,v)=>k==='ts'?0:v);if(!forzar&&h===_estHash)return;
  _estHash=n?h:'';
  return db.ref(EST_PATH).set(n?mapa:null).catch(e=>{_estHash='';console.warn('estado:',e);});
 }catch(e){console.warn('estado:',e);}
}

/* ---------- gestión (directiva) ---------- */
function htmlEstadoPanel(){
 const n=(appData.departamentos||[]).filter(d=>estCodigoDe(d.id)).length;
 return `<div class="card" style="margin-bottom:14px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
  <div style="flex:1;min-width:220px"><div style="font-weight:700;color:var(--text)">🔎 Estado de cuenta para vecinos</div>
  <div style="font-size:12px;color:var(--text3);margin-top:2px">Cada departamento recibe un enlace privado para ver su propio saldo sin iniciar sesión. ${n} de ${(appData.departamentos||[]).length} con código.</div></div>
  <button class="btn btn-primary" onclick="openEstadoCodigos()">Gestionar códigos</button></div></div>`;
}
function openEstadoCodigos(){
 const dep=(appData.departamentos||[]);
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal acta-modal">
 <div class="modal-title">🔎 Códigos de estado de cuenta</div>
 <div style="font-size:12.5px;color:var(--text2);line-height:1.55;margin-bottom:10px">El vecino abre su enlace y ve <b>solo</b> su departamento: meses y multas pendientes, últimos 12 meses y compromiso vigente. <b>No aparece su nombre ni su contacto.</b> Quien tenga el enlace puede verlo: envíalo solo al representante y, si se filtra, usa «Regenerar».</div>
 <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn btn-success btn-sm" onclick="estGenerarFaltantes()">➕ Generar códigos faltantes</button></div>
 <div class="es-adm">
 ${dep.map(d=>{const c=estCodigoDe(d.id);return `<div class="es-adm-row"><div class="es-adm-i"><div><b>Depto ${esc(d.numero)}</b> <span class="es-mut">${esc(d.representante||'')}</span></div>
  <div>${c?`<code style="font-size:12.5px">${esc(c)}</code>`:'<span class="es-mut">Sin código</span>'}</div></div>
  <div class="es-adm-b">${c?`<button class="btn btn-ghost btn-sm" onclick="estCopiar(${d.id})" title="Copiar enlace">📋</button>
   <button class="btn btn-ghost btn-sm" onclick="estWhatsApp(${d.id})" title="Enviar por WhatsApp">💬</button>
   <button class="btn btn-ghost btn-sm" onclick="estRegenerar(${d.id})" title="Regenerar (el enlace anterior deja de funcionar)">🔄</button>
   <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="estRevocar(${d.id})" title="Revocar">🚫</button>`
   :`<button class="btn btn-primary btn-sm" onclick="estRegenerar(${d.id})">Generar</button>`}</div></div>`;}).join('')}
 </div>
 <div style="margin-top:14px"><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
}
async function estGuardar(depId,rec){
 if(!appData.codigosEstado||Array.isArray(appData.codigosEstado))appData.codigosEstado={};
 if(rec)appData.codigosEstado[depId]=rec;else delete appData.codigosEstado[depId];
 await savePath('codigosEstado/'+depId,rec);
}
async function estAsignar(dep){
 const usados=new Set(Object.values(estCodigos()).map(r=>r&&r.codigo));
 let c;do{c=estNuevoCodigo(dep);}while(usados.has(c));
 await estGuardar(dep.id,{codigo:c,ts:Date.now(),por:checkSession()||''});
 return c;
}
async function estGenerarFaltantes(){
 const faltan=(appData.departamentos||[]).filter(d=>!estCodigoDe(d.id));
 if(!faltan.length){showToast('Todos los departamentos ya tienen código','success');return;}
 for(const d of faltan)await estAsignar(d);
 await publicarEstados(true);openEstadoCodigos();showToast(faltan.length+' código(s) generado(s) ✓','success');
}
async function estRegenerar(depId){
 const d=(appData.departamentos||[]).find(x=>x.id===depId);if(!d)return;
 if(estCodigoDe(depId)&&!confirm('El enlace anterior del depto '+d.numero+' dejará de funcionar. ¿Regenerar?'))return;
 await estAsignar(d);await publicarEstados(true);openEstadoCodigos();showToast('Código del depto '+d.numero+' listo ✓','success');
}
async function estRevocar(depId){
 const d=(appData.departamentos||[]).find(x=>x.id===depId);if(!d||!estCodigoDe(depId))return;
 if(!confirm('¿Revocar el acceso del depto '+d.numero+'? El enlace dejará de funcionar.'))return;
 await estGuardar(depId,null);await publicarEstados(true);openEstadoCodigos();showToast('Acceso revocado','success');
}
function estTexto(d){
 return `Hola ${d.representante||''} 👋\nCONDOMINIO BOSQUES DEL SUR 4\nPuede consultar el estado de cuenta de su departamento ${d.numero} en este enlace privado (no lo comparta):\n${estEnlace(estCodigoDe(d.id))}`;
}
async function estCopiar(depId){
 const d=(appData.departamentos||[]).find(x=>x.id===depId);if(!d)return;
 try{await navigator.clipboard.writeText(estEnlace(estCodigoDe(depId)));showToast('Enlace copiado ✓','success');}
 catch(e){prompt('Copia el enlace:',estEnlace(estCodigoDe(depId)));}
}
function estWhatsApp(depId){const d=(appData.departamentos||[]).find(x=>x.id===depId);if(d)abrirWhatsApp(d.contacto||'',estTexto(d));}

/* ---------- pantalla pública ---------- */
function estadoCodigoURL(){
 const p=new URLSearchParams(location.search);
 return p.has('estado')?String(p.get('estado')||'').trim().toUpperCase():null;
}
/* Devuelve true si la URL pide el estado de cuenta: en ese caso el arranque normal NO continúa. */
function estadoPublicoSiAplica(){
 const code=estadoCodigoURL();if(code===null)return false;
 const ov=document.getElementById('loading-overlay');if(ov)ov.style.display='none';
 const ls=document.getElementById('login-screen');if(ls)ls.style.display='none';
 const m=document.createElement('meta');m.name='robots';m.content='noindex,nofollow';document.head.appendChild(m);
 const r=document.createElement('meta');r.name='referrer';r.content='no-referrer';document.head.appendChild(r);
 const el=document.getElementById('estado-screen');if(!el)return true;el.style.display='block';
 estadoPublicoCargar(code);return true;
}
function estCaparazon(cuerpo){
 return `<div class="es-wrap"><div class="es-head"><img src="${LOGO_SRC}" alt="Logo"/><div><div class="es-t">Condominio Bosques del Sur 4</div><div class="es-s">Estado de cuenta</div></div></div>${cuerpo}
 <div class="es-foot"><a href="${esc(location.pathname)}">Ir a la aplicación</a></div></div>`;
}
function estadoPublicoError(msg){
 document.getElementById('estado-screen').innerHTML=estCaparazon(`<div class="es-card es-err"><div style="font-size:34px">🔒</div><div class="es-big">${esc(msg)}</div><div class="es-mut">Solicita un enlace nuevo a la directiva del condominio.</div></div>`);
}
async function estadoPublicoCargar(code){
 const el=document.getElementById('estado-screen');
 el.innerHTML=estCaparazon('<div class="es-card"><div class="spinner" style="margin:10px auto"></div><div class="es-mut" style="text-align:center">Consultando…</div></div>');
 if(!EST_RE.test(code)){estadoPublicoError('Enlace no válido');return;}
 try{
  const snap=await Promise.race([db.ref(EST_PATH+'/'+code).once('value'),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),12000))]);
  const d=snap.val();
  if(!d||typeof d!=='object'){estadoPublicoError('Enlace no válido o vencido');return;}
  el.innerHTML=estCaparazon(estHtmlPublico(d));
 }catch(e){console.warn('estado:',e);estadoPublicoError('No se pudo consultar en este momento');}
}
function estFechaTS(ts){const d=new Date(Number(ts)||Date.now());return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();}
function estHtmlPublico(d){
 const deuda=Number(d.deuda)||0,gc=Array.isArray(d.gc)?d.gc:Object.values(d.gc||{}),mu=Array.isArray(d.mu)?d.mu:Object.values(d.mu||{});
 const [uy,um]=String(d.ult||'').split('-').map(Number),g=String(d.g||'');
 const celdas=g.split('').map((v,i)=>{const o=g.length-1-i;const dt=new Date(uy,(um-1)-o,1);
  return `<div class="es-mes ${v==='1'?'ok':'no'}"><span>${esc(MESES[dt.getMonth()].slice(0,3))}</span><b>${v==='1'?'✓':'•'}</b><i>${String(dt.getFullYear()).slice(2)}</i></div>`;}).join('');
 const cp=d.cp&&d.cp.lim?`<div class="es-card es-cp">🤝 <b>Compromiso de pago vigente</b> hasta el ${esc(String(d.cp.lim).split('-').reverse().join('/'))} por ${esc(fmt(Number(d.cp.m)||0))}.</div>`:'';
 return `<div class="es-card">
  <div class="es-row"><div><div class="es-mut">Departamento</div><div class="es-depto">${esc(d.n)}</div></div>
  <span class="es-chip ${deuda>0?'deuda':'ok'}">${deuda>0?'Saldo pendiente':'Al día ✓'}</span></div>
  <div class="es-mut" style="margin-top:12px">Total pendiente</div><div class="es-big ${deuda>0?'rojo':'verde'}">${esc(fmt(deuda))}</div></div>
 ${cp}
 ${gc.length?`<div class="es-card"><div class="es-sec">Gastos comunes pendientes</div>${gc.map(x=>`<div class="es-li"><span>${esc(x.l)}</span><b>${esc(fmt(Number(x.m)||0))}</b></div>`).join('')}</div>`:''}
 ${mu.length?`<div class="es-card"><div class="es-sec">Multas pendientes</div>${mu.map(x=>`<div class="es-li"><span>${esc(x.l)}</span><b>${esc(fmt(Number(x.m)||0))}</b></div>`).join('')}</div>`:''}
 <div class="es-card"><div class="es-sec">Últimos 12 meses</div><div class="es-meses">${celdas}</div>
  <div class="es-mut" style="margin-top:8px">✓ pagado · • pendiente</div></div>
 ${deuda>0?`<div class="es-card"><div class="es-sec">Para regularizar</div><div class="es-mut" style="line-height:1.6">Transferir a:<br><b style="color:var(--text)">${esc(PDF_BANCO.split(' · ')[0])}</b><br>${esc(PDF_BANCO.split(' · ').slice(1).join(' · '))}<br>Referencia: Depto ${esc(d.n)}</div></div>`:''}
 <div class="es-mut es-nota">Información referencial actualizada el ${esc(estFechaTS(d.ts))}. Si ya realizó un pago que no aparece, comuníquese con la directiva. Este enlace es personal: por favor no lo comparta.</div>`;
}

/* ---------- acceso desde la pantalla de ingreso ---------- */
function estLoginAbrir(){
 const b=document.getElementById('est-login-box');if(!b)return;b.style.display=b.style.display==='none'?'block':'none';
 const i=document.getElementById('est-login-in');if(i&&b.style.display==='block')i.focus();
}
function estLoginIr(){
 const raw=(document.getElementById('est-login-in').value||'').trim();
 /* acepta el código solo o el enlace completo pegado */
 let c=raw;try{const u=new URL(raw);c=u.searchParams.get('estado')||raw;}catch(e){}
 c=c.trim().toUpperCase();
 if(!EST_RE.test(c)){const e=document.getElementById('est-login-err');if(e)e.textContent='Código no válido. Revisa que esté completo (ej: 07-AB12CD34).';return;}
 location.href=location.pathname+'?estado='+encodeURIComponent(c);
}
