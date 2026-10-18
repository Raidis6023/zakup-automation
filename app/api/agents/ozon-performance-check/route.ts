import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_HOST = "https://api-performance.ozon.ru";
const CLIENT_ID_NAME = "OZON_PERFORMANCE_CLIENT_ID";
const CLIENT_SECRET_NAME = "OZON_PERFORMANCE_CLIENT_SECRET";

// A cached access token is held only in a server process. It is never
// returned to the browser, logged, or stored in Supabase.
let tokenCache: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

type TokenReply = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
};
type Campaign = {
  id?: number | string;
  title?: string;
  state?: string;
  advObjectType?: string;
  paymentType?: string;
};
type CampaignReply = { list?: Campaign[] };

function noStore(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 250);
  return "Неизвестная ошибка подключения";
}

async function authorizedAdministrator() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return false;
  const db = createAdminClient();
  const { data, error: rightsError } = await db
    .from("app_user_access")
    .select("admin_level,is_blocked")
    .eq("user_id", user.id).maybeSingle();
  return !rightsError && !!data && !data.is_blocked &&
    ["admin", "senior_admin"].includes(data.admin_level || "");
}

async function getPerformanceToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) return tokenCache.value;
  if (tokenRequest) return tokenRequest;
  tokenRequest = (async () => {
    const clientId = process.env[CLIENT_ID_NAME]?.trim();
    const clientSecret = process.env[CLIENT_SECRET_NAME]?.trim();
    if (!clientId || !clientSecret) {
      throw new Error("Не найдены переменные Performance API. Добавьте Client ID и Client Secret в Vercel и обновите развёртывание.");
    }
    const response = await fetch(API_HOST + "/api/client/token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      throw new Error("Ozon отклонил авторизацию Performance API (HTTP " +
        response.status + "). Проверьте, что Client ID и Secret относятся к одному сервисному аккаунту.");
    }
    const reply = await response.json() as TokenReply;
    if (!reply.access_token || reply.token_type?.toLowerCase() !== "bearer") {
      throw new Error("Ozon вернул некорректный формат токена.");
    }
    const ttl = Math.min(30 * 60, Math.max(30, Number(reply.expires_in) || 300));
    tokenCache = {
      value: reply.access_token,
      expiresAt: Date.now() + Math.max(0, ttl - 90) * 1000,
    };
    return reply.access_token;
  })();
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function performanceGet<T>(path: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getPerformanceToken();
    const response = await fetch(API_HOST + path, {
      method: "GET",
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (response.status === 401 && attempt === 0) {
      tokenCache = null;
      continue;
    }
    if (!response.ok) {
      throw new Error(
        "Подключение к Ozon работает, но чтение кампаний вернуло HTTP " + response.status +
        ". Проверьте разрешения сервисного аккаунта."
      );
    }
    return await response.json() as T;
  }
  throw new Error("Не удалось прочитать список кампаний Ozon.");
}

export async function GET(_request: NextRequest) {
  if (!await authorizedAdministrator()) {
    return noStore({ ok: false, error: "Только администратор может проверять финансовые API" }, 403);
  }
  try {
    const campaigns = await performanceGet<CampaignReply>(
      "/api/client/campaign?page=1&pageSize=100"
    );
    if (!Array.isArray(campaigns.list)) {
      throw new Error("Ozon вернул неожиданную структуру списка кампаний. Токен получен, но ответ требует проверки.");
    }
    const sample = campaigns.list.slice(0, 10).map(row => ({
      id: row.id == null ? null : String(row.id),
      title: row.title ?? "Без названия",
      state: row.state ?? null,
      type: row.advObjectType ?? null,
    }));
    return noStore({
      ok: true,
      authorization: "success",
      campaigns_readable: true,
      first_page_count: campaigns.list.length,
      truncated: campaigns.list.length === 100,
      sample,
      info: "Только тест чтения. Расходы не импортировались и не прибавлялись к финансовым начислениям.",
    });
  } catch (error) {
    return noStore({ ok: false, error: safeError(error) }, 502);
  }
}
