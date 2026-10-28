// ============================================================
// PIN LOCK
// ============================================================
let PIN_HASH = localStorage.getItem('bm_pin_hash') || 'zmv6wt'; // default: 262626
const PIN_LENGTH_MIN = 4;
const PIN_LENGTH_MAX = 8;
let PIN_LENGTH = parseInt(localStorage.getItem('bm_pin_len')||'6');
function hashPin(str){
  let hash=5381;
  for(let i=0;i<str.length;i++){hash=((hash<<5)+hash)+str.charCodeAt(i);hash=hash&0xFFFFFFFF}
  return (hash>>>0).toString(36);
}
function savePinLocally(hash, len){
  // Hifadhi kwenye localStorage (haraka) na Firestore (usalama)
  localStorage.setItem('bm_pin_hash', hash);
  localStorage.setItem('bm_pin_len', String(len));
  if(fbReady) saveDocToFirestore('pin',{hash, len});
}
async function loadPinFromFirestore(){
  try{
    const ref=fbDb.collection('bandoManager').doc(BUSINESS_ID).collection('data').doc('pin');
    const snap=await ref.get();
    if(snap.exists){
      const d=snap.data();
      PIN_HASH=d.hash||PIN_HASH;
      PIN_LENGTH=d.len||PIN_LENGTH;
      localStorage.setItem('bm_pin_hash',PIN_HASH);
      localStorage.setItem('bm_pin_len',String(PIN_LENGTH));
    }
  }catch(e){console.log('PIN load fallback to localStorage')}
}

let pinEntry='';

function renderLockDots(){
  const box=document.getElementById('lockDots');
  box.innerHTML='';
  for(let i=0;i<PIN_LENGTH;i++){
    const d=document.createElement('div');
    d.className='lock-dot'+(i<pinEntry.length?' filled':'');
    box.appendChild(d);
  }
}

function buildKeypad(){
  const keys=['1','2','3','4','5','6','7','8','9','clear','0','back'];
  const box=document.getElementById('lockKeypad');
  box.innerHTML=keys.map(k=>{
    if(k==='clear')return `<button type="button" class="lock-key lock-clear" onclick="pinClear()">FUTA</button>`;
    if(k==='back')return `<button type="button" class="lock-key lock-back" onclick="pinBackspace()">⌫</button>`;
    return `<button type="button" class="lock-key" onclick="pinPress('${k}')">${k}</button>`;
  }).join('');
}

function pinPress(d){
  if(pinEntry.length>=PIN_LENGTH)return;
  pinEntry+=d;
  renderLockDots();
  if(pinEntry.length===PIN_LENGTH) checkPin();
}
function pinClear(){pinEntry='';renderLockDots()}
function pinBackspace(){pinEntry=pinEntry.slice(0,-1);renderLockDots()}

function checkPin(){
  if(hashPin(pinEntry)===PIN_HASH){
    sessionStorage.setItem('bm_unlocked','1');
    unlockApp();
  } else {
    const box=document.getElementById('lockDots');
    box.classList.add('lock-shake');
    setTimeout(()=>{
      box.classList.remove('lock-shake');
      pinEntry='';
      renderLockDots();
    },400);
    showLockError();
  }
}

function showLockError(){
  const sub=document.querySelector('.lock-sub');
  sub.textContent='PIN sio sahihi, jaribu tena';
  sub.style.color='var(--danger)';
  setTimeout(()=>{sub.textContent='Ingiza PIN kufungua mfumo';sub.style.color='var(--text2)'},1800);
}

async function unlockApp(){
  document.getElementById('lockScreen').style.display='none';
  const root=document.getElementById('appRoot');
  root.classList.remove('app-hidden');
  showLoadingOverlay(true);
  await initFirebase();
  showLoadingOverlay(false);
  if(!fbReady){
    root.classList.add('app-hidden');
    sessionStorage.removeItem('bm_unlocked');
    document.getElementById('authScreen').style.display='flex';
    showAuthError('Data haikupakiwa. Hakuna mabadiliko yaliyofanywa. Ingia tena au refresh ukurasa.');
    return;
  }
  if(typeof initApp==='function') initApp();
}

function showLoadingOverlay(show){
  let ov=document.getElementById('dataLoadingOverlay');
  if(show){
    if(!ov){
      ov=document.createElement('div');
      ov.id='dataLoadingOverlay';
      ov.className='lock-screen';
      ov.innerHTML='<div class="lock-box"><div class="lock-icon">☁️</div><div class="lock-title">Inapakua data...</div><div class="lock-sub">Tafadhali subiri, inaunganisha na database</div></div>';
      document.body.appendChild(ov);
    }
    ov.style.display='flex';
  } else if(ov){
    ov.remove();
  }
}

// ---- SETTINGS — BADILISHA PIN ----
function togglePinVis(inputId, btn){
  const inp=document.getElementById(inputId);
  if(inp.type==='password'){inp.type='text';btn.textContent='🙈'}
  else{inp.type='password';btn.textContent='👁'}
}

function checkPinStrength(){
  const pin=document.getElementById('settingNewPin').value;
  const bar=document.getElementById('pinStrengthFill');
  const lbl=document.getElementById('pinStrengthLabel');
  if(!pin){bar.style.width='0';lbl.textContent='';return}
  let score=0;
  if(pin.length>=4) score++;
  if(pin.length>=6) score++;
  if(pin.length>=8) score++;
  if(!/^(.)\1+$/.test(pin)) score++; // si namba moja kurudiwa
  const map=[
    {w:'25%',c:'var(--danger)',t:'Dhaifu sana'},
    {w:'50%',c:'var(--warning)',t:'Dhaifu'},
    {w:'75%',c:'var(--accent2)',t:'Wastani'},
    {w:'100%',c:'var(--success)',t:'Nzuri ✓'},
  ];
  const m=map[Math.min(score,3)];
  bar.style.width=m.w; bar.style.background=m.c;
  lbl.textContent=`Nguvu: ${m.t}`;
  lbl.style.color=m.c;
}

function showPinMsg(msg, ok){
  const el=document.getElementById('changePinMsg');
  el.style.display='block';
  el.style.color=ok?'var(--success)':'var(--danger)';
  el.textContent=msg;
  if(ok) setTimeout(()=>el.style.display='none', 3000);
}

function saveAssistantPhone(){
  const val = document.getElementById('assistantPhoneInput').value.trim();
  const st  = document.getElementById('assistantPhoneStatus');
  _cache.assistantPhone = val;
  saveMeta();
  if(val){
    if(st){ st.textContent='✅ Order zote zitatumwa SMS moja kwa moja kwa namba hii'; st.style.color='var(--success)'; }
  } else {
    if(st){ st.textContent='Hakuna namba — utahitaji kunakili ujumbe mwenyewe'; st.style.color='var(--text3)'; }
  }
}

function saveBossPhone(){
  const val = document.getElementById('bossPhoneInput').value.trim();
  const st  = document.getElementById('bossPhoneStatus');
  if(val){
    localStorage.setItem('bm_boss_phone', val);
    if(st){ st.textContent='✅ Namba imehifadhiwa — ripoti itatumwa saa 23:30'; st.style.color='var(--success)'; }
  } else {
    localStorage.removeItem('bm_boss_phone');
    if(st){ st.textContent='Ripoti imezimwa — hakuna namba'; st.style.color='var(--text3)'; }
  }
}

function changeProfitPin(){
  const old     = document.getElementById('profitOldPin').value;
  const newPin  = document.getElementById('profitNewPin').value;
  const confirm = document.getElementById('profitConfirmPin').value;
  const msg     = document.getElementById('profitPinMsg');
  const show    = (txt,ok)=>{msg.style.display='block';msg.style.color=ok?'var(--success)':'var(--danger)';msg.textContent=txt;if(ok)setTimeout(()=>msg.style.display='none',3000)};
  if(hashPin(old)!==PROFIT_PIN_HASH) return show('❌ PIN ya sasa si sahihi','error');
  if(!/^\d{4}$/.test(newPin))        return show('PIN lazima iwe namba 4 tu','error');
  if(newPin!==confirm)               return show('❌ PIN mpya hazilingani','error');
  saveProfitPin(hashPin(newPin));
  ['profitOldPin','profitNewPin','profitConfirmPin'].forEach(id=>document.getElementById(id).value='');
  show('✅ PIN ya faida imebadilishwa!',true);
}

function changePin(){
  const oldPin  = document.getElementById('settingOldPin').value.trim();
  const newPin  = document.getElementById('settingNewPin').value.trim();
  const confirm = document.getElementById('settingConfirmPin').value.trim();

  // Validations
  if(!oldPin) return showPinMsg('Ingiza PIN ya sasa','error');
  if(hashPin(oldPin) !== PIN_HASH) return showPinMsg('❌ PIN ya sasa si sahihi','error');
  if(!newPin) return showPinMsg('Ingiza PIN mpya','error');
  if(!/^\d+$/.test(newPin)) return showPinMsg('PIN lazima iwe namba tu (0–9)','error');
  if(newPin.length < 4) return showPinMsg('PIN lazima iwe na namba 4 au zaidi','error');
  if(newPin.length > 8) return showPinMsg('PIN haiwezi kuzidi namba 8','error');
  if(newPin !== confirm) return showPinMsg('❌ PIN mpya hazilingani','error');
  if(newPin === oldPin) return showPinMsg('PIN mpya lazima itofautiane na ya sasa','error');

  // Save
  const newHash = hashPin(newPin);
  PIN_HASH = newHash;
  PIN_LENGTH = newPin.length;
  savePinLocally(newHash, newPin.length);

  // Clear fields
  ['settingOldPin','settingNewPin','settingConfirmPin'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('pinStrengthFill').style.width='0';
  document.getElementById('pinStrengthLabel').textContent='';
  document.getElementById('settingPinLen').textContent=PIN_LENGTH+' namba';

  showPinMsg('✅ PIN imebadilishwa na kuhifadhiwa!', true);
  showToast('✅ PIN mpya imewekwa — namba '+PIN_LENGTH, 'success');
}

function lockNow(){
  sessionStorage.removeItem('bm_unlocked');
  document.getElementById('appRoot').classList.add('app-hidden');
  document.getElementById('lockScreen').style.display='flex';
  pinEntry='';
  buildKeypad();
  renderLockDots();
}

function initLock(){
  // Already unlocked this browser session? skip PIN prompt.
  if(sessionStorage.getItem('bm_unlocked')==='1'){
    unlockApp();
    return;
  }
  buildKeypad();
  renderLockDots();
}


const MAX_WEEK=2,MAX_MONTH=2;
let currentBundleType='week',currentReportFilter='today';

// ============================================================
// FIREBASE / FIRESTORE SETUP
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyD1-uNaODVXvrcIoAkKtOq3GF7v6WXxtlY",
  authDomain: "bandomanager.firebaseapp.com",
  projectId: "bandomanager",
  storageBucket: "bandomanager.firebasestorage.app",
  messagingSenderId: "49207547818",
  appId: "1:49207547818:web:5ec4c3088f1f9e85203dd3",
  measurementId: "G-86KTFFE7Q5"
};
// Chanzo cha zamani ni cha kusoma tu; uhamisho unagusa data za BandoManager pekee.
const legacyFirebaseConfig = {
  apiKey: "AIzaSyCVp3VUQVJzVVW_vFgeEcSk0PD57tsP1dg",
  authDomain: "smart-bundles-10d09.firebaseapp.com",
  projectId: "smart-bundles-10d09",
  storageBucket: "smart-bundles-10d09.firebasestorage.app",
  messagingSenderId: "146024000699",
  appId: "1:146024000699:web:8c53cd76fd64925467cd9e"
};
const BUSINESS_ID = "hglobal-bando-469qjc3yw6br3pzf";
const LEGACY_DATA_DOCS=['lines','sales','transactions','slots','calcRecords','meta','loans','bandos','customers','orders','pin'];

let fbApp=null, fbDb=null, fbAuth=null, fbReady=false;
let _firestoreUnsubs=[],_snapshotRenderTimer=null,_docShadow={};
let syncStatus='idle'; // idle | syncing | synced | error

// In-memory cache — mirrors Firestore, read/written synchronously by app code
let _cache = { lines:[], sales:[], transactions:[], slots:[], calcRecords:[], loans:[], bandos:[], customers:[], orders:[], orderCounter:0, orderDate:null, assistantPhone:'', lastDate:null };

function authErrorMessage(error){
  const code=error&&error.code;
  if(code==='auth/invalid-email')return 'Barua pepe haijaandikwa kwa usahihi.';
  if(code==='auth/user-not-found'||code==='auth/wrong-password'||code==='auth/invalid-credential')return 'Barua pepe au nenosiri si sahihi.';
  if(code==='auth/too-many-requests')return 'Majaribio yamezidi. Subiri kidogo kisha ujaribu tena.';
  if(code==='auth/network-request-failed')return 'Mtandao haujapatikana. Angalia muunganisho kisha ujaribu tena.';
  if(code==='auth/unauthorized-domain')return 'Domain hii haijaidhinishwa kwenye Firebase Authentication.';
  return 'Imeshindwa kuingia ('+(code||'hitilafu')+').';
}
function showAuthError(message){
  const el=document.getElementById('authError');
  if(el){el.textContent=message;el.style.display='block';}
}
async function signInBandoManager(event){
  event.preventDefault();
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  const button=document.getElementById('authSubmit');
  button.disabled=true;button.textContent='Inaingia...';
  document.getElementById('authError').style.display='none';
  try{
    await fbAuth.signInWithEmailAndPassword(email,password);
    document.getElementById('authPassword').value='';
  }catch(error){showAuthError(authErrorMessage(error));}
  finally{button.disabled=false;button.textContent='Ingia';}
}
async function signOutBandoManager(){
  sessionStorage.removeItem('bm_unlocked');
  try{await fbAuth.signOut();}catch(error){showToast('Imeshindwa kutoka kwenye akaunti.','error');}
}
function initFirebaseGate(){
  try{
    fbApp=firebase.apps.find(app=>app.name==='bandomanager-main')||firebase.initializeApp(firebaseConfig,'bandomanager-main');
    fbAuth=fbApp.auth();fbDb=fbApp.firestore();
    fbAuth.onAuthStateChanged(user=>{
      const authScreen=document.getElementById('authScreen');
      const lockScreen=document.getElementById('lockScreen');
      if(user){
        authScreen.style.display='none';
        lockScreen.style.display='flex';
        initLock();
      }else{
        fbReady=false;stopFirestoreSync();sessionStorage.removeItem('bm_unlocked');
        document.getElementById('appRoot').classList.add('app-hidden');
        lockScreen.style.display='none';authScreen.style.display='flex';
      }
    },error=>showAuthError(authErrorMessage(error)));
  }catch(error){showAuthError('Firebase haijaanzishwa ('+(error.code||'hitilafu')+').');}
}
function setSyncStatus(s){
  syncStatus=s;
  const el=document.getElementById('syncIndicator');
  if(!el)return;
  const map={
    idle:    {txt:'⏳ Inaunganisha...', cls:''},
    syncing: {txt:'🔄 Inahifadhi...',   cls:'syncing'},
    synced:  {txt:'☁️ Imehifadhiwa',    cls:'synced'},
    error:   {txt:'⚠️ Tatizo la mtandao', cls:'error'}
  };
  const m=map[s]||map.idle;
  el.textContent=m.txt;
  el.className='sync-indicator '+m.cls;
}

function stopFirestoreSync(){_firestoreUnsubs.forEach(unsub=>{try{unsub()}catch(_){}});_firestoreUnsubs=[];clearTimeout(_snapshotRenderTimer)}
function startFirestoreSync(){
 stopFirestoreSync();if(!fbDb||!fbAuth?.currentUser)return;
 const names=['lines','sales','transactions','slots','calcRecords','meta','loans','bandos','customers','orders','pin'];
 for(const name of names){
  const ref=dataDocRef(name),unsub=ref.onSnapshot(snap=>{
   if(!fbReady)return;const data=snap.exists?snap.data():null,items=data&&data.items!==undefined?data.items:(name==='meta'?{}:[]);_docShadow[name]=cloneDocValue(items);
   if(name==='meta'){
    _cache.lastDate=items.lastDate||null;_cache.orderDate=items.orderDate||null;_cache.orderCounter=_cache.orderDate===todayStr()?(Number(items.orderCounter)||0):(!_cache.orderDate?Math.max(0,...(_cache.orders||[]).filter(o=>dateKeyLocal(o.createdAt||o.date||'')===todayStr()).map(o=>parseInt(o.orderNo,10)||0)):0);_cache.assistantPhone=items.assistantPhone||'';_orderCounter=_cache.orderCounter;
    const next=document.getElementById('nextOrderNoLabel');if(next)next.textContent=`Order inayofuata leo: #${String(_cache.orderCounter+1).padStart(3,'0')}`;
   }else if(name==='pin'){
    const d=items||{};if(d.hash){PIN_HASH=d.hash;PIN_LENGTH=d.len||PIN_LENGTH;localStorage.setItem('bm_pin_hash',PIN_HASH);localStorage.setItem('bm_pin_len',String(PIN_LENGTH))}
   }else _cache[name]=Array.isArray(items)?items:[];
   setSyncStatus('synced');clearTimeout(_snapshotRenderTimer);_snapshotRenderTimer=setTimeout(()=>{
    renderAll();
    if(document.getElementById('page-reports')?.classList.contains('active'))renderReports();
    if(document.getElementById('page-loans')?.classList.contains('active'))renderLoans();
    if(document.getElementById('page-orders')?.classList.contains('active'))renderOrdersPage();
    if(document.getElementById('page-customers')?.classList.contains('active'))renderCustomers();
    if(document.getElementById('page-sell')?.classList.contains('active')){renderTodaySales();updateSellSlotInfo()}
    if(document.getElementById('page-balance')?.classList.contains('active')){renderTransactions();updateBandoPreview()}
    renderPendingOrdersBadge();
   },80);
  },error=>{console.error('Firestore live sync error:',name,error);setSyncStatus('error')});
  _firestoreUnsubs.push(unsub);
 }
}

function cloneDocValue(value){return value===undefined?undefined:JSON.parse(JSON.stringify(value))}
function docArrayItemKey(item){if(item&&item.id!==undefined)return 'id:'+item.id;if(item&&item.lineId!==undefined&&item.date!==undefined)return 'slot:'+item.lineId+':'+item.date;if(item&&item.phone!==undefined)return 'phone:'+item.phone;return 'value:'+stableJson(item)}
function mergeArrayChanges(base,desired,latest){
 const out=cloneDocValue(latest||[]),baseMap=new Map((base||[]).map(x=>[docArrayItemKey(x),x])),desiredMap=new Map((desired||[]).map(x=>[docArrayItemKey(x),x]));
 for(const [key,oldItem] of baseMap){const wanted=desiredMap.get(key),idx=out.findIndex(x=>docArrayItemKey(x)===key);if(!wanted){if(idx>=0)out.splice(idx,1);continue}if(stableJson(oldItem)===stableJson(wanted))continue;if(idx<0)continue;const current=out[idx],keys=new Set([...Object.keys(oldItem||{}),...Object.keys(wanted||{})]);for(const k of keys){if(stableJson(oldItem?.[k])!==stableJson(wanted?.[k])){if(Object.prototype.hasOwnProperty.call(wanted,k))current[k]=cloneDocValue(wanted[k]);else delete current[k]}}}
 for(const [key,item] of desiredMap)if(!baseMap.has(key)&&!out.some(x=>docArrayItemKey(x)===key))out.push(cloneDocValue(item));
 return out;
}
function mergeObjectChanges(base,desired,latest){const out=cloneDocValue(latest||{}),keys=new Set([...Object.keys(base||{}),...Object.keys(desired||{})]);for(const k of keys){if(stableJson(base?.[k])!==stableJson(desired?.[k])){if(Object.prototype.hasOwnProperty.call(desired,k))out[k]=cloneDocValue(desired[k]);else delete out[k]}}return out}
async function loadDocFromFirestore(docName, fallback){
 try{const ref=dataDocRef(docName),snap=await ref.get(),items=snap.exists&&snap.data().items!==undefined?snap.data().items:fallback;_docShadow[docName]=cloneDocValue(items);return items}
 catch(e){console.error('Load error for',docName,e);throw e}
}
async function saveDocToFirestore(docName,items){
 setSyncStatus('syncing');
 let base;
 try{
  const ref=dataDocRef(docName);base=Object.prototype.hasOwnProperty.call(_docShadow,docName)?cloneDocValue(_docShadow[docName]):(Array.isArray(items)?[]:{});const desired=cloneDocValue(items);
  const merged=await fbDb.runTransaction(async tx=>{const snap=await tx.get(ref),remote=txItems(snap,Array.isArray(items)?[]:{}),next=Array.isArray(items)?mergeArrayChanges(base,desired,remote):mergeObjectChanges(base,desired,remote);tx.set(ref,{items:next,updatedAt:new Date().toISOString()});return next});
  _docShadow[docName]=cloneDocValue(merged);if(Array.isArray(merged)&&Object.prototype.hasOwnProperty.call(_cache,docName))_cache[docName]=merged;
  if(docName==='meta'&&merged){_cache.lastDate=merged.lastDate||null;_cache.orderDate=merged.orderDate||null;_cache.orderCounter=_cache.orderDate===todayStr()?(Number(merged.orderCounter)||0):0;_cache.assistantPhone=merged.assistantPhone||'';_orderCounter=_cache.orderCounter}
  setSyncStatus('synced');
 }catch(e){console.error('Save error for',docName,e);if(base!==undefined){_docShadow[docName]=cloneDocValue(base);if(Array.isArray(base)&&Object.prototype.hasOwnProperty.call(_cache,docName))_cache[docName]=cloneDocValue(base);if(docName==='meta'&&base){_cache.lastDate=base.lastDate||null;_cache.orderDate=base.orderDate||null;_cache.orderCounter=_cache.orderDate===todayStr()?(Number(base.orderCounter)||0):0;_cache.assistantPhone=base.assistantPhone||'';_orderCounter=_cache.orderCounter}}setSyncStatus('error');showToast('⚠️ Hifadhi imeshindikana. Angalia mtandao na jaribu tena.','warning')}
}

// Atomic inventory writes: stock, FIFO balances, slots and records move together.
function dataDocRef(name){return fbDb.collection('bandoManager').doc(BUSINESS_ID).collection('data').doc(name)}
function txItems(snap,fallback){if(!snap.exists)return fallback;const d=snap.data();return d.items!==undefined?d.items:fallback}
function txWriteItems(tx,name,items){_docShadow[name]=cloneDocValue(items);tx.set(dataDocRef(name),{items,updatedAt:new Date().toISOString()})}
function txFifoCost(lines,bandos,lineId,type,mb){const active=bandos.filter(b=>b.lineId===lineId&&b.type===type&&b.active!==false&&bandoMbLeft(b)>0),line=lines.find(l=>l.id===lineId),real=line?(type==='week'?(line.mbWeek||0):(line.mbMonth||0)):0;if(mb>real||!line)return null;let left=mb,cost=0;const usedBandos=[];for(const b of active){if(left<=0)break;const take=Math.min(left,bandoMbLeft(b));cost+=(take/b.totalMb)*b.buyPrice;usedBandos.push({bandoId:b.id,mbUsed:take});left-=take}if(left>0.5){cost+=left*(type==='week'?5000/6556:10000/13112);left=0}return{totalCost:Math.round(cost),usedBandos}}
function txApplyFifo(lines,bandos,lineId,type,mb,used){for(const u of used){const b=bandos.find(x=>x.id===u.bandoId);if(b){b.usedMb=(b.usedMb||0)+u.mbUsed;if(bandoMbLeft(b)<=0.5)b.active=false}}const l=lines.find(x=>x.id===lineId);if(!l)throw new Error('Laini haipo tena.');if(type==='week')l.mbWeek=Math.max(0,(l.mbWeek||0)-mb);else l.mbMonth=Math.max(0,(l.mbMonth||0)-mb)}
function txIncrementSlot(slots,lineId,type){const today=todayStr();let s=slots.find(x=>x.lineId===lineId&&x.date===today);if(!s){s={lineId,date:today,weekUsed:0,monthUsed:0};slots.push(s)}const k=type==='week'?'weekUsed':'monthUsed',max=type==='week'?MAX_WEEK:MAX_MONTH;if((s[k]||0)>=max)throw new Error(`Slots za ${type==='week'?'Wiki':'Mwezi'} zimekwisha leo.`);s[k]=(s[k]||0)+1}
function txDecrementSlot(slots,lineId,type){const s=slots.find(x=>x.lineId===lineId&&x.date===todayStr());if(s){const k=type==='week'?'weekUsed':'monthUsed';s[k]=Math.max(0,(s[k]||0)-1)}}

async function initFirebase(){
  try{
    if(!fbAuth?.currentUser||!fbDb)throw new Error('Ingia kwenye akaunti ya BandoManager kwanza.');
    fbReady=false;
    const [lines,sales,transactions,slots,calcRecords,metaDoc,loans,bandos,customers,orders] = await Promise.all([
      loadDocFromFirestore('lines',[]),
      loadDocFromFirestore('sales',[]),
      loadDocFromFirestore('transactions',[]),
      loadDocFromFirestore('slots',[]),
      loadDocFromFirestore('calcRecords',[]),
      loadDocFromFirestore('meta',{}),
      loadDocFromFirestore('loans',[]),
      loadDocFromFirestore('bandos',[]),
      loadDocFromFirestore('customers',[]),
      loadDocFromFirestore('orders',[])
    ]);
    _cache.lines=lines; _cache.sales=sales; _cache.transactions=transactions;
    _cache.slots=slots; _cache.calcRecords=calcRecords;
    _cache.lastDate = metaDoc && metaDoc.lastDate ? metaDoc.lastDate : null;
    _cache.orderDate = metaDoc && metaDoc.orderDate ? metaDoc.orderDate : null;
    _cache.orderCounter = _cache.orderDate===todayStr() ? (Number(metaDoc.orderCounter)||0) : (_cache.orderDate ? 0 : Math.max(0,...orders.filter(o=>dateKeyLocal(o.createdAt||o.date||'')===todayStr()).map(o=>parseInt(o.orderNo,10)||0)));
    _cache.assistantPhone = metaDoc && metaDoc.assistantPhone ? metaDoc.assistantPhone : '';
    _cache.loans=loans; _cache.bandos=bandos; _cache.customers=customers;
    const _orderMigration = migrateOrderIds(orders);
    _cache.orders = _orderMigration.orders;
    if(_orderMigration.changed) saveDocToFirestore('orders', _cache.orders);
    _orderCounter = _cache.orderCounter;
    fbReady=true;
    await loadPinFromFirestore();
    startFirestoreSync();
    setSyncStatus('synced');
  }catch(e){
    fbReady=false;
    console.error('Firebase init failed',e);
    setSyncStatus('error');
    showToast('❌ Imeshindwa kuunganisha database — angalia mtandao','error');
  }
}

