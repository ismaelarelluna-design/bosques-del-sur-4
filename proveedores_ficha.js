/* ===========================================================================
   Ficha de proveedor — Condominio Bosques del Sur 4   (SOLO DIRECTIVA)
   ---------------------------------------------------------------------------
   Extiende proveedores.js sin tocar sus funciones de formularios de gastos.
   Todo vive dentro de cbs4/proveedores/<id>/... (un nodo por registro, para que
   dos administradores no se pisen) y NADA de esto se publica en Transparencia:
   construirPublico() arma una lista blanca de campos y los proveedores no están
   en ella (tampoco `proveedorId` de los gastos).

     contrato      {objeto,inicio,termino,monto,periodicidad,renovAuto,notas,archivoRef,archivoNombre,ts,por}
     evaluaciones/<id>  {id,fecha,plazos,calidad,precio,trato,trabajo,comentario,ts,por}   (1 a 5)
     docs/<id>          {id,tipo,nombre,vence,archivoRef,archivoNombre,ts,por}
     bitacora/<id>      {id,fecha,tipo:'nota'|'incidente',texto,estado,ts,por,resueltoTs}

   Archivos: van a cbs4_adjuntos (igual que las boletas) y aquí solo queda la referencia.
   Depende de: core.js, proveedores.js (proveedorPorId, provMovimientos, provStars, …).
   =========================================================================== */
const PF_PERIODICIDAD=[['mensual','Mensual'],['trimestral','Trimestral'],['semestral','Semestral'],['anual','Anual'],['por_trabajo','Por trabajo'],['unico','Pago único']];
const PF_DOC_TIPOS=['Contrato','Póliza de seguro','Boleta de garantía','Certificado','Cotización','Otro'];
const PF_CRITERIOS=[['plazos','Cumplimiento de plazos'],['calidad','Calidad del trabajo'],['precio','Precio / conveniencia'],['trato','Trato y comunicación']];
const PF_ARCH_MAX=4*1024*1024;      /* tope por archivo (base64 incluido) */
const PF_ALERTA_AMBAR=60,PF_ALERTA_ROJA=30;
let _pfId=null,_pfTab='resumen',_pfEvalForm=false,_pfDocForm=false,_pfVerTodos=false,_pfSel={plazos:0,calidad:0,precio:0,trato:0};

/* ---------------------------------------------------------------- utilidades */
function pfHoyISO(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function pfISOaFecha(iso){const p=String(iso||'').split('-').map(Number);return (p.length===3&&p[0]&&p[1]&&p[2])?new Date(p[0],p[1]-1,p[2]):null;}
function pfDias(iso){const f=pfISOaFecha(iso);if(!f)return null;const h=pfISOaFecha(pfHoyISO());return Math.round((f-h)/86400000);}
function pfFecha(iso){const p=String(iso||'').split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:'';}
function pfTxtDias(d){
 if(d===0)return 'hoy';
 const a=Math.abs(d),u=a>=90?Math.round(a/30)+' meses':a+' día'+(a===1?'':'s');
 return d>0?'en '+u:'hace '+u;
}
function pfK(n){n=Number(n)||0;const a=Math.abs(n);return a>=1e6?(n/1e6).toFixed(a>=1e7?0:1).replace('.',',')+'M':(a>=1e3?Math.round(n/1e3)+'k':String(Math.round(n)));}
function pfUsuario(){return checkSession()||'';}
function pfNuevoId(id,rama){return db.ref('cbs4/proveedores/'+id+'/'+rama).push().key;}
function pfEstrellas(n,ancho){n=Math.round(Number(n)||0);return '<span class="prov-stars"'+(ancho?' style="font-size:'+ancho+'px"':'')+'>'+'★'.repeat(Math.max(0,Math.min(5,n)))+'☆'.repeat(5-Math.max(0,Math.min(5,n)))+'</span>';}
/* Escritura por nodo hijo; muta appData ANTES (misma convención que el resto de la app). */
function pfSet(id,ruta,valor){
 const p=proveedorPorId(id);if(!p)return Promise.resolve();
 const seg=ruta.split('/');let o=p;
 for(let i=0;i<seg.length-1;i++){if(!o[seg[i]]||typeof o[seg[i]]!=='object'||Array.isArray(o[seg[i]]))o[seg[i]]=Object.assign({},o[seg[i]]||{});o=o[seg[i]];}
 const k=seg[seg.length-1];if(valor===null||valor===undefined)delete o[k];else o[k]=valor;
 return savePath('proveedores/'+id+'/'+ruta,valor===undefined?null:valor);
}

/* ------------------------------------------------------------------ contrato */
function pfContrato(p){const c=p&&p.contrato;return (c&&typeof c==='object'&&(c.inicio||c.termino||c.objeto||c.monto||c.archivoRef))?c:null;}
/* k: sin | futuro | indef | vigente | por60 | por30 | vencido */
function pfEstadoContrato(p){
 const c=pfContrato(p);if(!c)return {k:'sin',txt:'Sin contrato registrado',cls:'chip-mudo',dias:null};
 const di=c.inicio?pfDias(c.inicio):null,dt=c.termino?pfDias(c.termino):null;
 if(di!==null&&di>0)return {k:'futuro',txt:'Inicia '+pfTxtDias(di),cls:'chip-cat',dias:di};
 if(dt===null)return {k:'indef',txt:'Vigente · sin fecha de término',cls:'fp-ok',dias:null};
 const ra=c.renovAuto?' · renovación automática':'';
 if(dt<0)return {k:'vencido',txt:'Vencido '+pfTxtDias(dt),cls:'fp-rojo',dias:dt};
 if(dt<=PF_ALERTA_ROJA)return {k:'por30',txt:'Vence '+pfTxtDias(dt)+ra,cls:'fp-rojo',dias:dt};
 if(dt<=PF_ALERTA_AMBAR)return {k:'por60',txt:'Vence '+pfTxtDias(dt)+ra,cls:'fp-ambar',dias:dt};
 return {k:'vigente',txt:'Vigente · vence '+pfTxtDias(dt)+ra,cls:'fp-ok',dias:dt};
}
function pfEstadoVence(iso){
 if(!iso)return {k:'sin',txt:'Sin vencimiento',cls:'chip-mudo',dias:null};
 const d=pfDias(iso);
 if(d<0)return {k:'vencido',txt:'Vencido '+pfTxtDias(d),cls:'fp-rojo',dias:d};
 if(d<=PF_ALERTA_ROJA)return {k:'por30',txt:'Vence '+pfTxtDias(d),cls:'fp-rojo',dias:d};
 if(d<=PF_ALERTA_AMBAR)return {k:'por60',txt:'Vence '+pfTxtDias(d),cls:'fp-ambar',dias:d};
 return {k:'vigente',txt:'Vigente hasta '+pfFecha(iso),cls:'fp-ok',dias:d};
}
function pfChipContrato(p){const e=pfEstadoContrato(p);return '<span class="chip '+e.cls+'">'+esc(e.txt)+'</span>';}

/* ---------------------------------------------------------- evaluaciones, docs */
function pfEvals(p){return comoListaConId(p.evaluaciones).sort((a,b)=>(b.ts||0)-(a.ts||0));}
function pfDocs(p){return comoListaConId(p.docs).sort((a,b)=>(b.ts||0)-(a.ts||0));}
function pfBitacora(p){return comoListaConId(p.bitacora).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha))||(b.ts||0)-(a.ts||0));}
function pfProm(l,k){const v=l.map(x=>Number(x[k])).filter(n=>n>=1&&n<=5);return v.length?v.reduce((s,n)=>s+n,0)/v.length:0;}
function pfNotaEval(e){const v=PF_CRITERIOS.map(c=>Number(e[c[0]])).filter(n=>n>=1&&n<=5);return v.length?v.reduce((s,n)=>s+n,0)/v.length:0;}
/* Nota global: promedio de evaluaciones; si no hay, la valoración antigua (1 sola nota). */
function pfNota(p){
 const ev=pfEvals(p);
 if(ev.length){const n=ev.reduce((s,e)=>s+pfNotaEval(e),0)/ev.length;return {n,cant:ev.length,legacy:false};}
 const v=parseInt(p.valoracion)||0;return v?{n:v,cant:0,legacy:true}:{n:0,cant:0,legacy:false};
}
function pfNotaCard(p){const r=pfNota(p);return r.n?'<span class="prov-stars" title="Evaluación '+r.n.toFixed(1).replace('.',',')+' de 5'+(r.cant?' ('+r.cant+')':'')+'">'+pfEstrellasTxt(r.n)+'</span>':'';}
function pfEstrellasTxt(n){const k=Math.round(n);return '★'.repeat(k)+'☆'.repeat(5-k);}
/* Tendencia: promedio de las últimas 3 vs las anteriores. */
function pfTendencia(p){
 const ev=pfEvals(p);if(ev.length<4)return 0;
 const a=ev.slice(0,3),b=ev.slice(3);
 const x=a.reduce((s,e)=>s+pfNotaEval(e),0)/a.length,y=b.reduce((s,e)=>s+pfNotaEval(e),0)/b.length;
 return Math.abs(x-y)<0.15?0:(x>y?1:-1);
}

