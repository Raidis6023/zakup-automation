import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
 import {createAdminClient} from '../../../../lib/supabase/admin';
export const runtime='nodejs';export const dynamic='force-dynamic';
function amount(value:unknown):number|null{
 if(value==null||String(value).trim()==='')return null;
 const s=String(value).trim().replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw Error('Некорректная сумма');
 const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n))throw Error('Слишком большая сумма');return n;
}
export async function POST(req:NextRequest){try{
 const client=await createClient(),{data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.json({error:'Требуется авторизация'},{status:401});
 const db=createAdminClient();const rights=await db.from('app_user_access').select('admin_level,is_blocked').eq('user_id',user.id).maybeSingle();
 if(rights.error||!rights.data||rights.data.is_blocked||!['admin','senior_admin'].includes(rights.data.admin_level??''))
  return NextResponse.json({error:'Недостаточно прав'},{status:403});
 const obj=await req.json(),nm_id=String(obj.nm_id??'').trim(),valid_from=String(obj.valid_from??'');
 if(!/^\d{1,20}$/.test(nm_id)||!/^\d{4}-\d{2}-\d{2}$/.test(valid_from)||!Number.isFinite(Date.parse(valid_from+'T00:00:00Z'))||new Date(valid_from+'T00:00:00Z').toISOString().slice(0,10)!==valid_from)
  return NextResponse.json({error:'Некорректный nmId или дата'},{status:400});
 const cost_cents=amount(obj.cost),mayak_cents=amount(obj.mayak);
 if(cost_cents===null&&mayak_cents===null)return NextResponse.json({error:'Укажите ставку или 0'},{status:400});
 const existing=await db.from('wb_finance_unit_rates').select('version').eq('nm_id',nm_id).eq('valid_from',valid_from).maybeSingle();
 if(existing.error)throw existing.error;
 const version=Number(existing.data?.version??0)+1;
 const saved=await db.from('wb_finance_unit_rates').upsert({nm_id,valid_from,cost_cents,mayak_cents,version,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:'nm_id,valid_from'});
 if(saved.error)throw saved.error;
 return NextResponse.json({ok:true,version});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Ошибка сохранения'},{status:500});}}
