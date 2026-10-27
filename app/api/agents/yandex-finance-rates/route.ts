import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {createClient} from '../../../../lib/supabase/server';
import {validDate} from '../../../../lib/yandex/finance';
export const runtime='nodejs';export const dynamic='force-dynamic';
function amount(value:unknown):number|null{
 if(value===null||value==='')return null;
 if(typeof value!=='string'&&typeof value!=='number')throw new Error('Некорректный тариф');
 const s=String(value).trim().replace(',','.');if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw new Error('Тариф должен быть неотрицательным числом с двумя знаками после запятой');
 const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n>100000000000)throw new Error('Слишком большое значение тарифа');return n;
}
export async function POST(req:NextRequest){try{
 const db=await financeAccess();const body=await req.json();const master=String(body.master_code??'').trim().toUpperCase(),article=String(body.article??'').trim(),day=String(body.valid_from??'');
 if((master&&!/^[A-Z0-9]{6}$/.test(master))||(!master&&!article)||!validDate(day))return NextResponse.json({error:'Проверьте ЕНОТ и дату начала действия'},{status:400});
 let cost:number|null,mayak:number|null;try{cost=amount(body.cost);mayak=amount(body.mayak);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Некорректная сумма'},{status:400});}
 const {data:listing,error:mappingError}=await db.from('yandex_products').select('id,master_code').eq(master?'master_code':'offer_id',master||article).limit(1).maybeSingle();if(mappingError)throw mappingError;if(!listing)return NextResponse.json({error:'Нет артикула ЯМ с этим ЕНОТ'},{status:400});
 if(!master&&listing.master_code)return NextResponse.json({error:'У товара уже есть ЕНОТ. Обновите расчёт.'},{status:409});
 const table=master?'yandex_finance_rates':'yandex_finance_article_rates',key=master?'master_code':'article',value=master||article;
 const {data:{user}}=await (await createClient()).auth.getUser();if(!user)return NextResponse.json({error:'Требуется авторизация'},{status:401});
 const {data:current,error}=await db.from(table).select('version').eq(key,value).eq('valid_from',day).maybeSingle();if(error)throw error;
 if((current?.version??null)!==(body.expected_version??null))return NextResponse.json({error:'Тариф уже изменён. Обновите расчёт перед сохранением.'},{status:409});
 const patch={[key]:value,valid_from:day,cost_cents:cost,mayak_cents:mayak,source:'site',updated_by:user.id,updated_at:new Date().toISOString(),version:Number(current?.version??0)+1};
 const saved=current?await db.from(table).update(patch).eq(key,value).eq('valid_from',day).eq('version',current.version).select('*').maybeSingle():await db.from(table).insert(patch).select('*').single();
 if(saved.error?.code==='23505'||!saved.error&&!saved.data)return NextResponse.json({error:'Тариф изменён параллельно. Обновите расчёт.'},{status:409});if(saved.error)throw saved.error;
 return NextResponse.json({ok:true,rate:saved.data},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){const error=e instanceof Error?e.message:'Не удалось сохранить тариф';return NextResponse.json({error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}}
