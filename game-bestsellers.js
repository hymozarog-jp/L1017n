/* L1017n — curated popular worldwide game top-ups and gift cards, Nov 2026.
 * Editorial priority derived from published market trends, NOT exact global sales ranks.
 * Only supplier-confirmed available categories enter the homepage.
 * No pricing/stock/order database mutations. */
(function(){
'use strict';
const gamePatterns=[
 /روبلوكس|روبوكس|roblox|robux/i,
 /فري\s*فاير|free\s*fire/i,
 /ببجي|pubg/i,
 /شرف\s*الملوك|honor\s*of\s*kings/i,
 /موبايل\s*ليجند|mobile\s*legends/i,
 /فورت\s*نايت|fortnite/i,
 /call\s*of\s*duty|كول\s*اوف\s*ديوتي/i,
 /eafc\s*mobile|ea\s*fc|fc\s*mobile|فيفا/i,
 /فالورانت|valorant/i,
 /جينشين|genshin/i
];
const giftPatterns=[
 /بلايستيشن|بلاستيشن|playstation|psn/i,
 /ستيم|steam/i,
 /ايتونز|itunes|apple|app\s*store/i,
 /اكس\s*بوكس|xbox/i,
 /امازون|amazon/i,
 /رايزر\s*جولد|razer\s*gold/i,
 /نينتندو|نيتندو|nintendo/i,
 /نتفلكس|netflix/i,
 /riot\s*games|ريوت\s*جيمز/i,
 /eneba|اينبا/i
];
function normalize(text){
 return String(text||'').toLowerCase().normalize('NFKC')
   .replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه');
}
function rankFor(section,name){
 const patterns=section==='cards'?giftPatterns:section==='games'?gamePatterns:[];
 const target=normalize(name);
 return patterns.findIndex(pattern=>pattern.test(target));
}
function sortSection(root,section){
 if(!root)return;
 const nodes=[...root.children];
 const entries=nodes.map((node,index)=>{
   const name=node.querySelector('.ll-game-section-details strong')?.textContent||'';
   const key=node.querySelector('[data-ll-game]')?.dataset.llGame||'';
   const rank=rankFor(section,name+' '+key);
   return {node,index,rank:rank<0?999:rank};
 });
 entries.sort((a,b)=>a.rank-b.rank||a.index-b.index);
 if(entries.some((x,i)=>x.node!==nodes[i]))root.append(...entries.map(x=>x.node));
}
window.L1017nFeaturedCatalog={
 rankFor,
 // Only show packages supplied by categories whose status is available.
 maxPerSection:10,
 sources:['Sensor Tower mobile games, October 2026','G2A gaming gift cards, H1 2026']
};
window.L1017nSortGamesBySales=root=>sortSection(root||document.getElementById('llCatalog'),'games');
window.L1017nSortGiftCardsByPopularity=root=>sortSection(root||document.getElementById('llGiftCatalog'),'cards');
window.addEventListener('l1017n:catalog-updated',()=>{
 window.L1017nSortGamesBySales();
 window.L1017nSortGiftCardsByPopularity();
});
})();