function downloadLegacyBackup(payload){
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='bandomanager-backup-kabla-ya-uhamisho-'+todayStr()+'.json';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function stableJson(value){
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';
}
function destinationDocIsEmpty(name,data){
  if(!data)return true;
  if(Array.isArray(data.items)&&data.items.length===0)return true;
  if(name==='meta'&&data.items&&typeof data.items==='object'&&!Array.isArray(data.items)){
    const meta=data.items;
    return Number(meta.orderCounter||0)===0&&!meta.assistantPhone&&(!meta.lastDate||meta.lastDate===todayStr());
  }
  return false;
}
async function migrateLegacyBandoData(){
  if(!fbAuth?.currentUser||!fbDb)return showToast('Ingia kwenye akaunti ya BandoManager kwanza.','error');
  if(!confirm('Hakikisha mfumo wa zamani umesimamishwa kwenye vifaa vyote. Uhamisho utasoma data za BandoManager pekee; hautafuta data za SmartBundles. Endelea?'))return;
  const button=document.getElementById('migrateLegacyBtn'),status=document.getElementById('migrateLegacyStatus');
  if(button){button.disabled=true;button.textContent='Inasoma project ya zamani...';}
  try{
    const sourceApp=firebase.apps.find(app=>app.name==='legacy-bando-source')||firebase.initializeApp(legacyFirebaseConfig,'legacy-bando-source');
    const sourceDb=sourceApp.firestore(),sourceRefs=LEGACY_DATA_DOCS.map(name=>sourceDb.collection('bandoManager').doc(BUSINESS_ID).collection('data').doc(name));
    const sourceSnaps=await Promise.all(sourceRefs.map(ref=>ref.get()));
    const payload={exportedAt:new Date().toISOString(),sourceProject:legacyFirebaseConfig.projectId,destinationProject:firebaseConfig.projectId,businessId:BUSINESS_ID,documents:{}};
    sourceSnaps.forEach((snap,index)=>{if(snap.exists)payload.documents[LEGACY_DATA_DOCS[index]]=snap.data()});
    const names=Object.keys(payload.documents);if(!names.length)throw new Error('Hakuna hati za BandoManager zilizopatikana kwenye project ya zamani.');
    downloadLegacyBackup(payload);
    if(status)status.textContent='Backup ya hati '+names.length+' imetumwa kwenye Downloads.';
    if(!confirm('Backup ya BandoManager imepakuliwa. Endelea kunakili hati kwenye project mpya? Data ya SmartBundles haitafutwa.'))return;
    if(button)button.textContent='Inakagua project mpya...';
    const refs=names.map(name=>fbDb.collection('bandoManager').doc(BUSINESS_ID).collection('data').doc(name)),destSnaps=await Promise.all(refs.map(ref=>ref.get()));
    const alreadySame=new Set();
    for(let i=0;i<names.length;i++){
      const snap=destSnaps[i],incoming=payload.documents[names[i]];
      if(snap.exists&&!destinationDocIsEmpty(names[i],snap.data())){
        if(stableJson(snap.data())===stableJson(incoming)){alreadySame.add(names[i]);continue;}
        throw new Error('Project mpya ina data tofauti kwenye '+names[i]+'. Uhamisho umesimama bila kuandika juu yake.');
      }
    }
    let copied=0;
    for(let i=0;i<names.length;i++){
      const name=names[i];if(alreadySame.has(name)){copied++;continue;}
      await refs[i].set(payload.documents[name]);copied++;
      if(status)status.textContent='Inahamisha... '+copied+'/'+names.length+' hati';
    }
    if(status)status.textContent='Uhamisho umekamilika: hati '+copied+' zipo kwenye project mpya. Mfumo unafunguka upya...';
    showToast('Data ya BandoManager imenakiliwa kwenda project mpya.','success');setTimeout(()=>location.reload(),1600);
  }catch(error){console.error('BandoManager migration failed',error);if(status)status.textContent='Uhamisho umesimama: '+(error.message||'hitilafu')+'. Backup ya chanzo haijafutwa.';showToast(error.message||'Uhamisho umeshindikana.','error')}
  finally{if(button){button.disabled=false;button.textContent='Pakua backup kisha hamisha';}}
}
// ---- Synchronous in-memory accessors (used everywhere in the app) ----
const getLines=()=>_cache.lines;
const getSales=()=>_cache.sales;
const getTransactions=()=>_cache.transactions;
const getSlots=()=>_cache.slots;
const getCalcRecords=()=>_cache.calcRecords;

const saveLines=d=>{_cache.lines=d;saveDocToFirestore('lines',d)};
const saveSales=d=>{_cache.sales=d;saveDocToFirestore('sales',d)};
const saveTransactions=d=>{_cache.transactions=d;saveDocToFirestore('transactions',d)};
const saveSlots=d=>{_cache.slots=d;saveDocToFirestore('slots',d)};
const saveCalcRecords=d=>{_cache.calcRecords=d;saveDocToFirestore('calcRecords',d)};

function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function dateKeyLocal(value){const raw=String(value||'');if(/^\d{4}-\d{2}-\d{2}$/.test(raw))return raw;const d=value instanceof Date?value:new Date(value);if(!Number.isFinite(d.getTime()))return raw.slice(0,10);const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Dar_es_Salaam',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);return parts.filter(p=>['year','month','day'].includes(p.type)).map(p=>p.value).join('-')}
function todayStr(){return dateKeyLocal(new Date())}
function fmt(n){return'TSh '+Number(n||0).toLocaleString('en')}
function fmtDateTime(iso){
  const d=new Date(iso);
  return d.toLocaleDateString('sw-TZ',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('sw-TZ',{hour:'2-digit',minute:'2-digit'});
}

// ---- DAILY RESET — inafanya kazi saa 00:00 usiku ----
function saveMeta(){
  saveDocToFirestore('meta', { lastDate: _cache.lastDate, orderCounter: _cache.orderCounter, orderDate:_cache.orderDate, assistantPhone: _cache.assistantPhone });
}

async function resetSlotsIfNewDay(){
  const today=todayStr();if(!fbDb)return;
  let resultSlots=null,changed=false;
  await fbDb.runTransaction(async tx=>{const refs=[dataDocRef('slots'),dataDocRef('meta')],snaps=await Promise.all(refs.map(r=>tx.get(r))),slots=txItems(snaps[0],[]),meta=txItems(snaps[1],{});if(meta.lastDate===today){resultSlots=slots;return}resultSlots=slots.filter(x=>x.date===today);meta.lastDate=today;txWriteItems(tx,'slots',resultSlots);txWriteItems(tx,'meta',meta);changed=true});
  if(resultSlots)_cache.slots=resultSlots;_cache.lastDate=today;if(changed)renderAll();
}
let _slotResetTimer=null;
function scheduleNextMidnightReset(){
  clearTimeout(_slotResetTimer);const [y,m,d]=todayStr().split('-').map(Number),nextUtc=Date.UTC(y,m-1,d+1)-3*60*60*1000;
  _slotResetTimer=setTimeout(async()=>{try{await resetSlotsIfNewDay();renderAll();showToast('Siku mpya — slots zimeanza upya.','success')}catch(e){console.error('Slot reset failed',e);showToast('Slots zitasasishwa mtandao ukirudi.','warning')}scheduleNextMidnightReset()},Math.max(1000,nextUtc-Date.now()));
}

// ---- SLOTS ----
function getLineSlots(lineId){
  const today=todayStr();
  return getSlots().find(s=>s.lineId===lineId&&s.date===today)||{lineId,date:today,weekUsed:0,monthUsed:0};
}
function updateLineSlots(lineId,type){
  const slots=getSlots(),today=todayStr();
  const idx=slots.findIndex(s=>s.lineId===lineId&&s.date===today);
  if(idx>=0){if(type==='week')slots[idx].weekUsed++;else slots[idx].monthUsed++;saveSlots(slots)}
  else{slots.push({lineId,date:today,weekUsed:type==='week'?1:0,monthUsed:type==='month'?1:0});saveSlots(slots)}
}

async function editLineSlots(lineId){
 const line=getLines().find(x=>x.id===lineId);if(!line)return;const current=getLineSlots(lineId);
 const w=prompt(`Slots za WIKI zilizotumika leo kwa ${line.name} (0-${MAX_WEEK}):`,String(current.weekUsed||0));if(w===null)return;
 const m=prompt(`Slots za MWEZI zilizotumika leo kwa ${line.name} (0-${MAX_MONTH}):`,String(current.monthUsed||0));if(m===null)return;
 const week=Number(w),month=Number(m);if(!Number.isInteger(week)||week<0||week>MAX_WEEK||!Number.isInteger(month)||month<0||month>MAX_MONTH)return showToast('Weka idadi sahihi ya slots.','error');
 try{let fresh;await fbDb.runTransaction(async tx=>{const ref=dataDocRef('slots'),snap=await tx.get(ref),slots=txItems(snap,[]),today=todayStr();let row=slots.find(x=>x.lineId===lineId&&x.date===today);if(!row){row={lineId,date:today,weekUsed:0,monthUsed:0};slots.push(row)}row.weekUsed=week;row.monthUsed=month;fresh=slots;txWriteItems(tx,'slots',slots)});_cache.slots=fresh;renderReports();renderAll();showToast('Slots za leo zimerekebishwa.','success')}catch(e){await initFirebase();showToast('Slots hazikubadilishwa: '+(e.message||'hitilafu'),'error')}
}

// ---- LINE MANAGEMENT ----
function resetLineMb(lineId){
  const lines = getLines();
  const line  = lines.find(l=>l.id===lineId);
  if(!line) return;
  document.getElementById('confirmMessage').textContent =
    `Reset MB za "${line.name}" kuwa 0? (Wiki: ${fmtMB(line.mbWeek||0)}, Mwezi: ${fmtMB(line.mbMonth||0)})`;
  document.getElementById('confirmBtn').onclick = ()=>{
    const idx = lines.findIndex(l=>l.id===lineId);
    lines[idx].mbWeek  = 0;
    lines[idx].mbMonth = 0;
    saveLines(lines);
    closeModal('modalConfirm');
    showToast(`✓ MB za ${line.name} zimewekwa 0`,'success');
    renderAll();
  };
  openModal('modalConfirm');
}

function resetAllMb(){
  const lines = getLines();
  if(!lines.length) return showToast('Hakuna laini','error');
  document.getElementById('confirmMessage').textContent =
    `Reset MB za laini ZOTE (${lines.length}) kuwa 0? Hii haitabadilisha mauzo au faida zilizohifadhiwa.`;
  document.getElementById('confirmBtn').onclick = ()=>{
    const updated = lines.map(l=>({...l, mbWeek:0, mbMonth:0}));
    saveLines(updated);
    closeModal('modalConfirm');
    showToast(`✓ MB za laini zote ${lines.length} zimewekwa 0`,'success');
    renderAll();
  };
  openModal('modalConfirm');
}

function quickAddMb(type){
  const field = type==='week' ? 'lineMbWeek' : 'lineMbMonth';
  const current = parseFloat(document.getElementById(field).value)||0;
  const add = type==='week' ? 6556 : 13112;
  document.getElementById(field).value = current + add;
}

function onLineRegDateChange(){
  const reg = document.getElementById('lineRegDate').value;
  if(!reg) return;
  // Jaza expiry — miezi 3 baadaye
  const exp = new Date(reg+'T12:00:00');
  exp.setMonth(exp.getMonth() + 3);
  const expStr = exp.toISOString().split('T')[0];
  document.getElementById('lineExpDate').value = expStr;
  const daysLeft = Math.ceil((exp - new Date()) / (1000*60*60*24));
  const prev = document.getElementById('lineExpPreview');
  if(prev) prev.textContent = `Itaisha ${expStr} (siku ${daysLeft} zinazoibaki)`;
}

let _lineOwner = 'self';
function selectLineOwner(owner, el){
  _lineOwner = owner;
  document.querySelectorAll('[data-owner]').forEach(b=>b.classList.toggle('active', b.dataset.owner===owner));
}
function onLineDeviceChange(){
  const dev = document.getElementById('lineDevice').value;
  // Auto-set owner based on device
  const workerDevices = ['OKING','BLACK MOMOFLY','BLUE MOMOFLY'];
  const owner = workerDevices.includes(dev) ? 'worker' : 'self';
  selectLineOwner(owner, null);
  document.querySelectorAll('[data-owner]').forEach(b=>b.classList.toggle('active', b.dataset.owner===owner));
}

function saveLine(){
  const id      = document.getElementById('editLineId').value;
  const name    = document.getElementById('lineName').value.trim();
  const phone   = document.getElementById('linePhone').value.trim();
  const mbWeek  = document.getElementById('lineMbWeek').value;
  const mbMonth = document.getElementById('lineMbMonth').value;
  const regDate = document.getElementById('lineRegDate').value || todayStr();
  const expDate = document.getElementById('lineExpDate').value || (() => {
    const d = new Date(regDate+'T12:00:00'); d.setMonth(d.getMonth()+3);
    return d.toISOString().split('T')[0];
  })();
  const device  = document.getElementById('lineDevice').value;
  const simNo   = document.getElementById('lineSimNo').value;
  const owner   = _lineOwner;

  if(!name)  return showToast('Ingiza jina la laini','error');
  if(!phone) return showToast('Ingiza nambari ya simu','error');
  if(!device) return showToast('Chagua simu','error');

  const lines = getLines();
  if(id){
    const idx = lines.findIndex(l=>l.id===id);
    if(idx>=0){
      lines[idx].name    = name;
      lines[idx].phone   = phone;
      lines[idx].regDate = regDate;
      lines[idx].expDate = expDate;
      lines[idx].device  = device;
      lines[idx].simNo   = simNo;
      lines[idx].owner   = owner;
      if(mbWeek  !== '') lines[idx].mbWeek  = parseFloat(mbWeek)||0;
      if(mbMonth !== '') lines[idx].mbMonth = parseFloat(mbMonth)||0;
    }
    showToast('Laini imesasishwa ✓','success');
  } else {
    lines.push({
      id:uid(), name, phone,
      balance: 0,
      mbWeek:  parseFloat(mbWeek)||0,
      mbMonth: parseFloat(mbMonth)||0,
      regDate, expDate, device, simNo, owner
    });
    showToast('Laini mpya imeongezwa ✓','success');
  }
  saveLines(lines);
  closeModal('modalAddLine');
  renderAll();
}

function editLine(lineId){
  const line=getLines().find(l=>l.id===lineId);if(!line)return;
  document.getElementById('modalLineTitle').textContent='Hariri Laini';
  document.getElementById('editLineId').value=line.id;
  document.getElementById('lineName').value=line.name;
  document.getElementById('linePhone').value=line.phone;
  const bf=document.getElementById('lineBalance');
  bf.value=line.balance||0; bf.disabled=true;
  // Tarehe
  document.getElementById('lineRegDate').value = line.regDate || todayStr();
  document.getElementById('lineExpDate').value  = line.expDate || '';
  onLineRegDateChange();
  // Device na SIM
  document.getElementById('lineDevice').value = line.device || '';
  document.getElementById('lineSimNo').value  = line.simNo  || 'SIM1';
  // Owner
  _lineOwner = line.owner || 'self';
  document.querySelectorAll('[data-owner]').forEach(b=>b.classList.toggle('active', b.dataset.owner===_lineOwner));
  // MB
  document.getElementById('lineMbWeek').value  = line.mbWeek  || 0;
  document.getElementById('lineMbMonth').value = line.mbMonth || 0;
  openModal('modalAddLine');
}

function deleteLine(lineId){
  const line=getLines().find(l=>l.id===lineId);if(!line)return;
  document.getElementById('confirmMessage').textContent=`Je, una uhakika unataka kufuta "${line.name}"? Data zote zitafutwa.`;
  document.getElementById('confirmBtn').onclick=()=>{
    saveLines(getLines().filter(l=>l.id!==lineId));
    closeModal('modalConfirm');showToast('Laini imefutwa','warning');renderAll();
  };
  openModal('modalConfirm');
}

// ============================================================
// FIFO BANDO SYSTEM
// ============================================================
const getBandos  = () => _cache.bandos || [];
const saveBandos = d  => { _cache.bandos = d; saveDocToFirestore('bandos', d); };

function getActiveBandos(lineId){
  return getBandos()
    .filter(b=>b.lineId===lineId && b.active)
    .sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function bandoMbLeft(b){ return Math.max(0, b.totalMb-(b.usedMb||0)); }
function lineMbAvailable(lineId,type){
  // line.mbWeek/mbMonth ndiyo chanzo halisi — inajumuisha MB zote (za zamani + za FIFO)
  const line = getLines().find(l=>l.id===lineId);
  if(!line) return 0;
  return type==='week' ? (line.mbWeek||0) : (line.mbMonth||0);
}

let currentBandoType='week';
function selectBandoType(type){
  currentBandoType=type;
  document.querySelectorAll('[data-btype]').forEach(b=>b.classList.toggle('active',b.dataset.btype===type));
  const bp=document.getElementById('bandoBuyPrice');
  const bm=document.getElementById('bandoTotalMb');
  if(type==='week'){ if(bp)bp.value='5000'; if(bm)bm.value='6556'; }
  else{              if(bp)bp.value='10000';if(bm)bm.value='13112'; }
}

function updateBandoPreview(){
  const lineId=document.getElementById('balanceLine').value;
  const prev=document.getElementById('bandoQueuePreview');
  const list=document.getElementById('bandoQueueList');
  if(!lineId||!prev||!list){if(prev)prev.style.display='none';return;}
  const bandos=getActiveBandos(lineId);
  if(!bandos.length){prev.style.display='none';return;}
  prev.style.display='block';
  list.innerHTML=bandos.map((b,i)=>{
    const left=bandoMbLeft(b);
    const pct=((left/b.totalMb)*100).toFixed(0);
    const col=pct>50?'var(--accent)':pct>20?'var(--warning)':'var(--danger)';
    return`<div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:.6rem .85rem;margin-bottom:.4rem;font-size:.82rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:.3rem">
        <span style="font-weight:600">#${i+1} ${b.type==='week'?'Wiki':'Mwezi'} ${i===0?'<span style="color:var(--accent);font-size:.7rem">← INAYOTUMIKA</span>':''}</span>
        <span style="color:${col};font-weight:700">${fmtMB(left)} zimebaki</span>
      </div>
      <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${col};border-radius:2px"></div>
      </div>
      <div style="color:var(--text3);margin-top:.2rem">${fmtDateTime(b.date)} · Gharama: ${fmt(b.buyPrice)}</div>
    </div>`;
  }).join('');
}

async function buyBando(){
  if(window._savingPurchase)return;window._savingPurchase=true;
  try{const lineId=document.getElementById('balanceLine').value,buyPrice=parseFloat(document.getElementById('bandoBuyPrice').value)||0,totalMb=parseFloat(document.getElementById('bandoTotalMb').value)||0,type=currentBandoType,source=currentBalanceSource;if(!lineId)throw new Error('Chagua laini kwanza');if(!buyPrice)throw new Error('Ingiza bei uliyolipa');if(!totalMb)throw new Error('Ingiza MB ulizopewa');const bando={id:uid(),lineId,type,buyPrice,totalMb,usedMb:0,source,active:true,date:new Date().toISOString()},txn={id:uid(),lineId,type:'add',amount:buyPrice,source,note:`Bando la ${type==='week'?'Wiki':'Mwezi'} — ${fmtMB(totalMb)}`,date:new Date().toISOString()};await fbDb.runTransaction(async tx=>{const refs=['lines','bandos','transactions'].map(dataDocRef),snaps=await Promise.all(refs.map(r=>tx.get(r))),lines=txItems(snaps[0],[]),bandos=txItems(snaps[1],[]),txns=txItems(snaps[2],[]),li=lines.find(x=>x.id===lineId);if(!li)throw new Error('Laini haipo tena.');bandos.push(bando);txns.push(txn);if(type==='week')li.mbWeek=(li.mbWeek||0)+totalMb;else li.mbMonth=(li.mbMonth||0)+totalMb;txWriteItems(tx,'lines',lines);txWriteItems(tx,'bandos',bandos);txWriteItems(tx,'transactions',txns);_cache.lines=lines;_cache.bandos=bandos;_cache.transactions=txns});showToast(`✓ Bando la ${type==='week'?'Wiki':'Mwezi'} (${fmtMB(totalMb)}) limesajiliwa!`,'success');updateBandoPreview();renderTransactions();renderAll();renderCycleStats()}catch(e){await initFirebase();showToast('Ununuzi haujahifadhiwa: '+(e.message||'hakiki mtandao'),'error')}finally{window._savingPurchase=false}
}

// FIFO cost computation — inajumuisha MB za zamani (kabla ya FIFO system)
function computeFifoCost(lineId,type,sellMb){
  const bandos=getActiveBandos(lineId).filter(b=>b.type===type);
  // Hesabu MB za FIFO zilizopo
  const fifMbTotal = bandos.reduce((s,b)=>s+bandoMbLeft(b),0);
  // MB zote halisi (line.mbWeek/mbMonth)
  const line = getLines().find(l=>l.id===lineId);
  const realMbTotal = line ? (type==='week'?(line.mbWeek||0):(line.mbMonth||0)) : 0;

  if(sellMb > realMbTotal) return null; // MB hazitoshi kabisa

  let remaining=sellMb, totalCost=0;
  const used=[];

  // Kwanza toa kutoka FIFO bandos (zina gharama halisi)
  for(const b of bandos){
    if(remaining<=0) break;
    const avail=bandoMbLeft(b);
    const take=Math.min(remaining,avail);
    totalCost+=(take/b.totalMb)*b.buyPrice;
    used.push({bando:b,mbUsed:take});
    remaining-=take;
  }

  // MB zilizobaki (za zamani kabla ya FIFO) — tumia bei ya wastani
  if(remaining>0.5){
    // Bei ya wastani ya aina hii ya bando
    const avgCostPerMb = type==='week' ? (5000/6556) : (10000/13112);
    totalCost += remaining * avgCostPerMb;
    remaining = 0;
  }

  return{totalCost:Math.round(totalCost),used};
}

function applyFifoSell(lineId,type,sellMb){
  const result=computeFifoCost(lineId,type,sellMb);
  if(!result) return null;
  const bandos=getBandos();
  const usedBandos=[];
  for(const{bando,mbUsed}of result.used){
    const idx=bandos.findIndex(b=>b.id===bando.id);
    if(idx>=0){
      bandos[idx].usedMb=(bandos[idx].usedMb||0)+mbUsed;
      if(bandoMbLeft(bandos[idx])<=0.5) bandos[idx].active=false;
      usedBandos.push({bandoId:bando.id, mbUsed});
    }
  }
  saveBandos(bandos);
  const lines=getLines(),li=lines.findIndex(l=>l.id===lineId);
  if(li>=0){
    if(type==='week') lines[li].mbWeek=Math.max(0,(lines[li].mbWeek||0)-sellMb);
    else              lines[li].mbMonth=Math.max(0,(lines[li].mbMonth||0)-sellMb);
    saveLines(lines);
  }
  return {totalCost:result.totalCost, usedBandos};
}

function reverseFifoSell(lineId, type, sellMb, usedBandos){
  const bandos=getBandos();
  (usedBandos||[]).forEach(({bandoId,mbUsed})=>{
    const idx=bandos.findIndex(b=>b.id===bandoId);
    if(idx>=0){
      bandos[idx].usedMb=Math.max(0,(bandos[idx].usedMb||0)-mbUsed);
      bandos[idx].active=true;
    }
  });
  saveBandos(bandos);
  const lines=getLines(),li=lines.findIndex(l=>l.id===lineId);
  if(li>=0){
    if(type==='week') lines[li].mbWeek=(lines[li].mbWeek||0)+sellMb;
    else              lines[li].mbMonth=(lines[li].mbMonth||0)+sellMb;
    saveLines(lines);
  }
}

function decrementLineSlot(lineId,type){
  const slots=getSlots(),today=todayStr();
  const idx=slots.findIndex(s=>s.lineId===lineId&&s.date===today);
  if(idx>=0){
    if(type==='week') slots[idx].weekUsed=Math.max(0,slots[idx].weekUsed-1);
    else              slots[idx].monthUsed=Math.max(0,slots[idx].monthUsed-1);
    saveSlots(slots);
  }
}

let currentBalanceSource='faida';
function selectBalanceSource(src){
  currentBalanceSource=src;
  document.querySelectorAll('[data-src]').forEach(b=>b.classList.toggle('active',b.dataset.src===src));
}
function addBalance(){ buyBando(); }
function updateBalancePage(){ renderTransactions(); }
function updateBalancePreview(){ updateBandoPreview(); }
function previewNewBalance(){}

// ---- SELL ----
function selectBundleType(type){
  currentBundleType=type;
  document.querySelectorAll('.type-btn').forEach(b=>b.classList.toggle('active',b.dataset.type===type));
  buildSellGbShortcuts();
  renderSellPriceChoices();
  updateSellSlotInfo();
  updateSellMbStatus();
}

// ---- PROFIT PIN SYSTEM ----
let PROFIT_PIN_HASH = localStorage.getItem('bm_profit_pin') || hashPin('0000');
let profitPinEntry  = '';
let profitVisible   = false;


function saveProfitPin(hash){ localStorage.setItem('bm_profit_pin',hash); PROFIT_PIN_HASH=hash; }

function toggleProfitView(){
  if(profitVisible){ hideProfitInfo(); return; }
  openProfitPinModal();
}

function openProfitPinModal(){
  profitPinEntry='';
  buildProfitPinKeypad();
  renderProfitPinDots();
  document.getElementById('profitPinError').style.display='none';
  openModal('modalProfitPin');
}

function buildProfitPinKeypad(){
  const keys=['1','2','3','4','5','6','7','8','9','C','0','⌫'];
  const box=document.getElementById('profitPinKeypad');
  box.innerHTML=keys.map(k=>`
    <button type="button" class="pp-key" onclick="profitPinPress('${k}')">${k}</button>`).join('');
}

function renderProfitPinDots(){
  const box=document.getElementById('profitPinDots');
  box.innerHTML=[0,1,2,3].map(i=>`<div class="pp-dot${i<profitPinEntry.length?' filled':''}"></div>`).join('');
}

function profitPinPress(k){
  if(k==='C'){profitPinEntry='';renderProfitPinDots();return}
  if(k==='⌫'){profitPinEntry=profitPinEntry.slice(0,-1);renderProfitPinDots();return}
  if(profitPinEntry.length>=4) return;
  profitPinEntry+=k;
  renderProfitPinDots();
  if(profitPinEntry.length===4){
    if(hashPin(profitPinEntry)===PROFIT_PIN_HASH){
      closeModal('modalProfitPin');
      showProfitInfo();
    } else {
      document.getElementById('profitPinError').style.display='block';
      setTimeout(()=>{profitPinEntry='';renderProfitPinDots();document.getElementById('profitPinError').style.display='none';},1000);
    }
  }
}

function showProfitInfo(){
  profitVisible=true;
  // Dashboard
  const locked   = document.getElementById('dashLocked');
  const unlocked = document.getElementById('dashUnlocked');
  const eyeBtn   = document.getElementById('dashEyeBtn');
  const eyeLabel = document.getElementById('dashEyeLabel');
  if(locked)   locked.style.display='none';
  if(unlocked) unlocked.style.display='block';
  if(eyeBtn)   eyeBtn.style.color='var(--accent)';
  if(eyeLabel) eyeLabel.textContent='Ficha Takwimu';
  // Ripoti
  const rptLocked   = document.getElementById('rptLocked');
  const rptUnlocked = document.getElementById('rptUnlocked');
  const rptEyeBtn   = document.getElementById('rptEyeBtn');
  const rptEyeLabel = document.getElementById('rptEyeLabel');
  if(rptLocked)   rptLocked.style.display='none';
  if(rptUnlocked) rptUnlocked.style.display='block';
  if(rptEyeBtn)   rptEyeBtn.style.color='var(--accent)';
  if(rptEyeLabel) rptEyeLabel.textContent='Ficha Ripoti';
  // Wateja
  const custEyeLbl = document.getElementById('custEyeLabel');
  if(custEyeLbl) custEyeLbl.textContent='Ficha Mapato';
  if(document.getElementById('page-customers')?.classList.contains('active')) renderCustomers();
  // Calculator
  const calcLocked  = document.getElementById('calcResultLocked');
  const calcRecLock = document.getElementById('calcRecordsLocked');
  const calcRecList = document.getElementById('calcRecordsList');
  const calcEyeLbl  = document.getElementById('calcEyeLabel');
  if(calcLocked)  calcLocked.style.display='none';
  if(calcRecLock) calcRecLock.style.display='none';
  if(calcRecList) calcRecList.style.display='block';
  if(calcEyeLbl)  calcEyeLbl.textContent='Ficha Faida';
  calcCompute();
  // Cycle stats
  const cycLocked   = document.getElementById('cycLocked');
  const cycUnlocked = document.getElementById('cycUnlocked');
  const cycLabel    = document.getElementById('cycEyeLabel');
  if(cycLocked)   cycLocked.style.display='none';
  if(cycUnlocked) cycUnlocked.style.display='block';
  if(cycLabel)    cycLabel.textContent='Ficha';
  // Sell page profit
  const h=document.getElementById('profitHidden');
  const v=document.getElementById('profitVisible');
  const btn=document.getElementById('profitEyeBtn');
  if(h) h.style.display='none';
  if(v) v.style.display='block';
  if(btn){btn.textContent='🙈 Ficha';btn.style.color='var(--accent)'}

  renderDashboard();
  renderReports();
  renderCycleStats();
}

function hideProfitInfo(){
  profitVisible=false;
  // Dashboard
  const locked   = document.getElementById('dashLocked');
  const unlocked = document.getElementById('dashUnlocked');
  const eyeBtn   = document.getElementById('dashEyeBtn');
  const eyeLabel = document.getElementById('dashEyeLabel');
  if(locked)   locked.style.display='block';
  if(unlocked) unlocked.style.display='none';
  if(eyeBtn)   eyeBtn.style.color='';
  if(eyeLabel) eyeLabel.textContent='Ona Takwimu';
  // Ripoti
  const rptLocked   = document.getElementById('rptLocked');
  const rptUnlocked = document.getElementById('rptUnlocked');
  const rptEyeBtn   = document.getElementById('rptEyeBtn');
  const rptEyeLabel = document.getElementById('rptEyeLabel');
  if(rptLocked)   rptLocked.style.display='block';
  if(rptUnlocked) rptUnlocked.style.display='none';
  if(rptEyeBtn)   rptEyeBtn.style.color='';
  if(rptEyeLabel) rptEyeLabel.textContent='Ona Ripoti';
  // Wateja
  const custEyeLbl2 = document.getElementById('custEyeLabel');
  if(custEyeLbl2) custEyeLbl2.textContent='Ona Mapato';
  if(document.getElementById('page-customers')?.classList.contains('active')) renderCustomers();
  // Calculator
  const calcLocked2  = document.getElementById('calcResultLocked');
  const calcRecLock2 = document.getElementById('calcRecordsLocked');
  const calcRecList2 = document.getElementById('calcRecordsList');
  const calcEyeLbl2  = document.getElementById('calcEyeLabel');
  if(calcLocked2)  calcLocked2.style.display='none'; // inaonekana tu ukijaribu kuhesabu
  if(calcRecLock2) calcRecLock2.style.display='block';
  if(calcRecList2) calcRecList2.style.display='none';
  if(calcEyeLbl2)  calcEyeLbl2.textContent='Ona Faida';
  document.getElementById('calcResultBox').style.display='none';
  // Cycle stats
  const cycLocked2   = document.getElementById('cycLocked');
  const cycUnlocked2 = document.getElementById('cycUnlocked');
  const cycLabel2    = document.getElementById('cycEyeLabel');
  if(cycLocked2)   cycLocked2.style.display='block';
  if(cycUnlocked2) cycUnlocked2.style.display='none';
  if(cycLabel2)    cycLabel2.textContent='Ona';
  // Sell page profit
  const h=document.getElementById('profitHidden');
  const v=document.getElementById('profitVisible');
  const btn=document.getElementById('profitEyeBtn');
  if(h) h.style.display='block';
  if(v) v.style.display='none';
  if(btn){btn.textContent='👁 Ona';btn.style.color=''}
  renderDashboardLocked();
}

function updateProfitPreview(){
  renderSellPriceChoices();
  const sellMb=parseFloat(document.getElementById('sellMbAmount')?.value)||0;
  const amount=parseFloat(document.getElementById('sellAmount')?.value)||0;
  const type=currentBundleType,lineId=document.getElementById('sellLine')?.value;
  const fifo=lineId&&sellMb?computeFifoCost(lineId,type,sellMb):null;
  const estimatedRate=type==='week'?5000/6556:10000/13112;
  const costShare=fifo?fifo.totalCost:(sellMb>0?Math.round(sellMb*estimatedRate):0);
  const profit=amount-costShare;
  // Update hidden profit fields (shown only after PIN)
  const ppCost   = document.getElementById('ppCost');
  const ppRev    = document.getElementById('ppRevenue');
  const ppProfit = document.getElementById('ppProfit');
  if(ppCost)   ppCost.textContent   = fmt(costShare);
  if(ppRev)    ppRev.textContent    = fmt(amount);
  if(ppProfit){
    ppProfit.textContent  = fmt(profit);
    ppProfit.style.color  = profit>=0?'var(--success)':'var(--danger)';
  }
  updateSellMbStatus();
}



function updateSellSlotInfo(){
  const lineId=document.getElementById('sellLine').value;
  const box=document.getElementById('sellSlotInfo');
  if(!lineId){box.style.display='none';return}
  const line=getLines().find(l=>l.id===lineId);
  if(!line){box.style.display='none';return}
  const slots=getLineSlots(lineId);
  const wLeft=MAX_WEEK-slots.weekUsed,mLeft=MAX_MONTH-slots.monthUsed;
  box.style.display='block';
  box.innerHTML=`
    <div class="sib-row"><span class="sib-label">Salio la Laini</span><span class="sib-val">${fmt(line.balance)}</span></div>
    <div class="sib-row"><span class="sib-label">Slots za Wiki zilizobaki</span><span class="sib-val ${wLeft===0?'full':'ok'}">${wLeft}/${MAX_WEEK}</span></div>
    <div class="sib-row"><span class="sib-label">Slots za Mwezi zilizobaki</span><span class="sib-val ${mLeft===0?'full':'ok'}">${mLeft}/${MAX_MONTH}</span></div>`;
}

// ============================================================
// NEXTSMS — SMS INTEGRATION
// ============================================================
const NEXTSMS_WORKER_URL = 'https://nextsms-proxy.hanshannu9.workers.dev';

function buildSmsMessage(gb, amount){
  return `Hongera! Bando lako la ${gb} limewekwa kwenye namba yako. Furahia internet bila wasiwasi! Asante kwa kuchagua SMART BUNDLES.`;
}

async function sendNextSMS(phone, message){
  // Standardize phone — ensure starts with 255
  let recipient = phone.replace(/\s+/g,'');
  if(recipient.startsWith('0')) recipient = '255' + recipient.slice(1);
  if(recipient.startsWith('+')) recipient = recipient.slice(1);

  try {
    const res = await fetch(NEXTSMS_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: recipient, text: message })
    });
    const data = await res.json();
    if(res.ok && !data.error){
      showToast(`📱 SMS imetumwa kwa ${phone} ✓`, 'success');
      return true;
    } else {
      console.error('NextSMS error:', data);
      showToast(`⚠️ SMS haikutumwa: ${data.description||data.error||'Jaribu tena'}`, 'warning');
      return false;
    }
  } catch(e){
    console.error('SMS fetch error:', e);
    showToast('⚠️ SMS haikutumwa — angalia mtandao', 'warning');
    return false;
  }
}

// ---- SELL PAGE MB FUNCTIONS ----
function buildSellGbShortcuts(){
  const type   = currentBundleType;
  const lineId = document.getElementById('sellLine').value;
  const availMb = lineId ? lineMbAvailable(lineId, type) : 99999;
  const box    = document.getElementById('sellGbShortcuts');
  if(!box) return;
  const opts = type==='week'
    ? [{gb:0.5,mb:512},{gb:0.75,mb:768},{gb:1,mb:1024},{gb:2,mb:2048},{gb:3,mb:3072},{gb:4,mb:4096},{gb:5,mb:5120},{gb:6,mb:6144},{gb:7,mb:7168},{gb:8,mb:8192},{gb:9,mb:9216}]
    : calcMonthOptions(availMb);
  box.innerHTML = opts.map(o=>{
    const can = o.mb <= availMb;
    return `<button type="button" class="type-btn${!can?' style="opacity:.4;pointer-events:none"':''}"
      onclick="selectSellGb(${o.gb},${o.mb},'${type}')">
      GB${o.gb}
    </button>`;
  }).join('');
}

function sellPriceChoices(type,mb){
  if(type==='week'&&Number(mb)===1024)return[{price:1500,label:'Bei ya awali',tier:'standard'},{price:1700,label:'Bei mpya',tier:'premium'}];
  if(type==='week'&&Number(mb)===2048)return[{price:2500,label:'Bei ya awali',tier:'standard'},{price:3000,label:'Bei mpya',tier:'premium'}];
  return[];
}
function salePriceTier(type,mb,price){const choices=sellPriceChoices(type,mb);return choices.find(x=>x.price===Number(price))?.tier||(choices.length?'custom':'standard')}
function renderSellPriceChoices(){
  const wrap=document.getElementById('sellPriceOptions'),box=document.getElementById('sellPriceChoiceButtons');
  if(!wrap||!box)return;
  const mb=Number(document.getElementById('sellMbAmount')?.value)||0,type=currentBundleType,choices=sellPriceChoices(type,mb);
  wrap.style.display=choices.length?'block':'none';
  if(!choices.length){box.innerHTML='';return}
  const current=Number(document.getElementById('sellAmount')?.value)||0;
  box.innerHTML=choices.map(o=>'<button type="button" class="type-btn'+(current===o.price?' active':'')+'" onclick="selectSellPrice('+o.price+')">'+o.label+' · '+fmt(o.price)+'</button>').join('');
}
function selectSellPrice(price){document.getElementById('sellAmount').value=price;updateProfitPreview()}
function selectSellGb(gb, mb, type){
  document.getElementById('sellMbAmount').value=mb;
  let price=calcPriceForMB(type,mb);
  if(type==='week'&&gb===0.5)price=700;
  if(type==='week'&&gb===0.75)price=1000;
  if(!price)price='';
  document.getElementById('sellAmount').value=price;
  updateProfitPreview();
}

function onSellMbInput(){
  updateProfitPreview();
  updateSellMbStatus();
}

function updateSellMbStatus(){
  const lineId = document.getElementById('sellLine').value;
  const type   = currentBundleType;
  const box    = document.getElementById('sellMbStatus');
  if(!lineId){box.style.display='none';return}
  // Tumia FIFO MB — sio line.mbWeek/mbMonth
  const totalMb = lineMbAvailable(lineId, type);
  const sellMb  = parseFloat(document.getElementById('sellMbAmount').value)||0;
  const leftMb  = Math.max(0, totalMb - sellMb);
  const pct     = totalMb > 0 ? Math.min(100,(leftMb/totalMb)*100) : 0;
  const col     = pct>50?'var(--accent)':pct>20?'var(--warning)':'var(--danger)';
  box.style.display='block';
  document.getElementById('sellLineMbLeft').textContent = fmtMB(leftMb)+' itabaki';
  document.getElementById('sellLineMbLeft').style.color = col;
  document.getElementById('sellLineMbBar').style.width  = pct+'%';
  document.getElementById('sellLineMbBar').style.background = col;
  document.getElementById('sellLineMbTotal').textContent =
    `Jumla ya ${type==='week'?'Wiki':'Mwezi'} (FIFO): ${fmtMB(totalMb)}`;
}

function updateSellSlotInfo(){
  const lineId=document.getElementById('sellLine').value;
  const box=document.getElementById('sellSlotInfo');
  if(!lineId){box.style.display='none';document.getElementById('sellMbStatus').style.display='none';return}
  const line=getLines().find(l=>l.id===lineId);
  if(!line){box.style.display='none';return}
  const slots=getLineSlots(lineId);
  const wLeft=MAX_WEEK-slots.weekUsed,mLeft=MAX_MONTH-slots.monthUsed;
  const wMb = lineMbAvailable(lineId,'week');
  const mMb = lineMbAvailable(lineId,'month');
  box.style.display='block';
  box.innerHTML=`
    <div class="sib-row"><span class="sib-label">Slots za Wiki zilizobaki</span><span class="sib-val ${wLeft===0?'full':'ok'}">${wLeft}/${MAX_WEEK}</span></div>
    <div class="sib-row"><span class="sib-label">Slots za Mwezi zilizobaki</span><span class="sib-val ${mLeft===0?'full':'ok'}">${mLeft}/${MAX_MONTH}</span></div>
    <div class="sib-row"><span class="sib-label">📶 MB za Wiki (FIFO)</span><span class="sib-val ${wMb>0?'ok':'full'}">${fmtMB(wMb)}</span></div>
    <div class="sib-row"><span class="sib-label">📶 MB za Mwezi (FIFO)</span><span class="sib-val ${mMb>0?'ok':'full'}">${fmtMB(mMb)}</span></div>`;
  buildSellGbShortcuts();
  renderSellPriceChoices();
  updateSellMbStatus();
}

async function sellBundle(){
 if(window._savingSale)return;window._savingSale=true;
 try{const lineId=document.getElementById('sellLine').value,sellMb=parseFloat(document.getElementById('sellMbAmount').value)||0,amount=parseFloat(document.getElementById('sellAmount').value),buyer=document.getElementById('sellBuyerPhone').value.trim(),type=currentBundleType;if(!lineId)throw new Error('Chagua laini');if(!sellMb)throw new Error('Ingiza MB unazouza');if(!amount||amount<=0)throw new Error('Ingiza bei ya kuuza');const saleId=uid(),date=new Date().toISOString();let sale;await fbDb.runTransaction(async tx=>{const names=['lines','bandos','slots','sales'],snaps=await Promise.all(names.map(n=>tx.get(dataDocRef(n)))),lines=txItems(snaps[0],[]),bandos=txItems(snaps[1],[]),slots=txItems(snaps[2],[]),sales=txItems(snaps[3],[]),line=lines.find(x=>x.id===lineId);if(!line)throw new Error('Laini haipo tena.');const fifo=txFifoCost(lines,bandos,lineId,type,sellMb);if(!fifo)throw new Error('MB haitoshi tena kwenye laini hii.');txIncrementSlot(slots,lineId,type);txApplyFifo(lines,bandos,lineId,type,sellMb,fifo.usedBandos);sale={id:saleId,lineId,lineName:line.name,linePhone:line.phone,type,costPrice:fifo.totalCost,sellingPrice:amount,priceTier:salePriceTier(type,sellMb,amount),profit:amount-fifo.totalCost,mb:fmtMB(sellMb),sellMb,usedBandos:fifo.usedBandos,buyerPhone:buyer||null,date};sales.push(sale);['lines','bandos','slots','sales'].forEach((n,i)=>txWriteItems(tx,n,[lines,bandos,slots,sales][i]));_cache.lines=lines;_cache.bandos=bandos;_cache.slots=slots;_cache.sales=sales});document.getElementById('sellMbAmount').value='';document.getElementById('sellAmount').value='';document.getElementById('sellBuyerPhone').value='';document.getElementById('sellMbStatus').style.display='none';showToast(`✓ ${sale.mb} imerekodiwa — Bei: ${fmt(amount)}`,'success');const smsOn=document.getElementById('smsToggle')?.checked!==false;if(buyer&&smsOn)openSellSmsModal(buyer,buildSmsMessage(sale.mb,amount),sale.mb,amount);else{renderAll();updateSellSlotInfo();renderTodaySales()}}catch(e){await initFirebase();showToast('Mauzo hayajahifadhiwa: '+(e.message||'hakiki mtandao'),'error')}finally{window._savingSale=false}
}

async function editSalePrice(id){
 const sale=getSales().find(x=>x.id===id);if(!sale)return;const raw=prompt(`Bei mpya ya mauzo ${sale.mb||''} (TSh):`,String(sale.sellingPrice??sale.amount??''));if(raw===null)return;const price=Number(raw);if(!Number.isFinite(price)||price<=0)return showToast('Bei si sahihi.','error');
 try{let fresh;await fbDb.runTransaction(async tx=>{const ref=dataDocRef('sales'),snap=await tx.get(ref),sales=txItems(snap,[]),row=sales.find(x=>x.id===id);if(!row)throw new Error('Rekodi haipo tena.');if(row.orderNo)throw new Error('Mauzo ya oda yaharishe kupitia sehemu ya Orders.');row.sellingPrice=price;row.priceTier=salePriceTier(row.type,row.sellMb||row.mb,price);row.profit=price-(Number(row.costPrice)||0);fresh=sales;txWriteItems(tx,'sales',sales)});_cache.sales=fresh;renderReports();renderTodaySales();showToast('Bei ya mauzo imehaririwa.','success')}catch(e){await initFirebase();showToast('Mauzo hayakuhaririwa: '+e.message,'error')}
}
function saleMbNumber(sale){if(Number(sale.sellMb)>0)return Number(sale.sellMb);const text=String(sale.mb||'');const n=parseFloat(text)||0;return /GB/i.test(text)?n*1024:n}
function deleteSale(id){
 const sale=getSales().find(x=>x.id===id);if(!sale)return;if(sale.orderNo)return showToast('Mauzo ya oda yashughulikiwe kupitia sehemu ya Orders.','warning');
 document.getElementById('confirmMessage').textContent=`Futa mauzo ${sale.mb||''} ya ${sale.lineName||'laini'}? MB zitarudishwa. Slot ya leo itarekebishwa ikiwa mauzo ni ya leo.`;
 document.getElementById('confirmBtn').onclick=async()=>{try{await fbDb.runTransaction(async tx=>{const names=['sales','lines','bandos','slots'],snaps=await Promise.all(names.map(n=>tx.get(dataDocRef(n)))),sales=txItems(snaps[0],[]),lines=txItems(snaps[1],[]),bandos=txItems(snaps[2],[]),slots=txItems(snaps[3],[]),idx=sales.findIndex(x=>x.id===id);if(idx<0)throw new Error('Mauzo hayapo tena.');const row=sales[idx],mb=saleMbNumber(row),line=lines.find(x=>x.id===row.lineId);if(!line||!mb)throw new Error('Laini au kiasi cha MB hakijulikani; hakuna kilichofutwa.');if(Array.isArray(row.usedBandos)&&row.usedBandos.length){for(const u of row.usedBandos){const b=bandos.find(x=>x.id===u.bandoId);if(b){b.usedMb=Math.max(0,(b.usedMb||0)-u.mbUsed);b.active=true}}}else if(row.type==='week')line.mbWeek=(line.mbWeek||0)+mb;else line.mbMonth=(line.mbMonth||0)+mb;if(dateKeyLocal(row.date)===todayStr())txDecrementSlot(slots,row.lineId,row.type);sales.splice(idx,1);['sales','lines','bandos','slots'].forEach((n,i)=>txWriteItems(tx,n,[sales,lines,bandos,slots][i]))});await initFirebase();closeModal('modalConfirm');renderReports();renderAll();showToast('Mauzo yamefutwa; MB na slot ya leo zimerekebishwa.','success')}catch(e){await initFirebase();closeModal('modalConfirm');showToast('Mauzo hayakufutwa: '+e.message,'error')}};openModal('modalConfirm')
}

// ---- TODAY SALES ----
function getTodaySales(){
  const today=todayStr();return getSales().filter(s=>dateKeyLocal(s.date)===today);
}
function renderTodaySales(){
  const el=document.getElementById('todaySalesList');if(!el)return;
  const list=getTodaySales().slice().reverse();
  if(!list.length){el.innerHTML='<div class="empty-state">Hakuna mauzo leo bado.</div>';return}
  el.innerHTML=list.map(s=>{
    const rev=s.sellingPrice??s.amount??0,cost=s.costPrice??0,profit=s.profit??(rev-cost);
    const buyerTag = s.buyerPhone
      ? `<span onclick="showCustomerHistory('${s.buyerPhone}')"
          style="color:var(--accent);cursor:pointer;text-decoration:underline;font-size:.78rem"
          title="Bonyeza kuona historia ya mteja">📱 ${s.buyerPhone}</span>`
      : '';
    return`<div class="list-item">
      <div class="list-item-left">
        <div class="li-title">${s.lineName} ${buyerTag}</div>
        <div class="li-sub">${fmtDateTime(s.date)}${s.mb?' · '+s.mb:''} · Gharama: ${fmt(cost)}</div>
      </div>
      <div class="list-item-right">
        <div class="li-amount">${fmt(rev)}</div>
        <div style="font-size:.75rem;color:var(--success);font-weight:600">+${fmt(profit)}</div>
        <span class="li-badge ${s.type}">${s.type==='week'?'Wiki':'Mwezi'}</span>
      </div>
    </div>`;
  }).join('');
}

// ---- LINE CARDS ----
function buildLineCard(line,showActions){
  const slots=getLineSlots(line.id),wUsed=slots.weekUsed,mUsed=slots.monthUsed;
  const isFull=wUsed>=MAX_WEEK&&mUsed>=MAX_MONTH;
  const wb=[0,1].map(i=>`<div class="slot-bar${i<wUsed?(wUsed>=MAX_WEEK?' used full':' used'):''}"></div>`).join('');
  const mb=[0,1].map(i=>`<div class="slot-bar${i<mUsed?(mUsed>=MAX_MONTH?' used full':' used'):''}"></div>`).join('');
  // MB status
  const mbWeek  = line.mbWeek  || 0;
  const mbMonth = line.mbMonth || 0;
  const totalMb = mbWeek + mbMonth;
  const mbPct   = totalMb > 0 ? Math.min(100, (totalMb / (mbWeek + mbMonth + 1)) * 100) : 0;
  const mbColor = totalMb > 5120 ? 'ok' : totalMb > 1024 ? 'mid' : 'low';
  const mbBar = totalMb > 0 ? `
    <div class="mb-bar-wrap">
      <div style="display:flex;justify-content:space-between;font-size:.75rem;margin-bottom:.25rem">
        <span style="color:var(--text2)">MB Zilizobaki</span>
        <span style="font-weight:700;color:${mbColor==='ok'?'var(--accent)':mbColor==='mid'?'var(--warning)':'var(--danger)'}">${fmtMB(totalMb)}</span>
      </div>
      <div style="display:flex;gap:.35rem;font-size:.7rem;color:var(--text3)">
        ${mbWeek>0?`<span>Wiki: ${fmtMB(mbWeek)}</span>`:''}
        ${mbWeek>0&&mbMonth>0?'<span>·</span>':''}
        ${mbMonth>0?`<span>Mwezi: ${fmtMB(mbMonth)}</span>`:''}
      </div>
    </div>` : `<div style="font-size:.75rem;color:var(--text3);margin-bottom:.5rem">Hakuna MB — ongeza bando</div>`;

  // Device/SIM/Owner badge
  const ownerBadge = line.owner==='worker'
    ? `<span style="font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;background:rgba(251,191,36,.15);color:var(--warning)">🤖 Assistant</span>`
    : `<span style="font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;background:rgba(0,196,167,.12);color:var(--accent)">👤 Wangu</span>`;
  const deviceBadge = line.device
    ? `<span style="font-size:.65rem;padding:.1rem .4rem;border-radius:4px;background:var(--bg3);color:var(--text2);margin-left:.3rem">${line.simNo||'SIM1'} · ${line.device}</span>`
    : '';
  if(line.expDate){
    const expD    = new Date(line.expDate+'T12:00:00');
    const today2  = new Date(); today2.setHours(0,0,0,0);
    const dLeft   = Math.ceil((expD - today2)/(1000*60*60*24));
    const expCol  = dLeft<=7?'var(--danger)':dLeft<=30?'var(--warning)':'var(--text2)';
    const expIcon = dLeft<=7?'🔴':dLeft<=30?'🟡':'🟢';
    const regStr  = line.regDate ? `Ilisajiliwa: ${line.regDate}` : '';
    expiryHtml = `<div style="font-size:.72rem;margin-top:.4rem;display:flex;justify-content:space-between">
      <span style="color:var(--text3)">${regStr}</span>
      <span style="color:${expCol};font-weight:600">${expIcon} Inaisha: ${line.expDate} ${dLeft>0?'(siku '+dLeft+')':'(IMEKWISHA)'}</span>
    </div>`;
  }
  const actions=showActions?`<div class="line-actions" style="margin-top:.85rem">
    <button class="btn btn-ghost btn-sm" onclick="editLine('${line.id}')">✏️ Hariri/Ongeza MB</button>
    <button class="btn btn-ghost btn-sm" onclick="resetLineMb('${line.id}')" style="border-color:var(--warning);color:var(--warning)">🔄 Reset MB</button>
    <button class="btn btn-danger btn-sm" onclick="deleteLine('${line.id}')">🗑 Futa</button>
  </div>`:'';
  return`<div class="line-card${isFull?' full':''}">
    <div class="line-card-header">
      <div>
        <div class="line-card-name">${line.name}</div>
        <div class="line-card-phone" style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;margin-top:.2rem">
          ${line.phone}${deviceBadge}${ownerBadge}
        </div>
      </div>
      ${isFull?'<span class="full-badge">FULL</span>':''}
    </div>
    ${expiryHtml}
    ${mbBar}
    <div class="slots-row" style="margin-top:.5rem">
      <div class="slot-pill"><div class="slot-pill-label">Wiki</div><div class="slot-pill-val ${wUsed>=MAX_WEEK?'full':'ok'}">${wUsed}/${MAX_WEEK}</div><div class="slot-bars">${wb}</div></div>
      <div class="slot-pill"><div class="slot-pill-label">Mwezi</div><div class="slot-pill-val ${mUsed>=MAX_MONTH?'full':'ok'}">${mUsed}/${MAX_MONTH}</div><div class="slot-bars">${mb}</div></div>
    </div>
    ${actions}
  </div>`;
}

// ---- DASHBOARD ----
function renderMbWarning(){
  const lines = getLines();
  const warn  = lines.filter(l=>{
    const total = (l.mbWeek||0) + (l.mbMonth||0);
    return total > 0 && total < 1024;
  });
  const html = warn.length
    ? `<div style="background:rgba(239,68,68,.1);border:1.5px solid rgba(239,68,68,.4);border-radius:10px;padding:.85rem 1rem">
        <div style="font-weight:700;color:var(--danger);margin-bottom:.4rem">⚠️ Laini ${warn.length} zina MB chini ya 1GB!</div>
        ${warn.map(l=>{
          const mb=(l.mbWeek||0)+(l.mbMonth||0);
          return `<div style="display:flex;justify-content:space-between;font-size:.83rem;padding:.25rem 0;border-top:1px solid rgba(239,68,68,.2)">
            <span style="color:var(--text)">${l.name}</span>
            <span style="color:var(--danger);font-weight:700">${fmtMB(mb)} zimebaki</span>
          </div>`;
        }).join('')}
        <div style="font-size:.75rem;color:var(--text3);margin-top:.4rem">Nunua bando haraka ili kuendelea kutoa huduma</div>
      </div>`
    : '';
  ['mbWarningAlert','mbWarningAlertUnlocked'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.innerHTML=html; el.style.display=warn.length?'block':'none'; }
  });
}

