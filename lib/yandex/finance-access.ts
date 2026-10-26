import {createClient} from '../supabase/server';
import {createAdminClient} from '../supabase/admin';
export async function financeAccess(){
 const session=await createClient();const {data:{user}}=await session.auth.getUser();
 if(!user)throw new Error('Требуется авторизация');
 const db=createAdminClient();const {data,error}=await db.from('app_user_access').select('admin_level,is_blocked').eq('user_id',user.id).maybeSingle();
 if(error||!data||data.is_blocked||!['admin','senior_admin'].includes(data.admin_level??''))throw new Error('Недостаточно прав для финансовой аналитики');return db;
}
