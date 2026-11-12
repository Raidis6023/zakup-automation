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

type Service = "ozon-seller" | "ozon-performance" | "wildberries" | "yandex-market" | "mpstats";

async function requireAdmin() {
  const session = await createClient();
  const { data: { user }, error: userError } = await session.auth.getUser();
  if (userError || !user) return { error: "Требуется вход", status: 401 } as const;

  const { data, error } = await session.rpc("app_get_my_profile");
  const profile = Array.isArray(data) ? data[0] : data;
  if (error || !profile?.has_admin_access) {
    return { error: "Управлять ключами могут только администраторы", status: 403 } as const;
  }

  return { admin: createAdminClient(), actorId: user.id } as const;
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
      case "wildberries": {
        const optional = (value: unknown, label: string) => {
          const text = typeof value === "string" ? value.trim() : "";
          if (!text) return null;
          if (text.length < 20 || text.length > 8192) throw new Error(label);
          return text;
        };
        secrets = {};
        const readToken = optional(body.values.readToken, "Проверьте основной токен Wildberries");
        const financeToken = optional(body.values.financeToken, "Проверьте финансовый токен Wildberries");
        const promotionToken = optional(body.values.promotionToken, "Проверьте токен продвижения Wildberries");
        const suppliesToken = optional(body.values.suppliesToken, "Проверьте токен поставок Wildberries");
        if (readToken) secrets.wb_read_token = readToken;
        if (financeToken) secrets.wb_finance_token = financeToken;
        if (promotionToken) secrets.wb_promotion_token = promotionToken;
        if (suppliesToken) secrets.wb_supplies_api_token = suppliesToken;
        if (Object.keys(secrets).length === 0) throw new Error("Введите хотя бы один токен Wildberries");
        break;
      }
      case "yandex-market": {
        const optional = (value: unknown, min: number, max: number, label: string) => {
          const text = typeof value === "string" ? value.trim() : "";
          if (!text) return null;
          if (text.length < min || text.length > max) throw new Error(label);
          return text;
        };
        secrets = {};
        const apiKey = optional(body.values.apiKey, 20, 512, "Проверьте основной ключ Яндекс Маркета");
        const apiKeyFull = optional(body.values.apiKeyFull, 20, 512, "Проверьте ключ полного доступа Яндекс Маркета");
        const campaignId = optional(body.values.campaignId, 1, 32, "Проверьте ID кампании Яндекс Маркета");
        if (campaignId && !/^\\d+$/.test(campaignId)) throw new Error("ID кампании Яндекс Маркета должен состоять из цифр");
        if (apiKey) secrets.yandex_api_key = apiKey;
        if (apiKeyFull) secrets.yandex_api_key_full = apiKeyFull;
        if (campaignId) secrets.yandex_campaign_id = campaignId;
        if (Object.keys(secrets).length === 0) throw new Error("Введите хотя бы один параметр Яндекс Маркета");
        break;
      }
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

  if (Object.keys(secrets).length === 0) {
    return NextResponse.json({ ok: false, error: "Не указаны значения для сохранения" }, { status: 400, headers });
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

  // Only service and names of changed settings are recorded. Never log secret values.
  const { error: auditError } = await access.admin.from("app_audit_events").insert({
    module: "admin",
    action: "integration_settings_updated",
    actor_id: access.actorId,
    object_type: "integration",
    object_id: body.service,
    title: "Обновлены настройки подключения",
    details: { changed_fields: Object.keys(secrets) },
  });
  if (auditError) {
    // The credentials are already saved: avoid suggesting a second submission.
    console.error("Failed to record integration audit event:", auditError.message);
  }
  invalidateIntegrationSecretsCache();
  return NextResponse.json({ ok: true, service: body.service }, { headers });
}
