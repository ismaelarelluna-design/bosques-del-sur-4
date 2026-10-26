/* ===========================================================================
   exenciones.js — CBS4
   1) Eximir departamentos de pagar gasto común (por mes o por rango). Un mes eximido
      no cuenta como ingreso, deuda ni moroso, y se saca del total de los contadores.
   2) Inicio del cobro de gasto común (bloqueo de meses anteriores, activable/desactivable).

   Datos:  cbs4/exentos/<AAAA-MM>/<deptoId> = {m:motivo, por:usuario, ts}
           cbs4/configuracion/inicioCobro  = 'AAAA-MM' | ''   (por defecto 2020-03)
           cbs4/configuracion/bloqueoInicio = true | false    (false = meses anteriores desbloqueados)
   Las reglas de lectura/escritura están en core.js (esExento, mesSinCobro, exigible, ...).
   =========================================================================== */
const EXE_MOTIVO_SUGERIDO='Depto desocupado';

function exeNombreDepto(id){const d=(appData.departamentos||[]).find(x=>String(x.id)===String(id));return d?d.numero:String(id);}
function exeOpcionesMes(sel){return YEARS.map(y=>MESES.map((m,i)=>{const k=mkKey(y,i);return `<option value="${k}" ${k===sel?'selected':''}>${m} ${y}</option>`;}).join('')).join('');}
function exeClavesEntre(desde,hasta){
 const out=[];let y=parseInt(desde.slice(0,4)),m=parseInt(desde.slice(5,7))-1;
 const fy=parseInt(hasta.slice(0,4)),fm=parseInt(hasta.slice(5,7))-1;
 while(y<fy||(y===fy&&m<=fm)){out.push(mkKey(y,m));m++;if(m>11){m=0;y++;}if(out.length>240)break;}
 return out;
}
function exePagado(k,id){return estaPagado(((appData.pagos||{})[k]||{})[id]);}

/* ---------- escritura ---------- */
function exeAplicar(lista,motivo){
 if(!appData.exentos||typeof appData.exentos!=='object'||Array.isArray(appData.exentos))appData.exentos={};
 const por=(typeof checkSession==='function'&&checkSession())||'',ts=Date.now(),m=String(motivo||'').trim().slice(0,80);
 lista.forEach(({k,id})=>{
  if(!appData.exentos[k]||typeof appData.exentos[k]!=='object')appData.exentos[k]={};
  const rec={por,ts};if(m)rec.m=m;
  appData.exentos[k][id]=rec;
 });
 /* un mes = escritura granular; varios = una sola escritura de toda la rama (una sola anotación de auditoría) */
 if(lista.length===1)return savePath('exentos/'+lista[0].k+'/'+lista[0].id,appData.exentos[lista[0].k][lista[0].id]);
 return savePath('exentos',appData.exentos);
}
function exeQuitar(lista){
 const quitar=[];
 lista.forEach(({k,id})=>{const mes=(appData.exentos||{})[k];if(mes&&mes[id]){delete mes[id];if(!Object.keys(mes).length)delete appData.exentos[k];quitar.push({k,id});}});
 if(!quitar.length)return;
 if(quitar.length===1)return savePath('exentos/'+quitar[0].k+'/'+quitar[0].id,null);
 return savePath('exentos',Object.keys(appData.exentos).length?appData.exentos:null);
}

