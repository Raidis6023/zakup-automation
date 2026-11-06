import { createClient as createSessionClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export class VedAccessError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "VedAccessError";
  }
}

/** Verified session and non-user-editable server-side role. */
export async function requireVedAccess(write = false) {
  const session = await createSessionClient();
  const { data: { claims }, error: authError } = await session.auth.getClaims();
  const user = !authError && claims?.sub ? { id: claims.sub } : null;
  if (authError || !user) throw new VedAccessError(401, "Требуется вход в WorkSpace");
  const admin = createAdminClient();
  const { data: access, error } = await admin.from("app_user_access")
    .select("admin_level,system_role,is_blocked")
    .eq("user_id", user.id).maybeSingle();
  if (error || !access || access.is_blocked) throw new VedAccessError(403, "Нет доступа к разделу ВЭД");
  const isAdmin = ["admin", "senior_admin"].includes(access.admin_level);
  const role = access.system_role ?? "";
  const canView = isAdmin || ["ved", "head", "manager"].includes(role);
  const canEdit = isAdmin || role === "ved";
  if (!canView || (write && !canEdit)) {
    throw new VedAccessError(403, "Недостаточно полномочий для справочников и расчётов ВЭД");
  }
  return { user, admin, canEdit };
}
