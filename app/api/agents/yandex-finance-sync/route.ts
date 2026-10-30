import {NextRequest,NextResponse} from 'next/server';
import * as XLSX from 'xlsx';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {parseWorkbooks} from '../../../../lib/yandex/finance-parser';
import {orderQuantities} from '../../../../lib/yandex/finance-orders';
import {validDate} from '../../../../lib/yandex/finance';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
const base='https://api.partner.market.yandex.ru';
async function yandex(path:string,body?:unknown){
 const keys=[...new Set((process.env.YANDEX_API_KEY_FULL??'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean))];if(keys.length!==1)throw new Error('Проверьте YANDEX_API_KEY_FULL: нужен один ключ');
 const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Api-Key':keys[0],'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new Error('ЯМ: HTTP '+r.status+' при запросе '+path.split('?')[0]);return r.json();
}
async function download(url:string){
 const u=new URL(url);if(u.protocol!=='https:'||!(u.hostname==='yandex.ru'||u.hostname.endsWith('.yandex.ru')||u.hostname==='yandex.net'||u.hostname.endsWith('.yandex.net')))throw new Error('Неподдерживаемый адрес отчёта ЯМ');
 const r=await fetch(u,{cache:'no-store',signal:AbortSignal.timeout(60000)});if(!r.ok)throw new Error('Ошибка скачивания отчёта: '+r.status);const b=Buffer.from(await r.arrayBuffer());if(b.length>40*1024*1024)throw new Error('Отчёт превышает 40 МБ');return b;
}
export async function POST(req:NextRequest){
 let lockedId:string|null=null;
 let db:Awaited<ReturnType<typeof financeAccess>>|null=null;
 try{
  db=await financeAccess(req);const input=await req.json();
  if(input.action==='start'){
   const {from,to}=input;if(!validDate(from)||!validDate(to)||from>to||Date.parse(to)-Date.parse(from)>90*86400000)return NextResponse.json({error:'Выберите период не более 91 дня'},{status:400});
   const {data:active,error:findError}=await db.from('yandex_finance_reports').select('id,date_from,date_to,status,phase').eq('status','loading').order('created_at',{ascending:false}).limit(1).maybeSingle();if(findError)throw findError;if(active)return NextResponse.json(active);
   const {data,error}=await db.from('yandex_finance_reports').insert({date_from:from,date_to:to,status:'loading',phase:'services_request'}).select('id,status,phase,date_from,date_to').single();if(error)throw error;return NextResponse.json(data);
  }
  if(input.action!=='advance'||!/^[-a-f0-9]{36}$/.test(input.id??''))return NextResponse.json({error:'Некорректный запрос'},{status:400});
  const id=String(input.id),now=new Date().toISOString();
  const {data:job,error:readError}=await db.from('yandex_finance_reports').select('id,status,phase,date_from,date_to,report_id,next_request_at,error,order_state,business_id').eq('id',id).single();if(readError)throw readError;if(!job)throw new Error('Задание не найдено');if(job.status!=='loading')return NextResponse.json(job);
  const {data:claim,error:claimError}=await db.from('yandex_finance_reports').update({locked_until:new Date(Date.now()+420000).toISOString()}).eq('id',id).eq('status','loading').or('locked_until.is.null,locked_until.lt.'+now).select('id').maybeSingle();if(claimError)throw claimError;if(!claim)return NextResponse.json({...job,busy:true});lockedId=id;
  async function update(patch:Record<string,unknown>){const {error}=await db!.from('yandex_finance_reports').update(patch).eq('id',id);if(error)throw error;Object.assign(job!,patch);}
  if(job.phase==='services_request'||job.phase==='orders_request'){
   if(job.next_request_at&&Date.parse(job.next_request_at)>Date.now())return NextResponse.json(job);
   const promotion=await db.from('yandex_promotion_jobs').select('day').eq('status','requested').limit(1);if(promotion.error)throw promotion.error;if(promotion.data.length)return NextResponse.json({...job,waiting_for:'promotion_report'});
   const control=await db.from('yandex_promotion_control').select('next_request_at').eq('id',1).maybeSingle();if(control.error)throw control.error;if(control.data?.next_request_at&&Date.parse(control.data.next_request_at)>Date.now())return NextResponse.json(job);
   const services=job.phase==='services_request';
   const campaign=await yandex('/v2/campaigns/'+process.env.YANDEX_CAMPAIGN_ID?.trim());const businessId=campaign.campaign?.business?.id;if(!businessId)throw new Error('Не найден businessId');
   const report=await yandex('/v2/reports/'+(services?'united-marketplace-services':'united-orders')+'/generate?format=FILE&language=RU',{businessId,dateFrom:job.date_from,dateTo:job.date_to});if(!report.result?.reportId)throw new Error('ЯМ не вернул reportId');
   await update({business_id:businessId,phase:services?'services_poll':'orders_poll',report_id:report.result.reportId,[services?'services_report_id':'orders_report_id']:report.result.reportId,next_request_at:new Date(Date.now()+125000).toISOString()});
  }else if(job.phase==='services_poll'||job.phase==='orders_poll'){
   const report=await yandex('/v2/reports/info/'+encodeURIComponent(job.report_id??''));const info=report.result;
   if(info?.status==='FAILED')throw new Error('ЯМ не смог сформировать отчёт');
   if(info?.status==='DONE'){
    if(!info.file)throw new Error('Нет файла готового отчёта');const binary=await download(info.file);
    if(job.phase==='services_poll')await update({services_base64:binary.toString('base64'),phase:'orders_request'});
    else{
     const {data:saved,error}=await db.from('yandex_finance_reports').select('services_base64').eq('id',id).single();if(error)throw error;if(!saved?.services_base64)throw new Error('Не сохранён отчёт услуг');
     const lines=parseWorkbooks(XLSX.read(Buffer.from(saved.services_base64,'base64'),{type:'buffer'}),XLSX.read(binary,{type:'buffer'}));
     const removed=await db.from('yandex_finance_lines').delete().eq('report_id',id);if(removed.error)throw removed.error;
     for(let i=0;i<lines.length;i+=500){const {error}=await db.from('yandex_finance_lines').insert(lines.slice(i,i+500).map((payload,j)=>({report_id:id,line_index:i+j,payload})));if(error)throw error;}
     const count=await db.from('yandex_finance_lines').select('*',{count:'exact',head:true}).eq('report_id',id);if(count.error||count.count!==lines.length)throw new Error('Не совпало количество сохранённых строк');
     await update({phase:'order_units_pull',line_count:lines.length,services_base64:null,order_state:{},error:null});
    }
   }
  }
  if(job.phase==='order_units_pull'){
   const endExclusive=new Date(Date.parse(job.date_to)+86400000).toISOString().slice(0,10);
   const business=job.business_id;if(!business)throw new Error('Не сохранён businessId для выгрузки заказанных единиц');
   let state=(job.order_state??{}) as {from?:string;end?:string;pageToken?:string;pages?:number};
   const pullStarted=Date.now();
   // A browser request used to pull exactly one 50-order page. Any tab sleep,
   // navigation or flaky connection left the report stuck. Pull a safe batch
   // server-side and checkpoint every page so one click can finish the period.
   for(let batch=0;batch<24&&Date.now()-pullStarted<180000;batch++){
    const windowFrom=state.from??job.date_from;
    const windowEnd=state.end??new Date(Math.min(Date.parse(windowFrom)+30*86400000,Date.parse(endExclusive))).toISOString().slice(0,10);
    const query=new URLSearchParams({limit:'50'});if(state.pageToken)query.set('pageToken',state.pageToken);
    const response=await yandex(`/v1/businesses/${business}/orders?${query}`,{dates:{creationDateFrom:windowFrom,creationDateTo:windowEnd},fake:false});
    const quantities=orderQuantities(response).filter(o=>o.order_date>=windowFrom&&o.order_date<windowEnd);
    if(quantities.length){const {error}=await db.from('yandex_finance_order_quantities').upsert(quantities.map(o=>({...o,report_id:id})),{onConflict:'report_id,order_id,item_id'});if(error)throw error;}
    const next=response.paging?.nextPageToken,pages=(state.pages??0)+1;
    if(next&&next===state.pageToken)throw new Error('ЯМ повторил токен страницы заказов');
    if(next)state={from:windowFrom,end:windowEnd,pageToken:next,pages};
    else if(windowEnd<endExclusive)state={from:windowEnd,pages};
    else {await update({status:'ready',phase:'done',order_units_complete:true,order_state:{pages},completed_at:new Date().toISOString(),error:null});const publish=await db.rpc('finance_publish_yandex_daily',{p_report_id:id});if(publish.error)throw Error('Не удалось опубликовать дневные данные: '+publish.error.message);break;}
    await update({order_state:state});
    await new Promise(resolve=>setTimeout(resolve,350));
   }
  }
  const safe={...job};delete (safe as Record<string,unknown>).services_base64;return NextResponse.json(safe);
 }catch(e){const raw=e instanceof Error?e.message:'Ошибка загрузки';const error=raw.replace(/ACMA:[^\s"\\]+/g,'[скрыто]');if(db&&lockedId)await db.from('yandex_finance_reports').update({status:'failed',error}).eq('id',lockedId);return NextResponse.json({error},{status:500});
 }finally{if(db&&lockedId)await db.from('yandex_finance_reports').update({locked_until:null}).eq('id',lockedId);}
}