/* ---------- un mes ---------- */
function abrirEximir(key,id){
 if(state.isTransparencia)return;
 if(exePagado(key,id)){showToast('Ese mes ya está pagado: primero desmarca el pago','error');return;}
 if(mesSinCobro(key)){showToast('Ese mes es anterior al inicio del cobro','error');return;}
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:420px;">
  <div class="modal-title">🚫 Eximir departamento</div>
  <p style="font-size:13px;color:var(--text2);line-height:1.6;margin-bottom:14px;">Depto <strong>${esc(exeNombreDepto(id))}</strong> · ${esc(formatPeriodo(key))}.<br>Un mes eximido no cuenta como ingreso ni como deuda, y no suma al total de departamentos de ese mes.</p>
  <label class="fl">Motivo (opcional)</label>
  <input class="fi" id="exe-motivo" maxlength="80" value="${esc(EXE_MOTIVO_SUGERIDO)}" style="margin-bottom:16px;"/>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
   <button class="btn btn-primary" onclick="exeGuardarUno('${esc(key)}',${Number(id)})">Eximir solo este mes</button>
   <button class="btn btn-ghost" onclick="abrirEximirRango(${Number(id)},'${esc(key)}')">Eximir varios meses…</button>
   <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
  </div></div></div>`;
}
function exeGuardarUno(key,id){
 const mo=(document.getElementById('exe-motivo')||{}).value||'';
 exeAplicar([{k:key,id}],mo);closeModal();renderView();showToast('Departamento eximido ✓','success');
}
function quitarExencion(key,id){
 if(state.isTransparencia)return;
 exeQuitar([{k:key,id}]);renderView();showToast('Exención quitada','');
}

/* ---------- varios meses ---------- */
function abrirEximirRango(depId,keyIni){
 if(state.isTransparencia)return;
 const k0=keyIni||mkKey(state.currentYear,state.currentMonth);
 const deps=(appData.departamentos||[]).map(d=>`<option value="${d.id}" ${String(d.id)===String(depId)?'selected':''}>Depto ${esc(d.numero)}${d.representante?' — '+esc(d.representante):''}</option>`).join('');
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:460px;">
  <div class="modal-title">🚫 Eximir varios meses</div>
  <p style="font-size:12.5px;color:var(--text3);line-height:1.6;margin-bottom:12px;">Marca de una vez un tramo de meses (ej. los años en que el departamento estuvo desocupado). Los meses que ya tengan un pago registrado se omiten.</p>
  <label class="fl">Departamento</label><select class="fi" id="exr-dep" style="margin-bottom:10px;" onchange="exeVistaRango()">${deps}</select>
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
   <div style="flex:1;min-width:150px;"><label class="fl">Desde</label><select class="fi" id="exr-desde" onchange="exeVistaRango()">${exeOpcionesMes(k0)}</select></div>
   <div style="flex:1;min-width:150px;"><label class="fl">Hasta</label><select class="fi" id="exr-hasta" onchange="exeVistaRango()">${exeOpcionesMes(k0)}</select></div>
  </div>
  <label class="fl">Motivo (opcional)</label>
  <input class="fi" id="exr-motivo" maxlength="80" value="${esc(EXE_MOTIVO_SUGERIDO)}" style="margin-bottom:10px;"/>
  <div id="exr-resumen" style="font-size:12.5px;color:var(--text2);line-height:1.6;margin-bottom:14px;"></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;">
   <button class="btn btn-primary" id="exr-ok" onclick="exeGuardarRango()">Eximir</button>
   <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
  </div></div></div>`;
 exeVistaRango();
}
function exeLeerRango(){
 const id=parseInt((document.getElementById('exr-dep')||{}).value),d=(document.getElementById('exr-desde')||{}).value,h=(document.getElementById('exr-hasta')||{}).value;
 if(!id||!d||!h)return null;
 const claves=h<d?[]:exeClavesEntre(d,h);
 const ya=claves.filter(k=>esExento(k,id)),pag=claves.filter(k=>exePagado(k,id)),sin=claves.filter(k=>mesSinCobro(k));
 const aplicar=claves.filter(k=>!exePagado(k,id)&&!mesSinCobro(k));
 return {id,d,h,claves,ya,pag,sin,aplicar};
}
function exeVistaRango(){
 const r=exeLeerRango(),el=document.getElementById('exr-resumen'),b=document.getElementById('exr-ok');if(!el)return;
 if(!r||!r.claves.length){el.innerHTML='<span style="color:var(--danger)">La fecha «hasta» debe ser igual o posterior a «desde».</span>';if(b)b.disabled=true;return;}
 const partes=[`Se eximirán <strong>${r.aplicar.length}</strong> mes${r.aplicar.length===1?'':'es'} (${esc(formatPeriodo(r.d))} a ${esc(formatPeriodo(r.h))}).`];
 if(r.pag.length)partes.push(`${r.pag.length} con pago registrado se omiten.`);
 if(r.sin.length)partes.push(`${r.sin.length} son anteriores al inicio del cobro y se omiten.`);
 if(r.ya.length)partes.push(`${r.ya.length} ya estaban eximidos (se actualiza el motivo).`);
 el.innerHTML=partes.join(' ');if(b)b.disabled=!r.aplicar.length;
}
function exeGuardarRango(){
 const r=exeLeerRango();if(!r||!r.aplicar.length)return;
 const mo=(document.getElementById('exr-motivo')||{}).value||'';
 exeAplicar(r.aplicar.map(k=>({k,id:r.id})),mo);closeModal();renderView();
 showToast(r.aplicar.length+' mes'+(r.aplicar.length===1?'':'es')+' eximido'+(r.aplicar.length===1?'':'s')+' ✓','success');
}

