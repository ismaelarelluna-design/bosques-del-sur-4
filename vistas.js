/* ===== vistas.js - CBS4 =====
   Vistas y acciones de: Dashboard, Gasto Comun (incl. registro de pago con tipo),
   Departamentos, Ingresos Extra y Gastos.
   El resto de las vistas y los generadores de documentos viven en vistas2.js.
   Este archivo tenia 22 funciones duplicadas que vistas2.js redefinia al cargarse
   despues; se eliminaron porque editarlas no tenia ningun efecto. */
function vDashboard(){
  const {currentYear,currentMonth}=state;
  const key=mkKey(currentYear,currentMonth);
  const bg=calcularBalanceGeneral();
  const gc=getGC(currentYear,currentMonth);
  const p=appData.pagos[key]||{};
  const pg=contarPagos(p);
  const fm=(appData.gastosFijos&&appData.gastosFijos[key])?appData.gastosFijos[key]:[];
  const f=fm.reduce((s,g)=>s+g.monto,0);
  const va=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).reduce((s,g)=>s+g.monto,0);
  const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).reduce((s,g)=>s+g.monto,0);
  const mp=(appData.multas||[]).filter(m=>m.anio===currentYear&&m.mes===currentMonth&&m.estado==='Pagada').reduce((s,m)=>s+m.monto,0);
  const tI=pg*gc+ex+mp, tE=f+va, bal=tI-tE;
  const isAdmin=!state.isTransparencia;
  
  return `<div class="page-title">Panel Central</div>
  <div class="page-sub">Año ${currentYear} — ${MESES[currentMonth]} | GC: ${fmt(gc)}/depto</div>
  ${monthTabs()}
  ${isAdmin?`<div style="margin-bottom:16px;"><button class="btn btn-primary" onclick="copyResidentesLink()">🔗 Copiar link para residentes</button></div>`:''}
  <div class="stats-grid">
    <div class="stat-card hero" style="grid-column: span 2;">
      <div class="stat-label">💰 Balance General Acumulado</div>
      <div class="stat-value" style="font-size:30px;">${fmt(bg)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><span class="stat-icon">📈</span>Ingresos</div>
      <div class="stat-value small">${fmt(pg*gc+ex)}</div>
      <div class="stat-meta">GC + Extras</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><span class="stat-icon">📉</span>Egresos</div>
      <div class="stat-value small">${fmt(tE)}</div>
      <div class="stat-meta">Fijos + Variables</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><span class="stat-icon">⚖️</span>Balance Mensual</div>
      <div class="stat-value small" style="color:${bal>=0?'var(--green)':'var(--danger)'}">${fmt(bal)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label"><span class="stat-icon">✅</span>Al Día</div>
      <div class="stat-value">${pg}<span style="font-size:13px;color:var(--text3)">/${TOTAL_DEPTOS}</span></div>
    </div>
  </div>
  <div class="charts-grid">
    <div class="card"><div class="card-title">Ingresos vs Egresos</div><canvas id="ch-bar"></canvas></div>
    <div class="card"><div class="card-title">Depto. Pagados (Global)</div><canvas id="ch-deptos"></canvas></div>
  </div>
  ${isAdmin&&typeof avisoRespaldo==='function'?avisoRespaldo():''}
  ${typeof cardNovedades==='function'?cardNovedades():''}
  ${cardMantencionesProximas()}
  ${cardTipoPago('ch-tipo-pago',currentYear,currentMonth)}
  <div class="card"><div class="card-title">Evolución Anual ${currentYear}</div><canvas id="ch-line"></canvas></div>`;
}

