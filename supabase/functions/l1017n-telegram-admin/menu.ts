export const MENU_TEXT='👋 أهلاً عبدو في إدارة L1017n\nاختار من الأزرار تحت 👇\n\nالمحافظ: عرض حسابات الزبائن وأرصدة ليبيانا والمدار والرئيسية.\nالمنتجات: إضافة باقات وأكواد وتعديل الأسعار خطوة بخطوة.\nالطلبات والتحويلات: متابعة الشحن والتنفيذ.';
export const BUTTONS:Record<string,string>={
 '🔎 فحص التحويل والمحفظة':'/check','🏠 القائمة الرئيسية':'/start','💳 أرصدة المحافظ':'/wallets','📋 الطلبات':'/orders',
 '📨 تحويلات ليبيانا':'/sms','⏳ الشحن المعلّق':'/topups','🤖 حالة الشحن الآلي':'/smsauto status',
 '▶️ تشغيل الشحن':'/smsauto on','⏸ إيقاف الشحن':'/smsauto off','📦 المنتجات':'/list',
 '🔐 إضافة كود':'نبي نضيف كود','➕ إضافة باقة':'ضيف باقة جديدة','💵 تعديل السعر':'غير سعر باقة',
 '📊 المخزون':'كم كود في المخزون','👁 إظهار باقة':'فعّل باقة','🙈 إخفاء باقة':'اخفي باقة',
 '✅ نعم، تأكيد':'نعم','❌ إلغاء':'إلغاء'
};
export const MAIN_KEYBOARD={keyboard:[
 ['🔎 فحص التحويل والمحفظة'],
 ['💳 أرصدة المحافظ','📋 الطلبات'],['📨 تحويلات ليبيانا','⏳ الشحن المعلّق'],
 ['📦 المنتجات','📊 المخزون'],['🔐 إضافة كود','➕ إضافة باقة'],
 ['💵 تعديل السعر','👁 إظهار باقة','🙈 إخفاء باقة'],
 ['🤖 حالة الشحن الآلي'],['▶️ تشغيل الشحن','⏸ إيقاف الشحن'],['🏠 القائمة الرئيسية']
].map(row=>row.map(text=>({text}))),resize_keyboard:true,is_persistent:true};
export async function dialogKeyboard(db:any,chatId:number){
 const {data,error}=await db.from('telegram_admin_dialog').select('state,updated_at').eq('chat_id',chatId).maybeSingle();
 if(error||!data||Date.now()-Date.parse(data.updated_at)>20*60*1000)return MAIN_KEYBOARD;
 const s=data.state;let rows:string[][]=[];
 if(s?.step==='confirm')rows=[['✅ نعم، تأكيد']];
 else if(s?.step==='product'&&s.options?.length){
   const {data:ps}=await db.from('products').select('id,product_key').in('id',s.options);
   rows=s.options.map((id:string)=>ps?.find((p:any)=>p.id===id)?.product_key).filter(Boolean).map((key:string)=>[key]);
 }else if(s?.step==='game')rows=[['ببجي','فري فاير'],['فورتنايت','MM2']];
 rows.push(['❌ إلغاء','🏠 القائمة الرئيسية']);
 return {keyboard:rows.map(row=>row.map(text=>({text}))),resize_keyboard:true,is_persistent:true};
}
export async function walletMenu(db:any,token:string,chatId:number,action='page:0'){
 const send=async(text:string,rows:any[]=[])=>{
   const r=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,reply_markup:{inline_keyboard:rows}}),signal:AbortSignal.timeout(7000)});
   if(!r.ok)throw new Error('telegram_menu_failed');
 };
 const money=(v:unknown)=>Number(v??0).toFixed(3)+' د.ل';
 const clean=(v:unknown)=>String(v??'—').replace(/[\r\n\t]/g,' ').slice(0,100);
 const user=/^user:([0-9a-f-]{36})$/.exec(action);
 if(user){
   const {data:w,error}=await db.from('wallet_accounts').select('user_id,balance,madar_balance,primary_balance,libyana_phone').eq('user_id',user[1]).maybeSingle();
   if(error)throw error;
   if(!w){await send('الحساب غير موجود');return;}
   const {data:a,error:ae}=await db.auth.admin.getUserById(w.user_id);if(ae)throw ae;
   const u=a?.user;
   const {data:rs,error:re}=await db.from('topup_requests').select('id').eq('user_id',w.user_id).eq('status','approved').order('created_at',{ascending:false}).limit(5);if(re)throw re;
   const rows:any[]=[];
   if(rs?.length){
     const {data:receipts,error:se}=await db.from('sms_topup_receipts').select('review_number,amount,note').in('request_id',rs.map((r:any)=>r.id)).eq('status','approved').order('received_at',{ascending:false});if(se)throw se;
     for(const r of receipts??[])if(r.note!=='REVERSED_BY_TELEGRAM_ADMIN')rows.push([{text:'سحب شحن #'+r.review_number+' • '+money(r.amount),callback_data:'sw:undo:'+r.review_number}]);
   }
   rows.push([{text:'⬅️ قائمة المحافظ',callback_data:'wm:page:0'}]);
   await send('👤 '+clean(u?.user_metadata?.full_name||u?.user_metadata?.name||'زبون')+'\n📧 '+clean(u?.email)+'\n📱 '+clean(w.libyana_phone)+'\n\n💜 ليبيانا: '+money(w.balance)+'\n🟠 المدار: '+money(w.madar_balance)+'\n💳 الرئيسية: '+money(w.primary_balance)+'\n\n🆔 '+w.user_id+'\nأزرار السحب تخص آخر عمليات شحن SMS المعتمدة فقط.',rows);return;
 }
 const pageMatch=/^page:(\d{1,6})$/.exec(action);if(!pageMatch)return;
 const page=Number(pageMatch[1]),size=8;
 const {data:ws,error,count}=await db.from('wallet_accounts').select('user_id,balance,madar_balance,primary_balance',{count:'exact'}).order('created_at',{ascending:false}).order('user_id').range(page*size,page*size+size-1);
 if(error)throw error;
 const rows:any[]=[];const lines=['💳 أرصدة المحافظ','عدد الحسابات: '+(count??0),'صفحة '+(page+1),''];
 for(const w of ws??[]){
   const {data:a,error:ae}=await db.auth.admin.getUserById(w.user_id);if(ae)throw ae;
   const name=clean(a?.user?.user_metadata?.full_name||a?.user?.user_metadata?.name||a?.user?.email||'زبون');
   lines.push('👤 '+name,'ليبيانا '+money(w.balance)+' | المدار '+money(w.madar_balance)+' | الرئيسية '+money(w.primary_balance),'');
   rows.push([{text:'👤 '+name.slice(0,45),callback_data:'wm:user:'+w.user_id}]);
 }
 if(!ws?.length)lines.push('لا توجد محافظ في هذه الصفحة.');
 const nav=[];if(page>0)nav.push({text:'⬅️ السابق',callback_data:'wm:page:'+(page-1)});
 if((count??0)>(page+1)*size)nav.push({text:'التالي ➡️',callback_data:'wm:page:'+(page+1)});
 if(nav.length)rows.push(nav);
 rows.push([{text:'🔄 تحديث',callback_data:'wm:page:'+page}]);
 await send(lines.join('\n'),rows);
}
export async function activityMenu(db:any,token:string,chatId:number,kind:string){
 const send=async(text:string,rows:any[])=>{
   const r=await fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,reply_markup:rows.length?{inline_keyboard:rows}:MAIN_KEYBOARD}),signal:AbortSignal.timeout(7000)});
   if(!r.ok)throw new Error('telegram_activity_failed');
 };
 if(kind==='sms'){
   const {data:rs,error}=await db.from('sms_topup_receipts').select('review_number,status,amount,transfer_phone,request_id,note').order('received_at',{ascending:false}).limit(8);if(error)throw error;
   if(!rs?.length){await send('لا توجد تحويلات مسجلة.',[]);return;}
   for(const r of rs){
     const rows:any[]=[];
     if(r.request_id)rows.push([{text:'🔎 فحص التحويل والمحفظة',callback_data:'ta:'+r.request_id}]);
     if(r.request_id)rows.push([{text:'👤 عرض الحساب',callback_data:'sw:account:'+r.review_number}]);
     if(r.status==='approved'&&r.note!=='REVERSED_BY_TELEGRAM_ADMIN')rows.push([{text:'↩️ سحب مبلغ الشحن',callback_data:'sw:undo:'+r.review_number}]);
     if(r.status==='matched')rows.push([{text:'✅ قبول بعد التحقق',callback_data:'sr:a:'+r.review_number},{text:'❌ رفض',callback_data:'sr:r:'+r.review_number}]);
     if(r.status==='unmatched')rows.push([{text:'❌ رفض الرسالة',callback_data:'sr:r:'+r.review_number}]);
     const status=r.note==='REVERSED_BY_TELEGRAM_ADMIN'?'↩️ سُحب من المحفظة':r.status==='approved'?'✅ تم الشحن':r.status==='matched'?'⏳ مطابق وبانتظار الاعتماد':r.status==='rejected'?'❌ مرفوض':'⚠️ غير مطابق';
     await send('📨 تحويل #'+r.review_number+'\n💰 '+r.amount+' د.ل\n📱 0'+r.transfer_phone+'\n'+status,rows);
   }
 }else{
   const {data:os,error}=await db.from('purchase_orders').select('id,product_name,total_amount,roblox_username,status').neq('roblox_username','DIGITAL_CODE').order('created_at',{ascending:false}).limit(8);if(error)throw error;
   if(!os?.length){await send('لا توجد طلبات يدوية.',[]);return;}
   for(const o of os)await send('📦 '+o.product_name+'\n💰 '+o.total_amount+' د.ل\n🎮 '+o.roblox_username,[[{text:'إدارة الطلب وحالته',callback_data:'po:check:'+o.id}]]);
 }
}