function renderDashboardLocked(){
  const lines = getLines();
  const el    = document.getElementById('dashboardLinesLocked');
  if(!el) return;
  el.innerHTML = lines.length
    ? lines.map(l=>buildLineCard(l,false)).join('')
    : '<div class="empty-state">Bado haujasajili laini. Nenda kwenye "Laini" kuanza.</div>';
  renderMbWarning();
}

function renderDashboard(){
  const lines=getLines(),ts=getTodaySales();
  const totalBal=lines.reduce((s,l)=>s+(l.balance||0),0);
  const totalRev=ts.reduce((s,t)=>s+(t.sellingPrice??t.amount??0),0);
  const totalCost=ts.reduce((s,t)=>s+(t.costPrice??0),0);
  const totalProfit=ts.reduce((s,t)=>s+(t.profit??((t.sellingPrice??t.amount??0)-(t.costPrice??0))),0);
  const fullLines=lines.filter(l=>{const sl=getLineSlots(l.id);return sl.weekUsed>=MAX_WEEK&&sl.monthUsed>=MAX_MONTH});
  const totalMbWeek=lines.reduce((s,l)=>s+(l.mbWeek||0),0);
  const totalMbMonth=lines.reduce((s,l)=>s+(l.mbMonth||0),0);
  // Jumla ya MB/GB zilizopo (bado hazijauzwa) kwenye laini zote — taarifa ya
  // hisa (stock), si faida, hivyo inaonekana hata kama PIN ya faida haijafunguliwa
  const totalMbAvailEl      = document.getElementById('statTotalMbAvailable');
  const totalMbWeekAvailEl  = document.getElementById('statTotalMbWeekAvail');
  const totalMbMonthAvailEl = document.getElementById('statTotalMbMonthAvail');
  if(totalMbAvailEl)      totalMbAvailEl.textContent      = fmtMB(totalMbWeek+totalMbMonth);
  if(totalMbWeekAvailEl)  totalMbWeekAvailEl.textContent  = fmtMB(totalMbWeek);
  if(totalMbMonthAvailEl) totalMbMonthAvailEl.textContent = fmtMB(totalMbMonth);
  const H='••••';
  document.getElementById('statTotalBalance').textContent=fmt(totalBal);
  document.getElementById('statTodaySales').textContent=fmt(totalRev);
  document.getElementById('statTodayCount').textContent=ts.length+' mauzo';
  document.getElementById('statTodayProfit').textContent=profitVisible?fmt(totalProfit):H;
  document.getElementById('statTodayCost').textContent=profitVisible?'Gharama: '+fmt(totalCost):'Gharama: ••••';
  document.getElementById('statLineCount').textContent=lines.length;
  document.getElementById('statFullLines').textContent=fullLines.length;
  // GB zilizouzwa
  const todayMb = ts.reduce((s,t)=>s+(t.sellMb||0),0);
  const allMb   = getSales().reduce((s,t)=>s+(t.sellMb||0),0);
  const fmtGb   = mb => mb>=1024 ? (mb/1024).toFixed(1)+' GB' : Math.round(mb)+' MB';
  const gbTodayEl = document.getElementById('statGbToday');
  const gbAllEl   = document.getElementById('statGbAll');
  const mbTodayEl = document.getElementById('statMbToday');
  const mbAllEl   = document.getElementById('statMbAll');
  if(gbTodayEl) gbTodayEl.textContent = fmtGb(todayMb);
  if(gbAllEl)   gbAllEl.textContent   = fmtGb(allMb);
  if(mbTodayEl) mbTodayEl.textContent = Math.round(todayMb)+' MB leo';
  if(mbAllEl)   mbAllEl.textContent   = Math.round(allMb)+' MB jumla';
  const ap=document.getElementById('statAllTimeProfit');
  const ar=document.getElementById('statAllTimeReinvest');
  if(ap){ap.textContent=fmtMB(totalMbWeek+totalMbMonth);ap.style.fontSize='1.1rem';}
  if(ar) ar.textContent=`Wiki: ${fmtMB(totalMbWeek)} · Mwezi: ${fmtMB(totalMbMonth)}`;
  const grid=document.getElementById('dashboardLines');
  if(grid) grid.innerHTML=lines.length?lines.map(l=>buildLineCard(l,false)).join(''):'<div class="empty-state">Bado haujasajili laini. Nenda kwenye "Laini" kuanza.</div>';
  renderDashboardLocked();
  renderMbWarning();
  renderCycleStats();
}

