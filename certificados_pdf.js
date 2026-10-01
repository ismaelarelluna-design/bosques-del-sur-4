/* ===========================================================================
   Certificados en PDF — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   Genera dos documentos A4 con texto real (seleccionable) usando pdf-lib
   (pdf-lib.min.js, MIT, incluida en el proyecto: no depende de internet):
     - Certificado de gastos comunes (para venta / tramites)  -> pdfCertVenta(rec)
     - Certificado de morosidad y estado de deuda             -> pdfCertMorosidad(rec)
   Ambos se construyen SOLO desde el registro congelado en cbs4/certificados/<id>,
   asi una reimpresion es identica a lo emitido.

   Las referencias legales corresponden a la Ley N° 21.442 (copropiedad inmobiliaria)
   y estan redactadas como resumen informativo. Este documento NO reemplaza al aviso
   de cobro firmado por el administrador (arts. 31 y 32), unico con merito ejecutivo.
   =========================================================================== */
const PDF_W=595.28,PDF_H=841.89,PDF_M=50;
const PDF_BANCO='Romina Gabriela Figueroa Acevedo · Mercado Pago · Cuenta Vista N° 1088283442';
const PDF_ROLES=['Presidenta','Tesorera','Administrador'];

function pdfListo(){return typeof PDFLib!=='undefined'&&PDFLib&&PDFLib.PDFDocument;}
/* Las fuentes estandar del PDF solo codifican WinAnsi: se sanea cualquier otro caracter. */
function pdfSan(s){
 const ok=new Set([0x2013,0x2014,0x2018,0x2019,0x201C,0x201D,0x2022,0x2026,0x20AC,0x2122]);
 return String(s==null?'':s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').split('').map(ch=>{const c=ch.charCodeAt(0);return (c<=255||ok.has(c))?ch:(c===0x2192?'>':'?');}).join('');
}
function pdfHex(h){const n=parseInt(h.replace('#',''),16);return PDFLib.rgb(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255);}
const PDF_COL={marca:'#155E75',marca2:'#0891B2',texto:'#111827',gris:'#6B7280',claro:'#F3F4F6',borde:'#D1D5DB',verde:'#059669',rojo:'#DC2626'};

/* Banner de marca (el mismo de vouchers y certificados JPG) como imagen JPEG. */
async function pdfBannerBytes(titulo){
 const logo=await cargarLogoVoucher();
 const W=1190,cv=document.createElement('canvas');cv.width=W;cv.height=VOUCHER_BANNER_H;
 const ctx=cv.getContext('2d');dibujarEncabezado(ctx,W,logo,titulo);
 const b64=cv.toDataURL('image/jpeg',0.92).split(',')[1];
 const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;
}

/* ---------- contexto de dibujo con coordenadas "desde arriba" ---------- */
async function pdfNuevo(titulo,folio){
 const {PDFDocument,StandardFonts}=PDFLib;
 const doc=await PDFDocument.create();
 doc.setTitle(pdfSan(titulo+' '+folio));doc.setAuthor('Condominio Bosques del Sur 4');doc.setCreator('Administración CBS4');
 const c={doc,folio,titulo,y:0,page:null,n:0,
  F:await doc.embedFont(StandardFonts.Helvetica),B:await doc.embedFont(StandardFonts.HelveticaBold),I:await doc.embedFont(StandardFonts.HelveticaOblique)};
 c.banner=await doc.embedJpg(await pdfBannerBytes(titulo));
 pdfPagina(c);return c;
}
function pdfPagina(c){
 c.page=c.doc.addPage([PDF_W,PDF_H]);c.n++;
 if(c.n===1){const h=PDF_W*VOUCHER_BANNER_H/1190;c.page.drawImage(c.banner,{x:0,y:PDF_H-h,width:PDF_W,height:h});c.y=h+30;}
 else{c.page.drawRectangle({x:0,y:PDF_H-26,width:PDF_W,height:26,color:pdfHex(PDF_COL.marca)});
  c.page.drawText(pdfSan('Condominio Bosques del Sur 4  ·  '+c.titulo+'  ·  Folio '+c.folio),{x:PDF_M,y:PDF_H-17,size:8.5,font:c.B,color:PDFLib.rgb(1,1,1)});c.y=26+28;}
}
function pdfAsegurar(c,alto){if(c.y+alto>PDF_H-58)pdfPagina(c);}
function pdfTexto(c,s,o){
 o=o||{};const f=o.font||c.F,size=o.size||10.5,t=pdfSan(s);let x=o.x!=null?o.x:PDF_M;
 const w=f.widthOfTextAtSize(t,size);
 if(o.align==='right')x=(o.right!=null?o.right:PDF_W-PDF_M)-w;else if(o.align==='center')x=(PDF_W-w)/2;
 const yy=PDF_H-(o.y!=null?o.y:c.y),col=pdfHex(o.color||PDF_COL.texto);
 if(o.just){/* texto justificado: reparte el espacio sobrante entre las palabras (con tope para no dejar huecos feos) */
  const ws=t.split(' ');
  if(ws.length>1){const tw=ws.reduce((s,w)=>s+f.widthOfTextAtSize(w,size),0),sp=f.widthOfTextAtSize(' ',size),gap=(o.just-tw)/(ws.length-1);
   if(gap>=sp*0.8&&gap<=sp*3.2){let cx=x;ws.forEach(w=>{c.page.drawText(w,{x:cx,y:yy,size,font:f,color:col});cx+=f.widthOfTextAtSize(w,size)+gap;});return;}}
 }
 c.page.drawText(t,{x,y:yy,size,font:f,color:col});
}
function pdfLineas(c,s,o){
 const f=o.font||c.F,size=o.size||10.5,maxW=o.w||(PDF_W-PDF_M*2-(o.x?o.x-PDF_M:0));
 const out=[];String(s).split('\n').forEach(par=>{let l='';pdfSan(par).split(/\s+/).forEach(p=>{const t=l?l+' '+p:p;if(f.widthOfTextAtSize(t,size)>maxW&&l){out.push(l);l=p;}else l=t;});out.push(l);});
 return out;
}
/* Parrafo con salto de pagina automatico. Devuelve la altura usada. */
function pdfParrafo(c,s,o){
 o=o||{};const size=o.size||10.5,lh=o.lh||size*1.45,x=o.x!=null?o.x:PDF_M,f=o.font||c.F;
 const ls=pdfLineas(c,s,{...o,size,font:f,x});const y0=c.y,maxW=o.w||(PDF_W-PDF_M*2-(x-PDF_M));
 ls.forEach((l,i)=>{pdfAsegurar(c,lh);c.y+=lh;pdfTexto(c,l,{x,size,font:f,color:o.color,just:(o.justify!==false&&i<ls.length-1)?maxW:0});});
 c.y+=o.despues!=null?o.despues:6;return c.y-y0;
}
function pdfRect(c,x,yTop,w,h,color,borde){
 const op={x,y:PDF_H-yTop-h,width:w,height:h};if(color)op.color=pdfHex(color);if(borde){op.borderColor=pdfHex(borde);op.borderWidth=0.8;}
 c.page.drawRectangle(op);
}
function pdfLinea(c,x1,x2,y,color,grosor){c.page.drawLine({start:{x:x1,y:PDF_H-y},end:{x:x2,y:PDF_H-y},thickness:grosor||0.8,color:pdfHex(color||PDF_COL.borde)});}
/* Titulo de seccion con regla de color. */
function pdfSeccion(c,t){
 pdfAsegurar(c,100);c.y+=14;pdfTexto(c,t.toUpperCase(),{size:10.5,font:c.B,color:PDF_COL.marca,y:c.y+11});
 pdfRect(c,PDF_M,c.y+17,34,2.2,PDF_COL.marca2);pdfLinea(c,PDF_M+38,PDF_W-PDF_M,c.y+18,PDF_COL.borde,0.6);c.y+=28;
}
/* Pares "etiqueta: valor" dentro de una caja gris. */
function pdfFicha(c,filas){
 const lh=19,h=filas.length*lh+16;pdfAsegurar(c,h+8);
 pdfRect(c,PDF_M,c.y,PDF_W-PDF_M*2,h,PDF_COL.claro);pdfRect(c,PDF_M,c.y,3,h,PDF_COL.marca2);
 filas.forEach((f,i)=>{const yy=c.y+16+i*lh;pdfTexto(c,f[0],{x:PDF_M+16,size:9,color:PDF_COL.gris,y:yy});pdfTexto(c,f[1],{x:PDF_M+150,size:10.5,font:c.B,color:f[2]||PDF_COL.texto,y:yy});});
 c.y+=h+10;
}
/* Tabla simple: cols=[{t,w,align}], filas=[[..]] */
function pdfTabla(c,cols,filas,o){
 o=o||{};const total=PDF_W-PDF_M*2,rh=20;
 const cab=()=>{pdfAsegurar(c,rh*2);pdfRect(c,PDF_M,c.y,total,rh,PDF_COL.marca);let x=PDF_M;
  cols.forEach(k=>{const tx=k.align==='right'?x+k.w-8:x+8;pdfTexto(c,k.t,{x:k.align==='right'?undefined:tx,right:k.align==='right'?tx:undefined,align:k.align==='right'?'right':undefined,size:8.5,font:c.B,color:'#FFFFFF',y:c.y+13.5});x+=k.w;});c.y+=rh;};
 cab();
 filas.forEach((fila,i)=>{
  if(c.y+rh>PDF_H-58){pdfPagina(c);cab();}
  if(i%2===0)pdfRect(c,PDF_M,c.y,total,rh,'#F9FAFB');
  let x=PDF_M;cols.forEach((k,j)=>{const t=fila[j],tx=k.align==='right'?x+k.w-8:x+8;
   pdfTexto(c,t,{x:k.align==='right'?undefined:tx,right:k.align==='right'?tx:undefined,align:k.align==='right'?'right':undefined,size:9.5,color:PDF_COL.texto,y:c.y+13.5});x+=k.w;});
  c.y+=rh;});
 pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,PDF_COL.borde,0.8);c.y+=6;
}
/* Grilla de los ultimos 12 periodos con marcas dibujadas (sin depender de glifos). */
function pdfGrilla12(c,meses){
 if(!meses||!meses.length)return;
 pdfSeccion(c,'Últimos 12 períodos');
 const total=PDF_W-PDF_M*2,cw=total/12,h=44;pdfAsegurar(c,h+10);
 meses.forEach((m,i)=>{const x=PDF_M+i*cw;
  pdfRect(c,x+2,c.y,cw-4,h,m.ok?'#DCF5EC':'#FBE4E4');
  const mm=parseInt(m.k.slice(5,7))-1;pdfTexto(c,MESES[mm].slice(0,3)+' '+m.k.slice(2,4),{x:x+2+(cw-4)/2-14,size:7.5,color:PDF_COL.gris,y:c.y+13});
  const cx=x+cw/2,cy=c.y+30,col=m.ok?PDF_COL.verde:PDF_COL.rojo;
  if(m.ok){pdfLineaXY(c,cx-5,cy,cx-1.5,cy+4,col,1.8);pdfLineaXY(c,cx-1.5,cy+4,cx+5.5,cy-5,col,1.8);}
  else{pdfLineaXY(c,cx-4.5,cy-4.5,cx+4.5,cy+4.5,col,1.8);pdfLineaXY(c,cx+4.5,cy-4.5,cx-4.5,cy+4.5,col,1.8);}});
 c.y+=h+12;
}
function pdfLineaXY(c,x1,y1,x2,y2,color,g){c.page.drawLine({start:{x:x1,y:PDF_H-y1},end:{x:x2,y:PDF_H-y2},thickness:g||1,color:pdfHex(color)});}
function pdfFirmas(c,roles,extra){
 pdfAsegurar(c,90);c.y+=34;const sw=(PDF_W-PDF_M*2)/roles.length;
 roles.forEach((r,i)=>{const cx=PDF_M+sw*i+sw/2;pdfLinea(c,cx-sw/2+16,cx+sw/2-16,c.y,'#9CA3AF',0.8);
  pdfTexto(c,r,{x:cx-c.B.widthOfTextAtSize(r,9.5)/2,size:9.5,font:c.B,color:'#374151',y:c.y+14});
  pdfTexto(c,'Comité de Administración',{x:cx-c.F.widthOfTextAtSize('Comité de Administración',8)/2,size:8,color:PDF_COL.gris,y:c.y+26});});
 c.y+=34;
}
/* Pie de pagina en todas las hojas + barra de marca. */
function pdfCerrar(c,nota){
 const pages=c.doc.getPages();
 pages.forEach((p,i)=>{
  if(c.anulado)p.drawText('ANULADO',{x:95,y:260,size:120,font:c.B,color:PDFLib.rgb(0.86,0.15,0.15),opacity:0.16,rotate:PDFLib.degrees(35)});
  p.drawRectangle({x:0,y:0,width:PDF_W,height:7,color:pdfHex(PDF_COL.marca)});
  p.drawRectangle({x:PDF_W*0.55,y:0,width:PDF_W*0.45,height:7,color:pdfHex(PDF_COL.marca2)});
  const t=pdfSan((nota?nota+'  ·  ':'')+'Folio '+c.folio+'  ·  Página '+(i+1)+' de '+pages.length);
  p.drawText(t,{x:(PDF_W-c.F.widthOfTextAtSize(t,7.5))/2,y:20,size:7.5,font:c.F,color:pdfHex(PDF_COL.gris)});
 });
}
async function pdfBytes(c){return await c.doc.save();}
function pdfDescargar(bytes,nombre){descargarBlob(bytes,'application/pdf',nombre);}
function pdfUrl(bytes){return URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));}

