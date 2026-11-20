import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../pubg-premium.js',import.meta.url),'utf8');
async function scenario(result){
 let legacyReads=0;
 const sandbox={window:{},document:{},setInterval(){},console:{warn(){}},supabaseClient:{rpc:async()=>result,from(){legacyReads++;throw Error('legacy fallback');}}};
 vm.createContext(sandbox);
 vm.runInContext(source.replace(/\}\)\(\);\s*$/,()=> 'window.__catalogTest={fetchPubgProducts,paintOffers,state:()=>({products:pubgCatalog,error:catalogError,ready:catalogReady,live:omnexLive})};})();'),sandbox);
 await sandbox.window.__catalogTest.fetchPubgProducts({isConnected:false});
 return {...sandbox.window.__catalogTest, state:sandbox.window.__catalogTest.state(),legacyReads};
}
let x=await scenario({data:{enabled:true,products:[]},error:null});
assert.equal(x.state.live,true);assert.equal(x.state.products.length,0);assert.equal(x.state.error,'');assert.equal(x.legacyReads,0);
x=await scenario({data:null,error:{message:'network'}});
assert.ok(x.state.error);assert.equal(x.state.products.length,0);assert.equal(x.legacyReads,0);
x=await scenario({data:{enabled:true,products:[{id:'a'.repeat(32),name:'10 UC',group:'اكواد ببجي 2',price:2.39,available:true},{id:'b'.repeat(32),name:'Prime',group:'عروض ببجي',price:12,available:false}]},error:null});
assert.equal(x.state.products.length,2);assert.equal(x.state.products[0].amount,10);assert.equal(x.state.products[0].available,true);assert.equal(x.state.products[1].available,false);
const panel={innerHTML:'',querySelector(){return null;},querySelectorAll(){return [];}};
x.paintOffers(panel,'offers');
assert.match(panel.innerHTML,/غير متوفر \(1\)/);
assert.match(panel.innerHTML,/class="pubg-buy" disabled/);
assert.doesNotMatch(panel.innerHTML,/data-pubg-buy=/);
x.paintOffers(panel,'codes');
assert.match(panel.innerHTML,/data-pubg-stock="available"[^>]*>متوفر \(1\)/);
assert.match(panel.innerHTML,/data-pubg-buy=/);
assert.ok(!source.includes('SUPPLIER_REFERENCE'));
console.log('PASS: live catalog, empty catalog, error without old products, accurate availability');