// ---- LINES PAGE ----
function renderLines(){
  const lines=getLines(),grid=document.getElementById('linesGrid');
  grid.innerHTML=lines.length?lines.map(l=>buildLineCard(l,true)).join(''):'<div class="empty-state">Bado haujasajili laini yoyote.</div>';
}

// ---- SELECTS ----
function populateLineSelects(){
  const lines=getLines();
  const opts=lines.length?lines.map(l=>`<option value="${l.id}">${l.name} — ${l.phone}${l.owner==='worker'?' (Assistant)':''}</option>`).join(''):'';
  ['sellLine','balanceLine','manualOrderLine'].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const prev=el.value;
    el.innerHTML='<option value="">-- Chagua laini --</option>'+opts;
    if(prev)el.value=prev;
  });
}

// ---- BALANCE PAGE ----
function updateBalancePage(){renderTransactions()}
function updateBalancePreview(){
  const lineId=document.getElementById('balanceLine').value;
  const preview=document.getElementById('balancePreview'),newPrev=document.getElementById('newBalancePreview');
  if(!lineId){preview.style.display='none';newPrev.style.display='none';return}
  const line=getLines().find(l=>l.id===lineId);if(!line){preview.style.display='none';return}
  document.getElementById('balanceCurrentVal').textContent=fmt(line.balance);
  preview.style.display='flex';previewNewBalance();
}
function previewNewBalance(){
  const lineId=document.getElementById('balanceLine').value;
  const amount=parseFloat(document.getElementById('balanceAmount').value)||0;
  const newPrev=document.getElementById('newBalancePreview');
  if(!lineId||amount<=0){newPrev.style.display='none';return}
  const line=getLines().find(l=>l.id===lineId);if(!line){newPrev.style.display='none';return}
  document.getElementById('newBalanceVal').textContent=fmt((line.balance||0)+amount);
  newPrev.style.display='flex';
}
function renderCycleStats(){
  const allSales = getSales();
  const allTxns  = getTransactions();
  const totalProfit   = allSales.reduce((s,x)=>s+(x.profit??((x.sellingPrice??x.amount??0)-(x.costPrice??0))),0);
  const reinvested    = allTxns.filter(t=>t.source==='faida').reduce((s,t)=>s+t.amount,0);
  const external      = allTxns.filter(t=>t.source==='nje'||!t.source).reduce((s,t)=>s+t.amount,0);
  const remaining     = Math.max(0, totalProfit - reinvested);
  // Dashboard
  const ap=document.getElementById('statAllTimeProfit');
  const ar=document.getElementById('statAllTimeReinvest');
  if(ap) ap.textContent=fmt(totalProfit);
  if(ar) ar.textContent='Mzunguko: '+fmt(reinvested);
  // Balance page cycle stats
  const cp=document.getElementById('cycTotalProfit');
  const cr=document.getElementById('cycReinvested');
  const ce=document.getElementById('cycExternal');
  const crem=document.getElementById('cycRemaining');
  if(cp)  cp.textContent=fmt(totalProfit);
  if(cr)  cr.textContent=fmt(reinvested);
  if(ce)  ce.textContent=fmt(external);
  if(crem)crem.textContent=fmt(remaining);
}

function renderTransactions(){
  const el=document.getElementById('transactionsList');if(!el)return;
  renderCycleStats();
  const txns=getTransactions().slice().reverse();
  if(!txns.length){el.innerHTML='<div class="empty-state">Bado hakuna rekodi za salio.</div>';return}
  const lines=getLines();
  // Group by date
  const groups={};
  txns.forEach(t=>{
    const day=dateKeyLocal(t.date);
    if(!groups[day]) groups[day]=[];
    groups[day].push(t);
  });
  el.innerHTML=Object.entries(groups).map(([day,items])=>{
    const dayTotal=items.reduce((s,t)=>s+t.amount,0);
    const dayFaida=items.filter(t=>t.source==='faida').reduce((s,t)=>s+t.amount,0);
    const dayNje=items.filter(t=>t.source==='nje'||!t.source).reduce((s,t)=>s+t.amount,0);
    const dayLabel=new Date(day+'T12:00:00').toLocaleDateString('sw-TZ',{weekday:'short',day:'2-digit',month:'long',year:'numeric'});
    const rows=items.map(t=>{
      const line=lines.find(l=>l.id===t.lineId);
      const isFaida=t.source==='faida';
      const srcBadge=isFaida
        ? `<span class="li-badge" style="background:rgba(0,196,167,.15);color:var(--accent)">♻️ Mzunguko</span>`
        : `<span class="li-badge" style="background:rgba(0,151,255,.15);color:var(--accent2)">💵 Hela Mpya</span>`;
      return`<div class="list-item" style="margin-bottom:.35rem">
        <div class="list-item-left">
          <div class="li-title">${line?line.name:'Laini iliyofutwa'} <small style="color:var(--text2);font-weight:400">${line?line.phone:''}</small></div>
          <div class="li-sub">${t.note||''} · ${fmtDateTime(t.date)}</div>
          <div style="margin-top:.2rem">${srcBadge}</div>
        </div>
        <div class="list-item-right">
          <div class="li-amount">${fmt(t.amount)}</div>
        </div>
      </div>`;
    }).join('');
    return`<div style="margin-bottom:1.25rem">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem .6rem;background:var(--bg3);border-radius:7px;margin-bottom:.5rem;font-size:.8rem">
        <span style="font-weight:700;color:var(--text)">📅 ${dayLabel}</span>
        <span style="color:var(--text2)">Jumla: <strong style="color:var(--accent)">${fmt(dayTotal)}</strong>${dayFaida>0?' · ♻️ '+fmt(dayFaida):''}${dayNje>0?' · 💵 '+fmt(dayNje):''}</span>
      </div>
      ${rows}
    </div>`;
  }).join('');
}

// ---- REPORTS ----
let customDateFrom=null, customDateTo=null;

function setReportFilter(f){
  currentReportFilter=f;
  _reportSalesLimit=100;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));
  const row=document.getElementById('customDateRow');
  if(f==='custom'){
    row.style.display='flex';
    // Default: leo
    const t=todayStr();
    if(!document.getElementById('dateFrom').value) document.getElementById('dateFrom').value=t;
    if(!document.getElementById('dateTo').value)   document.getElementById('dateTo').value=t;
  } else {
    row.style.display='none';
  }
  renderReports();
}

function applyCustomDate(){
  customDateFrom=document.getElementById('dateFrom').value;
  customDateTo=document.getElementById('dateTo').value;
  if(!customDateFrom||!customDateTo) return showToast('Chagua tarehe zote mbili','error');
  if(customDateFrom>customDateTo) return showToast('Tarehe ya mwanzo lazima iwe kabla ya ya mwisho','error');
  const res=document.getElementById('customDateResult');
  res.textContent=`Inaonyesha: ${customDateFrom} → ${customDateTo}`;
  renderReports();
}

function getFilteredSales(){
  const all=getSales(),today=todayStr(),now=new Date();
  if(currentReportFilter==='today')     return all.filter(s=>dateKeyLocal(s.date)===today);
  if(currentReportFilter==='yesterday'){
    const y=new Date(now);y.setDate(y.getDate()-1);
    const ys=dateKeyLocal(y);
    return all.filter(s=>dateKeyLocal(s.date)===ys);
  }
  if(currentReportFilter==='week'){const d=new Date(now);d.setDate(d.getDate()-6);return all.filter(s=>new Date(s.date)>=d)}
  if(currentReportFilter==='month'){const d=new Date(now);d.setDate(d.getDate()-29);return all.filter(s=>new Date(s.date)>=d)}
  if(currentReportFilter==='custom'&&customDateFrom&&customDateTo){
    return all.filter(s=>{const d=dateKeyLocal(s.date);return d>=customDateFrom&&d<=customDateTo})
  }
  return all;
}
// ============================================================
// CHARTS — Canvas-based, no external library needed
// ============================================================
function getProfitByDay(sales){
  const map={};
  sales.forEach(s=>{
    const day=dateKeyLocal(s.date);
    const p=s.profit??((s.sellingPrice??s.amount??0)-(s.costPrice??0));
    map[day]=(map[day]||0)+p;
  });
  return map;
}

function drawLineChart(canvasId, dayMap){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  const days=Object.keys(dayMap).sort();
  if(days.length<2){canvas.style.display='none';return}
  canvas.style.display='block';
  const dpr=window.devicePixelRatio||1;
  const W=canvas.parentElement.clientWidth||320;
  const H=180;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  const pad={t:16,r:16,b:36,l:68};
  const w=W-pad.l-pad.r, h=H-pad.t-pad.b;
  const vals=days.map(d=>dayMap[d]);
  const maxV=Math.max(...vals,1), minV=Math.min(...vals,0);
  const range=maxV-minV||1;
  const xStep=days.length>1?w/(days.length-1):w;

  function xPos(i){return pad.l+(i/(days.length-1||1))*w}
  function yPos(v){return pad.t+h-(((v-minV)/range)*h)}

  // Grid lines
  ctx.strokeStyle='rgba(42,58,80,.7)'; ctx.lineWidth=1;
  const gridCount=4;
  for(let i=0;i<=gridCount;i++){
    const y=pad.t+(i/gridCount)*h;
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+w,y);ctx.stroke();
    const val=maxV-((i/gridCount)*range);
    ctx.fillStyle='rgba(138,154,181,.8)';ctx.font='10px sans-serif';ctx.textAlign='right';
    ctx.fillText(val>=1000?(val/1000).toFixed(1)+'k':Math.round(val),pad.l-6,y+3.5);
  }

  // Area fill
  ctx.beginPath();
  ctx.moveTo(xPos(0),yPos(vals[0]));
  days.forEach((_,i)=>{if(i>0)ctx.lineTo(xPos(i),yPos(vals[i]))});
  ctx.lineTo(xPos(days.length-1),pad.t+h);
  ctx.lineTo(xPos(0),pad.t+h);
  ctx.closePath();
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+h);
  grad.addColorStop(0,'rgba(34,197,94,.22)');grad.addColorStop(1,'rgba(34,197,94,.02)');
  ctx.fillStyle=grad;ctx.fill();

  // Line
  ctx.beginPath();ctx.strokeStyle='#22c55e';ctx.lineWidth=2.5;ctx.lineJoin='round';
  days.forEach((_,i)=>{i===0?ctx.moveTo(xPos(i),yPos(vals[i])):ctx.lineTo(xPos(i),yPos(vals[i]))});
  ctx.stroke();

  // Dots + labels
  days.forEach((d,i)=>{
    const x=xPos(i),y=yPos(vals[i]);
    ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);
    ctx.fillStyle=vals[i]>=0?'#22c55e':'#ef4444';ctx.fill();
    ctx.strokeStyle='var(--bg2)';ctx.lineWidth=1.5;ctx.stroke();
    // X-axis date label
    const lbl=new Date(d+'T12:00:00').toLocaleDateString('sw-TZ',{day:'2-digit',month:'short'});
    ctx.fillStyle='rgba(138,154,181,.9)';ctx.font='9px sans-serif';ctx.textAlign='center';
    if(days.length<=14||i%Math.ceil(days.length/7)===0) ctx.fillText(lbl,x,H-8);
  });
}

function drawBarChart(canvasId, dayMap){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  const days=Object.keys(dayMap).sort();
  if(!days.length){canvas.style.display='none';return}
  canvas.style.display='block';
  const dpr=window.devicePixelRatio||1;
  const W=Math.max(canvas.parentElement.clientWidth||320, days.length*44);
  const H=180;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  canvas.parentElement.style.overflowX=days.length>10?'auto':'hidden';
  const ctx=canvas.getContext('2d');
  ctx.scale(dpr,dpr);
  const pad={t:16,r:16,b:36,l:68};
  const w=W-pad.l-pad.r, h=H-pad.t-pad.b;
  const vals=days.map(d=>dayMap[d]);
  const maxV=Math.max(...vals.map(Math.abs),1);
  const barW=Math.max(Math.min(w/days.length-6,32),8);

  function xPos(i){return pad.l+(i/(days.length||1))*w+(w/(days.length||1))/2}
  function yZero(){return pad.t+h}

  // Grid
  ctx.strokeStyle='rgba(42,58,80,.7)';ctx.lineWidth=1;
  [0,.25,.5,.75,1].forEach(t=>{
    const y=pad.t+h*(1-t);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+w,y);ctx.stroke();
    const v=maxV*t;
    ctx.fillStyle='rgba(138,154,181,.8)';ctx.font='10px sans-serif';ctx.textAlign='right';
    ctx.fillText(v>=1000?(v/1000).toFixed(1)+'k':Math.round(v),pad.l-6,y+3.5);
  });

  // Bars
  days.forEach((d,i)=>{
    const v=vals[i];
    const x=xPos(i)-barW/2;
    const barH=Math.abs(v/maxV)*h;
    const y=v>=0?yZero()-barH:yZero();
    const isMax=v===Math.max(...vals), isMin=v===Math.min(...vals);
    const col=v>=0
      ? (isMax?'#22c55e':'rgba(34,197,94,.65)')
      : (isMin?'#ef4444':'rgba(239,68,68,.65)');
    ctx.fillStyle=col;
    ctx.beginPath();
    const r=3;
    ctx.roundRect?ctx.roundRect(x,y,barW,barH||2,r):ctx.rect(x,y,barW,barH||2);
    ctx.fill();
    // Label on bar
    if(barH>18){
      ctx.fillStyle='#fff';ctx.font='bold 8px sans-serif';ctx.textAlign='center';
      const lv=Math.abs(v)>=1000?(Math.abs(v)/1000).toFixed(1)+'k':Math.round(Math.abs(v));
      ctx.fillText(lv,x+barW/2,v>=0?y+barH-5:y+10);
    }
    // Date label
    const lbl=new Date(d+'T12:00:00').toLocaleDateString('sw-TZ',{day:'2-digit',month:'short'});
    ctx.fillStyle='rgba(138,154,181,.9)';ctx.font='9px sans-serif';ctx.textAlign='center';
    if(days.length<=14||i%Math.ceil(days.length/7)===0) ctx.fillText(lbl,xPos(i),H-8);
  });
}

function renderTrendIndicator(dayMap){
  const el=document.getElementById('trendIndicator');
  if(!el)return;
  const days=Object.keys(dayMap).sort();
  if(days.length<2){el.innerHTML='';return}
  const last=dayMap[days[days.length-1]];
  const prev=dayMap[days[days.length-2]];
  const diff=last-prev;
  const pct=prev!==0?((diff/Math.abs(prev))*100).toFixed(1):null;
  const arrow=diff>0?'↑':diff<0?'↓':'→';
  const cls=diff>0?'trend-up':diff<0?'trend-down':'trend-flat';
  const txt=diff>0?`Imepanda ${pct?pct+'%':''} ukilinganisha siku iliyotangulia`:
            diff<0?`Imeshuka ${pct?Math.abs(pct)+'%':''} ukilinganisha siku iliyotangulia`:
            'Faida ni sawa na siku iliyotangulia';
  el.innerHTML=`<span class="trend-badge ${cls}">${arrow} ${txt} (${fmt(Math.abs(diff))})</span>`;
}


let _reportSalesLimit=100;
function showMoreReportSales(){_reportSalesLimit+=100;renderReports()}