function vGastoComun(){
  const {currentYear,currentMonth}=state;
  const key=mkKey(currentYear,currentMonth);
  const gc=getGC(currentYear,currentMonth);
  const p=appData.pagos[key]||{};
  const pg=contarPagos(p);
  const rt=resumenTipoPago(currentYear,currentMonth);
  const isAdmin=!state.isTransparencia;
  return `<div class="page-title">Gasto Común</div><div class="page-sub">Valor período: ${fmt(gc)} por departamento</div>${monthTabs()}
  <div class="stats-grid">
    <div class="stat-card"><div class="stat-label"><span class="stat-icon">✅</span>Pagados</div><div class="stat-value">${pg}</div><div class="stat-meta">${fmt(pg*gc)}</div></div>
    <div class="stat-card"><div class="stat-label"><span class="stat-icon">⏳</span>Pendientes</div><div class="stat-value">${TOTAL_DEPTOS-pg}</div><div class="stat-meta">${fmt((TOTAL_DEPTOS-pg)*gc)}</div></div>
    <div class="stat-card"><div class="stat-label"><span class="stat-icon">💰</span>Recaudado</div><div class="stat-value small">${fmt(pg*gc)}</div></div>
    <div class="stat-card"><div class="stat-label"><span class="stat-icon"></span>Meta</div><div class="stat-value small">${fmt(TOTAL_DEPTOS*gc)}</div></div>
  </div>
  <div class="card mb-16">
    <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span style="font-weight:600;font-size:13px">Recaudación ${MESES[currentMonth]}</span><span style="font-size:13px;color:var(--text3)">${pg}/${TOTAL_DEPTOS} dptos</span></div>
    <div class="prog-bar"><div class="prog-fill" style="width:${Math.round(pg/TOTAL_DEPTOS*100)}%"></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--text3);margin-top:6px">
      <span>💵 Efectivo <strong style="color:var(--text2)">${rt.efectivo.deptos}</strong> · ${fmt(rt.efectivo.monto)} &nbsp;|&nbsp; 🏦 Transferencia <strong style="color:var(--text2)">${rt.transferencia.deptos}</strong> · ${fmt(rt.transferencia.monto)}</span>
      <span>${Math.round(pg/TOTAL_DEPTOS*100)}%</span>
    </div>
  </div>
  <div class="card">
    <div class="card-title">Estado por Departamento${isAdmin?' <span style="font-size:11px;color:var(--text3)">— clic para marcar/desmarcar</span>':''}</div>
    <div class="depto-grid">${(appData.departamentos||[]).map(d=>{
      const pi=normalizarPago(p[d.id]);const pd=pi.pagado;const tm=pd?tipoPagoMeta(pi.tipo):null;
      return `<div class="depto-cell ${pd?'paid':''} ${isAdmin?'clickable':''}" ${isAdmin?`onclick="togglePago('${key}',${d.id})"`:''}>
        <div class="depto-num">${d.numero}</div>
        <div class="depto-name">${d.representante||'—'}</div>
        <div class="depto-status">${pd?'✓ Pagado':'Pendiente'}</div>
        ${pd?`<div class="depto-tipo">${tm.icon} ${tm.label}</div>`:''}
        ${(isAdmin&&!pd)?`<button class="btn btn-ghost btn-sm" style="margin-top:4px;" onclick="event.stopPropagation();recordarMesActual(${d.id})">💬</button>`:''}
      </div>`;
    }).join('')}</div>
  </div>`;
}

/* Marcar/desmarcar pago. Al MARCAR se pide el tipo (efectivo/transferencia);
   al DESMARCAR se limpia el registro. Nunca escribe `true`: el formato nuevo es
   {pagado:true,tipo:...}. Los registros historicos en `true` se siguen leyendo sin migrar. */
function togglePago(key,id){
  if(state.isTransparencia)return;
  const actual=normalizarPago(((appData.pagos||{})[key]||{})[id]);
  if(actual.pagado){
    if(!appData.pagos)appData.pagos={};
    if(!appData.pagos[key])appData.pagos[key]={};
    appData.pagos[key][id]=false;
    savePath('pagos/'+key+'/'+id,false);
    renderView();
    showToast('Pago removido','');
    return;
  }
  pedirTipoPago(key,id);
}

function pedirTipoPago(key,id){
  const d=(appData.departamentos||[]).find(x=>x.id===id);
  const gc=getGC(state.currentYear,state.currentMonth);
  const btns=TIPOS_PAGO.map(t=>`<button class="btn" style="flex:1;display:block;padding:16px 8px;background:${t.btn};color:#fff;border:none;font-weight:700;" onclick="confirmarPago('${key}',${id},'${t.id}')"><span style="font-size:26px;display:block;line-height:1.2;">${t.icon}</span>${t.label}</button>`).join('');
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:380px;"><div class="modal-title">¿Cómo se pagó?</div><p style="font-size:13px;color:var(--text3);margin-bottom:18px;">Depto ${d?d.numero:id} · ${MESES[state.currentMonth]} ${state.currentYear} · ${fmt(gc)}</p><div style="display:flex;gap:10px;margin-bottom:12px;">${btns}</div><button class="btn btn-ghost" style="width:100%;" onclick="closeModal()">Cancelar</button></div></div>`;
}

function confirmarPago(key,id,tipo){
  if(!TIPOS_PAGO.some(t=>t.id===tipo))tipo=TIPO_PAGO_DEFAULT;
  if(!appData.pagos)appData.pagos={};
  if(!appData.pagos[key])appData.pagos[key]={};
  appData.pagos[key][id]={pagado:true,tipo:tipo};
  savePath('pagos/'+key+'/'+id,appData.pagos[key][id]);
  closeModal();
  renderView();
  showToast('Pago registrado ('+tipoPagoMeta(tipo).label+') ✓ — generando voucher...','success');
  setTimeout(()=>generarVoucher(key,id,tipo),400);
}