/* ------------------------------------------------------------------- alertas */
/* Contratos y documentos de proveedores ACTIVOS con vencimiento en ≤60 días o ya vencidos. */
function provAlertas(){
 const out=[];
 proveedores().filter(p=>p.activo!==false).forEach(p=>{
  const e=pfEstadoContrato(p);
  if(['vencido','por30','por60'].includes(e.k))out.push({id:p.id,nombre:p.nombre,tipo:'Contrato',texto:e.txt,rojo:e.k!=='por60',dias:e.dias});
  pfDocs(p).forEach(d=>{const v=pfEstadoVence(d.vence);
   if(['vencido','por30','por60'].includes(v.k))out.push({id:p.id,nombre:p.nombre,tipo:d.tipo||'Documento',texto:(d.nombre?d.nombre+': ':'')+v.txt,rojo:v.k!=='por60',dias:v.dias});});
 });
 return out.sort((a,b)=>a.dias-b.dias);
}
function provAlertasCount(){try{return provAlertas().length;}catch(e){return 0;}}
function htmlProvAlertas(){
 const l=provAlertas();if(!l.length)return '';
 return `<div class="card fp-alertas"><div style="font-weight:700;color:var(--text);margin-bottom:6px">⏰ Vencimientos que requieren atención <span class="chip fp-rojo">${l.length}</span></div>
 ${l.slice(0,6).map(a=>`<div class="fp-al-row" onclick="abrirFichaProv('${esc(a.id)}','${a.tipo==='Contrato'?'contrato':'docs'}')"><span class="fp-dot ${a.rojo?'r':'a'}"></span><div style="flex:1;min-width:0"><b>${esc(a.nombre)}</b> · ${esc(a.tipo)}<div class="fp-mut">${esc(a.texto)}</div></div><span class="fp-mut">Abrir ficha ›</span></div>`).join('')}
 ${l.length>6?`<div class="fp-mut" style="margin-top:6px">…y ${l.length-6} más (están en la ficha de cada proveedor).</div>`:''}</div>`;
}

/* -------------------------------------------------------------------- pagos */
function pfMovs(id){return provMovimientos(id);}
function pfSerie(mv,n){
 const hoy=new Date(),out=[];
 for(let i=n-1;i>=0;i--){const d=new Date(hoy.getFullYear(),hoy.getMonth()-i,1);out.push({k:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),t:0,m:d.getMonth()});}
 const ix={};out.forEach((o,i)=>{ix[o.k]=i;});
 mv.forEach(x=>{const i=ix[String(x.periodo).slice(0,7)];if(i!==undefined)out[i].t+=x.monto||0;});
 return out;
}
function pfSvgBarras(serie){
 const W=560,H=170,pl=6,pr=6,pt=18,pb=26,w=W-pl-pr,h=H-pt-pb,max=Math.max(1,...serie.map(s=>s.t)),bw=w/serie.length;
 const bars=serie.map((s,i)=>{const bh=s.t?Math.max(2,s.t/max*h):0,x=pl+i*bw+bw*.18,y=pt+h-bh;
  return `<rect class="fp-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw*.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="3"/>`
   +(s.t?`<text class="fp-bv" x="${(x+bw*.32).toFixed(1)}" y="${(y-4).toFixed(1)}" text-anchor="middle">${pfK(s.t)}</text>`:'')
   +`<text class="fp-bl" x="${(x+bw*.32).toFixed(1)}" y="${H-8}" text-anchor="middle">${esc(MESES[s.m].slice(0,3))}</text>`;}).join('');
 return `<svg viewBox="0 0 ${W} ${H}" class="fp-svg" role="img" aria-label="Pagos de los últimos 12 meses"><line class="fp-axis" x1="${pl}" x2="${W-pr}" y1="${pt+h}" y2="${pt+h}"/>${bars}</svg>`;
}
function pfResumenPagos(mv){
 const anio=new Date().getFullYear();
 const total=mv.reduce((s,x)=>s+x.monto,0),delAnio=mv.filter(x=>String(x.periodo).startsWith(String(anio))).reduce((s,x)=>s+x.monto,0);
 const porAnio={};mv.forEach(x=>{const a=String(x.periodo).slice(0,4);if(!porAnio[a])porAnio[a]={t:0,n:0};porAnio[a].t+=x.monto;porAnio[a].n++;});
 const meses=new Set(mv.filter(x=>x.monto>0).map(x=>String(x.periodo).slice(0,7))).size;
 const s=pfSerie(mv,24),u=s.slice(12).reduce((a,x)=>a+x.t,0),a=s.slice(0,12).reduce((a2,x)=>a2+x.t,0);
 return {total,delAnio,anio,porAnio,meses,prom:meses?total/meses:0,var12:a>0?(u-a)/a*100:null,u12:u,a12:a};
}
/* Compara lo pagado (promedio de los últimos 3 meses con pago) contra lo pactado mensual. */
function pfAvisoContrato(p,mv){
 const c=pfContrato(p);if(!c||c.periodicidad!=='mensual'||!(Number(c.monto)>0))return '';
 const porMes={};mv.forEach(x=>{const k=String(x.periodo).slice(0,7);porMes[k]=(porMes[k]||0)+x.monto;});
 const ks=Object.keys(porMes).sort().slice(-3);if(!ks.length)return '';
 const prom=ks.reduce((s,k)=>s+porMes[k],0)/ks.length,pct=(prom-c.monto)/c.monto*100;
 if(pct>5)return `<div class="fp-aviso">⚠️ En los últimos ${ks.length} mes${ks.length>1?'es':''} se pagó en promedio <b>${esc(fmt(Math.round(prom)))}</b>, un <b>${pct.toFixed(0)} %</b> sobre lo pactado en el contrato (${esc(fmt(c.monto))}/mes). Conviene revisar si hay un reajuste acordado.</div>`;
 return '';
}

