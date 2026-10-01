/* ===== multas.js — CBS4: módulo de multas + arranque ===== */
function vMultas(){const {currentYear,currentMonth}=state;const isAdmin=!state.isTransparencia;const mul=(appData.multas||[]).filter(m=>m.anio===currentYear&&m.mes===currentMonth);const pag=mul.filter(m=>m.estado==='Pagada').reduce((s,m)=>s+m.monto,0);
const gr=(uid,r,fc)=>{const s=new Date(fc);s.setMonth(s.getMonth()-6);return (appData.multas||[]).filter(m=>m.unidad_id===uid&&m.regla===r&&m.estado!=='Anulada'&&new Date(m.fecha_creacion)>=s).length>=2;};
return `<div class="page-title">Multas</div><div class="page-sub">Gestión de infracciones al reglamento</div>${monthTabs()}<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;"><div class="stat-card" style="flex:none;padding:12px 18px;"><div class="stat-label">Recaudado Multas</div><div class="stat-value small">${fmt(pag)}</div></div>${isAdmin?`<button class="btn btn-danger" onclick="openNuevaMulta()">+ Nueva Multa</button>`:''}</div><div class="card">${mul.length===0?`<div style="text-align:center;padding:28px;color:var(--text3)">Sin multas en ${MESES[currentMonth]}</div>`:`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Dpto</th><th>Encargado</th><th>Regla</th><th>Monto</th><th>Estado</th><th style="width:200px;"></th></tr></thead><tbody>${mul.map(m=>{const dp=(appData.departamentos||[]).find(x=>x.id===m.unidad_id)||{};const rc=gr(m.unidad_id,m.regla,m.fecha_creacion);const be=m.estado==='Pagada'?'badge-green':(m.estado==='Anulada'?'badge-navy':'badge-red');return `<tr><td>${m.fecha_creacion}</td><td><strong style="color:var(--text)">${dp.numero||m.unidad_id}</strong></td><td>${dp.representante||'—'}</td><td><span class="badge badge-orange">${m.regla}</span>${rc?' <span title="Reincidente">⚠️</span>':''}</td><td><strong>${fmt(m.monto)}</strong></td><td><span class="badge ${be}">${m.estado}</span></td><td style="white-space:nowrap;"><button class="btn btn-ghost btn-sm" onclick="verMulta(${m.id})"></button><button class="btn btn-outline btn-sm" onclick="descargarVoucherMulta(${m.id})">📥</button>${m.estado!=='Pagada'&&isAdmin?`<button class="btn btn-success btn-sm" onclick="marcarPagadaMulta(${m.id})">💳</button>`:''}${isAdmin?`<button class="btn btn-warning btn-sm" onclick="editarMulta(${m.id})"></button><button class="btn btn-danger btn-sm" onclick="eliminarMulta(${m.id})"></button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`}</div>${pag>0&&!state.isTransparencia?`<div style="font-size:11px;color:var(--text3);margin-top:10px;text-align:right;">✓ Este monto se incluye en "Recaudaciones Totales" del Dashboard</div>`:''}`;}

function openNuevaMulta(editId=null){let mu=editId?(appData.multas||[]).find(m=>m.id===editId):null;const {currentYear,currentMonth}=state;const fh=new Date().toISOString().split('T')[0];const ti=mu?`Editar Multa #${mu.id}`:`Nueva Multa — ${MESES[currentMonth]}`;const op=(appData.departamentos||[]).map(d=>`<option value="${d.id}" ${mu&&mu.unidad_id===d.id?'selected':''}>${d.numero} - ${d.representante||'Sin nombre'}</option>`).join('');
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:520px;"><div class="modal-title">${ti}</div><div class="form-row"><div><label class="fl">Departamento</label><select class="fi" id="nm-depto" onchange="cargarDatosDepto(this.value)">${op}<option value="">-- Seleccionar --</option></select></div></div><div class="form-row"><div><label class="fl">Encargado (auto)</label><input class="fi" id="nm-encargado" readonly value="${mu?mu.encargado:''}"/></div></div><div class="form-row form-row-2"><div><label class="fl">Regla</label><select class="fi" id="nm-regla"><option ${mu&&mu.regla==='Basura'?'selected':''}>Basura</option><option ${mu&&mu.regla==='Ruido'?'selected':''}>Ruido</option><option ${mu&&mu.regla==='Mascotas'?'selected':''}>Mascotas</option><option ${mu&&mu.regla==='Estacionamiento'?'selected':''}>Estacionamiento</option><option ${mu&&mu.regla==='Áreas comunes'?'selected':''}>Áreas comunes</option><option ${mu&&mu.regla==='Otro'?'selected':''}>Otro</option></select></div><div><label class="fl">Monto ($)</label><input class="fi" id="nm-monto" type="number" placeholder="0" value="${mu?mu.monto:''}"/></div></div><div class="form-row"><div><label class="fl">Motivo</label><textarea class="fi" id="nm-motivo" rows="2" maxlength="500">${mu?mu.motivo:''}</textarea></div></div><div class="form-row"><div><label class="fl">Fecha creación</label><input class="fi" type="date" value="${mu?mu.fecha_creacion:fh}" ${mu?'':'readonly'}/></div></div><div class="form-row"><label class="fl">Evidencia ${mu&&(mu.evidencia_url||mu.evidenciaRef)?'(reemplazar)':'(opcional)'}</label><div class="file-drop" onclick="document.getElementById('nm-file').click()"> Adjuntar foto o acta</div><input type="file" id="nm-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'nm-prev')"/><div id="nm-prev">${mu&&(mu.evidencia_url||mu.evidenciaRef)?'<div class="file-preview">📄 <span class="file-name">Evidencia existente</span></div>':''}</div></div><div style="display:flex;gap:10px;margin-top:10px;"><button class="btn btn-danger" onclick="${editId?`actualizarMulta(${editId})`:'crearMulta()'}">${mu?'💾 Actualizar':'✅ Crear y descargar voucher'}</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
if(mu&&mu.unidad_id){cargarDatosDepto(mu.unidad_id);}}

function cargarDatosDepto(id){const d=(appData.departamentos||[]).find(x=>x.id==id);document.getElementById('nm-encargado').value=d?d.representante||'':'';}

function crearMulta(){const {currentYear,currentMonth}=state;const uid=parseInt(document.getElementById('nm-depto').value);const r=document.getElementById('nm-regla').value;const m=parseInt(document.getElementById('nm-monto').value)||0;const mo=document.getElementById('nm-motivo').value.trim();const fc=document.querySelector('#nm-motivo').closest('.form-row').previousElementSibling.querySelector('input').value;if(!uid||!m||m<=0||!mo){showToast('Complete los campos requeridos','error');return;}const dp=(appData.departamentos||[]).find(d=>d.id===uid);const nm={id:Date.now(),unidad_id:uid,encargado:dp?dp.representante:'',regla:r,monto:m,motivo:mo,fecha_creacion:fc,evidenciaRef:null,estado:'Notificada',anio:currentYear,mes:currentMonth,fecha_pago:null,creado_por:checkSession()||'admin'};const f=document.getElementById('nm-file');const guardar=()=>{if(!appData.multas)appData.multas=[];appData.multas.push(nm);savePath('multas',appData.multas);closeModal();renderView();showToast('Multa creada ✓','success');setTimeout(()=>descargarVoucherMulta(nm.id),300);};
const pe=(a)=>{if(!a){guardar();return;}showToast('Subiendo evidencia...','');subirAdjunto(a).then(ref=>{nm.evidenciaRef=ref;nm.evidenciaNombre=a.name;guardar();}).catch(e=>{showToast('Error al subir evidencia: '+e.message,'error');guardar();});};
if(f&&f.files.length>0){compressImage(f.files[0],pe);}else{pe(null);}}

function actualizarMulta(id){const uid=parseInt(document.getElementById('nm-depto').value);const r=document.getElementById('nm-regla').value;const m=parseInt(document.getElementById('nm-monto').value)||0;const mo=document.getElementById('nm-motivo').value.trim();const fc=document.querySelector('#nm-motivo').closest('.form-row').previousElementSibling.querySelector('input').value;if(!uid||!m||m<=0||!mo){showToast('Complete los campos requeridos','error');return;}const mu=(appData.multas||[]).find(x=>x.id===id);if(!mu){showToast('Multa no encontrada','error');return;}const dp=(appData.departamentos||[]).find(d=>d.id===uid);mu.unidad_id=uid;mu.encargado=dp?dp.representante:'';mu.regla=r;mu.monto=m;mu.motivo=mo;mu.fecha_creacion=fc;const f=document.getElementById('nm-file');const guardar=()=>{savePath('multas',appData.multas);closeModal();renderView();showToast('Multa actualizada ✓','success');};
const pe=(a)=>{if(!a){guardar();return;}showToast('Subiendo evidencia...','');const previa=mu.evidenciaRef;subirAdjunto(a).then(ref=>{delete mu.evidencia_url;mu.evidenciaRef=ref;mu.evidenciaNombre=a.name;guardar();if(previa)borrarAdjunto(previa);}).catch(e=>{showToast('Error al subir evidencia: '+e.message,'error');guardar();});};
if(f&&f.files.length>0){compressImage(f.files[0],pe);}else{pe(null);}}

function editarMulta(id){openNuevaMulta(id);}

function eliminarMulta(id){if(!confirm('¿Está seguro que desea ELIMINAR esta multa? Esta acción no se puede deshacer.'))return;const i=(appData.multas||[]).findIndex(m=>m.id===id);if(i===-1){showToast('Multa no encontrada','error');return;}const refEv=appData.multas[i].evidenciaRef;appData.multas.splice(i,1);savePath('multas',appData.multas);if(refEv)borrarAdjunto(refEv);renderView();showToast('Multa eliminada','success');}

function descargarVoucherMulta(id){const mu=(appData.multas||[]).find(m=>m.id===id);if(!mu)return;const dp=(appData.departamentos||[]).find(d=>d.id===mu.unidad_id)||{};
const fs=new Date(mu.fecha_creacion).toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'});
const W=600,H=tieneEvidencia(mu)?1020:820;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
cargarLogoVoucher().then(logo=>{
ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
const top=dibujarEncabezado(ctx,W,logo,'Notificación de Multa');
ctx.fillStyle=mu.estado==='Pagada'?'#10b981':'#EF4444';roundRect(ctx,W/2-50,top+24,100,32,16);ctx.fill();
ctx.fillStyle='#FFFFFF';ctx.font='bold 14px Inter, Arial';ctx.textAlign='center';ctx.fillText(mu.estado.toUpperCase(),W/2,top+46);
ctx.strokeStyle='#E5E7EB';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(60,top+80);ctx.lineTo(W-60,top+80);ctx.stroke();
let y=top+110;const LX=60;const RX=W-60;
const seccion=t=>{ctx.fillStyle='#111827';ctx.font='bold 13px Inter, Arial';ctx.textAlign='left';ctx.fillText(t,LX,y);y+=30;};
const dato=(et,va)=>{ctx.fillStyle='#9CA3AF';ctx.font='12px Inter, Arial';ctx.textAlign='left';ctx.fillText(et,LX,y);ctx.fillStyle='#111827';ctx.font='bold 14px Inter, Arial';ctx.textAlign='right';ctx.fillText(va,RX,y);};
const linea=()=>{ctx.strokeStyle='#E5E7EB';ctx.beginPath();ctx.moveTo(LX,y);ctx.lineTo(RX,y);ctx.stroke();y+=25;};
seccion('DEPARTAMENTO');
dato('N° Departamento',String(dp.numero||mu.unidad_id));y+=35;
dato('Encargado',mu.encargado||'—');y+=45;
linea();
seccion('DETALLE DE INFRACCIÓN');
dato('Regla infringida',mu.regla);y+=35;
ctx.fillStyle='#9CA3AF';ctx.font='12px Inter, Arial';ctx.textAlign='left';ctx.fillText('Motivo',LX,y);
ctx.fillStyle='#111827';ctx.font='13px Inter, Arial';ctx.textAlign='right';(mu.motivo.match(/.{1,60}/g)||[]).forEach(l=>{ctx.fillText(l,RX,y);y+=20;});y+=15;
dato('Fecha creación',fs);y+=45;
linea();
seccion('MONTO');
ctx.fillStyle='#10b981';ctx.font='bold 28px Inter, Arial';ctx.textAlign='right';ctx.fillText(fmt(mu.monto),RX,y);y+=60;
const fin=()=>{ctx.fillStyle='#9CA3AF';ctx.font='11px Inter, Arial';ctx.textAlign='center';
ctx.fillText('Documento generado automáticamente · Condominio Bosques del Sur 4',W/2,H-46);
ctx.fillText('ID Multa: #'+mu.id,W/2,H-28);
ctx.fillStyle=gradienteBanner(ctx,W,8);ctx.fillRect(0,H-8,W,8);
const url=cv.toDataURL('image/jpeg',0.95);
lastVoucher={img:url,tipo:'multa',depto:dp,multa:mu};
lastDownload={url:url,filename:'Multa_Depto'+(dp.numero||mu.unidad_id)+'_'+mu.fecha_creacion+'.jpg'};
mostrarVoucherMulta(url,mu,dp);};
if(tieneEvidencia(mu)){linea();seccion('EVIDENCIA ADJUNTA');
obtenerEvidencia(mu).then(ev=>{if(!ev){fin();return;}const im=new Image();im.onload=function(){const iw=400,ih=250,ix=(W-iw)/2;ctx.drawImage(im,ix,y,iw,ih);fin();};im.onerror=fin;im.src=ev.data||ev;});}
else{fin();}
});}

function mostrarVoucherMulta(img,mu,dp){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px;"><div class="modal-title">🧾 Voucher de Multa</div><div class="holo-wrap" style="margin-bottom:16px;"><img src="${img}" style="width:100%;border-radius:10px;border:1px solid var(--border);"/></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-danger" onclick="descargarUltimo()"> Descargar JPG</button><button class="btn btn-success" onclick="compartirUltimoVoucher()"> Compartir por WhatsApp</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;}

function verMulta(id){const m=(appData.multas||[]).find(x=>x.id===id);if(!m)return;const dp=(appData.departamentos||[]).find(d=>d.id===m.unidad_id)||{};document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">Detalle de Multa #${m.id}</div><div style="font-size:13px;line-height:1.8;"><strong>Departamento:</strong> ${dp.numero||m.unidad_id} - ${m.encargado||'—'}<br><strong>Regla:</strong> ${m.regla}<br><strong>Motivo:</strong> ${m.motivo}<br><strong>Fecha:</strong> ${m.fecha_creacion}<br><strong>Monto:</strong> ${fmt(m.monto)}<br><strong>Estado:</strong> <span class="badge ${m.estado==='Pagada'?'badge-green':'badge-red'}">${m.estado}</span><br>${tieneEvidencia(m)?`<strong>Evidencia:</strong> <button class="btn btn-ghost btn-sm" onclick="verArchivoMulta(${m.id})">📎 Ver adjunto</button><br>`:''}</div><div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;"><button class="btn btn-outline" onclick="descargarVoucherMulta(${m.id})">📥 Voucher</button>${m.estado!=='Pagada'&&!state.isTransparencia?`<button class="btn btn-success" onclick="marcarPagadaMulta(${m.id})">💳 Marcar Pagada</button>`:''}${!state.isTransparencia?`<button class="btn btn-warning" onclick="closeModal();editarMulta(${m.id})">✎ Editar</button><button class="btn btn-danger" onclick="eliminarMulta(${m.id})">✕ Eliminar</button>`:''}<button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;}

function verArchivoMulta(id){
const m=(appData.multas||[]).find(x=>x.id===id);
if(!tieneEvidencia(m))return;
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:580px;"><div class="modal-title">📎 Evidencia</div><div style="padding:28px;text-align:center;color:var(--text3);font-size:13px;">Cargando evidencia…</div></div></div>`;
obtenerEvidencia(m).then(ev=>{
if(!ev){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">📎 Evidencia</div><div style="padding:20px;text-align:center;color:var(--danger);font-size:13px;">No se pudo cargar la evidencia.</div><button class="btn btn-ghost" style="width:100%;" onclick="closeModal()">Cerrar</button></div></div>`;return;}
lastDownload={url:ev.data,filename:'Evidencia_Multa_'+m.id+'.jpg'};
const ii=ev.type&&ev.type.startsWith('image/');
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:580px;"><div class="modal-title">📎 Evidencia</div>${ii?`<img src="${ev.data}" style="width:100%;border-radius:8px;margin-bottom:12px"/>`:'<div style="padding:20px;text-align:center;color:var(--text3)">📄 Archivo adjunto</div>'}<div style="display:flex;gap:8px;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar</button><button class="btn btn-ghost" onclick="closeModal()" style="flex:1;">Cerrar</button></div></div></div>`;
});}

function marcarPagadaMulta(id){if(!confirm('¿Marcar esta multa como PAGADA?'))return;const m=(appData.multas||[]).find(x=>x.id===id);if(!m)return;m.estado='Pagada';m.fecha_pago=new Date().toISOString().split('T')[0];savePath('multas',appData.multas);renderView();showToast('Multa marcada como pagada ✓','success');}

/* ===== ARRANQUE DE LA APP (con anti-bloqueo) ===== */
document.addEventListener('DOMContentLoaded', async () => {
document.getElementById('logo-login').src=LOGO_SRC;
document.getElementById('topbar-logo').src=LOGO_SRC;
initFirebase();
initAuth();
authListo.then(()=>{if(state.loggedIn){iniciarDatosPrivados().then(ok=>{if(!ok){state.loggedIn=false;try{firebase.auth().signOut();}catch(e){}clearSession();iniciarDatosPublicos();}});}else{iniciarDatosPublicos();}});
initParticles();
const p=new URLSearchParams(window.location.search);
if(p.get('vista')==='transparencia'){state.isTransparencia=true;state.loggedIn=false;state.currentView='reportes';}
setTimeout(()=>{const ov=document.getElementById('loading-overlay');if(ov&&ov.style.display!=='none'){ov.style.display='none';if(state.loggedIn||state.isTransparencia){showApp();}else{const ls=document.getElementById('login-screen');if(ls){ls.style.display='flex';renderLoginScreen();}}}},6000);
if(!(state.loggedIn||state.isTransparencia)){renderLoginScreen();}
});