function vDepartamentos(){
  return `<div class="page-title">Departamentos</div><div class="page-sub">18 unidades — Datos de representantes</div>
  <div class="card"><div class="table-wrap"><table><thead><tr><th>Departamento</th><th>Representante</th><th>Contacto</th><th></th></tr></thead>
  <tbody>${(appData.departamentos||[]).map(d=>`<tr><td><strong style="color:var(--text)">${d.numero}</strong></td><td>${d.representante||'<span style="color:var(--text3)">Sin asignar</span>'}</td><td>${d.contacto||'—'}</td><td><button class="btn btn-primary btn-sm" onclick="openDepto(${d.id})">Editar</button></td></tr>`).join('')}</tbody></table></div></div>`;
}

function openDepto(id){
  const d=(appData.departamentos||[]).find(x=>x.id===id);
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">Editar Departamento</div>
  <div class="form-row"><div><label class="fl">Número / ID</label><input class="fi" id="m-num" value="${d.numero}"/></div></div>
  <div class="form-row"><div><label class="fl">Representante</label><input class="fi" id="m-rep" value="${d.representante}"/></div></div>
  <div class="form-row"><div><label class="fl">Contacto</label><input class="fi" id="m-con" value="${d.contacto}" placeholder="+56 9 XXXX XXXX"/></div></div>
  <div style="display:flex;gap:10px;margin-top:10px;"><button class="btn btn-primary" onclick="saveDepto(${id})">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}

function saveDepto(id){
  const d=(appData.departamentos||[]).find(x=>x.id===id);
  d.numero=document.getElementById('m-num').value||d.numero;
  d.representante=document.getElementById('m-rep').value;
  d.contacto=document.getElementById('m-con').value;
  savePath('departamentos',appData.departamentos);
  closeModal();
  showToast('Guardado ✓','success');
  renderView();
}

function vIngresosExtra(){
  const {currentYear,currentMonth}=state;
  const it=(appData.ingresosExtra||[]).filter(x=>x.anio===currentYear&&x.mes===currentMonth);
  const tot=it.reduce((s,x)=>s+x.monto,0);
  return `<div class="page-title">Ingresos Extras</div><div class="page-sub">Rifas, pactos de cuotas, actividades</div>${monthTabs()}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <div class="stat-card" style="flex:none;padding:12px 18px;"><div class="stat-label">Total ${MESES[currentMonth]}</div><div class="stat-value small">${fmt(tot)}</div></div>
    <button class="btn btn-success" onclick="openNuevoIngreso()">+ Agregar</button>
  </div>
  <div class="card">${it.length===0?`<div style="text-align:center;padding:28px;color:var(--text3)">Sin ingresos extras en ${MESES[currentMonth]}</div>`:
  `<div class="table-wrap"><table><thead><tr><th>Descripción</th><th>Tipo</th><th>Resumen</th><th>Monto</th><th></th></tr></thead>
  <tbody>${it.map(x=>{let r='-';if(x.tipo==='Pacto Cuotas'&&x.departamentosPagados){r=`<span class="badge badge-navy">${x.departamentosPagados.length}/18 DPTOS</span>`;}
  return `<tr><td>${x.descripcion}</td><td><span class="badge badge-green">${x.tipo}</span></td><td>${r}</td><td><strong>${fmt(x.monto)}</strong></td><td><button class="btn btn-danger btn-sm" onclick="delIngreso(${x.id})"></button>${x.tipo==='Pacto Cuotas'?`<button class="btn btn-outline btn-sm" onclick="openNuevoIngreso(${x.id})">✎</button>`:''}</td></tr>`;}).join('')}</tbody></table></div>`}</div>`;
}

