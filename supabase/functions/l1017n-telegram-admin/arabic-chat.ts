// @ts-nocheck
// Arabic conversational UI for the existing authenticated Telegram admin bot.
// No AI key or third-party chat service is needed. Mutations are confirmed before execution.
const digits = (s) => String(s || "").replace(/[٠-٩۰-۹]/g, c => {
  const n = c.charCodeAt(0);
  return String(n >= 0x6f0 ? n - 0x6f0 : n - 0x660);
}).replace(/٫/g, ".").replace(/٬/g, "");
const norm = (s) => digits(s).toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,"")
  .replace(/[أإآ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/\s+/g," ").trim();
const contains = (s, pattern) => pattern.test(norm(s));
const accepted = (s) => /^(نعم|اي|ايوه|ايوا|تمام|موافق|اكد|تاكيد|نفذ|اوكي|ok|yes)$/.test(norm(s));
const canceled = (s) => /^(لا|الغاء|الغي|كنسل|وقف|خلاص|انسي|انس|cancel|لا شكرا)$/.test(norm(s));
const addWords = /(اضف|ضيف|ضف|حط|دخل|سجل|خزن|ابغ|نبي|اريد|ابي|سوي|اعمل)/;
const codeWords = /(كود|اكواد|رمز|رموز|سيريال|بطاقه)/;
const packageWords = /(باقه|باقة|منتج|فئه|فئة)/;
const aliases = [
  ["pubg",["ببجي","بوبجي","pubg"]],
  ["freefire",["فري فاير","فريفاير","freefire","free fire"]],
  ["fortnite",["فورت نايت","فورتنايت","fortnite"]],
  ["roblox",["روبلوكس","روبوكس","roblox","robux"]],
  ["mm2",["mm2","ماب ام ام","ماب mm2"]],
  ["cod",["كول اوف ديوتي","call of duty","cod"]],
  ["fc",["اف سي","fc mobile"]],
];
function gameFrom(s) {
  const n=norm(s);
  for (const [key,words] of aliases) if (words.some(w => n.includes(norm(w)))) return key;
  const m=n.match(/(?:اللعبه|لعبه|لعبة)\s+([a-z0-9_-]{2,40})/);
  return m ? m[1] : (/^[a-z][a-z0-9_-]{1,49}$/.test(n)?n:null);
}
function productText(p) {return String(p.name)+" ("+p.product_key+")";}
function productHits(text, products) {
  const n=norm(text);
  if (!n) return [];
  const scored=products.map(p=>{
    const key=norm(p.product_key), name=norm(p.name),game=norm(p.game);
    let score=0;
    if (n===key || n===name) score=100;
    else if (key && n.includes(key)) score=80;
    else if (name.length>=3 && n.includes(name)) score=75;
    else if (n===game) score=55;
    else if (aliases.some(([g,words]) => g===game && words.some(w=>n.includes(norm(w))))) score=35;
    else if (game && n.includes(game)) score=30;
    return {p,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score);
  if (!scored.length) return [];
  // A precise product name beats generic game matching.
  return scored.filter(x=>x.score===scored[0].score).map(x=>x.p);
}
function extractCode(s) {
  const m=digits(s).match(/(?:الكود|كود|الرمز|رمز|السيريال|سيريال)\s*(?:هو|:|=)?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,299})/i);
  return m ? m[1] : null;
}
function goodCode(s) { return s && s.length>=3 && s.length<=300 && !/[\r\n|]/.test(s); }
function priceOf(s) {const m=digits(s).match(/(\d+(?:\.\d+)?)/); const x=m?Number(m[1]):NaN;return Number.isFinite(x)&&x>0&&x<=1000000?Math.round(x*100)/100:null;}
function amountOf(s) {const m=digits(s).match(/(\d{1,8})/);const a=m?Number(m[1]):NaN;return Number.isSafeInteger(a)&&a>=1&&a<=100000000?a:null;}
function errIf(e) {if(e) throw new Error(e.code ? "db_"+e.code : "database_failed");}
async function products(db) {
  const {data,error}=await db.from("products").select("id,product_key,name,game,amount,price,active").order("created_at",{ascending:true}).limit(500);
  errIf(error);return data||[];
}
async function stateGet(db,chatId) {
  const {data,error}=await db.from("telegram_admin_dialog").select("state,updated_at").eq("chat_id",chatId).maybeSingle();
  errIf(error);
  if(!data) return null;
  if(Date.now()-Date.parse(data.updated_at)>20*60*1000) {await stateClear(db,chatId);return null;}
  return data.state||null;
}
async function stateSet(db,chatId,s) {
  const {error}=await db.from("telegram_admin_dialog").upsert({chat_id:chatId,state:s,updated_at:new Date().toISOString()},{onConflict:"chat_id"});
  errIf(error);
}
async function stateClear(db,chatId) {
  const {error}=await db.from("telegram_admin_dialog").delete().eq("chat_id",chatId);
  errIf(error);
}
function listing(ps) {
  return ps.length?"📦 الباقات:\n"+ps.slice(0,25).map((p,i)=>(i+1)+") "+productText(p)+" — "+p.price+" د.ل "+(p.active?"✅":"⛔")).join("\n"):
  "ما عندكش باقات بعد. قول: نبي نضيف باقة جديدة.";
}
function picking(s,ps) {
  if(!ps.length) return "ما لقيتش باقات. قول: نبي نضيف باقة جديدة.";
  return "شنو الباقة اللي تقصدها؟ اكتب اسمها أو رقمها:\n"+ps.slice(0,15).map((p,i)=>(i+1)+") "+productText(p)).join("\n");
}
async function getTarget(db,chatId,st,text) {
  const ps=await products(db);
  const ix=Number(digits(text).trim());
  const selected=Number.isInteger(ix)&&ix>=1&&ix<=(st.options||[]).length?
    ps.find(p=>p.id===st.options[ix-1]):null;
  const hits=selected?[selected]:productHits(text,ps);
  if(hits.length===1) return {product:hits[0]};
  const options=hits.length>1?hits:ps.filter(p=>st.intent!=="code" || !/roblox/i.test(p.game));
  if(!options.length) return {reply:"ما لقيتش باقة مناسبة. قول: نبي نضيف باقة جديدة."};
  await stateSet(db,chatId,{...st,step:"product",options:options.slice(0,15).map(p=>p.id)});
  return {reply:picking(st,options)};
}
async function routeProduct(db,chatId,st,p) {
  if(st.intent==="stock"){
    await stateClear(db,chatId);
    const {count,error}=await db.from("telegram_code_stock").select("id",{head:true,count:"exact"}).eq("product_id",p.id).eq("status","available");
    errIf(error);return {reply:"📊 في باقة "+productText(p)+" عندك "+(count||0)+" كود متاح."};
  }
  if(st.intent==="code"){
    if(norm(p.game)==="roblox") {
      await stateClear(db,chatId);
      return {reply:"باقة Roblox عندك تنفيذها يدوي وما تسلمش أكواد تلقائياً. اختار باقة رقمية ثانية أو قول نبي نضيف باقة رقمية."};
    }
    const v=st.code;
    const next={...st,product_id:p.id,product_name:productText(p),step:v?"confirm":"code"};
    await stateSet(db,chatId,next);
    return v ? {reply:"🔐 نضيف الكود (ينتهي بـ "+v.slice(-4)+") إلى "+productText(p)+"؟\nقول «نعم» للتأكيد أو «إلغاء».",deleteMessage:true} :
      {reply:"تمام، اخترت "+productText(p)+". ابعتلي الكود بروحه في الرسالة الجاية. بنحفظه في المخزون المحمي.",deleteMessage:false};
  }
  if(st.intent==="price") {
    const next={...st,product_id:p.id,product_name:productText(p),step:st.price?"confirm":"price"};
    await stateSet(db,chatId,next);
    return st.price? {reply:"نغيّر سعر "+productText(p)+" إلى "+st.price+" د.ل؟ قول «نعم» أو «إلغاء»."}:
      {reply:"سعر "+productText(p)+" الحالي "+p.price+" د.ل. بكم تبي تخليه؟"};
  }
  if(st.intent==="toggle"){
    const next={...st,product_id:p.id,product_name:productText(p),step:"confirm"};
    await stateSet(db,chatId,next);
    return {reply:"تبي "+(st.enabled?"نظهر":"نخفي")+" "+productText(p)+" في الموقع؟ قول «نعم» أو «إلغاء»."};
  }
  return {reply:"ما فهمتش العملية، قول مساعدة."};
}
async function executeConfirmed(db,chatId,st) {
  await stateClear(db,chatId);
  const ps=await products(db),p=ps.find(p=>p.id===st.product_id);
  if(st.intent==="add_package"){
    const slug=st.game+"-"+st.amount;
    let key=slug, i=2;
    while(ps.some(p=>p.product_key===key))key=slug+"-"+i++;
    const {error}=await db.from("products").insert({
      product_key:key,game:st.game,name:st.name,amount:st.amount,price:st.price,
      active:false,sort_order:1000
    });
    if(error?.code==="23505")return {reply:"المعرّف موجود مسبقاً، قول نبي نضيف باقة ونجرب من جديد."};
    errIf(error);
    return {reply:"✅ ضفت الباقة "+st.name+" بسعر "+st.price+" د.ل (مخفية للمراجعة).\nمعرفها: "+key+"\nتقدر تقول: ضيف كود للباقة "+key};
  }
  if(!p)return {reply:"الباقة تغيرت أو انحذفت. ابدأ من جديد."};
  if(st.intent==="code"){
    const code=st.code;
    if(!goodCode(code))return {reply:"الكود غير صالح. حاول من جديد."};
    const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(code));
    const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,"0")).join("");
    const {error}=await db.from("telegram_code_stock").insert({product_id:p.id,code_value:code,code_sha256:hash});
    if(error?.code==="23505")return {reply:"الكود مسجّل مسبقًا لهذه الباقة؛ ما أضفناش نسخة ثانية."};
    errIf(error);
    return {reply:"✅ تم حفظ الكود بأمان في مخزون "+productText(p)+".\nقول «كم كود في "+p.product_key+"» باش تعرف المخزون."};
  }
  if(st.intent==="price"){
    if(!st.price)return {reply:"السعر غير صالح. ابدأ من جديد."};
    const {error}=await db.from("products").update({price:st.price}).eq("id",p.id);
    errIf(error);return {reply:"✅ غيرت سعر "+productText(p)+" إلى "+st.price+" د.ل."};
  }
  if(st.intent==="toggle"){
    const {error}=await db.from("products").update({active:!!st.enabled}).eq("id",p.id);
    errIf(error);return {reply:"✅ "+(st.enabled?"أظهرت":"أخفيت")+" الباقة "+productText(p)+"."};
  }
  return {reply:"ما فهمتش العملية."};
}
function prompt(st) {
  if(st.step==="game")return "شنو اللعبة؟ مثلاً: ببجي، فري فاير، فورتنايت، MM2.";
  if(st.step==="name")return "شنو اسم الباقة اللي يبي يشوفه الزبون؟ مثال: بطاقة 60 شدة.";
  if(st.step==="amount")return "شنو كمية الباقة؟ اكتب رقم مثل 60 (مش عدد الأكواد).";
  if(st.step==="package_price")return "بكم سعر الباقة بالدينار الليبي؟ مثال: 12.5";
  return "قول إلغاء باش تبدأ من جديد.";
}
async function continueChat(db,chatId,st,text) {
  if(st.step==="confirm"){
    if(!accepted(text))return {reply:"ما نفذت شي. قول «نعم» للتأكيد أو «إلغاء»."};
    return await executeConfirmed(db,chatId,st);
  }
  if(st.step==="product") {
    const found=await getTarget(db,chatId,st,text);
    return found.reply?found:routeProduct(db,chatId,st,found.product);
  }
  if(st.intent==="code" && st.step==="code"){
    const code=digits(text).trim();
    if(!goodCode(code))return {reply:"ابعت الكود فقط (من 3 إلى 300 حرف)، بدون وصف. أو قول إلغاء."};
    const next={...st,code,step:"confirm"};
    await stateSet(db,chatId,next);
    return {reply:"🔐 نضيف الكود اللي ينتهي بـ "+code.slice(-4)+" إلى "+st.product_name+"؟\nقول «نعم» أو «إلغاء».",deleteMessage:true};
  }
  if(st.intent==="price" && st.step==="price"){
    const price=priceOf(text);
    if(price===null)return {reply:"ما فهمتش السعر. اكتب الرقم مثل: 15 أو 12.5."};
    await stateSet(db,chatId,{...st,price,step:"confirm"});
    return {reply:"نغير سعر "+st.product_name+" إلى "+price+" د.ل؟ قول «نعم» أو «إلغاء»."};
  }
  if(st.intent==="add_package"){
    const next={...st};
    if(st.step==="game"){
      const game=gameFrom(text);
      if(!game||!/^[a-z0-9_-]{2,50}$/.test(game))return {reply:"ما عرفت اللعبة. قول «ببجي» أو «فري فاير» أو اسم إنجليزي مثل pubg."};
      next.game=game;next.step="name";
    }else if(st.step==="name"){
      const name=text.trim();
      if(name.length<2||name.length>160)return {reply:"اسم الباقة لازم بين حرفين و160 حرف. ابعت الاسم فقط."};
      next.name=name;next.step="amount";
    }else if(st.step==="amount"){
      const amount=amountOf(text);
      if(amount===null)return {reply:"ابعت كمية صحيحة، مثل 60."};
      next.amount=amount;next.step="package_price";
    }else if(st.step==="package_price"){
      const price=priceOf(text);
      if(price===null)return {reply:"ابعت السعر بالدينار مثل 12.5."};
      next.price=price;next.step="confirm";
    }
    await stateSet(db,chatId,next);
    if(next.step==="confirm")return {reply:"✅ نجهز باقة:\nاللعبة: "+next.game+"\nالاسم: "+next.name+"\nالكمية: "+next.amount+"\nالسعر: "+next.price+" د.ل\nبتكون مخفية حتى تراجعها. نعتمدها؟ قول «نعم» أو «إلغاء»."};
    return {reply:prompt(next)};
  }
  await stateClear(db,chatId);
  return {reply:"قول شنو تبي تدير، مثلاً: نبي نضيف كود."};
}
export async function handleArabicAdmin(db,chatId,text) {
  const n=norm(text);
  if(canceled(text)){
    await stateClear(db,chatId);
    return {reply:"تمام، ألغيت العملية وما غيرت شي."};
  }
  if(/^(ساعدني|مساعده|الاوامر|شن تقدر|وش تقدر|كيف نستعملك|سلام|السلام عليكم|مرحبا|هلا)$/.test(n)){
    return {reply:"أهلاً! تقدر تكلمني بالعربي عادي 👋\n\n"+
      "• «نبي نضيف كود» — نسألك الباقة وبعدها الكود.\n"+
      "• «كم كود عندي في ببجي؟» — نعطيك المخزون.\n"+
      "• «وريني الباقات» — نعرض المنتجات.\n"+
      "• «ضيف باقة جديدة» — نسألك اللعبة والاسم والكمية والسعر.\n"+
      "• «غير سعر باقة ببجي» — نعدّل السعر بعد تأكيدك.\n"+
      "• «اخفي باقة ...» أو «فعّل باقة ...».\n"+
      "قول «إلغاء» في أي وقت. الأوامر القديمة ما زالت تخدم."};
  }
  const st=await stateGet(db,chatId);
  // A new explicit request replaces an unfinished flow. "نعم" only confirms an existing flow.
  const addCode=codeWords.test(n)&&(addWords.test(n)||(/هذا|عندي/.test(n)&&!!extractCode(text))) && !/كم|مخزون|عدد|متبقي|فاضل/.test(n);
  const addPackage=packageWords.test(n)&&addWords.test(n)&&!/(ضيف|اضف|حط).*(?:كود|اكواد|رمز)/.test(n);
  const stock=/(كم|عدد|مخزون|متبقي|فاضل|متوفر|عندي)/.test(n)&&/(كود|اكواد|مخزون|رمز)/.test(n)&&!addCode;
  const price=/سعر/.test(n)&&/(غير|تغيير|عدل|تعديل|خلي|نقص|زيد|ارفع|نزل)/.test(n);
  const toggleOn=/(فعل|تفعيل|اظهر|افتح|شغل|خليها ظاهره)/.test(n)&&packageWords.test(n);
  const toggleOff=/(اخفي|خفي|اخفاء|وقف|اطفي|اقفل)/.test(n)&&packageWords.test(n);
  const showList=/(وريني|اعرض|عرض|قائمه|قائمة|شن عندي)/.test(n)&&/(الباقات|المنتجات|الباقه|الالعاب|العاب)/.test(n);
  const intent=addCode?"code":addPackage?"add_package":stock?"stock":price?"price":toggleOn?"on":toggleOff?"off":showList?"list":null;
  if(st && !intent)return await continueChat(db,chatId,st,text);
  if(intent==="list") {
    await stateClear(db,chatId);
    return {reply:listing(await products(db))};
  }
  if(intent==="add_package"){
    const detected=gameFrom(text);
    const next={intent:"add_package",step:detected?"name":"game"};
    if(detected)next.game=detected;
    await stateSet(db,chatId,next);
    return {reply:"تمام 👍 بنضيف باقة جديدة. "+(detected?"اللعبة "+detected+". ":"")+prompt(next)};
  }
  if(intent==="code"||intent==="stock"||intent==="price"||intent==="on"||intent==="off"){
    const next={intent:intent==="on"||intent==="off"?"toggle":intent,step:"product"};
    if(intent==="on"||intent==="off") next.enabled=intent==="on";
    if(intent==="code")next.code=extractCode(text);
    if(intent==="price"){
      const matched=digits(text).match(/(?:الى|إلى|لسعر|بسعر|سعرها|ب)\s*(\d+(?:\.\d+)?)/i);
      if(matched)next.price=priceOf(matched[1]);
    }
    const found=await getTarget(db,chatId,next,text);
    return found.reply?found:await routeProduct(db,chatId,next,found.product);
  }
  if(st)return await continueChat(db,chatId,st,text);
  return {reply:"فهمني شنو تبي ندير 😊 مثلاً: «نبي نضيف كود»، «كم كود في ببجي؟»، أو «وريني الباقات». قول «مساعدة» للأمثلة."};
}