/* ============================================================== ficha (vista) */
function abrirFichaProv(id,tab){_pfId=id;_pfTab=tab||'resumen';_pfEvalForm=false;_pfDocForm=false;_pfVerTodos=false;_pfSel={plazos:0,calidad:0,precio:0,trato:0};pfRender();}
function pfTab(t){_pfTab=t;_pfEvalForm=false;_pfDocForm=false;pfRender();}
function pfRender(){
 const p=proveedorPorId(_pfId);if(!p){closeModal();return;}
 const prev=document.querySelector('.fp-modal'),st=prev?prev.scrollTop:0;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal fp-modal">${pfCabecera(p)}${pfPestanas(p)}<div id="fp-body">${pfCuerpo(p)}</div></div></div>`;
 const m=document.querySelector('.fp-modal');if(m&&st)m.scrollTop=st;
}
function pfCabecera(p){
 const h=provColor(p.nombre),tel=String(p.telefono||'').trim(),nota=pfNota(p);
 const abiertos=pfBitacora(p).filter(b=>b.tipo==='incidente'&&b.estado!=='resuelto').length;
 return `<div class="fp-head"><div class="prov-av fp-av" style="background:hsl(${h} 55% 42%)">${esc(provIniciales(p.nombre))}</div>
  <div style="flex:1;min-width:0"><div class="fp-nombre">${esc(p.nombre)}</div>
   <div class="fp-chips"><span class="chip chip-cat">${esc(p.rubro||'Sin rubro')}</span>${p.activo===false?'<span class="chip chip-mudo">Inactivo</span>':''}${pfChipContrato(p)}${abiertos?`<span class="chip fp-rojo">⚠ ${abiertos} incidente${abiertos>1?'s':''} abierto${abiertos>1?'s':''}</span>`:''}</div>
   <div class="fp-mut" style="margin-top:4px">${nota.n?pfEstrellas(nota.n)+' '+nota.n.toFixed(1).replace('.',',')+(nota.cant?' · '+nota.cant+' evaluación'+(nota.cant>1?'es':''):' · valoración antigua'):'Sin evaluaciones todavía'}</div></div>
  <button class="fp-x" onclick="closeModal()" aria-label="Cerrar">✕</button></div>
  <div class="fp-acc">${tel?`<a class="btn btn-outline btn-sm" href="tel:${esc(tel.replace(/[^\d+]/g,''))}">📞 Llamar</a><button class="btn btn-outline btn-sm" onclick="provWhatsApp('${esc(p.id)}')">💬 WhatsApp</button>`:''}${p.email?`<a class="btn btn-outline btn-sm" href="mailto:${esc(p.email)}">✉️ Correo</a>`:''}<button class="btn btn-ghost btn-sm" onclick="openProveedor('${esc(p.id)}')">✏️ Editar datos</button></div>`;
}
function pfPestanas(p){
 const t=[['resumen','Resumen',0],['contrato','Contrato',0],['pagos','Pagos',pfMovs(p.id).length],['eval','Evaluación',pfEvals(p).length],['docs','Documentos',pfDocs(p).length],['bitacora','Bitácora',pfBitacora(p).length]];
 return `<div class="fp-tabs">${t.map(x=>`<button class="seg-btn ${_pfTab===x[0]?'on':''}" onclick="pfTab('${x[0]}')">${x[1]}${x[2]?`<span class="seg-n">${x[2]}</span>`:''}</button>`).join('')}</div>`;
}
function pfCuerpo(p){
 switch(_pfTab){
  case 'contrato':return pfHtmlContrato(p);
  case 'pagos':return pfHtmlPagos(p);
  case 'eval':return pfHtmlEval(p);
  case 'docs':return pfHtmlDocs(p);
  case 'bitacora':return pfHtmlBitacora(p);
  default:return pfHtmlResumen(p);
 }
}
function pfKpi(l,v,sub,cls){return `<div class="fp-kpi"><div class="fp-kl">${l}</div><div class="fp-kv ${cls||''}">${v}</div>${sub?`<div class="fp-ks">${sub}</div>`:''}</div>`;}

/* ----------------------------------------------------------------- Resumen */
function pfHtmlResumen(p){
 const mv=pfMovs(p.id),r=pfResumenPagos(mv),nota=pfNota(p),ec=pfEstadoContrato(p);
 const al=provAlertas().filter(a=>String(a.id)===String(p.id));
 const ult=mv[0];
 return `<div class="fp-kpis">
  ${pfKpi('Pagado en '+r.anio,esc(fmt(r.delAnio)))}
  ${pfKpi('Pagado en total',esc(fmt(r.total)),mv.length+' pago'+(mv.length===1?'':'s'))}
  ${pfKpi('Contrato',`<span class="chip ${ec.cls}">${esc(ec.k==='sin'?'Sin contrato':ec.k==='vencido'?'Vencido':ec.k==='por30'||ec.k==='por60'?'Por vencer':ec.k==='futuro'?'Por iniciar':'Vigente')}</span>`,esc(ec.k==='sin'?'':ec.txt))}
  ${pfKpi('Evaluación',nota.n?nota.n.toFixed(1).replace('.',',')+' / 5':'—',nota.n?pfEstrellas(nota.n):'Sin evaluar')}</div>
 ${al.length?`<div class="fp-aviso">${al.map(a=>`⏰ <b>${esc(a.tipo)}</b>: ${esc(a.texto)}`).join('<br>')}</div>`:''}
 ${pfAvisoContrato(p,mv)}
 <div class="fp-sec">Últimos 12 meses</div>${mv.length?pfSvgBarras(pfSerie(mv,12)):'<div class="fp-vacio">Aún no hay gastos ni mantenciones vinculados a este proveedor.</div>'}
 <div class="fp-sec">Datos de contacto</div>
 <div class="fp-datos">${p.contacto?`<div><span>Contacto</span>${esc(p.contacto)}</div>`:''}${p.telefono?`<div><span>Teléfono</span>${esc(p.telefono)}</div>`:''}${p.email?`<div><span>Correo</span>${esc(p.email)}</div>`:''}${p.notas?`<div><span>Notas</span>${esc(p.notas)}</div>`:''}${ult?`<div><span>Último pago</span>${esc(formatPeriodo(ult.periodo))} · ${esc(fmt(ult.monto))}</div>`:''}${!p.contacto&&!p.telefono&&!p.email&&!p.notas?'<div class="fp-mut">Sin datos de contacto. Usa «Editar datos».</div>':''}</div>
 <div class="fp-priv">🔒 Esta ficha es solo para la directiva: nada de esto aparece en Transparencia.</div>`;
}