function openNuevoIngreso(editId){
  let item=editId?(appData.ingresosExtra||[]).find(x=>x.id===editId):null;
  const {currentYear,currentMonth}=state;
  const title=item?`Editar: ${item.descripcion}`:`Nuevo Ingreso Extra — ${MESES[currentMonth]}`;
  const dv=item?item.descripcion:'';
  const tv=item?item.tipo:'Rifa';
  const mv=item?item.monto:'';
  let dc='';
  let ex=item&&item.departamentosEximidos?[...item.departamentosEximidos]:[];
  (appData.departamentos||[]).forEach(d=>{
    const ie=ex.includes(d.id);
    const ck=!ie&&item&&item.departamentosPagados&&item.departamentosPagados.includes(d.id)?'checked':'';
    dc+=`<div class="depto-row" id="depto-row-${d.id}" style="margin:4px 0;"><label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:6px 8px;border:1px solid var(--border);border-radius:6px;${ie?'background: var(--surface2);':''}"><input type="checkbox" class="depto-check" data-depto-id="${d.id}" ${ck} ${ie?'disabled':''}><span style="flex:1"><strong>${d.numero}</strong> — ${d.representante||'Sin nombre'}</span>${ie?'<span class="eximido-label" style="color:var(--text3);font-size:11px;">(Eximido)</span>':''}<button type="button" class="btn btn-sm ${ie?'btn-outline':'btn-ghost'}" onclick="eximirDepto(${d.id}, this)">${ie?'Restaurar':'Eximir'}</button></label></div>`;
  });
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">${title}</div>
  <div class="form-row"><div><label class="fl">Descripción</label><input class="fi" id="ni-d" value="${dv}"/></div></div>
  <div class="form-row form-row-2"><div><label class="fl">Tipo</label><select class="fi" id="ni-t" onchange="toggleIngresoFields()"><option value="Rifa" ${tv==='Rifa'?'selected':''}>Rifa</option><option value="Pacto Cuotas" ${tv==='Pacto Cuotas'?'selected':''}>Pacto Cuotas</option><option value="Actividad" ${tv==='Actividad'?'selected':''}>Actividad</option><option value="Otro" ${tv==='Otro'?'selected':''}>Otro</option></select></div><div id="field-monto"><label class="fl">Monto ($)</label><input class="fi" id="ni-m" type="number" placeholder="0" value="${mv}"/></div></div>
  <div id="field-pacto" style="display:none;"><div class="form-row"><div><label class="fl">Monto por Depto ($)</label><input class="fi" id="ni-m-unit" type="number" placeholder="0" value="${item&&item.montoUnitario?item.montoUnitario:''}"/></div></div><div class="form-row"><label class="fl">Deptos que pagan:</label><div class="depto-grid" id="pacto-deptos">${dc}</div><div style="font-size:11px;color:var(--text3);margin-top:8px;" id="pacto-count">0/18 seleccionados</div></div></div>
  <div style="display:flex;gap:10px;margin-top:10px;"><button class="btn btn-success" onclick="saveIngreso(${editId||'null'})">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
  if(item&&item.tipo==='Pacto Cuotas'){document.getElementById('field-monto').style.display='none';document.getElementById('field-pacto').style.display='block';updatePactoCount(item.departamentosPagados?item.departamentosPagados.length:0);}
  toggleIngresoFields();
}

function eximirDepto(id,btn){
  const row=document.getElementById(`depto-row-${id}`);
  const lb=row.querySelector('label');
  const cb=row.querySelector('input[type="checkbox"]');
  const ie=lb.querySelector('.eximido-label');
  if(ie){
    btn.textContent='Eximir';btn.classList.remove('btn-outline');btn.classList.add('btn-ghost');lb.style.backgroundColor='';ie.remove();cb.disabled=false;cb.checked=false;
  }else{
    btn.textContent='Restaurar';btn.classList.add('btn-outline');btn.classList.remove('btn-ghost');lb.style.backgroundColor='var(--surface2)';
    if(!lb.querySelector('.eximido-label')){const s=document.createElement('span');s.className='eximido-label';s.style.cssText='color:var(--text3);font-size:11px;';s.textContent='(Eximido)';lb.insertBefore(s,btn);}
    cb.disabled=true;cb.checked=false;
  }
  updatePactoCount();
}

function toggleIngresoFields(){
  const t=document.getElementById('ni-t').value;
  const fm=document.getElementById('field-monto');
  const fp=document.getElementById('field-pacto');
  if(t==='Pacto Cuotas'){fm.style.display='none';fp.style.display='block';}else{fm.style.display='block';fp.style.display='none';}
}

function updatePactoCount(c){const e=document.getElementById('pacto-count');if(e)e.textContent=`${c}/18 seleccionados`;}

