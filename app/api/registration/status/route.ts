import { NextResponse } from "next/server";
import { readRegistrationSession } from "@/lib/registration/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await readRegistrationSession();
  if (!session) return NextResponse.json({ ok: false, status: "expired" }, {
    status: 401, headers: { "Cache-Control": "no-store" },
  });
  const { request } = session;
  const status = request.approved_user_id ? "completed" : request.status;
  return NextResponse.json({ ok: true, status }, {
    headers: { "Cache-Control": "no-store" },
  });
}