/* ---------------------------------------------------------------- Contrato */
function pfHtmlContrato(p){
 const c=pfContrato(p)||{},ec=pfEstadoContrato(p);
 return `<div class="fp-estado ${ec.cls}">${esc(ec.txt)}</div>
 <div class="form-row"><div><label class="fl">Objeto del contrato / servicio</label><input class="fi" id="pc-obj" maxlength="120" value="${esc(c.objeto||'')}" placeholder="Ej: Aseo de áreas comunes, 3 veces por semana"/></div></div>
 <div class="form-row form-row-2"><div><label class="fl">Inicio *</label><input class="fi" type="date" id="pc-ini" value="${esc(c.inicio||'')}"/></div>
  <div><label class="fl">Término (vacío = indefinido)</label><input class="fi" type="date" id="pc-ter" value="${esc(c.termino||'')}"/></div></div>
 <div class="form-row form-row-2"><div><label class="fl">Monto pactado ($)</label><input class="fi" type="number" id="pc-mon" min="0" inputmode="numeric" value="${c.monto!=null&&c.monto!==''?esc(c.monto):''}"/></div>
  <div><label class="fl">Periodicidad</label><select class="fi" id="pc-per">${PF_PERIODICIDAD.map(x=>`<option value="${x[0]}" ${(c.periodicidad||'mensual')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div></div>
 <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text2);cursor:pointer;margin:2px 0 10px"><input type="checkbox" id="pc-ren" ${c.renovAuto?'checked':''} style="width:16px;height:16px"/>Se renueva automáticamente al término</label>
 <div class="form-row"><div><label class="fl">Notas del contrato</label><input class="fi" id="pc-not" maxlength="300" value="${esc(c.notas||'')}" placeholder="Reajustes, multas, aviso previo de término…"/></div></div>
 <div class="form-row"><div><label class="fl">Contrato escaneado (foto o PDF, máx. 4 MB)</label>
  ${c.archivoRef?`<div class="fp-arch"><span>📎 ${esc(c.archivoNombre||'Contrato')}</span><button class="btn btn-ghost btn-sm" onclick="pfVerArchivo('${esc(c.archivoRef)}','${esc(c.archivoNombre||'Contrato')}')">Ver</button></div>`:''}
  <div class="file-drop" onclick="document.getElementById('pc-file').click()">📎 ${c.archivoRef?'Reemplazar archivo':'Seleccionar foto o PDF'}</div><input type="file" id="pc-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'pc-prev')"/><div id="pc-prev"></div></div></div>
 <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button class="btn btn-success" id="pc-btn" onclick="pfGuardarContrato('${esc(p.id)}')">Guardar contrato</button>${pfContrato(p)?`<button class="btn btn-danger btn-sm" style="margin-left:auto" onclick="pfQuitarContrato('${esc(p.id)}')">Quitar contrato</button>`:''}</div>
 <div class="fp-mut" style="margin-top:10px">Recibirás una alerta en Proveedores cuando falten ${PF_ALERTA_AMBAR} y ${PF_ALERTA_ROJA} días para el término.</div>`;
}
/* Sube el archivo (si hay) y devuelve {ref,nombre} o null. Valida tamaño antes de subir. */
function pfSubirArchivo(inputId){
 return new Promise((res,rej)=>{
  const f=document.getElementById(inputId);if(!f||!f.files.length){res(null);return;}
  compressImage(f.files[0],d=>{
   if(!d||!d.data){rej(new Error('No se pudo leer el archivo'));return;}
   if(d.data.length>PF_ARCH_MAX*1.37){rej(new Error('El archivo supera los 4 MB'));return;}
   subirAdjunto(d).then(ref=>res({ref,nombre:d.name})).catch(rej);
  });
 });
}
async function pfGuardarContrato(id){
 const p=proveedorPorId(id);if(!p)return;
 const v=k=>document.getElementById(k).value.trim();
 const ini=v('pc-ini'),ter=v('pc-ter'),mon=v('pc-mon');
 if(!ini){showToast('Indica la fecha de inicio','error');return;}
 if(ter&&ter<ini){showToast('El término no puede ser anterior al inicio','error');return;}
 if(mon!==''&&!(Number(mon)>=0)){showToast('El monto no es válido','error');return;}
 const btn=document.getElementById('pc-btn');if(btn){btn.disabled=true;btn.textContent='Guardando…';}
 try{
  const arch=await pfSubirArchivo('pc-file');
  const prev=pfContrato(p)||{};
  const rec={objeto:v('pc-obj'),inicio:ini,termino:ter,monto:mon===''?0:Math.round(Number(mon)),periodicidad:v('pc-per'),renovAuto:document.getElementById('pc-ren').checked,notas:v('pc-not'),ts:Date.now(),por:pfUsuario()};
  if(arch){rec.archivoRef=arch.ref;rec.archivoNombre=arch.nombre;}else if(prev.archivoRef){rec.archivoRef=prev.archivoRef;rec.archivoNombre=prev.archivoNombre||'Contrato';}
  await pfSet(id,'contrato',rec);
  if(arch&&prev.archivoRef&&prev.archivoRef!==arch.ref)borrarAdjunto(prev.archivoRef);
  showToast('Contrato guardado ✓','success');pfRender();renderView();
 }catch(e){console.warn(e);showToast('No se pudo guardar: '+e.message,'error');const b=document.getElementById('pc-btn');if(b){b.disabled=false;b.textContent='Guardar contrato';}}
}
function pfQuitarContrato(id){
 if(!confirm('¿Quitar el contrato de este proveedor? Se borra también el archivo adjunto.'))return;
 const p=proveedorPorId(id),ref=p&&p.contrato&&p.contrato.archivoRef;
 pfSet(id,'contrato',null);if(ref)borrarAdjunto(ref);
 showToast('Contrato quitado','success');pfRender();renderView();
}
function pfVerArchivo(ref,nombre){
 if(!ref)return;
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)pfRender()"><div class="modal" style="max-width:580px"><div class="modal-title">📎 ${esc(nombre||'Archivo')}</div><div style="padding:28px;text-align:center;color:var(--text3);font-size:13px">Cargando…</div></div></div>`;
 cargarAdjunto(ref).then(a=>{
  if(!a){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)pfRender()"><div class="modal" style="max-width:480px"><div class="modal-title">📎 ${esc(nombre||'Archivo')}</div><div style="padding:20px;text-align:center;color:var(--danger);font-size:13px">No se pudo cargar el archivo.</div><button class="btn btn-ghost" style="width:100%" onclick="pfRender()">Volver a la ficha</button></div></div>`;return;}
  lastDownload={url:a.data,filename:a.name||nombre||'archivo'};
  const img=String(a.type||'').startsWith('image/')||String(a.data).startsWith('data:image');
  document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)pfRender()"><div class="modal" style="max-width:640px"><div class="modal-title">📎 ${esc(a.name||nombre||'Archivo')}</div>${img?`<img src="${a.data}" style="width:100%;border-radius:8px;margin-bottom:12px" alt=""/>`:'<div style="padding:22px;text-align:center;color:var(--text3)">📄 Documento PDF adjunto</div>'}<div style="display:flex;gap:10px"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar</button><button class="btn btn-ghost" onclick="pfRender()">Volver a la ficha</button></div></div></div>`;
 });
}

