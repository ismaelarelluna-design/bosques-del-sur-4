/* ===========================================================================
   Pantalla pública de votación — Condominio Bosques del Sur 4
   ---------------------------------------------------------------------------
   URL: ?v=<CODIGO de 6 caracteres>   (sin sesión; no carga ningún dato privado)
   Lee:     cbs4_votacion/<codigo>            (espejo público, solo ese nodo)
   Escribe: cbs4_votos_reg/<codigo>/d<depto>  {n,o,ts}  una sola vez (lo exigen las reglas)
   No existe ningún nodo público que muestre quién ya votó.
   Depende de: core.js (esc, fmt, LOGO_SRC, db), votaciones.js (VOT_RE, VOT_PUB, VOT_REG).
   =========================================================================== */
const VT={code:'',d:null,dep:'',nombre:'',op:'',confirm:false,done:null,err:'',busy:false,lista:false,q:'',vista:''};
const VT_NOMBRE_RE=/^[\p{L}][\p{L}\s'’.\-]{3,78}$/u;

function votarCodigoURL(){const p=new URLSearchParams(location.search);return p.has('v')?String(p.get('v')||'').trim().toUpperCase():null;}
/* true si la URL pide votar: el arranque normal de la app NO continúa. */
function votarPublicoSiAplica(){
 const code=votarCodigoURL();if(code===null)return false;
 const ov=document.getElementById('loading-overlay');if(ov)ov.style.display='none';
 const ls=document.getElementById('login-screen');if(ls)ls.style.display='none';
 const m=document.createElement('meta');m.name='robots';m.content='noindex,nofollow';document.head.appendChild(m);
 const r=document.createElement('meta');r.name='referrer';r.content='no-referrer';document.head.appendChild(r);
 document.title='Votación · Condominio Bosques del Sur 4';
 const el=document.getElementById('votar-screen');if(!el)return true;el.style.display='block';
 votarCargar(code);return true;
}
function votarCaparazon(inner){
 return `<div class="vt-bg" aria-hidden="true"></div><div class="login-blobs" aria-hidden="true"><i></i><i></i><i></i></div>
 <div class="vt-scroll"><div class="vt-wrap"><div class="vt-brand"><div class="vt-logo"><img src="${LOGO_SRC}" alt="Logo"/></div><div class="vt-brand-t">CONDOMINIO<br>BOSQUES DEL SUR 4</div><div class="vt-brand-s">Votación de la comunidad</div></div>
 ${inner}<div class="vt-foot">Cada departamento vota una sola vez.<br><a href="${esc(location.pathname)}">Ir a la aplicación</a></div></div></div>`;
}
/* anim: 'all' = entrada completa (cambio de pantalla), 'modal' = solo la ventana de confirmación, 'none' = sin animación.
   Sin esto cada toque rearmaría la pantalla y volvería a animar todo (parpadeo). Se conserva el scroll. */
function votarPintar(inner,vista){
 const el=document.getElementById('votar-screen'),sc=el.querySelector('.vt-scroll'),st=sc?sc.scrollTop:0;
 const v=vista||'otra',anim=VT.vista!==v?(v==='form'&&VT.vista==='confirm'?'none':(v==='confirm'&&VT.vista==='form'?'modal':'all')):'none';
 el.setAttribute('data-anim',anim);VT.vista=v;
 el.innerHTML=votarCaparazon(inner);
 const n=el.querySelector('.vt-scroll');if(n&&st)n.scrollTop=st;
}
function votarError(msg,sub){
 votarPintar(`<div class="vt-card vt-center"><div class="vt-big-ico">🔒</div><div class="vt-h1" style="font-size:20px">${esc(msg)}</div><p class="vt-p">${esc(sub||'Pide un enlace nuevo a la directiva del condominio.')}</p></div>`);
}
async function votarCargar(code){
 VT.code=code;
 votarPintar('<div class="vt-card vt-center"><div class="spinner" style="margin:10px auto"></div><p class="vt-p">Cargando votación…</p></div>');
 if(!/^[A-Z2-9]{6}$/.test(code)){votarError('Enlace no válido');return;}
 try{
  const snap=await Promise.race([db.ref('cbs4_votacion/'+code).once('value'),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),12000))]);
  const d=snap.val();
  if(!d||typeof d!=='object'||!d.t){votarError('Enlace no válido o votación no disponible');return;}
  VT.d=d;votarRender();
 }catch(e){console.warn('votar:',e);votarError('No se pudo cargar en este momento','Revisa tu conexión e inténtalo nuevamente.');}
}
/* ---------------------------------------------------------------- datos */
function votarDeptos(){
 const o=VT.d&&VT.d.deps||{};
 return Object.keys(o).filter(k=>/^d\d+$/.test(k)&&o[k]).map(k=>({id:k.slice(1),k,n:String(o[k])}))
  .sort((a,b)=>a.n.localeCompare(b.n,'es',{numeric:true}));
}
function votarOpciones(){
 const d=VT.d||{},op=d.op||{},ord=Array.isArray(d.ord)?d.ord:Object.values(d.ord||{});
 return ord.filter(id=>op[id]).map(id=>({id,t:String(op[id])}));
}
function votarAbierta(){const d=VT.d;return !!d&&d.e==='abierta'&&(!d.c||Date.now()<d.c);}
function votarFechaTxt(iso){const p=String(iso||'').split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:'';}
function votarRestante(ts){
 const ms=ts-Date.now();if(ms<=0)return '';
 const m=Math.floor(ms/60000),d=Math.floor(m/1440),h=Math.floor((m%1440)/60),mm=m%60;
 return d?d+' d '+h+' h':(h?h+' h '+mm+' min':mm+' min');
}
function votarMeta(){
 const d=VT.d,c=d.c?new Date(d.c):null;
 return `<div class="vt-meta"><span>📅 ${esc(votarFechaTxt(d.f))}</span>${c?`<span>⏰ Cierra ${esc(String(c.getDate()).padStart(2,'0')+'/'+String(c.getMonth()+1).padStart(2,'0'))} a las ${esc(String(c.getHours()).padStart(2,'0')+':'+String(c.getMinutes()).padStart(2,'0'))}${votarRestante(d.c)?' · quedan '+esc(votarRestante(d.c)):''}</span>`:''}<span>1️⃣ 1 voto por departamento</span></div>`;
}
/* ----------------------------------------------------------- pantallas */
function votarRender(){
 const d=VT.d;if(!d)return;
 if(VT.done)return votarPintar(votarHtmlGracias(),'gracias');
 if(!votarAbierta())return votarPintar(votarHtmlCerrada(),'cerrada');
 votarPintar(votarHtmlFormulario()+(VT.confirm?votarHtmlConfirmar():''),VT.confirm?'confirm':'form');
}
function votarHtmlCerrada(){
 const d=VT.d,r=Array.isArray(d.r)?d.r:Object.values(d.r||{}),formal=d.e==='cerrada';
 const max=Math.max(0,...r.map(o=>o.n)),gan=r.filter(o=>o.n===max&&max>0);
 return `<div class="vt-card"><div class="vt-kicker">${formal?'Votación cerrada':'Plazo terminado'}</div><h1 class="vt-h1">${esc(d.t)}</h1>${d.d?`<p class="vt-p">${esc(d.d)}</p>`:''}
 ${formal&&r.length?`<div class="vt-sec">Resultado final</div>${r.map(o=>`<div class="vt-pr"><div class="vt-pr-h"><span>${esc(o.t)}${gan.length===1&&gan[0]===o?' <b class="vt-win">✓</b>':''}</span><b>${esc(votPct(o.p))} · ${o.n}</b></div><div class="fp-pb vt-big"><i style="width:${Math.min(100,Number(o.p)||0).toFixed(1)}%"></i></div></div>`).join('')}
  <p class="vt-p" style="margin-top:10px">Participación: ${esc(String(d.vot))} de ${esc(String(d.tot))} departamentos${d.tot?' ('+esc(votPct(d.vot/d.tot*100))+')':''}.</p>`
  :`<p class="vt-p">El plazo para votar terminó. La directiva publicará el resultado en Transparencia.</p>`}</div>`;
}
function votarHtmlFormulario(){
 const d=VT.d,deps=votarDeptos(),sel=deps.find(x=>x.id===VT.dep),ops=votarOpciones();
 return `<div class="vt-card"><div class="vt-kicker">Votación</div><h1 class="vt-h1">${esc(d.t)}</h1>${d.d?`<p class="vt-p">${esc(d.d)}</p>`:''}${votarMeta()}
 <div class="vt-sec">1 · Tu departamento</div>
 <button type="button" class="vt-select ${sel?'sel':''}" onclick="votarToggleLista()" aria-haspopup="listbox" aria-expanded="${VT.lista}"><span>${sel?'Departamento '+esc(sel.n):'Busca y selecciona tu departamento'}</span><i>▾</i></button>
 ${VT.lista?`<div class="vt-lista"><input class="vt-input" id="vt-q" type="search" inputmode="numeric" autocomplete="off" placeholder="Buscar número…" value="${esc(VT.q)}" oninput="votarFiltrar(this.value)"/><div id="vt-items" role="listbox">${votarHtmlItems()}</div></div>`:''}
 <div class="vt-sec">2 · Tu nombre y apellido</div>
 <input class="vt-input" id="vt-nombre" autocomplete="name" maxlength="80" placeholder="Ej: María González" value="${esc(VT.nombre)}" oninput="votarNombre(this.value)"/>
 <div class="vt-hint">Escribe tu nombre y tu apellido. Quedarán registrados junto a tu voto y la directiva podrá verlos.</div>
 <div class="vt-sec">3 · Tu voto</div>
 <div role="radiogroup" id="vt-ops">${ops.map(o=>`<button type="button" role="radio" aria-checked="${VT.op===o.id}" class="vt-opt ${VT.op===o.id?'on':''}" onclick="votarElegirOp('${esc(o.id)}')"><span class="vt-radio"></span><span>${esc(o.t)}</span></button>`).join('')}</div>
 ${VT.err?`<div class="vt-err" role="alert">${esc(VT.err)}</div>`:''}
 <div class="vt-falta" id="vt-falta" style="display:${votarFaltante()?'block':'none'}">${esc(votarFaltante())}</div>
 <button type="button" class="vt-btn" id="vt-go" onclick="votarRevisar()" ${votarListo()?'':'disabled'}>Revisar mi voto</button></div>`;
}
function votarHtmlItems(){
 const q=VT.q.trim().toLowerCase(),l=votarDeptos().filter(x=>!q||x.n.toLowerCase().includes(q));
 return l.length?l.map(x=>`<button type="button" role="option" class="vt-item ${x.id===VT.dep?'on':''}" onclick="votarElegirDepto('${esc(x.id)}')">Departamento ${esc(x.n)}</button>`).join(''):'<div class="vt-hint" style="padding:10px">Ningún departamento coincide.</div>';
}
function votarHtmlConfirmar(){
 const sel=votarDeptos().find(x=>x.id===VT.dep),op=votarOpciones().find(o=>o.id===VT.op);
 return `<div class="vt-modal" role="dialog" aria-modal="true"><div class="vt-card vt-conf"><div class="vt-kicker">Confirma tu voto</div>
 <div class="vt-resumen"><div><span>Departamento</span><b>${esc(sel?sel.n:'')}</b></div><div><span>Nombre</span><b>${esc(VT.nombre.trim())}</b></div><div><span>Tu voto</span><b class="vt-voto">${esc(op?op.t:'')}</b></div></div>
 <p class="vt-p">Una vez enviado <b>no se puede modificar</b>. Si algo está mal, vuelve y corrígelo ahora.</p>
 ${VT.err?`<div class="vt-err" role="alert">${esc(VT.err)}</div>`:''}
 <button type="button" class="vt-btn" id="vt-send" onclick="votarEnviar()" ${VT.busy?'disabled':''}>${VT.busy?'Enviando…':'Confirmar y enviar mi voto'}</button>
 <button type="button" class="vt-btn sec" onclick="VT.confirm=false;VT.err='';votarRender()" ${VT.busy?'disabled':''}>Volver</button></div></div>`;
}
function votarHtmlGracias(){
 const r=VT.done;
 return `<div class="vt-card vt-center"><svg class="vt-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg>
 <h1 class="vt-h1" style="font-size:22px">¡Voto registrado!</h1><p class="vt-p">Gracias por participar.</p>
 <div class="vt-resumen" style="text-align:left"><div><span>Votación</span><b>${esc(VT.d.t)}</b></div><div><span>Departamento</span><b>${esc(r.dep)}</b></div><div><span>Nombre</span><b>${esc(r.nombre)}</b></div><div><span>Tu voto</span><b class="vt-voto">${esc(r.op)}</b></div><div><span>Fecha y hora</span><b>${esc(r.fecha)}</b></div></div>
 <p class="vt-hint">Guarda una captura de pantalla como comprobante. Ya puedes cerrar esta ventana.</p></div>`;
}
/* --------------------------------------------------------- interacción */
function votarListo(){return !!(VT.dep&&VT.op&&VT_NOMBRE_RE.test(VT.nombre.trim())&&VT.nombre.trim().split(/\s+/).filter(w=>w.length>=2).length>=2);}
/* Qué falta para poder votar (se muestra sobre el botón para que nunca parezca roto). */
function votarFaltante(){
 const f=[];
 if(!VT.dep)f.push('tu departamento');
 const n=VT.nombre.trim();
 if(!(VT_NOMBRE_RE.test(n)&&n.split(/\s+/).filter(w=>w.length>=2).length>=2))f.push('tu nombre y apellido');
 if(!VT.op)f.push('tu voto');
 return f.length?'Falta: '+f.join(', ').replace(/, ([^,]*)$/,' y $1')+'.':'';
}
function votarActualizarBtn(){
 const b=document.getElementById('vt-go');if(b)b.disabled=!votarListo();
 const m=document.getElementById('vt-falta');if(m){const t=votarFaltante();m.textContent=t;m.style.display=t?'block':'none';}
}
function votarToggleLista(){VT.lista=!VT.lista;VT.q='';votarRender();if(VT.lista){const i=document.getElementById('vt-q');if(i)i.focus();}}
function votarFiltrar(q){VT.q=q;const el=document.getElementById('vt-items');if(el)el.innerHTML=votarHtmlItems();}
function votarElegirDepto(id){VT.dep=id;VT.lista=false;VT.err='';votarRender();}
function votarNombre(v){VT.nombre=v;VT.err='';votarActualizarBtn();}
function votarElegirOp(id){VT.op=id;VT.err='';const w=document.getElementById('vt-ops');if(w)w.querySelectorAll('.vt-opt').forEach(b=>{const on=b.getAttribute('onclick').includes("'"+id+"'");b.classList.toggle('on',on);b.setAttribute('aria-checked',on);});votarActualizarBtn();}
function votarRevisar(){
 if(!votarListo()){VT.err='Completa tu departamento, tu nombre y apellido y tu voto.';votarRender();return;}
 VT.nombre=VT.nombre.trim().replace(/\s+/g,' ');VT.err='';VT.confirm=true;votarRender();
}
async function votarEnviar(){
 if(VT.busy)return;VT.busy=true;VT.err='';votarRender();
 try{
  /* Se vuelve a leer el estado: la votación pudo cerrarse mientras la persona decidía. */
  const snap=await Promise.race([db.ref('cbs4_votacion/'+VT.code).once('value'),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),12000))]);
  const d=snap.val();VT.d=d||VT.d;
  if(!d||!votarAbierta()){VT.busy=false;VT.confirm=false;votarRender();return;}
  const rec={n:VT.nombre,o:VT.op,ts:firebase.database.ServerValue.TIMESTAMP};
  await Promise.race([db.ref('cbs4_votos_reg/'+VT.code+'/d'+VT.dep).set(rec),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),15000))]);
  const sel=votarDeptos().find(x=>x.id===VT.dep),op=votarOpciones().find(o=>o.id===VT.op),n=new Date();
  VT.done={dep:sel?sel.n:VT.dep,nombre:VT.nombre,op:op?op.t:'',fecha:String(n.getDate()).padStart(2,'0')+'/'+String(n.getMonth()+1).padStart(2,'0')+'/'+n.getFullYear()+' '+String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0')};
  VT.busy=false;VT.confirm=false;votarRender();
 }catch(e){
  console.warn('votar:',e);VT.busy=false;
  const denegado=/PERMISSION_DENIED|permission/i.test(String(e&&(e.code||e.message)));
  VT.err=denegado?'No se pudo registrar: este departamento ya votó o la votación se cerró. Si crees que es un error, avisa a la directiva.'
   :'No pudimos confirmar tu voto. Revisa tu conexión e inténtalo de nuevo. Si ya lo habías enviado, el sistema no permite un segundo voto.';
  votarRender();
 }
}
