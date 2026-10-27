import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){try{
 const db=await financeAccess(),body=await req.json();
 const master=String(body.master_code??'').trim();
 if(!/^[A-Z0-9]{6}$/.test(master)||typeof body.discontinued!=='boolean')return NextResponse.json({error:'Проверьте код товара и значение флажка'},{status:400});
 const {data:listing,error:mappingError}=await db.from('yandex_products').select('id').eq('master_code',master).limit(1).maybeSingle();if(mappingError)throw mappingError;
 if(!listing)return NextResponse.json({error:'Не найден товар ЯМ с этим ЕНОТ'},{status:400});
 const {data:existing,error:readError}=await db.from('product_article_statuses').select('status').eq('master_code',master).maybeSingle();if(readError)throw readError;
 if(existing&&!['Активный','Выводится из продажи'].includes(existing.status))return NextResponse.json({error:'У товара специальный статус «'+existing.status+'». Измените его в списке артикулов.'},{status:409});
 const patch={master_code:master,status:body.discontinued?'Выводится из продажи':'Активный',updated_at:new Date().toISOString()};
 const saved=existing?await db.from('product_article_statuses').update(patch).eq('master_code',master).eq('status',existing.status).select('status').maybeSingle():await db.from('product_article_statuses').insert(patch).select('status').single();
 if(saved.error?.code==='23505'||!saved.error&&!saved.data)return NextResponse.json({error:'Статус изменён параллельно. Обновите отчёт.'},{status:409});if(saved.error)throw saved.error;
 return NextResponse.json({ok:true,master_code:master,discontinued:body.discontinued},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){const error=e instanceof Error?e.message:'Не удалось сохранить статус';return NextResponse.json({error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}}
