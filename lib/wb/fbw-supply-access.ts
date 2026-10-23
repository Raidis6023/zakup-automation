import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Only approved site administrators may trigger external WB supply changes. */
export async function requireFbwSupplyUser(): Promise<string> {
  const auth = await createClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) throw new Error("Требуется авторизация в КПК МИА");
  const db = createAdminClient();
  const { data, error } = await db.from("app_user_access")
    .select("admin_level,is_blocked").eq("user_id",user.id).maybeSingle();
  if (error || !data || data.is_blocked || !["admin","senior_admin"].includes(String(data.admin_level || ""))) {
    throw new Error("Для создания поставок требуются права администратора");
  }
  return user.id;
}
