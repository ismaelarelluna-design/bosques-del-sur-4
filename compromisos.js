/* ===========================================================================
   Compromisos de pago — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   Registro liviano de un compromiso de un departamento moroso: que cuotas se
   compromete a pagar y hasta cuando. NO es un modulo de convenios con cuotas ni
   calcula intereses (si algun dia hacen falta, este registro es la base).

   Datos (Firebase):
     cbs4/compromisos/<id>  {id,folio,anio,n,depId,depNumero,representante,fecha,fechaLimite,
                             acordadoCon,nota,items:[{tipo:'gc',key,label,v}|{tipo:'multa',id,label,v}],
                             monto,estado:'vigente'|'anulado',anulado?{ts,por,motivo},
                             historial:[{ts,por,txt}],firmados:[{archivoRef,nombre,tipo,ts,por}],
                             creadoPor,rol,ts}
     cbs4/compContador/<anio>  (correlativo CPG, transaccion)

   Reglas de diseño:
   - La DEUDA NO SE BORRA NI SE CONGELA: el depto sigue en Morosidad con una insignia.
   - El estado se CALCULA al mostrar (compEstado): cumplido si ya pagó todo lo
     comprometido, incumplido si pasó la fecha limite sin pagar, vigente en otro caso.
     Solo "anulado" se guarda (con motivo). Asi no hay escrituras automaticas ni ruido
     en el registro de cambios.
   - Los certificados NO se alteran: siguen informando la deuda y solo agregan una
     linea informativa si hay compromiso vigente al emitir.
   - NUNCA se publica en Transparencia (contiene datos personales).
   - Las fotos del documento firmado usan docFirmadosModal() de actas.js.
   =========================================================================== */
const COMP_PLAZO_DEF=14;
function compromisosLista(){
 return comoListaConId(appData.compromisos).map(c=>({...c,items:comoLista(c.items),firmados:comoLista(c.firmados),historial:comoLista(c.historial)}));
}
function compPorId(id){return compromisosLista().find(c=>String(c.id)===String(id))||null;}
function compItemPagado(it,depId){
 if(it.tipo==='multa'){const m=(appData.multas||[]).find(x=>String(x.id)===String(it.id));return !m||m.estado==='Pagada'||m.estado==='Anulada';}
 return estaPagado(((appData.pagos||{})[it.key]||{})[depId]);
}
function compPendientes(c){return c.items.filter(it=>!compItemPagado(it,c.depId));}
function compMontoPendiente(c){return compPendientes(c).reduce((s,it)=>s+(Number(it.v)||0),0);}
function compEstado(c){
 if(c.estado==='anulado'||c.anulado)return 'anulado';
 if(!compPendientes(c).length)return 'cumplido';
 return actaHoyISO()>c.fechaLimite?'incumplido':'vigente';
}
function compActivoDe(depId){
 return compromisosLista().filter(c=>String(c.depId)===String(depId)&&['vigente','incumplido'].includes(compEstado(c)))
  .sort((a,b)=>(b.ts||0)-(a.ts||0))[0]||null;
}
function compVigenteDe(depId){const c=compActivoDe(depId);return c&&compEstado(c)==='vigente'?c:null;}
function compChip(est){
 const m={vigente:['comp-vig','Vigente'],cumplido:['aldia','Cumplido'],incumplido:['deuda','Incumplido'],anulado:['anulado','Anulado']}[est]||['','—'];
 return `<span class="cert-chip ${m[0]}">${m[1]}</span>`;
}
function compDias(iso){
 const a=new Date(actaHoyISO()+'T00:00:00'),b=new Date(iso+'T00:00:00');return Math.round((b-a)/86400000);
}
function compTextoPlazo(c){
 const d=compDias(c.fechaLimite);
 if(d>1)return 'faltan '+d+' días';if(d===1)return 'vence mañana';if(d===0)return 'vence hoy';
 return 'venció hace '+(-d)+' día'+(d===-1?'':'s');
}