function saveIngreso(editId){
  const {currentYear,currentMonth}=state;
  const d=document.getElementById('ni-d').value.trim();
  const t=document.getElementById('ni-t').value;
  let m=0,mu=0,dp=[],de=[];
  if(t==='Pacto Cuotas'){
    mu=parseInt(document.getElementById('ni-m-unit').value)||0;
    document.querySelectorAll('.depto-check:checked').forEach(c=>{dp.push(parseInt(c.getAttribute('data-depto-id')||c.value));});
    document.querySelectorAll('.eximido-label').forEach(el=>{const r=el.closest('.depto-row');const cb=r.querySelector('input[type="checkbox"]');de.push(parseInt(cb.getAttribute('data-depto-id')));});
    m=mu*dp.length;
    if(dp.length===0){showToast('Seleccione al menos un departamento','error');return;}
  }else{m=parseInt(document.getElementById('ni-m').value)||0;}
  if(!d||m<=0){showToast('Complete los campos','error');return;}
  if(!appData.ingresosExtra)appData.ingresosExtra=[];
  if(editId){
    const i=appData.ingresosExtra.findIndex(x=>x.id===editId);
    if(i!==-1){appData.ingresosExtra[i]={...appData.ingresosExtra[i],descripcion:d,tipo:t,monto:m,montoUnitario:mu,departamentosPagados:dp,departamentosEximidos:de};}
  }else{
    appData.ingresosExtra.push({id:Date.now(),anio:currentYear,mes:currentMonth,descripcion:d,tipo:t,monto:m,montoUnitario:mu,departamentosPagados:dp,departamentosEximidos:de});
  }
  savePath('ingresosExtra',appData.ingresosExtra);closeModal();renderView();showToast('Registrado ✓','success');
}

function delIngreso(id){appData.ingresosExtra=(appData.ingresosExtra||[]).filter(x=>x.id!=id);savePath('ingresosExtra',appData.ingresosExtra);renderView();showToast('Eliminado');}

function vEgresos(){
  const {currentYear,currentMonth}=state;
  const key=mkKey(currentYear,currentMonth);
  const va=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth);
  const fm=(appData.gastosFijos&&appData.gastosFijos[key])?appData.gastosFijos[key]:[];
  const tF=fm.reduce((s,g)=>s+g.monto,0);
  const tV=va.reduce((s,g)=>s+g.monto,0);

  /* Etiqueta de categoría: gris discreto cuando falta, badge cuando existe. */
  const badgeCat=(g)=>{const c=categoriaDeGasto(g);
    return c===SIN_CATEGORIA?`<span style="font-size:11px;color:var(--text3);font-style:italic;">${c}</span>`:`<span class="badge badge-navy">${c}</span>`;};

  /* Acciones con NOMBRE, no solo íconos. Se agrupan a la derecha y no se parten
     en varias líneas; la tabla tiene scroll horizontal en pantallas chicas. */
  const acciones=(g,tipo)=>{
    const ref=tipo==='fijo'?`'fijo',${g.id},'${key}'`:`'var',${g.id}`;
    const del=tipo==='fijo'?`delFijo(${g.id},'${key}')`:`delVariable(${g.id})`;
    return `<div style="display:flex;gap:6px;justify-content:flex-end;white-space:nowrap;">
      <button class="btn btn-outline btn-sm" onclick="editarGasto(${ref})" title="Editar este gasto">✎ Editar</button>
      ${tieneAdjunto(g)
        ? `<button class="btn btn-ghost btn-sm" onclick="quitarAdjunto(${ref})" title="Quitar el comprobante">✕ Quitar boleta</button>`
        : `<button class="btn btn-ghost btn-sm" onclick="adjuntarArchivo(${ref})" title="Adjuntar comprobante">📎 Adjuntar</button>`}
      <button class="btn btn-danger btn-sm" onclick="${del}" title="Eliminar el gasto">🗑 Eliminar</button>
    </div>`;};

  const celdaComprobante=(g,tipo)=>{
    const ref=tipo==='fijo'?`'fijo',${g.id},'${key}'`:`'var',${g.id}`;
    return tieneAdjunto(g)
      ? `<button class="btn btn-ghost btn-sm" onclick="verArchivo(${ref})">📎 Ver boleta</button>`
      : `<span style="color:var(--text3);font-size:12px;">Sin boleta</span>`;};

  const vacio=(cols,txt)=>`<tr><td colspan="${cols}" style="text-align:center;color:var(--text3);padding:22px;">${txt}</td></tr>`;

  return `<div class="page-title">Gastos</div><div class="page-sub">Gastos fijos y variables</div>${monthTabs()}
  <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:16px;">
    <div class="stat-card"><div class="stat-label">🔒 Gastos Fijos</div><div class="stat-value small">${fmt(tF)}</div></div>
    <div class="stat-card"><div class="stat-label">🔧 Gastos Variables</div><div class="stat-value small">${fmt(tV)}</div></div>
    <div class="stat-card"><div class="stat-label">💵 Total</div><div class="stat-value small">${fmt(tF+tV)}</div></div>
  </div>

  <div class="card mb-16">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <div><div class="card-title" style="margin:0">🔒 Gastos Fijos — ${MESES[currentMonth]}</div><div style="font-size:11px;color:var(--text3);margin-top:2px;">${fm.length} registro(s) · ${fmt(tF)}</div></div>
      <button class="btn btn-primary btn-sm" onclick="openNuevoFijo('${key}')">+ Agregar gasto fijo</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Gasto</th><th>Categoría</th><th style="text-align:right;">Monto</th><th>Comprobante</th><th style="text-align:right;">Acciones</th></tr></thead>
      <tbody>${fm.map(g=>`<tr>
        <td><strong style="font-weight:600;">${g.descripcion}</strong></td>
        <td>${badgeCat(g)}</td>
        <td style="text-align:right;white-space:nowrap;"><strong>${fmt(g.monto)}</strong></td>
        <td>${celdaComprobante(g,'fijo')}</td>
        <td>${acciones(g,'fijo')}</td>
      </tr>`).join('')||vacio(5,'Sin gastos fijos este mes')}</tbody>
    </table></div>
  </div>

  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      <div><div class="card-title" style="margin:0">🔧 Gastos Variables — ${MESES[currentMonth]}</div><div style="font-size:11px;color:var(--text3);margin-top:2px;">${va.length} registro(s) · ${fmt(tV)}</div></div>
      <button class="btn btn-success btn-sm" onclick="openNuevoVariable()">+ Agregar gasto variable</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Gasto</th><th>Categoría</th><th>Pago</th><th>N° Boleta</th><th style="text-align:right;">Monto</th><th>Comprobante</th><th style="text-align:right;">Acciones</th></tr></thead>
      <tbody>${va.map(g=>`<tr>
        <td><strong style="font-weight:600;">${g.descripcion}</strong></td>
        <td>${badgeCat(g)}</td>
        <td><span class="badge badge-orange">${g.tipoPago||'—'}</span></td>
        <td style="font-size:12px;color:var(--text3);">${g.boleta||'—'}</td>
        <td style="text-align:right;white-space:nowrap;"><strong>${fmt(g.monto)}</strong></td>
        <td>${celdaComprobante(g,'var')}</td>
        <td>${acciones(g,'var')}</td>
      </tr>`).join('')||vacio(7,`Sin gastos variables en ${MESES[currentMonth]}`)}</tbody>
    </table></div>
  </div>`;
}

