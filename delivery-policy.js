/* L1017n — single source for truthful customer delivery estimates.
   Add minute figures here ONLY after the shop owner confirms workable SLAs.
   null means no delivery-time promise has been authorized.
   No payment, inventory or fulfillment logic is touched by this file. */
(function(){
  'use strict';
  const minutesByGame=Object.freeze({
    roblox:null,
    mm2:null,
    'steal-a-brainrot':null,
    pubg:null
  });
  function formatTime(minutes){
    const m=Number(minutes);
    if(!Number.isSafeInteger(m)||m<1)return '';
    if(m<60)return m+' دقيقة';
    if(m%60===0)return (m/60)+' ساعة';
    return Math.floor(m/60)+' ساعة و'+(m%60)+' دقيقة';
  }
  function label(game){
    const key=Object.hasOwn(minutesByGame,String(game))?String(game):'roblox';
    const minutes=minutesByGame[key];
    if(!Number.isSafeInteger(minutes)||minutes<1){
      return 'وقت التسليم: لم تُحدَّد مدة ثابتة حاليًا. التنفيذ يدوي بعد مراجعة الطلب، وليس فوريًا.';
    }
    return 'وقت التسليم المتوقع: يتم التسليم خلال '+formatTime(minutes)+' من تأكيد الدفع، بعد التحقق من الطلب.';
  }
  window.L1017nDeliveryPolicy=Object.freeze({label});
})();