/* Sort game categories by fulfilled store orders. Zero-sales games keep their existing order. */
(function(){
'use strict';
let keys=[],retry=0,busy=false;
function sortGames(root=document.getElementById('llCatalog')){
 if(!root)return;
 const rank=new Map(keys.map((key,index)=>[key,index]));
 const cards=[...root.children];
 const key=card=>card.querySelector('[data-supplier-category]')?.dataset.supplierCategory||card.querySelector('[data-ll-game]')?.dataset.llGame||'';
 const sorted=cards.map((card,index)=>({card,index,rank:rank.get(key(card))??Infinity})).sort((a,b)=>a.rank-b.rank||a.index-b.index).map(x=>x.card);
 if(sorted.some((card,index)=>card!==cards[index]))root.append(...sorted);
}
async function refresh(){
 if(typeof supabaseClient==='undefined'){if(retry++<20)setTimeout(refresh,750);return;}
 if(busy)return;busy=true;
 try{
  const {data,error}=await supabaseClient.rpc('get_public_game_sales_order');
  if(error||!Array.isArray(data?.keys))return;
  keys=data.keys.filter(key=>typeof key==='string'&&(/^[a-f0-9]{32}$/.test(key)||['roblox','pubg'].includes(key)));
  sortGames();
 }catch{/* Keep the last verified order when the connection is unavailable. */}finally{busy=false;}
}
window.L1017nSortGamesBySales=sortGames;
window.addEventListener('l1017n:catalog-updated',()=>sortGames());
const boot=()=>{void refresh();setInterval(()=>{if(!document.hidden)void refresh();},60000);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();