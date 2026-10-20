import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export const REGISTRATION_COOKIE = "workspace_registration";
export const REGISTRATION_MAX_AGE = 30 * 24 * 60 * 60;

export function hashRegistrationToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function readRegistrationSession() {
  const token = (await cookies()).get(REGISTRATION_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const admin = createAdminClient();
  const tokenHash = hashRegistrationToken(token);
  const { data: session, error } = await admin.from("app_registration_sessions")
    .select("request_id,expires_at,consumed_at")
    .eq("token_hash", tokenHash)
    .gt("expires_at", new Date().toISOString())
    .is("consumed_at", null)
    .maybeSingle();
  if (error || !session) return null;
  const { data: request } = await admin.from("app_access_requests")
    .select("id,status,email,first_name,last_name,assigned_system_role,assigned_category_marketplace,approved_user_id")
    .eq("id", session.request_id).maybeSingle();
  if (!request) return null;
  return { admin, request, requestId: session.request_id as string, tokenHash };
}
