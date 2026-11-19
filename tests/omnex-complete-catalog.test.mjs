import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {normalizeCatalog} from '../supabase/functions/l1017n-omnex/catalog.mjs';
import {createHandler} from '../supabase/functions/l1017n-api/handler.mjs';
const id='a'.repeat(32),pid='b'.repeat(32),gid='c'.repeat(32);
const fixture=()=>({wallet:'libyana',categories:[{id,name:'بطاقات ايتونز',section:'cards',image_url:'https://omnex.ly/cover.webp'}],groups:[{id:gid,name:'أمريكا',category:id}],products:[{id:pid,category:id,group:gid,name:'10 USD',price:'100.000',purchase_available:true,stock:2}]});
test('discovers all categories by supplier IDs and preserves iTunes region and images',()=>{const p=normalizeCatalog(fixture())[0];assert.equal(p.game,'supplier');assert.equal(p.category,id);assert.equal(p.category_name,'بطاقات ايتونز');assert.equal(p.group_name,'أمريكا');assert.equal(p.available,true);assert.equal(p.category_image,'https://omnex.ly/cover.webp');});
test('missing wallet prices, empty/malformed catalogs and duplicate IDs fail closed',()=>{let cat=fixture();cat.wallet='usd';assert.throws(()=>normalizeCatalog(cat));cat=fixture();cat.products[0].price=null;assert.throws(()=>normalizeCatalog(cat));cat=fixture();cat.products.push(cat.products[0]);assert.throws(()=>normalizeCatalog(cat));cat=fixture();cat.categories=[];assert.throws(()=>normalizeCatalog(cat));});
test('out of stock is not advertised as available; supplier availability stays authoritative',()=>{const cat=fixture();cat.products[0].stock=0;assert.equal(normalizeCatalog(cat)[0].available,false);cat.products[0].stock=null;cat.products[0].purchase_available=false;assert.equal(normalizeCatalog(cat)[0].available,false);});
test('home adds iTunes under gift cards, escapes supplier text, and hides unavailable categories',async()=>{
 const events=[];const source=readFileSync(new URL('../omnex-complete-store.js',import.meta.url),'utf8');
 const p={id:pid,category_id:id,category_name:'بطاقات ايتونز',game:'supplier',section:'cards',group:'أمريكا',name:'<img onerror=bad>',price:105,available:true};
 const context={window:{dispatchEvent:e=>events.push(e)},document:{readyState:'loading',addEventListener(){}},Event:class{constructor(type){this.type=type;}},URL,setInterval(){},supabaseClient:{rpc:async()=>({data:{enabled:true,products:[p,{...p,id:'d'.repeat(32),category_id:'e'.repeat(32),category_name:'Unavailable',available:false}]},error:null})}};
 vm.createContext(context);vm.runInContext(source,context);await context.window.L1017nCompleteCatalog.refresh();
 const cards=context.window.L1017nCompleteCatalog.homeCards('cards');
 assert.ok(cards.includes('بطاقات ايتونز'));assert.ok(cards.includes('1 باقة متوفرة'));assert.ok(!cards.includes('Unavailable'));assert.equal(context.window.L1017nCompleteCatalog.categories().length,1);assert.equal(context.window.L1017nCompleteCatalog.homeCards('games'),'');
});
test('reseller API supports new category IDs and blocks supplier category mismatch',async()=>{
 let mismatch=false,quotes=0;
 const handler=createHandler({database:()=>({}),hash:async()=> 'digest',rpc:async(_,name,args)=>{
 if(args?.p_action==='authorize')return {user_id:'OWNER'};
 if(name==='omnex_product_for_service')return {game:'supplier',supplier_category_id:id};
 if(args?.p_action==='quote_digital'){quotes++;return {id:pid,price:105};}
 },supplier:async()=>({status:200,body:{price_status:'fresh',wallet:'libyana',stock:2,fields:[],product:{id:pid,category:mismatch?gid:id,price:100,purchase_available:true}}}),fieldsSchema:x=>x});
 const req=()=>handler(new Request('https://test.local/',{method:'POST',headers:{authorization:'Bearer l1017n_live_'+'a'.repeat(64),'content-type':'application/json'},body:JSON.stringify({action:'quote',product_id:'digital_'+pid})}));
 let r=await req();assert.equal(r.status,200);assert.equal((await r.json()).price,105);mismatch=true;r=await req();assert.equal(r.status,400);assert.equal(quotes,1);
});