function openNuevoFijo(key){
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">Nuevo Gasto Fijo</div>
  <div class="form-row"><div><label class="fl">Gasto</label>${selectConceptos('gf')}</div></div>
  <div class="form-row" id="gf-libre" style="display:none;"><div><label class="fl">Describe el gasto</label><input class="fi" id="gf-libre-input" placeholder="Ej: reparación de portón"/></div></div>
  <div class="form-row" id="gf-cat-wrap" style="display:none;"><div><label class="fl">Categoría</label>${selectCategorias('gf')}
    <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:var(--text2);cursor:pointer;"><input type="checkbox" id="gf-recordar" checked style="width:16px;height:16px;"/>Guardar este gasto en la lista para próximas veces</label></div></div>
  ${selectProveedor('gf')}
  <div class="form-row"><div><label class="fl">Monto Mensual ($)</label><input class="fi" id="gf-m" type="number" placeholder="0"/></div></div>
  <div class="form-row"><label class="fl">Comprobante (opcional)</label><div class="file-drop" onclick="document.getElementById('gf-file').click()">📎 Adjuntar imagen o PDF</div><input type="file" id="gf-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'gf-prev')"/><div id="gf-prev"></div></div>
  <div style="display:flex;gap:10px;margin-top:10px;"><button class="btn btn-primary" onclick="saveFijo('${key}')">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}

function saveFijo(key){
  const {descripcion:d,categoria:cat,recordar}=leerConcepto('gf');
  const m=parseInt(document.getElementById('gf-m').value)||0;
  if(!d||m<=0){showToast('Elige el gasto e ingresa el monto','error');return;}
  const f=document.getElementById('gf-file');
  const guardar=(extra)=>{
    if(!appData.gastosFijos)appData.gastosFijos={};
    if(!appData.gastosFijos[key])appData.gastosFijos[key]=[];
    appData.gastosFijos[key].push({id:Date.now(),descripcion:d,categoria:cat,monto:m,...proveedorExtra('gf'),...extra});
    savePath('gastosFijos/'+key,appData.gastosFijos[key]);
    if(recordar)agregarConcepto(d,cat);
    closeModal();renderView();showToast('Gasto fijo agregado ✓','success');
  };
  const p=(a)=>{
    if(!a){guardar({});return;}
    showToast('Subiendo comprobante...','');
    subirAdjunto(a)
      .then(ref=>guardar({archivoRef:ref,archivoNombre:a.name||'Comprobante'}))
      .catch(e=>{showToast('Error al subir el comprobante: '+e.message,'error');guardar({});});
  };
  if(f.files.length>0)compressImage(f.files[0],p);else p(null);
}