/* -------------------------------------------------------------------- Pagos */
function pfHtmlPagos(p){
 const mv=pfMovs(p.id),r=pfResumenPagos(mv);
 if(!mv.length)return `<div class="fp-vacio">Sin gastos ni mantenciones vinculados.<br>Al registrar un gasto o una mantención, elige este proveedor. Si ya tienes gastos antiguos, usa <b>«Gastos sin proveedor»</b> en la lista de proveedores para asignarlos en lote.</div>`;
 const anios=Object.keys(r.porAnio).sort((a,b)=>b.localeCompare(a));
 const vis=_pfVerTodos?mv:mv.slice(0,15);
 const v12=r.var12===null?'—':(r.var12>0?'▲ ':'▼ ')+Math.abs(r.var12).toFixed(0)+' %';
 return `<div class="fp-kpis">
  ${pfKpi('Pagado en '+r.anio,esc(fmt(r.delAnio)))}
  ${pfKpi('Total histórico',esc(fmt(r.total)),mv.length+' pagos en '+r.meses+' mes'+(r.meses===1?'':'es'))}
  ${pfKpi('Promedio por mes',esc(fmt(Math.round(r.prom))),'meses con pago')}
  ${pfKpi('Últimos 12 vs 12 previos',esc(v12),r.var12===null?'sin base de comparación':esc(fmt(r.u12))+' vs '+esc(fmt(r.a12)),r.var12>10?'fp-t-rojo':(r.var12<-10?'fp-t-verde':''))}</div>
 ${pfAvisoContrato(p,mv)}
 <div class="fp-sec">Pagos por mes (últimos 12)</div>${pfSvgBarras(pfSerie(mv,12))}
 <div class="fp-sec">Por año</div>
 <div class="table-wrap"><table><thead><tr><th>Año</th><th style="text-align:right">Pagos</th><th style="text-align:right">Total</th><th style="text-align:right">Variación</th></tr></thead><tbody>${anios.map((a,i)=>{const prev=r.porAnio[String(Number(a)-1)];const v=prev&&prev.t>0?(r.porAnio[a].t-prev.t)/prev.t*100:null;return `<tr><td>${esc(a)}</td><td style="text-align:right">${r.porAnio[a].n}</td><td style="text-align:right">${esc(fmt(r.porAnio[a].t))}</td><td style="text-align:right" class="${v>10?'fp-t-rojo':(v<-10?'fp-t-verde':'')}">${v===null?'—':(v>0?'▲ ':'▼ ')+Math.abs(v).toFixed(0)+' %'}</td></tr>`;}).join('')}</tbody></table></div>
 <div class="fp-sec">Detalle de pagos</div>
 <div class="table-wrap"><table><thead><tr><th>Período</th><th>Tipo</th><th>Detalle</th><th style="text-align:right">Monto</th></tr></thead><tbody>${vis.map(x=>`<tr><td>${esc(formatPeriodo(x.periodo))}</td><td>${esc(x.t)}</td><td>${esc(x.desc)}</td><td style="text-align:right">${esc(fmt(x.monto))}</td></tr>`).join('')}</tbody></table></div>
 ${mv.length>15?`<div style="text-align:center;margin-top:8px"><button class="btn btn-ghost btn-sm" onclick="_pfVerTodos=${!_pfVerTodos};pfRender()">${_pfVerTodos?'Ver solo los últimos 15':'Ver los '+mv.length+' pagos'}</button></div>`:''}`;
}