/* Aviso del menú (Morosidad): compromisos vencidos sin pago completo */
function compIncumplidosCount(){return compromisosLista().filter(c=>compEstado(c)==='incumplido').length;}

/* ---------- integracion con Morosidad ---------- */
function compInsignia(depId){
 const c=compActivoDe(depId);if(!c)return '';
 const est=compEstado(c);
 return `<span class="cert-chip ${est==='vigente'?'comp-vig':'deuda'}" style="cursor:pointer" onclick="verCompromiso('${esc(c.id)}')" title="${esc(c.folio)}">🤝 Compromiso ${est==='vigente'?'vigente hasta '+esc(actaFechaCorta(c.fechaLimite)):'incumplido (venció el '+esc(actaFechaCorta(c.fechaLimite))+')'}</span>`;
}
function compBoton(depId){
 const c=compActivoDe(depId);
 return c?`<button class="btn btn-outline btn-sm" onclick="verCompromiso('${esc(c.id)}')">🤝 Ver compromiso</button>`
  :`<button class="btn btn-outline btn-sm" onclick="openCompromiso('${esc(depId)}')">🤝 Compromiso de pago</button>`;
}
function htmlCompromisosPanel(){
 const l=compromisosLista();if(!l.length)return '';
 const act=l.filter(c=>['vigente','incumplido'].includes(compEstado(c))).sort((a,b)=>String(a.fechaLimite).localeCompare(String(b.fechaLimite)));
 return `<div class="card comp-panel" style="margin-bottom:14px">
  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:${act.length?10:0}px">
   <div style="font-weight:700;color:var(--text)">🤝 Compromisos de pago <span style="font-weight:500;color:var(--text3);font-size:12px">· ${act.length} activo${act.length===1?'':'s'}</span></div>
   <button class="btn btn-ghost btn-sm" onclick="compHistorialModal()">Historial (${l.length})</button></div>
  ${act.map(c=>`<div class="comp-fila" onclick="verCompromiso('${esc(c.id)}')">
   <div style="flex:1;min-width:0"><b>Depto ${esc(c.depNumero)}</b> <span style="color:var(--text3);font-size:12px">${esc(c.representante||'')}</span>
    <div style="font-size:11px;color:var(--text3)">${esc(c.folio)} · pendiente ${fmt(compMontoPendiente(c))} · límite ${esc(actaFechaCorta(c.fechaLimite))} (${esc(compTextoPlazo(c))})</div></div>${compChip(compEstado(c))}</div>`).join('')}
  </div>`;
}