function delFijo(id,key){if(!appData.gastosFijos||!appData.gastosFijos[key])return;appData.gastosFijos[key]=appData.gastosFijos[key].filter(g=>g.id!=id);savePath('gastosFijos/'+key,appData.gastosFijos[key]);renderView();showToast('Eliminado');}

/* ===== EDITAR UN GASTO =====
   Permite corregir el concepto, la categoría, el monto y —en los variables— el
   tipo de pago y el N° de boleta. El comprobante adjunto no se toca aquí: se
   maneja con los botones de adjuntar/quitar de la tabla.
   Si el gasto quedó con un nombre que no está en la lista (los antiguos), el
   select arranca en «Otro…» con ese texto ya cargado. */
function editarGasto(t,id,key){
  const g = (t==='fijo')
    ? ((appData.gastosFijos&&appData.gastosFijos[key])?comoLista(appData.gastosFijos[key]).find(x=>x.id==id):null)
    : comoLista(appData.gastosVariables).find(x=>x.id==id);
  if(!g){showToast('No se encontró el gasto','error');return;}
  const enLista = conceptosDisponibles().some(c=>c.label===g.descripcion);
  const cat = g.categoria || '';
  const esVar = t!=='fijo';
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">✎ Editar gasto</div>
  <div class="form-row"><div><label class="fl">Gasto</label>${selectConceptos('ed',enLista?g.descripcion:'__otro__')}</div></div>
  <div class="form-row" id="ed-libre" style="display:${enLista?'none':'block'};"><div><label class="fl">Describe el gasto</label><input class="fi" id="ed-libre-input" value="${enLista?'':String(g.descripcion||'').replace(/"/g,'&quot;')}"/></div></div>
  <div class="form-row" id="ed-cat-wrap" style="display:${enLista?'none':'block'};"><div><label class="fl">Categoría</label>${selectCategorias('ed',cat||'Otros')}
    <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:var(--text2);cursor:pointer;"><input type="checkbox" id="ed-recordar" style="width:16px;height:16px;"/>Guardar este gasto en la lista para próximas veces</label></div></div>
  ${selectProveedor('ed',g.proveedorId)}
  <div class="form-row${esVar?' form-row-2':''}">${esVar?`<div><label class="fl">Tipo de Pago</label><select class="fi" id="ed-tp">${['Efectivo','Transferencia','Cheque'].map(x=>`<option ${g.tipoPago===x?'selected':''}>${x}</option>`).join('')}</select></div>`:''}<div><label class="fl">Monto ($)</label><input class="fi" id="ed-m" type="number" value="${g.monto||0}"/></div></div>
  ${esVar?`<div class="form-row"><div><label class="fl">N° Boleta (opcional)</label><input class="fi" id="ed-b" value="${String(g.boleta||'').replace(/"/g,'&quot;')}"/></div></div>`:''}
  <div style="font-size:11px;color:var(--text3);margin-bottom:12px;">El comprobante adjunto no se modifica desde aquí.</div>
  <div style="display:flex;gap:10px;"><button class="btn btn-primary" onclick="guardarEdicionGasto('${t}',${id},'${key||''}')">Guardar cambios</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
  /* si arranca en «Otro…», la categoría guardada manda sobre la sugerida */
  if(!enLista){const c=document.getElementById('ed-cat'); if(c&&cat)c.value=cat;}
}

function guardarEdicionGasto(t,id,key){
  const {descripcion:d,categoria:cat,recordar}=leerConcepto('ed');
  const m=parseInt(document.getElementById('ed-m').value)||0;
  if(!d||m<=0){showToast('Elige el gasto e ingresa el monto','error');return;}
  const esVar = t!=='fijo';
  const lista = esVar ? comoLista(appData.gastosVariables)
                      : comoLista((appData.gastosFijos||{})[key]);
  const g = lista.find(x=>x.id==id);
  if(!g){showToast('No se encontró el gasto','error');return;}
  g.descripcion=d;
  g.categoria=cat;
  g.monto=m;
  {const pv=leerProveedor('ed');if(pv)g.proveedorId=pv;else delete g.proveedorId;}
  if(esVar){
    const tp=document.getElementById('ed-tp'); if(tp)g.tipoPago=tp.value;
    const b=document.getElementById('ed-b');  if(b) g.boleta=b.value.trim();
  }
  if(esVar){appData.gastosVariables=lista;savePath('gastosVariables',lista);}
  else{appData.gastosFijos[key]=lista;savePath('gastosFijos/'+key,lista);}
  if(recordar)agregarConcepto(d,cat);
  closeModal();renderView();showToast('Gasto actualizado ✓','success');
}