/* --------------------------------------------------------------- Evaluación */
function pfHtmlEval(p){
 const ev=pfEvals(p),nota=pfNota(p),tend=pfTendencia(p);
 const resumen=ev.length?`<div class="fp-evsum"><div class="fp-evbig">${nota.n.toFixed(1).replace('.',',')}<small>/ 5</small></div><div>${pfEstrellas(nota.n,16)}<div class="fp-mut">${ev.length} evaluación${ev.length>1?'es':''}${tend?' · tendencia '+(tend>0?'<b class="fp-t-verde">▲ mejorando</b>':'<b class="fp-t-rojo">▼ empeorando</b>'):''}</div></div>
  <div class="fp-crit">${PF_CRITERIOS.map(c=>{const m=pfProm(ev,c[0]);return `<div class="fp-crit-r"><span>${c[1]}</span><div class="fp-pb"><i style="width:${(m/5*100).toFixed(0)}%"></i></div><b>${m.toFixed(1).replace('.',',')}</b></div>`;}).join('')}</div></div>`
  :(nota.legacy?`<div class="fp-aviso">Este proveedor tiene una valoración antigua de ${pfEstrellas(nota.n)} (una sola nota). Registra una evaluación por criterios para reemplazarla.</div>`:'<div class="fp-vacio">Todavía no hay evaluaciones. Evalúa después de cada trabajo: en unos meses sabrás con quién conviene seguir.</div>');
 const trabajos=pfMovs(p.id).slice(0,12).map(x=>x.desc+' · '+formatPeriodo(x.periodo));
 const form=_pfEvalForm?`<div class="fp-form"><div class="fp-ft">Nueva evaluación</div>
  ${PF_CRITERIOS.map(c=>`<div class="fp-star-row"><span>${c[1]}</span><div id="fe-${c[0]}">${[1,2,3,4,5].map(n=>`<button type="button" class="fp-st ${_pfSel[c[0]]>=n?'on':''}" onclick="pfStar('${c[0]}',${n})" aria-label="${n}">★</button>`).join('')}</div></div>`).join('')}
  <div class="form-row form-row-2"><div><label class="fl">Fecha</label><input class="fi" type="date" id="fe-fecha" value="${pfHoyISO()}"/></div>
   <div><label class="fl">Trabajo evaluado (opcional)</label><select class="fi" id="fe-trab"><option value="">General</option>${trabajos.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('')}</select></div></div>
  <div class="form-row"><div><label class="fl">Comentario (opcional)</label><input class="fi" id="fe-com" maxlength="300" placeholder="Qué salió bien o mal"/></div></div>
  <div style="display:flex;gap:8px"><button class="btn btn-success btn-sm" onclick="pfGuardarEval('${esc(p.id)}')">Guardar evaluación</button><button class="btn btn-ghost btn-sm" onclick="_pfEvalForm=false;pfRender()">Cancelar</button></div></div>`
  :`<button class="btn btn-primary btn-sm" onclick="_pfEvalForm=true;pfRender()">➕ Nueva evaluación</button>`;
 return `${resumen}<div style="margin:12px 0">${form}</div>
 ${ev.length?`<div class="fp-sec">Historial</div>${ev.map(e=>`<div class="fp-item"><div class="fp-item-h"><b>${esc(pfFecha(e.fecha))}</b> ${pfEstrellas(pfNotaEval(e))} <span class="fp-mut">${esc(pfNotaEval(e).toFixed(1).replace('.',','))}</span>${e.trabajo?`<span class="chip chip-cat">${esc(e.trabajo)}</span>`:''}<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="pfBorrarEval('${esc(p.id)}','${esc(e.id)}')" title="Eliminar">🗑</button></div>
  <div class="fp-mini">${PF_CRITERIOS.map(c=>`<span>${c[1].split(' ')[0]} <b>${esc(e[c[0]]||'–')}</b></span>`).join('')}</div>${e.comentario?`<div class="fp-com">“${esc(e.comentario)}”</div>`:''}<div class="fp-mut">Registrada por ${esc(e.por||'—')}</div></div>`).join('')}`:''}`;
}
function pfStar(c,n){_pfSel[c]=n;const w=document.getElementById('fe-'+c);if(w)w.querySelectorAll('.fp-st').forEach((b,i)=>b.classList.toggle('on',i<n));}
async function pfGuardarEval(id){
 if(PF_CRITERIOS.some(c=>!(_pfSel[c[0]]>=1))){showToast('Puntúa los 4 criterios (1 a 5 estrellas)','error');return;}
 const fecha=document.getElementById('fe-fecha').value||pfHoyISO();
 const eid=pfNuevoId(id,'evaluaciones');
 const rec={id:eid,fecha,plazos:_pfSel.plazos,calidad:_pfSel.calidad,precio:_pfSel.precio,trato:_pfSel.trato,trabajo:document.getElementById('fe-trab').value.slice(0,120),comentario:document.getElementById('fe-com').value.trim().slice(0,300),ts:Date.now(),por:pfUsuario()};
 await pfSet(id,'evaluaciones/'+eid,rec);
 _pfEvalForm=false;_pfSel={plazos:0,calidad:0,precio:0,trato:0};showToast('Evaluación guardada ✓','success');pfRender();renderView();
}
function pfBorrarEval(id,eid){if(!confirm('¿Eliminar esta evaluación?'))return;pfSet(id,'evaluaciones/'+eid,null);pfRender();renderView();showToast('Evaluación eliminada','success');}

/* -------------------------------------------------------------- Documentos */
function pfHtmlDocs(p){
 const l=pfDocs(p);
 const form=_pfDocForm?`<div class="fp-form"><div class="fp-ft">Nuevo documento</div>
  <div class="form-row form-row-2"><div><label class="fl">Tipo</label><select class="fi" id="fd-tipo">${PF_DOC_TIPOS.map(t=>`<option>${esc(t)}</option>`).join('')}</select></div>
   <div><label class="fl">Vence (opcional)</label><input class="fi" type="date" id="fd-ven"/></div></div>
  <div class="form-row"><div><label class="fl">Nombre o descripción *</label><input class="fi" id="fd-nom" maxlength="100" placeholder="Ej: Póliza responsabilidad civil 2026"/></div></div>
  <div class="form-row"><div><div class="file-drop" onclick="document.getElementById('fd-file').click()">📎 Adjuntar foto o PDF (máx. 4 MB)</div><input type="file" id="fd-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'fd-prev')"/><div id="fd-prev"></div></div></div>
  <div style="display:flex;gap:8px"><button class="btn btn-success btn-sm" id="fd-btn" onclick="pfGuardarDoc('${esc(p.id)}')">Guardar documento</button><button class="btn btn-ghost btn-sm" onclick="_pfDocForm=false;pfRender()">Cancelar</button></div></div>`
  :`<button class="btn btn-primary btn-sm" onclick="_pfDocForm=true;pfRender()">➕ Agregar documento</button>`;
 const c=pfContrato(p);
 return `<div style="margin-bottom:12px">${form}</div>
 ${c&&c.archivoRef?`<div class="fp-item"><div class="fp-item-h"><span class="chip chip-cat">Contrato</span><b>${esc(c.objeto||c.archivoNombre||'Contrato')}</b><button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="pfVerArchivo('${esc(c.archivoRef)}','${esc(c.archivoNombre||'Contrato')}')">Ver</button></div><div class="fp-mut">Se administra en la pestaña Contrato.</div></div>`:''}
 ${l.length?l.map(d=>{const e=pfEstadoVence(d.vence);return `<div class="fp-item"><div class="fp-item-h"><span class="chip chip-cat">${esc(d.tipo||'Otro')}</span><b>${esc(d.nombre||'Sin nombre')}</b><span class="chip ${e.cls}">${esc(e.txt)}</span>
  <span style="margin-left:auto;display:flex;gap:4px">${d.archivoRef?`<button class="btn btn-ghost btn-sm" onclick="pfVerArchivo('${esc(d.archivoRef)}','${esc(d.archivoNombre||d.nombre||'Documento')}')">Ver</button>`:''}<button class="btn btn-ghost btn-sm" onclick="pfBorrarDoc('${esc(p.id)}','${esc(d.id)}')" title="Eliminar">🗑</button></span></div>
  <div class="fp-mut">${d.vence?'Vence el '+esc(pfFecha(d.vence))+' · ':''}subido por ${esc(d.por||'—')}</div></div>`;}).join(''):(c&&c.archivoRef?'':'<div class="fp-vacio">Sin documentos. Guarda aquí pólizas, certificados, boletas de garantía y cotizaciones, con su fecha de vencimiento.</div>')}`;
}
async function pfGuardarDoc(id){
 const nom=document.getElementById('fd-nom').value.trim();
 if(nom.length<2){showToast('Escribe el nombre del documento','error');return;}
 const btn=document.getElementById('fd-btn');if(btn){btn.disabled=true;btn.textContent='Guardando…';}
 try{
  const arch=await pfSubirArchivo('fd-file');
  const did=pfNuevoId(id,'docs');
  const rec={id:did,tipo:document.getElementById('fd-tipo').value,nombre:nom.slice(0,100),vence:document.getElementById('fd-ven').value||'',ts:Date.now(),por:pfUsuario()};
  if(arch){rec.archivoRef=arch.ref;rec.archivoNombre=arch.nombre;}
  await pfSet(id,'docs/'+did,rec);
  _pfDocForm=false;showToast('Documento guardado ✓','success');pfRender();renderView();
 }catch(e){console.warn(e);showToast('No se pudo guardar: '+e.message,'error');const b=document.getElementById('fd-btn');if(b){b.disabled=false;b.textContent='Guardar documento';}}
}
function pfBorrarDoc(id,did){
 if(!confirm('¿Eliminar este documento y su archivo?'))return;
 const p=proveedorPorId(id),d=p&&comoListaConId(p.docs).find(x=>String(x.id)===String(did));
 pfSet(id,'docs/'+did,null);if(d&&d.archivoRef)borrarAdjunto(d.archivoRef);
 pfRender();renderView();showToast('Documento eliminado','success');
}

