import * as XLSX from 'xlsx';
import {sumCampaignMetrics,type MetricTotals} from '../ozon/campaign-metrics';
export type PromotionKind='sales'|'shows';
const norm=(x:unknown)=>String(x??'').toLowerCase().replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function numeric(v:unknown):number|null{if(v===undefined||v===null||v===''||v==='—'||v==='-')return null;const n=Number(String(v).replace(/\s/g,'').replace(',','.'));if(!Number.isFinite(n)||n<0)throw Error('Некорректное число в рекламном отчёте ЯМ');return n;}
export function parsePromotionWorkbook(book:XLSX.WorkBook,kind:PromotionKind){
 const result=new Map<string,MetricTotals>();let recognized=false;
 for(const name of book.SheetNames){const rows=XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name],{header:1,defval:null});
 const header=rows.findIndex(row=>row.some(v=>['ваш sku','offer id','shop sku'].includes(norm(v))));if(header<0)continue;
 const h=rows[header].map(norm),col=(...names:string[])=>h.findIndex(s=>names.some(n=>s===n||s.startsWith(n+' '))),sku=col('ваш sku','offer id','shop sku');
 const keys=kind==='sales'?{expense:col('billed amount','расходы на буст'),views:col('shows with fee','показы товара с бустом'),clicks:col('clicks vendor with fee','клики по товару с бустом'),carts:col('clicks cpa with fee','добавления в корзину товаров с бустом'),orders:col('order items with fee','заказанные товары с бустом'),revenue:col('orders gvm delivered with fee','выручка с бустом')}:{expense:col('cost','расчетные расходы на буст'),views:col('shows','показы товаров с бустом'),clicks:col('clicks','клики по товарам с бустом'),carts:col('cart addition','добавления в корзину с бустом'),orders:col('ordered count','заказанные товары с бустом'),revenue:col('ordered amount','выручка с бустом')};
 if(keys.expense<0||keys.views<0||keys.clicks<0)continue;recognized=true;
 for(const row of rows.slice(header+1)){const offer=String(row[sku]??'').trim();if(!offer||/^(итого|всего|total)$/i.test(offer))continue;
 const values=Object.fromEntries(Object.entries(keys).map(([k,i])=>[k,i<0?null:numeric(row[i])])) as unknown as MetricTotals;
 if(values.expense===null)throw Error('Не указаны расходы в рекламном отчёте ЯМ');for(const k of ['views','clicks','carts','orders'] as const)if(values[k]!==null&&!Number.isInteger(values[k]))throw Error('Не целое количество в отчёте ЯМ');
 result.set(offer,result.has(offer)?sumCampaignMetrics([result.get(offer)!,values]):values);
 }
 }
 if(!recognized)throw Error('Не найдены товарные колонки рекламного отчёта ЯМ');return [...result].map(([offer_id,values])=>({offer_id,...values}));
}
