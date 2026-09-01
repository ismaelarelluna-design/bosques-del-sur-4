/* ===== vistas.js — CBS4 ===== */
function vDashboard(){
  const {currentYear,currentMonth}=state;
  const key=mkKey(currentYear,currentMonth);
  const bg=calcularBalanceGeneral();
  const gc=getGC(currentYear,currentMonth);
  const p=appData.pagos[key]||{};
  const pg=Object.values(p).filter(Boolean).length;
  const fm=(appData.gastosFijos&&appData.gastosFijos[key])?appData.gastosFijos[key]:[];
  const f=fm.reduce((s,g)=>s+g.monto,0);
  const va=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).reduce((s,g)=>s+g.monto,0);
  const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).reduce((s,g)=>s+g.monto,0);
  const mp=(appData.multas||[]).filter(m=>m.anio===currentYear&&m.mes===currentMonth&&m.estado==='Pagada').reduce((s,m)=>s+m.monto,0);
  const tI=pg*gc+ex+mp, tE=f+va, bal=tI-tE;
  const isAdmin=!state.isTransparencia;
  
  return `<div class="page-title">Dashboard General</div>
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
  <div class="card"><div class="card-title">Evolución Anual ${currentYear}</div><canvas id="ch-line"></canvas></div>`;
}

