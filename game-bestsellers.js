/* Curated storefront priority based on prominent game categories, not third-party sales figures. */
(function(){
'use strict';
const featured=[
 /^(?:ببجي موبايل|شدات ببجي)$/i,
 /فري\s*فاير|free\s*fire/i,
 /روبلوكس|roblox/i,
 /فورت\s*نايت|fortnite/i,
 /eafc|ea\s*fc|fc\s*mobile/i,
 /call\s*of\s*duty|كول\s*اوف\s*ديوتي/i,
 /موبايل\s*ليجند|mobile\s*legends/i,
 /جينشين|genshin/i,
 /فالورانت|valorant/i,
 /ماين\s*كرافت|minecraft/i,
 /بلود\s*سترايك|blood\s*strike/i
];
function priority(card){
 const key=card.querySelector('[data-ll-game]')?.dataset.llGame;
 if(key==='pubg')return 0;if(key==='roblox')return 2;
 const name=card.querySelector('.ll-game-section-details strong')?.textContent||'';
 const rank=featured.findIndex(pattern=>pattern.test(name));return rank<0?Infinity:rank;
}
function sortGames(root=document.getElementById('llCatalog')){
 if(!root)return;
 const cards=[...root.children];
 const sorted=cards.map((card,index)=>({card,index,rank:priority(card)})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.card);
 if(sorted.some((card,index)=>card!==cards[index]))root.append(...sorted);
}
// Preserve the existing renderer hook; this priority does not claim market sales statistics.
window.L1017nSortGamesBySales=sortGames;
window.addEventListener('l1017n:catalog-updated',()=>sortGames());
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>sortGames(),{once:true});else sortGames();
})();