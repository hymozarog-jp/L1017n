/* L1017N anonymous visits.
   Counts one session per tab and unique browsers by a random first-party ID.
   No IP, name, email or device fingerprint is sent or stored. */
(function(){
  "use strict";
  if(navigator.webdriver===true || navigator.doNotTrack==="1" || navigator.globalPrivacyControl===true)return;
  if(!window.crypto || typeof window.crypto.randomUUID!=="function")return;
  const visitorKey="l1017n_anonymous_visitor_v1";
  const sessionKey="l1017n_anonymous_session_v1";
  const acceptedKey="l1017n_anonymous_session_sent_v1";
  const valid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id||""));
  function token(store,key){
    let id=store.getItem(key);
    if(!valid(id)){
      id=window.crypto.randomUUID();
      store.setItem(key,id);
    }
    return id;
  }
  function record(){
    if(document.visibilityState==="hidden"){
      document.addEventListener("visibilitychange",function whenVisible(){
        if(document.visibilityState==="visible"){
          document.removeEventListener("visibilitychange",whenVisible);
          record();
        }
      });
      return;
    }
    try{
      const visitor=token(window.localStorage,visitorKey);
      const session=token(window.sessionStorage,sessionKey);
      if(window.sessionStorage.getItem(acceptedKey)===session)return;
      const db=typeof supabaseClient!=="undefined"?supabaseClient:null;
      if(!db || typeof db.rpc!=="function")return;
      // Server-side unique-session constraint handles refreshes and retries.
      db.rpc("record_store_visit",{p_visitor:visitor,p_session:session})
        .then(({error})=>{
          if(!error)window.sessionStorage.setItem(acceptedKey,session);
          else console.warn("[traffic] Could not record visit");
        }).catch(()=>{});
    }catch(e){
      // Private browsing / storage restrictions must not block store checkout.
      console.warn("[traffic] Visit counting unavailable in this browser");
    }
  }
  record();
})();