/* ---------- listado de exenciones (Gasto Común) ---------- */
function exeGrupos(){
 const por={};
 Object.keys(appData.exentos||{}).filter(k=>/^\d{4}-\d{2}$/.test(k)).sort().forEach(k=>{
  const mes=appData.exentos[k]||{};
  Object.keys(mes).forEach(id=>{if(!mes[id])return;(por[id]=por[id]||[]).push({k,m:(typeof mes[id]==='object'&&mes[id].m)||''});});
 });
 const out=[];
 Object.keys(por).forEach(id=>{
  let g=null;
  por[id].forEach(x=>{
   const sig=g&&g.m===x.m&&exeClavesEntre(g.hasta,x.k).length===2;
   if(sig){g.hasta=x.k;g.n++;g.claves.push(x.k);}
   else{g={id,m:x.m,desde:x.k,hasta:x.k,n:1,claves:[x.k]};out.push(g);}
  });
 });
 return out.sort((a,b)=>String(exeNombreDepto(a.id)).localeCompare(String(exeNombreDepto(b.id)),undefined,{numeric:true})||a.desde.localeCompare(b.desde));
}
function htmlExenciones(){
 const gr=exeGrupos();
 const filas=gr.length?gr.map((g,i)=>`<div class="exe-row"><div style="flex:1;min-width:0;"><strong>Depto ${esc(exeNombreDepto(g.id))}</strong> · ${esc(formatPeriodo(g.desde))}${g.n>1?' → '+esc(formatPeriodo(g.hasta)):''} <span style="color:var(--text3)">(${g.n} mes${g.n===1?'':'es'})</span>${g.m?`<div style="font-size:11.5px;color:var(--text3)">${esc(g.m)}</div>`:''}</div><button class="btn btn-ghost btn-sm" onclick="exeQuitarGrupo(${i})">Quitar</button></div>`).join('')
  :'<div style="font-size:12.5px;color:var(--text3);padding:6px 0;">No hay exenciones registradas.</div>';
 return `<div class="card" style="margin-top:16px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
  <div class="card-title" style="margin:0;">🚫 Exenciones registradas</div>
  <button class="btn btn-ghost btn-sm" onclick="abrirEximirRango()">+ Eximir varios meses</button></div>
  <div style="font-size:12px;color:var(--text3);line-height:1.6;margin-bottom:8px;">Un departamento eximido en un mes no cuenta como ingreso ni deuda, y se saca del total de departamentos de ese mes.</div>${filas}</div>`;
}
function exeQuitarGrupo(i){
 const g=exeGrupos()[i];if(!g)return;
 if(!confirm('¿Quitar la exención del Depto '+exeNombreDepto(g.id)+' ('+g.n+' mes'+(g.n===1?'':'es')+')? Esos meses volverán a contar como pendientes si no tienen pago.'))return;
 exeQuitar(g.claves.map(k=>({k,id:g.id})));renderView();showToast('Exención quitada','');
}

/* ---------- Configuración: inicio del cobro ---------- */
function htmlConfigCobro(){
 const c=cfgCobro();
 const opts=`<option value="" ${c.inicio===''?'selected':''}>Sin límite (se cobra desde el primer mes)</option>`+exeOpcionesMes(c.inicio);
 return `<div class="config-section-title" style="margin-top:4px;">🔒 Inicio del cobro de gasto común</div>
 <div style="font-size:12px;color:var(--text3);line-height:1.7;margin-bottom:10px;">Los meses anteriores al inicio del cobro no se cobran: no se pueden marcar pagos y no cuentan como deuda ni en los contadores. Los gastos sí se pueden seguir registrando. Los pagos ya registrados se siguen sumando.</div>
 <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:8px;">
  <div style="flex:1;min-width:220px;"><label class="fl">Se cobra desde</label><select class="fi" id="cfg-inicio-cobro">${opts}</select></div>
  <button class="btn btn-primary" onclick="exeGuardarInicio()">Guardar</button>
 </div>
 <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
  <span style="font-size:13px;">Meses anteriores: <strong style="color:${c.bloqueo?'var(--danger)':'var(--green)'}">${c.bloqueo?'🔒 bloqueados':'🔓 desbloqueados'}</strong></span>
  <button class="btn btn-ghost btn-sm" onclick="exeAlternarBloqueo()">${c.bloqueo?'Desbloquear meses anteriores':'Volver a bloquear'}</button>
 </div>`;
}
function exeGuardarConfig(patch,msg){
 if(!appData.configuracion)appData.configuracion={};
 Object.assign(appData.configuracion,patch);
 savePath('configuracion',appData.configuracion);renderView();showToast(msg,'success');
}
function exeGuardarInicio(){
 const v=(document.getElementById('cfg-inicio-cobro')||{}).value;if(v===undefined)return;
 exeGuardarConfig({inicioCobro:v},v?('Cobro desde '+formatPeriodo(v)+' ✓'):'Sin límite de inicio ✓');
}
function exeAlternarBloqueo(){
 const c=cfgCobro();
 if(c.bloqueo&&!confirm('¿Desbloquear los meses anteriores al inicio del cobro? Podrás marcar pagos en esos meses y volverán a contar para la deuda hasta que los bloquees de nuevo.'))return;
 exeGuardarConfig({bloqueoInicio:!c.bloqueo},c.bloqueo?'Meses anteriores desbloqueados':'Meses anteriores bloqueados');
}
