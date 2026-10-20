import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashRegistrationToken, REGISTRATION_COOKIE, REGISTRATION_MAX_AGE } from "@/lib/registration/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ ok: false, error: "Неверный формат запроса" }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return NextResponse.json({ ok: false, error: "Слишком большой запрос" }, { status: 413 });
  }
  let input: Record<string, unknown>;
  try { input = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: "Некорректные данные" }, { status: 400 }); }
  const value = (key: string, max: number) =>
    typeof input[key] === "string" ? (input[key] as string).trim().slice(0, max + 1) : "";
  const admin = createAdminClient();
  const { data: requestId, error } = await admin.rpc("app_submit_access_request", {
    p_first_name: value("firstName", 100),
    p_last_name: value("lastName", 100),
    p_email: value("email", 254).toLowerCase(),
    p_department: value("department", 150) || null,
    p_comment: value("comment", 2000) || null,
  });
  if (error || typeof requestId !== "string") {
    const message = error?.message || "";
    const known = ["уже существует", "корректное имя", "корректную фамилию",
      "корректный email", "слишком длинное"].some(s => message.includes(s));
    return NextResponse.json({
      ok: false, error: known ? message : "Не удалось отправить заявку",
    }, { status: 400 });
  }
  const token = randomBytes(32).toString("base64url");
  const { error: sessionError } = await admin.from("app_registration_sessions").insert({
    request_id: requestId,
    token_hash: hashRegistrationToken(token),
    expires_at: new Date(Date.now() + REGISTRATION_MAX_AGE * 1000).toISOString(),
  });
  if (sessionError) {
    await admin.from("app_access_requests").delete().eq("id", requestId).eq("status", "pending");
    return NextResponse.json({ ok: false, error: "Не удалось запустить ожидание заявки" }, { status: 500 });
  }
  const response = NextResponse.json({ ok: true, status: "pending" }, {
    headers: { "Cache-Control": "no-store" },
  });
  response.cookies.set(REGISTRATION_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: REGISTRATION_MAX_AGE,
  });
  return response;
}
