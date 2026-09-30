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
const LOGO_VOUCHER_SRC = 'bosques_del_sur_4_voucher.png';
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ADMINS = [{u:'I.arelluna',p:'Arelluna_123',rol:'Administrador'},{u:'R.figueroa',p:'Figueroa_123',rol:'Tesorera'},{u:'T.diaz',p:'Diaz_123',rol:'Presidenta'}];
/* ===== CATEGORIAS Y CONCEPTOS DE GASTO =====
   Los gastos se escribian a mano y el mismo concepto terminaba con cuatro
   ortografias distintas ("Pago de servicios", "pago de servicios", "Pgo de
   servicios", "Pago de servicio"), lo que hace imposible comparar contra un
   presupuesto. La lista de abajo se armo a partir de los gastos reales ya
   registrados, agrupando esas variantes.
   'Otro...' deja escribir libre y elegir la categoria a mano.
   Los gastos antiguos no tienen categoria: se muestran como 'Sin clasificar'. */
const CATEGORIAS_GASTO=['Agua','Electricidad','Telecomunicaciones','Aseo','Jardinería','Mantención','Administración','Otros'];
const SIN_CATEGORIA='Sin clasificar';
const CONCEPTOS_GASTO=[
{label:'Prorrateo de agua',            cat:'Agua'},
{label:'Electricidad — bombas',        cat:'Electricidad'},
{label:'Electricidad — pasillos',      cat:'Electricidad'},
{label:'Movistar (internet/cámaras)',  cat:'Telecomunicaciones'},
{label:'Servicio de aseo',             cat:'Aseo'},
{label:'Bolsas de basura',             cat:'Aseo'},
{label:'Productos de aseo',            cat:'Aseo'},
{label:'Pastillas de cloro',           cat:'Aseo'},
{label:'Corte de pasto',               cat:'Jardinería'},
{label:'Poda de arbustos',             cat:'Jardinería'},
{label:'Mantención bomba de agua',     cat:'Mantención'},
{label:'Chapas y cerraduras',          cat:'Mantención'},
{label:'Herramientas',                 cat:'Mantención'},
{label:'Aplicación',                   cat:'Administración'}
];
/* Lista que ve el usuario: los conceptos base de arriba MAS los que el mismo
   agrega desde el formulario. Los propios viven en cbs4/conceptosGasto para que
   los tres administradores compartan la misma lista. */
function conceptosDisponibles(){
const propios=comoLista(appData.conceptosGasto).filter(c=>c&&c.label);
const base=CONCEPTOS_GASTO.slice();
propios.forEach(c=>{if(!base.some(b=>b.label===c.label))base.push({label:c.label,cat:c.cat||'Otros',propio:true});});
return base;
}
function categoriaDeConcepto(label){const c=conceptosDisponibles().find(x=>x.label===label);return c?c.cat:'';}
/* Agrega un concepto nuevo a la lista compartida (si no existe ya) */
function agregarConcepto(label,cat){
label=(label||'').trim();
if(!label)return Promise.resolve(false);
if(conceptosDisponibles().some(c=>c.label.toLowerCase()===label.toLowerCase()))return Promise.resolve(false);
if(!appData.conceptosGasto)appData.conceptosGasto=[];
appData.conceptosGasto=comoLista(appData.conceptosGasto);
appData.conceptosGasto.push({label:label,cat:cat||'Otros'});
return savePath('conceptosGasto',appData.conceptosGasto).then(()=>true);
}
function eliminarConcepto(label){
appData.conceptosGasto=comoLista(appData.conceptosGasto).filter(c=>c&&c.label!==label);
return savePath('conceptosGasto',appData.conceptosGasto);
}
function categoriaDeGasto(g){return (g&&g.categoria)?g.categoria:SIN_CATEGORIA;}

/* Pistas para SUGERIR una categoria a partir del texto del gasto. Solo sugieren:
   la decision final es del usuario en la pantalla de clasificacion. El orden
   importa — gana la primera que calce. */
const PISTAS_CATEGORIA=[
['Agua',              ['agua','prorrateo']],
['Telecomunicaciones',['movistar','internet','telefon','camara','wifi','fibra']],
['Electricidad',      ['luz','enel','electric','ampolleta','lampara','alumbrado']],
['Jardinería',        ['pasto','cesped','arbusto','arbol','jardin','poda','planta','maleza','riego']],
['Mantención',        ['bomba','motor','chapa','cerradura','puerta','porton','reparacion','arreglo','herramienta','peldano','impermeabiliz','pozo','by pass','bypass','manguera','pastelon','pintura','techo','soldadura','cambio']],
['Aseo',              ['aseo','limpieza','basura','bolsa','cloro','mopa','escoba','pala','detergente','servicio','sevicio','desinfec']],
['Administración',    ['aplicacion','app','hosting','dominio','aguinaldo','colecta','rifa','notaria','tramite','banco','comision']]
];
/* Texto normalizado: minusculas, sin tildes ni puntuacion. Sirve para agrupar
   las variantes de escritura del mismo gasto y para buscar las pistas. */
