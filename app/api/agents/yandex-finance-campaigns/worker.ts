import { getIntegrationSecret } from "@/lib/integrations/secrets";
import * as XLSX from 'xlsx';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {parsePromotionWorkbook,type PromotionKind} from '../../../../lib/yandex/campaign-metrics';
async function yandex(path:string,body?:unknown){const keys=[...new Set(((await getIntegrationSecret("yandex_api_key_full"))??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];if(keys.length!==1)throw Error('Проверьте YANDEX_API_KEY_FULL: нужен один ключ');const r=await fetch('https://api.partner.market.yandex.ru'+path,{method:body?'POST':'GET',headers:{'Api-Key':keys[0],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store',signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error('ЯМ: HTTP '+r.status);const d=await r.json();if(d.status==='ERROR')throw Error('ЯМ отклонил запрос рекламного отчёта');return d;}
export async function advancePromotion(scope?:{from:string;to:string}){
 const db=createAdminClient(),now=new Date().toISOString();let locked=false;type Task={day:string;kind:PromotionKind;status:string;report_id:string|null};let task:Task|null=null;
 try{
 const c=await db.from('yandex_promotion_control').update({locked_until:new Date(Date.now()+240000).toISOString()}).eq('id',1).or('locked_until.is.null,locked_until.lt.'+now).select('next_request_at').maybeSingle();if(c.error)throw c.error;if(!c.data)return {ok:true,phase:'busy'};locked=true;
 // Financial report generation has priority: the basic Yandex plan permits one report at a time.
 const finance=await db.from('yandex_finance_reports').select('id,phase').eq('status','loading').limit(1);if(finance.error)throw finance.error;
 let queue=db.from('yandex_promotion_jobs').select('day,kind,status,report_id').in('status',['requested','pending']).order('status',{ascending:false}).order('day',{ascending:!!scope}).order('kind');
 if(scope)queue=queue.gte('day',scope.from).lte('day',scope.to);
 const q=await queue.limit(1).maybeSingle();if(q.error)throw q.error;if(!q.data)return {ok:true,phase:'idle'};task=q.data as Task;
 if(task.status==='pending'){
 // A manually selected recovery may start while the finance job is only waiting
 // to request a report. An actively generating finance report still blocks it.
 if(finance.data.some(x=>scope?['services_poll','orders_poll'].includes(x.phase):x.phase!=='order_units_pull'))return {ok:true,phase:'finance_loading'};
 if(c.data.next_request_at&&Date.parse(c.data.next_request_at)>Date.now())return {ok:true,phase:'cooldown'};
 const campaign=await yandex('/v2/campaigns/'+await getIntegrationSecret("yandex_campaign_id"));const businessId=campaign.campaign?.business?.id;if(!businessId)throw Error('Не найден businessId ЯМ');
 const generated=await yandex('/v2/reports/'+(task.kind==='sales'?'boost-consolidated':'shows-boost')+'/generate?format=FILE',{businessId,dateFrom:task.day,dateTo:task.day,...(task.kind==='shows'?{attributionType:'CLICKS'}:{})});
 if(!generated.result?.reportId)throw Error('ЯМ не вернул reportId');
 const save=await db.from('yandex_promotion_jobs').update({status:'requested',report_id:generated.result.reportId,error:null,updated_at:now}).eq('day',task.day).eq('kind',task.kind);if(save.error)throw save.error;
 const ctl=await db.from('yandex_promotion_control').update({next_request_at:new Date(Date.now()+125000).toISOString(),error:null}).eq('id',1);if(ctl.error)throw ctl.error;
 return {ok:true,phase:'requested'};
 }
 const report=await yandex('/v2/reports/info/'+encodeURIComponent(task.report_id??'')),info=report.result;if(info?.status==='FAILED')throw Error('ЯМ не смог сформировать рекламный отчёт');if(info?.status!=='DONE')return {ok:true,phase:'waiting'};
 const url=new URL(info.file);if(url.protocol!=='https:'||!['yandex.ru','yandex.net'].some(d=>url.hostname===d||url.hostname.endsWith('.'+d)))throw Error('Неподдерживаемый адрес рекламного отчёта ЯМ');
 const r=await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Не удалось скачать рекламный отчёт ЯМ');const b=Buffer.from(await r.arrayBuffer());if(b.length>40*1024*1024)throw Error('Рекламный отчёт ЯМ превышает 40 МБ');
 const rows=parsePromotionWorkbook(XLSX.read(b,{type:'buffer'}),task.kind);
 for(let i=0;i<rows.length;i+=500){const s=await db.from('yandex_promotion_daily').upsert(rows.slice(i,i+500).map(x=>({...x,day:task!.day,kind:task!.kind})),{onConflict:'offer_id,day,kind'});if(s.error)throw s.error;}
 const saved=await db.from('yandex_promotion_jobs').update({status:'complete',error:null,updated_at:now}).eq('day',task.day).eq('kind',task.kind);if(saved.error)throw saved.error;
 await db.from('yandex_promotion_control').update({error:null}).eq('id',1);return {ok:true,phase:'saved',rows:rows.length};
 }catch(e){const error=e instanceof Error?e.message:'Ошибка рекламного отчёта ЯМ';if(locked){await db.from('yandex_promotion_control').update({error,next_request_at:new Date(Date.now()+180000).toISOString()}).eq('id',1);if(task&&!(error.includes('HTTP 420')||error.includes('HTTP 429')||error.includes('HTTP 5')))await db.from('yandex_promotion_jobs').update({status:'failed',error,updated_at:now}).eq('day',task.day).eq('kind',task.kind);}return {ok:false,error};
 }finally{if(locked)await db.from('yandex_promotion_control').update({locked_until:null}).eq('id',1);}
}