function quitarAdjunto(t,id,key){
if(!confirm('¿Quitar el comprobante adjunto?'))return;
let g;
if(t==='fijo'){if(!appData.gastosFijos||!appData.gastosFijos[key])return;g=appData.gastosFijos[key].find(x=>x.id==id);}
else{g=(appData.gastosVariables||[]).find(x=>x.id==id);}
if(!g)return;
const ref=g.archivoRef;
delete g.archivo;delete g.archivoRef;delete g.archivoNombre;
if(t==='fijo')savePath('gastosFijos/'+key,appData.gastosFijos[key]);
else savePath('gastosVariables',appData.gastosVariables);
if(ref)borrarAdjunto(ref);
renderView();showToast('Adjunto quitado ✓','success');
}

function openNuevoVariable(){
  const {currentYear,currentMonth}=state;
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">Nuevo Gasto Variable — ${MESES[currentMonth]}</div>
  <div class="form-row"><div><label class="fl">Gasto</label>${selectConceptos('gv')}</div></div>
  <div class="form-row" id="gv-libre" style="display:none;"><div><label class="fl">Describe el gasto</label><input class="fi" id="gv-libre-input" placeholder="Ej: reparación de portón"/></div></div>
  <div class="form-row" id="gv-cat-wrap" style="display:none;"><div><label class="fl">Categoría</label>${selectCategorias('gv')}
    <label style="display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;color:var(--text2);cursor:pointer;"><input type="checkbox" id="gv-recordar" checked style="width:16px;height:16px;"/>Guardar este gasto en la lista para próximas veces</label></div></div>
  ${selectProveedor('gv')}
  <div class="form-row form-row-2"><div><label class="fl">Tipo de Pago</label><select class="fi" id="gv-t"><option>Efectivo</option><option>Transferencia</option><option>Cheque</option></select></div><div><label class="fl">Monto ($)</label><input class="fi" id="gv-m" type="number" placeholder="0"/></div></div>
  <div class="form-row"><div><label class="fl">N° Boleta (opcional)</label><input class="fi" id="gv-b"/></div></div>
  <div class="form-row"><label class="fl">Comprobante (opcional)</label><div class="file-drop" onclick="document.getElementById('gv-file').click()">📎 Adjuntar imagen o PDF</div><input type="file" id="gv-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'gv-prev')"/><div id="gv-prev"></div></div>
  <div style="display:flex;gap:10px;margin-top:10px;"><button class="btn btn-success" onclick="saveVariable(${currentYear},${currentMonth})">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}

function saveVariable(a,m){
  const {descripcion:d,categoria:cat,recordar}=leerConcepto('gv');
  const tp=document.getElementById('gv-t').value;
  const m2=parseInt(document.getElementById('gv-m').value)||0;
  const b=document.getElementById('gv-b').value.trim();
  if(!d||m2<=0){showToast('Elige el gasto e ingresa el monto','error');return;}
  const f=document.getElementById('gv-file');
  const guardar=(extra)=>{
    if(!appData.gastosVariables)appData.gastosVariables=[];
    appData.gastosVariables.push({id:Date.now(),anio:a,mes:m,descripcion:d,categoria:cat,tipoPago:tp,monto:m2,boleta:b,...proveedorExtra('gv'),...extra});
    savePath('gastosVariables',appData.gastosVariables);
    if(recordar)agregarConcepto(d,cat);
    closeModal();renderView();showToast('Gasto registrado ✓','success');
  };
  const p=(a2)=>{
    if(!a2){guardar({});return;}
    showToast('Subiendo comprobante...','');
    subirAdjunto(a2)
      .then(ref=>guardar({archivoRef:ref,archivoNombre:a2.name||'Comprobante'}))
      .catch(e=>{showToast('Error al subir el comprobante: '+e.message,'error');guardar({});});
  };
  if(f.files.length>0)compressImage(f.files[0],p);else p(null);
}

function delVariable(id){appData.gastosVariables=(appData.gastosVariables||[]).filter(g=>g.id!=id);savePath('gastosVariables',appData.gastosVariables);renderView();showToast('Eliminado');}

