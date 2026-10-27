import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const MAX_PAGE_SIZE = 200;
export const API_VERSION = "1.0";

export class ExportError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export function result(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    { ok: true, version: API_VERSION, ...data },
    { status, headers: HEADERS },
  );
}

export function failure(error: unknown) {
  if (error instanceof ExportError) {
    return NextResponse.json(
      { ok: false, version: API_VERSION, error: { code: error.code, message: error.message } },
      { status: error.status, headers: HEADERS },
    );
  }
  console.error("[1c-export] Internal export failure", error);
  return NextResponse.json(
    { ok: false, version: API_VERSION, error: { code: "INTERNAL_ERROR", message: "Не удалось получить данные" } },
    { status: 500, headers: HEADERS },
  );
}

export function authenticated(request: NextRequest, scope: string): NextResponse | null {
  const expected = process.env.ONE_C_API_KEY_SHA256?.trim().toLowerCase();
  if (!expected || !/^[0-9a-f]{64}$/.test(expected)) {
    return failure(new ExportError(503, "NOT_CONFIGURED", "Сервис обмена с 1С не настроен"));
  }
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{32,256})$/.exec(header);
  const supplied = match?.[1] ?? "";
  const actual = createHash("sha256").update(supplied).digest();
  const expectedBuffer = Buffer.from(expected, "hex");
  if (!match || !timingSafeEqual(actual, expectedBuffer)) {
    return failure(new ExportError(401, "UNAUTHORIZED", "Неверный ключ авторизации"));
  }
  const scopes = (process.env.ONE_C_API_SCOPES || "finance,sales,products,stocks")
    .split(",").map((value) => value.trim());
  if (scope !== "catalog" && !scopes.includes(scope)) {
    return failure(new ExportError(403, "FORBIDDEN", "У ключа нет разрешения на этот раздел"));
  }
  return null;
}

export function db() {
  return createAdminClient();
}

function integerParam(value: string | null, name: string, fallback: number, max: number) {
  if (value === null) return fallback;
  if (!/^\d{1,8}$/.test(value)) {
    throw new ExportError(400, "INVALID_PARAMETER", "Неверный параметр " + name);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) {
    throw new ExportError(400, "INVALID_PARAMETER", "Неверный параметр " + name);
  }
  return number;
}

export function pagination(request: NextRequest) {
  const limit = integerParam(request.nextUrl.searchParams.get("limit"), "limit", 100, MAX_PAGE_SIZE);
  if (limit < 1) throw new ExportError(400, "INVALID_PARAMETER", "limit должен быть больше нуля");
  const offset = integerParam(request.nextUrl.searchParams.get("offset"), "offset", 0, 9999999);
  return { limit, offset };
}

export function page<T>(rows: T[], offset: number, limit: number) {
  return {
    data: rows.slice(0, limit),
    pagination: {
      limit,
      offset,
      has_more: rows.length > limit,
      next_offset: rows.length > limit ? offset + limit : null,
    },
  };
}

export function validDate(value: string | null, name: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ExportError(400, "INVALID_DATE", "Укажите " + name + " в формате YYYY-MM-DD");
  }
  const date = new Date(value + "T00:00:00Z");
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new ExportError(400, "INVALID_DATE", "Некорректная дата " + name);
  }
  return value;
}

export function dateRange(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = validDate(params.get("from"), "from");
  const to = validDate(params.get("to"), "to");
  const days = (Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400000;
  if (days < 0 || days > 365) {
    throw new ExportError(400, "INVALID_DATE_RANGE", "Период должен составлять от 1 до 366 календарных дней");
  }
  return { from, to };
}

export function nextDate(date: string) {
  return new Date(Date.parse(date + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
}

export function requiredChoice<T extends string>(
  request: NextRequest, name: string, choices: readonly T[],
): T {
  const value = request.nextUrl.searchParams.get(name);
  if (!value || !choices.includes(value as T)) {
    throw new ExportError(400, "INVALID_PARAMETER", "Параметр " + name + " должен быть: " + choices.join(", "));
  }
  return value as T;
}

export async function checked<T>(
  query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error("Supabase query error: " + error.message);
  return data ?? [];
}

export async function checkedOne<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw new Error("Supabase query error: " + error.message);
  return data ?? null;
}