/* ---------- crear ---------- */
function openCompromiso(depId){
 const mor=calcularMorosidad('todo').find(m=>String(m.dep.id)===String(depId));
 if(!mor){showToast('El departamento no registra deuda','error');return;}
 if(compActivoDe(depId)){verCompromiso(compActivoDe(depId).id);return;}
 const dep=mor.dep,hoy=actaHoyISO();
 const gc=mor.gcMeses.slice().sort((a,b)=>a.key.localeCompare(b.key));
 const rol=((ADMINS||[]).find(a=>a.u===checkSession())||{}).rol||'';
 const fila=(tipo,k,label,v,chk)=>`<label class="cp-it"><input type="checkbox" class="cp-ck" data-tipo="${tipo}" data-k="${esc(k)}" data-v="${v}" data-label="${esc(label)}" ${chk?'checked':''} onchange="compRecalcular()"/><span>${esc(label)}</span><b>${fmt(v)}</b></label>`;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px">
  <div class="modal-title">🤝 Compromiso de pago — Depto ${esc(dep.numero)}</div>
  <div class="cert-resumen deuda"><div><strong>${esc(dep.representante||'Sin representante')}</strong><div style="font-size:11px;color:var(--text3)">Deuda total registrada (todo el historial)</div></div><span class="cert-chip deuda">${fmt(mor.total)}</span></div>
  <div style="font-size:12px;font-weight:700;color:var(--text2);margin:14px 0 6px;text-transform:uppercase;letter-spacing:.05em">¿Qué se compromete a pagar?</div>
  <div class="cp-lista">${gc.map(g=>fila('gc',g.key,'Gasto común '+g.label,g.monto,true)).join('')}${mor.multas.map(m=>fila('multa',m.id,'Multa '+(m.fecha_creacion||'')+(m.regla?' · '+m.regla:''),m.monto,false)).join('')}</div>
  <div id="cp-total" class="cp-total"></div>
  <div class="form-row form-row-2" style="margin-top:12px"><div><label class="fl">Fecha del acuerdo</label><input class="fi" id="cp-fecha" type="date" value="${hoy}"/></div>
   <div><label class="fl">Pagará a más tardar el</label><input class="fi" id="cp-limite" type="date" value="${pdfSumarDias(hoy,COMP_PLAZO_DEF)}" min="${hoy}"/>
    <div class="cp-presets"><button type="button" onclick="compPlazo(7)">+7 días</button><button type="button" onclick="compPlazo(14)">+14</button><button type="button" onclick="compPlazo(30)">+30</button></div></div></div>
  <div class="form-row form-row-2"><div><label class="fl">Acordado con (directiva)</label><input class="fi" id="cp-con" maxlength="80" value="${esc(rol)}" placeholder="Ej: Tesorera"/></div>
   <div><label class="fl">Nota (opcional, sale en el PDF)</label><input class="fi" id="cp-nota" maxlength="200" placeholder="Ej: Pagará por transferencia"/></div></div>
  <div style="font-size:11px;color:var(--text3);line-height:1.5">La deuda <b>no se borra ni se congela</b>: el depto seguirá en Morosidad con la insignia de compromiso, y los certificados seguirán informando la deuda. No se calculan intereses. Después podrás generar el PDF para firmar y subir la foto firmada.</div>
  <div style="display:flex;gap:10px;margin-top:14px"><button class="btn btn-success" id="cp-btn" onclick="guardarCompromiso('${esc(depId)}')">Registrar compromiso</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
 compRecalcular(mor.total);
}
function compPlazo(n){const f=document.getElementById('cp-fecha').value||actaHoyISO();document.getElementById('cp-limite').value=pdfSumarDias(f,n);}
function compRecalcular(totalDeuda){
 const sel=[...document.querySelectorAll('.cp-ck:checked')],suma=sel.reduce((s,c)=>s+(Number(c.dataset.v)||0),0);
 const el=document.getElementById('cp-total');if(!el)return;
 if(typeof totalDeuda==='number')el.dataset.deuda=totalDeuda;const deuda=Number(el.dataset.deuda)||0;
 el.innerHTML=`<span>Total del compromiso (${sel.length} concepto${sel.length===1?'':'s'})</span><b>${fmt(suma)}</b>`+(deuda>suma?`<div class="cp-aviso">Quedan ${fmt(deuda-suma)} fuera del compromiso: siguen exigibles.</div>`:'');
}
async function guardarCompromiso(depId){
 const btn=document.getElementById('cp-btn');
 try{
  const mor=calcularMorosidad('todo').find(m=>String(m.dep.id)===String(depId));
  if(!mor)throw new Error('El departamento ya no registra deuda');
  if(compActivoDe(depId))throw new Error('Ya existe un compromiso activo para este departamento');
  const sel=[...document.querySelectorAll('.cp-ck:checked')];
  if(!sel.length)throw new Error('Selecciona al menos un concepto');
  const fecha=document.getElementById('cp-fecha').value,lim=document.getElementById('cp-limite').value;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!/^\d{4}-\d{2}-\d{2}$/.test(lim))throw new Error('Indica las fechas');
  if(lim<actaHoyISO())throw new Error('La fecha límite no puede estar en el pasado');
  if(lim<fecha)throw new Error('La fecha límite no puede ser anterior al acuerdo');
  if(btn){btn.disabled=true;btn.textContent='Guardando…';}
  const items=sel.map(c=>c.dataset.tipo==='multa'?{tipo:'multa',id:c.dataset.k,label:c.dataset.label,v:Number(c.dataset.v)||0}:{tipo:'gc',key:c.dataset.k,label:c.dataset.label,v:Number(c.dataset.v)||0});
  const anio=parseInt(fecha.slice(0,4));
  const maxN=compromisosLista().filter(c=>c.anio===anio).reduce((m,c)=>Math.max(m,parseInt(c.n)||0),0);
  const tr=await db.ref('cbs4/compContador/'+anio).transaction(v=>Math.max(parseInt(v)||0,maxN)+1);
  if(!tr.committed)throw new Error('No se pudo asignar folio');
  const n=tr.snapshot.val(),u=checkSession()||'',adm=((ADMINS||[]).find(a=>a.u===u))||{};
  const id=db.ref('cbs4/compromisos').push().key;
  const rec={id,folio:'CPG-'+anio+'-'+String(n).padStart(3,'0'),anio,n,depId:mor.dep.id,depNumero:mor.dep.numero,representante:String(mor.dep.representante||'').trim(),
   fecha,fechaLimite:lim,acordadoCon:(document.getElementById('cp-con').value||'').trim().slice(0,80),nota:(document.getElementById('cp-nota').value||'').trim().slice(0,200),
   items,monto:items.reduce((s,i)=>s+i.v,0),estado:'vigente',creadoPor:u,rol:adm.rol||'',ts:Date.now()};
  appData.compromisos=compromisosLista().concat([rec]);
  await savePath('compromisos/'+id,rec);
  showToast('Compromiso '+rec.folio+' registrado ✓','success');
  verCompromiso(id);
 }catch(err){console.error(err);showToast(err.message||'No se pudo registrar','error');if(btn){btn.disabled=false;btn.textContent='Registrar compromiso';}}
}

