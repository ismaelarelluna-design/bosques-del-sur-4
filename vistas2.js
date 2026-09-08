/* ===== vistas2.js (PARTE B) ===== */
function vFormularios(){const s=state.formulariosSortAsc;const so=[...(appData.formularios||[])].sort((a,b)=>s?a.fecha.localeCompare(b.fecha):b.fecha.localeCompare(a.fecha));
return `<div class="page-title">Formulario de Comprobantes</div><div class="page-sub">Genera comprobantes genéricos descargables en JPG</div><div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;"><button class="btn btn-success" onclick="openNuevoFormulario()">+ Nuevo Comprobante</button><button class="btn btn-ghost btn-sm" onclick="toggleFormulariosSort()">🔄 Ordenar: ${s?'Reciente → Antiguo':'Antiguo → Reciente'}</button></div><div class="card">${so.length===0?`<div style="text-align:center;padding:28px;color:var(--text3)">No hay comprobantes generados</div>`:`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Actividad</th><th>Monto</th><th>Tipo</th><th style="width:140px;"></th></tr></thead><tbody>${so.map(f=>`<tr><td>${f.fecha}</td><td>${f.actividad}</td><td><strong>${fmt(f.monto)}</strong></td><td><span class="badge badge-navy">${f.tipo}</span></td><td style="white-space:nowrap;"><button class="btn btn-primary btn-sm" onclick="descargarFormulario(${f.id})">⬇</button><button class="btn btn-outline btn-sm" onclick="openNuevoFormulario(${f.id})">✎</button><button class="btn btn-danger btn-sm" onclick="eliminarFormulario(${f.id})">✕</button></td></tr>`).join('')}</tbody></table></div>`}</div>`;}
function openNuevoFormulario(editId=null){let f=editId?(appData.formularios||[]).find(x=>x.id===editId):null;document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">${f?'Editar Comprobante':'Nuevo Comprobante'}</div><div class="form-row"><div><label class="fl">Actividad / Descripción</label><input class="fi" id="fo-act" value="${f?f.actividad:''}"/></div></div><div class="form-row form-row-2"><div><label class="fl">Monto Total ($)</label><input class="fi" id="fo-monto" type="number" placeholder="0" value="${f?f.monto:''}"/></div><div><label class="fl">Tipo de Pago</label><select class="fi" id="fo-tipo"><option ${f&&f.tipo==='Efectivo'?'selected':''}>Efectivo</option><option ${f&&f.tipo==='Transferencia'?'selected':''}>Transferencia</option></select></div></div><div class="form-row"><div><label class="fl">Fecha</label><input class="fi" id="fo-fecha" type="date" value="${f?f.fecha:new Date().toISOString().split('T')[0]}"/></div></div><div class="form-row"><div><label class="fl">Detalle (Opcional)</label><textarea class="fi" id="fo-detalle" rows="3">${f?f.detalle||'':''}</textarea></div></div><div style="display:flex;gap:10px;margin-top:10px;"><button class="btn btn-success" onclick="saveFormulario(${editId||'null'})">Guardar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;}
function saveFormulario(editId){const a=document.getElementById('fo-act').value.trim();const m=parseInt(document.getElementById('fo-monto').value)||0;const t=document.getElementById('fo-tipo').value;const f=document.getElementById('fo-fecha').value;const d=document.getElementById('fo-detalle').value.trim();if(!a||m<=0||!f){showToast('Complete los campos requeridos','error');return;}if(!appData.formularios)appData.formularios=[];if(editId){const i=appData.formularios.findIndex(x=>x.id===editId);if(i!==-1){appData.formularios[i]={...appData.formularios[i],actividad:a,monto:m,tipo:t,fecha:f,detalle:d};}}else{appData.formularios.push({id:Date.now(),actividad:a,monto:m,tipo:t,fecha:f,detalle:d});}savePath('formularios',appData.formularios);closeModal();renderView();showToast('Guardado ✓','success');}
function eliminarFormulario(id){if(!confirm('¿Eliminar este comprobante?'))return;appData.formularios=(appData.formularios||[]).filter(x=>x.id!==id);savePath('formularios',appData.formularios);renderView();showToast('Eliminado');}
function descargarFormulario(id){const f=(appData.formularios||[]).find(x=>x.id===id);if(!f)return;
const detLineas=f.detalle?((f.detalle.match(/.{1,60}/g)||[]).length):0;
const W=600,H=VOUCHER_BANNER_H+(f.detalle?369+detLineas*20:334);const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
cargarLogoVoucher().then(logo=>{
ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
const top=dibujarEncabezado(ctx,W,logo,'Comprobante de Gasto');
ctx.fillStyle='#10b981';roundRect(ctx,W/2-170,top+22,340,50,25);ctx.fill();
ctx.fillStyle='#FFFFFF';ctx.font='bold 18px Inter, Arial';ctx.textAlign='center';ctx.fillText('VÁLIDO COMO BOLETA DE GASTO',W/2,top+54);
let y=top+112;
const fila=(et,va)=>{ctx.fillStyle='#111827';ctx.font='bold 16px Inter, Arial';ctx.textAlign='left';ctx.fillText(et,40,y);ctx.fillStyle='#4B5563';ctx.font='16px Inter, Arial';ctx.fillText(va,150,y);y+=40;};
fila('Actividad:',f.actividad);fila('Monto:',fmt(f.monto));fila('Tipo:',f.tipo);fila('Fecha:',f.fecha);
if(f.detalle){y+=10;ctx.fillStyle='#111827';ctx.font='bold 16px Inter, Arial';ctx.textAlign='left';ctx.fillText('Detalle:',40,y);y+=25;ctx.fillStyle='#4B5563';ctx.font='14px Inter, Arial';(f.detalle.match(/.{1,60}/g)||[]).forEach(l=>{ctx.fillText(l,60,y);y+=20;});}
ctx.fillStyle='#9CA3AF';ctx.font='11px Inter, Arial';ctx.textAlign='center';ctx.fillText('Condominio Bosques del Sur 4',W/2,H-30);
ctx.fillStyle=gradienteBanner(ctx,W,8);ctx.fillRect(0,H-8,W,8);
const url=cv.toDataURL('image/jpeg',0.95);
lastDownload={url:url,filename:'Comprobante_'+f.fecha+'.jpg'};
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">📄 Comprobante Generado</div><div class="holo-wrap" style="margin-bottom:16px;"><img src="${url}" style="width:100%;border-radius:10px;border:1px solid var(--border);"/></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar JPG</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
});}
/* ===== VOUCHER DE PAGO =====
   Banner superior: una sola imagen (LOGO_VOUCHER_SRC) que ya incluye el nombre del
   condominio, por eso NO se dibuja el texto "CONDOMINIO BOSQUES DEL SUR 4" aparte
   ni se recorta el logo en circulo. La imagen es PNG con transparencia y tinta
   verde oscura, asi que el banner usa fondo claro para asegurar contraste. */
const VOUCHER_BANNER_H=200;
/* Degradado cyan del banner (3 paradas) y color de las lineas de cierre.
   El logo embebido es la variante CLARA porque el fondo es oscuro. */
const VOUCHER_GRAD=['#155E75','#0891B2','#2DD4BF'];
const VOUCHER_RULE='#155E75';
function gradienteBanner(ctx,W,H){const g=ctx.createLinearGradient(0,0,W,H);VOUCHER_GRAD.forEach((c,i)=>g.addColorStop(i/(VOUCHER_GRAD.length-1),c));return g;}
let _logoVoucherBox=null;
/* Recorta la imagen a su contenido visible (el PNG trae margenes transparentes
   amplios). Se calcula una sola vez por sesion; si getImageData falla se usa la
   imagen completa, que sigue siendo un resultado valido. */
function logoContentBox(img){
if(_logoVoucherBox)return _logoVoucherBox;
let box={x:0,y:0,w:img.width,h:img.height};
try{
const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(img,0,0);
const d=cx.getImageData(0,0,c.width,c.height).data;
let x0=c.width,y0=c.height,x1=-1,y1=-1;
for(let y=0;y<c.height;y++){for(let x=0;x<c.width;x++){if(d[(y*c.width+x)*4+3]>12){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}}
if(x1>=x0&&y1>=y0)box={x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}catch(e){}
_logoVoucherBox=box;return box;
}
/* Encabezado UNICO de todos los documentos generados en canvas: voucher de pago,
   voucher de multa, estado de cuenta y comprobante de gasto. Antes cada uno dibujaba
   su propia cabecera, por eso convivian dos identidades visuales distintas.
   `titulo` opcional: el voucher de pago no lleva (el nombre ya va en el logo).
   Devuelve la altura ocupada, para que cada documento posicione su contenido. */
function dibujarEncabezado(ctx,W,img,titulo){
const H=VOUCHER_BANNER_H;
ctx.fillStyle=gradienteBanner(ctx,W,H);ctx.fillRect(0,0,W,H);
const zona=titulo?H-46:H;
if(img){
const b=logoContentBox(img);
const padY=titulo?14:20,padX=44;
const s=Math.min((W-padX*2)/b.w,(zona-padY*2)/b.h);
const dw=b.w*s,dh=b.h*s;
ctx.drawImage(img,b.x,b.y,b.w,b.h,(W-dw)/2,(zona-dh)/2,dw,dh);
}else{
ctx.fillStyle='#FFFFFF';ctx.textAlign='center';
ctx.font='bold 20px Inter, Arial';ctx.fillText('CONDOMINIO',W/2,zona/2-12);
ctx.font=(titulo?'bold 24px':'bold 30px')+' Inter, Arial';ctx.fillText('BOSQUES DEL SUR 4',W/2,zona/2+(titulo?20:24));
}
if(titulo){ctx.fillStyle='#FFFFFF';ctx.textAlign='center';ctx.font='bold 19px Inter, Arial';ctx.fillText(titulo.toUpperCase(),W/2,H-18);}
ctx.fillStyle=VOUCHER_RULE;ctx.fillRect(0,H-4,W,4);
return H;
}
function drawVoucherBanner(ctx,W,img){return dibujarEncabezado(ctx,W,img,null);}
/* Carga (una sola vez) el logo del banner. Prioriza el data URI embebido en
   logo-voucher.js: funciona con file://, sin conexion y sin contaminar el canvas.
   Si ese archivo no estuviera cargado, cae al PNG por URL. Nunca rechaza: resuelve
   null y generarVoucher dibuja el banner tipografico de respaldo. */
let _logoVoucherImg=null,_logoVoucherPromise=null;
function cargarLogoVoucher(){
if(_logoVoucherPromise)return _logoVoucherPromise;
_logoVoucherPromise=new Promise(resolve=>{
const src=(typeof LOGO_VOUCHER_DATA!=='undefined'&&LOGO_VOUCHER_DATA)?LOGO_VOUCHER_DATA:LOGO_VOUCHER_SRC;
const i=new Image();
i.onload=()=>{_logoVoucherImg=i;resolve(i);};
i.onerror=()=>resolve(null);
i.src=src;
});
return _logoVoucherPromise;
}
function generarVoucher(key,deptoId,tipoOverride){const {currentYear,currentMonth}=state;const gc=getGC(currentYear,currentMonth);const depto=(appData.departamentos||[]).find(d=>d.id===deptoId);if(!depto)return;
const reg=normalizarPago(((appData.pagos||{})[key]||{})[deptoId]);const tipo=tipoOverride||reg.tipo||TIPO_PAGO_DEFAULT;const tm=tipoPagoMeta(tipo);
const ahora=new Date();const fs=ahora.toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'});const hs=ahora.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});const ms=MESES[currentMonth]+' '+currentYear;const W=600,H=920;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
const dv=(img)=>{ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
drawVoucherBanner(ctx,W,img);
ctx.fillStyle='#4B5563';ctx.font='500 13px Inter, Arial';ctx.textAlign='center';ctx.fillText('Voucher válido como comprobante de pago',W/2,VOUCHER_BANNER_H+30);
ctx.fillStyle='#10b981';roundRect(ctx,W/2-80,VOUCHER_BANNER_H+48,160,44,22);ctx.fill();
ctx.fillStyle='#FFFFFF';ctx.font='bold 20px Inter, Arial';ctx.textAlign='center';ctx.fillText('✓ PAGADO',W/2,VOUCHER_BANNER_H+77);
ctx.strokeStyle='#E5E7EB';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(40,VOUCHER_BANNER_H+108);ctx.lineTo(W-40,VOUCHER_BANNER_H+108);ctx.stroke();
let y=VOUCHER_BANNER_H+148;
st(ctx,'Datos del Departamento',W,y);y+=40;
dr(ctx,'Departamento',depto.numero,W,y);y+=44;
dr(ctx,'Representante',depto.representante||'—',W,y);y+=44;
dr(ctx,'Contacto',depto.contacto||'—',W,y);y+=50;
ctx.strokeStyle='#E5E7EB';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(W-40,y);ctx.stroke();y+=30;
st(ctx,'Datos del Pago',W,y);y+=40;
dr(ctx,'Período',ms,W,y);y+=44;
dr(ctx,'Monto Gasto Común',fmt(gc),W,y);y+=44;
dr(ctx,'Tipo de pago',tm.label,W,y);y+=44;
dr(ctx,'Fecha de Pago',fs,W,y);y+=44;
dr(ctx,'Hora',hs,W,y);y+=50;
ctx.strokeStyle='#E5E7EB';ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(W-40,y);ctx.stroke();y+=30;
ctx.fillStyle='#9CA3AF';ctx.font='11px Inter, Arial';ctx.textAlign='center';ctx.fillText('Documento generado automáticamente',W/2,y+20);ctx.fillText('Condominio Bosques del Sur 4 — '+new Date().getFullYear(),W/2,y+38);
ctx.fillStyle=gradienteBanner(ctx,W,8);ctx.fillRect(0,H-8,W,8);
try{return cv.toDataURL('image/jpeg',0.95);}catch(e){return null;}};
let shown=false;
const sv=(im)=>{if(shown)return;shown=true;const url=dv(im);if(url){lastVoucher={img:url,tipo:'pago',depto,mesStr:ms,gc,tipoPago:tipo,tipoPagoLabel:tm.label};lastDownload={url:url,filename:'Voucher_Depto_'+depto.numero+'_'+ms.replace(' ','_')+'.jpg'};mostrarVoucher(url,depto,ms,gc);}else showToast('Error generando imagen','error');};
cargarLogoVoucher().then(sv);
setTimeout(()=>sv(_logoVoucherImg),2500);}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function st(ctx,t,W,y){ctx.fillStyle='#0E7490';ctx.font='bold 13px Inter, Arial';ctx.textAlign='left';ctx.fillText(t.toUpperCase(),44,y);}
function dr(ctx,l,v,W,y){ctx.fillStyle='#9CA3AF';ctx.font='12px Inter, Arial';ctx.textAlign='left';ctx.fillText(l,44,y);ctx.fillStyle='#111827';ctx.font='bold 14px Inter, Arial';ctx.textAlign='right';ctx.fillText(v,W-44,y);}
function mostrarVoucher(img,depto,ms,gc){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px;"><div class="modal-title">🧾 Voucher de Pago</div><div class="holo-wrap" style="margin-bottom:16px;"><img src="${img}" style="width:100%;border-radius:10px;border:1px solid var(--border);"/></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar JPG</button><button class="btn btn-success" onclick="compartirUltimoVoucher()">📤 Compartir por WhatsApp</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;}
function adjuntarArchivo(t,id,key){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">Adjuntar Comprobante</div><div class="file-drop" onclick="document.getElementById('adj-file').click()">📎 Seleccionar imagen o PDF</div><input type="file" id="adj-file" accept="image/*,application/pdf" style="display:none" onchange="previewFile(this,'adj-prev')"/><div id="adj-prev"></div><div style="display:flex;gap:10px;margin-top:14px;"><button class="btn btn-primary" onclick="saveAdjunto('${t}',${id},'${key}')">Adjuntar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;}
function saveAdjunto(t,id,key){
const f=document.getElementById('adj-file');
if(!f.files.length){showToast('Selecciona un archivo','error');return;}
compressImage(f.files[0],d=>{
showToast('Subiendo comprobante...','');
subirAdjunto(d).then(ref=>{
const g=(t==='fijo')?((appData.gastosFijos&&appData.gastosFijos[key])?appData.gastosFijos[key].find(x=>x.id==id):null)
                    :((appData.gastosVariables||[]).find(x=>x.id==id));
if(!g){showToast('No se encontro el gasto','error');return;}
const refPrevia=g.archivoRef;
delete g.archivo;               /* si venia en formato antiguo, se reemplaza */
g.archivoRef=ref;
g.archivoNombre=d.name;
if(t==='fijo')savePath('gastosFijos/'+key,appData.gastosFijos[key]);
else savePath('gastosVariables',appData.gastosVariables);
if(refPrevia)borrarAdjunto(refPrevia);
closeModal();renderView();showToast('Comprobante adjuntado ✓','success');
}).catch(e=>showToast('Error al subir: '+e.message,'error'));
});}
function verArchivo(t,id,key){
let g;
if(t==='fijo'){if(!appData.gastosFijos||!appData.gastosFijos[key])return;g=appData.gastosFijos[key].find(x=>x.id==id);}
else{g=(appData.gastosVariables||[]).find(x=>x.id==id);}
if(!tieneAdjunto(g))return;
const nom=nombreAdjunto(g);
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:580px;"><div class="modal-title">📎 ${nom}</div><div style="padding:28px;text-align:center;color:var(--text3);font-size:13px;">Cargando comprobante…</div></div></div>`;
obtenerAdjunto(g).then(a=>{
if(!a){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">📎 ${nom}</div><div style="padding:20px;text-align:center;color:var(--danger);font-size:13px;">No se pudo cargar el comprobante.</div><button class="btn btn-ghost" style="width:100%;" onclick="closeModal()">Cerrar</button></div></div>`;return;}
lastDownload={url:a.data,filename:a.name||nom};
const ii=a.type&&a.type.startsWith('image/');
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:580px;"><div class="modal-title">📎 ${a.name||nom}</div>${ii?`<img src="${a.data}" style="width:100%;border-radius:8px;margin-bottom:12px"/>`:'<div style="padding:20px;text-align:center;color:var(--text3)">📄 Archivo PDF adjunto</div>'}<div style="display:flex;gap:10px;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
});}
function previewFile(i,p){const pr=document.getElementById(p);if(!i.files.length){pr.innerHTML='';return;}const f=i.files[0];const ii=f.type.startsWith('image/');const r=new FileReader();r.onload=e=>{pr.innerHTML=`<div class="file-preview">${ii?`<img src="${e.target.result}" style="height:40px;border-radius:4px"/>`:'📄'}<span class="file-name">${f.name}</span><span style="color:var(--text3);font-size:11px">${(f.size/1024).toFixed(1)}KB</span></div>`;};r.readAsDataURL(f);}
function compressImage(file,cb,q=0.6){if(!file||!file.type.match('image.*')){const r=new FileReader();r.onload=e=>cb({name:file.name,type:file.type,data:e.target.result});r.readAsDataURL(file);return;}const r=new FileReader();r.onload=function(ev){const img=new Image();img.onload=function(){const cv=document.createElement('canvas');const cx=cv.getContext('2d');const mw=1024,mh=1024;let w=img.width,h=img.height;if(w>h){if(w>mw){h*=mw/w;w=mw;}}else{if(h>mh){w*=mh/h;h=mh;}}cv.width=w;cv.height=h;cx.drawImage(img,0,0,w,h);cb({name:file.name.replace(/\.[^/.]+$/,'.jpg'),type:'image/jpeg',data:cv.toDataURL('image/jpeg',q)});};img.onerror=()=>{const r2=new FileReader();r2.onload=e=>cb({name:file.name,type:file.type,data:e.target.result});r2.readAsDataURL(file);};img.src=ev.target.result;};r.readAsDataURL(file);}
function readFileAsBase64(f,cb){compressImage(f,cb);}
function generarEstadoCuenta(id){const m=calcularMorosidad().find(x=>x.dep.id===id);if(!m)return;
const rows=[];m.gcMeses.forEach(g=>rows.push({t:'GC '+g.label,v:g.monto}));m.multas.forEach(x=>rows.push({t:'Multa '+x.fecha_creacion+' · '+x.regla,v:x.monto}));
const W=600;const H=VOUCHER_BANNER_H+190+rows.length*26;const cv=document.createElement('canvas');cv.width=W;cv.height=H;const ctx=cv.getContext('2d');
cargarLogoVoucher().then(logo=>{
ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
const top=dibujarEncabezado(ctx,W,logo,'Estado de Cuenta');
ctx.fillStyle='#111827';ctx.font='bold 15px Inter, Arial';ctx.textAlign='left';ctx.fillText('Depto '+m.dep.numero+' — '+(m.dep.representante||''),40,top+42);
let y=top+78;
rows.forEach(r=>{ctx.fillStyle='#4B5563';ctx.font='13px Inter, Arial';ctx.textAlign='left';ctx.fillText('• '+r.t,40,y);ctx.textAlign='right';ctx.fillText(fmt(r.v),W-40,y);y+=26;});
ctx.strokeStyle='#E5E7EB';ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(W-40,y);ctx.stroke();y+=32;
ctx.fillStyle='#DC2626';ctx.font='bold 18px Inter, Arial';ctx.textAlign='left';ctx.fillText('TOTAL PENDIENTE:',40,y);ctx.textAlign='right';ctx.fillText(fmt(m.total),W-40,y);y+=40;
ctx.fillStyle='#9CA3AF';ctx.font='11px Inter, Arial';ctx.textAlign='center';ctx.fillText('Romina Gabriela Figueroa Acevedo · Mercado Pago · Cta Vista N° 1088283442',W/2,y);
ctx.fillStyle=gradienteBanner(ctx,W,8);ctx.fillRect(0,H-8,W,8);
const url=cv.toDataURL('image/jpeg',0.95);
lastVoucher={img:url,tipo:'estado',depto:m.dep,texto:textoMoroso(m)};
lastDownload={url:url,filename:'Estado_Cuenta_Depto_'+m.dep.numero+'.jpg'};
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal" style="max-width:560px;"><div class="modal-title">📄 Estado de Cuenta — Depto ${m.dep.numero}</div><div class="holo-wrap" style="margin-bottom:16px;"><img src="${url}" style="width:100%;border-radius:10px;border:1px solid var(--border);"/></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-primary" onclick="descargarUltimo()">⬇ Descargar JPG</button><button class="btn btn-success" onclick="compartirUltimoVoucher()">📤 Compartir por WhatsApp</button><button class="btn btn-ghost" onclick="closeModal()">Cerrar</button></div></div></div>`;
});}
function vRecordatorios(){const t=state.ventanaMorosidad||'12';const mor=calcularMorosidad();const tot=mor.reduce((s,m)=>s+m.total,0);const lv=t==='12'?'Últimos 12 meses':(t==='anio'?'Año en curso':'Todo el historial');
const cards=mor.map(m=>{const gr=m.gcMeses.map(g=>`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:2px 0;"><span>• ${g.label}</span><span>${fmt(g.monto)}</span></div>`).join('');const mr=m.multas.map(x=>`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);padding:2px 0;"><span>• ${x.fecha_creacion} · ${x.regla}</span><span>${fmt(x.monto)}</span></div>`).join('');
return `<div class="card" style="margin-bottom:14px;"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;"><div><span style="font-size:16px;font-weight:700;color:var(--text);">Depto ${m.dep.numero}</span> <span style="color:var(--text3);font-size:12px;">${m.dep.representante||''}</span> <span style="color:var(--text3);font-size:11px;">📞 ${m.dep.contacto||'sin contacto'}</span></div><div style="font-size:16px;font-weight:800;color:var(--danger);">Total: ${fmt(m.total)}</div></div>${m.gcMeses.length?`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px;">Gasto común</div>${gr}</div>`:''}${m.multas.length?`<div style="margin-bottom:8px;"><div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:4px;">Multas</div>${mr}</div>`:''}<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><button class="btn btn-success btn-sm" onclick="recordarMorosoWhatsApp(${m.dep.id})">💬 Recordar por WhatsApp</button><button class="btn btn-outline btn-sm" onclick="generarEstadoCuenta(${m.dep.id})">📄 Estado de cuenta</button></div></div>`;}).join('');
return `<div class="page-title">Recordatorios de Morosidad</div><div class="page-sub">Cartera vencida desglosada (gasto común + multas)</div><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><div class="stat-card" style="padding:10px 16px;"><div class="stat-label">Deptos morosos</div><div class="stat-value" style="font-size:20px;">${mor.length}</div></div><div class="stat-card" style="padding:10px 16px;"><div class="stat-label">Total pendiente</div><div class="stat-value" style="font-size:20px;color:var(--danger);">${fmt(tot)}</div></div></div><select class="fi" style="width:auto;" onchange="state.ventanaMorosidad=this.value;renderView()"><option value="12" ${t==='12'?'selected':''}>Últimos 12 meses</option><option value="anio" ${t==='anio'?'selected':''}>Año en curso</option><option value="todo" ${t==='todo'?'selected':''}>Todo el historial</option></select></div><div style="font-size:11px;color:var(--text3);margin-bottom:12px;">Mostrando: ${lv}</div>${mor.length?cards:`<div class="card" style="text-align:center;padding:28px;color:var(--text3);">🎉 No hay morosidad en el período seleccionado</div>`}`;}
function vReportes(){const {currentYear,currentMonth}=state;const key=mkKey(currentYear,currentMonth);const bg=calcularBalanceGeneral();const gc=getGC(currentYear,currentMonth);const p=appData.pagos[key]||{};const pg=contarPagos(p);const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).reduce((s,g)=>s+g.monto,0);const fm=(appData.gastosFijos&&appData.gastosFijos[key])?appData.gastosFijos[key]:[];const f=fm.reduce((s,g)=>s+g.monto,0);const va=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).reduce((s,g)=>s+g.monto,0);const tI=pg*gc+ex,tE=f+va,bal=tI-tE;
let h=`<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;flex-wrap:wrap;"><div class="logo-circ" style="width:46px;height:46px;border-radius:50%;overflow:hidden;border:2px solid var(--border);"><img src="${document.getElementById('topbar-logo').src}" style="width:100%;height:100%;object-fit:cover;"/></div><div style="flex:1"><div class="page-title" style="margin:0">Reporte Transparencia</div><div style="font-size:12px;color:var(--text3)">Condominio Bosques del Sur 4</div></div><button class="btn btn-primary btn-sm" onclick="window.print()"> Exportar PDF</button></div><div class="page-sub">${MESES[currentMonth]} ${currentYear} — Información pública</div>${monthTabs()}<div class="section-label first">🏠 Zona Residente</div><div class="bank-banner"><div class="bank-banner-icon">🏦</div><div class="bank-banner-body"><div class="bank-banner-title">Datos para transferencia</div><div class="bank-banner-details"><div class="bank-banner-detail"><span class="bank-banner-detail-label">Nombre:</span><strong>Romina Gabriela Figueroa Acevedo</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">RUT:</span><strong>169111200</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">Banco:</span><strong>Mercado Pago</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">Tipo:</span><strong>Cuenta Vista</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">N° Cuenta:</span><strong>1088283442</strong></div><div class="bank-banner-detail"><span class="bank-banner-detail-label">Email:</span><strong>rominaaa2422@gmail.com</strong></div></div></div><button class="bank-banner-copy" onclick="copyBankData()">📋 Copiar</button></div><div class="info-cards-grid"><a href="https://github.com/ismaelarelluna-design/bosques-del-sur-4/raw/main/Reglamento%20interno%20BSD4.pdf" download="Reglamento_Interno_BSD4.pdf" class="info-card"><div class="info-card-icon">📄</div><div class="info-card-body"><div class="info-card-title">Descarga el Reglamento Interno + Anexo</div><div class="info-card-desc">Documento oficial del condominio en PDF</div></div><div class="info-card-arrow">→</div></a><a href="https://docs.google.com/forms/d/e/1FAIpQLSeRePmnAuBus-KWRRWEeUmF3Q-uJLRr3c-78kqnmUPlFFAqPg/viewform?pli=1" target="_blank" rel="noopener" class="info-card"><div class="info-card-icon">📨</div><div class="info-card-body"><div class="info-card-title">Buzón del Residente</div><div class="info-card-desc">Sugerencias, consultas, reclamos y reportes</div></div><div class="info-card-arrow">→</div></a></div><div class="section-label">📊 Resumen Financiero</div><div class="stats-grid"><div class="stat-card hero" style="grid-column: span 2;"><div class="stat-label">💰 Balance General Acumulado</div><div class="stat-value" style="font-size:30px;">${fmt(bg)}</div></div><div class="stat-card"><div class="stat-label"><span class="stat-icon">✅</span>Dptos Al Día</div><div class="stat-value">${pg}<span style="font-size:12px;color:var(--text3)">/${TOTAL_DEPTOS}</span></div><div class="stat-meta">${fmt(pg*gc)}</div></div><div class="stat-card"><div class="stat-label"><span class="stat-icon">📉</span>Egresos</div><div class="stat-value small">${fmt(tE)}</div></div><div class="stat-card"><div class="stat-label"><span class="stat-icon">️</span>Balance Mensual</div><div class="stat-value small" style="color:${bal>=0?'var(--green)':'var(--danger)'}">${fmt(bal)}</div></div></div><div class="section-label">📈 Análisis y Detalle</div><div class="charts-grid"><div class="card"><div class="card-title">Recaudación ${MESES[currentMonth]}</div><div style="text-align:center;padding:14px 0;"><div class="donut-wrap"><canvas id="ch-rep-dona" width="160" height="160"></canvas><div class="donut-label"><div class="donut-pct">${Math.round(pg/TOTAL_DEPTOS*100)}%</div><div class="donut-sub">al día</div></div></div><div style="margin-top:12px;font-size:13px;color:var(--text2)">${pg} de ${TOTAL_DEPTOS} dptos pagaron</div></div></div><div class="card"><div class="card-title">Distribución de Gastos</div><canvas id="ch-rep-bar"></canvas></div></div>${cardTipoPago('ch-rep-tipo-pago',currentYear,currentMonth)}<div class="card mb-16"><div class="card-title">Movimiento de Pagos — Gasto Común ${currentYear}</div><canvas id="ch-gc-pagos" style="max-height:220px;"></canvas></div><div class="card"><div class="card-title">Detalle de Gastos — ${MESES[currentMonth]} ${currentYear}</div><div class="table-wrap"><table><thead><tr><th>Descripción</th><th>Categoría</th><th>Monto</th><th>Comprobante</th></tr></thead><tbody>`;
fm.forEach(g=>{h+=`<tr><td>${g.descripcion}</td><td><span class="badge badge-navy">Fijo</span></td><td>${fmt(g.monto)}</td><td>${tieneAdjunto(g)?`<button class="btn btn-ghost btn-sm" onclick="verArchivo('fijo',${g.id},'${key}')">📎 Ver boleta</button>`:'<span style="color:var(--text3)">—</span>'}</td></tr>`;});
(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth).forEach(g=>{h+=`<tr><td>${g.descripcion}</td><td><span class="badge badge-orange">Variable</span></td><td>${fmt(g.monto)}</td><td>${tieneAdjunto(g)?`<button class="btn btn-ghost btn-sm" onclick="verArchivo('var',${g.id})">📎 Ver boleta</button>`:'<span style="color:var(--text3)">—</span>'}</td></tr>`;});
h+=`</tbody></table></div></div>`;return h;}
function copyLink(u){navigator.clipboard.writeText(u).then(()=>showToast('Link copiado ✓','success')).catch(()=>{const e=document.createElement('textarea');e.value=u;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);showToast('Link copiado ✓','success');});}
function copyBankData(){const t=`Romina Gabriela Figueroa Acevedo\nRUT: 169111200\nMercado Pago\nCuenta Vista\nNúmero de cuenta: 1088283442\nrominaaa2422@gmail.com`;navigator.clipboard.writeText(t).then(()=>showToast('Datos copiados ✓','success')).catch(()=>{const e=document.createElement('textarea');e.value=t;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);showToast('Datos copiados ✓','success');});}
function copyResidentesLink(){const u=window.location.origin+window.location.pathname+'?vista=transparencia';navigator.clipboard.writeText(u).then(()=>showToast('Link de residentes copiado ✓','success')).catch(()=>{const e=document.createElement('textarea');e.value=u;document.body.appendChild(e);e.select();document.execCommand('copy');document.body.removeChild(e);showToast('Link de residentes copiado ✓','success');});}
/* ===== MIGRACION DE ADJUNTOS ANTIGUOS =====
   Mueve los comprobantes que hoy viven dentro de 'cbs4' a la rama 'cbs4_adjuntos'.
   Es segura y reanudable: sube PRIMERO el archivo y solo despues reemplaza el registro
   por su referencia. Si algo falla a mitad de camino, lo no migrado sigue intacto y
   se puede volver a ejecutar. */
