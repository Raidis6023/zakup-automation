import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function POST(req:NextRequest){try{
 const {data:{user}}=await (await createClient()).auth.getUser();
 if(!user)return NextResponse.json({error:'Требуется авторизация'},{status:401});
 const db=createAdminClient(),access=await db.from('app_user_access').select('admin_level,is_blocked').eq('user_id',user.id).maybeSingle();
 if(access.error||!access.data||access.data.is_blocked||!['admin','senior_admin'].includes(access.data.admin_level??''))
  return NextResponse.json({error:'Недостаточно прав'},{status:403});
 const payload=await req.json(),nm=String(payload.nm_id??'').trim(),master=String(payload.master_code??'').trim(),manager=String(payload.manager_name??'').trim();
 if(!/^\d{4,15}$/.test(nm)||!/^[A-Z0-9]{5,16}$/i.test(master)||manager.length>100)
  return NextResponse.json({error:'Неверный артикул, ЕНОТ или имя КМ'},{status:400});
 const source=await db.from('marketplace_listings').select('master_code').eq('marketplace','wildberries').eq('external_id',nm).eq('is_active',true).limit(1).maybeSingle();
 if(source.error)throw source.error;
 if(source.data?.master_code!==master)return NextResponse.json({error:'ЕНОТ должен совпадать с подтверждённой привязкой товара WB'},{status:409});
 if(manager){
  const saved=await db.from('ozon_finance_managers').upsert({master_code:master,manager_name:manager,updated_at:new Date().toISOString()},{onConflict:'master_code'});
  if(saved.error)throw saved.error;
 }else{
  const removed=await db.from('ozon_finance_managers').delete().eq('master_code',master);
  if(removed.error)throw removed.error;
 }
 return NextResponse.json({ok:true,master_code:master,manager_name:manager},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Ошибка сохранения КМ'},{status:500});}}
