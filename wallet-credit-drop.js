/* L1017n — credited-wallet celebration (visual only).
 * Source of truth: authenticated customer's positive 'topup' wallet_transactions.
 * Never creates credits, sends money, or celebrates purchases/refunds.
 */
(function(){
 'use strict';
 if(window.L1017nCreditDrop)return;
 const storagePrefix='l1017n-wallet-credits-seen-v1:';
 const shownPrefix='l1017n-wallet-credits-shown-v1:';
 const maxAge=12*60*1000;
 const trackedLimit=35;
 let activeUser='',seen=new Set(),hasBaseline=false,polling=false;
 let channel=null,queue=[],isPlaying=false,shown=new Set();
 const client=()=>typeof supabaseClient!=='undefined'?supabaseClient:null;
 const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const valid=entry=>entry&&entry.id&&Number.isFinite(Number(entry.amount))&&Number(entry.amount)>0&&entry.transaction_type==='topup';
 const key=user=>storagePrefix+user;
 function loadSeen(user){
   try{const arr=JSON.parse(sessionStorage.getItem(key(user))||'null');return Array.isArray(arr)?arr.filter(x=>typeof x==='string').slice(-trackedLimit):null}catch(_){return null}
 }
 function saveSeen(){
   if(!activeUser)return;
   try{sessionStorage.setItem(key(activeUser),JSON.stringify(Array.from(seen).slice(-trackedLimit)))}catch(_){}
 }
 function saveShown(){
   if(!activeUser)return;
   try{sessionStorage.setItem(shownPrefix+activeUser,JSON.stringify(Array.from(shown).slice(-trackedLimit)))}catch(_){}
 }
 function remember(id){
   if(!id||seen.has(id))return false;
   seen.add(id);
   if(seen.size>trackedLimit)seen.delete(seen.values().next().value);
   saveSeen();return true;
 }
 function releaseChannel(){
   const db=client();
   if(db&&channel){try{void db.removeChannel(channel)}catch(_){}}
   channel=null;
 }
 function changeUser(user){
   if(user===activeUser)return;
   releaseChannel();activeUser=user||'';queue=[];hasBaseline=false;
   seen=new Set();shown=new Set();
   if(activeUser){
     try{const old=JSON.parse(sessionStorage.getItem(shownPrefix+activeUser)||'[]');if(Array.isArray(old))old.slice(-trackedLimit).forEach(id=>shown.add(String(id)))}catch(_){}
   }
   const stored=activeUser?loadSeen(activeUser):null;
   if(stored){stored.forEach(id=>seen.add(id));hasBaseline=true}
   if(activeUser)listen();
 }
 function listen(){
   const db=client();
   if(!db?.channel||!activeUser)return;
   try{
     const forUser=activeUser;
     channel=db.channel('l1017n-credit-drop-'+forUser.slice(0,13)+'-'+Date.now())
       .on('postgres_changes',{
         event:'INSERT',schema:'public',table:'wallet_transactions',
         filter:'user_id=eq.'+forUser
       },payload=>{
         if(activeUser!==forUser)return;
         const entry=payload?.new;
         if(entry?.transaction_type==='topup'&&Number(entry.amount)>0){
           void scan();
         }
       }).subscribe();
   }catch(e){console.warn('[wallet-credit] Realtime unavailable, polling active',e)}
 }
 function target(){
   const wallet=document.getElementById('walletView');
   const card=document.querySelector('#walletView .wallet-hero');
   const value=document.getElementById('walletShowcaseBalance');
   const box=value?.getBoundingClientRect();
   const open=wallet&&!wallet.classList.contains('hidden')&&card&&value&&
     box&&box.width>0&&box.height>0&&box.top<innerHeight-20&&box.bottom>20;
   if(open)return {element:value,card:card};
   const chip=document.getElementById('customerWalletChip');
   const amount=document.getElementById('customerHeaderBalance');
   if(chip&&amount&&!chip.classList.contains('hidden')&&amount.getClientRects().length)return {element:amount,card:chip};
   return null;
 }
 function creditLabel(amount){return '+'+Number(amount).toFixed(3)+' د.ل'}
 async function refreshBalances(){
   try{
     if(typeof renderWallet==='function')await renderWallet();
     const db=client();
     if(db&&activeUser&&typeof renderCustomerHeaderWallet==='function'){
       const auth=await db.auth.getUser();
       if(auth?.data?.user?.id===activeUser)await renderCustomerHeaderWallet(auth.data.user);
     }
   }catch(e){console.warn('[wallet-credit] Could not refresh wallet UI',e)}
 }
 function sparkle(card){
   if(!card)return;
   card.classList.remove('l1017n-credit-landed');
   void card.offsetWidth;
   card.classList.add('l1017n-credit-landed');
   window.setTimeout(()=>card.classList.remove('l1017n-credit-landed'),1100);
 }
 async function fly(entry){
   const found=target();
   const amount=Number(entry.amount);
   if(!found){
     await refreshBalances();
     return;
   }
   const el=found.element,card=found.card;
   const rect=el.getBoundingClientRect();
   const toX=Math.max(20,Math.min(innerWidth-20,rect.left+rect.width/2));
   const toY=Math.max(20,Math.min(innerHeight-20,rect.top+rect.height/2));
   const startX=Math.max(78,Math.min(innerWidth-78,toX+20));
   const fromY=-85;
   const host=document.createElement('div');
   host.className='l1017n-credit-fly-layer';
   host.setAttribute('aria-label','تم شحن المحفظة بنجاح: '+creditLabel(amount));
   host.setAttribute('role','status');
   const drop=document.createElement('div');
   drop.className='l1017n-credit-fly-pill';
   const glyph=document.createElement('span');
   glyph.className='l1017n-credit-coin';glyph.setAttribute('aria-hidden','true');glyph.textContent='+';
   const caption=document.createElement('span');caption.textContent=creditLabel(amount);
   drop.append(glyph,caption);host.appendChild(drop);
   document.body.appendChild(host);
   const duration=reduce()?150:1250;
   if(!reduce()&&drop.animate){
     const animation=drop.animate([
       {transform:'translate('+startX+'px,'+fromY+'px) scale(.88)',opacity:0,filter:'blur(5px)',offset:0},
       {transform:'translate('+startX+'px,'+(Math.max(45,toY-210))+'px) scale(1.07)',opacity:1,filter:'blur(0)',offset:.28},
       {transform:'translate('+(toX-8)+'px,'+(toY-36)+'px) scale(1.06)',opacity:1,filter:'blur(0)',offset:.82},
       {transform:'translate('+toX+'px,'+toY+'px) scale(.35)',opacity:0,filter:'blur(0)',offset:1}
     ],{duration,easing:'cubic-bezier(.16,.78,.28,1)',fill:'forwards'});
     try{await animation.finished}catch(_){}
   }else{
     drop.style.transform='translate('+toX+'px,'+toY+'px)';
     await new Promise(resolve=>setTimeout(resolve,150));
   }
   host.remove();sparkle(card);
   const display=card.querySelector('.wallet-candy-gain');
   if(display){
     clearTimeout(display._hideTimer);display.textContent=creditLabel(amount);
     display._hideTimer=setTimeout(()=>{display.textContent=''},2100);
   }
   await refreshBalances();
 }
 function enqueue(entry,explicitApproved){
   if(!valid(entry)||!activeUser)return;
   const id=String(entry.id);
   const newCredit=remember(id);
   // A callback for the approved request can announce a credit that an
   // overlapping initial scan silently included in its baseline.
   if((!newCredit&&!explicitApproved)||shown.has(id))return;
   const created=Date.parse(entry.created_at||'');
   if(Number.isFinite(created)&&Date.now()-created>maxAge)return;
   shown.add(id);saveShown(); // one celebration per approved ledger credit
   queue.push(entry);
   void drain();
 }
 async function drain(){
   if(isPlaying||!queue.length)return;
   isPlaying=true;
   while(queue.length){
     const row=queue.shift();
     if(document.visibilityState==='hidden')await refreshBalances();
     else{
       try{await fly(row)}catch(e){console.warn('[wallet-credit] Animation unavailable',e);await refreshBalances()}
     }
   }
   isPlaying=false;
 }
 async function syncUser(){
   const db=client();if(!db)return '';
   try{const {data}=await db.auth.getUser();const uid=data?.user?.id||'';changeUser(uid);return uid}
   catch(_){return ''}
 }
 async function scan(){
   const db=client();if(!db||polling)return;
   polling=true;
   try{
     const user=await syncUser();
     if(!user)return;
     const result=await db.from('wallet_transactions')
       .select('id,user_id,topup_request_id,amount,transaction_type,created_at')
       .eq('user_id',user).eq('transaction_type','topup').gt('amount',0)
       .order('created_at',{ascending:false}).limit(25);
     if(result.error)throw result.error;
     if(user!==activeUser)return;
     const entries=Array.isArray(result.data)?result.data:[];
     if(!hasBaseline){
       entries.forEach(e=>remember(String(e.id)));
       hasBaseline=true;
       return;
     }
     // Oldest first: two approved transactions get two distinct effects.
     entries.slice().reverse().forEach(enqueue);
   }catch(e){console.warn('[wallet-credit] Could not check approved credits',e)}
   finally{polling=false}
 }
 async function approved(requestId){
   if(!requestId)return;
   const db=client();if(!db)return;
   const user=await syncUser();if(!user)return;
   // Approved top-up status is not enough; require an actual credited ledger row.
   const result=await db.from('wallet_transactions')
     .select('id,user_id,topup_request_id,amount,transaction_type,created_at')
     .eq('user_id',user).eq('topup_request_id',String(requestId))
     .eq('transaction_type','topup').gt('amount',0).limit(1);
   if(result.error)return;
   (result.data||[]).forEach(row=>enqueue(row,true));
 }
 function init(){
   void scan();
   window.addEventListener('focus',()=>{void scan()});
   document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void scan()});
   window.addEventListener('online',()=>{void scan()});
   const db=client();
   db?.auth?.onAuthStateChange?.(event=>{
     if(event==='SIGNED_OUT'){changeUser('');return}
     if(['SIGNED_IN','INITIAL_SESSION'].includes(event))setTimeout(()=>{void scan()},50);
   });
   window.setInterval(()=>{
     if(document.visibilityState==='visible')void scan();
   },4800);
 }
 window.L1017nCreditDrop=Object.freeze({approved,check:scan});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();