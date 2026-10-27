import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {validDate} from '../../../../lib/yandex/finance';
import {campaignMetrics,type MetricTotals} from '../../../../lib/ozon/campaign-metrics';
export const dynamic='force-dynamic';
function days(from:string,to:string){const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Krasnoyarsk',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());if(!validDate(from)||!validDate(to)||from>to||to>today||Date.parse(to)-Date.parse(from)>90*86400000)throw Error('Выберите период до 91 дня без будущих дат');const out:string[]=[];for(let d=from;d<=to;d=new Date(Date.parse(d)+86400000).toISOString().slice(0,10))out.push(d);return out;}
function failure(e:unknown){const error=e instanceof Error?e.message:'Ошибка статистики ЯМ';return NextResponse.json({ok:false,error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:400});}
export async function POST(req:NextRequest){try{const db=await financeAccess(),p=await req.json(),period=days(String(p.from??''),String(p.to??''));const tasks=period.flatMap(day=>['sales','shows'].map(kind=>({day,kind})));
 const r=await db.from('yandex_promotion_jobs').upsert(tasks,{onConflict:'day,kind',ignoreDuplicates:true});if(r.error)throw r.error;
 const retry=await db.from('yandex_promotion_jobs').update({status:'pending',report_id:null,error:null}).in('day',period).eq('status','failed');if(retry.error)throw retry.error;
 return NextResponse.json({ok:true});}catch(e){return failure(e);}}
export async function GET(req:NextRequest){try{const db=await financeAccess(),u=new URL(req.url),from=u.searchParams.get('from')??'',to=u.searchParams.get('to')??'',offer=u.searchParams.get('offer_id')??'',period=days(from,to);if(!offer||offer.length>255)throw Error('Укажите артикул');
 const [r,j]=await Promise.all([db.from('yandex_promotion_daily').select('day,kind,expense,views,clicks,carts,orders,revenue').eq('offer_id',offer).gte('day',from).lte('day',to),db.from('yandex_promotion_jobs').select('day,kind,status,error').gte('day',from).lte('day',to)]);if(r.error)throw r.error;if(j.error)throw j.error;
 const zero:MetricTotals={expense:0,views:0,clicks:0,carts:0,orders:0,revenue:0},unknown:MetricTotals={expense:0,views:null,clicks:null,carts:null,orders:null,revenue:null};
 const campaigns=['sales','shows'].map(kind=>({id:kind,days:period.map(day=>{const done=j.data.some(x=>x.day===day&&x.kind===kind&&x.status==='complete');const row=r.data.find(x=>x.day===day&&x.kind===kind);const values=row?Object.fromEntries(['expense','views','clicks','carts','orders','revenue'].map(k=>[k,row[k as keyof typeof row]===null?null:Number(row[k as keyof typeof row])])) as unknown as MetricTotals:done?zero:unknown;return {day,...campaignMetrics(values),available:done,complete:done};})}));
 const coverage=period.map(day=>({day,complete:campaigns.every(c=>c.days.find(x=>x.day===day)?.complete)}));
 return NextResponse.json({ok:true,campaigns,coverage,complete:coverage.every(x=>x.complete),loading:j.data.some(x=>['pending','requested'].includes(x.status)),hasMapping:true,warning:j.data.find(x=>x.error)?.error??null},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return failure(e);}}
