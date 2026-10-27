export type CampaignLine={sku:string;day:string;expense:number;views:number|null;clicks:number|null;carts:number|null;orders:number|null;revenue:number|null};
export type MetricTotals={expense:number;views:number|null;clicks:number|null;carts:number|null;orders:number|null;revenue:number|null};
export function campaignMetrics(x:MetricTotals){return {...x,drr:x.revenue!==null&&x.revenue>0?x.expense/x.revenue:null,ctr:x.views!==null&&x.views>0&&x.clicks!==null?x.clicks/x.views:null,cpm:x.views!==null&&x.views>0?x.expense/x.views*1000:null,cpc:x.clicks!==null&&x.clicks>0?x.expense/x.clicks:null,cpo:x.orders!==null&&x.orders>0?x.expense/x.orders:null};}
export function sumCampaignMetrics(rows:MetricTotals[]):MetricTotals{
 const total=(k:Exclude<keyof MetricTotals,'expense'>)=>rows.some(r=>r[k]===null)?null:rows.reduce((s,r)=>s+(r[k]??0),0);
 return {expense:rows.reduce((s,r)=>s+r.expense,0),views:total('views'),clicks:total('clicks'),carts:total('carts'),orders:total('orders'),revenue:total('revenue')};
}
const norm=(s:string)=>s.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/₽/g,' руб ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function csv(text:string){const out:string[][]=[];let row:string[]=[],cell='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===';'&&!quote){row.push(cell.trim());cell='';}else if((c==='\r'||c==='\n')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell.trim());if(row.some(Boolean))out.push(row);row=[];cell='';}else cell+=c;}if(quote)throw Error('Unterminated campaign CSV');row.push(cell.trim());if(row.some(Boolean))out.push(row);return out;}
const number=(s:string):number|null=>{const v=s.trim().replace(/[₽\s\u00a0]/g,'').replace(',','.');if(!v||v==='-'||v==='—')return null;if(!/^\d+(?:\.\d+)?$/.test(v))throw Error('Некорректная метрика рекламного отчёта');return Number(v);};
export function campaignHeaders(text:string){return csv(text.replace(/^\uFEFF/,'')).slice(0,40).find(row=>{const h=row.map(norm);return h.some(x=>['sku','озон sku','код sku'].includes(x))&&h.some(x=>x.startsWith('расход')||['spend','expense'].includes(x));})??[];}
export function parseCampaignCSV(text:string,from:string,to:string):CampaignLine[]{
 const lines=csv(text.replace(/^\uFEFF/,''));let head=-1,sku=-1,cost=-1;
 for(let i=0;i<Math.min(40,lines.length);i++){const a=lines[i].map(norm);sku=a.findIndex(x=>['sku','озон sku','код sku'].includes(x));cost=a.findIndex(x=>x.startsWith('расход')||['spend','expense'].includes(x));if(sku>=0&&cost>=0){head=i;break;}}
 if(head<0)throw Error('CSV does not contain SKU and advertising expense columns');
 const headers=lines[head].map(norm),find=(names:string[])=>headers.findIndex(s=>names.includes(s));
 const cols={views:find(['показы','views','impressions']),clicks:find(['клики','clicks']),carts:find(['в корзину','добавления в корзину','корзина','to cart','tocart']),orders:headers.findIndex(s=>s==='orders'||/^(заказы|заказано товаров|продано товаров|покупки)( |$)/.test(s)&&!s.includes('модел')),revenue:headers.findIndex(s=>s==='revenue'||/^(выручка|сумма заказов|заказано на сумму|продажи в продвижении|продажи р|продажи руб)( |$)/.test(s)&&!s.includes('модел'))};
 const dateCol=find(['дата','день','date','дата отчета','report date']);const groups=new Map<string,CampaignLine>();
 for(const row of lines.slice(head+1)){
  const id=String(row[sku]??'').trim();if(!id||/^(всего|итого|total|bcero)$/i.test(id))continue;
  const expense=number(row[cost]??'');if(expense===null)continue;if(!/^\d{5,25}$/.test(id)){if((expense??0)>0)throw Error('Non-SKU advertising row with positive expense');continue;}
  const raw=String(row[dateCol]??'').trim();const ru=raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);let day=ru?`${ru[3]}-${ru[2]}-${ru[1]}`:/^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:null;
  const values=Object.fromEntries(Object.entries(cols).map(([k,col])=>[k,col<0?null:number(row[col]??'')])) as Omit<MetricTotals,'expense'>;
  if(expense===null&&!Object.values(values).some(x=>x!==null&&x>0))continue;
  if(!day&&from!==to&&expense===0&&Object.values(values).every(x=>x===0))continue;
  if(!day&&from!==to)throw Error('CSV_NO_DAILY_DATE: report must be split by day');day=day??from;if(day<from||day>to)throw Error('Advertising CSV contains date outside requested window');
  for(const k of ['views','clicks','carts','orders'] as const)if(values[k]!==null&&!Number.isInteger(values[k]))throw Error('Не целое количество в рекламном отчёте');
  const key=day+'|'+id,old=groups.get(key),next={sku:id,day,expense:expense??0,...values};
  groups.set(key,old?{sku:id,day,...sumCampaignMetrics([old,next])}:next);
 }return [...groups.values()];
}

/** Consistent observed-day totals; unknown source columns stay unknown. */
export function observedCampaignMetrics<T extends MetricTotals & {available:boolean}>(rows:T[]){const known=rows.filter(x=>x.available);return campaignMetrics(known.length?sumCampaignMetrics(known):{expense:0,views:null,clicks:null,carts:null,orders:null,revenue:null});}
