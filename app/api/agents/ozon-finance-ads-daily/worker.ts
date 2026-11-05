import {createAdminClient} from '../../../../lib/supabase/admin';
import {getOzonCredentials} from '../../../../lib/integrations/secrets';

type ProviderRow={
 sku?:string|number;campaignId?:string|number;date?:string;
 expense?:string|number;views?:string|number;clicks?:string|number;
 toCart?:string|number;orders?:string|number;sales?:string|number;
};
const money=(value:unknown)=>{if(value===null||value===undefined||value==='')return null;const result=Number(String(value).replace(',','.'));return Number.isFinite(result)?result:null;};
const integer=(value:unknown)=>{const n=money(value);return n===null?null:Math.round(n);};
const following=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);

/** Daily CPC SKU statistics without a paid asynchronous campaign report.
 * This source provides only current/previous day: long history is imported
 * independently via UUID/CSV. No ledger amounts are written here.
 */
export async function runDailySkuAdvertising(){
 const db=createAdminClient();
 const today=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
 const day=following(today,-1);
 const log=async(status:'complete'|'empty'|'failed',count:number,expense:number,error?:string)=>{
  const saved=await db.from('ozon_finance_ad_sku_sync_status').upsert({
   account_key:'main',day,source:'cpc_sku_current',status,rows_saved:count,
   expense_rub:Math.round(expense*100)/100,last_error:error??null,checked_at:new Date().toISOString()
  },{onConflict:'account_key,day,source'});
  if(saved.error)throw new Error('Не удалось сохранить статус ежедневной рекламы: '+saved.error.message);
 };
 try{
  const {performanceClientId:id,performanceClientSecret:secret}=await getOzonCredentials();
  if(!id||!secret)throw new Error('Не заданы Performance Client ID/Secret в настройках интеграций Ozon');
  const auth=await fetch('https://api-performance.ozon.ru/api/client/token',{
   method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({client_id:id,client_secret:secret,grant_type:'client_credentials'}),
   signal:AbortSignal.timeout(20000)});
  if(!auth.ok)throw new Error('Ozon Performance auth HTTP '+auth.status);
  const access=(await auth.json() as {access_token?:string}).access_token;
  if(!access)throw new Error('Ozon Performance не вернул access_token');
  // Official free-limit POST, today/yesterday only; no UUID or report queue.
  const result=await fetch('https://api-performance.ozon.ru/api/client/statistics/products/sku',{
   method:'POST',cache:'no-store',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json','Accept':'application/json'},
   body:JSON.stringify({dateFrom:day,dateTo:day}),signal:AbortSignal.timeout(35000)});
  if(!result.ok)throw new Error('Ozon SKU CPC HTTP '+result.status+' '+(await result.text()).slice(0,180));
  const response=await result.json() as {rows?:unknown};
  if(!Array.isArray(response.rows))throw new Error('Ozon SKU CPC: неизвестный формат, отсутствует rows[]');
  const grouped=new Map<string,{
    account_key:string;day:string;sku:string;campaign_id:string;
    expense_rub:number;views:number|null;clicks:number|null;carts:number|null;
    orders:number|null;revenue_rub:number|null;metrics_version:number;
  }>();
  for(const entry of response.rows as ProviderRow[]){
   if(!entry||typeof entry!=='object')throw new Error('Ozon SKU CPC: некорректная строка отчёта');
   const sku=String(entry.sku??''),campaign=String(entry.campaignId??''),date=String(entry.date??'').slice(0,10);
   if(!/^\d{1,24}$/.test(sku)||!/^\d{1,24}$/.test(campaign)||date!==day)
    throw new Error('Ozon SKU CPC: строка без SKU/кампании или неверная дата');
   const cost=money(entry.expense);
   if(cost===null||cost<0)throw new Error('Ozon SKU CPC: отсутствует подтверждённый расход');
   const key=sku+'|'+campaign;
   if(grouped.has(key))throw new Error('Ozon SKU CPC: повторная комбинация SKU и кампании в одном дне');
   grouped.set(key,{
    account_key:'main',day,sku,campaign_id:campaign,expense_rub:cost,
    views:integer(entry.views),clicks:integer(entry.clicks),carts:integer(entry.toCart),
    orders:integer(entry.orders),revenue_rub:money(entry.sales),metrics_version:2
   });
  }
  const rows=[...grouped.values()];
  // Upsert rather than replace. A transient partial response must never erase history.
  for(let i=0;i<rows.length;i+=200){
   const q=await db.from('ozon_finance_ad_sku_daily').upsert(rows.slice(i,i+200),{onConflict:'account_key,day,sku,campaign_id'});
   if(q.error)throw new Error('Ozon SKU CPC: ошибка сохранения: '+q.error.message);
  }
  const expense=rows.reduce((sum,row)=>sum+row.expense_rub,0);
  await log(rows.length?'complete':'empty',rows.length,expense);
  return {ok:true,day,rows_saved:rows.length,expense_rub:Math.round(expense*100)/100,
   state:rows.length?'complete':'empty',note:'Оперативная статистика CPC; сумма финансового начисления Ozon не дублируется'};
 }catch(error){
  const message=error instanceof Error?error.message:'Неизвестная ошибка Ozon CPC';
  await log('failed',0,0,message.slice(0,250));
  return {ok:false,day,error:message.slice(0,300)};
 }
}
