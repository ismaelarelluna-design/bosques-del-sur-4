/* ===========================================================================
   Informe comparativo — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   PDF con dos apartados (mismo motor, logo y estilo que la Rendición de cuentas):
     1. Comparación de los últimos 4 años: año completo y mismo período (enero al
        último mes exigible), con gráficos de barras y líneas dibujados como vectores.
     2. Detalle de los últimos 4 meses.
   Reglas:
   - Usa las MISMAS fórmulas del resto de la app (rendComponentes, totalExigibles,
     rendMorosidad), por lo que las cifras coinciden con Panel y Transparencia.
   - Un año SIN pagos registrados se marca «sin datos»: no se grafica como cero, porque
     parecería que el condominio no recaudó nada cuando en realidad falta cargar el dato.
   - Los meses sin cobro / eximidos no cuentan como exigibles (cobranza justa).
   - No guarda nada en Firebase; no incluye datos personales.
   =========================================================================== */
const CMP_COL_ANIO=['#94A3B8','#F59E0B','#0891B2','#155E75'];   /* del más antiguo al más reciente */

/* ---------- datos ---------- */
function cmpHayPagos(y){return Object.keys(appData.pagos||{}).some(k=>k.startsWith(y+'-')&&Object.values(appData.pagos[k]||{}).some(v=>estaPagado(v)));}
function cmpMetricas(y,mMax){
 const meses=[];let ing=0,egr=0,gc=0,ex=0,mp=0,pg=0,exig=0,gastos=[],cobro=0;
 for(let m=0;m<=mMax;m++){
  const c=rendComponentes(y,m),k=mkKey(y,m),te=totalExigibles(k);
  meses.push(c);ing+=c.ing;egr+=c.egr;gc+=c.ingGC;ex+=c.ex;mp+=c.mp;gastos=gastos.concat(c.gastos);
  if(te>0){cobro++;exig+=te;pg+=c.pg;}
 }
 const hay=cmpHayPagos(y);
 return {y,meses,ing,egr,gc,ex,mp,pg,exig,gastos,cats:rendCategorias(gastos),saldo:ing-egr,hay,
  sdIng:!hay&&ing===0,sdTodo:!hay&&ing===0&&egr===0,cobranza:(hay&&exig)?pg/exig:null,mesesCobro:cobro};
}
function rendDatosComparativo(ancla){
 /* ancla {a,m}: mes que se está viendo (Transparencia). Sin ancla: último mes exigible. */
 const lim=ancla?{anio:ancla.a,mes:ancla.m}:ultimoPeriodoExigible(),Y=lim.anio,M=lim.mes,anios=[Y-3,Y-2,Y-1,Y];
 const completo=anios.map(y=>cmpMetricas(y,11)),periodo=anios.map(y=>cmpMetricas(y,M));
 const mensual=anios.map(y=>cmpMetricas(y,11).meses.map(c=>c.ing)); /* ingresos de cada mes */
 const ult=[];for(let i=3;i>=0;i--){const d=new Date(lim.anio,lim.mes-i,1);ult.push(rendComponentes(d.getFullYear(),d.getMonth()));}
 const ult4=ult.map(c=>{const te=totalExigibles(c.k);return {...c,exig:te,cob:te?c.pg/te:null,cats:rendCategorias(c.gastos)};});
 /* mapa de calor: cobranza de cada mes de cada año (null = sin datos / sin cobro / futuro) */
 const heat=anios.map((y,i)=>Array.from({length:12},(_,m)=>{if(!completo[i].hay||(y===Y&&m>M))return null;const te=totalExigibles(mkKey(y,m));return te>0?completo[i].meses[m].pg/te:null;}));
 /* evolución de la caja: saldo acumulado mes a mes (mismo cálculo del Balance General del Panel) */
 let acc=0;const saldoAll=[];for(let y=2018;y<=Y;y++)for(let m=0;m<12;m++){if(y===Y&&m>M)break;acc+=balanceMes(y,m);saldoAll.push({a:y,m,v:acc});}
 const saldo=saldoAll.slice(-24);while(saldo.length>1&&saldo[0].v===0)saldo.shift();
 return {tipo:'comparativo',Y,M,anios,completo,periodo,mensual,ult4,heat,saldo,saldoActual:acc,sinMor:modoDatos==='publico',mor:modoDatos==='publico'?[]:rendMorosidad(lim.anio,lim.mes),transp:!!ancla,
  folio:(ancla?'TRN-':'CMP-')+Y+'-'+String(M+1).padStart(2,'0')};
}

