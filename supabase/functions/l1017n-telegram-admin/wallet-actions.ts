// Called only after the webhook secret, owner actor and private chat checks.
export async function handleWalletAction(db:any, cb:any, token:string):Promise<boolean> {
 const match=/^sw:(account|undo|confirm|cancel):([1-9][0-9]{0,14})$/.exec(cb.data??'');
 if(!match)return false;
 const number=Number(match[2]);
 if(!Number.isSafeInteger(number))return true;
 const send=async(method:string,body:any)=>{
   const response=await fetch('https://api.telegram.org/bot'+token+'/'+method,{
     method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(7000)
   });
   if(!response.ok)throw new Error('telegram_wallet_action_failed');
 };
 const alert=async(text:string)=>send('answerCallbackQuery',{callback_query_id:cb.id,text,show_alert:true});
 const {data:r,error}=await db.from('sms_topup_receipts').select('review_number,request_id,status,amount,transfer_phone,note').eq('review_number',number).maybeSingle();
 if(error||!r?.request_id){await alert('تعذر العثور على حساب هذا التحويل');return true;}
 const {data:q,error:qe}=await db.from('topup_requests').select('user_id').eq('id',r.request_id).maybeSingle();
 if(qe||!q){await alert('تعذر قراءة حساب الزبون');return true;}
 const {data:auth,error:ae}=await db.auth.admin.getUserById(q.user_id);
 const clean=(v:unknown)=>String(v??'غير متوفر').replace(/[\r\n\t]/g,' ').slice(0,180);
 const name=clean(auth?.user?.user_metadata?.full_name||auth?.user?.user_metadata?.name||'زبون');
 const title='👤 '+name+'\n📱 رقم المحوّل: 0'+r.transfer_phone+'\n🧾 التحويل: #'+number+'\n💰 المبلغ: '+r.amount+' د.ل';
 if(match[1]==='account'){
   const {data:w,error:we}=await db.from('wallet_accounts').select('balance,libyana_phone').eq('user_id',q.user_id).maybeSingle();
   if(ae||we){await alert('تعذر قراءة تفاصيل الحساب، حاول لاحقًا');return true;}
   await send('sendMessage',{chat_id:cb.message.chat.id,text:title+'\n📧 البريد: '+clean(auth?.user?.email)+'\n🆔 الحساب: '+q.user_id+'\n💳 رصيد ليبيانا بالمحفظة: '+(w?.balance??0)+' د.ل'+(r.note==='REVERSED_BY_TELEGRAM_ADMIN'?'\n↩️ تم سحب هذا الشحن سابقًا':''),reply_markup:{inline_keyboard:r.status==='approved'&&r.note!=='REVERSED_BY_TELEGRAM_ADMIN'?[[{text:'↩️ سحب مبلغ الشحن',callback_data:'sw:undo:'+number}]]:[]}});
   await send('answerCallbackQuery',{callback_query_id:cb.id});return true;
 }
 if(match[1]==='cancel'){
   await send('editMessageText',{chat_id:cb.message.chat.id,message_id:cb.message.message_id,text:'تم إلغاء السحب. لم يتغير الرصيد.',reply_markup:{inline_keyboard:[]}});
   await send('answerCallbackQuery',{callback_query_id:cb.id});return true;
 }
 if(match[1]==='undo'){
   if(r.status!=='approved'||r.note==='REVERSED_BY_TELEGRAM_ADMIN'){await alert('هذا الشحن غير قابل للسحب أو سُحب سابقًا');return true;}
   await send('sendMessage',{chat_id:cb.message.chat.id,text:title+'\n\nتأكيد سحب مبلغ هذا الشحن كاملًا من محفظة الزبون؟\nهذا لا يحوّل رصيدًا على شبكة ليبيانا.',reply_markup:{inline_keyboard:[[{text:'تأكيد سحب '+r.amount+' د.ل',callback_data:'sw:confirm:'+number},{text:'إلغاء',callback_data:'sw:cancel:'+number}]]}});
   await send('answerCallbackQuery',{callback_query_id:cb.id});return true;
 }
 const {data:result,error:re}=await db.rpc('sms_reverse_topup',{p_review_number:number,p_admin_telegram_id:cb.from.id});
 if(re){await alert('تعذر تنفيذ السحب، حاول لاحقًا');return true;}
 if(!result?.reversed){
   const reason=result?.reason;
   await alert(reason==='insufficient_balance'?'رصيد الزبون المتبقي لا يكفي لسحب مبلغ الشحن كاملًا. لم يُخصم شيء.':reason==='already_reversed'?'سُحب هذا المبلغ سابقًا؛ لم نخصمه مرة أخرى.':'هذا التحويل غير معتمد أو لا توجد عملية شحن مطابقة.');return true;
 }
 await send('editMessageText',{chat_id:cb.message.chat.id,message_id:cb.message.message_id,text:title+'\n\n✅ تم سحب '+result.amount+' د.ل من المحفظة.\nالرصيد المتبقي: '+result.balance_after+' د.ل',reply_markup:{inline_keyboard:[[{text:'عرض الحساب',callback_data:'sw:account:'+number}]]}});
 await send('answerCallbackQuery',{callback_query_id:cb.id,text:'تم السحب مرة واحدة فقط'});
 return true;
}

