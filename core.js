/* ===== core.js — CBS4: Firebase, sesión, navegación, helpers y descargas ===== */
const firebaseConfig = {
apiKey: "AIzaSyC1UR2UVH7EbvlRwK1Tw9tnW1JgLQMAF2k",
authDomain: "bosques-del-sur-4.firebaseapp.com",
databaseURL: "https://bosques-del-sur-4-default-rtdb.firebaseio.com",
projectId: "bosques-del-sur-4",
storageBucket: "bosques-del-sur-4.firebasestorage.app",
messagingSenderId: "201777693828",
appId: "1:201777693828:web:59371297fdcc14ef3daed1"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const LOGO_SRC = 'bosques_del_sur_4.png';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ADMINS = [{u:'I.arelluna',p:'Arelluna_123',rol:'Administrador'},{u:'R.figueroa',p:'Figueroa_123',rol:'Tesorera'},{u:'T.diaz',p:'Diaz_123',rol:'Presidenta'}];
const DEFAULT_GC = 40000;
const TOTAL_DEPTOS = 18;
const YEARS = [2018,2019,2020,2021,2022,2023,2024,2025,2026,2027,2028];
let state = {loggedIn:false,isTransparencia:false,currentView:'dashboard',currentYear:new Date().getFullYear(),currentMonth:new Date().getMonth(),theme:'light',connected:false,formulariosSortAsc:false,ventanaMorosidad:'12'};
function defaultData(){return {departamentos:Array.from({length:18},(_,i)=>({id:i+1,numero:String(i+1).padStart(2,'0'),representante:'',contacto:''})),pagos:{},ingresosExtra:[],gastosFijos:{},gastosVariables:[],gastoComunHistorial:[{desde:'2022-01',valor:DEFAULT_GC}],configuracion:{tema:'light'},formularios:[],multas:[]};}
let appData = defaultData();
let firebaseListener = null;
let lastVoucher = null;
let lastDownload = null;
function initFirebase(){
db.ref('.info/connected').on('value', snap => {state.connected = snap.val() === true;const dot=document.getElementById('sync-dot');const txt=document.getElementById('sync-text');if(dot&&txt){dot.className='sync-dot '+(state.connected?'':'off');txt.textContent=state.connected?'En línea':'Sin conexión';}});
firebaseListener = db.ref('cbs4').on('value', snap => {
const val = snap.val();
if(val){appData = {...defaultData(),...val,departamentos:val.departamentos||defaultData().departamentos,gastosFijos:val.gastosFijos||{},gastosVariables:val.gastosVariables||[],ingresosExtra:val.ingresosExtra||[],pagos:val.pagos||{},gastoComunHistorial:val.gastoComunHistorial||[{desde:'2022-01',valor:DEFAULT_GC}],configuracion:val.configuracion||{tema:'light'},formularios:val.formularios||[],multas:val.multas||[]};}
else {db.ref('cbs4').set(appData);}
const overlay=document.getElementById('loading-overlay');
if(overlay && overlay.style.display!=='none'){
overlay.style.display='none';
if(state.loggedIn||state.isTransparencia){showApp();}
else{document.getElementById('login-screen').style.display='flex';renderLoginScreen();}
if(appData.configuracion&&appData.configuracion.tema==='dark'){state.theme='dark';document.documentElement.setAttribute('data-theme','dark');const b=document.getElementById('theme-btn');if(b)b.textContent='☀️';}
} else if(state.loggedIn||state.isTransparencia){renderView();}
});
}
function saveData(){db.ref('cbs4').set(appData).catch(e=>showToast('Error al guardar: '+e.message,'error'));}
function fmt(n){return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);}
function mkKey(y,m){return `${y}-${String(m+1).padStart(2,'0')}`;}
function showToast(msg,type=''){const t=document.getElementById('toast-el');t.textContent=msg;t.className=`toast ${type}`;setTimeout(()=>t.classList.add('show'),10);setTimeout(()=>t.classList.remove('show'),2800);}
function closeModal(){document.getElementById('modal-area').innerHTML='';}
function getGC(anio,mes){const key=mkKey(anio,mes);const hist=(appData.gastoComunHistorial||[{desde:'2022-01',valor:DEFAULT_GC}]).filter(h=>h.desde<=key).sort((a,b)=>b.desde.localeCompare(a.desde));return hist.length>0?hist[0].valor:DEFAULT_GC;}
function toggleTheme(){state.theme=state.theme==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',state.theme);document.getElementById('theme-btn').textContent=state.theme==='dark'?'☀️':'🌙';if(!appData.configuracion)appData.configuracion={};appData.configuracion.tema=state.theme;saveData();}
function formatPeriodo(key){const [y,m]=key.split('-');return `${MESES[parseInt(m)-1]} ${y}`;}
const SESSION_KEY='cbs4_session';const SESSION_DAYS=7;
function saveSession(u){localStorage.setItem(SESSION_KEY,JSON.stringify({usuario:u,ts:Date.now()}));}
function clearSession(){localStorage.removeItem(SESSION_KEY);localStorage.removeItem('cbs4_biometric_enabled');}
function checkSession(){try{const s=JSON.parse(localStorage.getItem(SESSION_KEY));if(!s)return null;const d=(Date.now()-s.ts)/(1000*60*60*24);if(d>SESSION_DAYS){clearSession();return null;}return s.usuario;}catch(e){return null;}}
function isBiometricAvailable(){return window.PublicKeyCredential&&typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable==='function';}
async function biometricAvailable(){if(!isBiometricAvailable())return false;try{return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();}catch(e){return false;}}
async function registerBiometric(u){try{const c=new Uint8Array(32);crypto.getRandomValues(c);const uid=new TextEncoder().encode(u);await navigator.credentials.create({publicKey:{challenge:c,rp:{name:'Bosques del Sur 4',id:location.hostname},user:{id:uid,name:u,displayName:u},pubKeyCredParams:[{alg:-7,type:'public-key'}],authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required'},timeout:60000}});localStorage.setItem('cbs4_biometric_enabled',u);showToast('Huella registrada ✓','success');return true;}catch(e){return false;}}
async function verifyBiometric(){const u=localStorage.getItem('cbs4_biometric_enabled');if(!u)return null;try{const c=new Uint8Array(32);crypto.getRandomValues(c);await navigator.credentials.get({publicKey:{challenge:c,timeout:60000,userVerification:'required',rpId:location.hostname}});return u;}catch(e){return null;}}
async function doLogin(){const u=document.getElementById('usr').value.trim();const p=document.getElementById('pwd').value;if(ADMINS.some(a=>a.u===u&&a.p===p)){saveSession(u);state.loggedIn=true;state.isTransparencia=false;showApp();const ok=await biometricAvailable();const be=localStorage.getItem('cbs4_biometric_enabled');if(ok&&!be)setTimeout(()=>offerBiometric(u),800);}else{document.getElementById('login-err').textContent='Credenciales incorrectas.';}}
function offerBiometric(u){document.getElementById('modal-area').innerHTML=`<div class="modal-overlay open"><div class="modal" style="text-align:center;"><div style="font-size:48px;margin-bottom:12px;">👆</div><div class="modal-title" style="text-align:center;">¿Activar acceso con huella?</div><p style="font-size:13px;color:var(--text3);margin-bottom:20px;">La próxima vez podrás entrar usando tu huella digital.</p><div style="display:flex;gap:10px;justify-content:center;"><button class="btn btn-primary" onclick="activarBiometric('${u}')">👆 Activar huella</button><button class="btn btn-ghost" onclick="closeModal()">Ahora no</button></div></div></div>`;}
async function activarBiometric(u){closeModal();showToast('Escanea tu huella...','');await registerBiometric(u);}
async function loginConHuella(){const u=localStorage.getItem('cbs4_biometric_enabled');if(!u)return;if(!ADMINS.some(a=>a.u===u)){localStorage.removeItem('cbs4_biometric_enabled');renderLoginScreen();showToast('Credenciales actualizadas: usa tu contraseña','error');return;}showToast('Verifica tu identidad...','');const r=await verifyBiometric();if(r){saveSession(r);state.loggedIn=true;state.isTransparencia=false;showApp();showToast('Bienvenido '+r+' ✓','success');}else{showToast('Verificación fallida','error');}}
function enterTransparencia(){state.isTransparencia=true;state.loggedIn=false;state.currentView='reportes';showApp();}
function backToLogin(){state.isTransparencia=false;state.loggedIn=false;document.getElementById('app').style.display='none';document.getElementById('login-screen').style.display='flex';renderLoginScreen();}
function doLogout(){clearSession();backToLogin();}
function showApp(){document.getElementById('login-screen').style.display='none';document.getElementById('app').style.display='flex';document.getElementById('transp-banner-el').style.display=state.isTransparencia?'flex':'none';const c=(ADMINS.find(a=>a.u===checkSession())||{}).rol||'Admin';document.getElementById('badge-el').className=state.isTransparencia?'badge-view':'badge-admin';document.getElementById('badge-el').textContent=state.isTransparencia?'Solo Lectura':c;document.getElementById('logout-btn').style.display=state.isTransparencia?'none':'block';const ys=document.getElementById('year-sel');ys.innerHTML=YEARS.map(y=>`<option value="${y}" ${y===state.currentYear?'selected':''}>${y}</option>`).join('');renderSidebar();renderBNav();renderView();}
const VIEWS_ADMIN=[{id:'dashboard',icon:'🏠',label:'Dashboard'},{id:'gastoComun',icon:'💳',label:'Gasto Común'},{id:'recordatorios',icon:'💬',label:'Recordatorios'},{id:'departamentos',icon:'🏘',label:'Departamentos'},{id:'ingresosExtra',icon:'➕',label:'Ingresos Extra'},{id:'egresos',icon:'💸',label:'Gastos'},{id:'reportes',icon:'📊',label:'Transparencia'},{id:'config',icon:'⚙️',label:'Configuración'},{id:'formularios',icon:'📝',label:'Formulario'},{id:'multas',icon:'⚖️',label:'Multas'}];
const VIEWS_TRANSP=[{id:'reportes',icon:'📊',label:'Reporte'}];
function getViews(){return state.isTransparencia?VIEWS_TRANSP:VIEWS_ADMIN;}
function renderSidebar(){try{document.getElementById('sidebar').innerHTML='<div class="nav-label">Menú</div>'+getViews().map(v=>`<div class="nav-item ${state.currentView===v.id?'active':''}" onclick="goTo('${v.id}')">${v.icon} ${v.label}</div>`).join('');}catch(e){console.error(e);}}
function renderBNav(){renderDrawerNav();}
function renderDrawerNav(){try{const navEl=document.getElementById('drawer-nav');if(!navEl)return;const isAdmin=!state.isTransparencia;let h='';
if(isAdmin){h+='<div class="drawer-nav-label">Principal</div>';h+=navDrawerItem('dashboard','🏠','Dashboard');h+=navDrawerItem('gastoComun','💳','Gasto Común');h+=navDrawerItem('recordatorios','💬','Recordatorios');h+=navDrawerItem('departamentos','🏘','Departamentos');h+='<div class="drawer-nav-sep"></div><div class="drawer-nav-label">Finanzas</div>';h+=navDrawerItem('ingresosExtra','➕','Ingresos Extra');h+=navDrawerItem('egresos','💸','Gastos');h+='<div class="drawer-nav-sep"></div><div class="drawer-nav-label">Reportes y Config</div>';h+=navDrawerItem('reportes','📊','Transparencia');h+=navDrawerItem('config','⚙️','Configuración');h+=navDrawerItem('formularios','📝','Formulario');h+=navDrawerItem('multas','⚖️','Multas');}
else{h+='<div class="drawer-nav-label">Vista Transparencia</div>';h+=navDrawerItem('reportes','📊','Reporte');}
navEl.innerHTML=h;const f=document.getElementById('drawer-footer');
if(f){if(isAdmin)f.innerHTML=`<div class="drawer-footer-info">Sesión activa · Admin</div><button class="drawer-logout" onclick="doLogout();closeDrawer()">Cerrar Sesión</button>`;else f.innerHTML=`<div class="drawer-footer-info">Vista Residentes · Solo lectura</div><button class="drawer-logout" style="background:var(--accent-deep);" onclick="backToLogin();closeDrawer()">← Volver al Login</button>`;}
const s=document.getElementById('drawer-sub');if(s)s.textContent=isAdmin?'Panel de Administración':'Vista Transparencia';}catch(e){console.error(e);}}
function navDrawerItem(id,icon,label){return `<div class="drawer-nav-item ${state.currentView===id?'active':''}" onclick="goTo('${id}');closeDrawer()"><span class="drawer-nav-icon">${icon}</span>${label}</div>`;}
function openDrawer(){try{const o=document.getElementById('drawer-overlay');const d=document.getElementById('drawer');const l=document.getElementById('drawer-logo');if(!o||!d)return;if(l)l.src=LOGO_SRC;renderDrawerNav();o.classList.add('open');d.classList.add('open');document.body.style.overflow='hidden';}catch(e){console.error(e);}}
function closeDrawer(){const o=document.getElementById('drawer-overlay');const d=document.getElementById('drawer');if(o)o.classList.remove('open');if(d)d.classList.remove('open');document.body.style.overflow='';}
function goTo(v){state.currentView=v;renderSidebar();renderBNav();renderView();window.scrollTo(0,0);setTimeout(()=>{window.scrollTo(0,0);},100);}
function changeYear(y){state.currentYear=parseInt(y);renderView();}
function setMonth(m){state.currentMonth=m;renderView();}
function monthTabs(){return '<div class="month-tabs">'+MESES.map((m,i)=>`<div class="month-tab ${i===state.currentMonth?'active':''}" onclick="setMonth(${i})">${m.substring(0,3)}</div>`).join('')+'</div>';}
let charts={};
function killCharts(){Object.values(charts).forEach(c=>{try{c.destroy();}catch(e){}});charts={};}
function animateCounters(){try{document.querySelectorAll('#main-content .stat-value').forEach(el=>{if(el.children.length)return;const o=el.textContent.trim();const d=o.replace(/[^\d]/g,'');if(!d)return;const t=parseInt(d,10);if(isNaN(t)||t<=0)return;const neg=o.indexOf('-')!==-1;const dur=800;const st=performance.now();function fr(t2){const p=Math.min(1,(t2-st)/dur);const e=1-Math.pow(1-p,3);const v=Math.round(t*e);el.textContent=(neg?'-':'')+fmt(v);if(p<1){requestAnimationFrame(fr);}else{el.textContent=o;}}requestAnimationFrame(fr);});}catch(e){}}
function initParticles(){try{const c=document.getElementById('bg-particles');if(!c)return;const ctx=c.getContext('2d');if(!ctx)return;if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;let W,H,pts=[];function rs(){W=c.width=window.innerWidth;H=c.height=window.innerHeight;const n=Math.min(40,Math.floor(W/35));pts=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,r:Math.random()*1.2+.4,c:Math.random()<.5?'8,145,178':'45,212,191'}));}rs();window.addEventListener('resize',rs);(function loop(){ctx.clearRect(0,0,W,H);const dk=document.documentElement.getAttribute('data-theme')==='dark';const b=dk?.35:.2;for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;}for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const a=pts[i],b=pts[j],dx=a.x-b.x,dy=a.y-b.y,d=dx*dx+dy*dy;if(d<120*120){const al=(1-Math.sqrt(d)/120)*b*.4;ctx.strokeStyle='rgba(8,145,178,'+al.toFixed(3)+')';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}for(const p of pts){ctx.fillStyle='rgba('+p.c+','+(b*.6).toFixed(3)+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.283);ctx.fill();}requestAnimationFrame(loop);})();}catch(e){}}
function renderView(){killCharts();const el=document.getElementById('main-content');if(!el)return;const v=state.currentView;try{
if(v==='dashboard')el.innerHTML=vDashboard();else if(v==='gastoComun')el.innerHTML=vGastoComun();else if(v==='recordatorios')el.innerHTML=vRecordatorios();else if(v==='departamentos')el.innerHTML=vDepartamentos();else if(v==='ingresosExtra')el.innerHTML=vIngresosExtra();else if(v==='egresos')el.innerHTML=vEgresos();else if(v==='reportes')el.innerHTML=vReportes();else if(v==='config')el.innerHTML=vConfig();else if(v==='formularios')el.innerHTML=vFormularios();else if(v==='multas')el.innerHTML=vMultas();else el.innerHTML='<div style="padding:20px;">Vista no encontrada</div>';
}catch(e){console.error(e);el.innerHTML='<div style="padding:20px;color:var(--danger)">Error al cargar la vista. Recarga la página.</div>';}
setTimeout(drawCharts,100);setTimeout(animateCounters,60);}
function calcularBalanceGeneral(){let t=0;for(let a=2018;a<=2028;a++){for(let m=0;m<12;m++){t+=balanceMes(a,m);}}return t;}
function balanceMes(a,m){const k=mkKey(a,m);const gc=getGC(a,m);const p=appData.pagos[k]||{};const pg=Object.values(p).filter(Boolean).length;const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===a&&g.mes===m).reduce((s,g)=>s+g.monto,0);const mp=(appData.multas||[]).filter(x=>x.anio===a&&x.mes===m&&x.estado==='Pagada').reduce((s,x)=>s+x.monto,0);const fm=(appData.gastosFijos&&appData.gastosFijos[k])?appData.gastosFijos[k]:[];const f=fm.reduce((s,g)=>s+g.monto,0);const va=(appData.gastosVariables||[]).filter(g=>g.anio===a&&g.mes===m).reduce((s,g)=>s+g.monto,0);return (pg*gc+ex+mp)-(f+va);}
/* ===== DESCARGA DE IMÁGENES (corrección móvil: Blob + objectURL) ===== */
function dataUrlToBlob(d){const a=d.split(',');const m=(a[0].match(/:(.*?);/)||[])[1]||'image/jpeg';const b=atob(a[1]);let n=b.length;const u=new Uint8Array(n);while(n--){u[n]=b.charCodeAt(n);}return new Blob([u],{type:m});}
function dataUrlToFileImg(d,f){const a=d.split(',');const m=(a[0].match(/:(.*?);/)||[])[1]||'image/jpeg';const b=atob(a[1]);let n=b.length;const u=new Uint8Array(n);while(n--){u[n]=b.charCodeAt(n);}return new File([u],f,{type:m});}
function descargarImagen(url,fname){
  const isMobile=/iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if(isMobile){
    try{
      const blob=dataUrlToBlob(url);
      const file=new File([blob],fname||'imagen.jpg',{type:blob.type});
      if(navigator.canShare&&navigator.canShare({files:[file]})){
        navigator.share({files:[file]}).catch(()=>{});
        showToast('Elige "Guardar imagen" para guardarla ✓','success');
        return;
      }
    }catch(e){}
    /* Sin share API: mostramos la imagen en una capa DENTRO de la app (sin navegar) para poder mantenerla presionada y guardarla, y cerrar sin perder el contexto de la PWA */
    mostrarImagenParaGuardar(url);
    return;
  }
  try{const blob=dataUrlToBlob(url);const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=fname||'imagen.jpg';document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(u),5000);showToast('Descargando imagen...','success');}catch(e){window.open(url,'_blank');}
}
function mostrarImagenParaGuardar(url){
  const old=document.getElementById('save-img-overlay');if(old)old.remove();
  const ov=document.createElement('div');
  ov.id='save-img-overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
  ov.innerHTML=`<div style="color:#fff;font-size:13px;text-align:center;margin-bottom:14px;">📌 Mantén presionada la imagen y elige "Guardar imagen"</div><img src="${url}" style="max-width:100%;max-height:70vh;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.5);"><button style="margin-top:22px;padding:12px 32px;border-radius:8px;border:none;background:#0E7490;color:#fff;font-weight:600;font-size:14px;" onclick="document.getElementById('save-img-overlay').remove()">Cerrar</button>`;
  document.body.appendChild(ov);
}
function descargarUltimo(){if(lastDownload)descargarImagen(lastDownload.url,lastDownload.filename);}
/* ===== WHATSAPP ===== */
function abrirWhatsApp(tel,texto){let n=(tel||'').replace(/\D/g,'');if(n&&n.length===9)n='56'+n;const u=n?`https://wa.me/${n}?text=${encodeURIComponent(texto)}`:`https://wa.me/?text=${encodeURIComponent(texto)}`;window.open(u,'_blank');}
function compartirPorWhatsApp(img,texto,tel,fname){try{const f=dataUrlToFileImg(img,fname||'Comprobante_CBS4.jpg');if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],text:texto}).catch(()=>{});return;}}catch(e){}descargarImagen(img,fname);abrirWhatsApp(tel,texto);}
function compartirUltimoVoucher(){if(!lastVoucher)return;const lv=lastVoucher;let t='';let tel=(lv.depto&&lv.depto.contacto)||'';
if(lv.tipo==='pago'){t=`✅ CONDOMINIO BOSQUES DEL SUR 4\nLe confirmamos la recepción de su pago del Gasto Común de ${lv.mesStr} por ${fmt(lv.gc)}.\n¡Gracias por estar al día! 🙌`;}
else if(lv.tipo==='multa'){t=`⚖️ CONDOMINIO BOSQUES DEL SUR 4\nNotificación de multa — Depto ${lv.depto.numero||''}\nRegla: ${lv.multa.regla}\nMonto: ${fmt(lv.multa.monto)}\nFecha: ${lv.multa.fecha_creacion}\nPara regularizar transfiera a:\nRomina Gabriela Figueroa Acevedo\nMercado Pago — Cuenta Vista\nN° 1088283442`;}
else if(lv.tipo==='estado'){t=lv.texto;}
compartirPorWhatsApp(lv.img,t,tel,'Comprobante_CBS4.jpg');}
/* ===== MOROSIDAD ===== */
function clavesVentana(t){const now=new Date();const k=[];if(t==='12'){for(let i=0;i<12;i++){const d=new Date(now.getFullYear(),now.getMonth()-i,1);k.push(mkKey(d.getFullYear(),d.getMonth()));}k.reverse();}else if(t==='anio'){for(let m=0;m<=now.getMonth();m++){k.push(mkKey(now.getFullYear(),m));}}else{for(let y=2018;y<=now.getFullYear();y++){const l=(y===now.getFullYear())?now.getMonth():11;for(let m=0;m<=l;m++){k.push(mkKey(y,m));}}}return k;}
function calcularMorosidad(){const t=state.ventanaMorosidad||'12';const keys=clavesVentana(t);const out=[];(appData.departamentos||[]).forEach(dep=>{const gcM=[];keys.forEach(k=>{if((appData.pagos[k]||{})[dep.id]!==true){const a=parseInt(k.substring(0,4));const mi=parseInt(k.substring(5,7))-1;gcM.push({key:k,label:formatPeriodo(k),monto:getGC(a,mi)});}});const mul=(appData.multas||[]).filter(m=>{if(m.unidad_id!==dep.id)return false;if(m.estado==='Pagada'||m.estado==='Anulada')return false;const mk=m.anio+'-'+String(m.mes+1).padStart(2,'0');return keys.includes(mk);});const tGC=gcM.reduce((s,g)=>s+g.monto,0);const tM=mul.reduce((s,m)=>s+m.monto,0);const tot=tGC+tM;if(tot>0)out.push({dep,gcMeses:gcM,multas:mul,total:tot});});out.sort((a,b)=>b.total-a.total);return out;}
function textoMoroso(m){let t=`Hola ${m.dep.representante||''} 👋\nCONDOMINIO BOSQUES DEL SUR 4\nLe enviamos su estado de cuenta pendiente:\n`;if(m.gcMeses.length){t+='\nGASTO COMÚN:\n'+m.gcMeses.map(g=>`• ${g.label}: ${fmt(g.monto)}`).join('\n')+'\n';}if(m.multas.length){t+='\nMULTAS:\n'+m.multas.map(x=>`• ${x.fecha_creacion} · ${x.regla}: ${fmt(x.monto)}`).join('\n')+'\n';}t+=`\nTOTAL PENDIENTE: ${fmt(m.total)}\n\nDatos de transferencia:\nRomina Gabriela Figueroa Acevedo\nMercado Pago — Cuenta Vista\nN° 1088283442`;return t;}
function recordarMorosoWhatsApp(id){const m=calcularMorosidad().find(x=>x.dep.id===id);if(!m)return;abrirWhatsApp(m.dep.contacto||'',textoMoroso(m));}
function recordarMesActual(id){const {currentYear,currentMonth}=state;const d=(appData.departamentos||[]).find(x=>x.id===id);if(!d)return;const gc=getGC(currentYear,currentMonth);const t=`Hola ${d.representante||''} 👋\nCONDOMINIO BOSQUES DEL SUR 4\nLe recordamos que el Gasto Común de ${MESES[currentMonth]} ${currentYear} (${fmt(gc)}) se encuentra pendiente.\n\nDatos de transferencia:\nRomina Gabriela Figueroa Acevedo\nMercado Pago — Cuenta Vista\nN° 1088283442`;abrirWhatsApp(d.contacto||'',t);}