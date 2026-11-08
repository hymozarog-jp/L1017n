/* Read-only audit. No approval, credit, reversal, or wallet mutation. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money=(v:unknown)=>Number.isFinite(Number(v))&&v!==null?Number(v).toFixed(3)+' د.ل':'غير متاح';
const phone=(v:unknown)=>{let s=String(v??'').replace(/\D/g,'');if(s.startsWith('00218'))s=s.slice(5);else if(s.startsWith('218'))s=s.slice(3);if(s.startsWith('0'))s=s.slice(1);return /^9[24]\d{7}$/.test(s)?s:''};
const clean=(v:unknown)=>String(v??'—').replace(/[\r\n\t]/g,' ').slice(0,100);
export function formatAudit(q:any,w:any,receipts:any[],tx:any[]):string {
 const alerts:string[]=[];
 const credits=tx.filter(t=>t.transaction_type==='topup'&&Number(t.amount)>0);
 const sum=credits.reduce((n,t)=>n+Number(t.amount),0);
 const linked=receipts.filter(r=>r.request_id===q.id);
 const exact=linked.filter(r=>phone(r.transfer_phone)&&phone(r.transfer_phone)===phone(q.phone)&&r.provider===q.method&&Math.round(Number(r.amount)*1000)===Math.round(Number(q.amount)*1000)&&['matched','approved'].includes(r.status));
 if(!linked.length)alerts.push('لم تُسجّل رسالة تحويل مرتبطة بهذا الطلب؛ المبلغ المطلوب ليس دليلًا على وصوله.');
 if(linked.some(r=>!phone(r.transfer_phone)||phone(r.transfer_phone)!==phone(q.phone)))alerts.push('رقم مرسل الرسالة مختلف عن رقم الطلب أو غير صالح.');
 if(linked.some(r=>r.provider!==q.method))alerts.push('شركة التحويل مختلفة عن الطلب.');
 if(linked.some(r=>Math.round(Number(r.amount)*1000)!==Math.round(Number(q.amount)*1000)))alerts.push('مبلغ الرسالة مختلف عن المبلغ المطلوب.');
 if(linked.length>1)alerts.push('أكثر من رسالة مرتبطة بنفس الطلب؛ راجع احتمال التكرار.');
 if(credits.length>1)alerts.push('يوجد أكثر من قيد شحن لهذا الطلب؛ يحتاج مراجعة.');
 if(credits.some(t=>t.user_id!==q.user_id))alerts.push('قيد الشحن مرتبط بحساب مختلف.');
 if(credits.length&&Math.round(sum*1000)!==Math.round(Number(q.amount)*1000))alerts.push('المبلغ المضاف للمحفظة يختلف عن مبلغ الطلب.');
 if(q.status==='approved'&&!credits.length)alerts.push('الطلب معتمد لكن لم يُعثر على قيد شحن مرتبط به.');
 if(q.status!=='approved'&&credits.length)alerts.push('يوجد قيد شحن رغم أن الطلب غير معتمد.');
 if(linked.some(r=>r.note==='REVERSED_BY_TELEGRAM_ADMIN'))alerts.push('تم سحب هذا الشحن لاحقًا؛ القيد الأصلي ليس رصيدًا متاحًا الآن.');
 if(linked.some(r=>!['matched','approved'].includes(r.status)))alerts.push('حالة رسالة مرتبطة ليست مطابقة أو معتمدة.');
 if(!w)alerts.push('لم يُعثر على محفظة لهذا الحساب.');
 const status=({pending:'بانتظار الاعتماد',approved:'معتمد',rejected:'مرفوض'} as Record<string,string>)[q.status]||clean(q.status);
 const lines=['🔎 فحص التحويل والمحفظة','🆔 الطلب: '+q.id,'👤 الحساب: '+q.user_id,'📱 المحوّل: '+clean(q.phone),'📋 الحالة: '+status,'','المبلغ المطلوب: '+money(q.amount)];
 for(const r of linked.slice(0,4))lines.push('📨 مبلغ رسالة #'+r.review_number+': '+money(r.amount)+' — '+clean(r.status));
 lines.push('💰 المضاف وفق سجل هذا الطلب: '+money(sum),'💳 رصيد ليبيانا الحالي: '+(w?money(w.balance):'غير متاح'));
 if(credits.length===1&&credits[0].balance_after!==null){const t=credits[0];lines.push('رصيده قبل هذا القيد: '+money(Number(t.balance_after)-Number(t.amount)),'رصيده بعد هذا القيد: '+money(t.balance_after));}
 if(!alerts.length&&exact.length===1)lines.push('','✅ الرقم والمبلغ متطابقان بين الطلب والرسالة.'+(credits.length===1?' ويوجد قيد شحن واحد.':' لم يُسجّل الشحن بعد.'));
 else lines.push('',...alerts.map(s=>'⚠️ '+s));
 lines.push('','آخر فحص: '+new Date().toLocaleString('ar-LY',{timeZone:'Africa/Tripoli'}),'الفحص يطابق سجلات المتجر ورسائل الهاتف؛ ليس كشف حساب مباشرًا من شركة ليبيانا. الرصيد الحالي قد يتغير بالمشتريات والتحويلات.');
 return lines.join('\n');
}
export async function buildTransferAudit(db:any,id:string):Promise<string>{
 if(!uuid.test(id))return 'رقم الطلب غير صحيح.';
 const {data:q,error:qe}=await db.from('topup_requests').select('id,user_id,phone,amount,method,status,created_at').eq('id',id).maybeSingle();
 if(qe)throw Error('audit_request_read_failed');if(!q)return 'طلب الشحن غير موجود.';
 const [w,r,t]=await Promise.all([
  db.from('wallet_accounts').select('balance').eq('user_id',q.user_id).maybeSingle(),
  db.from('sms_topup_receipts').select('review_number,request_id,transfer_phone,amount,provider,status,note').eq('request_id',id).order('received_at',{ascending:false}).limit(20),
  db.from('wallet_transactions').select('user_id,amount,balance_after,transaction_type').eq('topup_request_id',id).order('created_at',{ascending:false}).limit(20)
 ]);
 if(w.error||r.error||t.error)throw Error('audit_details_read_failed');
 return formatAudit(q,w.data,r.data||[],t.data||[]);
}
export async function auditCommand(db:any,input:string):Promise<string>{
 const value=input.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632));
 if(uuid.test(value))return buildTransferAudit(db,value);
 const n=phone(value);
 if(!n)return 'لفحص زبون اكتب:\nتحقق 092xxxxxxx\nأو /check ثم رقم الطلب الكامل.\nيمكنك أيضًا الضغط على «فحص التحويل والمحفظة» تحت طلب الشحن.';
 const {data:qs,error}=await db.from('topup_requests').select('id').in('phone',[n,'0'+n,'218'+n,'+218'+n]).order('created_at',{ascending:false}).limit(2);
 if(error)throw Error('audit_phone_read_failed');
 if(!qs?.length)return 'لا توجد طلبات شحن بهذا الرقم.';
 const reports=[];
 for(const q of qs)reports.push(await buildTransferAudit(db,q.id));
 return 'أحدث طلبين لهذا الرقم (قد يكون المحوّل مشتركًا بين حسابات):\n\n'+reports.join('\n\n────────\n\n');
}