/* ---------------------------------------------------------------- Bitácora */
function pfHtmlBitacora(p){
 const l=pfBitacora(p);
 return `<div class="fp-form"><div class="fp-ft">Nueva anotación</div>
  <div class="form-row form-row-2"><div><label class="fl">Tipo</label><select class="fi" id="fb-tipo"><option value="nota">📝 Nota</option><option value="incidente">⚠️ Incidente</option></select></div>
   <div><label class="fl">Fecha</label><input class="fi" type="date" id="fb-fecha" value="${pfHoyISO()}"/></div></div>
  <div class="form-row"><div><label class="fl">Detalle *</label><input class="fi" id="fb-txt" maxlength="400" placeholder="Ej: se atrasó 2 semanas en el portón"/></div></div>
  <button class="btn btn-success btn-sm" onclick="pfGuardarBit('${esc(p.id)}')">Agregar a la bitácora</button></div>
 <div class="fp-sec">Historial</div>
 ${l.length?l.map(b=>`<div class="fp-item"><div class="fp-item-h"><b>${esc(pfFecha(b.fecha))}</b>${b.tipo==='incidente'?`<span class="chip ${b.estado==='resuelto'?'fp-ok':'fp-rojo'}">${b.estado==='resuelto'?'Incidente resuelto':'Incidente abierto'}</span>`:'<span class="chip chip-cat">Nota</span>'}
  <span style="margin-left:auto;display:flex;gap:4px">${b.tipo==='incidente'&&b.estado!=='resuelto'?`<button class="btn btn-outline btn-sm" onclick="pfResolverBit('${esc(p.id)}','${esc(b.id)}')">Marcar resuelto</button>`:''}<button class="btn btn-ghost btn-sm" onclick="pfBorrarBit('${esc(p.id)}','${esc(b.id)}')" title="Eliminar">🗑</button></span></div>
  <div class="fp-com">${esc(b.texto)}</div><div class="fp-mut">${esc(b.por||'—')}${b.resueltoTs?' · resuelto el '+esc(pfFecha(fechaClave(new Date(b.resueltoTs)))):''}</div></div>`).join(''):'<div class="fp-vacio">Sin anotaciones. Aquí queda el historial de incidentes y observaciones sobre este proveedor.</div>'}`;
}
async function pfGuardarBit(id){
 const txt=document.getElementById('fb-txt').value.trim();
 if(txt.length<3){showToast('Escribe el detalle','error');return;}
 const bid=pfNuevoId(id,'bitacora'),tipo=document.getElementById('fb-tipo').value;
 const rec={id:bid,fecha:document.getElementById('fb-fecha').value||pfHoyISO(),tipo,texto:txt.slice(0,400),ts:Date.now(),por:pfUsuario()};
 if(tipo==='incidente')rec.estado='abierto';
 await pfSet(id,'bitacora/'+bid,rec);showToast('Anotación agregada ✓','success');pfRender();
}
function pfResolverBit(id,bid){
 const p=proveedorPorId(id),b=p&&comoListaConId(p.bitacora).find(x=>String(x.id)===String(bid));if(!b)return;
 pfSet(id,'bitacora/'+bid,{...b,estado:'resuelto',resueltoTs:Date.now()});pfRender();
}
function pfBorrarBit(id,bid){if(!confirm('¿Eliminar esta anotación?'))return;pfSet(id,'bitacora/'+bid,null);pfRender();}