function renderReports(){
  const sales=getFilteredSales(),lines=getLines(),salesByLine=new Map();
  for(const sale of sales){if(!salesByLine.has(sale.lineId))salesByLine.set(sale.lineId,[]);salesByLine.get(sale.lineId).push(sale)}
  const totalRev=sales.reduce((s,x)=>s+(x.sellingPrice??x.amount??0),0);
  const totalCost=sales.reduce((s,x)=>s+(x.costPrice??0),0);
  const totalProfit=sales.reduce((s,x)=>s+(x.profit??((x.sellingPrice??x.amount??0)-(x.costPrice??0))),0);
  const margin=totalRev>0?((totalProfit/totalRev)*100).toFixed(1):0;
  const weekS=sales.filter(s=>s.type==='week'),monS=sales.filter(s=>s.type==='month');
  const wProfit=weekS.reduce((s,x)=>s+(x.profit??((x.sellingPrice??x.amount??0)-(x.costPrice??0))),0);
  const mProfit=monS.reduce((s,x)=>s+(x.profit??((x.sellingPrice??x.amount??0)-(x.costPrice??0))),0);
  document.getElementById('rptTotalSales').textContent=fmt(totalRev);
  document.getElementById('rptSalesCount').textContent=sales.length+' rekodi';
  document.getElementById('rptTotalCost').textContent=fmt(totalCost);
  document.getElementById('rptTotalProfit').textContent=fmt(totalProfit);
  document.getElementById('rptMargin').textContent=`Margin: ${margin}%`;
  document.getElementById('rptWeekSales').textContent=weekS.length;
  document.getElementById('rptWeekAmount').textContent='Faida: '+fmt(wProfit);
  document.getElementById('rptMonthSales').textContent=monS.length;
  document.getElementById('rptMonthAmount').textContent='Faida: '+fmt(mProfit);

  // ---- CHARTS ----
  const allDayMap=getProfitByDay(sales),allDays=Object.keys(allDayMap).sort(),dayMap=Object.fromEntries(allDays.slice(-60).map(day=>[day,allDayMap[day]]));
  const dayCount=Object.keys(dayMap).length;
  document.getElementById('lineChartWrap').style.display=dayCount>=2?'block':'none';
  document.getElementById('barChartWrap').style.display=dayCount>=1?'block':'none';
  if(dayCount>=2) setTimeout(()=>drawLineChart('lineChart',dayMap),50);
  if(dayCount>=1) setTimeout(()=>drawBarChart('barChart',dayMap),50);
  renderTrendIndicator(dayMap);
  const perLineEl=document.getElementById('reportPerLine');
  perLineEl.innerHTML=!lines.length?'<div class="empty-state">Hakuna laini.</div>':lines.map(l=>{
    const ls=salesByLine.get(l.id)||[];
    const lRev=ls.reduce((s,x)=>s+(x.sellingPrice??x.amount??0),0);
    const lCost=ls.reduce((s,x)=>s+(x.costPrice??0),0);
    const lProfit=ls.reduce((s,x)=>s+(x.profit??((x.sellingPrice??x.amount??0)-(x.costPrice??0))),0);
    const lMargin=lRev>0?((lProfit/lRev)*100).toFixed(1):0;
    return`<div class="report-line-card">
      <div class="rlc-header">
        <span class="rlc-name">${l.name} <small style="color:var(--text2)">${l.phone}</small></span>
        <span style="font-weight:700;color:var(--success)">${fmt(lProfit)} faida</span>
      </div>
      <div class="rlc-detail">${ls.length} mauzo · Wiki: ${ls.filter(s=>s.type==='week').length} · Mwezi: ${ls.filter(s=>s.type==='month').length}</div>
      <div style="display:flex;gap:1.5rem;margin-top:.5rem;font-size:.8rem;flex-wrap:wrap">
        <span style="color:var(--text2)">📤 Mapato: <strong style="color:var(--accent2)">${fmt(lRev)}</strong></span>
        <span style="color:var(--text2)">📥 Gharama: <strong style="color:var(--danger)">${fmt(lCost)}</strong></span>
        <span style="color:var(--text2)">📊 Margin: <strong>${lMargin}%</strong></span>
      </div>
    </div>`;
  }).join('');
  const slotsEl=document.getElementById('reportSlots');
  slotsEl.innerHTML=!lines.length?'<div class="empty-state">Hakuna laini.</div>':lines.map(l=>{
    const sl=getLineSlots(l.id),wL=MAX_WEEK-sl.weekUsed,mL=MAX_MONTH-sl.monthUsed,full=wL===0&&mL===0;
    return`<div class="slot-status-card">
      <div class="ssc-left"><div class="ssc-name">${l.name} ${full?'🔴':'🟢'}</div><div class="ssc-phone">${l.phone}</div></div>
      <div style="display:flex;align-items:center;gap:.55rem"><div class="ssc-slots">
        <div class="ssc-slot"><div class="ssc-slot-label">Wiki</div><div class="ssc-slot-val ${wL===0?'full-slot':'ok-slot'}">${sl.weekUsed}/${MAX_WEEK}</div></div>
        <div class="ssc-slot"><div class="ssc-slot-label">Mwezi</div><div class="ssc-slot-val ${mL===0?'full-slot':'ok-slot'}">${sl.monthUsed}/${MAX_MONTH}</div></div>
      </div><button class="btn btn-ghost btn-sm" onclick="editLineSlots('${l.id}')" title="Rekebisha slots za leo">✏️</button></div>
    </div>`;
  }).join('');

  // ---- Orodha ya mauzo yote na tarehe ----
  const salesListEl=document.getElementById('reportSalesList');
  if(salesListEl){
    if(!sales.length){salesListEl.innerHTML='<div class="empty-state">Hakuna mauzo kwa kipindi hiki.</div>';return}
    const visible=sales.slice(-_reportSalesLimit).reverse();
    salesListEl.innerHTML=visible.map(s=>{
      const rev=s.sellingPrice??s.amount??0,cost=s.costPrice??0,profit=s.profit??(rev-cost);
      const dateStr=fmtDateTime(s.date);
      return`<div class="list-item">
        <div class="list-item-left">
          <div class="li-title">${s.lineName??'—'}${s.buyerPhone?' → '+s.buyerPhone:''}</div>
          <div class="li-sub">📅 ${dateStr}${s.mb?' · '+s.mb:''}</div>
          <div class="li-sub">Gharama: ${fmt(cost)} · Mapato: ${fmt(rev)}</div>
        </div>
        <div class="list-item-right">
          <div class="li-amount">${fmt(rev)}</div>
          <div style="font-size:.75rem;font-weight:600;color:${profit>=0?'var(--success)':'var(--danger)'}">${profit>=0?'+':''}${fmt(profit)}</div>
          <span class="li-badge ${s.type}">${s.type==='week'?'Wiki':'Mwezi'}</span>
          ${s.orderNo?'':`<div style="display:flex;gap:.3rem;justify-content:flex-end;margin-top:.35rem"><button class="btn btn-ghost btn-sm" onclick="editSalePrice('${s.id}')">✏️ Bei</button><button class="btn btn-danger btn-sm" onclick="deleteSale('${s.id}')">Futa</button></div>`}
        </div>
      </div>`;
    }).join('')+(sales.length>visible.length?`<button class="btn btn-ghost btn-full" onclick="showMoreReportSales()">Onyesha rekodi nyingine 100 (${sales.length-visible.length} zimebaki)</button>`:'');
  }
}

// ---- MODALS ----
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  if(id==='modalAddLine'){
    ['editLineId','lineName','linePhone'].forEach(x=>document.getElementById(x).value='');
    const bf=document.getElementById('lineBalance');bf.value='';bf.disabled=false;
    document.getElementById('modalLineTitle').textContent='Ongeza Laini Mpya';
  }
}
document.querySelectorAll('.modal-overlay').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open')}));

// ---- TOAST ----
let toastTimer;
function showToast(msg,type=''){
  const t=document.getElementById('toast');t.textContent=msg;t.className='toast '+type;
  clearTimeout(toastTimer);setTimeout(()=>t.classList.add('show'),10);
  toastTimer=setTimeout(()=>t.classList.remove('show'),3200);
}

// ---- CALCULATOR YA FAIDA ----
// Bei zilizotangazwa Halotel: Wiki 1–9GB; mwezi 10–20GB, 25, 30, 35 na 40GB.

let calcSelectedGB=null;
let _calcSelectedPrice=null;

function fmtMB(mb){return mb>=1024?(mb/1024).toFixed(2)+' GB':mb+' MB'}

function calcWikiOptions(){
  return [
    {gb:1,mb:1024,price:1500},
    {gb:2,mb:2048,price:2500},
    {gb:3,mb:3072,price:3500},
    {gb:4,mb:4096,price:4500},
    {gb:5,mb:5120,price:5500},
    {gb:6,mb:6144,price:6500},
    {gb:7,mb:7168,price:7500},
    {gb:8,mb:8192,price:8500},
    {gb:9,mb:9216,price:9000}
  ];
}
function calcMonthOptions(maxMB){
  return [
    {gb:10,mb:10240,price:10000},{gb:11,mb:11264,price:11000},
    {gb:12,mb:12288,price:12000},{gb:13,mb:13312,price:13000},
    {gb:14,mb:14336,price:14000},{gb:15,mb:15360,price:15000},
    {gb:16,mb:16384,price:16000},{gb:17,mb:17408,price:17000},
    {gb:18,mb:18432,price:18000},{gb:19,mb:19456,price:18500},
    {gb:20,mb:20480,price:19000},{gb:25,mb:25600,price:24000},
    {gb:30,mb:30720,price:28000},{gb:35,mb:35840,price:33000},
    {gb:40,mb:40960,price:37000}
  ].filter(o=>o.mb<=maxMB);
}
function calcPriceChoices(type,mb){return sellPriceChoices(type,mb)}
function renderCalcPriceChoices(){
  const wrap=document.getElementById('calcPriceOptions'),box=document.getElementById('calcPriceChoiceButtons');if(!wrap||!box)return;
  const type=document.getElementById('calcType')?.value||'week',mb=Number(document.getElementById('calcManualMB')?.value)||0,choices=calcPriceChoices(type,mb);
  wrap.style.display=choices.length?'block':'none';if(!choices.length){box.innerHTML='';return}
  const base=calcPriceForMB(type,mb),current=choices.some(x=>x.price===Number(_calcSelectedPrice))?Number(_calcSelectedPrice):base;_calcSelectedPrice=current;
  box.innerHTML=choices.map(o=>'<button type="button" class="type-btn'+(current===o.price?' active':'')+'" onclick="selectCalcPrice('+o.price+')">'+o.label+' · '+fmt(o.price)+'</button>').join('');
}
function selectCalcPrice(price){_calcSelectedPrice=Number(price);renderCalcPriceChoices();calcCompute()}
function calcPriceForMB(type,mb){
  const options=type==='week'?calcWikiOptions():calcMonthOptions(Infinity);
  return options.find(o=>o.mb===Number(mb))?.price||null;
}

function onCalcTypeChange(){
  calcSelectedGB=null;
  _calcSelectedPrice=null;
  document.getElementById('calcManualMB').value='';
  const type=document.getElementById('calcType').value;
  if(type==='week'){document.getElementById('calcBuyPrice').value='5000';document.getElementById('calcTotalMB').value='6556'}
  else{document.getElementById('calcBuyPrice').value='10000';document.getElementById('calcTotalMB').value='13112'}
  document.getElementById('calcUsedMB').value='0';
  calcCompute();
}

function calcBuildGbBtns(){
  const type=document.getElementById('calcType').value;
  const used=parseFloat(document.getElementById('calcUsedMB').value)||0;
  const total=parseFloat(document.getElementById('calcTotalMB').value)||0;
  const avail=total-used;
  const box=document.getElementById('calcGbBtns');
  const opts=type==='week'?calcWikiOptions():calcMonthOptions(avail);
  if(!opts.length){box.innerHTML='<span style="color:var(--text2);font-size:.85rem">MB hazitoshi kuuza GB yoyote</span>';return}
  box.innerHTML=opts.map(o=>{
    const can=o.mb<=avail;
    const sel=calcSelectedGB===o.gb;
    return `<button type="button" class="type-btn${sel?' active':''}" style="flex:0 0 auto;min-width:78px;${!can?'opacity:.35;pointer-events:none':''}" onclick="calcSelectGB(${o.gb})">GB${o.gb}<br><small>${fmt(o.price)}</small></button>`;
  }).join('');
}

function calcSelectGB(gb){
  calcSelectedGB=gb;
  _calcSelectedPrice=calcPriceForMB(document.getElementById("calcType").value,gb*1024);
  document.getElementById('calcManualMB').value=gb*1024;
  calcBuildGbBtns();
  calcCompute();
}

function onCalcManualMB(){calcSelectedGB=null;_calcSelectedPrice=null;calcBuildGbBtns();calcCompute()}

function calcCompute(){
  calcBuildGbBtns();
  renderCalcPriceChoices();
  const type=document.getElementById('calcType').value;
  const buyPrice=parseFloat(document.getElementById('calcBuyPrice').value)||0;
  const totalMB=parseFloat(document.getElementById('calcTotalMB').value)||0;
  const usedMB=parseFloat(document.getElementById('calcUsedMB').value)||0;
  const sellMB=parseFloat(document.getElementById('calcManualMB').value)||0;
  const avail=totalMB-usedMB;

  const box=document.getElementById('calcAvailBox');
  box.style.display='block';
  box.innerHTML=`<div class="sib-row"><span class="sib-label">MB Zinazopatikana</span><span class="sib-val ${avail>1024?'ok':'full'}">${fmtMB(Math.max(0,avail))} / ${fmtMB(totalMB)}</span></div>`;

  const resBox    = document.getElementById('calcResultBox');
  const lockBox   = document.getElementById('calcResultLocked');
  if(!sellMB||sellMB>avail){
    if(resBox)  resBox.style.display='none';
    if(lockBox) lockBox.style.display='none';
    return;
  }

  const sellPrice=_calcSelectedPrice||calcPriceForMB(type,sellMB);
  if(!sellPrice){
    if(resBox)  resBox.style.display='none';
    if(lockBox) lockBox.style.display='none';
    return;
  }

  const costShare=totalMB>0?(sellMB/totalMB)*buyPrice:0;
  const profit=sellPrice-costShare;
  const leftAfter=avail-sellMB;

  if(!profitVisible){
    // Onyesha lock icon — faida imefichwa
    if(resBox)  resBox.style.display='none';
    if(lockBox) lockBox.style.display='block';
    return;
  }

  if(lockBox) lockBox.style.display='none';
  resBox.style.display='block';
  document.getElementById('calcResultInner').innerHTML=`
    <div class="pp-row"><span class="pp-label">📦 Unauza</span><span class="pp-val" style="color:var(--text)">${fmtMB(sellMB)}</span></div>
    <div class="pp-row"><span class="pp-label">📥 Gharama Sehemu Yake</span><span class="pp-val cost">${fmt(Math.round(costShare))}</span></div>
    <div class="pp-row"><span class="pp-label">📤 Bei ya Kuuza</span><span class="pp-val revenue">${fmt(sellPrice)}</span></div>
    <div class="pp-divider"></div>
    <div class="pp-row"><span class="pp-label">💰 Faida</span><span class="pp-val profit" style="color:${profit>=0?'var(--success)':'var(--danger)'}">${fmt(Math.round(profit))}</span></div>
    <div class="pp-row"><span class="pp-label">MB Zitakazobaki</span><span class="pp-val" style="color:var(--text2);font-size:.82rem">${fmtMB(Math.max(0,leftAfter))}</span></div>`;
}

function calcReset(){
  calcSelectedGB=null;
  _calcSelectedPrice=null;
  document.getElementById('calcManualMB').value='';
  document.getElementById('calcResultBox').style.display='none';
  calcBuildGbBtns();
}

function calcSaveRecord(){
  const type=document.getElementById('calcType').value;
  const buyPrice=parseFloat(document.getElementById('calcBuyPrice').value)||0;
  const totalMB=parseFloat(document.getElementById('calcTotalMB').value)||0;
  const usedMB=parseFloat(document.getElementById('calcUsedMB').value)||0;
  const sellMB=parseFloat(document.getElementById('calcManualMB').value)||0;
  if(!sellMB)return showToast('Chagua GB kwanza','error');
  const sellPrice=_calcSelectedPrice||calcPriceForMB(type,sellMB);
  if(!sellPrice)return showToast('Bei haijulikani kwa MB hizi','error');
  const costShare=totalMB>0?(sellMB/totalMB)*buyPrice:0;
  const profit=sellPrice-costShare;
  const recs=getCalcRecords();
  recs.push({id:uid(),type,buyPrice,totalMB,usedMB,sellMB,sellPrice,priceTier:salePriceTier(type,sellMB,sellPrice),costShare:Math.round(costShare),profit:Math.round(profit),date:new Date().toISOString()});
  saveCalcRecords(recs);
  showToast(`✓ Imehifadhiwa — Faida: ${fmt(Math.round(profit))}`,'success');
  document.getElementById('calcUsedMB').value=usedMB+sellMB;
  calcReset();
  calcCompute();
  renderCalcRecords();
}

function renderCalcRecords(){
  const el=document.getElementById('calcRecordsList');
  if(!el)return;
  const recs=getCalcRecords().slice().reverse().slice(0,30);
  if(!recs.length){el.innerHTML='<div class="empty-state">Bado hakuna rekodi za calculator.</div>';return}
  el.innerHTML=recs.map(r=>`
    <div class="list-item">
      <div class="list-item-left">
        <div class="li-title">${fmtMB(r.sellMB)} → ${fmt(r.sellPrice)}</div>
        <div class="li-sub">${fmtDateTime(r.date)} · Gharama: ${fmt(r.costShare)}</div>
      </div>
      <div class="list-item-right">
        <div class="li-amount">${fmt(r.sellPrice)}</div>
        <div style="font-size:.75rem;font-weight:600;color:${r.profit>=0?'var(--success)':'var(--danger)'}">${r.profit>=0?'+':''}${fmt(r.profit)}</div>
        <span class="li-badge ${r.type}">${r.type==='week'?'Wiki':'Mwezi'}</span>
      </div>
    </div>`).join('');
}

// ============================================================
// ---- HISTORIA YA MTEJA ----
function showCustomerHistory(phone){
  const all     = getSales();
  const sales   = all.filter(s=>s.buyerPhone===phone).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const total   = sales.reduce((s,t)=>s+(t.sellingPrice??t.amount??0),0);
  const profit  = sales.reduce((s,t)=>s+(t.profit??((t.sellingPrice??t.amount??0)-(t.costPrice??0))),0);
  const last    = sales[0] ? fmtDateTime(sales[0].date) : '—';
  const el      = document.getElementById('customerHistoryContent');
  el.innerHTML  = `
    <div style="background:var(--bg3);border-radius:10px;padding:1rem;margin-bottom:1rem">
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:.5rem">📱 ${phone}</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;text-align:center">
        <div><div style="font-size:1.3rem;font-weight:700;color:var(--accent)">${sales.length}</div><div style="font-size:.72rem;color:var(--text2)">Manunuzi</div></div>
        <div><div style="font-size:1.1rem;font-weight:700">${fmt(total)}</div><div style="font-size:.72rem;color:var(--text2)">Jumla</div></div>
        <div><div style="font-size:1.1rem;font-weight:700;color:var(--success)">${fmt(profit)}</div><div style="font-size:.72rem;color:var(--text2)">Faida Yako</div></div>
      </div>
      <div style="font-size:.75rem;color:var(--text3);margin-top:.5rem;text-align:center">Mwisho: ${last}</div>
    </div>
    ${sales.length ? sales.map(s=>{
      const rev=s.sellingPrice??s.amount??0;
      return`<div class="list-item" style="margin-bottom:.5rem">
        <div class="list-item-left">
          <div class="li-title">${s.mb||s.type} · ${s.lineName||'—'}</div>
          <div class="li-sub">${fmtDateTime(s.date)}</div>
        </div>
        <div class="list-item-right">
          <div class="li-amount">${fmt(rev)}</div>
          <span class="li-badge ${s.type}">${s.type==='week'?'Wiki':'Mwezi'}</span>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state">Hakuna historia</div>'}`;
  openModal('modalCustomerHistory');
}

// ---- FREE SMS ----
function onFreeSmsInput(){
  const ta   = document.getElementById('freeSmsText');
  const cnt  = document.getElementById('freeSmsCharCount');
  const scnt = document.getElementById('freeSmsSmsCount');
  if(!ta) return;
  const len = ta.value.length;
  const sms = len<=160 ? 1 : Math.ceil(len/153);
  if(cnt)  { cnt.textContent=`${len}/160`; cnt.style.color=len>160?'var(--danger)':len>140?'var(--warning)':'var(--text3)'; }
  if(scnt) { scnt.textContent=`SMS ${sms}${sms>1?' ⚠️':''}`;  scnt.style.color=sms>1?'var(--danger)':'var(--text3)'; }
}

async function sendFreeSms(){
  const phoneRaw = document.getElementById('freeSmsPhone')?.value?.trim();
  const msg      = document.getElementById('freeSmsText')?.value?.trim();
  if(!phoneRaw) return showToast('Ingiza nambari ya simu','error');
  if(!msg)      return showToast('Andika ujumbe kwanza','error');
  let phone = phoneRaw.replace(/\s+/g,'');
  if(phone.startsWith('0')) phone = '255'+phone.slice(1);
  if(phone.startsWith('+')) phone = phone.slice(1);
  showToast('📱 Inatuma...','');
  try {
    const res = await fetch('https://nextsms-proxy.hanshannu9.workers.dev',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({to:phone, text:msg})
    });
    const data = await res.json();
    if(res.ok && !data.error){
      showToast('✅ Ujumbe umetumwa!','success');
      document.getElementById('freeSmsText').value='';
      document.getElementById('freeSmsPhone').value='';
      onFreeSmsInput();
    } else { showToast('⚠️ Haikutumwa — jaribu tena','warning'); }
  } catch(e){ showToast('⚠️ Tatizo la mtandao','warning'); }
}

// ---- MIKOPO — LOANS ----
// ============================================================
const getLoans     = () => _cache.loans || [];
const saveLoans    = d  => { _cache.loans = d; saveDocToFirestore('loans', d); };

// Load loans into cache on init (patch initFirebase to include loans)
// GB price lookup
function loanPriceForGB(type, gb){
  if(type==='wiki'){
    if(gb===0.5)  return 700;
    if(gb===0.75) return 1000;
    if(gb===1)    return 1500;
    if(gb===2)    return 2500;
    return gb*1000+500;
  }
  if(type==='mwezi') return gb*1000;
  return 0;
}

// ---- REMINDER TOGGLE ----
let reminderEnabled = false;
let reminderDays = 1;

function autoFillSmsName(){
  const name    = document.getElementById('loanName').value.trim();
  const smsField= document.getElementById('loanSmsName');
  // Jaza tu kama bado haijabadilishwa na mtumiaji
  if(!smsField.dataset.edited){
    smsField.value = name.split(' ')[0] || '';
  }
}

// Mark as manually edited
document.addEventListener('DOMContentLoaded', ()=>{
  const sf = document.getElementById('loanSmsName');
  if(sf) sf.addEventListener('input', ()=>{ sf.dataset.edited='1'; });
});

function toggleReminder(){
  reminderEnabled = !reminderEnabled;
  const toggle = document.getElementById('reminderToggle');
  const knob   = document.getElementById('reminderKnob');
  const label  = document.getElementById('reminderToggleLabel');
  const row    = document.getElementById('reminderDaysRow');
  if(reminderEnabled){
    toggle.classList.add('on');
    knob.style.left = '21px';
    label.textContent = 'Imewashwa';
    label.style.color = 'var(--accent)';
    row.style.display = 'block';
  } else {
    toggle.classList.remove('on');
    knob.style.left = '3px';
    label.textContent = 'Imezimwa';
    label.style.color = 'var(--text2)';
    row.style.display = 'none';
  }
}

