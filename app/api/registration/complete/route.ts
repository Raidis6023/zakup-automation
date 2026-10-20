import { NextRequest, NextResponse } from "next/server";
import { readRegistrationSession } from "@/lib/registration/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "Неверный формат запроса" }, { status: 415 });
  }
  let input: unknown;
  try { input = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 }); }
  const password = typeof input === "object" && input !== null && "password" in input
    ? (input as { password: unknown }).password : null;
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    return NextResponse.json({ ok: false, error: "Пароль должен содержать от 10 до 128 символов" }, { status: 400 });
  }
  const session = await readRegistrationSession();
  if (!session || session.request.status !== "approved" || session.request.approved_user_id) {
    return NextResponse.json({ ok: false, error: "Подтверждение ещё не получено или срок ожидания истёк" }, { status: 403 });
  }
  const { admin, request: applicant, requestId, tokenHash } = session;
  const email = String(applicant.email).trim().toLowerCase();
  const { data, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name: applicant.first_name, last_name: applicant.last_name },
  });
  if (createError || !data.user) {
    return NextResponse.json({ ok: false, error: "Не удалось создать учётную запись. Обратитесь к Администратору" }, { status: 409 });
  }
  const { error: finalizeError } = await admin.rpc("app_finalize_self_registration", {
    p_request_id: requestId,
    p_created_user_id: data.user.id,
    p_token_hash: tokenHash,
  });
  if (finalizeError) {
    const { error: rollbackError } = await admin.auth.admin.deleteUser(data.user.id);
    if (rollbackError) console.error("Registration rollback requires administrator attention");
    return NextResponse.json({ ok: false, error: "Не удалось завершить регистрацию. Обратитесь к Администратору" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, email }, { headers: { "Cache-Control": "no-store" } });
}