function normalizarTexto(t){
return String(t||'').toLowerCase()
.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
.replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
}
function sugerirCategoria(desc){
const t=normalizarTexto(desc);
if(!t)return '';
const c=conceptosDisponibles().find(x=>normalizarTexto(x.label)===t);
if(c)return c.cat;
for(const [cat,claves] of PISTAS_CATEGORIA){ if(claves.some(k=>t.indexOf(k)!==-1))return cat; }
return '';
}
/* Recorre gastos fijos y variables y arma los grupos SIN clasificar.
   Agrupa por texto normalizado: no adivina que "Pgo de servicios" y "Pago de
   servicios" son lo mismo, los deja como dos filas. Es mas predecible que
   agrupar por similitud, y ordenados por monto los grandes quedan arriba. */
function gruposSinClasificar(){
const g={};
const sumar=(reg,ruta)=>{
if(!reg||typeof reg!=='object')return;
if(reg.categoria)return;
if(!reg.descripcion)return;
const k=normalizarTexto(reg.descripcion);
if(!k)return;
if(!g[k])g[k]={clave:k,ejemplo:String(reg.descripcion),n:0,monto:0,sugerida:sugerirCategoria(reg.descripcion),rutas:new Set()};
g[k].n++; g[k].monto+=(Number(reg.monto)||0); g[k].rutas.add(ruta);
};
const gf=appData.gastosFijos||{};
Object.keys(gf).forEach(k=>comoLista(gf[k]).forEach(r=>sumar(r,'gastosFijos/'+k)));
comoLista(appData.gastosVariables).forEach(r=>sumar(r,'gastosVariables'));
return Object.values(g).sort((a,b)=>b.monto-a.monto);
}
/* <select> de conceptos + opcion libre. 'pre' es el prefijo de los ids del formulario. */
function selectConceptos(pre,sel){
return `<select class="fi" id="${pre}-concepto" onchange="onConceptoElegido('${pre}')">`
+`<option value="">— Elegir gasto —</option>`
+conceptosDisponibles().map(c=>`<option value="${c.label}" ${sel===c.label?'selected':''}>${c.label}</option>`).join('')
+`<option value="__otro__" ${sel==='__otro__'?'selected':''}>Otro… (escribir)</option></select>`;
}
function selectCategorias(pre,sel){
return `<select class="fi" id="${pre}-cat">`
+CATEGORIAS_GASTO.map(c=>`<option value="${c}" ${sel===c?'selected':''}>${c}</option>`).join('')
+`</select>`;
}
/* Al elegir un concepto de la lista se completa la categoria sola y se esconde
   el campo libre; con 'Otro...' pasa lo contrario. */
function onConceptoElegido(pre){
const sel=document.getElementById(pre+'-concepto');
const libre=document.getElementById(pre+'-libre');
const cat=document.getElementById(pre+'-cat');
const catWrap=document.getElementById(pre+'-cat-wrap');
if(!sel)return;
const otro=sel.value==='__otro__';
if(libre)libre.style.display=otro?'block':'none';
if(catWrap)catWrap.style.display=otro?'block':'none';
if(cat&&!otro&&sel.value){const c=categoriaDeConcepto(sel.value);if(c)cat.value=c;}
}
/* Devuelve {descripcion, categoria} leyendo el formulario */
function leerConcepto(pre){
const sel=document.getElementById(pre+'-concepto');
const libre=document.getElementById(pre+'-libre-input');
const cat=document.getElementById(pre+'-cat');
if(!sel)return {descripcion:'',categoria:''};
if(sel.value==='__otro__'){
const guardar=document.getElementById(pre+'-recordar');
return {descripcion:(libre?libre.value.trim():''),categoria:(cat?cat.value:'Otros'),recordar:!!(guardar&&guardar.checked)};
}
return {descripcion:sel.value,categoria:categoriaDeConcepto(sel.value)||'Otros'};
}
const DEFAULT_GC = 40000;
const TOTAL_DEPTOS = 18;
const YEARS = [2018,2019,2020,2021,2022,2023,2024,2025,2026,2027,2028];
let state = {loggedIn:false,isTransparencia:false,currentView:'dashboard',currentYear:new Date().getFullYear(),currentMonth:new Date().getMonth(),theme:'light',connected:false,formulariosSortAsc:false,ventanaMorosidad:'12'};
function defaultData(){return {departamentos:Array.from({length:18},(_,i)=>({id:i+1,numero:String(i+1).padStart(2,'0'),representante:'',contacto:''})),pagos:{},ingresosExtra:[],gastosFijos:{},gastosVariables:[],gastoComunHistorial:[{desde:'2022-01',valor:DEFAULT_GC}],configuracion:{tema:'light'},formularios:[],multas:[],conceptosGasto:[],mantenciones:[],mantencionesHechas:[],proveedores:[],rubrosProveedor:[],certificados:[],novedades:[]};}
let appData = defaultData();
let firebaseListener = null;
let lastVoucher = null;
let lastDownload = null;
/* Firebase Realtime Database NO guarda arrays con huecos: si un array queda con
   indices no consecutivos (por ejemplo tras borrar un elemento del medio), lo
   devuelve como objeto {"0":..,"2":..}. Toda la app usa filter/map/forEach sobre
   estas listas, asi que un objeto rompia la vista completa.
   comoLista() normaliza al recibir: objeto -> array, y descarta huecos nulos. */