/* ============================================ gastos sin proveedor (en lote) */
let _pfGSP={anio:'todos',q:'',hoja:1,asig:{}};
function pfGastosSinProv(){
 const out=[];
 comoLista(appData.gastosVariables).forEach(g=>{if(g&&!g.proveedorId)out.push({t:'v',key:'',id:g.id,periodo:mkKey(g.anio,g.mes),desc:g.descripcion||'',monto:g.monto||0,cat:g.categoria||''});});
 const gf=appData.gastosFijos||{};
 Object.keys(gf).forEach(k=>comoLista(gf[k]).forEach(g=>{if(g&&!g.proveedorId)out.push({t:'f',key:k,id:g.id,periodo:k,desc:g.descripcion||g.nombre||'',monto:g.monto||0,cat:g.categoria||''});}));
 return out.sort((a,b)=>String(b.periodo).localeCompare(String(a.periodo)));
}
function pfClaveGasto(x){return x.t+':'+x.key+':'+x.id;}
/* Sugerencia: mismo concepto ya asignado antes (el proveedor más frecuente) o nombre del proveedor dentro del texto. */
function pfSugerencias(lista){
 const mapa={};
 const reg=(g)=>{if(!g||!g.proveedorId)return;const d=String(g.descripcion||g.nombre||'').toLowerCase().trim();if(!d)return;(mapa[d]=mapa[d]||{})[g.proveedorId]=((mapa[d]||{})[g.proveedorId]||0)+1;};
 comoLista(appData.gastosVariables).forEach(reg);
 Object.keys(appData.gastosFijos||{}).forEach(k=>comoLista(appData.gastosFijos[k]).forEach(reg));
 const provs=proveedores().filter(p=>p.activo!==false);const sug={};
 lista.forEach(x=>{
  const d=String(x.desc).toLowerCase().trim(),m=mapa[d];
  if(m){const best=Object.entries(m).sort((a,b)=>b[1]-a[1])[0][0];if(proveedorPorId(best)){sug[pfClaveGasto(x)]=best;return;}}
  const hit=provs.find(p=>p.nombre&&p.nombre.length>=4&&d.includes(String(p.nombre).toLowerCase()));if(hit)sug[pfClaveGasto(x)]=hit.id;
 });
 return sug;
}
function abrirGastosSinProv(){_pfGSP={anio:'todos',q:'',hoja:1,asig:{}};pfRenderGSP();}
function pfFiltrarGSP(){
 const todos=pfGastosSinProv(),q=_pfGSP.q.toLowerCase().trim();
 return {todos,lista:todos.filter(x=>(_pfGSP.anio==='todos'||String(x.periodo).startsWith(_pfGSP.anio))&&(!q||(x.desc+' '+x.cat).toLowerCase().includes(q)))};
}
function pfRenderGSP(){
 const {todos,lista}=pfFiltrarGSP(),POR=20,pags=Math.max(1,Math.ceil(lista.length/POR));if(_pfGSP.hoja>pags)_pfGSP.hoja=pags;
 const sug=pfSugerencias(lista),pv=proveedores().filter(p=>p.activo!==false).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
 const anios=[...new Set(todos.map(x=>String(x.periodo).slice(0,4)))].sort((a,b)=>b.localeCompare(a));
 const nAsig=Object.values(_pfGSP.asig).filter(Boolean).length,nSug=lista.filter(x=>sug[pfClaveGasto(x)]&&!_pfGSP.asig[pfClaveGasto(x)]).length;
 const pag=lista.slice((_pfGSP.hoja-1)*POR,_pfGSP.hoja*POR);
 document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal acta-modal">
 <div class="modal-title">🧩 Gastos sin proveedor <span class="fp-mut" style="font-weight:500">(${todos.length})</span></div>
 <div class="fp-mut" style="line-height:1.55;margin-bottom:10px">Asigna el proveedor a los gastos antiguos para que la ficha tenga historial completo. Se sugiere el proveedor cuando el mismo concepto ya fue asignado antes. <b>No cambia montos ni la información pública</b>: solo vincula el gasto.</div>
 <div class="toolbar"><div class="buscador"><span class="buscador-ico">🔎</span><input class="fi buscador-input" placeholder="Buscar concepto…" value="${esc(_pfGSP.q)}" oninput="_pfGSP.q=this.value;_pfGSP.hoja=1;pfRenderGSPLista()"/></div>
  <select class="fi" style="width:auto" onchange="_pfGSP.anio=this.value;_pfGSP.hoja=1;pfRenderGSP()"><option value="todos">Todos los años</option>${anios.map(a=>`<option ${_pfGSP.anio===a?'selected':''}>${a}</option>`).join('')}</select>
  <div class="toolbar-sep"></div>${nSug?`<button class="btn btn-outline btn-sm" onclick="pfAplicarSug()">✨ Aplicar ${nSug} sugerencia${nSug>1?'s':''}</button>`:''}</div>
 <div id="fp-gsp">${pfHtmlGSP(pag,sug,pv,pags,lista.length)}</div>
 <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-success" id="gsp-save" onclick="pfGuardarGSP()" ${nAsig?'':'disabled'}>Guardar ${nAsig?nAsig+' asignación'+(nAsig>1?'es':''):'asignaciones'}</button><button class="btn btn-ghost" onclick="closeModal();renderView()">Cerrar</button></div></div></div>`;
}
function pfRenderGSPLista(){
 const {lista}=pfFiltrarGSP(),POR=20,pags=Math.max(1,Math.ceil(lista.length/POR));if(_pfGSP.hoja>pags)_pfGSP.hoja=pags;
 const sug=pfSugerencias(lista),pv=proveedores().filter(p=>p.activo!==false).sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
 const el=document.getElementById('fp-gsp');if(el)el.innerHTML=pfHtmlGSP(lista.slice((_pfGSP.hoja-1)*POR,_pfGSP.hoja*POR),sug,pv,pags,lista.length);
}
function pfHtmlGSP(pag,sug,pv,pags,total){
 if(!total)return '<div class="empty-state"><div class="empty-ico">✅</div><div class="empty-txt">No quedan gastos sin proveedor con estos filtros.</div></div>';
 return `<div class="table-wrap"><table><thead><tr><th>Período</th><th>Concepto</th><th style="text-align:right">Monto</th><th>Proveedor</th></tr></thead><tbody>${pag.map(x=>{
  const k=pfClaveGasto(x),sel=_pfGSP.asig[k]||'',s=sug[k];
  return `<tr><td>${esc(formatPeriodo(x.periodo))}</td><td>${esc(x.desc)}<div class="fp-mut">${esc(x.cat)}${x.t==='f'?' · fijo':''}</div></td><td style="text-align:right">${esc(fmt(x.monto))}</td>
  <td><select class="fi" style="min-width:170px" onchange="pfAsignar('${esc(k)}',this.value)"><option value="">${s?'✨ sugerido: '+esc(proveedorNombre(s)):'— elegir —'}</option>${pv.map(p=>`<option value="${esc(p.id)}" ${String(sel)===String(p.id)?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></td></tr>`;}).join('')}</tbody></table></div>
 ${pags>1?`<div class="pg-wrap"><button class="pg-btn" ${_pfGSP.hoja<=1?'disabled':''} onclick="_pfGSP.hoja--;pfRenderGSPLista()">← Anterior</button><span class="pg-info">Hoja ${_pfGSP.hoja} de ${pags} · ${total} gastos</span><button class="pg-btn" ${_pfGSP.hoja>=pags?'disabled':''} onclick="_pfGSP.hoja++;pfRenderGSPLista()">Siguiente →</button></div>`:`<div class="fp-mut" style="margin-top:6px">${total} gasto${total>1?'s':''}</div>`}`;
}
function pfAsignar(k,v){if(v)_pfGSP.asig[k]=v;else delete _pfGSP.asig[k];const n=Object.keys(_pfGSP.asig).length,b=document.getElementById('gsp-save');if(b){b.disabled=!n;b.textContent='Guardar '+(n?n+' asignación'+(n>1?'es':''):'asignaciones');}}
function pfAplicarSug(){const {lista}=pfFiltrarGSP(),sug=pfSugerencias(lista);lista.forEach(x=>{const k=pfClaveGasto(x);if(sug[k]&&!_pfGSP.asig[k])_pfGSP.asig[k]=sug[k];});pfRenderGSP();}
function pfGuardarGSP(){
 const asig=_pfGSP.asig,ks=Object.keys(asig);if(!ks.length)return;
 let nV=0;const fijosTocados=new Set();
 ks.forEach(k=>{
  const [t,key,id]=[k.slice(0,1),k.slice(2,k.indexOf(':',2)),k.slice(k.indexOf(':',2)+1)];
  if(!proveedorPorId(asig[k]))return;
  if(t==='v'){const g=comoLista(appData.gastosVariables).find(x=>x&&String(x.id)===id);if(g){g.proveedorId=asig[k];nV++;}}
  else{const l=comoLista((appData.gastosFijos||{})[key]);const g=l.find(x=>x&&String(x.id)===id);if(g){g.proveedorId=asig[k];fijosTocados.add(key);}}
 });
 if(nV)savePath('gastosVariables',comoLista(appData.gastosVariables));
 fijosTocados.forEach(key=>savePath('gastosFijos/'+key,comoLista(appData.gastosFijos[key])));
 const total=nV+[...fijosTocados].reduce((s,k)=>s+ks.filter(x=>x.startsWith('f:'+k+':')).length,0);
 _pfGSP.asig={};showToast(total+' gasto'+(total===1?'':'s')+' vinculado'+(total===1?'':'s')+' ✓','success');pfRenderGSP();
}
function pfBotonGSP(){const n=pfGastosSinProv().length;return n?`<button class="btn btn-outline" onclick="abrirGastosSinProv()">🧩 Gastos sin proveedor (${n})</button>`:'';}
