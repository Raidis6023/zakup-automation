import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
export async function POST(req:NextRequest){try{
 const db=await financeAccess(),body=await req.json();const article=String(body.article??''),manager=String(body.manager??'').trim();
 if(!article||!manager||manager.length>80)return NextResponse.json({error:'Укажите артикул и КМ (до 80 символов)'},{status:400});
 const {data:p,error}=await db.from('yandex_products').select('master_code').eq('offer_id',article).maybeSingle();if(error)throw error;if(!p)return NextResponse.json({error:'Товар ЯМ не найден'},{status:404});
 const key=p.master_code??'article:'+article;
 const saved=await db.from('yandex_finance_managers').upsert({master_key:key,manager_name:manager,updated_at:new Date().toISOString()},{onConflict:'master_key'});if(saved.error)throw saved.error;
 return NextResponse.json({ok:true,master_key:key,manager});
 }catch(e){const error=e instanceof Error?e.message:'Не удалось сохранить КМ';return NextResponse.json({error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}}