function onDueDateChange(){
  const val = document.getElementById('loanDueDate').value;
  const preview = document.getElementById('dueDatePreview');
  if(!val){ if(preview) preview.textContent=''; return; }
  const date = new Date(val+'T12:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.ceil((date - today) / (1000*60*60*24));
  const label = date.toLocaleDateString('sw-TZ',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  if(preview){
    preview.textContent = diff > 0
      ? `SMS itatumwa siku hiyo — siku ${diff} zinazoibaki`
      : diff === 0 ? 'Leo ndiyo siku ya mwisho'
      : `⚠️ Tarehe hii imepita (siku ${Math.abs(diff)} zilizopita)`;
    preview.style.color = diff > 0 ? 'var(--text2)' : diff === 0 ? 'var(--warning)' : 'var(--danger)';
  }
}

function selectReminderDays(days){ /* legacy — hatuiitumii tena */ }

function onLoanGBChange(){
  const val = document.getElementById('loanGB').value;
  const amtField = document.getElementById('loanAmount');
  if(!val || val==='custom'){ amtField.value=''; return; }
  const parts = val.split('_');
  const type  = parts[0];
  const gb    = parseFloat(parts[1]);
  amtField.value = loanPriceForGB(type, gb);
}

function loanRemaining(loan){if(loan.paid)return 0;return Math.max(0,(Number(loan.amount)||0)-(Number(loan.paidAmount)||0))}
async function mutateLoanRows(mutator){let latest;await fbDb.runTransaction(async tx=>{const ref=dataDocRef('loans'),snap=await tx.get(ref),rows=txItems(snap,[]);mutator(rows);latest=rows;txWriteItems(tx,'loans',rows)});_cache.loans=latest;return latest}
async function addLoan(){
 const name=document.getElementById('loanName').value.trim(),smsName=document.getElementById('loanSmsName').value.trim()||document.getElementById('loanName').value.trim().split(' ')[0]||'Mteja',phone=document.getElementById('loanPhone').value.trim(),gbVal=document.getElementById('loanGB').value,amount=parseFloat(document.getElementById('loanAmount').value),note=document.getElementById('loanNote').value.trim();
 if(!name)return showToast('Ingiza jina la mkopaji','error');if(!amount||amount<=0)return showToast('Ingiza kiasi sahihi','error');const dueDate=reminderEnabled?(document.getElementById('loanDueDate').value||null):null;if(reminderEnabled&&!dueDate)return showToast('Chagua tarehe ya mwisho ya kulipa','error');
 let gbLabel='',loanType='';if(gbVal&&gbVal!=='custom'){const [type,gb]=gbVal.split('_');gbLabel=`GB${gb} (${type==='wiki'?'Wiki':'Mwezi'})`;loanType=type}
 const loan={id:uid(),name,smsName,phone,gbLabel,loanType,amount,paidAmount:0,note:note||'',paid:false,remind:reminderEnabled,remindDays:null,dueDate,remindSent:false,dateBorrowed:new Date().toISOString(),datePaid:null};
 try{await mutateLoanRows(rows=>rows.push(loan));['loanName','loanPhone','loanAmount','loanNote','loanSmsName','loanDueDate'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});const dp=document.getElementById('dueDatePreview');if(dp)dp.textContent='';document.getElementById('loanGB').value='';if(reminderEnabled)toggleReminder();showToast(`✓ Mkopo wa ${fmt(amount)} kwa ${name} umehifadhiwa`,'success');renderLoans();renderLoansDashSummary()}catch(e){await initFirebase();showToast('Mkopo haujahifadhiwa: '+(e.message||'hitilafu'),'error')}
}
async function recordLoanPayment(id){const loan=getLoans().find(x=>x.id===id);if(!loan)return;const balance=loanRemaining(loan);if(balance<=0)return showToast('Mkopo huu umelipwa wote.','warning');const raw=prompt(`Baki la ${loan.name}: ${fmt(balance)}\nIngiza kiasi alicholipa sasa:`,String(balance));if(raw===null)return;const amount=Number(raw);if(!Number.isFinite(amount)||amount<=0||amount>balance)return showToast('Kiasi cha malipo si sahihi.','error');try{await mutateLoanRows(rows=>{const l=rows.find(x=>x.id===id);if(!l)throw new Error('Mkopo haupo tena.');l.paidAmount=(Number(l.paidAmount)||0)+amount;l.paidAmount=Math.min(l.amount,l.paidAmount);l.paid=l.paidAmount>=l.amount;l.datePaid=l.paid?new Date().toISOString():null});showToast(`Malipo ${fmt(amount)} yamehifadhiwa.`, 'success');renderLoans();renderLoansDashSummary()}catch(e){await initFirebase();showToast('Malipo hayajahifadhiwa: '+e.message,'error')}}
async function markLoanPaid(id){const loan=getLoans().find(x=>x.id===id);if(!loan)return;return recordLoanPayment(id)}
async function markLoanUnpaid(id){try{await mutateLoanRows(rows=>{const l=rows.find(x=>x.id===id);if(!l)return;l.paid=false;l.paidAmount=0;l.datePaid=null});showToast('Mkopo umewekwa tena kama haujalipwa.','warning');renderLoans();renderLoansDashSummary()}catch(e){await initFirebase();showToast('Taarifa haikubadilishwa: '+e.message,'error')}}
async function editLoan(id){const loan=getLoans().find(x=>x.id===id);if(!loan)return;const name=prompt('Jina la mkopaji:',loan.name);if(name===null)return;const phone=prompt('Namba ya simu:',loan.phone||'');if(phone===null)return;const amountRaw=prompt('Deni lote lililokopwa (TSh):',String(loan.amount));if(amountRaw===null)return;const amount=Number(amountRaw);if(!name.trim()||!Number.isFinite(amount)||amount<=0)return showToast('Jina au deni si sahihi.','error');try{await mutateLoanRows(rows=>{const l=rows.find(x=>x.id===id);if(!l)throw new Error('Mkopo haupo tena.');l.name=name.trim();l.phone=phone.trim();const oldAmount=Number(l.amount)||0,paidBefore=(l.paid&&l.paidAmount===undefined)?oldAmount:(Number(l.paidAmount)||0);l.amount=amount;l.paidAmount=Math.min(paidBefore,amount);l.paid=l.paidAmount>=amount;l.datePaid=l.paid?(l.datePaid||new Date().toISOString()):null});showToast('Taarifa za mkopo zimehaririwa.','success');renderLoans();renderLoansDashSummary()}catch(e){await initFirebase();showToast('Mkopo haukuhaririwa: '+e.message,'error')}}
function deleteLoan(id){const loan=getLoans().find(x=>x.id===id);if(!loan)return;document.getElementById('confirmMessage').textContent=`Futa mkopo wa ${loan.name}?`;document.getElementById('confirmBtn').onclick=async()=>{try{await mutateLoanRows(rows=>{const i=rows.findIndex(x=>x.id===id);if(i>=0)rows.splice(i,1)});closeModal('modalConfirm');showToast('Rekodi ya mkopo imefutwa.','warning');renderLoans();renderLoansDashSummary()}catch(e){await initFirebase();closeModal('modalConfirm');showToast('Mkopo haukufutwa: '+e.message,'error')}};openModal('modalConfirm')}

function daysAgo(isoDate){
  const diff = Date.now() - new Date(isoDate).getTime();
  return Math.floor(diff/(1000*60*60*24));
}

function buildLoanCard(loan){
  const days    = daysAgo(loan.dateBorrowed);
  const balance=loanRemaining(loan);
  const overdue = balance>0 && days > 3;
  const cls     = balance<=0 ? 'paid' : overdue ? 'overdue' : 'unpaid';
  const overdueTag = overdue ? `<span class="overdue-tag">⚠️ Siku ${days} zimepita</span>` : '';
  const paidInfo = loan.paid && loan.datePaid
    ? `<span style="color:var(--success);font-size:.75rem">✅ Aliilipa ${fmtDateTime(loan.datePaid)}</span>` : '';
  const remindBadge = loan.remind
    ? (()=>{
        const dueDateStr = loan.dueDate
          ? new Date(loan.dueDate+'T12:00:00').toLocaleDateString('sw-TZ',{day:'2-digit',month:'short',year:'numeric'})
          : '—';
        return `<span style="font-size:.65rem;font-weight:700;padding:.15rem .45rem;border-radius:4px;margin-left:.35rem;background:${loan.remindSent?'rgba(34,197,94,.15)':'rgba(0,151,255,.15)'};color:${loan.remindSent?'var(--success)':'var(--accent2)'}">
          ${loan.remindSent?'✅ Ukumbusho ulitumwa':'📅 Malipo: '+dueDateStr}
        </span>`;
      })()
    : '';

  return `<div class="loan-card ${cls}">
    <div class="loan-card-header">
      <div>
        <div class="loan-name">${loan.name}${overdueTag}</div>
        <div class="loan-phone">${loan.phone||'—'}${remindBadge}</div>
      </div>
      <div class="loan-amount">${fmt(balance)}<small style="display:block;font-size:.68rem;color:var(--text3)">baki ya deni</small></div>
    </div>
    <div class="loan-meta">
      ${loan.gbLabel ? '📦 '+loan.gbLabel+' · ' : ''}
      📅 Alikopa: ${fmtDateTime(loan.dateBorrowed)}
      ${loan.note ? ' · 📝 '+loan.note : ''}
      ${loan.smsName ? ` · SMS: "Habari <strong>${loan.smsName}</strong>..."` : ''}
    </div>
    ${paidInfo}
    <div class="loan-actions" style="margin-top:.5rem;flex-wrap:wrap">
      ${balance>0?`<button class="btn btn-success btn-sm" onclick="recordLoanPayment('${loan.id}')">💵 Lipa sehemu</button><button class="btn btn-ghost btn-sm" onclick="markLoanPaid('${loan.id}')">Lipa lote</button>`:`<button class="btn btn-ghost btn-sm" onclick="markLoanUnpaid('${loan.id}')">↩️ Rejesha deni</button>`}
      ${balance>0?(loan.phone?`<button class="btn btn-ghost btn-sm" onclick="openSmsModal('${loan.id}')">📱 SMS</button>`:`<button class="btn btn-ghost btn-sm" onclick="addPhoneToLoan('${loan.id}')">➕ Namba</button>`):''}
      <button class="btn btn-ghost btn-sm" onclick="editLoan('${loan.id}')">✏️ Hariri</button><button class="btn btn-danger btn-sm" onclick="deleteLoan('${loan.id}')">🗑 Futa</button>
    </div>
  </div>`;
}

function renderLoans(){
  const loans   = getLoans();
  const unpaid  = loans.filter(l=>loanRemaining(l)>0);
  const paid    = loans.filter(l=>loanRemaining(l)<=0);
  const overdue = unpaid.filter(l=>daysAgo(l.dateBorrowed)>3);

  // Muhtasari wa kadi
  const totalAmt  = loans.reduce((s,l)=>s+loanRemaining(l),0);
  const unpaidAmt = unpaid.reduce((s,l)=>s+loanRemaining(l),0);
  const paidAmt   = paid.reduce((s,l)=>s+(Number(l.paidAmount)||l.amount||0),0);
  document.getElementById('loanStatTotal').textContent    = loans.length;
  document.getElementById('loanStatTotalAmt').textContent = fmt(totalAmt);
  document.getElementById('loanStatUnpaid').textContent   = unpaid.length;
  document.getElementById('loanStatUnpaidAmt').textContent= fmt(unpaidAmt);
  document.getElementById('loanStatPaid').textContent     = paid.length;
  document.getElementById('loanStatPaidAmt').textContent  = fmt(paidAmt);

  // Onyo la wadeni waliochelewa
  const alertEl = document.getElementById('loansAlert');
  if(overdue.length){
    alertEl.style.display='block';
    alertEl.innerHTML = `⚠️ <strong>Wanaochelewa kulipa (zaidi ya siku 3):</strong><br>`+
      overdue.map(l=>`• ${l.name} ${l.phone?'('+l.phone+')':''} — ${fmt(loanRemaining(l))} (siku ${daysAgo(l.dateBorrowed)} zimepita)`).join('<br>');
  } else {
    alertEl.style.display='none';
  }

  // Search filter
  const q = (document.getElementById('loansSearch')?.value||'').toLowerCase().trim();
  const filterFn = l => !q
    || l.name.toLowerCase().includes(q)
    || (l.phone||'').includes(q)
    || (l.gbLabel||'').toLowerCase().includes(q);

  // Orodha
  const unpaidEl = document.getElementById('loansUnpaidList');
  const paidEl   = document.getElementById('loansPaidList');
  const filteredUnpaid = unpaid.filter(filterFn);
  const filteredPaid   = paid.filter(filterFn);
  unpaidEl.innerHTML = filteredUnpaid.length
    ? filteredUnpaid.slice().sort((a,b)=>daysAgo(b.dateBorrowed)-daysAgo(a.dateBorrowed)).map(buildLoanCard).join('')
    : q ? `<div class="empty-state">Hakuna matokeo ya "${q}"</div>`
        : '<div class="empty-state">Hakuna wanaodaiwa kwa sasa 🎉</div>';
  paidEl.innerHTML = filteredPaid.length
    ? filteredPaid.slice().reverse().slice(0,20).map(buildLoanCard).join('')
    : q ? `<div class="empty-state">Hakuna matokeo ya "${q}"</div>`
        : '<div class="empty-state">Bado hakuna aliyekwisha lipa.</div>';
}

function renderLoansDashSummary(){
  const loans   = getLoans();
  const unpaid  = loans.filter(l=>loanRemaining(l)>0);
  const overdue = unpaid.filter(l=>daysAgo(l.dateBorrowed)>3);
  const card    = document.getElementById('statLoansCard');
  const cnt     = document.getElementById('statLoansCount');
  const amt     = document.getElementById('statLoansAmt');
  if(!card) return;
  if(unpaid.length){
    card.style.display='block';
    cnt.textContent  = unpaid.length;
    amt.textContent  = `Hawajalipa: ${fmt(unpaid.reduce((s,l)=>s+loanRemaining(l),0))}${overdue.length?' · ⚠️ '+overdue.length+' wamechelewa':''}`;
  } else {
    card.style.display='none';
  }
}

// ---- PATCH CACHE TO INCLUDE LOANS ----
// ============================================================
// ---- LOAN REMINDERS ----
function addPhoneToLoan(id){
  const loan = getLoans().find(l=>l.id===id);
  if(!loan) return;
  document.getElementById('addPhoneLoanId').value = id;
  document.getElementById('addPhoneName').textContent = `Mkopaji: ${loan.name} — ${fmt(loan.amount)}`;
  document.getElementById('addPhoneInput').value = '';
  openModal('modalAddPhone');
  setTimeout(()=>document.getElementById('addPhoneInput').focus(), 200);
}

async function savePhoneToLoan(){
 const id=document.getElementById('addPhoneLoanId').value,phone=document.getElementById('addPhoneInput').value.trim();if(!phone)return showToast('Ingiza nambari ya simu','error');if(!/^[\d\+\s]{9,15}$/.test(phone))return showToast('Nambari si sahihi','error');
 try{let name='';await mutateLoanRows(rows=>{const l=rows.find(x=>x.id===id);if(!l)throw new Error('Mkopo haupo tena.');l.phone=phone;name=l.name});closeModal('modalAddPhone');showToast(`✓ Namba ya ${name} imeongezwa — unaweza kutuma SMS sasa`,'success');renderLoans()}catch(e){await initFirebase();showToast('Namba haikuhifadhiwa: '+e.message,'error')}
}

function buildReminderMsg(loan){
  let dueDateStr;
  if(loan.dueDate){
    dueDateStr = new Date(loan.dueDate+'T12:00:00').toLocaleDateString('sw-TZ',{day:'2-digit',month:'long',year:'numeric'});
  } else {
    const d = new Date(loan.dateBorrowed);
    d.setDate(d.getDate()+(loan.remindDays||1));
    dueDateStr = d.toLocaleDateString('sw-TZ',{day:'2-digit',month:'long',year:'numeric'});
  }
  const gbInfo = loan.gbLabel ? `${loan.gbLabel} (${fmt(loan.amount)})` : fmt(loan.amount);
  const salutation = loan.smsName || (loan.name ? loan.name.split(' ')[0] : 'Mteja');
  return `Habari ${salutation}, Tafadhali kumbuka kufanya malipo ya bando lako la ${gbInfo} kabla ya ${dueDateStr}. Ukihitaji msaada wa kufanya malipo, tupo tayari kukusaidia. Asante kwa kuchagua SMART BUNDLES. Contact - 0612626715`;
}

function openSellSmsModal(phone, defaultMsg, mbLabel, amount){
  document.getElementById('sellSmsPhone').value = phone;
  document.getElementById('sellSmsInfo').textContent = `Namba: ${phone} · ${mbLabel} · ${fmt(amount)}`;
  const ta = document.getElementById('sellSmsText');
  if(ta){ ta.value = defaultMsg; onSellSmsTextInput(); }
  openModal('modalSellSms');
}

function onSellSmsTextInput(){
  const ta   = document.getElementById('sellSmsText');
  const cnt  = document.getElementById('sellSmsCharCount');
  const scnt = document.getElementById('sellSmsSmsCount');
  if(!ta) return;
  const len = ta.value.length;
  const sms = len<=160 ? 1 : Math.ceil(len/153);
  if(cnt)  cnt.textContent  = `${len}/160`;
  if(scnt) scnt.textContent = `SMS ${sms}${sms>1?' ⚠️ Bei mara mbili':''}`;
  if(cnt)  cnt.style.color  = len>160?'var(--danger)':len>140?'var(--warning)':'var(--text3)';
}

function resetSellSmsMessage(){
  // Haiwezekani kujua mbLabel/amount tena — tuache mtumiaji aandike upya
  showToast('Andika ujumbe wako mwenyewe','');
}

async function sendSellSmsFromModal(){
  const phone = document.getElementById('sellSmsPhone').value;
  const msg   = document.getElementById('sellSmsText').value.trim();
  if(!msg) return showToast('Ujumbe haupaswi kuwa wazi','error');
  closeModal('modalSellSms');
  renderAll(); updateSellSlotInfo(); renderTodaySales();
  showToast('📱 Inatuma SMS...','');
  let p = phone.replace(/\s+/g,'');
  if(p.startsWith('0')) p = '255'+p.slice(1);
  if(p.startsWith('+')) p = p.slice(1);
  try {
    const res = await fetch('https://nextsms-proxy.hanshannu9.workers.dev',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({to:p, text:msg})
    });
    const data = await res.json();
    if(res.ok && !data.error) showToast('✅ SMS imetumwa!','success');
    else showToast('⚠️ SMS haikutumwa','warning');
  } catch(e){ showToast('⚠️ Tatizo la mtandao','warning'); }
}

function openSmsModal(id){
  const loan = getLoans().find(l=>l.id===id);
  if(!loan) return;
  document.getElementById('smsModalLoanId').value = id;
  document.getElementById('smsModalName').textContent =
    `Mkopaji: ${loan.name} · ${fmt(loan.amount)}${loan.gbLabel?' ('+loan.gbLabel+')':''}`;
  const dueDateInput = document.getElementById('smsModalDueDate');
  dueDateInput.value = loan.dueDate || '';
  document.getElementById('smsModalDatePreview').textContent = '';
  const ta = document.getElementById('smsModalText');
  if(ta) ta.value = '';
  if(loan.dueDate) onSmsModalDateChange();
  openModal('modalSendSms');
  setTimeout(()=>dueDateInput.focus(), 200);
}

function onSmsModalDateChange(){
  const id  = document.getElementById('smsModalLoanId').value;
  const val = document.getElementById('smsModalDueDate').value;
  const prev= document.getElementById('smsModalDatePreview');
  if(!val){ if(prev)prev.textContent=''; return; }
  const loan = getLoans().find(l=>l.id===id);
  if(!loan) return;
  const date  = new Date(val+'T12:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff  = Math.ceil((date-today)/(1000*60*60*24));
  if(prev){
    prev.textContent = diff>0?`Siku ${diff} zinazoibaki`:diff===0?'Leo ni siku ya mwisho':'⚠️ Imepita';
    prev.style.color = diff>0?'var(--text2)':diff===0?'var(--warning)':'var(--danger)';
  }
  // Weka ujumbe kwenye textarea
  const tempLoan = {...loan, dueDate: val};
  const msg = buildReminderMsg(tempLoan);
  const ta  = document.getElementById('smsModalText');
  if(ta){ ta.value=msg; onSmsTextInput(); }
}

function onSmsTextInput(){
  const ta   = document.getElementById('smsModalText');
  const cnt  = document.getElementById('smsCharCount');
  const scnt = document.getElementById('smsSmsCount');
  if(!ta) return;
  const len  = ta.value.length;
  const sms  = len<=160 ? 1 : Math.ceil(len/153);
  if(cnt)  cnt.textContent  = `${len}/160`;
  if(scnt) scnt.textContent = `SMS ${sms}${sms>1?' ⚠️ Bei mara mbili':''}`;
  if(cnt)  cnt.style.color  = len>160?'var(--danger)':len>140?'var(--warning)':'var(--text3)';
}

function resetSmsMessage(){
  const id  = document.getElementById('smsModalLoanId').value;
  const due = document.getElementById('smsModalDueDate').value;
  if(!due){ showToast('Chagua tarehe kwanza','error'); return; }
  const loan = getLoans().find(l=>l.id===id);
  if(!loan) return;
  const ta = document.getElementById('smsModalText');
  if(ta){ ta.value = buildReminderMsg({...loan, dueDate:due}); onSmsTextInput(); }
}

async function sendSmsFromModal(){
  const id  = document.getElementById('smsModalLoanId').value;
  const due = document.getElementById('smsModalDueDate').value;
  const msg = document.getElementById('smsModalText').value.trim();
  if(!due) return showToast('Chagua tarehe ya mwisho kwanza','error');
  if(!msg) return showToast('Ujumbe haupaswi kuwa wazi','error');
  const loans = getLoans();
  const idx   = loans.findIndex(l=>l.id===id);
  if(idx<0) return;
  const loan = loans[idx];
  if(!loan.phone) return showToast('Mkopaji hana nambari ya simu','error');
  let phone = loan.phone.replace(/\s+/g,'');
  if(phone.startsWith('0')) phone = '255'+phone.slice(1);
  if(phone.startsWith('+')) phone = phone.slice(1);
  closeModal('modalSendSms');
  showToast('📱 Inatuma ujumbe...','');
  try {
    const res = await fetch('https://nextsms-proxy.hanshannu9.workers.dev',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({to:phone, text:msg})
    });
    const data = await res.json();
    if(res.ok && !data.error){
      await mutateLoanRows(rows=>{const current=rows.find(x=>x.id===id);if(current){current.dueDate=due;current.remindSent=true}});
      showToast(`✅ SMS imetumwa kwa ${loan.name}!`,'success');
      renderLoans();
    } else { showToast('⚠️ SMS haikutumwa — jaribu tena','warning'); }
  } catch(e){ showToast('⚠️ Tatizo la mtandao','warning'); }
}

async function sendManualReminder(id){
  const loans = getLoans();
  const loan  = loans.find(l=>l.id===id);
  if(!loan||!loan.phone) return showToast('Hakuna nambari ya simu','error');
  const msg = buildReminderMsg(loan);
  let phone = loan.phone.replace(/\s+/g,'');
  if(phone.startsWith('0')) phone = '255'+phone.slice(1);
  if(phone.startsWith('+')) phone = phone.slice(1);
  showToast('📱 Inatuma ukumbusho...','');
  try {
    const res = await fetch('https://nextsms-proxy.hanshannu9.workers.dev',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({to: phone, text: msg})
    });
    const data = await res.json();
    if(res.ok && !data.error){
      const idx = loans.findIndex(l=>l.id===id);
      await mutateLoanRows(rows=>{const current=rows.find(x=>x.id===id);if(current){current.dueDate=due;current.remindSent=true}});
      showToast(`✅ Ukumbusho ulitumwa kwa ${loan.name}!`,'success');
      renderLoans();
    } else {
      showToast('⚠️ SMS haikutumwa — jaribu tena','warning');
    }
  } catch(e){ showToast('⚠️ Tatizo la mtandao','warning'); }
}

async function checkLoanReminders(){
  const loans = getLoans();
  const today = todayStr();
  let updated = false;
  for(const loan of loans){
    if(loanRemaining(loan)<=0 || !loan.remind || !loan.phone || loan.remindSent) continue;
    // Angalia kama leo ni siku ya dueDate au imepita
    const due = loan.dueDate || null;
    if(!due) continue;
    if(today >= due){
      const msg = buildReminderMsg(loan);
      let phone = loan.phone.replace(/\s+/g,'');
      if(phone.startsWith('0')) phone = '255'+phone.slice(1);
      if(phone.startsWith('+')) phone = phone.slice(1);
      try {
        const res = await fetch('https://nextsms-proxy.hanshannu9.workers.dev', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({to: phone, text: msg})
        });
        const data = await res.json();
        if(res.ok && !data.error){
          await mutateLoanRows(rows=>{const current=rows.find(x=>x.id===loan.id);if(current&&!current.paid)current.remindSent=true});
          updated = true;
          showToast(`📱 Ukumbusho ulitumwa kwa ${loan.name}`, 'success');
        }
      } catch(e){ console.error('Reminder SMS error:', e); }
    }
  }
  if(updated) renderLoans();
}

// ---- DAILY REPORT SMS — saa 23:30 ----
function scheduleDailyReport(){
  const now    = new Date();
  const target = new Date();
  target.setHours(23,30,0,0);
  if(now >= target) target.setDate(target.getDate()+1);
  const ms = target - now;
  setTimeout(async ()=>{
    await sendDailyReportSms();
    // Rudia kila siku
    setInterval(sendDailyReportSms, 24*60*60*1000);
  }, ms);
}

async function sendDailyReportSms(){
  const bossPhone = localStorage.getItem('bm_boss_phone');
  if(!bossPhone) return;
  const sales   = getTodaySales();
  const revenue = sales.reduce((s,t)=>s+(t.sellingPrice??t.amount??0),0);
  const profit  = sales.reduce((s,t)=>s+(t.profit??((t.sellingPrice??t.amount??0)-(t.costPrice??0))),0);
  const count   = sales.length;
  // Namba halisi — siri iko kwenye majina ya fields tu
  const msg = `[SYS::${todayStr()}] PKT_RECV:${count} | FLUX:${Math.round(revenue)} | NET:${Math.round(profit)} | STATUS:${profit>0?'GREEN':'RED'} | EOF`;
  let phone = bossPhone.replace(/\s+/g,'');
  if(phone.startsWith('0')) phone = '255'+phone.slice(1);
  if(phone.startsWith('+')) phone = phone.slice(1);
  try {
    await fetch('https://nextsms-proxy.hanshannu9.workers.dev',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({to:phone, text:msg})
    });
  } catch(e){ console.error('Daily report error:',e); }
}

// ============================================================
// WATEJA — CUSTOMER DATABASE
// ============================================================
// Profiles zimehifadhiwa Firestore: bandoManager/{id}/data/customers
// Mauzo yanajumlishwa kiotomatiki

const getCustomerProfiles = () => _cache.customers || [];
const saveCustomerProfiles = d => { _cache.customers = d; saveDocToFirestore('customers', d); };

function getOrCreateProfile(phone){
  const profiles = getCustomerProfiles();
  let p = profiles.find(c=>c.phone===phone);
  if(!p){
    p = { phone, name:'', source:'direct', agent:'', note:'', addedAt: new Date().toISOString() };
    profiles.push(p);
    saveCustomerProfiles(profiles);
  }
  return p;
}

function buildCustomerDb(){
  const sales    = getSales();
  const profiles = getCustomerProfiles();
  const db = {};

  // Kwanza jenga kutoka mauzo
  sales.forEach(s=>{
    if(!s.buyerPhone) return;
    const phone = s.buyerPhone.trim();
    if(!phone) return;
    const rev = s.sellingPrice ?? s.amount ?? 0;
    const dt  = s.date || '';
    if(!db[phone]){
      db[phone] = { phone, count:0, totalSpent:0, firstDate:dt, lastDate:dt };
    }
    db[phone].count++;
    db[phone].totalSpent += rev;
    if(dt < db[phone].firstDate) db[phone].firstDate = dt;
    if(dt > db[phone].lastDate)  db[phone].lastDate  = dt;
  });

  // Ongeza wateja waliowahi kuongezwa kwenye profiles lakini hawana mauzo
  profiles.forEach(p=>{
    if(!db[p.phone]) db[p.phone] = { phone:p.phone, count:0, totalSpent:0, firstDate:'', lastDate:'' };
  });

  // Unganisha na profiles
  return Object.values(db).map(c=>{
    const profile = profiles.find(p=>p.phone===c.phone) || {};
    return { ...c, ...profile, phone: c.phone };
  }).sort((a,b)=>b.count - a.count);
}