function vGastoComun(){
  const {currentYear,currentMonth}=state;
  const key=mkKey(currentYear,currentMonth);
  const gc=getGC(currentYear,currentMonth);
  const p=appData.pagos[key]||{};
  const pg=Object.values(p).filter(Boolean).length;
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
    <div style="font-size:11px;color:var(--text3);text-align:right;margin-top:4px">${Math.round(pg/TOTAL_DEPTOS*100)}%</div>
  </div>
  <div class="card">
    <div class="card-title">Estado por Departamento${isAdmin?' <span style="font-size:11px;color:var(--text3)">— clic para marcar/desmarcar</span>':''}</div>
    <div class="depto-grid">${(appData.departamentos||[]).map(d=>{
      const pd=p[d.id]===true;
      return `<div class="depto-cell ${pd?'paid':''} ${isAdmin?'clickable':''}" ${isAdmin?`onclick="togglePago('${key}',${d.id})"`:''}>
        <div class="depto-num">${d.numero}</div>
        <div class="depto-name">${d.representante||'—'}</div>
        <div class="depto-status">${pd?'✓ Pagado':'Pendiente'}</div>
        ${(isAdmin&&!pd)?`<button class="btn btn-ghost btn-sm" style="margin-top:4px;" onclick="event.stopPropagation();recordarMesActual(${d.id})">💬</button>`:''}
      </div>`;
    }).join('')}</div>
  </div>`;
}

function togglePago(key,id){
  if(!appData.pagos)appData.pagos={};
  if(!appData.pagos[key])appData.pagos[key]={};
  const n=!appData.pagos[key][id];
  appData.pagos[key][id]=n;
  saveData();
  if(n){
    showToast('Pago registrado ✓ — generando voucher...','success');
    setTimeout(()=>generarVoucher(key,id),400);
  }else{
    showToast('Pago removido','');
  }
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
  saveData();
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
  saveData();closeModal();renderView();showToast('Registrado ✓','success');
}

function delIngreso(id){appData.ingresosExtra=(appData.ingresosExtra||[]).filter(x=>x.id!=id);saveData();renderView();showToast('Eliminado');}

function vEgresos(){
  const {currentYear,currentMonth}=state;
  const key=mkKey(currentYear,currentMonth);
  const va=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth);
  const fm=(appData.gastosFijos&&appData.gastosFijos[key])?appData.gastosFijos[key]:[];
  const tF=fm.reduce((s,g)=>s+g.monto,0);
  const tV=va.reduce((s,g)=>s+g.monto,0);
  return `<div class="page-title">Gastos</div><div class="page-sub">Gastos fijos y variables</div>${monthTabs()}
  <div class="stats-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:16px;">
    <div class="stat-card"><div class="stat-label">🔒 Gastos Fijos</div><div class="stat-value small">${fmt(tF)}</div></div>
    <div class="stat-card"><div class="stat-label"> Gastos Variables</div><div class="stat-value small">${fmt(tV)}</div></div>
    <div class="stat-card"><div class="stat-label">💵 Total</div><div class="stat-value small">${fmt(tF+tV)}</div></div>
  </div>
  <div class="card mb-16">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div class="card-title" style="margin:0"> Gastos Fijos (${MESES[currentMonth]})</div><button class="btn btn-primary btn-sm" onclick="openNuevoFijo('${key}')">+ Agregar</button></div>
    <div class="table-wrap"><table><thead><tr><th>Descripción</th><th>Monto</th><th>Comprobante</th><th></th></tr></thead><tbody>${fm.map(g=>`<tr><td>${g.descripcion}</td><td><strong>${fmt(g.monto)}</strong></td><td>${g.archivo?`<button class="btn btn-ghost btn-sm" onclick="verArchivo('fijo',${g.id},'${key}')">📎 Ver</button>`:'<span style="color:var(--text3)">—</span>'}</td><td style="white-space:nowrap;"><button class="btn btn-warning btn-sm" onclick="adjuntarArchivo('fijo',${g.id},'${key}')">📎</button>${g.archivo?`<button class="btn btn-danger btn-sm" onclick="quitarAdjunto('fijo',${g.id},'${key}')"></button>`:''}<button class="btn btn-danger btn-sm" onclick="delFijo(${g.id},'${key}')">🗑</button></td></tr>`).join('')}${fm.length===0?'<tr><td colspan="4" style="text-align:center;color:var(--text3)">Sin gastos fijos este mes</td></tr>':''}</tbody></table></div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><div class="card-title" style="margin:0">🔧 Gastos Variables — ${MESES[currentMonth]}</div><button class="btn btn-success btn-sm" onclick="openNuevoVariable()">+ Agregar</button></div>
    <div class="table-wrap"><table><thead><tr><th>Descripción</th><th>Pago</th><th>Boleta</th><th>Monto</th><th>Comprobante</th><th></th></tr></thead><tbody>${va.map(g=>`<tr><td>${g.descripcion}</td><td><span class="badge badge-orange">${g.tipoPago}</span></td><td style="font-size:11px;color:var(--text3)">${g.boleta||'—'}</td><td><strong>${fmt(g.monto)}</strong></td><td>${g.archivo?`<button class="btn btn-ghost btn-sm" onclick="verArchivo('var',${g.id})">📎 Ver</button>`:'<span style="color:var(--text3)">—</span>'}</td><td style="white-space:nowrap;"><button class="btn btn-warning btn-sm" onclick="adjuntarArchivo('var',${g.id})">📎</button>${g.archivo?`<button class="btn btn-danger btn-sm" onclick="quitarAdjunto('var',${g.id})">✕</button>`:''}<button class="btn btn-danger btn-sm" onclick="delVariable(${g.id})"></button></td></tr>`).join('')}${va.length===0?`<tr><td colspan="6" style="text-align:center;color:var(--text3)">Sin gastos variables en ${MESES[currentMonth]}</td></tr>`:''}</tbody></table></div>
  </div>`;
}

function openNuevoFijo(key){
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">Nuevo Gasto Fijo</div>
  <div class="form-row"><div><label class="fl">Descripción</label><input class="fi" id="gf-d"/></div></div>
  <div class="form-row"><div><label class="fl">Monto Mensual ($)</label><input class="fi" id="gf-m" type="number" placeholder="0"/></div></div>
  <div class="form-row"><label class="fl">Comprobante (opcional)</label><div class="file-drop" onclick="document.getElementById('gf-file').click()"> Adjuntar imagen o PDF</div><input type="file" id="gf-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'gf-prev')"/><div id="gf-prev"></div></div>
  <div style="display:flex;gap:10px;margin-top:10px;"><button class="btn btn-primary" onclick="saveFijo('${key}')">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}

function saveFijo(key){
  const d=document.getElementById('gf-d').value.trim();
  const m=parseInt(document.getElementById('gf-m').value)||0;
  if(!d||m<=0){showToast('Complete los campos','error');return;}
  const f=document.getElementById('gf-file');
  const p=(a)=>{
    if(!appData.gastosFijos)appData.gastosFijos={};
    if(!appData.gastosFijos[key])appData.gastosFijos[key]=[];
    appData.gastosFijos[key].push({id:Date.now(),descripcion:d,monto:m,archivo:a});
    saveData();closeModal();renderView();showToast('Gasto fijo agregado ✓','success');
  };
  if(f.files.length>0)compressImage(f.files[0],p);else p(null);
}

function delFijo(id,key){if(!appData.gastosFijos||!appData.gastosFijos[key])return;appData.gastosFijos[key]=appData.gastosFijos[key].filter(g=>g.id!=id);saveData();renderView();showToast('Eliminado');}

function quitarAdjunto(t,id,key){
  if(!confirm('¿Quitar el comprobante adjunto?'))return;
  if(t==='fijo'){
    if(!appData.gastosFijos||!appData.gastosFijos[key])return;
    const g=appData.gastosFijos[key].find(x=>x.id==id);
    if(g)delete g.archivo;
  }else{
    const g=(appData.gastosVariables||[]).find(x=>x.id==id);
    if(g)delete g.archivo;
  }
  saveData();renderView();showToast('Adjunto quitado ✓','success');
}

function openNuevoVariable(){
  const {currentYear,currentMonth}=state;
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">Nuevo Gasto Variable — ${MESES[currentMonth]}</div>
  <div class="form-row"><div><label class="fl">Descripción</label><input class="fi" id="gv-d"/></div></div>
  <div class="form-row form-row-2"><div><label class="fl">Tipo de Pago</label><select class="fi" id="gv-t"><option>Efectivo</option><option>Transferencia</option><option>Cheque</option></select></div><div><label class="fl">Monto ($)</label><input class="fi" id="gv-m" type="number" placeholder="0"/></div></div>
  <div class="form-row"><div><label class="fl">N° Boleta (opcional)</label><input class="fi" id="gv-b"/></div></div>
  <div class="form-row"><label class="fl">Comprobante (opcional)</label><div class="file-drop" onclick="document.getElementById('gv-file').click()">📎 Adjuntar imagen o PDF</div><input type="file" id="gv-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'gv-prev')"/><div id="gv-prev"></div></div>
  <div style="display:flex;gap:10px;margin-top:10px;"><button class="btn btn-success" onclick="saveVariable(${currentYear},${currentMonth})">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}

function saveVariable(a,m){
  const d=document.getElementById('gv-d').value.trim();
  const tp=document.getElementById('gv-t').value;
  const m2=parseInt(document.getElementById('gv-m').value)||0;
  const b=document.getElementById('gv-b').value.trim();
  if(!d||m2<=0){showToast('Complete los campos','error');return;}
  const f=document.getElementById('gv-file');
  const p=(a2)=>{
    if(!appData.gastosVariables)appData.gastosVariables=[];
    appData.gastosVariables.push({id:Date.now(),anio:a,mes:m,descripcion:d,tipoPago:tp,monto:m2,boleta:b,archivo:a2});
    saveData();closeModal();renderView();showToast('Gasto registrado ✓','success');
  };
  if(f.files.length>0)compressImage(f.files[0],p);else p(null);
}

function delVariable(id){appData.gastosVariables=(appData.gastosVariables||[]).filter(g=>g.id!=id);saveData();renderView();showToast('Eliminado');}

function generarVoucher(key,deptoId){
  const {currentYear,currentMonth}=state;
  const gc=getGC(currentYear,currentMonth);
  const depto=(appData.departamentos||[]).find(d=>d.id===deptoId);
  if(!depto)return;
  const ahora=new Date();
  const fs=ahora.toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'});
  const hs=ahora.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  const ms=MESES[currentMonth]+' '+currentYear;
  const W=600,H=820;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
  
  const dv=(dl)=>{
    ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
    const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,'#0E7490');g.addColorStop(1,'#2DD4BF');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,160);
    dl(ctx,W/2-40,10,80,80);
    ctx.fillStyle='#FFFFFF';ctx.font='bold 15px Inter, Arial';ctx.textAlign='center';ctx.fillText('CONDOMINIO BOSQUES DEL SUR 4',W/2,175);
    ctx.fillStyle='#4B5563';ctx.font='500 13px Inter, Arial';ctx.fillText('Voucher válido como comprobante de pago',W/2,195);
    ctx.fillStyle='#10b981';roundRect(ctx,W/2-80,210,160,44,22);ctx.fill();
    ctx.fillStyle='#FFFFFF';ctx.font='bold 20px Inter, Arial';ctx.fillText('✓ PAGADO',W/2,239);
    ctx.strokeStyle='#E5E7EB';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(40,260);ctx.lineTo(W-40,260);ctx.stroke();
    let y=300;
    st(ctx,'Datos del Departamento',W,y);y+=40;dr(ctx,'Departamento',depto.numero,W,y);y+=44;dr(ctx,'Representante',depto.representante||'—',W,y);y+=44;dr(ctx,'Contacto',depto.contacto||'—',W,y);y+=50;
    ctx.strokeStyle='#E5E7EB';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(W-40,y);ctx.stroke();y+=30;
    st(ctx,'Datos del Pago',W,y);y+=40;dr(ctx,'Período',ms,W,y);y+=44;dr(ctx,'Monto Gasto Común',fmt(gc),W,y);y+=44;dr(ctx,'Fecha de Pago',fs,W,y);y+=44;dr(ctx,'Hora',hs,W,y);y+=50;
    ctx.strokeStyle='#E5E7EB';ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(W-40,y);ctx.stroke();y+=30;
    ctx.fillStyle='#9CA3AF';ctx.font='11px Inter, Arial';ctx.textAlign='center';ctx.fillText('Documento generado automáticamente',W/2,y+20);
    ctx.fillText('Condominio Bosques del Sur 4 — '+new Date().getFullYear(),W/2,y+38);
    ctx.fillStyle='#0E7490';ctx.fillRect(0,H-8,W,8);
    try{return cv.toDataURL('image/jpeg',0.95);}catch(e){return null;}
  };
  const fb=(ctx,x,y,w,h)=>{ctx.fillStyle='#F1F5F9';ctx.fillRect(x,y,w,h);ctx.fillStyle='#0E7490';ctx.font='bold 16px Arial';ctx.textAlign='center';ctx.fillText('CBS4',x+w/2,y+h/2+6);};
  const img=new Image();img.crossOrigin='Anonymous';img.src=LOGO_SRC;let shown=false;
  const sv=(fn)=>{
    if(shown)return;shown=true;
    const url=dv(fn||fb);
    if(url){
      lastVoucher={img:url,tipo:'pago',depto,mesStr:ms,gc};
      lastDownload={url:url,filename:'Voucher_Depto_'+depto.numero+'_'+ms.replace(' ','_')+'.jpg'};
      mostrarVoucher(url,depto,ms,gc);
    }else showToast('Error generando imagen','error');
  };
  img.onload=()=>sv((ctx,x,y,w,h)=>{ctx.drawImage(img,x,y,w,h);});
  img.onerror=()=>sv(fb);setTimeout(()=>sv(fb),1500);
}

function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function st(ctx,t,W,y){ctx.fillStyle='#0E7490';ctx.font='bold 13px Inter, Arial';ctx.textAlign='left';ctx.fillText(t.toUpperCase(),44,y);}
function dr(ctx,l,v,W,y){ctx.fillStyle='#9CA3AF';ctx.font='12px Inter, Arial';ctx.textAlign='left';ctx.fillText(l,44,y);ctx.fillStyle='#111827';ctx.font='bold 14px Inter, Arial';ctx.textAlign='right';ctx.fillText(v,W-44,y);}

function mostrarVoucher(img,depto,ms,gc){
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px;"><div class="modal-title">🧾 Voucher de Pago</div><div class="holo-wrap" style="margin-bottom:16px;"><img src="${img}" style="width:100%;border-radius:10px;border:1px solid var(--border);"/></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar JPG</button><button class="btn btn-success" onclick="compartirUltimoVoucher()">📤 Compartir por WhatsApp</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
}

function adjuntarArchivo(t,id,key){
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">Adjuntar Comprobante</div><div class="file-drop" onclick="document.getElementById('adj-file').click()">Seleccionar imagen o PDF</div><input type="file" id="adj-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'adj-prev')"/><div id="adj-prev"></div><div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-primary" onclick="saveAdjunto('${t}',${id},'${key}')">Adjuntar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}

function saveAdjunto(t,id,key){
  const f=document.getElementById('adj-file');
  if(!f.files.length){showToast('Selecciona un archivo','error');return;}
  compressImage(f.files[0],d=>{
    if(t==='fijo'){if(!appData.gastosFijos[key])return;const g=appData.gastosFijos[key].find(x=>x.id==id);if(g)g.archivo=d;}
    else{const g=(appData.gastosVariables||[]).find(x=>x.id==id);if(g)g.archivo=d;}
    saveData();closeModal();renderView();showToast('Comprobante adjuntado ✓','success');
  });
}

function verArchivo(t,id,key){
  let g;
  if(t==='fijo'){if(!appData.gastosFijos||!appData.gastosFijos[key])return;g=appData.gastosFijos[key].find(x=>x.id==id);}
  else{g=(appData.gastosVariables||[]).find(x=>x.id==id);}
  if(!g||!g.archivo)return;
  lastDownload={url:g.archivo.data,filename:g.archivo.name};
  const ii=g.archivo.type&&g.archivo.type.startsWith('image/');
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:580px;"><div class="modal-title">📎 ${g.archivo.name}</div>${ii?`<img src="${g.archivo.data}" style="width:100%;border-radius:8px;margin-bottom:12px"/>`:'<div style="padding:20px;text-align:center;color:var(--text3)">📄 Archivo PDF adjunto</div>'}<div style="display:flex;gap:10px;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
}

function previewFile(i,p){
  const pr=document.getElementById(p);if(!i.files.length){pr.innerHTML='';return;}
  const f=i.files[0];const ii=f.type.startsWith('image/');
  const r=new FileReader();r.onload=e=>{pr.innerHTML=`<div class="file-preview">${ii?`<img src="${e.target.result}" style="height:40px;border-radius:4px"/>`:'📄'}<span class="file-name">${f.name}</span><span style="color:var(--text3);font-size:11px">${(f.size/1024).toFixed(1)}KB</span></div>`;};
  r.readAsDataURL(f);
}

function compressImage(file,cb,q=0.6){
  if(!file||!file.type.match('image.*')){const r=new FileReader();r.onload=e=>cb({name:file.name,type:file.type,data:e.target.result});r.readAsDataURL(file);return;}
  const r=new FileReader();
  r.onload=function(ev){
    const img=new Image();
    img.onload=function(){
      const cv=document.createElement('canvas');const cx=cv.getContext('2d');const mw=1024,mh=1024;
      let w=img.width,h=img.height;
      if(w>h){if(w>mw){h*=mw/w;w=mw;}}else{if(h>mh){w*=mh/h;h=mh;}}
      cv.width=w;cv.height=h;cx.drawImage(img,0,0,w,h);
      cb({name:file.name.replace(/\.[^/.]+$/,'.jpg'),type:'image/jpeg',data:cv.toDataURL('image/jpeg',q)});
    };
    img.onerror=()=>{const r2=new FileReader();r2.onload=e=>cb({name:file.name,type:file.type,data:e.target.result});r2.readAsDataURL(file);};
    img.src=ev.target.result;
  };
  r.readAsDataURL(file);
}

function readFileAsBase64(f,cb){compressImage(f,cb);}

function generarEstadoCuenta(id){
  const m=calcularMorosidad().find(x=>x.dep.id===id);if(!m)return;
  const rows=[];
  m.gcMeses.forEach(g=>rows.push({t:'GC '+g.label,v:g.monto}));
  m.multas.forEach(x=>rows.push({t:'Multa '+x.fecha_creacion+' · '+x.regla,v:x.monto}));
  const W=600;const H=420+rows.length*26+80;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
  ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
  const g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,'#0E7490');g.addColorStop(1,'#2DD4BF');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,120);
  ctx.fillStyle='#FFFFFF';ctx.font='bold 18px Inter, Arial';ctx.textAlign='center';ctx.fillText('ESTADO DE CUENTA',W/2,55);
  ctx.font='500 13px Inter, Arial';ctx.fillText('Condominio Bosques del Sur 4',W/2,80);
  ctx.fillStyle='#111827';ctx.font='bold 15px Inter, Arial';ctx.textAlign='left';ctx.fillText('Depto '+m.dep.numero+' — '+(m.dep.representante||''),40,160);
  let y=195;
  rows.forEach(r=>{ctx.fillStyle='#4B5563';ctx.font='13px Inter, Arial';ctx.textAlign='left';ctx.fillText('• '+r.t,40,y);ctx.textAlign='right';ctx.fillText(fmt(r.v),W-40,y);y+=26;});
  ctx.strokeStyle='#E5E7EB';ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(W-40,y);ctx.stroke();y+=32;
  ctx.fillStyle='#DC2626';ctx.font='bold 18px Inter, Arial';ctx.textAlign='left';ctx.fillText('TOTAL PENDIENTE:',40,y);ctx.textAlign='right';ctx.fillText(fmt(m.total),W-40,y);y+=40;
  ctx.fillStyle='#9CA3AF';ctx.font='11px Inter, Arial';ctx.textAlign='center';ctx.fillText('Romina Gabriela Figueroa Acevedo · Mercado Pago · Cta Vista N° 1088283442',W/2,y);
  const img=cv.toDataURL('image/jpeg',0.95);
  lastVoucher={img,tipo:'estado',depto:m.dep,texto:textoMoroso(m)};
  lastDownload={url:img,filename:'Estado_Cuenta_Depto_'+m.dep.numero+'.jpg'};
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px;"><div class="modal-title">📄 Estado de Cuenta — Depto ${m.dep.numero}</div><div class="holo-wrap" style="margin-bottom:16px;"><img src="${img}" style="width:100%;border-radius:10px;border:1px solid var(--border);"/></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar JPG</button><button class="btn btn-success" onclick="compartirUltimoVoucher()">📤 Compartir por WhatsApp</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
}

function vRecordatorios(){
  const t=state.ventanaMorosidad||'12';
  const mor=calcularMorosidad();
  const tot=mor.reduce((s,m)=>s+m.total,0);
  const lv=t==='12'?'Últimos 12 meses':(t==='anio'?'Año en curso':'Todo el historial');
  const cards=mor.map(m=>{
    const gr=m.gcMeses.map(g=>`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:2px 0;"><span>• ${g.label}</span><span>${fmt(g.monto)}</span></div>`).join('');
    const mr=m.multas.map(x=>`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:2px 0;"><span>• ${x.fecha_creacion} · ${x.regla}</span><span>${fmt(x.monto)}</span></div>`).join('');
    return `<div class="card" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;"><div><span style="font-size:16px;font-weight:700;color:var(--text);">Depto ${m.dep.numero}</span> <span style="color:var(--text3);font-size:12px;">${m.dep.representante||''}</span> <span style="color:var(--text3);font-size:11px;">📞 ${m.dep.contacto||'sin contacto'}</span></div><div style="font-size:16px;font-weight:800;color:var(--danger);">Total: ${fmt(m.total)}</div></div>${m.gcMeses.length?`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px;">Gasto común</div>${gr}</div>`:''}${m.multas.length?`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px;">Multas</div>${mr}</div>`:''}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn btn-success btn-sm" onclick="recordarMorosoWhatsApp(${m.dep.id})">💬 Recordar por WhatsApp</button><button class="btn btn-outline btn-sm" onclick="generarEstadoCuenta(${m.dep.id})">📄 Estado de cuenta</button></div></div>`;
  }).join('');
  return `<div class="page-title">Recordatorios de Morosidad</div><div class="page-sub">Cartera vencida desglosada (gasto común + multas)</div>
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <div class="stat-card" style="padding:10px 16px;"><div class="stat-label">Deptos morosos</div><div class="stat-value" style="font-size:20px;">${mor.length}</div></div>
      <div class="stat-card" style="padding:10px 16px;"><div class="stat-label">Total pendiente</div><div class="stat-value" style="font-size:20px;color:var(--danger);">${fmt(tot)}</div></div>
    </div>
    <select class="fi" style="width:auto;" onchange="state.ventanaMorosidad=this.value;renderView()"><option value="12" ${t==='12'?'selected':''}>Últimos 12 meses</option><option value="anio" ${t==='anio'?'selected':''}>Año en curso</option><option value="todo" ${t==='todo'?'selected':''}>Todo el historial</option></select>
  </div>
  <div style="font-size:11px;color:var(--text3);margin-bottom:12px;">Mostrando: ${lv}</div>${mor.length?cards:`<div class="card" style="text-align:center;padding:28px;color:var(--text3);">🎉 No hay morosidad en el período seleccionado</div>`}`;
}