/* ---------- utilidades de dibujo ---------- */
function cmpK(n){const a=Math.abs(n),s=n<0?'-':'';if(a>=1e6)return s+'$'+(a/1e6).toFixed(a>=1e7?0:1).replace('.',',')+'M';if(a>=1e3)return s+'$'+Math.round(a/1e3)+'k';return s+'$'+Math.round(a);}
function cmpPct(n){return n==null?'s/d':Math.round(n*100)+'%';}
function cmpNice(v){if(v<=0)return 4;const q=v/4,p=Math.pow(10,Math.floor(Math.log10(q))),n=q/p;return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p*4;} /* máximo = 4 intervalos «redondos» */
/* Escala con paso «redondo» y el cero sobre una línea de la rejilla. Devuelve {mn,mx,n}. */
function cmpEscalaY(lo,hi){
 lo=Math.min(0,lo);hi=Math.max(0,hi);if(hi===lo)hi=1;
 const q=(hi-lo)/4,p=Math.pow(10,Math.floor(Math.log10(q))),k=q/p,paso=(k<=1?1:k<=2?2:k<=2.5?2.5:k<=5?5:10)*p;
 const mn=Math.floor(lo/paso+1e-9)*paso,mx=Math.ceil(hi/paso-1e-9)*paso;
 return {mn,mx,n:Math.max(1,Math.round((mx-mn)/paso))};
}
function cmpSub(c,t,h){pdfAsegurar(c,h||95);pdfTexto(c,t,{size:10,font:c.B,color:'#374151',y:c.y+10});c.y+=18;}
function cmpLeyenda(c,series){
 let x=PDF_M;series.forEach(s=>{pdfRect(c,x,c.y,9,9,s.color);const w=c.F.widthOfTextAtSize(pdfSan(s.n),8.5);pdfTexto(c,s.n,{x:x+13,size:8.5,color:'#374151',y:c.y+8});x+=13+w+16;});c.y+=20;
}
/* Eje Y con rejilla. Devuelve funciones de escala. */
function cmpEjes(c,min,max,alto,fmtY,x0,x1,n){
 n=n||4;const top=c.y,base=top+alto,y=v=>base-(v-min)/(max-min)*alto;
 for(let i=0;i<=n;i++){
  const v=min+(max-min)*i/n,yy=y(v);
  pdfLinea(c,x0,x1,yy,i===0?'#9CA3AF':'#E5E7EB',i===0?0.8:0.5);
  const t=fmtY(v);pdfTexto(c,t,{x:x0-4-c.F.widthOfTextAtSize(pdfSan(t),7),size:7,color:PDF_COL.gris,y:yy+2.5});
 }
 if(min<0)pdfLinea(c,x0,x1,y(0),'#6B7280',1);
 return {y,base,top};
}
/* Barras agrupadas. o:{grupos:[{l,vals:[],sd:[]}],series:[{n,color}],alto,fmt,min,max}  (vals null => sin datos) */
function cmpBarras(c,o){
 const H=o.alto||112,fmtV=o.fmt||cmpK;pdfAsegurar(c,H+62);
 const all=[].concat(...o.grupos.map(g=>g.vals)).filter(v=>v!=null);
 let mx,mn,nn=4;if(o.max!=null){mx=o.max;mn=o.min!=null?o.min:0;}else if(all.some(v=>v<0)){const es=cmpEscalaY(Math.min(...all),Math.max(...all));mx=es.mx;mn=es.mn;nn=es.n;}else{mx=cmpNice(Math.max(1,...all));mn=0;}
 const x0=PDF_M+40,x1=PDF_W-PDF_M,W=x1-x0,e=cmpEjes(c,mn,mx,H,fmtV,x0,x1,nn);
 const gw=W/o.grupos.length,ns=o.series.length,bw=Math.min(34,(gw-14)/ns);
 o.grupos.forEach((g,i)=>{
  const cx=x0+gw*i+gw/2,ini=cx-bw*ns/2;
  g.vals.forEach((v,j)=>{
   const x=ini+bw*j;
   if(v==null){const t='sin datos';pdfTexto(c,t,{x:x+bw/2-c.F.widthOfTextAtSize(t,6.5)/2,size:6.5,color:'#9CA3AF',y:e.y(0)-4});return;}
   const y0=e.y(0),y1=e.y(v),top=Math.min(y0,y1),h=Math.max(1,Math.abs(y0-y1));
   pdfRect(c,x+1,top,bw-2,h,o.series[j].color);
   const t=fmtV(v);pdfTexto(c,t,{x:x+bw/2-c.F.widthOfTextAtSize(pdfSan(t),6.5)/2,size:6.5,color:'#374151',y:(v>=0?top-3:top+h+8)});
  });
  pdfTexto(c,g.l,{x:cx-c.F.widthOfTextAtSize(pdfSan(g.l),8.5)/2,size:8.5,font:c.B,color:'#374151',y:e.base+(mn<0?H*0+14:13)});
 });
 c.y=e.base+22;if(o.series.length>1||o.leyenda)cmpLeyenda(c,o.series);else c.y+=4;
}
/* Líneas múltiples. o:{x:[etiquetas],series:[{n,color,vals:[n|null]}],alto} */
function cmpLineas(c,o){
 const H=o.alto||135;pdfAsegurar(c,H+66);
 const all=[].concat(...o.series.map(s=>s.vals)).filter(v=>v!=null),hi=Math.max(0,...all),lo=Math.min(0,...all);
 const es=lo<0?cmpEscalaY(lo,hi):{mn:0,mx:cmpNice(Math.max(1,hi)),n:4},mx=es.mx,mn=es.mn;
 const x0=PDF_M+40,x1=PDF_W-PDF_M-6,W=x1-x0,e=cmpEjes(c,mn,mx,H,cmpK,x0,x1,es.n),n=o.x.length,px=i=>x0+W*(i+0.5)/n,paso=o.paso||1;
 o.x.forEach((t,i)=>{if(i%paso)return;pdfTexto(c,t,{x:px(i)-c.F.widthOfTextAtSize(pdfSan(t),7.5)/2,size:7.5,color:PDF_COL.gris,y:e.base+12});});
 o.series.forEach(s=>{
  let prev=null;
  s.vals.forEach((v,i)=>{
   if(v==null){prev=null;return;}
   const x=px(i),y=e.y(v);
   if(prev)pdfLineaXY(c,prev[0],prev[1],x,y,s.color,s.grueso||1.8);
   prev=[x,y];
  });
  s.vals.forEach((v,i)=>{if(v!=null)c.page.drawCircle({x:px(i),y:PDF_H-e.y(v),size:o.punto||2.1,color:pdfHex(s.color)});});
 });
 c.y=e.base+(o.paso?20:22);if(o.series.length>1)cmpLeyenda(c,o.series);else c.y+=4;
}
function cmpVar(cur,prev,sdCur,sdPrev){if(sdCur||sdPrev)return '—';return rendVar(cur,prev);}
/* variación porcentual para las tarjetas: {sub,dir,subColor}. invertir = true cuando subir es malo (egresos). */
function cmpDelta(cur,prev,sinDato,invertir,etq){
 if(sinDato||!prev)return {sub:'sin comparación con '+etq,dir:null};
 const p=Math.round((cur-prev)/Math.abs(prev)*100),sube=p>0,igual=p===0,bueno=igual?true:(sube!==!!invertir);
 return {sub:(igual?'igual':Math.abs(p)+'%')+' vs '+etq,dir:igual?null:(sube?1:-1),subColor:bueno?PDF_COL.verde:PDF_COL.rojo};
}
function cmpTriangulo(c,x,yTop,arriba,color){c.page.drawSvgPath(arriba?'M 0 6 L 3 0 L 6 6 Z':'M 0 0 L 6 0 L 3 6 Z',{x,y:PDF_H-yTop,color:pdfHex(color)});}
function cmpEscala(v){
 const st=[[0,[252,165,165]],[0.6,[253,230,138]],[1,[110,231,183]]];v=Math.max(0,Math.min(1,v));
 let i=v<=st[1][0]?0:1;const a=st[i],b=st[i+1],t=(v-a[0])/(b[0]-a[0]);
 return '#'+[0,1,2].map(k=>Math.round(a[1][k]+(b[1][k]-a[1][k])*t).toString(16).padStart(2,'0')).join('');
}
/* Tarjetas de indicadores (3 por fila). items:[{t,v,color,sub,dir,subColor,acento}] */
function cmpKpis(c,items){
 const W=PDF_W-PDF_M*2,g=10,cw=(W-g*2)/3,h=62,filas=Math.ceil(items.length/3);pdfAsegurar(c,filas*(h+g));
 items.forEach((k,i)=>{
  const x=PDF_M+(i%3)*(cw+g),y=c.y+Math.floor(i/3)*(h+g);
  pdfRect(c,x,y,cw,h,'#F1F5F7');pdfRect(c,x,y,3,h,k.acento||PDF_COL.marca2);
  pdfTexto(c,k.t,{x:x+12,size:8,color:PDF_COL.gris,y:y+17});
  pdfTexto(c,k.v,{x:x+12,size:15,font:c.B,color:k.color||PDF_COL.texto,y:y+37});
  if(k.sub){let tx=x+12;if(k.dir){cmpTriangulo(c,x+12,y+46,k.dir>0,k.subColor);tx=x+22;}pdfTexto(c,k.sub,{x:tx,size:8,color:k.subColor||PDF_COL.gris,y:y+53});}
 });
 c.y+=filas*(h+g);
}
/* Tarjeta con título, bajada, gráfico y «Lectura» automática. alto = alto estimado del gráfico. */
function cmpTarjeta(c,titulo,sub,alto,dibujar,lectura){
 pdfAsegurar(c,alto+(lectura?44:12)+34);
 const y0=c.y;c.y+=8;
 pdfTexto(c,titulo,{x:PDF_M+4,size:10.5,font:c.B,color:PDF_COL.marca,y:c.y+11});c.y+=16;
 if(sub){pdfTexto(c,sub,{x:PDF_M+4,size:8,color:PDF_COL.gris,y:c.y+9});c.y+=16;}else c.y+=4;
 dibujar();
 if(lectura){c.y+=2;pdfParrafo(c,'Lectura: '+lectura,{size:8.5,lh:12.5,despues:6,color:'#4B5563',justify:false});}
 pdfRect(c,PDF_M-8,y0,PDF_W-PDF_M*2+16,c.y-y0,null,'#D5DCE2');c.y+=14;
}
/* Mapa de calor: filas = años, columnas = meses. */
function cmpHeat(c,o){
 const x0=PDF_M+36,x1=PDF_W-PDF_M-2,cw=(x1-x0)/12,rh=24;pdfAsegurar(c,(o.filas.length+1)*rh+46);
 o.x.forEach((t,i)=>pdfTexto(c,t,{x:x0+cw*i+cw/2-c.F.widthOfTextAtSize(pdfSan(t),7.5)/2,size:7.5,color:PDF_COL.gris,y:c.y+9}));c.y+=13;
 o.filas.forEach(f=>{
  pdfTexto(c,f.l,{x:PDF_M,size:9,font:c.B,color:'#374151',y:c.y+rh/2+3});
  f.vals.forEach((v,i)=>{
   const x=x0+cw*i;
   if(v==null){pdfRect(c,x+1,c.y+1,cw-2,rh-2,'#F3F4F6');const t='s/d';pdfTexto(c,t,{x:x+cw/2-c.F.widthOfTextAtSize(t,6.5)/2,size:6.5,color:'#9CA3AF',y:c.y+rh/2+2.5});}
   else{pdfRect(c,x+1,c.y+1,cw-2,rh-2,cmpEscala(v));const t=Math.round(v*100)+'%';pdfTexto(c,t,{x:x+cw/2-c.B.widthOfTextAtSize(t,7)/2,size:7,font:c.B,color:'#1F2937',y:c.y+rh/2+2.5});}
  });
  c.y+=rh;
 });
 c.y+=8;const sw=22;pdfTexto(c,'Menor cobranza',{x:PDF_M,size:7.5,color:PDF_COL.gris,y:c.y+8});
 const lx=PDF_M+70;[0,0.25,0.5,0.75,1].forEach((v,i)=>pdfRect(c,lx+i*sw,c.y,sw,10,cmpEscala(v)));
 pdfTexto(c,'Mayor cobranza',{x:lx+5*sw+6,size:7.5,color:PDF_COL.gris,y:c.y+8});
 pdfRect(c,lx+5*sw+90,c.y,10,10,'#F3F4F6');pdfTexto(c,'s/d = sin datos o sin cobro',{x:lx+5*sw+104,size:7.5,color:PDF_COL.gris,y:c.y+8});
 c.y+=20;
}
/* Barras horizontales (categorías). items:[{l,v}] ordenados. */
function cmpBarrasH(c,items,total){
 const W=PDF_W-PDF_M*2,x0=PDF_M+4,lw=118,bx=x0+lw,bw=W-lw-96,rh=20;pdfAsegurar(c,items.length*rh+10);
 const mx=Math.max(1,...items.map(i=>i.v));
 items.forEach((it,i)=>{
  const y=c.y+i*rh,w=Math.max(1,it.v/mx*bw);
  pdfTexto(c,rendTrunc(c,it.l,lw-8,9),{x:x0,size:9,color:'#374151',y:y+13});
  pdfRect(c,bx,y+3,w,12,i===0?PDF_COL.marca:PDF_COL.marca2);
  pdfTexto(c,fmt(it.v)+'  ·  '+(total?Math.round(it.v/total*100):0)+'%',{x:bx+w+6,size:8.5,color:'#374151',y:y+12.5});
 });
 c.y+=items.length*rh+6;
}
function cmpTopCats(catsObj,n){
 const ks=Object.keys(catsObj).filter(k=>catsObj[k]>0).sort((a,b)=>catsObj[b]-catsObj[a]),top=ks.slice(0,n).map(k=>({l:k,v:catsObj[k]})),resto=ks.slice(n);
 if(resto.length)top.push({l:'Otros ('+resto.length+')',v:resto.reduce((s,k)=>s+catsObj[k],0)});
 return top;
}
const CMP_MESES3=()=>MESES.map(m=>m.slice(0,3));