function renderCustomers(){
  const customers = buildCustomerDb();
  const q = (document.getElementById('customerSearch')?.value||'').toLowerCase().trim();
  const filtered = q
    ? customers.filter(c=>c.phone.includes(q)||(c.name||'').toLowerCase().includes(q)||(c.agent||'').toLowerCase().includes(q))
    : customers;

  // Stats
  const statsEl = document.getElementById('customerStats');
  if(statsEl){
    const totalSpent = customers.reduce((s,c)=>s+c.totalSpent,0);
    const repeat     = customers.filter(c=>c.count>1).length;
    const agents     = customers.filter(c=>c.source==='agent').length;
    const H = '••••';
    statsEl.innerHTML=`<div class="stat-grid">
      <div class="stat-card accent"><div class="stat-label">Wateja Wote</div><div class="stat-value">${customers.length}</div><div class="stat-note">Namba tofauti</div></div>
      <div class="stat-card"><div class="stat-label">Wanaorudi Tena</div><div class="stat-value">${repeat}</div><div class="stat-note">Wamenunua 2+ mara</div></div>
      <div class="stat-card success"><div class="stat-label">Jumla ya Mapato</div><div class="stat-value">${profitVisible?fmt(totalSpent):H}</div><div class="stat-note">Kutoka wateja wote</div></div>
      <div class="stat-card"><div class="stat-label">Wa Agent</div><div class="stat-value">${agents}</div><div class="stat-note">Waliletwa na agent</div></div>
    </div>`;
  }

  const listEl = document.getElementById('customerList');
  if(!listEl) return;

  if(!filtered.length){
    listEl.innerHTML = q
      ? `<div class="empty-state">Hakuna mteja mwenye "${q}"</div>`
      : `<div class="empty-state">Hakuna wateja bado</div>`;
    return;
  }

  listEl.innerHTML = filtered.map((c,i)=>{
    const sourceBadge = c.source==='agent'
      ? `<span style="font-size:.65rem;font-weight:700;padding:.12rem .4rem;border-radius:4px;background:rgba(251,191,36,.15);color:var(--warning);margin-left:.35rem">🤝 ${c.agent||'Agent'}</span>`
      : `<span style="font-size:.65rem;font-weight:700;padding:.12rem .4rem;border-radius:4px;background:rgba(0,196,167,.12);color:var(--accent);margin-left:.35rem">👤 Wangu</span>`;
    const repeatBadge = c.count>1
      ? `<span style="font-size:.65rem;padding:.12rem .4rem;border-radius:4px;background:rgba(99,102,241,.15);color:#818cf8;margin-left:.35rem">⭐ ${c.count}x</span>`
      : '';
    return`<div class="list-item">
      <div class="list-item-left" style="flex:1;cursor:pointer" onclick="viewCustomer('${c.phone}')">
        <div class="li-title" style="display:flex;align-items:center;flex-wrap:wrap;gap:.2rem">
          <span style="font-size:.78rem;color:var(--text3)">#${i+1}</span>
          <span>${c.name || c.phone}</span>
          ${c.name?`<span style="font-size:.75rem;color:var(--text2)">${c.phone}</span>`:''}
          ${sourceBadge}${repeatBadge}
        </div>
        <div class="li-sub">
          ${c.count?`${c.count} mauzo · ${fmt(c.totalSpent)} · Mwisho: ${c.lastDate?fmtDateTime(c.lastDate):'—'}`:'Mteja mpya'}
          ${c.note?` · 📝 ${c.note}`:''}
        </div>
      </div>
      <div style="display:flex;gap:.35rem;align-items:center;margin-left:.5rem">
        <button class="btn btn-ghost btn-sm" onclick="editCustomer('${c.phone}')" title="Hariri">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCustomer('${c.phone}')" title="Futa">🗑</button>
      </div>
    </div>`;
  }).join('');
}

let _editCustomerSource = 'direct';

function selectCustomerSource(src, el){
  _editCustomerSource = src;
  document.querySelectorAll('[data-source]').forEach(b=>b.classList.toggle('active', b.dataset.source===src));
  document.getElementById('agentNameRow').style.display = src==='agent' ? 'block' : 'none';
}

function editCustomer(phone){
  const c = buildCustomerDb().find(c=>c.phone===phone) || { phone };
  document.getElementById('editCustomerPhone').value     = phone;
  document.getElementById('editCustomerPhoneShow').value = phone;
  document.getElementById('editCustomerName').value      = c.name  || '';
  document.getElementById('editCustomerNote').value      = c.note  || '';
  document.getElementById('editCustomerAgent').value     = c.agent || '';
  _editCustomerSource = c.source || 'direct';
  document.querySelectorAll('[data-source]').forEach(b=>b.classList.toggle('active', b.dataset.source===_editCustomerSource));
  document.getElementById('agentNameRow').style.display = _editCustomerSource==='agent' ? 'block' : 'none';
  openModal('modalEditCustomer');
  setTimeout(()=>document.getElementById('editCustomerName').focus(), 200);
}

function saveCustomerProfile(){
  const phone  = document.getElementById('editCustomerPhone').value;
  const name   = document.getElementById('editCustomerName').value.trim();
  const note   = document.getElementById('editCustomerNote').value.trim();
  const agent  = document.getElementById('editCustomerAgent').value.trim();
  const source = _editCustomerSource;
  if(source==='agent' && !agent) return showToast('Ingiza jina la agent','error');

  const profiles = getCustomerProfiles();
  const idx = profiles.findIndex(p=>p.phone===phone);
  const profile = { phone, name, note, source, agent, addedAt: idx>=0 ? profiles[idx].addedAt : new Date().toISOString() };
  if(idx>=0) profiles[idx] = profile;
  else profiles.push(profile);
  saveCustomerProfiles(profiles);
  closeModal('modalEditCustomer');
  showToast(`✓ Taarifa za ${name||phone} zimehifadhiwa`,'success');
  renderCustomers();
}

function viewCustomer(phone){
  const c = buildCustomerDb().find(c=>c.phone===phone) || { phone };
  const sales = getSales().filter(s=>s.buyerPhone===phone).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const el = document.getElementById('viewCustomerContent');

  const sourceLine = c.source==='agent'
    ? `<span style="color:var(--warning)">🤝 Wa Agent${c.agent?' ('+c.agent+')':''}</span>`
    : `<span style="color:var(--accent)">👤 Mteja Wangu</span>`;

  el.innerHTML=`
    <div style="background:var(--bg3);border-radius:10px;padding:1rem;margin-bottom:1rem">
      <div style="font-size:1.1rem;font-weight:700;margin-bottom:.3rem">${c.name||'—'} <span style="font-size:.85rem;color:var(--text2);font-weight:400">${c.phone}</span></div>
      <div style="font-size:.83rem;color:var(--text2);margin-bottom:.25rem">Chanzo: ${sourceLine}</div>
      ${c.note?`<div style="font-size:.82rem;color:var(--text2)">📝 ${c.note}</div>`:''}
    </div>
    <div class="stat-grid" style="margin-bottom:1rem">
      <div class="stat-card"><div class="stat-label">Mauzo</div><div class="stat-value">${c.count||0}</div></div>
      <div class="stat-card success"><div class="stat-label">Jumla</div><div class="stat-value">${fmt(c.totalSpent||0)}</div></div>
    </div>
    <div class="section-title">Historia ya Mauzo</div>
    ${sales.length ? sales.map(s=>{
      const rev=s.sellingPrice??s.amount??0;
      return`<div class="list-item" style="margin-bottom:.5rem">
        <div class="list-item-left">
          <div class="li-title">${s.mb||'—'} · ${s.lineName||'—'}</div>
          <div class="li-sub">${fmtDateTime(s.date)}</div>
        </div>
        <div class="list-item-right">
          <div class="li-amount">${fmt(rev)}</div>
          <span class="li-badge ${s.type}">${s.type==='week'?'Wiki':'Mwezi'}</span>
        </div>
      </div>`;
    }).join('') : '<div class="empty-state">Hakuna historia ya mauzo</div>'}
    <div style="margin-top:1rem;display:flex;gap:.5rem">
      <button class="btn btn-ghost btn-full" onclick="closeModal('modalViewCustomer');editCustomer('${phone}')">✏️ Hariri</button>
      <button class="btn btn-danger" onclick="closeModal('modalViewCustomer');deleteCustomer('${phone}')">🗑 Futa</button>
    </div>`;
  openModal('modalViewCustomer');
}

function deleteCustomer(phone){
  const c = buildCustomerDb().find(c=>c.phone===phone);
  const name = c?.name || phone;
  document.getElementById('confirmMessage').textContent =
    `Futa mteja "${name}" kutoka orodha? Mauzo yake yatabaki lakini profile itafutwa.`;
  document.getElementById('confirmBtn').onclick = ()=>{
    const profiles = getCustomerProfiles().filter(p=>p.phone!==phone);
    saveCustomerProfiles(profiles);
    closeModal('modalConfirm');
    showToast(`✓ ${name} amefutwa`,'success');
    renderCustomers();
  };
  openModal('modalConfirm');
}

// ============================================================
// BACKUP NA RESTORE
// ============================================================
function downloadFullBackup(){
  const backup = {
    exportedAt: new Date().toISOString(),
    businessId: BUSINESS_ID,
    version: 'BandoManager v2.0',
    data: {
      lines: _cache.lines || [],
      sales: _cache.sales || [],
      transactions: _cache.transactions || [],
      slots: _cache.slots || [],
      calcRecords: _cache.calcRecords || [],
      loans: _cache.loans || [],
      bandos: _cache.bandos || [],
      customers: _cache.customers || [],
      orders: _cache.orders || [],
      meta: {
        lastDate: _cache.lastDate || null,
        orderCounter: _cache.orderCounter || 0,
        assistantPhone: _cache.assistantPhone || ''
      }
    }
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `bandomanager-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const totalRecords = backup.data.lines.length + backup.data.sales.length + backup.data.bandos.length + backup.data.customers.length + backup.data.loans.length + backup.data.orders.length;
  const st = document.getElementById('backupStatus');
  if(st) st.textContent = `✓ Backup imepakuliwa (${totalRecords} rekodi jumla) — ${new Date().toLocaleString('sw-TZ')}`;
  showToast('✓ Backup imepakuliwa','success');
}

function onRestoreFileSelected(event){
  const file = event.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (e)=>{
    let parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch(err){
      showToast('❌ Faili si JSON sahihi','error');
      event.target.value = '';
      return;
    }
    if(!parsed || !parsed.data || !Array.isArray(parsed.data.lines)){
      showToast('❌ Faili hili si backup halali ya BandoManager','error');
      event.target.value = '';
      return;
    }
    const d = parsed.data;
    const counts = `Laini: ${(d.lines||[]).length}, Mauzo: ${(d.sales||[]).length}, Mabando: ${(d.bandos||[]).length}, Wateja: ${(d.customers||[]).length}, Mikopo: ${(d.loans||[]).length}, Orders: ${(d.orders||[]).length}`;
    document.getElementById('confirmMessage').textContent =
      `⚠️ Utabadilisha data YOTE ya sasa na hii ya backup (tarehe: ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('sw-TZ') : 'haijulikani'}).\n${counts}\nHatua hii haiwezi kurudishwa nyuma. Endelea?`;
    document.getElementById('confirmBtn').onclick = ()=>{
      closeModal('modalConfirm');
      applyRestore(d);
    };
    openModal('modalConfirm');
    event.target.value = '';
  };
  reader.readAsText(file);
}

function applyRestore(d){
  showToast('⏳ Inarudisha data...','');
  if(Array.isArray(d.lines))        saveLines(d.lines);
  if(Array.isArray(d.sales))        saveSales(d.sales);
  if(Array.isArray(d.transactions)) saveTransactions(d.transactions);
  if(Array.isArray(d.slots))        saveSlots(d.slots);
  if(Array.isArray(d.calcRecords))  saveCalcRecords(d.calcRecords);
  if(Array.isArray(d.loans))        saveLoans(d.loans);
  if(Array.isArray(d.bandos))       saveBandos(d.bandos);
  if(Array.isArray(d.customers))    saveCustomerProfiles(d.customers);
  if(Array.isArray(d.orders))       savePendingOrders(d.orders);
  if(d.meta){
    _cache.lastDate      = d.meta.lastDate || _cache.lastDate;
    _cache.orderCounter  = d.meta.orderCounter || 0;
    _cache.assistantPhone= d.meta.assistantPhone || '';
    _orderCounter = _cache.orderCounter;
    saveMeta();
  }
  showToast('✅ Data imerudishwa — ukurasa unapakua upya...','success');
  setTimeout(()=>location.reload(), 1500);
}

function downloadCustomers(){
  const customers = buildCustomerDb();
  if(!customers.length) return showToast('Hakuna wateja wa kupakua','error');
  const rows = [
    ['#','Jina','Namba ya Simu','Chanzo','Agent','Mauzo','Jumla (TSh)','Tarehe ya Kwanza','Tarehe ya Mwisho','Maelezo'],
    ...customers.map((c,i)=>[
      i+1,
      c.name||'',
      c.phone,
      c.source==='agent'?'Agent':'Mteja Wangu',
      c.agent||'',
      c.count||0,
      Math.round(c.totalSpent||0),
      c.firstDate?c.firstDate.split('T')[0]:'',
      c.lastDate ?c.lastDate.split('T')[0] :'',
      c.note||''
    ])
  ];
  const csv  = rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=`wateja-smartbundles-${todayStr()}.csv`; a.click();
  URL.revokeObjectURL(url);
  showToast(`✓ Wateja ${customers.length} wamepakuliwa`,'success');
}

// ============================================================
// ORDERS PAGE
// ============================================================
// Order za zamani (kabla ya mfumo wa .id ya kipekee) zinaweza kukosa .id —
// hii inaziongezea id ya kipekee kila zinapopakiwa, ikizuia mgongano wa
// order mbili zenye orderNo sawa (mfano #020 x2 kutoka vifaa tofauti)
function migrateOrderIds(orders){
  let changed = false;
  orders.forEach(o=>{
    if(!o.id){ o.id = uid(); changed = true; }
  });
  return {orders, changed};
}

async function refreshOrdersFromFirestore(){
  let fresh = await loadDocFromFirestore('orders', []);
  const {orders, changed} = migrateOrderIds(fresh);
  fresh = orders;
  _cache.orders = fresh;
  if(changed) saveDocToFirestore('orders', fresh); // hifadhi id mpya zilizoongezwa
  return fresh;
}

// Soma upya Laini/Mabando/Slots kutoka Firestore kabla ya kufanya operesheni
// zinazobadilisha MB au slots — hii inapunguza mgongano wa data kati ya vifaa
// tofauti (simu na PC) vinapofanya kazi karibu wakati mmoja.
async function refreshInventoryFromFirestore(){
  const [lines, bandos, slots] = await Promise.all([
    loadDocFromFirestore('lines', []),
    loadDocFromFirestore('bandos', []),
    loadDocFromFirestore('slots', [])
  ]);
  _cache.lines  = lines;
  _cache.bandos = bandos;
  _cache.slots  = slots;
}

function getPendingOrders(){
  return _cache.orders || [];
}
function savePendingOrders(orders){
  _cache.orders = orders;
  saveDocToFirestore('orders', orders);
}

let _showFullOrderHistory = false;
function toggleOrderHistoryView(){
  _showFullOrderHistory = !_showFullOrderHistory;
  renderOrdersPage();
}

function renderOrdersPage(){
  const orders  = getPendingOrders();
  const pending = orders.filter(o=>o.status==='pending');
  const today   = todayStr();
  // Orders zote zilizokamilika LEO, zikipangwa kwa tarakimu kuanzia #001
  const doneToday = orders
    .filter(o=>o.status==='done' && dateKeyLocal(o.doneAt||o.createdAt||'')===today)
    .sort((a,b)=> (parseInt(a.orderNo,10)||0) - (parseInt(b.orderNo,10)||0));
  const done = _showFullOrderHistory
    ? doneToday                          // historia kamili — kuanzia #001
    : doneToday.slice(-10).reverse();    // za hivi karibuni pekee (chaguo-msingi)
  const el      = document.getElementById('ordersList');
  if(!el) return;

  if(!pending.length && !doneToday.length){
    el.innerHTML=`<div class="empty-state">Hakuna orders kwa sasa — tuma order kwanza kupitia "Pata Laini"</div>`;
    return;
  }

  let html = '';

  // Pending orders
  if(pending.length){
    html += `<div class="section-title" style="margin-bottom:.75rem">⏳ Zinasubiri Confirm (${pending.length})</div>`;
    html += pending.map(o=>`
      <div style="background:var(--bg2);border:1.5px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:.75rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.75rem">
          <div>
            <div style="font-size:1rem;font-weight:700;color:var(--accent)">ORDER #${o.orderNo}</div>
            <div style="font-size:.8rem;color:var(--text2);margin-top:.2rem">${fmtDateTime(o.createdAt)}</div>
          </div>
          <span style="font-size:.7rem;font-weight:700;padding:.2rem .5rem;border-radius:6px;background:rgba(251,191,36,.15);color:var(--warning)">⏳ Inasubiri</span>
        </div>
        <div style="background:var(--bg3);border-radius:8px;padding:.7rem;font-size:.82rem;line-height:1.8;margin-bottom:.85rem;font-family:monospace;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;max-width:100%;overflow-x:auto">
🔔 ORDER #${o.orderNo}
────────────
📦 MB: ${o.mb} (${o.type==='week'?'WIKI':'MWEZI'})
📱 Laini: ${o.lineSimNo||'—'} - ${o.lineDevice||'—'}
👤 Namba: ${o.buyerPhone}
────────────
Reply: DONE#${o.orderNo}</div>
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.75rem;font-size:.82rem;background:var(--bg3);border-radius:8px;padding:.5rem .75rem">
          <input type="checkbox" id="smsToggle_${o.id}" ${o.sendSmsToCustomer!==false?'checked':''}
            onchange="toggleOrderSms('${o.id}', this.checked)"
            style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer"/>
          <label for="smsToggle_${o.id}" style="cursor:pointer;color:var(--text2);text-transform:none;letter-spacing:0;font-size:.82rem;font-weight:400">📱 Mtumie mteja SMS ya "Hongera" hapo Done itakapobonyezwa</label>
        </div>
        <div style="display:flex;gap:.5rem">
          <button class="btn btn-ghost btn-sm" onclick="copyPendingOrder('${o.id}')">📋 Nakili</button>
          <button class="btn btn-ghost btn-sm" onclick="editPendingOrderPrice('${o.id}')" style="border-color:var(--accent);color:var(--accent)">✏️ Bei: ${o.sellingPrice?fmt(o.sellingPrice):'HAIJAWEKWA'}</button>
          <button class="btn btn-success" style="flex:1" onclick="confirmSingleOrder('${o.id}')">✅ Done</button>
          <button class="btn btn-danger btn-sm" onclick="cancelOrder('${o.id}')">✕</button>
        </div>
      </div>`).join('');
  }

  // Done orders (historia ya leo)
  if(doneToday.length){
    html += `<div class="section-title" style="margin-top:1.5rem;margin-bottom:.75rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.5rem">
      <span>✅ Zilizokamilika Leo (${doneToday.length})</span>
      ${doneToday.length>10 ? `<button class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:.35rem .6rem" onclick="toggleOrderHistoryView()">${_showFullOrderHistory?'🔼 Onyesha za Hivi Karibuni':'📜 Ona Zote Kuanzia #001'}</button>` : ''}
    </div>`;
    html += done.map(o=>`
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;margin-bottom:.5rem;opacity:.7">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-weight:600">ORDER #${o.orderNo} <span style="font-size:.7rem;color:var(--success)">✅ Done</span></div>
            <div style="font-size:.78rem;color:var(--text2)">${o.mb}MB · ${o.lineSimNo||'—'} ${o.lineDevice||'—'} · ${o.buyerPhone}</div>
          </div>
          <div style="font-size:.75rem;color:var(--text3)">${fmtDateTime(o.doneAt||o.createdAt)}</div>
        </div>
      </div>`).join('');
  }

  el.innerHTML = html;
}

function toggleOrderSms(id, checked){
  const orders = getPendingOrders();
  const idx = orders.findIndex(o=>o.id===id);
  if(idx<0) return;
  orders[idx].sendSmsToCustomer = checked;
  savePendingOrders(orders);
}

function copyPendingOrder(id){
  const o = getPendingOrders().find(o=>o.id===id);
  if(!o) return;
  const msg = `🔔 ORDER #${o.orderNo}\n━━━━━━━━━━━━\n📦 MB: ${o.mb} (${o.type==='week'?'WIKI':'MWEZI'})\n📱 Laini: ${o.lineSimNo||'—'} - ${o.lineDevice||'—'}\n👤 Namba: ${o.buyerPhone}\n━━━━━━━━━━━━\nReply: DONE#${o.orderNo}`;
  navigator.clipboard?.writeText(msg)
    .then(()=>showToast(`✓ ORDER #${o.orderNo} umenakiliwa`,'success'))
    .catch(()=>{ const ta=document.createElement('textarea');ta.value=msg;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);showToast('✓ Umenakiliwa','success'); });
}

async function editPendingOrderPrice(id){
  await refreshOrdersFromFirestore();
  const orders = getPendingOrders();
  const o = orders.find(x=>x.id===id);
  if(!o) return showToast(`⚠️ Order haipo tena`,'warning');
  const newPrice = prompt(`Ingiza bei ya kuuzia kwa ORDER #${o.orderNo}\n(${o.mb}MB, Gharama: ${fmt(o.cost||0)}):`, o.sellingPrice||'');
  if(newPrice===null) return; // Ghairi
  const price = parseFloat(newPrice);
  if(!price || price<=0) return showToast('Bei si sahihi','error');
  const idx = orders.findIndex(x=>x.id===id);
  orders[idx].sellingPrice = price; orders[idx].priceTier=salePriceTier(orders[idx].type,orders[idx].mb,price);
  savePendingOrders(orders);
  showToast(`✓ Bei ya ORDER #${o.orderNo} imewekwa: ${fmt(price)}`,'success');
  renderOrdersPage();
}

const _processingOrders = new Set();
async function confirmSingleOrder(id){if(_processingOrders.has(id))return;_processingOrders.add(id);try{const o=getPendingOrders().find(x=>x.id===id);if(!o){showToast('⚠️ Order haipo tena','warning');return}if(!o.sellingPrice||o.sellingPrice<=0){showToast(`⚠️ ORDER #${o.orderNo} haina bei`,'error');return}const done=await processOrderDone(o);showToast(done?`✅ ORDER #${o.orderNo} imekamilika`:`ORDER #${o.orderNo} tayari imekamilika`,done?'success':'warning');renderOrdersPage();renderPendingOrdersBadge();renderAll()}catch(e){await initFirebase();showToast('Oda haijakamilika: '+(e.message||'hakiki mtandao'),'error')}finally{_processingOrders.delete(id)}}
async function confirmAllOrders(){const pending=getPendingOrders().filter(o=>o.status==='pending');if(!pending.length)return showToast('Hakuna orders za kukonfirm','error');if(pending.some(o=>!o.sellingPrice||o.sellingPrice<=0))return showToast('Weka bei za orders zote kwanza','error');document.getElementById('confirmMessage').textContent=`Confirm orders zote ${pending.length}? Mauzo yatajazwa na SMS zinaweza kutumwa.`;document.getElementById('confirmBtn').onclick=async()=>{closeModal('modalConfirm');let done=0;for(const o of pending){try{if(await processOrderDone(o))done++}catch(e){console.error('Order confirmation failed',o.id,e);await initFirebase()}}showToast(`✅ Orders ${done} zimekamilika; yaliyobaki yameachwa bila kubadilika.`,'success');renderOrdersPage();renderPendingOrdersBadge();renderAll()};openModal('modalConfirm')}
async function processOrderDone(o){let smsOrder=null;const now=new Date().toISOString();const completed=await fbDb.runTransaction(async tx=>{const names=['orders','sales','lines','bandos','slots'],snaps=await Promise.all(names.map(n=>tx.get(dataDocRef(n)))),orders=txItems(snaps[0],[]),sales=txItems(snaps[1],[]),lines=txItems(snaps[2],[]),bandos=txItems(snaps[3],[]),slots=txItems(snaps[4],[]),idx=orders.findIndex(x=>x.id===o.id);if(idx<0)throw new Error('Oda haipo kwenye hifadhidata.');const current=orders[idx];if(current.status==='done')return false;const line=lines.find(l=>l.id===current.lineId);if(!line)throw new Error('Laini ya oda haipo.');let cost=current.cost;if(cost===undefined||cost===null){const fifo=txFifoCost(lines,bandos,current.lineId,current.type,current.mb);if(!fifo)throw new Error('MB haitoshi kwa oda hii.');txIncrementSlot(slots,current.lineId,current.type);txApplyFifo(lines,bandos,current.lineId,current.type,current.mb,fifo.usedBandos);cost=fifo.totalCost;current.usedBandos=fifo.usedBandos;current.cost=cost}const saleId='sale-order-'+current.id;if(!sales.some(x=>x.id===saleId)){const amount=parseFloat(current.sellingPrice)||0;sales.push({id:saleId,lineId:current.lineId,lineName:current.lineName||line.name,linePhone:line.phone,type:current.type,costPrice:cost,sellingPrice:amount,priceTier:current.priceTier||salePriceTier(current.type,current.mb,amount),profit:amount-cost,mb:fmtMB(current.mb),sellMb:current.mb,buyerPhone:current.buyerPhone||null,orderNo:current.orderNo,usedBandos:current.usedBandos||[],date:now})}current.status='done';current.doneAt=now;['orders','sales','lines','bandos','slots'].forEach((n,i)=>txWriteItems(tx,n,[orders,sales,lines,bandos,slots][i]));_cache.orders=orders;_cache.sales=sales;_cache.lines=lines;_cache.bandos=bandos;_cache.slots=slots;smsOrder={...current};return true});if(completed&&smsOrder.buyerPhone&&smsOrder.sendSmsToCustomer!==false){let phone=smsOrder.buyerPhone.replace(/\s+/g,'');if(phone.startsWith('0'))phone='255'+phone.slice(1);if(phone.startsWith('+'))phone=phone.slice(1);try{await fetch('https://nextsms-proxy.hanshannu9.workers.dev',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:phone,text:buildSmsMessage(fmtMB(smsOrder.mb),parseFloat(smsOrder.sellingPrice)||0)})})}catch(e){console.error('SMS error:',e)}}return completed}

