/* L1017n • post-purchase game handover: manual in-game delivery only.
 * Does not charge money or change order state. Uses the server-confirmed order id.
 */
(function(){
  "use strict";
  const WHATSAPP_PHONE="218925620538";
  const TELEGRAM_BOT="LibyanStoreNotifyBot";
  const MANUAL_GAMES=new Set(["mm2","steal-a-brainrot"]);
  let activeDialog=null;
  function isManualProduct(game,key){
    const g=String(game||"").trim().toLowerCase();
    const k=String(key||"").trim().toLowerCase();
    return MANUAL_GAMES.has(g)||/^murder[ _-]*mystery[ _-]*2$/.test(g)
      ||/^mm2[-_]/.test(k)||/^steal[-_]/.test(k);
  }
  function kind(game,key,productName){
    const g=String(game||"").toLowerCase();
    const k=String(key||"").toLowerCase();
    const n=String(productName||"").toLowerCase();
    if(g==="steal-a-brainrot"||/^steal[-_]/.test(k)||/steal a brainrot|ماب السرقة/.test(n))return "ماب السرقة";
    return "MM2";
  }
  function safeOrder(order){
    if(!order||typeof order!=="object")return null;
    const id=String(order.id||"").trim();
    const name=String(order.product_name||order.name||"").trim();
    const roblox=String(order.roblox_username||"").trim();
    if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id)||!name)return null;
    return {id,name,roblox,
      amount:Number.isFinite(Number(order.total_amount))?Number(order.total_amount):null,
      group:kind(order.game,order.product_key,name)};
  }
  function textFor(order){
    const o=safeOrder(order);if(!o)return "";
    const lines=["مرحبًا، اشتريت غرضًا من متجر L1017n وأريد استلامه داخل Roblox.",
      "الماب: "+o.group,
      "الغرض: "+o.name,
      "رقم الطلب: "+o.id,
      "حساب Roblox: "+(o.roblox||"غير محدد")];
    if(o.amount!==null)lines.push("المبلغ: "+o.amount.toFixed(2)+" د.ل");
    lines.push("يرجى تنسيق وقت وطريقة التسليم. لا أشارك كلمة المرور أو رمز التحقق.");
    return lines.join("\n");
  }
  function close(){
    if(!activeDialog)return;
    const old=activeDialog;activeDialog=null;
    old.remove();document.body.classList.remove("manual-handover-open");
  }
  function open(order){
    const o=safeOrder(order);
    if(!o){return false}
    close();
    const overlay=document.createElement("div");
    overlay.id="manualOrderHandover";
    overlay.className="manual-handover-overlay";
    overlay.setAttribute("role","dialog");
    overlay.setAttribute("aria-modal","true");
    overlay.setAttribute("aria-labelledby","manualHandoverTitle");
    overlay.dir="rtl";
    const box=document.createElement("div");box.className="manual-handover-sheet";
    const closeBtn=document.createElement("button");
    closeBtn.type="button";closeBtn.className="manual-handover-close";closeBtn.textContent="×";closeBtn.setAttribute("aria-label","إغلاق");
    closeBtn.addEventListener("click",close);
    const icon=document.createElement("div");icon.className="manual-handover-mark";
    icon.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v11H8l-4 3V6Z"/><path d="M8 10h8M8 14h5"/></svg>';
    const tag=document.createElement("span");tag.className="manual-handover-tag";tag.textContent="L1017n • التسليم داخل اللعبة";
    const heading=document.createElement("h2");heading.id="manualHandoverTitle";heading.textContent="تم تسجيل طلبك!";
    const sub=document.createElement("p");sub.className="manual-handover-intro";sub.textContent="لاستلام الغرض، لازم تتواصل مع متجر L1017n عبر واتساب أو تيليجرام وتبعث رقم طلبك. الخصم تم عند تأكيد الشراء، والتسليم يحتاج تنسيق داخل Roblox.";
    const info=document.createElement("div");info.className="manual-handover-info";
    for(const [label,value] of [
      ["الماب",o.group],["الغرض",o.name],["رقم الطلب","#"+o.id.slice(0,8).toUpperCase()],
      ["حساب Roblox",o.roblox||"غير محدد"]
    ]){
      const row=document.createElement("div");row.className="manual-handover-info-row";
      const l=document.createElement("small");l.textContent=label;
      const v=document.createElement("strong");v.textContent=value;
      row.append(l,v);info.append(row);
    }
    const caption=document.createElement("p");caption.className="manual-handover-caption";caption.textContent="اختر وسيلة التواصل لإرسال تفاصيل الطلب:";
    const buttons=document.createElement("div");buttons.className="manual-handover-actions";
    const wa=document.createElement("a");wa.className="manual-handover-btn manual-handover-wa";
    wa.href="https://wa.me/"+WHATSAPP_PHONE+"?text="+encodeURIComponent(textFor(o));
    wa.target="_blank";wa.rel="noopener noreferrer";wa.textContent="التواصل عبر واتساب";
    wa.setAttribute("aria-label","فتح محادثة واتساب للمتجر مع تفاصيل الطلب");
    const tg=document.createElement("a");tg.className="manual-handover-btn manual-handover-tg";
    tg.href="https://t.me/"+TELEGRAM_BOT;tg.target="_blank";tg.rel="noopener noreferrer";
    tg.textContent="التواصل عبر تيليجرام";
    tg.setAttribute("aria-label","نسخ تفاصيل الطلب وفتح بوت متجر L1017n في تيليجرام");
    const draft=textFor(o);
    function copyDetails(){
      try{
        if(navigator.clipboard&&navigator.clipboard.writeText){
          navigator.clipboard.writeText(draft).then(()=>{copy.textContent="تم نسخ التفاصيل ✓"}).catch(()=>{copy.textContent="حدّد التفاصيل وانسخها"});
        }else copy.textContent="حدّد التفاصيل وانسخها";
      }catch(_){copy.textContent="حدّد التفاصيل وانسخها";}
    }
    tg.addEventListener("click",copyDetails);
    const hint=document.createElement("p");hint.className="manual-handover-note";
    hint.textContent="تيليجرام يفتح بوت المتجر. انسخ تفاصيل الطلب وأرسلها في المحادثة. ما ترسلش كلمة مرورك أو رموز التحقق.";
    const details=document.createElement("details");details.className="manual-handover-message";
    const summary=document.createElement("summary");summary.textContent="عرض رسالة الطلب الجاهزة";
    const textarea=document.createElement("textarea");
    textarea.value=draft;textarea.readOnly=true;textarea.rows=7;textarea.dir="auto";
    const copy=document.createElement("button");copy.type="button";copy.className="manual-handover-copy";
    copy.textContent="نسخ تفاصيل الطلب";
    copy.addEventListener("click",copyDetails);
    details.append(summary,textarea,copy);
    const later=document.createElement("button");later.type="button";
    later.className="manual-handover-later";later.textContent="لاحقًا — أرجع للطلب من طلباتي";
    later.addEventListener("click",()=>{
      close();if(typeof window.switchView==="function")window.switchView("orders");
    });
    buttons.append(wa,tg);
    box.append(closeBtn,icon,tag,heading,sub,info,caption,buttons,hint,details,later);
    overlay.appendChild(box);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
    const escapeHandler=e=>{if(e.key==="Escape"){close();document.removeEventListener("keydown",escapeHandler)}};
    document.addEventListener("keydown",escapeHandler,{once:true});
    document.body.appendChild(overlay);document.body.classList.add("manual-handover-open");
    activeDialog=overlay;
    closeBtn.focus({preventScroll:true});
    return true;
  }
  window.L1017nManualHandover=Object.freeze({isManualProduct,open,textFor});
})();