function adjuntosPendientes(){
const out=[];
/* comoLista() por defensa: esta vista recorre TODOS los periodos, incluidos los
   antiguos, que son los mas propensos a haber quedado con huecos en Firebase. */
const gf=appData.gastosFijos||{};
Object.keys(gf).forEach(k=>comoLista(gf[k]).forEach(g=>{if(g&&g.archivo)out.push({tipo:'fijo',key:k,reg:g});}));
comoLista(appData.gastosVariables).forEach(g=>{if(g&&g.archivo)out.push({tipo:'var',reg:g});});
comoLista(appData.multas).forEach(m=>{if(m&&m.evidencia_url)out.push({tipo:'multa',reg:m});});
return out;
}
function pesoAdjuntos(){
return adjuntosPendientes().reduce((s,x)=>{const a=x.reg.archivo||x.reg.evidencia_url;return s+((a&&a.data)?a.data.length:0);},0);
}
function vMigrarAdjuntos(){
const p=adjuntosPendientes();
if(!p.length){showToast('No hay comprobantes antiguos por mover ✓','success');return;}
const mb=(pesoAdjuntos()/1048576).toFixed(1);
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">📦 Mover comprobantes</div><p style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:10px;">Se moverán <strong>${p.length} comprobantes</strong> (${mb} MB) fuera de la ficha principal.</p><p style="font-size:12px;color:var(--text3);line-height:1.6;margin-bottom:12px;">Después de esto, cada celular dejará de descargarlos automáticamente: se bajarán solo al abrirlos. Los comprobantes no se pierden y el proceso se puede repetir si se interrumpe.</p><p style="font-size:12px;color:var(--warning,#B45309);line-height:1.6;margin-bottom:18px;">⏳ No cierres esta pestaña hasta que termine. Puede tardar un par de minutos.</p><div id="mig-prog" style="font-size:12px;color:var(--text3);margin-bottom:14px;"></div><div style="display:flex;gap:10px;"><button class="btn btn-primary" id="mig-btn" onclick="ejecutarMigracionAdjuntos()">Mover ahora</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
}
async function ejecutarMigracionAdjuntos(){
const btn=document.getElementById('mig-btn');const prog=document.getElementById('mig-prog');
if(btn){btn.disabled=true;btn.textContent='Moviendo...';}
const items=adjuntosPendientes();
/* Se procesa RAMA POR RAMA y se guarda apenas cada rama termina.
   Asi, si se corta la conexion o se cierra la pestana a mitad de camino,
   lo ya migrado queda guardado y al repetir solo continua con lo que falta. */
const grupos={};
items.forEach(it=>{
const rama=(it.tipo==='fijo')?('gastosFijos/'+it.key):((it.tipo==='var')?'gastosVariables':'multas');
(grupos[rama]=grupos[rama]||[]).push(it);
});
let ok=0,err=0,hechos=0;
for(const rama of Object.keys(grupos)){
let tocado=false;
for(const it of grupos[rama]){
hechos++;
if(prog)prog.textContent=`Moviendo ${hechos} de ${items.length}…`;
try{
const archivo=it.reg.archivo||it.reg.evidencia_url;
const ref=await subirAdjunto(archivo);          /* 1) sube primero */
if(it.tipo==='multa'){it.reg.evidenciaRef=ref;it.reg.evidenciaNombre=archivo.name||'Evidencia';delete it.reg.evidencia_url;}
else{it.reg.archivoRef=ref;it.reg.archivoNombre=archivo.name||'Comprobante';delete it.reg.archivo;}
tocado=true;ok++;
}catch(e){err++;console.error('migracion adjunto',e);}
}
if(tocado){                                        /* 2) recien ahora limpia la rama */
try{
if(rama.indexOf('gastosFijos/')===0)await savePath(rama,comoLista(appData.gastosFijos[rama.slice(12)]));
else if(rama==='gastosVariables')await savePath('gastosVariables',comoLista(appData.gastosVariables));
else await savePath('multas',comoLista(appData.multas));
}catch(e){err++;console.error('guardando rama '+rama,e);}
}
}
closeModal();renderView();
showToast(err?`Movidos ${ok}, con ${err} error(es) — puedes repetir el proceso`:`${ok} comprobantes movidos ✓`,err?'error':'success');
}
/* ===== LIMPIEZA DE RAMAS OBSOLETAS ===== */
let _limpiezaPlan=null;
function vLimpiarObsoletos(){
const ramas=ramasObsoletasPresentes();
clavesGastosFijosInvalidas().then(claves=>{
if(!ramas.length&&!claves.length){showToast('No hay datos antiguos que limpiar ✓','success');return;}
_limpiezaPlan={ramas:ramas.map(r=>r.rama),claves:claves};
const total=ramas.reduce((s,r)=>s+r.bytes,0);
const filas=ramas.map(r=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid var(--border);"><span style="font-family:monospace;color:var(--text2);">cbs4/${r.rama}</span><span style="color:var(--text3);">${(r.bytes/1024).toFixed(1)} KB</span></div>`).join('')
+ claves.map(k=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid var(--border);"><span style="font-family:monospace;color:var(--text2);">cbs4/gastosFijos/${k}</span><span style="color:var(--text3);">clave inválida</span></div>`).join('');
document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open" onclick="if(event.target===this)closeModal()"><div class="modal"><div class="modal-title">🧹 Limpiar datos antiguos</div><p style="font-size:13px;color:var(--text2);line-height:1.7;margin-bottom:12px;">Se eliminarán estas ramas, que quedaron de una versión anterior de la app y que <strong>ningún archivo del código lee</strong>:</p><div style="margin-bottom:14px;">${filas}</div><p style="font-size:13px;color:var(--text2);margin-bottom:10px;">Total a liberar: <strong>${(total/1024).toFixed(1)} KB</strong></p><p style="font-size:12px;color:var(--danger);line-height:1.6;margin-bottom:18px;">⚠️ Esto borra datos y no se puede deshacer desde la app. Asegúrate de tener el respaldo JSON exportado desde Firebase.</p><div style="display:flex;gap:10px;"><button class="btn btn-danger" id="limp-btn" onclick="ejecutarLimpiezaObsoletos()">Sí, eliminar</button><button class="btn btn-ghost" onclick="closeModal()">Cancelar</button></div></div></div>`;
});
}
async function ejecutarLimpiezaObsoletos(){
if(!_limpiezaPlan)return;
const btn=document.getElementById('limp-btn');
if(btn){btn.disabled=true;btn.textContent='Eliminando...';}
let ok=0,err=0;
for(const r of _limpiezaPlan.ramas){
try{await db.ref('cbs4/'+r).remove();delete appData[r];ok++;}catch(e){err++;console.error('limpiando '+r,e);}
}
for(const k of _limpiezaPlan.claves){
try{await db.ref('cbs4/gastosFijos/'+k).remove();ok++;}catch(e){err++;console.error('limpiando gastosFijos/'+k,e);}
}
_limpiezaPlan=null;
closeModal();renderView();
showToast(err?`Eliminadas ${ok}, con ${err} error(es)`:`${ok} rama(s) antigua(s) eliminada(s) ✓`,err?'error':'success');
}
function vConfig(){const h=appData.gastoComunHistorial||[{desde:'2022-01',valor:DEFAULT_GC}];const so=[...h].sort((a,b)=>b.desde.localeCompare(a.desde));const cg=so[0]?so[0].valor:DEFAULT_GC;
return `<div class="page-title">Configuración</div><div class="page-sub">Ajustes del sistema</div><div class="card mb-16"><div class="config-section-title">💰 Valor Gasto Común</div><div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;"><div style="flex:1;min-width:180px;"><label class="fl">Nuevo valor ($)</label><input class="fi" id="cfg-gc-val" type="number" value="${cg}"/></div><div style="flex:1;min-width:180px;"><label class="fl">Vigente desde</label><select class="fi" id="cfg-gc-mes">${YEARS.map(y=>MESES.map((m,i)=>`<option value="${mkKey(y,i)}">${m} ${y}</option>`).join('')).join('')}</select></div><button class="btn btn-primary" onclick="saveNuevoGC()">Guardar</button></div><div class="config-section-title" style="margin-top:4px;">Historial de valores</div>${so.map(x=>`<div class="history-item"><span>Desde <strong>${formatPeriodo(x.desde)}</strong></span><span style="font-weight:600;color:var(--green)">${fmt(x.valor)}/depto</span></div>`).join('')}</div><div class="card mb-16"><div class="config-section-title"> Apariencia</div><div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;"><div><div style="font-weight:600;font-size:14px;">Tema oscuro</div><div style="font-size:12px;color:var(--text3)">Modo nocturno</div></div><label class="switch"><input type="checkbox" ${state.theme==='dark'?'checked':''} onchange="toggleTheme()"><span class="slider"></span></label></div></div><div class="card mb-16"><div class="config-section-title">📦 Comprobantes adjuntos</div><div style="font-size:12px;color:var(--text3);line-height:1.7;margin-bottom:12px;">Los comprobantes nuevos ya se guardan aparte y se descargan solo cuando los abres. Si tienes comprobantes antiguos, muévelos aquí para aligerar la app en todos los dispositivos.</div><div style="font-size:13px;color:var(--text2);margin-bottom:12px;">${(()=>{const n=adjuntosPendientes().length;return n?`⚠️ Hay <strong>${n}</strong> comprobante(s) antiguo(s) dentro de la ficha principal (${(pesoAdjuntos()/1048576).toFixed(1)} MB).`:`✅ Todos los comprobantes están guardados aparte.`;})()}</div><button class="btn btn-primary" onclick="vMigrarAdjuntos()">📦 Revisar y mover comprobantes antiguos</button><div style="height:1px;background:var(--border);margin:16px 0;"></div><div style="font-size:12px;color:var(--text3);line-height:1.7;margin-bottom:12px;">También quedaron ramas de una versión anterior de la app que nadie usa pero que siguen viajando a cada dispositivo.</div><div style="font-size:13px;color:var(--text2);margin-bottom:12px;">${(()=>{const r=ramasObsoletasPresentes();const t=r.reduce((s,x)=>s+x.bytes,0);return r.length?`⚠️ Hay <strong>${r.length}</strong> rama(s) antigua(s): <span style="font-family:monospace;font-size:11px;">${r.map(x=>x.rama).join(', ')}</span> (${(t/1024).toFixed(1)} KB).`:`✅ No hay ramas antiguas.`;})()}</div><button class="btn btn-danger" onclick="vLimpiarObsoletos()">🧹 Revisar y limpiar datos antiguos</button></div><div class="card"><div class="config-section-title">🔥 Sincronización Firebase</div><div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface2);border-radius:8px;margin-bottom:12px;"><span class="sync-dot ${state.connected?'':'off'}" style="width:12px;height:12px;flex-shrink:0;"></span><div><div style="font-weight:600;font-size:13px;">${state.connected?'Conectado a Firebase':'Sin conexión'}</div><div style="font-size:11px;color:var(--text3)">Los datos se sincronizan en tiempo real entre todos los dispositivos</div></div></div><p style="font-size:12px;color:var(--text3);">️ Cualquier cambio se refleja automáticamente en los otros administradores conectados.</p></div>`;}
function saveNuevoGC(){const v=parseInt(document.getElementById('cfg-gc-val').value);const d=document.getElementById('cfg-gc-mes').value;if(!v||v<=0){showToast('Ingrese un valor válido','error');return;}if(!appData.gastoComunHistorial)appData.gastoComunHistorial=[];const e=appData.gastoComunHistorial.find(x=>x.desde===d);if(e)e.valor=v;else appData.gastoComunHistorial.push({desde:d,valor:v});savePath('gastoComunHistorial',appData.gastoComunHistorial);showToast(`GC actualizado a ${fmt(v)} desde ${formatPeriodo(d)} ✓`,'success');}
/* Card reutilizable "Efectivo vs Transferencia" del periodo indicado.
   Usada por vDashboard (ch-tipo-pago) y vReportes (ch-rep-tipo-pago). */
function cardTipoPago(canvasId,anio,mes){
const r=resumenTipoPago(anio,mes);
const fila=(m,d)=>`<div style="display:flex;align-items:center;gap:10px;padding:9px 0;"><span style="width:10px;height:10px;border-radius:50%;background:${tipoPagoColor(m.id)};flex-shrink:0;"></span><span style="flex:1;font-size:13px;color:var(--text2);">${m.icon} ${m.label}</span><span style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;">${d.deptos}<span style="color:var(--text3);font-weight:400;">/${TOTAL_DEPTOS}</span></span><span style="font-size:13px;font-weight:700;color:${tipoPagoTextColor(m.id)};min-width:96px;text-align:right;">${fmt(d.monto)}</span></div>`;
const sep='<div style="height:1px;background:var(--border);"></div>';
const cuerpo=r.total.deptos===0
?'<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">Aún no hay pagos registrados en este período</div>'
:`<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;"><div style="flex:0 0 auto;margin:0 auto;"><canvas id="${canvasId}" width="150" height="150"></canvas></div><div style="flex:1;min-width:250px;">${fila(tipoPagoMeta('efectivo'),r.efectivo)}${sep}${fila(tipoPagoMeta('transferencia'),r.transferencia)}${sep}<div style="display:flex;align-items:center;gap:10px;padding:9px 0;"><span style="flex:1;font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;">Total recaudado GC</span><span style="font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;">${r.total.deptos}<span style="color:var(--text3);font-weight:400;">/${TOTAL_DEPTOS}</span></span><span style="font-size:13px;font-weight:800;color:var(--text);min-width:96px;text-align:right;">${fmt(r.total.monto)}</span></div></div></div>`;
return `<div class="card mb-16"><div class="card-title">Efectivo vs Transferencia — ${MESES[mes]} ${anio}</div>${cuerpo}</div>`;
}
function drawCharts(){try{const {currentYear,currentMonth}=state;const labM=MESES.map(m=>m.substring(0,3));const dk=state.theme==='dark';const gc=getGC(currentYear,currentMonth);const grid=dk?'rgba(255,255,255,0.05)':'rgba(15,23,42,0.05)';const tick=dk?'#94A3B8':'#64748B';const co={plugins:{legend:{labels:{color:tick,font:{family:'Inter',size:11}}}},scales:{y:{grid:{color:grid},ticks:{color:tick,callback:v=>fmt(v)}},x:{grid:{color:grid},ticks:{color:tick}}}};
const b=document.getElementById('ch-bar');if(b){const ing=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const p=appData.pagos[k]||{};const pg=contarPagos(p);const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===currentYear&&g.mes===i).reduce((s,g)=>s+g.monto,0);return pg*getGC(currentYear,i)+ex;});const eg=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const fm=(appData.gastosFijos&&appData.gastosFijos[k])?appData.gastosFijos[k]:[];const f=fm.reduce((s,g)=>s+g.monto,0);const v=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===i).reduce((s,g)=>s+g.monto,0);return f+v;});charts.bar=new Chart(b,{type:'bar',data:{labels:labM,datasets:[{label:'Ingresos',data:ing,backgroundColor:'rgba(45,212,191,0.85)',borderRadius:6},{label:'Egresos',data:eg,backgroundColor:'rgba(239,68,68,0.75)',borderRadius:6}]},options:{responsive:true,...co}});}
const dc=document.getElementById('ch-deptos');if(dc){const dd=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const p=appData.pagos[k]||{};return contarPagos(p);});charts.deptos=new Chart(dc,{type:'bar',data:{labels:labM,datasets:[{label:'Depto. Pagados',data:dd,backgroundColor:'rgba(8,145,178,0.85)',borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{grid:{color:grid},ticks:{color:tick,stepSize:1}},x:{grid:{color:grid},ticks:{color:tick}}}}});}
const l=document.getElementById('ch-line');if(l){const ing=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const p=appData.pagos[k]||{};return contarPagos(p)*getGC(currentYear,i);});const eg=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const fm=(appData.gastosFijos&&appData.gastosFijos[k])?appData.gastosFijos[k]:[];const f=fm.reduce((s,g)=>s+g.monto,0);const v=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===i).reduce((s,g)=>s+g.monto,0);return f+v;});charts.line=new Chart(l,{type:'line',data:{labels:labM,datasets:[{label:'Ingresos GC',data:ing,borderColor:'#2DD4BF',backgroundColor:'rgba(45,212,191,0.08)',tension:0.4,fill:true,borderWidth:2},{label:'Egresos',data:eg,borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,0.06)',tension:0.4,fill:true,borderWidth:2}]},options:{responsive:true,...co}});}
const rd=document.getElementById('ch-rep-dona');if(rd){const k=mkKey(currentYear,currentMonth);const p=appData.pagos[k]||{};const pg=contarPagos(p);charts.rdona=new Chart(rd,{type:'doughnut',data:{labels:['Pagados','Pendientes'],datasets:[{data:[pg,TOTAL_DEPTOS-pg],backgroundColor:['#2DD4BF','#F59E0B'],borderWidth:0}]},options:{responsive:false,cutout:'72%',plugins:{legend:{display:false}}}});}
const rb=document.getElementById('ch-rep-bar');if(rb){const k=mkKey(currentYear,currentMonth);const fb=(appData.gastosFijos&&appData.gastosFijos[k])?appData.gastosFijos[k]:[];const v2=(appData.gastosVariables||[]).filter(g=>g.anio===currentYear&&g.mes===currentMonth);charts.rbar=new Chart(rb,{type:'bar',data:{labels:[...fb.map(g=>g.descripcion),...v2.map(g=>g.descripcion)],datasets:[{label:'Gastos Fijos',data:fb.map(g=>g.monto),backgroundColor:'rgba(185,28,28,0.9)',borderRadius:6},{label:'Gastos Variables',data:v2.map(g=>g.monto),backgroundColor:'rgba(248,113,113,0.85)',borderRadius:6}]},options:{responsive:true,plugins:{legend:{display:true,labels:{color:tick,font:{family:'Inter',size:11}}}},scales:{y:{grid:{color:grid},ticks:{color:tick,callback:v=>fmt(v)}},x:{grid:{color:grid},ticks:{color:tick}}}}});}
const gp=document.getElementById('ch-gc-pagos');if(gp){const rg=MESES.map((_,i)=>{const k=mkKey(currentYear,i);const p=appData.pagos[k]||{};return contarPagos(p)*getGC(currentYear,i);});charts.gcpagos=new Chart(gp,{type:'line',data:{labels:labM,datasets:[{label:'Recaudado por Gasto Común',data:rg,borderColor:'#22D3EE',backgroundColor:'rgba(34,211,238,0.12)',tension:0.4,fill:true,borderWidth:2,pointBackgroundColor:'#0891B2',pointRadius:3}]},options:{responsive:true,...co}});}
['ch-tipo-pago','ch-rep-tipo-pago'].forEach(cid=>{const el=document.getElementById(cid);if(!el)return;const r=resumenTipoPago(currentYear,currentMonth);if(r.total.deptos===0)return;charts[cid]=new Chart(el,{type:'doughnut',data:{labels:['Efectivo','Transferencia'],datasets:[{data:[r.efectivo.deptos,r.transferencia.deptos],backgroundColor:[tipoPagoColor('efectivo'),tipoPagoColor('transferencia')],borderWidth:0}]},options:{responsive:false,cutout:'62%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>c.label+': '+c.parsed+' depto(s)'}}}}});});
}catch(e){console.error(e);}}
function renderLoginScreen(){let bu=localStorage.getItem('cbs4_biometric_enabled');if(bu&&!ADMINS.some(a=>a.u===bu)){localStorage.removeItem('cbs4_biometric_enabled');bu=null;}const ba=document.getElementById('biometric-area');const fa=document.getElementById('login-form-area');const st=document.getElementById('login-sub-text');if(bu){ba.style.display='block';fa.style.display='none';st.textContent='Bienvenido, '+bu;}else{ba.style.display='none';fa.style.display='block';st.textContent='Panel de Administración';}}
function showPasswordForm(){document.getElementById('biometric-area').style.display='none';document.getElementById('login-form-area').style.display='block';}