/* ---------- ver / gestionar ---------- */
function verCompromiso(id){
 const c=compPorId(id);if(!c)return;
 const est=compEstado(c),pend=compMontoPendiente(c);
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)compCerrarVista()"><div class="modal" style="max-width:600px">
  <div class="modal-title">🤝 ${esc(c.folio)} — Depto ${esc(c.depNumero)}</div>
  <div class="cert-resumen ${est==='incumplido'?'deuda':(est==='cumplido'?'aldia':'')}"><div><strong>${esc(c.representante||'Sin representante')}</strong>
   <div style="font-size:11px;color:var(--text3)">Acuerdo del ${esc(actaFechaLarga(c.fecha))}${c.acordadoCon?' · con '+esc(c.acordadoCon):''}</div></div>${compChip(est)}</div>
  <div class="acta-datos" style="margin-top:12px"><div><span>Pagará a más tardar el</span><b>${esc(actaFechaLarga(c.fechaLimite))}${est==='vigente'||est==='incumplido'?' ('+esc(compTextoPlazo(c))+')':''}</b></div>
   <div><span>Comprometido</span><b>${fmt(c.monto)}</b></div><div><span>Pendiente hoy</span><b style="color:${pend?'var(--danger)':'var(--green)'}">${fmt(pend)}</b></div></div>
  <div class="cp-lista" style="margin-top:12px">${c.items.map(it=>{const ok=compItemPagado(it,c.depId);return `<div class="cp-it ro"><span>${ok?'✅':'⏳'} ${esc(it.label)}</span><b style="${ok?'text-decoration:line-through;opacity:.6':''}">${fmt(it.v)}</b></div>`;}).join('')}</div>
  ${c.nota?`<div style="font-size:12px;color:var(--text2);margin-top:10px"><b>Nota:</b> ${esc(c.nota)}</div>`:''}
  ${c.anulado?`<div style="font-size:12px;color:var(--danger);margin-top:10px"><b>Anulado:</b> ${esc(c.anulado.motivo||'')}</div>`:''}
  ${c.historial.length?`<div class="nov-hist" style="margin-top:10px">${c.historial.map(h=>`<div class="nov-hist-fila">${esc(h.txt)}<br><span>${esc(new Date(h.ts||0).toLocaleString('es-CL'))} · ${esc(h.por||'')}</span></div>`).join('')}</div>`:''}
  <div style="font-size:11px;color:var(--text3);margin-top:10px;line-height:1.5">${est==='incumplido'?'El plazo venció sin pago completo: el Comité puede retomar las acciones de cobro. ':''}El estado se actualiza solo según los pagos registrados. Este compromiso no se publica en Transparencia.</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
   <button class="btn btn-primary" onclick="compVerPDF('${esc(c.id)}')">📄 PDF para firmar</button>
   <button class="btn btn-ghost" onclick="docFirmadosModal('compromisos','${esc(c.id)}')">📸 Firmado${c.firmados.length?' ('+c.firmados.length+')':''}</button>
   ${est==='vigente'||est==='incumplido'?`<button class="btn btn-ghost" onclick="openCompExtender('${esc(c.id)}')">📅 Cambiar fecha</button><button class="btn btn-ghost" style="color:var(--danger)" onclick="openCompAnular('${esc(c.id)}')">🚫 Anular</button>`:''}
   <button class="btn btn-ghost" onclick="compCerrarVista()">Cerrar</button></div></div></div>`;
}
function compCerrarVista(){closeModal();renderView();}
function compGuardarRec(rec){appData.compromisos=compromisosLista().filter(x=>String(x.id)!==String(rec.id)).concat([rec]);return savePath('compromisos/'+rec.id,rec);}
function openCompExtender(id){
 const c=compPorId(id);if(!c)return;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:460px">
  <div class="modal-title">📅 Cambiar fecha límite — ${esc(c.folio)}</div>
  <div class="form-row"><div><label class="fl">Nueva fecha límite</label><input class="fi" id="ce-f" type="date" value="${esc(c.fechaLimite)}"/></div>
   <div><label class="fl">Motivo (obligatorio, queda en el historial)</label><input class="fi" id="ce-m" maxlength="140" placeholder="Ej: Solicitó una semana más"/></div></div>
  <div style="display:flex;gap:10px"><button class="btn btn-success" onclick="confirmarCompExtender('${esc(id)}')">Guardar</button><button class="btn btn-ghost" onclick="verCompromiso('${esc(id)}')">Volver</button></div></div></div>`;
}
async function confirmarCompExtender(id){
 const c=compPorId(id);if(!c)return;
 const f=document.getElementById('ce-f').value,m=(document.getElementById('ce-m').value||'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(f)){showToast('Indica la fecha','error');return;}
 if(m.length<3){showToast('Indica el motivo','error');return;}
 if(f===c.fechaLimite){showToast('La fecha no cambió','error');return;}
 const rec={...c,fechaLimite:f,historial:c.historial.concat([{ts:Date.now(),por:checkSession()||'',txt:'Fecha límite: '+actaFechaCorta(c.fechaLimite)+' → '+actaFechaCorta(f)+'. '+m.slice(0,140)}])};
 await compGuardarRec(rec);showToast('Fecha actualizada ✓','success');verCompromiso(id);
}
function openCompAnular(id){
 const c=compPorId(id);if(!c)return;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:460px">
  <div class="modal-title">🚫 Anular ${esc(c.folio)}</div>
  <div style="font-size:13px;color:var(--text2);margin-bottom:10px">Se anula el compromiso (no la deuda). El folio queda registrado como anulado.</div>
  <div class="form-row"><div><label class="fl">Motivo (obligatorio)</label><input class="fi" id="ca-m" maxlength="140" placeholder="Ej: Registrado por error"/></div></div>
  <div style="display:flex;gap:10px"><button class="btn btn-danger" onclick="confirmarCompAnular('${esc(id)}')">Anular compromiso</button><button class="btn btn-ghost" onclick="verCompromiso('${esc(id)}')">Volver</button></div></div></div>`;
}
async function confirmarCompAnular(id){
 const c=compPorId(id);if(!c)return;
 const m=(document.getElementById('ca-m').value||'').trim();if(m.length<3){showToast('Indica el motivo','error');return;}
 const rec={...c,estado:'anulado',anulado:{ts:Date.now(),por:checkSession()||'',motivo:m.slice(0,140)}};
 await compGuardarRec(rec);showToast('Compromiso anulado','success');verCompromiso(id);
}
function compHistorialModal(){
 const l=compromisosLista().sort((a,b)=>(b.ts||0)-(a.ts||0));
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)compCerrarVista()"><div class="modal" style="max-width:720px">
  <div class="modal-title">🤝 Historial de compromisos</div>
  ${l.length?`<div class="table-wrap"><table><thead><tr><th>Folio</th><th>Depto</th><th>Monto</th><th>Límite</th><th>Estado</th><th></th></tr></thead><tbody>${l.map(c=>`<tr><td><b>${esc(c.folio)}</b></td><td>${esc(c.depNumero)}<div style="font-size:11px;color:var(--text3)">${esc(c.representante||'')}</div></td><td>${fmt(c.monto)}</td><td>${esc(actaFechaCorta(c.fechaLimite))}</td><td>${compChip(compEstado(c))}</td><td><button class="btn btn-ghost btn-sm" onclick="verCompromiso('${esc(c.id)}')">Ver</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-txt">Sin compromisos registrados</div></div>'}
  <div style="margin-top:14px"><button class="btn btn-ghost" onclick="compCerrarVista()">Cerrar</button></div></div></div>`;
}

/* ---------- PDF ---------- */
async function pdfCompromiso(rec){
 if(!pdfListo())throw new Error('Librería PDF no disponible');
 const c=await pdfNuevo('Compromiso de Pago',rec.folio);
 const items=comoLista(rec.items);
 pdfTexto(c,'Folio N° '+rec.folio,{size:12,font:c.B,color:PDF_COL.marca});
 pdfTexto(c,'Acuerdo del '+actaFechaLarga(rec.fecha),{size:9.5,color:PDF_COL.gris,align:'right'});
 c.y+=10;pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,PDF_COL.borde,0.8);c.y+=20;
 const quien=rec.representante?', representada por '+rec.representante+',':',';
 pdfParrafo(c,'En el Condominio Bosques del Sur 4, la unidad N° '+rec.depNumero+quien+' reconoce adeudar los gastos comunes y/o multas que se detallan a continuación y se compromete a pagarlos íntegramente a más tardar el '+actaFechaLarga(rec.fechaLimite)+', según lo acordado con el Comité de Administración'+(rec.acordadoCon?' ('+rec.acordadoCon+')':'')+'.',{size:10.5,lh:15.5,despues:10});
 pdfFranja(c,[['Unidad','Depto '+rec.depNumero],['Monto comprometido',fmt(rec.monto),PDF_COL.marca],['Pagará a más tardar el',actaFechaLarga(rec.fechaLimite),PDF_COL.rojo]]);
 pdfSeccion(c,'1. Detalle de lo comprometido');
 pdfTabla(c,[{t:'N°',w:36},{t:'Concepto',w:PDF_W-PDF_M*2-36-120},{t:'Monto',w:120,align:'right'}],items.map((r,i)=>[String(i+1),r.label,fmt(r.v)]));
 pdfAsegurar(c,30);pdfTexto(c,'TOTAL COMPROMETIDO',{x:PDF_M+44,size:11,font:c.B,color:PDF_COL.marca,y:c.y+12});
 pdfTexto(c,fmt(rec.monto),{size:11,font:c.B,color:PDF_COL.marca,align:'right',right:PDF_W-PDF_M-8,y:c.y+12});c.y+=24;
 if(rec.nota)pdfParrafo(c,'Nota: '+rec.nota,{size:9.5,font:c.I,color:'#374151',despues:6,justify:false});
 pdfSeccion(c,'2. Condiciones');
 pdfClausula(c,'2.1','Forma de pago','Transferencia a '+PDF_BANCO.split(' · ')[0]+' · '+PDF_BANCO.split(' · ').slice(1).join(' · ')+', con referencia «Depto '+rec.depNumero+' · '+rec.folio+'». Los pagos se imputan a las deudas más antiguas.');
 pdfClausula(c,'2.2','Cumplimiento e incumplimiento','Pagado íntegramente dentro del plazo, el Comité no iniciará acciones de cobro por estos conceptos. Vencido el plazo sin pago completo, el compromiso queda sin efecto y el Comité podrá retomar el cobro (Ley N° 21.442, arts. 31 y 32, y reglamento de copropiedad) sin nuevo aviso.');
 pdfClausula(c,'2.3','Alcance','No condona ni modifica la deuda ni renuncia a intereses, multas u otros cobros que correspondan: solo fija un plazo acordado de pago. Mientras no se pague, la unidad seguirá con deuda en los certificados que emita el Comité. Documento informativo: no constituye asesoría jurídica ni reemplaza el aviso de cobro del administrador. Conserve una copia firmada.');
 pdfFirmasX(c,[['Representante de la unidad','Depto '+rec.depNumero],['Presidenta / Tesorera','Comité de Administración']]);
 pdfCerrar(c,'Compromiso de Pago');
 return await pdfBytes(c);
}
/* Franja de datos clave en una sola caja (ahorra espacio para que el documento quepa en 1 hoja) */
function pdfFranja(c,cols){
 const h=44,w=PDF_W-PDF_M*2,cw=w/cols.length;pdfAsegurar(c,h+8);
 pdfRect(c,PDF_M,c.y,w,h,PDF_COL.claro);pdfRect(c,PDF_M,c.y,3,h,PDF_COL.marca2);
 cols.forEach((k,i)=>{const x=PDF_M+14+i*cw;pdfTexto(c,k[0],{x,size:8,color:PDF_COL.gris,y:c.y+16});pdfTexto(c,k[1],{x,size:10.5,font:c.B,color:k[2]||PDF_COL.texto,y:c.y+33});});
 c.y+=h+10;
}
let compPdfActual=null;
async function compVerPDF(id){
 const c=compPorId(id);if(!c)return;
 let bytes;try{bytes=await pdfCompromiso(c);}catch(e){console.error(e);showToast('No se pudo generar el PDF: '+e.message,'error');return;}
 if(compPdfActual&&compPdfActual.url)URL.revokeObjectURL(compPdfActual.url);
 compPdfActual={bytes,nombre:'Compromiso de pago_'+c.depNumero+'.pdf',url:pdfUrl(bytes)};
 const vista=window.innerWidth>=820?`<iframe src="${compPdfActual.url}#view=FitH&toolbar=0" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:10px;background:#fff" title="Vista previa"></iframe>`
  :'<div style="padding:18px;text-align:center;font-size:13px;color:var(--text2);border:1px dashed var(--border);border-radius:10px">PDF generado. Usa los botones para descargarlo o abrirlo.</div>';
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:760px">
  <div class="modal-title">🤝 ${esc(c.folio)} — Depto ${esc(c.depNumero)}</div><div style="margin-bottom:14px">${vista}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="pdfDescargar(compPdfActual.bytes,compPdfActual.nombre)">⬇ Descargar PDF</button><button class="btn btn-ghost" onclick="window.open(compPdfActual.url,'_blank')">↗ Abrir en pestaña nueva</button><button class="btn btn-ghost" onclick="verCompromiso('${esc(id)}')">← Volver</button></div></div></div>`;
}
