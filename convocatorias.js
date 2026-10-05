/* ===========================================================================
   CONVOCATORIAS A ASAMBLEA
   - cbs4/convocatorias/<id>: documento de citación con 1ª y (opcional) 2ª citación,
     tabla de materias, folio CON-AAAA-NNN y PDF con la identidad del condominio.
   - Vive como pestaña dentro de «Actas». Desde una convocatoria se puede crear el
     acta de la reunión (precargada). Nunca se publica en Transparencia.
   Depende de: actas.js (helpers de fecha, openActa), certificados_pdf.js (motor PDF).
   =========================================================================== */
const CONV_TIPOS={ordinaria:'Asamblea ordinaria',extraordinaria:'Asamblea extraordinaria'};
let convEd=null,convPdfActual=null;

function convNorm(c){if(!c)return null;return {...c,materias:comoLista(c.materias).map(String)};}
function convLista(){return comoListaConId(appData.convocatorias).map(convNorm);}
function convPorId(id){return convLista().find(c=>String(c.id)===String(id))||null;}
function convTipoLabel(t){return CONV_TIPOS[t]||CONV_TIPOS.ordinaria;}
function convSumarMin(hora,min){
 const m=/^(\d{1,2}):(\d{2})$/.exec(hora||'');if(!m)return '';
 let t=(parseInt(m[1])*60+parseInt(m[2])+min)%1440;return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0');
}
function convFechaHora(f,h){return actaFechaLarga(f)+(h?', a las '+h+' horas':'');}
function convGuardarRec(rec){
 appData.convocatorias=convLista().filter(x=>String(x.id)!==String(rec.id)).concat([rec]);
 return savePath('convocatorias/'+rec.id,rec);
}

/* ---------- listado (pestaña dentro de Actas) ---------- */
function htmlConvocatorias(){
 const l=convLista().sort((a,b)=>String(b.fecha1).localeCompare(String(a.fecha1))),hoy=actaHoyISO();
 if(!l.length)return `<div class="card"><div class="empty-state"><div class="empty-ico">📣</div><div class="empty-txt">Aún no hay convocatorias. Crea la primera con «Nueva convocatoria».</div></div></div>`;
 return '<div class="comp-grid">'+l.map(c=>{
  const d=String(c.fecha1||'').split('-'),pasada=c.fecha1<hoy,acta=c.actaId?actaPorId(c.actaId):null;
  return `<div class="comp-card acta-card ${pasada?'borr':'pub'}">
   <div class="comp-card-top"><div class="acta-fecha"><b>${esc(d[2]||'')}</b><span>${esc(d[1]?MESES[parseInt(d[1])-1].slice(0,3):'')}</span></div>
    <div style="flex:1;min-width:0"><div style="font-weight:700;color:var(--text);line-height:1.25">${esc(convTipoLabel(c.tipo))}</div>
     <div style="font-size:12px;color:var(--text3);margin-top:2px">${esc(c.folio)} · ${esc(c.hora1||'')} h · ${esc(c.lugar||'')}</div></div>
    <span class="cert-chip ${pasada?'borrador':'aldia'}">${pasada?'Realizada / vencida':'Próxima'}</span></div>
   <div class="acta-meta"><span>📌 ${c.materias.length} materia${c.materias.length===1?'':'s'}</span>${c.seg?`<span>🕒 2ª citación ${esc(c.hora2||'')} h</span>`:''}
    <span>${acta?'📋 acta '+esc(acta.folio):'<i style="opacity:.7">sin acta aún</i>'}</span></div>
   <div class="acta-acc">
    <button class="btn btn-ghost btn-sm" onclick="convVerPDF('${esc(c.id)}')">👁 Ver PDF</button>
    <button class="btn btn-ghost btn-sm" onclick="openConvocatoria('${esc(c.id)}')">✏️ Editar</button>
    ${acta?`<button class="btn btn-ghost btn-sm" onclick="previsualizarActa('${esc(acta.id)}',false)">📋 Ver acta</button>`:`<button class="btn btn-ghost btn-sm" onclick="convCrearActa('${esc(c.id)}')">📋 Crear acta</button>`}
    <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="openBorrarConv('${esc(c.id)}')">🗑 Borrar</button></div></div>`;}).join('')+'</div>';
}

