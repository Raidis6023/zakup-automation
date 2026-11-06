import {createClient} from '../supabase/server';
import {createAdminClient} from '../supabase/admin';
export async function financeAccess(request?: Request){
 if(request && process.env.CRON_SECRET && request.headers.get('authorization')==='Bearer '+process.env.CRON_SECRET)return createAdminClient();
 const session=await createClient();const {data:verified,error:authError}=await session.auth.getClaims();
 const claims=verified?.claims;
 const user=!authError&&claims?.sub?{id:claims.sub}:null;
 if(!user)throw new Error('Требуется авторизация');
 const db=createAdminClient();const {data,error}=await db.from('app_user_access').select('admin_level,is_blocked').eq('user_id',user.id).maybeSingle();
 if(error||!data||data.is_blocked||!['admin','senior_admin'].includes(data.admin_level??''))throw new Error('Недостаточно прав для финансовой аналитики');return db;
}
