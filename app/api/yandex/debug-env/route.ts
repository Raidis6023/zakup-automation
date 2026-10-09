import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const raw =
    process.env.YANDEX_API_KEY ?? "";

  return NextResponse.json({
    exists: raw.length > 0,
    length: raw.length,
    trimmedLength: raw.trim().length,
    newlineCount: (
      raw.match(/\n/g) ?? []
    ).length,
    carriageReturnCount: (
      raw.match(/\r/g) ?? []
    ).length,
    lineCount:
      raw.length === 0
        ? 0
        : raw.split(/\r?\n/).length,
    startsCorrectly:
      raw.startsWith("ACMA:"),
  });
}