function cancelOrder(id){document.getElementById('confirmMessage').textContent='Futa oda hii? MB na slot zake zitarudishwa kwa pamoja.';document.getElementById('confirmBtn').onclick=async()=>{try{await fbDb.runTransaction(async tx=>{const names=['orders','lines','bandos','slots'],snaps=await Promise.all(names.map(n=>tx.get(dataDocRef(n)))),orders=txItems(snaps[0],[]),lines=txItems(snaps[1],[]),bandos=txItems(snaps[2],[]),slots=txItems(snaps[3],[]),idx=orders.findIndex(x=>x.id===id);if(idx<0)throw new Error('Oda haipo tena.');const o=orders[idx];if(o.status==='done')throw new Error('Oda iliyokamilika haiwezi kufutwa hapa.');if(o.usedBandos){o.usedBandos.forEach(u=>{const b=bandos.find(x=>x.id===u.bandoId);if(b){b.usedMb=Math.max(0,(b.usedMb||0)-u.mbUsed);b.active=true}});const l=lines.find(x=>x.id===o.lineId);if(l){if(o.type==='week')l.mbWeek=(l.mbWeek||0)+o.mb;else l.mbMonth=(l.mbMonth||0)+o.mb}txDecrementSlot(slots,o.lineId,o.type)}orders.splice(idx,1);['orders','lines','bandos','slots'].forEach((n,i)=>txWriteItems(tx,n,[orders,lines,bandos,slots][i]));_cache.orders=orders;_cache.lines=lines;_cache.bandos=bandos;_cache.slots=slots});closeModal('modalConfirm');showToast('Oda imefutwa; MB na slot zimerejeshwa.','success');renderOrdersPage();renderPendingOrdersBadge();renderAll()}catch(e){await initFirebase();closeModal('modalConfirm');showToast('Oda haijafutwa: '+(e.message||'hitilafu'),'error')}};openModal('modalConfirm')}

// ============================================================
// MANUAL ORDER — Laini/GB Yoyote (kwenye Nunua Bando page)
// ============================================================
let _manualOrderType = 'week';

function selectManualOrderType(type, el){
  _manualOrderType = type;
  document.querySelectorAll('[data-motype]').forEach(b=>b.classList.toggle('active', b.dataset.motype===type));
}

function onManualOrderLineChange(){
  const lineId = document.getElementById('manualOrderLine').value;
  const infoEl = document.getElementById('manualOrderLineInfo');
  if(!lineId){ infoEl.style.display='none'; return; }
  const line = getLines().find(l=>l.id===lineId);
  if(!line){ infoEl.style.display='none'; return; }
  const wMb = lineMbAvailable(lineId,'week');
  const mMb = lineMbAvailable(lineId,'month');
  const ownerBadge = line.owner==='worker'
    ? `<span style="font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;background:rgba(251,191,36,.15);color:var(--warning)">🤖 Assistant</span>`
    : `<span style="font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:4px;background:rgba(0,196,167,.12);color:var(--accent)">👤 Wangu</span>`;
  infoEl.style.display='block';
  infoEl.innerHTML = `
    <div class="slot-info-box">
      <div class="sib-row"><span class="sib-label">Simu</span><span class="sib-val">${line.simNo||'—'} · ${line.device||'—'} ${ownerBadge}</span></div>
      <div class="sib-row"><span class="sib-label">MB za Wiki</span><span class="sib-val ${wMb>0?'ok':'full'}">${fmtMB(wMb)}</span></div>
      <div class="sib-row"><span class="sib-label">MB za Mwezi</span><span class="sib-val ${mMb>0?'ok':'full'}">${fmtMB(mMb)}</span></div>
    </div>`;
}

function openManualOrder(){
  const lineId = document.getElementById('manualOrderLine').value;
  const mb     = parseFloat(document.getElementById('manualOrderMb').value)||0;
  const type   = _manualOrderType;
  if(!lineId) return showToast('Chagua laini kwanza','error');
  if(!mb)     return showToast('Ingiza MB kwanza','error');

  const line = getLines().find(l=>l.id===lineId);
  if(!line) return;

  // Angalia slot na MB
  const slots = getLineSlots(lineId);
  if(type==='week'  && slots.weekUsed >=MAX_WEEK)  return showToast('⚠️ Slots za Wiki zimekwisha kwa laini hii leo!','warning');
  if(type==='month' && slots.monthUsed>=MAX_MONTH) return showToast('⚠️ Slots za Mwezi zimekwisha kwa laini hii leo!','warning');
  const avail = lineMbAvailable(lineId, type);
  if(mb > avail) return showToast(`❌ MB haitoshi! Zilizopo (${type==='week'?'Wiki':'Mwezi'}): ${fmtMB(avail)}`,'error');

  // Fungua modal ya order — sawa na ile ya Pata Laini
  openOrderModal(lineId, type, mb);
}

// ============================================================
// ORDER SYSTEM
// ============================================================
let _orderCounter = 0; // itasasishwa kutoka Firestore baada ya initFirebase
let _pendingOrder = null;

function openOrderModal(lineId, type, mb){
  const line = getLines().find(l=>l.id===lineId);
  if(!line) return;
  const mbLabel   = fmtMB(mb);
  const typeLabel = type==='week'?'WIKI':'MWEZI';
  // orderNo na id vitapangwa wakati wa "Hifadhi Order" — si sasa — ili kuepuka
  // namba kurukwa endapo dirisha hili litafungwa bila kuhifadhi
  const fifo = computeFifoCost(lineId, type, mb);
  const cost = fifo ? fifo.totalCost : 0;
  // Bei ya default kutoka pricing table
  const defaultPrice = calcPriceForMB(type, mb) || 0;
  _pendingOrder = { lineId, type, mb, mbLabel, orderNo:null, id:null, line, cost };
  // Info juu
  const infoEl = document.getElementById('orderLineInfo');
  if(infoEl) infoEl.innerHTML = `
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
      <span style="font-weight:600">${line.name}</span>
      <span style="color:var(--text2)">${line.simNo||'SIM1'} · ${line.device||'—'}</span>
      <span style="color:var(--accent)">${mbLabel} (${typeLabel})</span>
      ${fifo?`<span style="color:var(--text3);font-size:.78rem">Gharama: ${fmt(cost)}</span>`:''}
    </div>`;
  // Weka bei ya default
  const priceEl = document.getElementById('orderSellingPrice');
  if(priceEl) priceEl.value = defaultPrice || '';
  renderOrderPriceChoices();
  const costEl = document.getElementById('orderCostPreview');
  if(costEl)  costEl.value  = fifo ? fmt(cost) : '—';
  document.getElementById('orderBuyerPhone').value = '';
  updateOrderPreview();
  openModal('modalOrder');
  setTimeout(()=>document.getElementById('orderBuyerPhone').focus(), 200);
}

function renderOrderPriceChoices(){
  const wrap=document.getElementById('orderPriceOptions'),box=document.getElementById('orderPriceChoiceButtons');
  if(!wrap||!box)return;
  const choices=_pendingOrder?sellPriceChoices(_pendingOrder.type,_pendingOrder.mb):[];
  wrap.style.display=choices.length?'block':'none';if(!choices.length){box.innerHTML='';return}
  const current=Number(document.getElementById('orderSellingPrice')?.value)||0;
  box.innerHTML=choices.map(o=>'<button type="button" class="type-btn'+(current===o.price?' active':'')+'" onclick="selectOrderPrice('+o.price+')">'+o.label+' · '+fmt(o.price)+'</button>').join('');
}
function selectOrderPrice(price){document.getElementById('orderSellingPrice').value=price;renderOrderPriceChoices();updateOrderPreview()}
function onOrderPriceInput(){renderOrderPriceChoices();updateOrderPreview()}function updateOrderPreview(){
  if(!_pendingOrder) return;
  const {line, mbLabel} = _pendingOrder;
  const orderNo   = _pendingOrder.orderNo || '(itapangwa)';
  const typeLabel = _pendingOrder.type==='week'?'WIKI':'MWEZI';
  const phone = document.getElementById('orderBuyerPhone')?.value.trim() || '—';
  const msg = `🔔 ORDER #${orderNo}\n━━━━━━━━━━━━\n📦 MB: ${_pendingOrder.mb} (${typeLabel})\n📱 Laini: ${line.simNo||'SIM1'} - ${line.device||'—'}\n👤 Namba: ${phone}\n━━━━━━━━━━━━\nReply: DONE#${orderNo}`;
  const el = document.getElementById('orderMsgPreview');
  if(el) el.textContent = msg;
  _pendingOrder.msg = msg;
}

function copyOrderMsg(){
  if(!_pendingOrder?.msg) return;
  // Update phone before copying
  updateOrderPreview();
  navigator.clipboard?.writeText(_pendingOrder.msg)
    .then(()=>showToast('✓ Ujumbe umenakiliwa — tuma kwa Assistant!','success'))
    .catch(()=>{
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = _pendingOrder.msg;
      document.body.appendChild(ta);
      ta.select(); document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('✓ Ujumbe umenakiliwa!','success');
    });
}

async function sendOrderSmsToAssistant(msg){
  const phoneRaw = (_cache.assistantPhone||'').trim();
  if(!phoneRaw){
    // Hakuna namba iliyowekwa — nakili tu kama zamani
    copyOrderMsg();
    showToast('⚠️ Weka namba ya Assistant kwenye Mipangilio ili SMS itumwe moja kwa moja','warning');
    return false;
  }
  let phone = phoneRaw.replace(/\s+/g,'');
  if(phone.startsWith('0')) phone='255'+phone.slice(1);
  if(phone.startsWith('+')) phone=phone.slice(1);
  try {
    const res  = await fetch('https://nextsms-proxy.hanshannu9.workers.dev',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({to:phone, text:msg})
    });
    const data = await res.json();
    if(res.ok && !data.error){
      showToast('✅ SMS imetumwa kwa Assistant moja kwa moja!','success');
      return true;
    } else {
      copyOrderMsg();
      showToast('⚠️ SMS haikutumwa — ujumbe umenakiliwa, tuma mwenyewe','warning');
      return false;
    }
  } catch(e){
    copyOrderMsg();
    showToast('⚠️ Tatizo la mtandao — ujumbe umenakiliwa, tuma mwenyewe','warning');
    return false;
  }
}

async function confirmOrder(){
 if(window._creatingOrder)return;window._creatingOrder=true;
 try{
  if(!_pendingOrder)throw new Error('Fomu ya oda haipo tena.');
  const phone=document.getElementById('orderBuyerPhone').value.trim(),sellingPrice=parseFloat(document.getElementById('orderSellingPrice').value)||0;
  if(!phone)throw new Error('Ingiza namba ya mteja kwanza');if(!sellingPrice)throw new Error('Ingiza bei ya kuuzia');
  const {lineId,type,mb,mbLabel}=_pendingOrder,orderId=_pendingOrder.id||uid(),createdAt=_pendingOrder.createdAt||new Date().toISOString();
  _pendingOrder.id=orderId;_pendingOrder.createdAt=createdAt;let savedOrder,createdOrder=false;
  await fbDb.runTransaction(async tx=>{
   createdOrder=false;
   const names=['lines','bandos','slots','orders','meta'],snaps=await Promise.all(names.map(n=>tx.get(dataDocRef(n)))),lines=txItems(snaps[0],[]),bandos=txItems(snaps[1],[]),slots=txItems(snaps[2],[]),orders=txItems(snaps[3],[]),meta=txItems(snaps[4],{}),line=lines.find(x=>x.id===lineId);
   if(!line)throw new Error('Laini haipo tena.');
   if(orders.some(o=>o.id===orderId)){savedOrder=orders.find(o=>o.id===orderId);return}
   const fifo=txFifoCost(lines,bandos,lineId,type,mb);if(!fifo)throw new Error('MB haitoshi tena kwa laini hii.');
   txIncrementSlot(slots,lineId,type);txApplyFifo(lines,bandos,lineId,type,mb,fifo.usedBandos);
   const day=todayStr(),next=(meta.orderDate===day?(Number(meta.orderCounter)||0):0)+1,orderNo=String(next).padStart(3,'0');
   savedOrder={id:orderId,orderNo,lineId,type,mb,mbLabel,buyerPhone:phone,sellingPrice,cost:fifo.totalCost,usedBandos:fifo.usedBandos,lineName:line.name,lineDevice:line.device,lineSimNo:line.simNo,sendSmsToCustomer:true,priceTier:salePriceTier(type,mb,sellingPrice),status:'pending',createdAt};
   orders.push(savedOrder);meta.orderCounter=next;meta.orderDate=day;
   ['lines','bandos','slots','orders'].forEach((n,i)=>txWriteItems(tx,n,[lines,bandos,slots,orders][i]));txWriteItems(tx,'meta',meta);
   _cache.lines=lines;_cache.bandos=bandos;_cache.slots=slots;_cache.orders=orders;_cache.orderCounter=next;_cache.orderDate=day;_orderCounter=next;createdOrder=true;
  });
  _pendingOrder.orderNo=savedOrder.orderNo;updateOrderPreview();closeModal('modalOrder');
  if(createdOrder)await sendOrderSmsToAssistant(_pendingOrder.msg);
  const nextEl=document.getElementById('nextOrderNoLabel');if(nextEl)nextEl.textContent=`Order inayofuata leo: #${String(_cache.orderCounter+1).padStart(3,'0')}`;
  renderPendingOrdersBadge();renderAll();
 }catch(e){await initFirebase();showToast('Oda haijahifadhiwa: '+(e.message||'hakiki mtandao'),'error')}finally{window._creatingOrder=false}
}

function renderPendingOrdersBadge(){
  const orders  = getPendingOrders();
  const pending = orders.filter(o=>o.status==='pending');
  const badge   = document.getElementById('ordersNavBadge');
  if(badge){
    badge.style.display = pending.length ? 'inline' : 'none';
    badge.textContent   = pending.length;
  }
}

// ============================================================
// SMART LINE FINDER
// ============================================================
const WIKI_GB_MAX  = 5;
const MONTH_GB_MIN = 6;

function finderBuildGbBtns(){
  const box = document.getElementById('finderGbBtns');
  if(!box) return;
  const wikiOpts  = [{gb:0.5,mb:512},{gb:0.75,mb:768},{gb:1,mb:1024},{gb:2,mb:2048},
                     {gb:3,mb:3072},{gb:4,mb:4096},{gb:5,mb:5120}];
  const monthOpts = [{gb:6,mb:6144},{gb:7,mb:7168},{gb:8,mb:8192},{gb:9,mb:9216},
                     {gb:10,mb:10240},{gb:11,mb:11264},{gb:12,mb:12288},{gb:13,mb:13312},
                     {gb:14,mb:14336},{gb:15,mb:15360}];
  box.innerHTML =
    `<div style="font-size:.7rem;color:var(--text3);width:100%;margin-bottom:.2rem">📅 WIKI</div>` +
    wikiOpts.map(o=>`<button type="button" class="type-btn" onclick="finderSelectGb(${o.gb},${o.mb},'week',this)">GB${o.gb}</button>`).join('') +
    `<div style="font-size:.7rem;color:var(--text3);width:100%;margin-top:.4rem;margin-bottom:.2rem">🗓️ MWEZI</div>` +
    monthOpts.map(o=>`<button type="button" class="type-btn" onclick="finderSelectGb(${o.gb},${o.mb},'month',this)">GB${o.gb}</button>`).join('');
}

function finderSelectGb(gb, mb, type, el){
  document.getElementById('finderMbInput').value = mb;
  document.querySelectorAll('#finderGbBtns .type-btn').forEach(b=>b.classList.remove('active'));
  if(el) el.classList.add('active');
  findBestLine(mb, type);
}

let _finderManualType = 'week';
function selectFinderManualType(type, el){
  _finderManualType = type;
  document.querySelectorAll('[data-mtype]').forEach(b=>b.classList.toggle('active', b.dataset.mtype===type));
}

function onFinderMbInput(){
  document.querySelectorAll('#finderGbBtns .type-btn').forEach(b=>b.classList.remove('active'));
}

function findBestLine(mbOverride, typeOverride){
  const mb = mbOverride || parseFloat(document.getElementById('finderMbInput').value)||0;
  if(!mb) return showToast('Ingiza MB kwanza','error');
  // Kama typeOverride imetolewa (kutoka GB button) tumia hiyo
  // Vinginevyo tumia chaguo la mtumiaji la Wiki/Mwezi (manual toggle)
  const preferredType = typeOverride || _finderManualType;
  const lines = getLines();

  function getCandidates(type){
    return lines
      .filter(l=>{
        const s = getLineSlots(l.id);
        const slotOk = type==='week' ? s.weekUsed<MAX_WEEK : s.monthUsed<MAX_MONTH;
        const mbAvail = lineMbAvailable(l.id, type);
        return slotOk && mbAvail >= mb;
      })
      .map(l=>({
        line:l, type,
        mbAvail: lineMbAvailable(l.id, type),
        mbWaste: lineMbAvailable(l.id, type) - mb,
        isWorker: l.owner==='worker'
      }))
      // Panga laini zenye MB nyingi zinazopatikana kwanza.
      .sort((a,b)=>{
        if(b.mbAvail !== a.mbAvail) return b.mbAvail - a.mbAvail;
        // Zikiwa na MB sawa, weka laini za Assistant mbele kama ilivyokuwa.
        if(a.isWorker && !b.isWorker) return -1;
        if(!a.isWorker && b.isWorker) return 1;
        return 0;
      });
  }

  let candidates = getCandidates(preferredType);
  let usedFallback = false;
  if(!candidates.length){
    const fallback = preferredType==='week'?'month':'week';
    candidates = getCandidates(fallback);
    usedFallback = true;
  }
  renderFinderResult(candidates, mb, preferredType, usedFallback);
}

function renderFinderResult(candidates, mb, preferredType, usedFallback){
  const box = document.getElementById('finderResult');
  if(!box) return;
  if(!candidates.length){
    box.innerHTML=`<div style="background:rgba(239,68,68,.1);border:1.5px solid rgba(239,68,68,.35);border-radius:12px;padding:1.5rem;text-align:center">
      <div style="font-size:2rem;margin-bottom:.5rem">😔</div>
      <div style="font-weight:700;color:var(--danger);margin-bottom:.25rem">Hakuna Laini Inayopatikana</div>
      <div style="font-size:.85rem;color:var(--text2)">Laini zote zimejaa slots au hazina MB za kutosha.<br>Nunua bando jipya au subiri slots zifunguliwe 00:00.</div>
    </div>`;
    return;
  }
  const best   = candidates[0];
  const others = candidates.slice(1,4);
  const typeLabel = best.type==='week'?'Wiki':'Mwezi';
  const fallbackNote = usedFallback
    ? `<div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:.6rem .85rem;font-size:.8rem;color:var(--warning);margin-bottom:1rem">
        ⚠️ Slots za ${preferredType==='week'?'Wiki':'Mwezi'} zimejaa — inapendekeza laini ya <strong>${typeLabel}</strong></div>` : '';
  const pct = Math.min(100,(mb/best.mbAvail)*100).toFixed(0);
  box.innerHTML=`
    ${fallbackNote}
    <div style="background:var(--bg2);border:2px solid var(--accent);border-radius:14px;padding:1.25rem;margin-bottom:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
        <div>
          <div style="font-size:.7rem;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin-bottom:.2rem">✅ Laini Bora</div>
          <div style="font-size:1.15rem;font-weight:700">${best.line.name}</div>
          <div style="font-size:.82rem;color:var(--text2)">${best.line.phone}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:.75rem;color:var(--text2)">${typeLabel}</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent)">${fmtMB(best.mbAvail)}</div>
          <div style="font-size:.72rem;color:var(--text3)">Itabaki: ${fmtMB(best.mbWaste)}</div>
        </div>
      </div>
      <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:1rem">
        <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:3px"></div>
      </div>
      <button class="btn btn-primary btn-full" onclick="useFinderLine('${best.line.id}','${best.type}',${mb})">
        💸 Fanya Mwenyewe → Nenda Uza Bando
      </button>
      ${best.line.owner==='worker'?`
      <button class="btn btn-ghost btn-full" style="margin-top:.5rem;border-color:var(--warning);color:var(--warning)" onclick="openOrderModal('${best.line.id}','${best.type}',${mb})">
        📤 Tuma Order kwa Assistant
      </button>`:`
      <button class="btn btn-ghost btn-full" style="margin-top:.5rem" onclick="openOrderModal('${best.line.id}','${best.type}',${mb})">
        📤 Tuma Order kwa Assistant
      </button>`}
    </div>
    ${others.length?`
    <div style="font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">Chaguzi Nyingine</div>
    ${others.map(c=>{
      const workerBadge = c.isWorker
        ? `<span style="font-size:.62rem;font-weight:700;padding:.1rem .35rem;border-radius:4px;background:rgba(251,191,36,.15);color:var(--warning);margin-left:.3rem">👷</span>`
        : `<span style="font-size:.62rem;padding:.1rem .35rem;border-radius:4px;background:rgba(0,196,167,.1);color:var(--accent);margin-left:.3rem">👤</span>`;
      return`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:.85rem 1rem;margin-bottom:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem">
          <div>
            <div style="font-weight:600;font-size:.9rem">${c.line.name}${workerBadge}</div>
            <div style="font-size:.75rem;color:var(--text2)">${c.line.phone}${c.line.device?' · '+c.line.simNo+' '+c.line.device:''} · ${c.type==='week'?'Wiki':'Mwezi'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:.9rem">${fmtMB(c.mbAvail)}</div>
            <div style="font-size:.7rem;color:var(--text3)">Itabaki: ${fmtMB(c.mbWaste)}</div>
          </div>
        </div>
        <div style="display:flex;gap:.4rem">
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="useFinderLine('${c.line.id}','${c.type}',${mb})">💸 Mwenyewe</button>
          <button class="btn btn-ghost btn-sm" style="flex:1;border-color:var(--warning);color:var(--warning)" onclick="openOrderModal('${c.line.id}','${c.type}',${mb})">📤 Assistant</button>
        </div>
      </div>`;
    }).join('')}` : ''}`;
}

function useFinderLine(lineId, type, mb){
  navigateTo('sell');
  setTimeout(()=>{
    const sel = document.getElementById('sellLine');
    if(sel){ sel.value=lineId; updateSellSlotInfo(); }
    selectBundleType(type);
    const mi = document.getElementById('sellMbAmount');
    if(mi && mb){ mi.value=mb; updateProfitPreview(); updateSellMbStatus(); }
    document.querySelector('.content')?.scrollTo(0,0);
  }, 150);
}

// ---- NAVIGATION ----
function navigateTo(page){
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));
  if(page==='dashboard')renderDashboard();
  if(page==='lines')renderLines();
  if(page==='sell'){renderTodaySales();updateSellSlotInfo()}
  if(page==='calc'){calcCompute();renderCalcRecords()}
  if(page==='balance'){updateBalancePage();updateBalancePreview()}
  if(page==='reports')renderReports();
  if(page==='loans'){renderLoans();}
  if(page==='sms'){document.getElementById('freeSmsPhone')?.focus()}
  if(page==='orders'){
    renderOrdersPage(); // onyesha haraka na data ya sasa hivi
    refreshOrdersFromFirestore().then(()=>renderOrdersPage()); // kisha sasisha na data mpya zaidi
  }
  if(page==='customers'){ renderCustomers(); }
  if(page==='finder'){
    finderBuildGbBtns();
    document.getElementById('finderResult').innerHTML='';
    document.getElementById('finderMbInput').value='';
    _finderManualType='week';
    document.querySelectorAll('[data-mtype]').forEach(b=>b.classList.toggle('active', b.dataset.mtype==='week'));
  }
  if(page==='settings'){
    document.getElementById('settingPinLen').textContent=PIN_LENGTH+' namba';
    const bp = document.getElementById('bossPhoneInput');
    if(bp) bp.value = localStorage.getItem('bm_boss_phone')||'';
    saveBossPhone();
    const ap = document.getElementById('assistantPhoneInput');
    if(ap) ap.value = _cache.assistantPhone||'';
    const apSt = document.getElementById('assistantPhoneStatus');
    if(apSt){
      if(_cache.assistantPhone){ apSt.textContent='✅ Order zote zitatumwa SMS moja kwa moja kwa namba hii'; apSt.style.color='var(--success)'; }
      else { apSt.textContent='Hakuna namba — utahitaji kunakili ujumbe mwenyewe'; apSt.style.color='var(--text3)'; }
    }
    const on=document.getElementById('currentOrderNo');if(on)on.value=_orderCounter;
    const nextNo=document.getElementById('nextOrderNoLabel');if(nextNo)nextNo.textContent=`Order inayofuata leo: #${String(_cache.orderCounter+1).padStart(3,'0')}`;
  }
}
document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click',()=>navigateTo(btn.dataset.page)));
document.getElementById('balanceLine').addEventListener('change',updateBalancePreview);

// ---- RENDER ALL ----
function renderAll(){populateLineSelects();renderDashboard();renderLines();renderLoansDashSummary()}

// ---- TOPBAR DATE ----
function setTopbarDate(){
  document.getElementById('topbarDate').textContent=new Date().toLocaleDateString('sw-TZ',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
}

// ---- INIT ----
async function initApp(){
  try{await resetSlotsIfNewDay()}catch(e){console.error('Initial slot reset failed',e);showToast('Slots zitakaguliwa upya mtandao ukirudi.','warning')}
  scheduleNextMidnightReset();
  initTheme();
  setTopbarDate();
  renderAll();
  calcBuildGbBtns();
  navigateTo('dashboard');
  checkLoanReminders();
  scheduleDailyReport();
  renderPendingOrdersBadge();
}
initFirebaseGate();

function initTheme(){const theme=localStorage.getItem('bm_theme')||'dark';document.documentElement.dataset.theme=theme;const b=document.getElementById('themeToggle');if(b)b.textContent=theme==='dark'?'☀️ Mwangaza':'🌙 Giza'}
function toggleTheme(){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;localStorage.setItem('bm_theme',theme);const b=document.getElementById('themeToggle');if(b)b.textContent=theme==='dark'?'☀️ Mwangaza':'🌙 Giza'}