/* ---------- PDF ---------- */
async function pdfComparativo(d){
 if(!pdfListo())throw new Error('Librería PDF no disponible');
 const titulo=d.transp?'Informe de Transparencia':'Comparativo de Gestión',c=await pdfNuevo(titulo,d.folio),W=PDF_W-PDF_M*2,hoy=actaFechaLarga(actaHoyISO());
 const [A0,A1,A2,A3]=d.anios,Cm=d.completo,P=d.periodo,cur=P[3],prev=P[2],U=d.ult4,ult=U[3];
 const mesTxt=MESES[d.M].toLowerCase(),m3=mesTxt.slice(0,3);
 const ml=m=>MESES[m.m].slice(0,3)+' '+String(m.a).slice(2);
 const ml0=MESES[(d.M+9)%12]+' '+(d.M<3?d.Y-1:d.Y),ml1=MESES[d.M]+' '+d.Y;
 const conDatos=Cm.filter(m=>!m.sdIng);

 pdfTexto(c,'Folio N° '+d.folio,{size:12,font:c.B,color:PDF_COL.marca});
 pdfTexto(c,MESES[d.M]+' '+d.Y,{size:9.5,color:PDF_COL.gris,align:'right'});
 c.y+=10;pdfLinea(c,PDF_M,PDF_W-PDF_M,c.y,PDF_COL.borde,0.8);c.y+=8;

 /* ===== Portada: de qué trata ===== */
 pdfSeccion(c,'Acerca de este informe');
 pdfParrafo(c,'Este documento resume cómo ha funcionado la caja del Condominio Bosques del Sur 4: cuánto se recauda por gastos comunes, en qué se gasta y cómo ha evolucionado en el tiempo. Lo elabora el Comité de Administración con los registros del sistema al '+hoy+', con cierre a '+MESES[d.M]+' '+d.Y+'. No contiene datos personales de los residentes.',{size:10,lh:14.5,despues:6});
 pdfParrafo(c,'•  Resumen ejecutivo: los indicadores clave y lo más importante en pocas líneas.',{size:9.5,lh:13.5,despues:1,justify:false});
 pdfParrafo(c,'•  1. Últimos 4 años ('+A0+' a '+A3+'): año completo y mismo período (enero a '+mesTxt+'), cobranza mes a mes, egresos por categoría y evolución de la caja.',{size:9.5,lh:13.5,despues:1,justify:false});
 pdfParrafo(c,'•  2. Últimos 4 meses ('+ml0+' a '+ml1+'): cuadro de ingresos y egresos, gráficos, categorías y mayores gastos.',{size:9.5,lh:13.5,despues:4,justify:false});
 pdfParrafo(c,'Cómo leerlo: «cobranza» es el porcentaje de gastos comunes pagados sobre los exigibles (no cuenta meses sin cobro ni departamentos eximidos). «Sin datos» indica un período cuyos pagos aún no se cargan; no significa que no haya habido recaudación.',{size:8.5,lh:12,despues:2,color:PDF_COL.gris,justify:false});

 /* ===== Resumen ejecutivo ===== */
 pdfSeccion(c,'Resumen ejecutivo');
 const dI=cmpDelta(cur.ing,prev.ing,cur.sdIng||prev.sdIng,false,String(A2)),dE=cmpDelta(cur.egr,prev.egr,prev.egr===0&&prev.sdIng,true,String(A2));
 const kp=[
  {t:'Saldo de caja acumulado',v:fmt(d.saldoActual),color:d.saldoActual>=0?PDF_COL.marca:PDF_COL.rojo,sub:'Balance general al cierre de '+m3+' '+d.Y,acento:PDF_COL.marca},
  {t:'Ingresos enero-'+m3+' '+A3,v:cur.sdIng?'sin datos':fmt(cur.ing),color:PDF_COL.verde,...dI,acento:PDF_COL.verde},
  {t:'Egresos enero-'+m3+' '+A3,v:fmt(cur.egr),color:PDF_COL.rojo,...dE,acento:PDF_COL.rojo},
  {t:'Resultado del período',v:cur.sdIng?'sin datos':fmt(cur.saldo),color:cur.saldo>=0?PDF_COL.marca:PDF_COL.rojo,sub:'ingresos menos egresos'},
  {t:'Cobranza enero-'+m3+' '+A3,v:cmpPct(cur.cobranza),color:PDF_COL.marca,...(cur.cobranza!=null&&prev.cobranza!=null?{sub:Math.round(Math.abs(cur.cobranza-prev.cobranza)*100)+' pts vs '+A2,dir:Math.round((cur.cobranza-prev.cobranza)*100)===0?null:(cur.cobranza>prev.cobranza?1:-1),subColor:cur.cobranza>=prev.cobranza?PDF_COL.verde:PDF_COL.rojo}:{sub:'promedio del período'})},
  {t:'Al día en '+MESES[d.M],v:ult.exig?ult.pg+' de '+ult.exig:'—',color:PDF_COL.marca,sub:ult.cob!=null?'cobranza del mes: '+cmpPct(ult.cob):'sin cobro este mes'}
 ];
 cmpKpis(c,kp);
 pdfTexto(c,'Lo más importante',{size:10,font:c.B,color:'#374151',y:c.y+10});c.y+=18;
 const pts=[];
 pts.push('La caja acumulada es de '+fmt(d.saldoActual)+' (Balance General del Panel Central).');
 if(!cur.sdIng&&!prev.sdIng&&prev.ing>0)pts.push('Entre enero y '+mesTxt+', los ingresos de '+A3+' '+(cur.ing>=prev.ing?'subieron ':'bajaron ')+Math.abs(Math.round((cur.ing-prev.ing)/prev.ing*100))+'% respecto de '+A2+' ('+fmt(cur.ing)+' frente a '+fmt(prev.ing)+').');
 if(prev.egr>0)pts.push('Los egresos del mismo período '+(cur.egr>=prev.egr?'subieron ':'bajaron ')+Math.abs(Math.round((cur.egr-prev.egr)/prev.egr*100))+'% ('+fmt(cur.egr)+' frente a '+fmt(prev.egr)+').');
 const topC=cmpTopCats(cur.cats,1)[0];if(topC&&cur.egr>0)pts.push('La mayor partida de gasto en '+A3+' es «'+topC.l+'»: '+fmt(topC.v)+' ('+Math.round(topC.v/cur.egr*100)+'% de los egresos).');
 if(ult.cob!=null)pts.push('En '+MESES[d.M]+' pagaron '+ult.pg+' de '+ult.exig+' departamentos exigibles ('+cmpPct(ult.cob)+').');
 if(!d.sinMor&&d.mor.length)pts.push(d.mor.length+' departamento'+(d.mor.length>1?'s mantienen':' mantiene')+' deuda por '+fmt(d.mor.reduce((s,x)=>s+x.total,0))+' (gastos comunes y multas).');
 const sdAn=d.anios.filter((y,i)=>Cm[i].sdIng);
 if(sdAn.length)pts.push('Sin datos de ingresos en '+sdAn.join(' y ')+': cuando se carguen esos pagos, el informe los incorporará automáticamente.');
 pts.forEach(t=>pdfParrafo(c,'•  '+t,{size:9.5,lh:13.5,despues:2,color:'#374151',justify:false}));

 /* ===== 1. Cuatro años ===== */
 pdfPagina(c);
 pdfSeccion(c,'1. Comparación de los últimos 4 años');
 pdfParrafo(c,'Dos lecturas complementarias: el año completo y el mismo período de cada año (enero a '+mesTxt+'), que permite comparar el año en curso con los anteriores en igualdad de condiciones. Un año sin pagos cargados aparece como «sin datos» y no se grafica como cero.',{size:9.5,lh:14,despues:6,color:'#374151'});

 cmpSub(c,'1.1  Año completo');
 pdfTabla(c,[{t:'Año',w:W-392},{t:'Ingresos',w:98,align:'right'},{t:'Egresos',w:98,align:'right'},{t:'Resultado',w:98,align:'right'},{t:'Cobranza',w:98,align:'right'}],
  Cm.map(m=>[String(m.y)+(m.y===d.Y?' (en curso)':''),m.sdIng?'sin datos':fmt(m.ing),m.sdTodo?'sin datos':fmt(m.egr),m.sdIng?'sin datos':fmt(m.saldo),cmpPct(m.cobranza)]));
 const mejor=conDatos.length?conDatos.reduce((a,b)=>b.ing>a.ing?b:a):null,pos=conDatos.filter(m=>m.saldo>0).length;
 cmpTarjeta(c,'Ingresos y egresos por año','Año completo (el año en curso incluye solo los meses transcurridos)',190,()=>
  cmpBarras(c,{grupos:Cm.map(m=>({l:String(m.y),vals:[m.sdIng?null:m.ing,m.sdTodo?null:m.egr]})),series:[{n:'Ingresos',color:PDF_COL.marca2},{n:'Egresos',color:'#F87171'}]}),
  mejor?('el año de mayor recaudación es '+mejor.y+' ('+fmt(mejor.ing)+'). '+(pos===conDatos.length?'Todos los años con datos cierran con resultado positivo.':pos+' de '+conDatos.length+' años con datos cierran con resultado positivo.')):'aún no hay pagos cargados en los años comparados.');

 cmpSub(c,'1.2  Mismo período: enero a '+mesTxt);
 pdfTabla(c,[{t:'Año',w:W-380},{t:'Ingresos',w:95,align:'right'},{t:'Var. ingr.',w:65,align:'right'},{t:'Egresos',w:95,align:'right'},{t:'Var. egr.',w:65,align:'right'},{t:'Resultado',w:60,align:'right'}],
  P.map((m,i)=>[String(m.y),m.sdIng?'sin datos':fmt(m.ing),i?cmpVar(m.ing,P[i-1].ing,m.sdIng,P[i-1].sdIng):'—',m.sdTodo?'sin datos':fmt(m.egr),i?cmpVar(m.egr,P[i-1].egr,m.sdTodo,P[i-1].sdTodo):'—',m.sdIng?'s/d':cmpK(m.saldo)]));
 cmpTarjeta(c,'Ingresos y egresos, mismo período','Enero a '+mesTxt+' de cada año',190,()=>
  cmpBarras(c,{grupos:P.map(m=>({l:String(m.y),vals:[m.sdIng?null:m.ing,m.sdTodo?null:m.egr]})),series:[{n:'Ingresos',color:PDF_COL.marca2},{n:'Egresos',color:'#F87171'}]}),
  (!cur.sdIng&&!prev.sdIng&&prev.ing>0)?('frente a '+A2+', los ingresos '+(cur.ing>=prev.ing?'subieron ':'bajaron ')+Math.abs(Math.round((cur.ing-prev.ing)/prev.ing*100))+'% y los egresos '+(cur.egr>=prev.egr?'subieron ':'bajaron ')+(prev.egr?Math.abs(Math.round((cur.egr-prev.egr)/prev.egr*100))+'%':'(sin base de comparación)')+'.'):'no hay base de comparación suficiente con el año anterior.');
 cmpTarjeta(c,'Resultado del período (ingresos menos egresos)','Positivo = la caja crece; negativo = se consume ahorro',165,()=>
  cmpBarras(c,{alto:95,grupos:P.map(m=>({l:String(m.y),vals:[m.sdIng?null:m.saldo]})),series:[{n:'Resultado',color:PDF_COL.marca}]}),
  conDatos.length?('en '+A3+' el resultado de enero a '+mesTxt+' es '+(cur.sdIng?'sin datos':fmt(cur.saldo))+'.'):null);

 const dm=d.mensual[3].map((v,m)=>(m>d.M||Cm[3].sdIng)?null:v),mesesOk=dm.map((v,i)=>({v,i})).filter(x=>x.v!=null);
 const mx=mesesOk.length?mesesOk.reduce((a,b)=>b.v>a.v?b:a):null,mn=mesesOk.length?mesesOk.reduce((a,b)=>b.v<a.v?b:a):null;
 cmpTarjeta(c,'Ingresos mes a mes, un año sobre otro','Cada línea es un año; permite ver la estacionalidad del pago',205,()=>
  cmpLineas(c,{x:CMP_MESES3(),series:d.anios.map((y,i)=>({n:String(y),color:CMP_COL_ANIO[i],grueso:i===3?2.4:1.6,vals:d.mensual[i].map((v,m)=>{const futuro=(y===d.Y&&m>d.M);return (Cm[i].sdIng||futuro)?null:v;})}))}),
  mx&&mesesOk.length>1?('en '+A3+', el mes de mayor ingreso fue '+MESES[mx.i].toLowerCase()+' ('+fmt(mx.v)+') y el de menor, '+MESES[mn.i].toLowerCase()+' ('+fmt(mn.v)+').'):null);

 const cobProm=d.heat.map(f=>{const v=f.filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;});
 const hv=d.heat[3].map((v,i)=>({v,i})).filter(x=>x.v!=null),peor=hv.length>1?hv.reduce((a,b)=>b.v<a.v?b:a):null;
 cmpTarjeta(c,'Cobranza mes a mes','Porcentaje de departamentos exigibles que pagaron cada mes',150,()=>
  cmpHeat(c,{x:CMP_MESES3(),filas:d.anios.map((y,i)=>({l:String(y),vals:d.heat[i]}))}),
  cobProm[3]!=null?('la cobranza media de '+A3+' es '+cmpPct(cobProm[3])+(cobProm[2]!=null?' (en '+A2+': '+cmpPct(cobProm[2])+')':'')+(peor?'; el mes más bajo fue '+MESES[peor.i].toLowerCase()+' ('+cmpPct(peor.v)+').':'.')):null);

 cmpSub(c,'1.3  Egresos por categoría (mismo período)');
 const catTot={};P.forEach(m=>Object.keys(m.cats).forEach(k=>{catTot[k]=(catTot[k]||0)+m.cats[k];}));
 const cats=Object.keys(catTot).sort((x,y)=>catTot[y]-catTot[x]),top=cats.slice(0,7),resto=cats.slice(7);
 const filasCat=top.map(k=>[k,...P.map(m=>m.cats[k]?fmt(m.cats[k]):'—'),cmpVar(P[3].cats[k]||0,P[2].cats[k]||0,false,false)]);
 if(resto.length)filasCat.push(['Otros ('+resto.length+')',...P.map(m=>{const s=resto.reduce((a,k)=>a+(m.cats[k]||0),0);return s?fmt(s):'—';}),cmpVar(resto.reduce((a,k)=>a+(P[3].cats[k]||0),0),resto.reduce((a,k)=>a+(P[2].cats[k]||0),0),false,false)]);
 if(filasCat.length){
  pdfTabla(c,[{t:'Categoría',w:W-4*72-55},{t:String(A0),w:72,align:'right'},{t:String(A1),w:72,align:'right'},{t:String(A2),w:72,align:'right'},{t:String(A3),w:72,align:'right'},{t:'Var. '+A3,w:55,align:'right'}],filasCat);
  const tc=cmpTopCats(cur.cats,6);
  if(tc.length)cmpTarjeta(c,'¿En qué se gasta? '+A3+' (enero a '+mesTxt+')','Participación de cada categoría en los egresos del período',tc.length*20+10,()=>cmpBarrasH(c,tc,cur.egr),null);
 }else pdfParrafo(c,'No hay egresos registrados en los períodos comparados.',{size:10,justify:false});

 const sl=d.saldo;
 if(sl.length>2){
  const f0=sl[0],f1=sl[sl.length-1];
  cmpTarjeta(c,'Evolución de la caja','Saldo acumulado al cierre de cada mes (mismo cálculo del Balance General)',205,()=>
   cmpLineas(c,{x:sl.map(p=>MESES[p.m].slice(0,3)+' '+String(p.a).slice(2)),paso:sl.length>14?3:1,punto:1.6,series:[{n:'Saldo acumulado',color:PDF_COL.marca,grueso:2.2,vals:sl.map(p=>p.v)}]}),
   'desde '+MESES[f0.m].toLowerCase()+' '+f0.a+' ('+fmt(f0.v)+') hasta '+MESES[f1.m].toLowerCase()+' '+f1.a+' ('+fmt(f1.v)+'): '+(f1.v>=f0.v?'la caja creció ':'la caja bajó ')+fmt(Math.abs(f1.v-f0.v))+'.');
 }
 const parc=Cm.filter(m=>m.hay&&m.mesesCobro<12&&m.y<d.Y);
 parc.forEach(m=>pdfParrafo(c,'•  El año '+m.y+' tuvo cobro de gasto común en '+m.mesesCobro+' meses, por lo que no es comparable con un año completo.',{size:9,lh:13,despues:3,color:PDF_COL.gris,justify:false}));

 /* ===== 2. Últimos 4 meses ===== */
 if(c.y>PDF_H*0.55)pdfPagina(c);
 pdfSeccion(c,'2. Detalle de los últimos 4 meses');
 pdfParrafo(c,'Cierre mensual de '+ml0+' a '+ml1+': de dónde vino el dinero, en qué se gastó y cuántos departamentos pagaron.',{size:9.5,lh:14,despues:6,color:'#374151'});
 const cw=Math.floor((W-170)/4),fila=(t,f)=>[t,...U.map(f)];
 cmpSub(c,'2.1  Cuadro de ingresos y egresos');
 pdfTabla(c,[{t:'Concepto',w:W-cw*4},...U.map(m=>({t:MESES[m.m]+' '+m.a,w:cw,align:'right'}))],[
  fila('Gasto común recaudado',m=>fmt(m.ingGC)),fila('Ingresos extra',m=>m.ex?fmt(m.ex):'—'),fila('Multas pagadas',m=>m.mp?fmt(m.mp):'—'),
  fila('Total ingresos',m=>fmt(m.ing)),fila('Total egresos',m=>fmt(m.egr)),fila('Resultado del mes',m=>fmt(m.saldo)),
  fila('Departamentos al día',m=>m.pg+' de '+m.exig),fila('Cobranza',m=>cmpPct(m.cob))]);
 const bm=U.reduce((a,b)=>b.saldo>a.saldo?b:a);
 cmpTarjeta(c,'Ingresos y egresos por mes',null,190,()=>
  cmpBarras(c,{grupos:U.map(m=>({l:ml(m),vals:[m.ing,m.egr]})),series:[{n:'Ingresos',color:PDF_COL.marca2},{n:'Egresos',color:'#F87171'}]}),
  'el mejor resultado de los cuatro meses fue '+MESES[bm.m].toLowerCase()+' ('+fmt(bm.saldo)+'); '+MESES[d.M].toLowerCase()+' cerró con '+fmt(ult.saldo)+'.');
 cmpTarjeta(c,'Resultado y cobranza por mes','Cómo le fue a la caja cada mes y qué porcentaje de los vecinos pagó',250,()=>{
  pdfTexto(c,'Resultado del mes (ingresos menos egresos)',{x:PDF_M+4,size:8.5,font:c.B,color:'#374151',y:c.y+8});c.y+=14;
  cmpBarras(c,{alto:80,grupos:U.map(m=>({l:ml(m),vals:[m.saldo]})),series:[{n:'Resultado del mes',color:PDF_COL.marca}]});
  pdfTexto(c,'Cobranza (% de departamentos exigibles que pagaron)',{x:PDF_M+4,size:8.5,font:c.B,color:'#374151',y:c.y+8});c.y+=14;
  cmpBarras(c,{alto:70,min:0,max:1,fmt:v=>Math.round(v*100)+'%',grupos:U.map(m=>({l:ml(m),vals:[m.cob]})),series:[{n:'Cobranza',color:CMP_COL_ANIO[2]}],leyenda:false});
 },null);

 cmpSub(c,'2.2  Egresos por categoría');
 const ct={};U.forEach(m=>Object.keys(m.cats).forEach(k=>{ct[k]=(ct[k]||0)+m.cats[k];}));
 const cu=Object.keys(ct).sort((x,y)=>ct[y]-ct[x]),top4=cu.slice(0,6),rest4=cu.slice(6);
 const fc=top4.map(k=>[k,...U.map(m=>m.cats[k]?fmt(m.cats[k]):'—')]);
 if(rest4.length)fc.push(['Otros ('+rest4.length+')',...U.map(m=>{const s=rest4.reduce((a,k)=>a+(m.cats[k]||0),0);return s?fmt(s):'—';})]);
 if(fc.length)pdfTabla(c,[{t:'Categoría',w:W-cw*4},...U.map(m=>({t:ml(m),w:cw,align:'right'}))],fc);
 else pdfParrafo(c,'No hay egresos registrados en estos meses.',{size:10,justify:false});

 cmpSub(c,'2.3  Mayores gastos del período');
 const gg=[];U.forEach(m=>m.gastos.forEach(g=>gg.push({m,g})));gg.sort((x,y)=>(Number(y.g.monto)||0)-(Number(x.g.monto)||0));
 if(gg.length)pdfTabla(c,[{t:'Mes',w:62},{t:'Descripción',w:W-62-110-90},{t:'Categoría',w:110},{t:'Monto',w:90,align:'right'}],
  gg.slice(0,6).map(x=>[ml(x.m),rendTrunc(c,x.g.descripcion||categoriaDeGasto(x.g),W-62-110-90-16,9.5),rendTrunc(c,categoriaDeGasto(x.g),94,9.5),fmt(Number(x.g.monto)||0)]));
 else pdfParrafo(c,'No hay gastos registrados en estos meses.',{size:10,justify:false});

 if(!d.sinMor){
  pdfSeccion(c,'2.4  Deuda acumulada al cierre de '+MESES[d.M]+' '+d.Y);
  const deuda=d.mor.reduce((s,x)=>s+x.gc,0),multas=d.mor.reduce((s,x)=>s+x.tm,0);
  pdfFranja(c,[['Deptos con deuda',String(d.mor.length),d.mor.length?PDF_COL.rojo:PDF_COL.verde],['Gastos comunes adeudados',fmt(deuda),deuda?PDF_COL.rojo:PDF_COL.verde],['Multas pendientes',fmt(multas),PDF_COL.marca]]);
 }

 /* ===== Notas y cierre ===== */
 pdfAsegurar(c,300);
 pdfSeccion(c,'Notas y metodología');
 ['Las cifras provienen de los mismos registros y fórmulas del Panel Central, Gasto Común y Transparencia, por lo que coinciden con ellos.',
  'Ingresos = gasto común recaudado + ingresos extra + multas pagadas. Egresos = gastos fijos + gastos variables. Resultado = ingresos menos egresos.',
  'Cobranza = departamentos que pagaron / departamentos exigibles. No se consideran exigibles los meses anteriores al inicio de cobro ni los departamentos eximidos.',
  'Un período «sin datos» es aquel cuyos pagos aún no se han cargado en el sistema; no se grafica como cero para no distorsionar la comparación.']
  .forEach(t=>pdfParrafo(c,'•  '+t,{size:8.8,lh:12.5,despues:2,color:'#4B5563',justify:false}));
 pdfFirmas(c,PDF_ROLES);
 c.y+=8;pdfParrafo(c,'Informe elaborado con los registros del sistema al '+hoy+'. No reemplaza los documentos contables que exija la ley o el reglamento de copropiedad.',{size:8,color:PDF_COL.gris,despues:0});
 pdfCerrar(c,titulo);
 return await pdfBytes(c);
}

/* Botón «Exportar PDF» de Transparencia y del Panel Central: informe estructurado del mes que se está viendo.
   Reemplaza a window.print(), que imprimía la pantalla tal cual (gráficos cortados, valores tapados). */
function transpExportarPDF(){rendGenerarPDF({tipo:'comparativo',ancla:{a:state.currentYear,m:state.currentMonth}});}
