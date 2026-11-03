import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createAdminClient} from '../../../../lib/supabase/admin';
import {runHistoricalWbFinance} from '../wb-finance-cron/route';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(req:NextRequest){
 const key=process.env.CRON_SECRET;
 if(!key||req.headers.get('authorization')!=='Bearer '+key)return NextResponse.json({error:'Unauthorized'},{status:401});
 return runHistoricalWbFinance(req);
}
export async function POST(req:NextRequest){
 try{
  const session=await createClient(),{data:{user}}=await session.auth.getUser();
  if(!user)throw Error('Требуется авторизация');
  const db=createAdminClient(),{data,error}=await db.from('app_user_access').select('admin_level,is_blocked').eq('user_id',user.id).maybeSingle();
  if(error||!data||data.is_blocked||!['admin','senior_admin'].includes(data.admin_level??''))throw Error('Недостаточно прав');
  return runHistoricalWbFinance(req);
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Ошибка'},{status:403});}
}