function vReportes(){
  const {currentYear,currentMonth}=state;
  const key=mkKey(currentYear,currentMonth);
  const bg=calcularBalanceGeneral();
  const gc=getGC(currentYear,currentMonth);
  const p=appData.pagos[key]||{};
  const pg=Object.values(p).filter(Boolean).length;
  const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).reduce((s,g)=>s+g.monto,0);
  const fm=(appData.gastosFijos&&appData.gastosFijos[key])?appData.gastosFijos[key]:[];
  const f=fm.reduce((s,g)=>s+g.monto,0);
  const va=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).reduce((s,g)=>s+g.monto,0);
  const tI=pg*gc+ex,tE=f+va,bal=tI-tE;
  let h=`<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;flex-wrap:wrap;"><div class="logo-circ" style="width:46px;height:46px;border-radius:50%;overflow:hidden;border:2px solid var(--border);"><img src="${document.getElementById('topbar-logo').src}" style="width:100%;height:100%;object-fit:cover;"/></div><div style="flex:1"><div class="page-title" style="margin:0">Reporte Transparencia</div><div style="font-size:12px;color:var(--text3)">Condominio Bosques del Sur 4</div></div><button class="btn btn-primary btn-sm" onclick="window.print()">📄 Exportar PDF</button></div><div class="page-sub">${MESES[currentMonth]} ${currentYear} — Información pública</div>${monthTabs()}<div class="section-label first">🏠 Zona Residente</div><div class="bank-banner"><div class="bank-banner-icon"></div><div class="bank-banner-body"><div class="bank-banner-title">Datos para transferencia</div><div class="bank-banner-details"><div class="bank-banner-detail"><span class="bank-banner-detail-label">Nombre:</span><strong>Romina Gabriela Figueroa Acevedo</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">RUT:</span><strong>169111200</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">Banco:</span><strong>Mercado Pago</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">Tipo:</span><strong>Cuenta Vista</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">N° Cuenta:</span><strong>1088283442</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">Email:</span><strong>rominaaa2422@gmail.com</strong></div></div></div><button class="bank-banner-copy" onclick="copyBankData()">📋 Copiar</button></div><div class="info-cards-grid"><a href="https://github.com/ismaelarelluna-design/bosques-del-sur-4/raw/main/Reglamento%20interno%20BSD4.pdf" download="Reglamento_Interno_BSD4.pdf" class="info-card"><div class="info-card-icon">📄</div><div class="info-card-body"><div class="info-card-title">Descarga el Reglamento Interno + Anexo</div><div class="info-card-desc">Documento oficial del condominio en PDF</div></div><div class="info-card-arrow">→</div></a><a href="https://docs.google.com/forms/d/e/1FAIpQLSeRePmnAuBus-KWRRWEeUmF3Q-uJLRr3c-78kqnmUPlFFAqPg/viewform?pli=1" target="_blank" rel="noopener" class="info-card"><div class="info-card-icon">📨</div><div class="info-card-body"><div class="info-card-title">Buzón del Residente</div><div class="info-card-desc">Sugerencias, consultas, reclamos y reportes</div></div><div class="info-card-arrow">→</div></a></div><div class="section-label">📊 Resumen Financiero</div><div class="stats-grid"><div class="stat-card hero" style="grid-column: span 2;"><div class="stat-label">💰 Balance General Acumulado</div><div class="stat-value" style="font-size:30px;">${fmt(bg)}</div></div><div class="stat-card"><div class="stat-label"><span class="stat-icon">✅</span>Dptos Al Día</div><div class="stat-value">${pg}<span style="font-size:12px;color:var(--text3)">/${TOTAL_DEPTOS}</span></div><div class="stat-meta">${fmt(pg*gc)}</div></div><div class="stat-card"><div class="stat-label"><span class="stat-icon">📉</span>Egresos</div><div class="stat-value small">${fmt(tE)}</div></div><div class="stat-card"><div class="stat-label"><span class="stat-icon">️</span>Balance Mensual</div><div class="stat-value small" style="color:${bal>=0?'var(--green)':'var(--danger)'}">${fmt(bal)}</div></div></div><div class="section-label">📈 Análisis y Detalle</div><div class="charts-grid"><div class="card"><div class="card-title">Recaudación ${MESES[currentMonth]}</div><div style="text-align:center;padding:14px 0;"><div class="donut-wrap"><canvas id="ch-rep-dona" width="160" height="160"></canvas><div class="donut-label"><div class="donut-pct">${Math.round(pg/TOTAL_DEPTOS*100)}%</div><div class="donut-sub">al día</div></div></div><div style="margin-top:12px;font-size:13px;color:var(--text2)">${pg} de ${TOTAL_DEPTOS} dptos pagaron</div></div></div><div class="card"><div class="card-title">Distribución de Gastos</div><canvas id="ch-rep-bar"></canvas></div></div><div class="card mb-16"><div class="card-title">Movimiento de Pagos — Gasto Común ${currentYear}</div><canvas id="ch-gc-pagos" style="max-height:220px;"></canvas></div><div class="card"><div class="card-title">Detalle de Gastos — ${MESES[currentMonth]} ${currentYear}</div><div class="table-wrap"><table><thead><tr><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Comprobante</th></tr></thead><tbody>`;
  fm.forEach(g=>{h+=`<tr><td>${g.descripcion}</td><td><span class="badge badge-navy">Fijo</span></td><td>${fmt(g.monto)}</td><td>${g.archivo?`<button class="btn btn-ghost btn-sm" onclick="verArchivo('fijo',${g.id},'${key}')">📎 Ver boleta</button>`:'<span style="color:var(--text3)">—</span>'}</td></tr>`;});
  (appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).forEach(g=>{h+=`<tr><td>${g.descripcion}</td><td><span class="badge badge-orange">Variable</span></td><td>${fmt(g.monto)}</td><td>${g.archivo?`<button class="btn btn-ghost btn-sm" onclick="verArchivo('var',${g.id})">📎 Ver boleta</button>`:'<span style="color:var(--text3)">—</span>'}</td></tr>`;});
  h+=`</tbody></table></div></div>`;return h;
}