function comoLista(v){
if(Array.isArray(v))return v.filter(x=>x!==null&&x!==undefined);
if(v&&typeof v==='object'){
const ks=Object.keys(v).sort((a,b)=>{const na=Number(a),nb=Number(b);return (isNaN(na)||isNaN(nb))?String(a).localeCompare(String(b)):na-nb;});
return ks.map(k=>v[k]).filter(x=>x!==null&&x!==undefined);
}
return [];
}
/* gastosFijos es un objeto de periodos "YYYY-MM"; cada periodo contiene una lista.
   Se ignoran claves que no sean un periodo valido y elementos que no sean registros:
   en la base hay restos de pruebas antiguas (por ejemplo una clave "0" cuyo valor
   es un gasto suelto en vez de una lista). No se borra nada, solo se ignora al leer. */
function normalizarGastosFijos(v){
const out={};
if(v&&typeof v==='object')Object.keys(v).forEach(k=>{
if(!/^\d{4}-\d{2}$/.test(k))return;
const l=comoLista(v[k]).filter(g=>g&&typeof g==='object'&&!Array.isArray(g));
if(l.length)out[k]=l;
});
return out;
}
function initFirebase(){
db.ref('.info/connected').on('value', snap => {state.connected = snap.val() === true;const dot=document.getElementById('sync-dot');const txt=document.getElementById('sync-text');if(dot&&txt){dot.className='sync-dot '+(state.connected?'':'off');txt.textContent=state.connected?'En línea':'Sin conexión';}});
firebaseListener = db.ref('cbs4').on('value', snap => {
const val = snap.val();
if(val){
const deps=comoLista(val.departamentos);
const hist=comoLista(val.gastoComunHistorial);
appData = {...defaultData(),...val,
departamentos: deps.length?deps:defaultData().departamentos,
gastosFijos: normalizarGastosFijos(val.gastosFijos),
gastosVariables: comoLista(val.gastosVariables),
ingresosExtra: comoLista(val.ingresosExtra),
pagos: val.pagos||{},
gastoComunHistorial: hist.length?hist:[{desde:'2022-01',valor:DEFAULT_GC}],
configuracion: val.configuracion||{tema:'light'},
formularios: comoLista(val.formularios),
multas: comoLista(val.multas),
conceptosGasto: comoLista(val.conceptosGasto),
mantenciones: comoLista(val.mantenciones),
mantencionesHechas: comoLista(val.mantencionesHechas),
proveedores: comoListaConId(val.proveedores),
rubrosProveedor: comoLista(val.rubrosProveedor),
certificados: comoListaConId(val.certificados),
novedades: comoListaConId(val.novedades)};
/* Copia profunda de lo que hay REALMENTE en Firebase: la auditoria la compara
   contra lo que se va a escribir (appData ya viene mutado por quien llama). */
if(typeof guardarInstantaneaLocal==='function')guardarInstantaneaLocal(val);
if(typeof programarRespaldoAutomatico==='function')programarRespaldoAutomatico();
if(typeof novRefrescarAlerta==='function')novRefrescarAlerta(false);
}
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
/* Escribe SOLO una rama de cbs4 en lugar de reemplazar el arbol completo.
   Antes cualquier accion hacia set() sobre 'cbs4' entero: si dos administradores
   trabajaban a la vez, el ultimo en guardar pisaba los cambios del otro sin aviso.
   saveData() se conserva para el arranque (initFirebase) y para cambios que
   afecten a mas de una rama. */
function savePath(ruta,valor){
/* Registro de cambios: jamas debe impedir ni retrasar el guardado. */
try{if(typeof auditarCambio==='function')auditarCambio(ruta,valor);}catch(e){console.warn('auditoria:',e);}
return db.ref('cbs4/'+ruta).set(valor===undefined?null:valor).catch(e=>showToast('Error al guardar: '+e.message,'error'));
}

/* ===== ADJUNTOS (comprobantes y evidencias) =====
   Los archivos NO viven dentro de 'cbs4': viven en la rama hermana 'cbs4_adjuntos',
   que NO esta bajo el listener on('value'). Asi el arbol que baja cada dispositivo
   en cada cambio deja de arrastrar todas las imagenes (eran ~98% del trafico).
   En 'cbs4' solo queda una referencia de texto: archivoRef / evidenciaRef (~40 bytes).

   RETROCOMPATIBILIDAD: los registros antiguos guardan el archivo completo en
   'archivo' / 'evidencia_url'. Se siguen leyendo sin migrar; obtenerAdjuntoDe()
   resuelve ambos formatos. La migracion es opcional y se lanza desde Configuracion. */
const ADJ_PATH='cbs4_adjuntos';
const _adjCache={};
function nuevoAdjuntoId(){return 'adj_'+Date.now()+'_'+Math.random().toString(36).slice(2,8);}
/* Sube un archivo {name,type,data} y devuelve su id */
function subirAdjunto(d){
const id=nuevoAdjuntoId();
return db.ref(ADJ_PATH+'/'+id).set(d).then(()=>{_adjCache[id]=d;return id;});
}
/* Lo trae solo cuando alguien lo pide; queda cacheado en memoria para esta sesion */
function cargarAdjunto(id){
if(!id)return Promise.resolve(null);
if(_adjCache[id])return Promise.resolve(_adjCache[id]);
return db.ref(ADJ_PATH+'/'+id).once('value').then(sn=>{const v=sn.val();if(v)_adjCache[id]=v;return v;})
.catch(e=>{showToast('No se pudo cargar el comprobante: '+e.message,'error');return null;});
}
function borrarAdjunto(id){
if(!id)return Promise.resolve();
delete _adjCache[id];
return db.ref(ADJ_PATH+'/'+id).remove().catch(()=>{});
}
/* Devuelve el archivo de un registro, venga en formato antiguo o nuevo */
function obtenerAdjuntoDe(reg,campoViejo,campoRef){
if(!reg)return Promise.resolve(null);
if(reg[campoViejo])return Promise.resolve(reg[campoViejo]);
if(reg[campoRef])return cargarAdjunto(reg[campoRef]);
return Promise.resolve(null);
}
function obtenerAdjunto(reg){return obtenerAdjuntoDe(reg,'archivo','archivoRef');}
function obtenerEvidencia(mu){return obtenerAdjuntoDe(mu,'evidencia_url','evidenciaRef');}
function tieneAdjunto(reg){return !!(reg&&(reg.archivo||reg.archivoRef));}
function tieneEvidencia(mu){return !!(mu&&(mu.evidencia_url||mu.evidenciaRef));}
function nombreAdjunto(reg){return (reg&&(reg.archivoNombre||(reg.archivo&&reg.archivo.name)))||'Comprobante';}

/* ===== RAMAS OBSOLETAS =====
   Restos de una version anterior de la app que quedaron dentro de 'cbs4'.
   Ningun archivo del proyecto las lee (verificado por grep: 0 referencias), pero
   como el listener on('value') baja el nodo completo, viajan a cada dispositivo
   en cada cambio. La rama 'variables' llegaba a pesar 2,5 MB por una foto sin
   comprimir de un registro de prueba.
   Solo se borran desde Configuracion, con confirmacion explicita. */
const RAMAS_OBSOLETAS=['variables','deptos','fijos','gcHist','cfg'];
function ramasObsoletasPresentes(){
return RAMAS_OBSOLETAS
.filter(r=>appData[r]!==undefined&&appData[r]!==null)
.map(r=>{let b=0;try{b=JSON.stringify(appData[r]).length;}catch(e){}return {rama:r,bytes:b};});
}
/* Claves de gastosFijos que no son un periodo "YYYY-MM" (basura de pruebas viejas).
   Se consultan a Firebase porque appData ya viene normalizado sin ellas. */
function clavesGastosFijosInvalidas(){
return db.ref('cbs4/gastosFijos').once('value')
.then(sn=>Object.keys(sn.val()||{}).filter(k=>!/^\d{4}-\d{2}$/.test(k)))
.catch(()=>[]);
}

/* Adjuntos que quedaron en cbs4_adjuntos sin que ningun registro los apunte.
   Se producen si una migracion se interrumpe despues de subir un archivo pero
   antes de guardar su referencia: al reintentar, ese archivo se sube de nuevo y
   la copia anterior queda colgando. No hacen dano (no se descargan nunca) pero
   ocupan espacio, asi que se ofrecen para eliminar junto con la limpieza.
   Se listan por REST con shallow=true para traer solo los ids, no las imagenes. */
function adjuntosHuerfanos(){
const base=(typeof firebaseConfig!=='undefined'&&firebaseConfig.databaseURL)?firebaseConfig.databaseURL.replace(/\/$/,''):null;
if(!base)return Promise.resolve([]);
return Promise.all([
fetch(base+'/'+ADJ_PATH+'.json?shallow=true').then(r=>r.ok?r.json():null).catch(()=>null),
db.ref('cbs4').once('value').then(sn=>sn.val()).catch(()=>null)
]).then(([ids,cbs4])=>{
if(!ids)return [];
const usados=new Set();
(function buscar(o){
if(!o||typeof o!=='object')return;
Object.keys(o).forEach(k=>{
if((k==='archivoRef'||k==='evidenciaRef')&&typeof o[k]==='string')usados.add(o[k]);
else buscar(o[k]);
});
})(cbs4||{});
return Object.keys(ids).filter(id=>!usados.has(id));
}).catch(()=>[]);
}
/* Escapa texto antes de meterlo en innerHTML. La app nunca lo hacia porque todo lo
   escribian los administradores; pero Novedades recibe texto de un formulario
   externo, y ahi un '<script>' o '<img onerror=...>' se ejecutaria en el navegador
   de quien abra la vista. Todo dato que no escribio un administrador pasa por aqui. */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
/* Como comoLista(), pero conserva la CLAVE de Firebase como id cuando el registro
   no trae uno propio (los registros que crea un script externo con push() no lo traen). */
function comoListaConId(v){
if(!v||typeof v!=='object')return [];
const ent=Array.isArray(v)?v.map((r,i)=>[String(i),r]):Object.entries(v);
return ent.filter(([k,r])=>r&&typeof r==='object')
 .map(([k,r])=>(r.id===undefined||r.id===null)?{...r,id:k}:r);
}
function fmt(n){return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(n);}
function mkKey(y,m){return `${y}-${String(m+1).padStart(2,'0')}`;}
function showToast(msg,type=''){const t=document.getElementById('toast-el');t.textContent=msg;t.className=`toast ${type}`;setTimeout(()=>t.classList.add('show'),10);setTimeout(()=>t.classList.remove('show'),2800);}
function closeModal(){document.getElementById('modal-area').innerHTML='';}
function getGC(anio,mes){const key=mkKey(anio,mes);const hist=(appData.gastoComunHistorial||[{desde:'2022-01',valor:DEFAULT_GC}]).filter(h=>h.desde<=key).sort((a,b)=>b.desde.localeCompare(a.desde));return hist.length>0?hist[0].valor:DEFAULT_GC;}
function toggleTheme(){state.theme=state.theme==='light'?'dark':'light';document.documentElement.setAttribute('data-theme',state.theme);document.getElementById('theme-btn').textContent=state.theme==='dark'?'☀️':'🌙';if(!appData.configuracion)appData.configuracion={};appData.configuracion.tema=state.theme;savePath('configuracion',appData.configuracion);}
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
function showApp(){document.getElementById('login-screen').style.display='none';document.getElementById('app').style.display='flex';document.getElementById('transp-banner-el').style.display=state.isTransparencia?'flex':'none';const c=(ADMINS.find(a=>a.u===checkSession())||{}).rol||'Admin';document.getElementById('badge-el').className=state.isTransparencia?'badge-view':'badge-admin';document.getElementById('badge-el').textContent=state.isTransparencia?'Solo Lectura':c;document.getElementById('logout-btn').style.display=state.isTransparencia?'none':'block';const ys=document.getElementById('year-sel');ys.innerHTML=YEARS.map(y=>`<option value="${y}" ${y===state.currentYear?'selected':''}>${y}</option>`).join('');renderSidebar();renderBNav();renderView();if(!state.isTransparencia&&typeof programarRespaldoAutomatico==='function')programarRespaldoAutomatico();if(!state.isTransparencia&&typeof novRefrescarAlerta==='function')novRefrescarAlerta(true);}
const VIEWS_ADMIN=[{id:'dashboard',icon:'🏠',label:'Panel Central'},{id:'gastoComun',icon:'💳',label:'Gasto Común'},{id:'ingresosExtra',icon:'➕',label:'Ingresos Extras'},{id:'egresos',icon:'💸',label:'Gastos'},{id:'multas',icon:'⚖️',label:'Multas'},{id:'mantenciones',icon:'🔧',label:'Mantenciones'},{id:'proveedores',icon:'🤝',label:'Proveedores'},{id:'novedades',icon:'📨',label:'Novedades'},{id:'certificados',icon:'📜',label:'Certificados'},{id:'departamentos',icon:'🏘',label:'Departamentos'},{id:'recordatorios',icon:'⚠️',label:'Morosidad'},{id:'reportes',icon:'📊',label:'Transparencia'},{id:'config',icon:'⚙️',label:'Configuración'},{id:'formularios',icon:'📝',label:'Formularios'},{id:'auditoria',icon:'🕵️',label:'Registro de cambios'}];
/* Menu agrupado en tarjetas: una sola fuente para la barra lateral y el cajon movil. */
const NAV_GROUPS=[
 {t:'Principal',ids:['dashboard','gastoComun','ingresosExtra','egresos','multas']},
 {t:'Gestión',ids:['mantenciones','proveedores','novedades','certificados']},
 {t:'Comunidad',ids:['departamentos','recordatorios']},
 {t:'Público',ids:['reportes']},
 {t:'Sistema',ids:['config','formularios','auditoria']}];
function navBadge(id){if(id!=='novedades'||typeof novNuevasCount!=='function')return '';const n=novNuevasCount();return n?`<span class="nav-badge">${n>99?'99+':n}</span>`:'';}
function navTarjetas(modo){
 return NAV_GROUPS.map((g,i)=>`<div class="nav-card" style="--nd:${(-i*1.3).toFixed(1)}s"><div class="nav-card-t">${g.t}</div>${g.ids.map(id=>{const v=VIEWS_ADMIN.find(x=>x.id===id);if(!v)return '';return modo==='drawer'?navDrawerItem(v.id,v.icon,v.label+navBadge(v.id)):`<div class="nav-item ${state.currentView===v.id?'active':''}" onclick="goTo('${v.id}')"><span class="nav-ico">${v.icon}</span>${v.label}${navBadge(v.id)}</div>`;}).join('')}</div>`).join('');
}
const VIEWS_TRANSP=[{id:'reportes',icon:'📊',label:'Reporte'}];
function getViews(){return state.isTransparencia?VIEWS_TRANSP:VIEWS_ADMIN;}
function renderSidebar(){try{document.getElementById('sidebar').innerHTML=state.isTransparencia?'<div class="nav-card"><div class="nav-card-t">Vista Transparencia</div>'+VIEWS_TRANSP.map(v=>`<div class="nav-item ${state.currentView===v.id?'active':''}" onclick="goTo('${v.id}')"><span class="nav-ico">${v.icon}</span>${v.label}</div>`).join('')+'</div>':navTarjetas('side');}catch(e){console.error(e);}}
function renderBNav(){renderDrawerNav();}
function renderDrawerNav(){try{const navEl=document.getElementById('drawer-nav');if(!navEl)return;const isAdmin=!state.isTransparencia;let h='';
if(isAdmin){h+=navTarjetas('drawer');}
else{h+='<div class="nav-card" style="--nd:0s"><div class="nav-card-t">Vista Transparencia</div>'+navDrawerItem('reportes','📊','Reporte')+'</div>';}
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
function animateCounters(){try{document.querySelectorAll('#main-content .stat-value').forEach(el=>{if(el.children.length)return;/* data-plain: el valor es un conteo, no dinero. Sin esto la animacion lo
   formateaba como moneda ('$4') durante 800ms antes de restaurarlo. */
if(el.hasAttribute('data-plain'))return;const o=el.textContent.trim();const d=o.replace(/[^\d]/g,'');if(!d)return;const t=parseInt(d,10);if(isNaN(t)||t<=0)return;const neg=o.indexOf('-')!==-1;const dur=800;const st=performance.now();function fr(t2){const p=Math.min(1,(t2-st)/dur);const e=1-Math.pow(1-p,3);const v=Math.round(t*e);el.textContent=(neg?'-':'')+fmt(v);if(p<1){requestAnimationFrame(fr);}else{el.textContent=o;}}requestAnimationFrame(fr);});}catch(e){}}
function initParticles(){try{const c=document.getElementById('bg-particles');if(!c)return;const ctx=c.getContext('2d');if(!ctx)return;if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;let W,H,pts=[];function rs(){W=c.width=window.innerWidth;H=c.height=window.innerHeight;const n=Math.min(40,Math.floor(W/35));pts=Array.from({length:n},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.2,vy:(Math.random()-.5)*.2,r:Math.random()*1.2+.4,c:Math.random()<.5?'8,145,178':'45,212,191'}));}rs();window.addEventListener('resize',rs);(function loop(){ctx.clearRect(0,0,W,H);const dk=document.documentElement.getAttribute('data-theme')==='dark';const b=dk?.35:.2;for(const p of pts){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1;}for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++){const a=pts[i],b=pts[j],dx=a.x-b.x,dy=a.y-b.y,d=dx*dx+dy*dy;if(d<120*120){const al=(1-Math.sqrt(d)/120)*b*.4;ctx.strokeStyle='rgba(8,145,178,'+al.toFixed(3)+')';ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}for(const p of pts){ctx.fillStyle='rgba('+p.c+','+(b*.6).toFixed(3)+')';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,6.283);ctx.fill();}requestAnimationFrame(loop);})();}catch(e){}}
function renderView(){killCharts();const el=document.getElementById('main-content');if(!el)return;const v=state.currentView;try{
if(v==='dashboard')el.innerHTML=vDashboard();else if(v==='gastoComun')el.innerHTML=vGastoComun();else if(v==='recordatorios')el.innerHTML=vRecordatorios();else if(v==='departamentos')el.innerHTML=vDepartamentos();else if(v==='ingresosExtra')el.innerHTML=vIngresosExtra();else if(v==='egresos')el.innerHTML=vEgresos();else if(v==='reportes')el.innerHTML=vReportes();else if(v==='config')el.innerHTML=vConfig()+cardRespaldos();else if(v==='formularios')el.innerHTML=vFormularios();else if(v==='multas')el.innerHTML=vMultas();else if(v==='mantenciones')el.innerHTML=vMantenciones();else if(v==='proveedores')el.innerHTML=vProveedores();else if(v==='novedades')el.innerHTML=vNovedades();else if(v==='certificados')el.innerHTML=vCertificados();else if(v==='auditoria')el.innerHTML=vAuditoria();else el.innerHTML='<div style="padding:20px;">Vista no encontrada</div>';
}catch(e){console.error(e);el.innerHTML='<div style="padding:20px;color:var(--danger)">Error al cargar la vista. Recarga la página.</div>';}
setTimeout(drawCharts,100);setTimeout(animateCounters,60);}
/* ===== TIPO DE PAGO (efectivo / transferencia) =====
   Formato historico : appData.pagos[key][deptoId] === true
                       -> se interpreta como PAGADO + TRANSFERENCIA (valor por defecto).
   Formato actual    : appData.pagos[key][deptoId] === {pagado:true, tipo:'efectivo'|'transferencia'}
   No se migran datos historicos: la compatibilidad se resuelve en lectura con normalizarPago().
   REGLA: ningun modulo debe comparar `=== true` ni usar filter(Boolean) sobre appData.pagos.
          Todo acceso pasa por normalizarPago / estaPagado / contarPagos / resumenTipoPago. */
const TIPO_PAGO_DEFAULT='transferencia';
/* color/colorDark -> relleno de dona y punto de leyenda ; text/textDark -> texto (contraste AA) ; btn -> fondo de boton con texto blanco */
const TIPOS_PAGO=[
{id:'efectivo',label:'Efectivo',icon:'💵',color:'#F59E0B',colorDark:'#FBBF24',text:'#B45309',textDark:'#FBBF24',btn:'#B45309'},
{id:'transferencia',label:'Transferencia',icon:'🏦',color:'#0E7490',colorDark:'#22D3EE',text:'#0E7490',textDark:'#22D3EE',btn:'#0E7490'}];
function tipoPagoColor(t){const m=tipoPagoMeta(t);return state.theme==='dark'?m.colorDark:m.color;}
function tipoPagoTextColor(t){const m=tipoPagoMeta(t);return state.theme==='dark'?m.textDark:m.text;}
function tipoPagoMeta(t){return TIPOS_PAGO.find(x=>x.id===t)||TIPOS_PAGO[1];}
function normalizarPago(v){
if(v===true)return{pagado:true,tipo:TIPO_PAGO_DEFAULT};
if(v&&typeof v==='object'&&v.pagado===true)return{pagado:true,tipo:v.tipo==='efectivo'?'efectivo':TIPO_PAGO_DEFAULT};
return{pagado:false,tipo:null};
}
function estaPagado(v){return normalizarPago(v).pagado;}
function tipoDePago(v){return normalizarPago(v).tipo;}
function contarPagos(pm){return Object.values(pm||{}).filter(v=>estaPagado(v)).length;}
/* Resumen mensual por tipo de pago. El monto se calcula con el GC vigente del periodo,
   igual que el resto de la app (no se guarda monto por depto). */
function resumenTipoPago(anio,mes){
const pm=(appData.pagos||{})[mkKey(anio,mes)]||{};
const gc=getGC(anio,mes);
const r={efectivo:{deptos:0,monto:0},transferencia:{deptos:0,monto:0},total:{deptos:0,monto:0}};
Object.values(pm).forEach(v=>{const p=normalizarPago(v);if(!p.pagado)return;r[p.tipo].deptos++;r[p.tipo].monto+=gc;});
r.total.deptos=r.efectivo.deptos+r.transferencia.deptos;
r.total.monto=r.efectivo.monto+r.transferencia.monto;
return r;
}
function calcularBalanceGeneral(){let t=0;for(let a=2018;a<=2028;a++){for(let m=0;m<12;m++){t+=balanceMes(a,m);}}return t;}
function balanceMes(a,m){const k=mkKey(a,m);const gc=getGC(a,m);const p=appData.pagos[k]||{};const pg=contarPagos(p);const ex=(appData.ingresosExtra||[]).filter(g=>g.anio===a&&g.mes===m).reduce((s,g)=>s+g.monto,0);const mp=(appData.multas||[]).filter(x=>x.anio===a&&x.mes===m&&x.estado==='Pagada').reduce((s,x)=>s+x.monto,0);const fm=(appData.gastosFijos&&appData.gastosFijos[k])?appData.gastosFijos[k]:[];const f=fm.reduce((s,g)=>s+g.monto,0);const va=(appData.gastosVariables||[]).filter(g=>g.anio===a&&g.mes===m).reduce((s,g)=>s+g.monto,0);return (pg*gc+ex+mp)-(f+va);}
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
if(lv.tipo==='pago'){t=`✅ CONDOMINIO BOSQUES DEL SUR 4\nLe confirmamos la recepción de su pago del Gasto Común de ${lv.mesStr} por ${fmt(lv.gc)}.\nTipo de pago: ${lv.tipoPagoLabel||'Transferencia'}\n¡Gracias por estar al día! 🙌`;}
else if(lv.tipo==='multa'){t=`⚖️ CONDOMINIO BOSQUES DEL SUR 4\nNotificación de multa — Depto ${lv.depto.numero||''}\nRegla: ${lv.multa.regla}\nMonto: ${fmt(lv.multa.monto)}\nFecha: ${lv.multa.fecha_creacion}\nPara regularizar transfiera a:\nRomina Gabriela Figueroa Acevedo\nMercado Pago — Cuenta Vista\nN° 1088283442`;}
else if(lv.tipo==='estado'||lv.tipo==='certificado'){t=lv.texto;}
compartirPorWhatsApp(lv.img,t,tel,'Comprobante_CBS4.jpg');}
/* ===== MOROSIDAD ===== */
/* ===== PLAZO DE PAGO =====
   El gasto común del mes en curso se puede pagar hasta el dia DIA_VENCIMIENTO.
   Hasta ese dia inclusive NO se considera morosidad: el vecino esta dentro de
   plazo. Desde el dia siguiente, el mes en curso entra en la cartera vencida.
   El dia es configurable desde Configuracion (appData.configuracion.diaVencimiento). */
const DIA_VENCIMIENTO_DEFAULT=8;
function diaVencimiento(){
const v=parseInt((appData.configuracion||{}).diaVencimiento);
return (v>=1&&v<=28)?v:DIA_VENCIMIENTO_DEFAULT;
}
/* true si el mes en curso todavia esta dentro de plazo */
function mesEnCursoDentroDePlazo(hoy){
const d=hoy||new Date();
return d.getDate()<=diaVencimiento();
}
/* Ultimo periodo que ya se puede exigir. Si estamos dentro de plazo, el mes en
   curso no cuenta y el ultimo exigible es el anterior. */
function ultimoPeriodoExigible(hoy){
const d=hoy||new Date();
const y=d.getFullYear(), m=d.getMonth();
if(mesEnCursoDentroDePlazo(d)){
return (m===0)?{anio:y-1,mes:11}:{anio:y,mes:m-1};
}
return {anio:y,mes:m};
}
function clavesVentana(t){
const lim=ultimoPeriodoExigible();
const k=[];
if(t==='12'){
for(let i=0;i<12;i++){const d=new Date(lim.anio,lim.mes-i,1);k.push(mkKey(d.getFullYear(),d.getMonth()));}
k.reverse();
}else if(t==='anio'){
const y=new Date().getFullYear();
if(lim.anio<y)return [];               /* enero dentro de plazo: nada exigible este año */
for(let m=0;m<=lim.mes;m++)k.push(mkKey(y,m));
}else{
/* «Todo el historial» parte del primer periodo con pagos registrados. Antes partia
   en 2018 aunque los registros empiezan en 2025: cada depto aparecia con ~90 meses
   de deuda (unos $61 millones en total) que nunca existieron. */
const ini=primerPeriodoRegistrado();
for(let y=ini.anio;y<=lim.anio;y++){
const m0=(y===ini.anio)?ini.mes:0;
const l=(y===lim.anio)?lim.mes:11;
for(let m=m0;m<=l;m++)k.push(mkKey(y,m));
}
}
return k;
}
/* Primer periodo (YYYY-MM) en que existe al menos un pago registrado. */
function primerPeriodoRegistrado(){
const ks=Object.keys(appData.pagos||{}).filter(k=>/^\d{4}-\d{2}$/.test(k)&&Object.values(appData.pagos[k]||{}).some(v=>estaPagado(v))).sort();
if(!ks.length)return {anio:2018,mes:0};
return {anio:parseInt(ks[0].slice(0,4)),mes:parseInt(ks[0].slice(5,7))-1};
}
function calcularMorosidad(ventana){const t=ventana||state.ventanaMorosidad||'12';const keys=clavesVentana(t);const out=[];(appData.departamentos||[]).forEach(dep=>{const gcM=[];keys.forEach(k=>{if(!estaPagado((appData.pagos[k]||{})[dep.id])){const a=parseInt(k.substring(0,4));const mi=parseInt(k.substring(5,7))-1;gcM.push({key:k,label:formatPeriodo(k),monto:getGC(a,mi)});}});const mul=(appData.multas||[]).filter(m=>{if(m.unidad_id!==dep.id)return false;if(m.estado==='Pagada'||m.estado==='Anulada')return false;const mk=m.anio+'-'+String(m.mes+1).padStart(2,'0');return keys.includes(mk);});const tGC=gcM.reduce((s,g)=>s+g.monto,0);const tM=mul.reduce((s,m)=>s+m.monto,0);const tot=tGC+tM;if(tot>0)out.push({dep,gcMeses:gcM,multas:mul,total:tot});});out.sort((a,b)=>b.total-a.total);return out;}
function textoMoroso(m){let t=`Hola ${m.dep.representante||''} 👋\nCONDOMINIO BOSQUES DEL SUR 4\nLe enviamos su estado de cuenta pendiente:\n`;if(m.gcMeses.length){t+='\nGASTO COMÚN:\n'+m.gcMeses.map(g=>`• ${g.label}: ${fmt(g.monto)}`).join('\n')+'\n';}if(m.multas.length){t+='\nMULTAS:\n'+m.multas.map(x=>`• ${x.fecha_creacion} · ${x.regla}: ${fmt(x.monto)}`).join('\n')+'\n';}t+=`\nTOTAL PENDIENTE: ${fmt(m.total)}\n\nDatos de transferencia:\nRomina Gabriela Figueroa Acevedo\nMercado Pago — Cuenta Vista\nN° 1088283442`;return t;}
function recordarMorosoWhatsApp(id){const m=calcularMorosidad().find(x=>x.dep.id===id);if(!m)return;abrirWhatsApp(m.dep.contacto||'',textoMoroso(m));}
function recordarMesActual(id){const {currentYear,currentMonth}=state;const d=(appData.departamentos||[]).find(x=>x.id===id);if(!d)return;const gc=getGC(currentYear,currentMonth);const t=`Hola ${d.representante||''} 👋\nCONDOMINIO BOSQUES DEL SUR 4\nLe recordamos que el Gasto Común de ${MESES[currentMonth]} ${currentYear} (${fmt(gc)}) se encuentra pendiente.\n\nDatos de transferencia:\nRomina Gabriela Figueroa Acevedo\nMercado Pago — Cuenta Vista\nN° 1088283442`;abrirWhatsApp(d.contacto||'',t);}