/* ---------- editor ---------- */
function openConvocatoria(id){
 const c=id?convPorId(id):null;if(id&&!c)return;
 convEd=c?JSON.parse(JSON.stringify(c)):{id:null,tipo:'ordinaria',fecha1:'',hora1:'19:00',seg:true,fecha2:'',hora2:'19:30',lugar:'',convoca:'Comité de Administración',
  materias:['Cuenta de gestión del Comité de Administración','Estado financiero y rendición de cuentas',''],nota:'',actaId:''};
 if(!convEd.materias.length)convEd.materias=[''];
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open"><div class="modal acta-modal">
 <div class="modal-title">${c?'✏️ Editar convocatoria '+esc(c.folio):'📣 Nueva convocatoria'}</div>
 <div class="ac-sec"><span>1</span>Tipo y lugar</div>
 <div class="form-row form-row-2"><div><label class="fl">Tipo de asamblea</label><select class="fi" id="cv-tipo">${Object.keys(CONV_TIPOS).map(k=>`<option value="${k}" ${convEd.tipo===k?'selected':''}>${esc(CONV_TIPOS[k])}</option>`).join('')}</select></div>
  <div><label class="fl">Lugar</label><input class="fi" id="cv-lugar" maxlength="140" value="${esc(convEd.lugar)}" placeholder="Ej: Sede social / acceso principal"/></div></div>
 <div class="form-row"><div><label class="fl">Convoca</label><input class="fi" id="cv-convoca" maxlength="120" value="${esc(convEd.convoca)}"/></div></div>
 <div class="ac-sec"><span>2</span>Primera citación</div>
 <div class="form-row form-row-2"><div><label class="fl">Fecha</label><input class="fi" id="cv-f1" type="date" value="${esc(convEd.fecha1)}" onchange="convSugerir2()"/></div>
  <div><label class="fl">Hora</label><input class="fi" id="cv-h1" type="time" value="${esc(convEd.hora1)}" onchange="convSugerir2()"/></div></div>
 <div class="ac-sec"><span>3</span>Segunda citación <em>si no se alcanza el quórum</em></div>
 <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:8px"><input type="checkbox" id="cv-seg" ${convEd.seg?'checked':''} onchange="document.getElementById('cv-seg-box').style.display=this.checked?'grid':'none'"/> Incluir segunda citación</label>
 <div class="form-row form-row-2" id="cv-seg-box" style="display:${convEd.seg?'grid':'none'}"><div><label class="fl">Fecha</label><input class="fi" id="cv-f2" type="date" value="${esc(convEd.fecha2)}"/></div>
  <div><label class="fl">Hora</label><input class="fi" id="cv-h2" type="time" value="${esc(convEd.hora2)}"/></div></div>
 <div class="ac-sec"><span>4</span>Tabla de materias <em>lo que se tratará en la asamblea</em></div>
 <div id="cv-mat">${convHtmlMaterias()}</div>
 <button type="button" class="btn btn-ghost btn-sm" onclick="convAgregarMateria()">➕ Agregar materia</button>
 <div class="ac-sec"><span>5</span>Nota para los vecinos <em>opcional</em></div>
 <textarea class="fi" id="cv-nota" rows="3" maxlength="600" placeholder="Ej: Habrá café al término. Quien no pueda asistir puede enviar a un representante con poder simple.">${esc(convEd.nota||'')}</textarea>
 <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap"><button class="btn btn-success" id="cv-save" onclick="guardarConvocatoria()">Guardar convocatoria</button><button class="btn btn-ghost" onclick="convCancelar()">Cancelar</button></div>
 </div></div>`;
}
function convCancelar(){if(!confirm('¿Cerrar sin guardar los cambios?'))return;convEd=null;closeModal();}
function convSugerir2(){
 const f1=document.getElementById('cv-f1'),h1=document.getElementById('cv-h1'),f2=document.getElementById('cv-f2'),h2=document.getElementById('cv-h2');
 if(f2&&!f2.value&&f1.value)f2.value=f1.value;
 if(h2&&h1.value&&(!h2.dataset.manual))h2.value=convSumarMin(h1.value,30);
}
function convHtmlMaterias(){
 return convEd.materias.map((m,i)=>`<div class="ac-ord-row"><span class="ac-ord-n">${i+1}</span><input class="fi cv-m" maxlength="240" value="${esc(m)}" placeholder="Materia a tratar"/><button type="button" class="btn btn-ghost btn-sm" onclick="convQuitarMateria(${i})" title="Quitar">✕</button></div>`).join('');
}
function convLeerMaterias(){convEd.materias=Array.from(document.querySelectorAll('#cv-mat .cv-m')).map(i=>i.value);}
function convAgregarMateria(){convLeerMaterias();convEd.materias.push('');document.getElementById('cv-mat').innerHTML=convHtmlMaterias();const l=document.querySelectorAll('#cv-mat .cv-m');l[l.length-1].focus();}
function convQuitarMateria(i){convLeerMaterias();convEd.materias.splice(i,1);if(!convEd.materias.length)convEd.materias=[''];document.getElementById('cv-mat').innerHTML=convHtmlMaterias();}
async function guardarConvocatoria(){
 convLeerMaterias();const e=convEd,g=id=>document.getElementById(id);
 e.tipo=g('cv-tipo').value;e.lugar=g('cv-lugar').value.trim();e.convoca=g('cv-convoca').value.trim();
 e.fecha1=g('cv-f1').value;e.hora1=g('cv-h1').value;e.seg=g('cv-seg').checked;e.fecha2=g('cv-f2').value;e.hora2=g('cv-h2').value;e.nota=g('cv-nota').value.trim();
 const mat=e.materias.map(s=>s.trim()).filter(Boolean);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha1)){showToast('Indica la fecha de la primera citación','error');return;}
 if(!e.hora1){showToast('Indica la hora de la primera citación','error');return;}
 if(!e.lugar){showToast('Indica el lugar de la asamblea','error');return;}
 if(!mat.length){showToast('Agrega al menos una materia a tratar','error');return;}
 if(e.seg){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(e.fecha2)||!e.hora2){showToast('Completa fecha y hora de la segunda citación','error');return;}
  if((e.fecha2+' '+e.hora2)<=(e.fecha1+' '+e.hora1)){showToast('La segunda citación debe ser posterior a la primera','error');return;}
 }
 const btn=g('cv-save');if(btn){btn.disabled=true;btn.textContent='Guardando…';}
 try{
  const prev=e.id?convPorId(e.id):null,u=checkSession()||'';
  let id=e.id,folio=prev?prev.folio:'',n=prev?prev.n:0,anio=prev?prev.anio:parseInt(e.fecha1.slice(0,4));
  if(!prev){
   const maxN=convLista().filter(c=>c.anio===anio).reduce((m,c)=>Math.max(m,parseInt(c.n)||0),0);
   const tr=await db.ref('cbs4/convContador/'+anio).transaction(v=>Math.max(parseInt(v)||0,maxN)+1);
   if(!tr.committed)throw new Error('No se pudo asignar folio');
   n=tr.snapshot.val();folio='CON-'+anio+'-'+String(n).padStart(3,'0');id=db.ref('cbs4/convocatorias').push().key;
  }
  const rec={id,folio,anio,n,tipo:e.tipo,fecha1:e.fecha1,hora1:e.hora1,seg:!!e.seg,fecha2:e.seg?e.fecha2:'',hora2:e.seg?e.hora2:'',lugar:e.lugar,convoca:e.convoca,
   materias:mat,nota:e.nota,actaId:prev?(prev.actaId||''):'',creadoPor:prev?prev.creadoPor:u,ts:prev?prev.ts:Date.now()};
  if(prev){rec.editadoPor=u;rec.tsEdit=Date.now();}
  await convGuardarRec(rec);
  convEd=null;closeModal();renderView();showToast('Convocatoria '+folio+' guardada ✓','success');
 }catch(err){console.error(err);showToast('No se pudo guardar: '+err.message,'error');if(btn){btn.disabled=false;btn.textContent='Guardar convocatoria';}}
}

/* ---------- borrar ---------- */
function openBorrarConv(id){
 const c=convPorId(id);if(!c)return;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:460px">
 <div class="modal-title">🗑 Borrar convocatoria ${esc(c.folio)}</div>
 <div style="font-size:13px;color:var(--text2);line-height:1.6">Se eliminará la convocatoria del ${esc(actaFechaLarga(c.fecha1))}. El acta asociada (si existe) no se toca. El folio no se reutiliza y el borrado queda en el Registro de cambios.</div>
 <div style="display:flex;gap:10px;margin-top:16px"><button class="btn btn-danger" onclick="confirmarBorrarConv('${esc(id)}')">Sí, borrar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
async function confirmarBorrarConv(id){
 appData.convocatorias=convLista().filter(x=>String(x.id)!==String(id));
 await savePath('convocatorias/'+id,null);closeModal();renderView();showToast('Convocatoria eliminada','success');
}

/* ---------- crear acta desde la convocatoria ---------- */
function convCrearActa(id){
 const c=convPorId(id);if(!c)return;
 openActa(null,{tipo:c.tipo,fecha:c.fecha1,hora:c.hora1,lugar:c.lugar,convoca:c.convoca,orden:c.materias.slice(),convocatoriaId:c.id});
}
/* lo llama guardarActa tras crear un acta con convocatoriaId, para dejar el vínculo en ambos sentidos */
async function convVincularActa(convId,actaId){
 const c=convPorId(convId);if(!c||c.actaId===actaId)return;
 await convGuardarRec({...c,actaId});
}

/* ---------- PDF ---------- */
async function pdfConvocatoria(rec){
 if(!pdfListo())throw new Error('Librería PDF no disponible');
 const k=convNorm(rec),c=await pdfNuevo('Convocatoria a Asamblea',k.folio),W=PDF_W-PDF_M*2;
 pdfTexto(c,'Folio N° '+k.folio,{size:12,font:c.B,color:PDF_COL.marca});
 pdfTexto(c,'Emitida el '+actaFechaLarga(k.ts?new Date(k.ts).toISOString().slice(0,10):actaHoyISO()),{size:9.5,color:PDF_COL.gris,align:'right'});
 c.y+=10;pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,PDF_COL.borde,0.8);c.y+=22;
 pdfParrafo(c,convTipoLabel(k.tipo)+' del Condominio',{size:16,font:c.B,color:PDF_COL.marca,lh:20,despues:10,justify:false});
 pdfParrafo(c,'Estimados vecinos y vecinas:',{size:11,font:c.B,despues:6,justify:false});
 pdfParrafo(c,'El Comité de Administración los invita cordialmente a participar en la '+convTipoLabel(k.tipo).toLowerCase()+' del Condominio Bosques del Sur 4. Su presencia y opinión son importantes: en esta reunión se toman decisiones que afectan a toda la comunidad.',{size:10.5,lh:15.5,despues:12});
 /* cuadro de citaciones */
 const bw=k.seg?(W-12)/2:W,bh=86;pdfAsegurar(c,bh+20);
 const caja=(x,titulo,fecha,hora,col)=>{
  pdfRect(c,x,c.y,bw,bh,PDF_COL.claro);pdfRect(c,x,c.y,bw,4,col);
  pdfTexto(c,titulo,{x:x+14,size:8.5,font:c.B,color:col,y:c.y+22});
  pdfTexto(c,actaFechaLarga(fecha),{x:x+14,size:11.5,font:c.B,color:PDF_COL.texto,y:c.y+42});
  pdfTexto(c,'a las '+hora+' horas',{x:x+14,size:10.5,color:'#374151',y:c.y+58});
  pdfTexto(c,(k.lugar.length>(k.seg?38:90)?k.lugar.slice(0,(k.seg?37:89))+'…':k.lugar),{x:x+14,size:9,color:PDF_COL.gris,y:c.y+74});
 };
 caja(PDF_M,'PRIMERA CITACIÓN',k.fecha1,k.hora1,PDF_COL.marca);
 if(k.seg)caja(PDF_M+bw+12,'SEGUNDA CITACIÓN',k.fecha2,k.hora2,PDF_COL.marca2);
 c.y+=bh+14;
 pdfSeccion(c,'Tabla de materias');
 k.materias.forEach((t,i)=>{pdfParrafo(c,(i+1)+'.  '+t,{size:10.5,lh:15,x:PDF_M+8,w:W-8,despues:4,justify:false});});
 c.y+=6;
 pdfSeccion(c,'Información importante');
 const info=['Si no puede asistir, puede hacerse representar por otra persona mediante una carta poder simple firmada por el propietario, indicando el número de departamento.',
  'Lleve su cédula de identidad para registrar su asistencia al ingreso.'];
 if(k.seg)info.unshift('Si en la primera citación no se reúne el quórum que exigen la ley y el reglamento de copropiedad, la asamblea se realizará en segunda citación, en el día y la hora indicados.');
 info.forEach(t=>pdfParrafo(c,'•  '+t,{size:10,lh:14.5,x:PDF_M+6,w:W-6,despues:5}));
 if(k.nota){c.y+=4;pdfNotaCaja(c,'UN MENSAJE DEL COMITÉ',k.nota,PDF_COL.marca2);}
 c.y+=4;pdfParrafo(c,'¡Los esperamos! Participar es la mejor forma de cuidar nuestro hogar común.',{size:10.5,font:c.I,color:PDF_COL.marca,despues:0,justify:false});
 pdfFirmasX(c,[['Presidenta','Comité de Administración'],['Tesorera','Comité de Administración'],['Administrador','Comité de Administración']]);
 pdfCerrar(c,'Convocatoria a Asamblea');
 return await pdfBytes(c);
}
function convTextoWhatsApp(k){
 let t=`📣 *CONDOMINIO BOSQUES DEL SUR 4*\n*${convTipoLabel(k.tipo)}*\n\nEstimados vecinos y vecinas, los invitamos a participar:\n\n🗓 *1ª citación:* ${convFechaHora(k.fecha1,k.hora1)}`;
 if(k.seg)t+=`\n🗓 *2ª citación:* ${convFechaHora(k.fecha2,k.hora2)}`;
 t+=`\n📍 ${k.lugar}\n\n📌 *Tabla de materias:*\n`+k.materias.map((m,i)=>(i+1)+'. '+m).join('\n');
 if(k.nota)t+='\n\n'+k.nota;
 t+='\n\nSi no puede asistir, envíe a un representante con carta poder simple. ¡Su participación es importante! 🙌';
 return t;
}
async function convVerPDF(id){
 const k=convPorId(id);if(!k)return;
 let bytes;try{bytes=await pdfConvocatoria(k);}catch(e){console.error(e);showToast('No se pudo generar el PDF: '+e.message,'error');return;}
 if(convPdfActual&&convPdfActual.url)URL.revokeObjectURL(convPdfActual.url);
 convPdfActual={bytes,nombre:'Convocatoria '+k.folio+'.pdf',url:pdfUrl(bytes),id};
 const vista=window.innerWidth>=820?`<iframe src="${convPdfActual.url}#view=FitH&toolbar=0" style="width:100%;height:62vh;border:1px solid var(--border);border-radius:10px;background:#fff" title="Vista previa"></iframe>`
  :'<div style="padding:18px;text-align:center;font-size:13px;color:var(--text2);border:1px dashed var(--border);border-radius:10px">PDF generado. Usa los botones para descargarlo o abrirlo.</div>';
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:760px">
  <div class="modal-title">📣 ${esc(k.folio)} — ${esc(convTipoLabel(k.tipo))}</div><div style="margin-bottom:14px">${vista}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" onclick="pdfDescargar(convPdfActual.bytes,convPdfActual.nombre)">⬇ Descargar PDF</button>
  <button class="btn btn-ghost" onclick="window.open(convPdfActual.url,'_blank')">↗ Abrir en pestaña nueva</button>
  <button class="btn btn-success" onclick="convCompartir('${esc(id)}')">📤 Compartir PDF</button>
  <button class="btn btn-ghost" onclick="convWhatsApp('${esc(id)}')">💬 Mensaje WhatsApp</button>
  <button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
}
async function convCompartir(id){
 const k=convPorId(id);if(!k||!convPdfActual)return;
 try{const f=new File([convPdfActual.bytes],convPdfActual.nombre,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f],title:k.folio,text:convTextoWhatsApp(k)});return;}
 }catch(e){if(e&&e.name==='AbortError')return;}
 pdfDescargar(convPdfActual.bytes,convPdfActual.nombre);showToast('Este dispositivo no permite compartir archivos: PDF descargado','success');
}
function convWhatsApp(id){const k=convPorId(id);if(k)abrirWhatsApp('',convTextoWhatsApp(k));}