function copyLink(u){navigator.clipboard.writeText(u).then(()=>showToast('Link copiado ✓','success')).catch(()=>{const e=document.createElement('textarea');e.value=u;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);showToast('Link copiado ✓','success');});}
function copyBankData(){const t=`Romina Gabriela Figueroa Acevedo\nRUT: 169111200\nMercado Pago\nCuenta Vista\nNúmero de cuenta: 1088283442\nrominaaa2422@gmail.com`;navigator.clipboard.writeText(t).then(()=>showToast('Datos copiados ✓','success')).catch(()=>{const e=document.createElement('textarea');e.value=t;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);showToast('Datos copiados ✓','success');});}
function copyResidentesLink(){const u=window.location.origin+window.location.pathname+'?vista=transparencia';navigator.clipboard.writeText(u).then(()=>showToast('Link de residentes copiado ✓','success')).catch(()=>{const e=document.createElement('textarea');e.value=u;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);showToast('Link de residentes copiado ✓','success');});}

function vConfig(){
  const h=appData.gastoComunHistorial||[{desde:'2022-01',valor:DEFAULT_GC}];
  const so=[...h].sort((a,b)=>b.desde.localeCompare(a.desde));
  const cg=so[0]?so[0].valor:DEFAULT_GC;
  return `<div class="page-title">Configuración</div><div class="page-sub">Ajustes del sistema</div>
  <div class="card mb-16"><div class="config-section-title">💰 Valor Gasto Común</div>
  <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">
    <div style="flex:1;min-width:180px;"><label class="fl">Nuevo valor ($)</label><input class="fi" id="cfg-gc-val" type="number" value="${cg}"/></div>
    <div style="flex:1;min-width:180px;"><label class="fl">Vigente desde</label><select class="fi" id="cfg-gc-mes">${YEARS.map(y=>MESES.map((m,i)=>`<option value="${mkKey(y,i)}">${m} ${y}</option>`).join('')).join('')}</select></div>
    <button class="btn btn-primary" onclick="saveNuevoGC()">Guardar</button>
  </div>
  <div class="config-section-title" style="margin-top:4px;">Historial de valores</div>${so.map(x=>`<div class="history-item"><span>Desde <strong>${formatPeriodo(x.desde)}</strong></span><span style="font-weight:600;color:var(--green)">${fmt(x.valor)}/depto</span></div>`).join('')}
  </div>
  <div class="card mb-16"><div class="config-section-title">🎨 Apariencia</div>
  <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;">
    <div><div style="font-weight:600;font-size:14px;">Tema oscuro</div><div style="font-size:12px;color:var(--text3)">Modo nocturno</div></div>
    <label class="switch"><input type="checkbox" ${state.theme==='dark'?'checked':''} onchange="toggleTheme()"><span class="slider"></span></label>
  </div></div>
  <div class="card"><div class="config-section-title">🔥 Sincronización Firebase</div>
  <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:12px;">
    <span class="sync-dot ${state.connected?'':'off'}" style="width:12px;height:12px;flex-shrink:0;"></span>
    <div><div style="font-weight:600;font-size:13px;">${state.connected?'Conectado a Firebase':'Sin conexión'}</div><div style="font-size:11px;color:var(--text3)">Los datos se sincronizan en tiempo real entre todos los dispositivos</div></div>
  </div>
  <p style="font-size:12px;color:var(--text3);">ℹ️ Cualquier cambio se refleja automáticamente en los otros administradores conectados.</p></div>`;
}

