import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  getIntegrationStatuses,
  invalidateIntegrationSecretsCache,
} from "../../../../lib/integrations/secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

type Service = "ozon-seller" | "ozon-performance" | "mpstats";

async function requireAdmin() {
  const session = await createClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) return { error: "Требуется вход", status: 401 } as const;

  const { data, error } = await session.rpc("app_get_my_profile");
  const profile = Array.isArray(data) ? data[0] : data;
  if (error || !profile?.has_admin_access) {
    return { error: "Управлять ключами могут только администраторы", status: 403 } as const;
  }

  return { admin: createAdminClient() } as const;
}

function clean(value: unknown, min: number, max: number, label: string) {
  const result = typeof value === "string" ? value.trim() : "";
  if (result.length < min || result.length > max) throw new Error(label);
  return result;
}

export async function GET() {
  const access = await requireAdmin();
  if ("error" in access) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers });
  }

  const services = await getIntegrationStatuses();
  return NextResponse.json({ ok: true, services }, { headers });
}

export async function POST(request: NextRequest) {
  const access = await requireAdmin();
  if ("error" in access) {
    return NextResponse.json({ ok: false, error: access.error }, { status: access.status, headers });
  }

  const body = await request.json().catch(() => null) as {
    service?: Service;
    values?: Record<string, unknown>;
  } | null;
  if (!body?.service || !body.values || typeof body.values !== "object") {
    return NextResponse.json({ ok: false, error: "Некорректные данные подключения" }, { status: 400, headers });
  }

  let secrets: Record<string, string>;
  try {
    switch (body.service) {
      case "ozon-seller":
        secrets = {
          ozon_seller_client_id: clean(body.values.clientId, 1, 128, "Проверьте Client ID Ozon Seller"),
          ozon_seller_api_key: clean(body.values.apiKey, 20, 512, "Проверьте API-ключ Ozon Seller"),
        };
        break;
      case "ozon-performance":
        secrets = {
          ozon_performance_client_id: clean(body.values.clientId, 1, 256, "Проверьте Client ID Ozon Performance"),
          ozon_performance_client_secret: clean(body.values.clientSecret, 20, 512, "Проверьте Client Secret Ozon Performance"),
        };
        break;
      case "mpstats":
        secrets = {
          mpstats_token: clean(body.values.apiKey, 20, 512, "Проверьте API-ключ MPStats"),
        };
        break;
      default:
        return NextResponse.json({ ok: false, error: "Неизвестный сервис" }, { status: 400, headers });
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Проверьте введённые значения" },
      { status: 400, headers },
    );
  }

  const { error } = await access.admin.rpc("workspace_upsert_integration_secrets", {
    p_secrets: secrets,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: "Не удалось сохранить ключи в защищённом хранилище: " + error.message },
      { status: 500, headers },
    );
  }

  invalidateIntegrationSecretsCache();
  return NextResponse.json({ ok: true, service: body.service }, { headers });
}