/* ===========================================================================
   Documentos
   =========================================================================== */
function pdfSumarDias(iso,n){const p=String(iso).split('-').map(Number);const d=new Date(p[0],p[1]-1,p[2]+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function pdfPeriodo(rec){return rec.desde&&rec.corte?(formatPeriodo(rec.desde)+' a '+formatPeriodo(rec.corte)):'los períodos registrados';}
/* Cabecera comun: folio a la izquierda, fecha a la derecha, regla. */
function pdfCabeceraFolio(c,rec){
 pdfTexto(c,'Folio N° '+rec.folio,{size:12,font:c.B,color:PDF_COL.marca});
 pdfTexto(c,'Emitido el '+certFechaLarga(rec.fecha),{size:9.5,color:PDF_COL.gris,align:'right'});
 c.y+=10;pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,PDF_COL.borde,0.8);c.y+=8;
}
/* Insignia de estado centrada, con marca dibujada. */
function pdfInsignia(c,texto,color,ok){
 pdfAsegurar(c,60);const w=210,h=34,x=(PDF_W-w)/2;
 pdfRect(c,x,c.y,w,h,color);
 const cx=x+44,cy=c.y+h/2;
 if(ok){pdfLineaXY(c,cx-6,cy,cx-2,cy+5,'#FFFFFF',2.4);pdfLineaXY(c,cx-2,cy+5,cx+7,cy-6,'#FFFFFF',2.4);}
 else{pdfLineaXY(c,cx-5,cy-5,cx+5,cy+5,'#FFFFFF',2.4);pdfLineaXY(c,cx+5,cy-5,cx-5,cy+5,'#FFFFFF',2.4);}
 pdfTexto(c,texto,{x:x+62,size:15,font:c.B,color:'#FFFFFF',y:c.y+h/2+5.5});
 c.y+=h+18;
}
/* Cláusula numerada: titulo en negrita + texto con sangria. */
function pdfClausula(c,n,titulo,texto){
 pdfAsegurar(c,60);c.y+=11;pdfTexto(c,n+'  '+titulo,{size:10,font:c.B,color:PDF_COL.marca});c.y+=2;
 pdfParrafo(c,texto,{size:9.6,lh:14.2,x:PDF_M+14,w:PDF_W-PDF_M*2-14,despues:9,color:'#1F2937'});
}
function pdfNotaCaja(c,titulo,texto,color){
 const w=PDF_W-PDF_M*2-28,ls=pdfLineas(c,texto,{size:9,w});const h=ls.length*12.6+30;
 pdfAsegurar(c,h+8);pdfRect(c,PDF_M,c.y,PDF_W-PDF_M*2,h,'#FFF7ED');pdfRect(c,PDF_M,c.y,3,h,color||'#F59E0B');
 pdfTexto(c,titulo,{x:PDF_M+14,size:9,font:c.B,color:'#92400E',y:c.y+16});
 ls.forEach((l,i)=>pdfTexto(c,l,{x:PDF_M+14,size:9,color:'#78350F',y:c.y+30+i*12.6,just:i<ls.length-1?w:0}));
 c.y+=h+10;
}

/* ---------- Certificado de gastos comunes (venta / trámites) ---------- */
async function pdfCertVenta(rec){
 if(!pdfListo())throw new Error('Librería PDF no disponible');
 const c=await pdfNuevo('Certificado de Gastos Comunes',rec.folio);c.anulado=!!rec.anulado;
 const aldia=rec.situacion==='aldia';
 pdfCabeceraFolio(c,rec);c.y+=8;
 const quien=rec.representante?', a nombre de '+rec.representante+',':',';
 pdfParrafo(c,'El Comité de Administración del Condominio Bosques del Sur 4 certifica que, de acuerdo con los registros de gastos comunes vigentes a la fecha de emisión, la unidad N° '+rec.depNumero+quien+' '+(aldia?'se encuentra AL DÍA en el pago de los gastos comunes y multas exigibles':'registra DEUDA por gastos comunes y/o multas exigibles')+', considerando el período de '+pdfPeriodo(rec)+'.',{size:10.5,lh:15.5,despues:12});
 pdfInsignia(c,aldia?'AL DÍA':'CON DEUDA',aldia?PDF_COL.verde:PDF_COL.rojo,aldia);
 pdfFicha(c,[['Unidad','Depto '+rec.depNumero],['Representante',rec.representante||'—'],['Período considerado',pdfPeriodo(rec)]]);
 if(!aldia){
  pdfSeccion(c,'Detalle de la deuda');
  pdfTabla(c,[{t:'Concepto',w:PDF_W-PDF_M*2-130},{t:'Monto',w:130,align:'right'}],(rec.detalle||[]).map(r=>[r.t,fmt(r.v)]));
  pdfAsegurar(c,30);pdfTexto(c,'TOTAL ADEUDADO',{x:PDF_M+8,size:11.5,font:c.B,color:PDF_COL.rojo,y:c.y+14});
  pdfTexto(c,fmt(rec.total),{size:11.5,font:c.B,color:PDF_COL.rojo,align:'right',right:PDF_W-PDF_M-8,y:c.y+14});c.y+=26;
 }else{
  c.y+=2;pdfParrafo(c,'La unidad no registra gastos comunes ni multas pendientes de pago en el período considerado.',{size:10,color:'#374151'});
 }
 if(rec.obs)pdfParrafo(c,'Observación: '+rec.obs,{size:9.5,font:c.I,color:'#374151',despues:8});
 pdfGrilla12(c,rec.meses12);
 pdfSeccion(c,'Información para trámites de compraventa');
 pdfParrafo(c,'Según la Ley N° 21.442 (art. 6), la obligación de pagar los gastos comunes acompaña a la unidad y se transmite a quien la adquiere, incluidas las deudas anteriores; por eso el vendedor debe acreditar su pago al enajenar y el estado de deuda suele declararse en la escritura pública de compraventa. La administración puede emitir certificados de estado de deudas (art. 20 N° 4). Este documento es un resumen informativo de la situación registrada a la fecha de emisión, con vigencia referencial de 30 días. Si el trámite exige un certificado firmado por el administrador, solicítelo al Comité.',{size:9.3,x:PDF_M,lh:13,color:'#1F2937'});
 pdfFirmas(c,PDF_ROLES);
 c.y+=6;pdfParrafo(c,'Documento emitido por el Comité de Administración del Condominio Bosques del Sur 4 con los registros disponibles a la fecha de emisión. Su autenticidad puede verificarse con el Comité indicando el folio '+rec.folio+'.',{size:8,color:PDF_COL.gris,despues:0});
 pdfCerrar(c,'Certificado de Gastos Comunes');
 return await pdfBytes(c);
}

/* ---------- Certificado de morosidad ---------- */
async function pdfCertMorosidad(rec){
 if(!pdfListo())throw new Error('Librería PDF no disponible');
 const c=await pdfNuevo('Certificado de Morosidad',rec.folio);c.anulado=!!rec.anulado;
 const det=rec.detalle||[];
 const gc=det.filter(r=>/^Gasto/i.test(r.t)),mu=det.filter(r=>!/^Gasto/i.test(r.t));
 const sGC=gc.reduce((s,r)=>s+(Number(r.v)||0),0),sMu=mu.reduce((s,r)=>s+(Number(r.v)||0),0);
 const plazo=parseInt(rec.plazoDias)||10,limite=pdfSumarDias(rec.fecha,plazo);
 pdfCabeceraFolio(c,rec);c.y+=8;
 const quien=rec.representante?', a nombre de '+rec.representante+',':',';
 pdfParrafo(c,'El Comité de Administración del Condominio Bosques del Sur 4 informa que, según los registros de gastos comunes vigentes al '+certFechaLarga(rec.fecha)+', la unidad N° '+rec.depNumero+quien+' mantiene obligaciones impagas por concepto de gastos comunes y multas, cuyo detalle se indica a continuación. Los montos corresponden al capital adeudado y no incluyen intereses ni reajustes.',{size:10.5,lh:15.5,despues:10});
 /* resumen destacado */
 pdfAsegurar(c,150);const h=134;
 pdfRect(c,PDF_M,c.y,PDF_W-PDF_M*2,h,'#FEF2F2');pdfRect(c,PDF_M,c.y,3,h,PDF_COL.rojo);
 const fila=(k,v,i,col)=>{pdfTexto(c,k,{x:PDF_M+16,size:9,color:PDF_COL.gris,y:c.y+20+i*18});pdfTexto(c,v,{x:PDF_M+175,size:10.5,font:c.B,color:col||PDF_COL.texto,y:c.y+20+i*18});};
 fila('Unidad','Depto '+rec.depNumero,0);fila('Representante',rec.representante||'—',1);
 fila('Gastos comunes impagos',gc.length+' período'+(gc.length===1?'':'s')+' · '+fmt(sGC),2);
 fila('Multas pendientes',mu.length+' · '+fmt(sMu),3);
 fila('Período considerado',pdfPeriodo(rec),4);
 pdfLinea(c,PDF_M+16,PDF_W-PDF_M-16,c.y+h-26,'#FCA5A5',0.8);
 pdfTexto(c,'TOTAL ADEUDADO',{x:PDF_M+16,size:12,font:c.B,color:PDF_COL.rojo,y:c.y+h-9});
 pdfTexto(c,fmt(rec.total),{size:14,font:c.B,color:PDF_COL.rojo,align:'right',right:PDF_W-PDF_M-16,y:c.y+h-8});
 c.y+=h+10;
 if(rec.obs)pdfParrafo(c,'Observación: '+rec.obs,{size:9.5,font:c.I,color:'#374151',despues:6});
 /* 1. detalle */
 pdfSeccion(c,'1. Detalle de la deuda');
 pdfTabla(c,[{t:'N°',w:36},{t:'Concepto',w:PDF_W-PDF_M*2-36-120},{t:'Monto',w:120,align:'right'}],det.map((r,i)=>[String(i+1),r.t,fmt(r.v)]));
 pdfAsegurar(c,70);
 pdfTexto(c,'Subtotal gastos comunes',{x:PDF_M+44,size:9.5,color:'#374151',y:c.y+10});pdfTexto(c,fmt(sGC),{size:9.5,align:'right',right:PDF_W-PDF_M-8,y:c.y+10});
 pdfTexto(c,'Subtotal multas',{x:PDF_M+44,size:9.5,color:'#374151',y:c.y+26});pdfTexto(c,fmt(sMu),{size:9.5,align:'right',right:PDF_W-PDF_M-8,y:c.y+26});
 pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y+34,PDF_COL.borde,0.8);
 pdfTexto(c,'TOTAL ADEUDADO',{x:PDF_M+44,size:11,font:c.B,color:PDF_COL.rojo,y:c.y+50});pdfTexto(c,fmt(rec.total),{size:11,font:c.B,color:PDF_COL.rojo,align:'right',right:PDF_W-PDF_M-8,y:c.y+50});c.y+=62;
 pdfGrilla12(c,rec.meses12);
 /* 2. fundamentos legales */
 pdfPagina(c);/* la parte legal parte siempre en hoja nueva */
 pdfSeccion(c,'2. Fundamentos legales y efectos del atraso');
 pdfParrafo(c,'Resumen informativo de la Ley N° 21.442 sobre Copropiedad Inmobiliaria. Las normas específicas del condominio constan en su reglamento de copropiedad, que debe consultarse.',{size:9,font:c.I,color:PDF_COL.gris,despues:8});
 pdfClausula(c,'2.1','Obligación de pago (art. 6)','Los copropietarios deben contribuir al pago de los gastos comunes en proporción al derecho que les corresponde sobre los bienes comunes. La obligación recae sobre la unidad y se mantiene aunque cambie su propietario, incluidas las deudas anteriores, y goza del privilegio que la ley le reconoce para su cobro.');
 pdfClausula(c,'2.2','Plazo de pago e intereses (art. 7)','Los gastos comunes deben pagarse dentro del plazo que fija la ley (por regla general, los primeros 10 días del mes) o el reglamento de copropiedad. La mora autoriza el cobro de intereses, con el tope máximo que establece la normativa (un 50% sobre el interés corriente bancario). El cobro de intereses requiere estar contemplado en el reglamento y será definido por la comunidad; este certificado no los incluye.');
 pdfClausula(c,'2.3','Cobro y mérito ejecutivo (arts. 31 y 32)','El administrador puede emitir un aviso de cobro de los gastos comunes adeudados que, firmado por él, tiene mérito ejecutivo: permite demandar el pago por la vía judicial ejecutiva, sin necesidad de juicio previo de conocimiento. La demanda se notifica con orden de embargo y puede incluir el capital, los intereses y los costos asociados, cuando corresponda.');
 pdfClausula(c,'2.4','Suspensión de servicios (art. 36)','Si la deuda alcanza tres o más cuotas, continuas o discontinuas, el administrador, con requerimiento escrito y autorización del comité de administración, puede solicitar la suspensión o corte del suministro eléctrico o de telecomunicaciones de la unidad morosa, uno a la vez. La ley establece excepciones, entre ellas casos de catástrofe y personas electrodependientes.');
 pdfClausula(c,'2.5','Extensión de la deuda (arts. 34 y 37)','La responsabilidad del copropietario moroso puede alcanzar los intereses, multas y aportes al fondo de reserva impagos, y también los daños que se ocasionen por el incumplimiento de las obligaciones, cuando proceda.');
 pdfClausula(c,'2.6','Convenio de pago','El comité puede aprobar un convenio de pago por escrito, con cuotas y plazos acordados, cuyo cumplimiento puede suspender las acciones de cobro mientras se mantenga al día. La regularización de la deuda es la condición para volver a ejercer los derechos de copropietario hábil; las restricciones aplicables a la participación en asambleas dependen de la ley y del reglamento de copropiedad.');
 pdfPagina(c);/* hoja 3: acciones, regularizacion y constancia */
 pdfSeccion(c,'3. Acciones que puede evaluar el Comité de Administración');
 [['Gestión amistosa','recordatorio escrito y coordinación de un convenio de pago.'],['Aviso de cobro','emisión del aviso firmado por el administrador, con mérito ejecutivo (arts. 31 y 32).'],['Cobro judicial','demanda ejecutiva por el capital y, cuando corresponda, intereses y costas.'],['Suspensión de servicios','con tres o más cuotas adeudadas, según el art. 36 y sus excepciones.'],['Multas y otros cobros','aplicación de las sanciones que contemple el reglamento de copropiedad.']].forEach(a=>{
  pdfAsegurar(c,22);pdfRect(c,PDF_M+4,c.y+5,4,4,PDF_COL.marca2);pdfTexto(c,a[0]+':',{x:PDF_M+16,size:9.6,font:c.B,color:'#1F2937',y:c.y+10.5});
  const w0=c.B.widthOfTextAtSize(pdfSan(a[0]+': '),9.6);pdfTexto(c,a[1],{x:PDF_M+16+w0,size:9.6,color:'#1F2937',y:c.y+10.5});c.y+=16;});
 c.y+=4;
 /* 3. regularizacion */
 pdfSeccion(c,'4. Regularización de la deuda');
 pdfParrafo(c,'Se solicita regularizar el total adeudado dentro de '+plazo+' días corridos desde la fecha de emisión, es decir, a más tardar el '+certFechaLarga(limite)+'. Transcurrido el plazo sin pago ni convenio, el Comité podrá evaluar las acciones indicadas en la sección 3.',{size:10,lh:14.5,despues:8});
 pdfFicha(c,[['Datos de transferencia',PDF_BANCO.split(' · ')[0]],['Banco / cuenta',PDF_BANCO.split(' · ').slice(1).join(' · ')],['Referencia','Depto '+rec.depNumero+' · '+rec.folio]]);
 pdfParrafo(c,'Para acordar un convenio de pago o aclarar diferencias en este detalle, contacte al Comité de Administración dentro del plazo indicado.',{size:9.6,color:'#374151'});
 /* 4. constancia */
 pdfSeccion(c,'5. Constancia y alcance de este documento');
 pdfNotaCaja(c,'DOCUMENTO INFORMATIVO','Este certificado informa el estado de la deuda según los registros del Comité a la fecha de emisión. No reemplaza al aviso de cobro firmado por el administrador, que es el documento con mérito ejecutivo (arts. 31 y 32 de la Ley N° 21.442). No incluye intereses ni reajustes. El resumen legal es referencial y no constituye asesoría jurídica; las normas específicas del condominio constan en su reglamento de copropiedad. Se recomienda consultar con un abogado antes de iniciar acciones de cobro.');
 pdfFirmas(c,PDF_ROLES);
 /* recibi conforme */
 pdfAsegurar(c,100);c.y+=26;pdfRect(c,PDF_M,c.y,PDF_W-PDF_M*2,70,null,PDF_COL.borde);
 pdfTexto(c,'NOTIFICADO / RECIBÍ CONFORME',{x:PDF_M+12,size:8.5,font:c.B,color:PDF_COL.marca,y:c.y+15});
 [['Nombre',PDF_M+12,150],['Fecha',PDF_M+180,90],['Firma',PDF_M+290,PDF_W-PDF_M-12-(PDF_M+290)]].forEach(f=>{pdfLinea(c,f[1],f[1]+f[2],c.y+54,'#9CA3AF',0.8);pdfTexto(c,f[0],{x:f[1],size:8,color:PDF_COL.gris,y:c.y+64});});
 c.y+=70;
 pdfCerrar(c,'Certificado de Morosidad');
 return await pdfBytes(c);
}