function saveNuevoGC(){
  const v=parseInt(document.getElementById('cfg-gc-val').value);
  const d=document.getElementById('cfg-gc-mes').value;
  if(!v||v<=0){showToast('Ingrese un valor válido','error');return;}
  if(!appData.gastoComunHistorial)appData.gastoComunHistorial=[];
  const e=appData.gastoComunHistorial.find(x=>x.desde===d);
  if(e)e.valor=v;else appData.gastoComunHistorial.push({desde:d,valor:v});
  saveData();
  showToast(`GC actualizado a ${fmt(v)} desde ${formatPeriodo(d)} ✓`,'success');
}

function drawCharts(){
  try{
    const {currentYear,currentMonth}=state;
    const labM=MESES.map(m=>m.substring(0,3));
    const dk=state.theme==='dark';
    const gc=getGC(currentYear,currentMonth);
    const grid=dk?'rgba(255,255,255,0.05)':'rgba(15,23,42,0.05)';
    const tick=dk?'#94A3B8':'#64748B';
    const co={plugins:{legend:{labels:{color:tick,font:{family:'Inter',size:11}}}},scales:{y:{grid:{color:grid},ticks:{color:tick,callback:v=>fmt(v)}},x:{grid:{color:grid},ticks:{color:tick}}}};
    
    const b=document.getElementById('ch-bar');
    if(b){
      const ing=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const p=appData.pagos[k]||{};const pg=Object.values(p).filter(Boolean).length;const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===currentYear&&g.mes===i).reduce((s,g)=>s+g.monto,0);return pg*getGC(currentYear,i)+ex;});
      const eg=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const fm=(appData.gastosFijos&&appData.gastosFijos[k])?appData.gastosFijos[k]:[];const f=fm.reduce((s,g)=>s+g.monto,0);const v=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===i).reduce((s,g)=>s+g.monto,0);return f+v;});
      charts.bar=new Chart(b,{type:'bar',data:{labels:labM,datasets:[{label:'Ingresos',data:ing,backgroundColor:'rgba(45,212,191,0.85)',borderRadius:6},{label:'Egresos',data:eg,backgroundColor:'rgba(239,68,68,0.75)',borderRadius:6}]},options:{responsive:true,...co}});
    }
    const dc=document.getElementById('ch-deptos');
    if(dc){
      const dd=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const p=appData.pagos[k]||{};return Object.values(p).filter(Boolean).length;});
      charts.deptos=new Chart(dc,{type:'bar',data:{labels:labM,datasets:[{label:'Depto. Pagados',data:dd,backgroundColor:'rgba(8,145,178,0.85)',borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:grid},ticks:{color:tick,stepSize:1}},x:{grid:{color:grid},ticks:{color:tick}}}}});
    }
    const l=document.getElementById('ch-line');
    if(l){
      const ing=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const p=appData.pagos[k]||{};return Object.values(p).filter(Boolean).length*getGC(currentYear,i);});
      const eg=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const fm=(appData.gastosFijos&&appData.gastosFijos[k])?appData.gastosFijos[k]:[];const f=fm.reduce((s,g)=>s+g.monto,0);const v=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===i).reduce((s,g)=>s+g.monto,0);return f+v;});
      charts.line=new Chart(l,{type:'line',data:{labels:labM,datasets:[{label:'Ingresos GC',data:ing,borderColor:'#2DD4BF',backgroundColor:'rgba(45,212,191,0.08)',tension:0.4,fill:true,borderWidth:2},{label:'Egresos',data:eg,borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,0.06)',tension:0.4,fill:true,borderWidth:2}]},options:{responsive:true,...co}});
    }
    const rd=document.getElementById('ch-rep-dona');
    if(rd){
      const k=mkKey(currentYear,currentMonth);const p=appData.pagos[k]||{};const pg=Object.values(p).filter(Boolean).length;
      charts.rdona=new Chart(rd,{type:'doughnut',data:{labels:['Pagados','Pendientes'],datasets:[{data:[pg,TOTAL_DEPTOS-pg],backgroundColor:['#2DD4BF','#F59E0B'],borderWidth:0}]},options:{responsive:false,cutout:'72%',plugins:{legend:{display:false}}}});
    }
    const rb=document.getElementById('ch-rep-bar');
    if(rb){
      const k=mkKey(currentYear,currentMonth);const fb=(appData.gastosFijos&&appData.gastosFijos[k])?appData.gastosFijos[k]:[];const v2=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth);
      charts.rbar=new Chart(rb,{type:'bar',data:{labels:[...fb.map(g=>g.descripcion),...v2.map(g=>g.descripcion)],datasets:[{label:'Gastos Fijos',data:fb.map(g=>g.monto),backgroundColor:'rgba(185,28,28,0.9)',borderRadius:6},{label:'Gastos Variables',data:v2.map(g=>g.monto),backgroundColor:'rgba(248,113,113,0.85)',borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:true,labels:{color:tick,font:{family:'Inter',size:11}}}},scales:{y:{grid:{color:grid},ticks:{color:tick,callback:v=>fmt(v)}},x:{grid:{color:grid},ticks:{color:tick}}}}});
    }
    const gp=document.getElementById('ch-gc-pagos');
    if(gp){
      const rg=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const p=appData.pagos[k]||{};return Object.values(p).filter(Boolean).length*getGC(currentYear,i);});
      charts.gcpagos=new Chart(gp,{type:'line',data:{labels:labM,datasets:[{label:'Recaudado por Gasto Común',data:rg,borderColor:'#22D3EE',backgroundColor:'rgba(34,211,238,0.12)',tension:0.4,fill:true,borderWidth:2,pointBackgroundColor:'#0891B2',pointRadius:3}]},options:{responsive:true,...co}});
    }
  }catch(e){console.error(e);}
}

function renderLoginScreen(){
  let bu=localStorage.getItem('cbs4_biometric_enabled');
  if(bu&&!ADMINS.some(a=>a.u===bu)){localStorage.removeItem('cbs4_biometric_enabled');bu=null;}
  const ba=document.getElementById('biometric-area');
  const fa=document.getElementById('login-form-area');
  const st=document.getElementById('login-sub-text');
  if(bu){ba.style.display='block';fa.style.display='none';st.textContent='Bienvenido, '+bu;}
  else{ba.style.display='none';fa.style.display='block';st.textContent='Panel de Administración';}
}

function showPasswordForm(){document.getElementById('biometric-area').style.display='none';document.getElementById('login-form-area').style.display='block';}