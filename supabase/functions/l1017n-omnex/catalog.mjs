// Normalize the supplier's complete published catalog; no credentials or purchases here.
const ID=/^[a-f0-9]{32}$/;
export const ROBLOX='cd40561b622c4fa9ed9984c31f0c697f';
export const PUBG='30faee6b9893e3f424961c15a785efc3';
const values=x=>Array.isArray(x)?x:x&&typeof x==='object'?Object.values(x):[];
function image(value){
 const s=String(value||'').trim();
 if(!s)return '';
 try{const u=new URL(s,'https://omnex.ly/');if(u.protocol!=='https:'||u.hostname!=='omnex.ly')return '';return u.href.slice(0,500)}catch{return ''}
}
export function normalizeCatalog(cat){
 if(cat?.wallet!=='libyana'||!Array.isArray(cat.products)||!cat.products.length||cat.products.length>50000)throw Error('supplier_catalog_invalid');
 const categories=new Map(values(cat.categories).filter(c=>ID.test(String(c?.id||''))&&String(c.name||'').trim()).map(c=>[c.id,c]));
 const groups=new Map(values(cat.groups).filter(g=>ID.test(String(g?.id||''))).map(g=>[g.id,g]));
 if(!categories.size)throw Error('supplier_categories_missing');
 const seen=new Set(),items=[];
 for(const p of cat.products){
  const c=categories.get(p?.category),g=groups.get(p?.group);
  if(!c||!ID.test(String(p.id||''))||!String(p.name||'').trim())throw Error('supplier_product_invalid');
  if(seen.has(p.id))throw Error('supplier_duplicate_product');seen.add(p.id);
  // A price missing for the selected wallet must never use another wallet's price.
  const price=String(p.price??'');
  if(!/^[0-9]{1,8}([.][0-9]{1,3})?$/.test(price)||!(Number(price)>0)||Number(price)>100000)continue;
  const name=String(c.name);
  const game=p.category===ROBLOX?'roblox':p.category===PUBG?'pubg':/(?:play\s*station|psn|بلاي\s*ستيشن|بليستيشن|بلايستيشن)/i.test(name)?'psn':'supplier';
  items.push({id:p.id,category:p.category,category_name:name.slice(0,180),section:String(c.section||'other').slice(0,40),
   category_image:image(c.image_url||c.image),name:String(p.name).slice(0,180),group_name:String(g?.name||p.group_name||'').slice(0,100),
   game,price,stock:Number.isInteger(p.stock)&&p.stock>=0?p.stock:null,
   available:p.purchase_available===true&&p.stock!==0&&p.stock!=='0',image_url:image(p.image_url)});
 }
 if(!items.length)throw Error('supplier_catalog_empty');
 return items;
}
