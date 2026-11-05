import "server-only";

import { createAdminClient } from "../supabase/admin";

export type SecretName =
  | "ozon_seller_client_id"
  | "ozon_seller_api_key"
  | "ozon_performance_client_id"
  | "ozon_performance_client_secret"
  | "wb_read_token"
  | "wb_finance_token"
  | "wb_promotion_token"
  | "wb_supplies_api_token"
  | "yandex_api_key"
  | "yandex_api_key_full"
  | "yandex_campaign_id"
  | "mpstats_token";

type VaultRow = {
  name: string;
  secret_value: string | null;
  updated_at: string | null;
};

type VaultCache = {
  expiresAt: number;
  values: Map<SecretName, string>;
  updatedAt: Map<SecretName, string>;
};

type CredentialSource = "vault" | "environment" | "mixed" | "partial" | null;

let vaultCache: VaultCache | null = null;

const SECRET_NAMES: SecretName[] = [
  "ozon_seller_client_id",
  "ozon_seller_api_key",
  "ozon_performance_client_id",
  "ozon_performance_client_secret",
  "wb_read_token",
  "wb_finance_token",
  "wb_promotion_token",
  "wb_supplies_api_token",
  "yandex_api_key",
  "yandex_api_key_full",
  "yandex_campaign_id",
  "mpstats_token",
];

const ENVIRONMENT_NAMES: Record<SecretName, string> = {
  ozon_seller_client_id: "OZON_CLIENT_ID",
  ozon_seller_api_key: "OZON_API_KEY",
  ozon_performance_client_id: "OZON_PERFORMANCE_CLIENT_ID",
  ozon_performance_client_secret: "OZON_PERFORMANCE_CLIENT_SECRET",
  wb_read_token: "WB_READ_TOKEN",
  wb_finance_token: "WB_FINANCE_TOKEN",
  wb_promotion_token: "WB_PROMOTION_TOKEN",
  wb_supplies_api_token: "WB_SUPPLIES_API_TOKEN",
  yandex_api_key: "YANDEX_API_KEY",
  yandex_api_key_full: "YANDEX_API_KEY_FULL",
  yandex_campaign_id: "YANDEX_CAMPAIGN_ID",
  mpstats_token: "MPSTATS_TOKEN",
};

async function readVault(force = false): Promise<VaultCache> {
  if (!force && vaultCache && vaultCache.expiresAt > Date.now()) return vaultCache;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("workspace_get_integration_secrets", {
      p_names: SECRET_NAMES,
    });
    if (error) throw error;

    const values = new Map<SecretName, string>();
    const updatedAt = new Map<SecretName, string>();
    for (const row of (Array.isArray(data) ? data : []) as VaultRow[]) {
      if (!SECRET_NAMES.includes(row.name as SecretName)) continue;
      const name = row.name as SecretName;
      if (typeof row.secret_value === "string" && row.secret_value.trim()) {
        values.set(name, row.secret_value.trim());
      }
      if (typeof row.updated_at === "string" && row.updated_at) {
        updatedAt.set(name, row.updated_at);
      }
    }

    vaultCache = { expiresAt: Date.now() + 5000, values, updatedAt };
    return vaultCache;
  } catch (error) {
    console.error(
      "[integrations] Не удалось прочитать Supabase Vault:",
      error instanceof Error ? error.message : "unknown error",
    );
    return vaultCache ?? { expiresAt: Date.now(), values: new Map(), updatedAt: new Map() };
  }
}

export function invalidateIntegrationSecretsCache() {
  vaultCache = null;
}

type ResolvedSecret = {
  value: string;
  source: "vault" | "environment" | null;
  updatedAt: string | null;
};

function resolveSecret(
  cache: VaultCache,
  vaultName: SecretName,
  environmentName: string,
): ResolvedSecret {
  const stored = cache.values.get(vaultName);
  if (stored) {
    return {
      value: stored,
      source: "vault",
      updatedAt: cache.updatedAt.get(vaultName) ?? null,
    };
  }

  const environmentValue = process.env[environmentName]?.trim();
  if (environmentValue) {
    return { value: environmentValue, source: "environment", updatedAt: null };
  }

  return { value: "", source: null, updatedAt: null };
}

function serviceStatus(items: ResolvedSecret[]) {
  const configuredCount = items.filter(item => Boolean(item.value)).length;
  const configured = configuredCount === items.length;
  const sources = new Set(items.filter(item => item.value).map(item => item.source));
  let source: CredentialSource = null;

  if (configured) {
    source = sources.size > 1 ? "mixed" : (items[0].source ?? null);
  } else if (configuredCount > 0) {
    source = "partial";
  }

  const updatedAt = items
    .map(item => item.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return { configured, source, updatedAt };
}

export async function getIntegrationSecret(name: SecretName): Promise<string | null> {
  const cache = await readVault();
  const resolved = resolveSecret(cache, name, ENVIRONMENT_NAMES[name]);
  return resolved.value || null;
}

export async function getOzonCredentials() {
  const cache = await readVault();
  return {
    sellerClientId: resolveSecret(cache, "ozon_seller_client_id", "OZON_CLIENT_ID").value,
    sellerApiKey: resolveSecret(cache, "ozon_seller_api_key", "OZON_API_KEY").value,
    performanceClientId: resolveSecret(cache, "ozon_performance_client_id", "OZON_PERFORMANCE_CLIENT_ID").value,
    performanceClientSecret: resolveSecret(cache, "ozon_performance_client_secret", "OZON_PERFORMANCE_CLIENT_SECRET").value,
  };
}

export async function getMpStatsToken(): Promise<string | null> {
  return getIntegrationSecret("mpstats_token");
}

export async function getIntegrationStatuses() {
  const cache = await readVault();

  const sellerClientId = resolveSecret(cache, "ozon_seller_client_id", "OZON_CLIENT_ID");
  const sellerApiKey = resolveSecret(cache, "ozon_seller_api_key", "OZON_API_KEY");
  const performanceClientId = resolveSecret(cache, "ozon_performance_client_id", "OZON_PERFORMANCE_CLIENT_ID");
  const performanceClientSecret = resolveSecret(cache, "ozon_performance_client_secret", "OZON_PERFORMANCE_CLIENT_SECRET");
  const wbReadToken = resolveSecret(cache, "wb_read_token", "WB_READ_TOKEN");
  const wbFinanceToken = resolveSecret(cache, "wb_finance_token", "WB_FINANCE_TOKEN");
  const wbPromotionToken = resolveSecret(cache, "wb_promotion_token", "WB_PROMOTION_TOKEN");
  const wbSuppliesToken = resolveSecret(cache, "wb_supplies_api_token", "WB_SUPPLIES_API_TOKEN");
  const yandexApiKey = resolveSecret(cache, "yandex_api_key", "YANDEX_API_KEY");
  const yandexFullApiKey = resolveSecret(cache, "yandex_api_key_full", "YANDEX_API_KEY_FULL");
  const yandexCampaignId = resolveSecret(cache, "yandex_campaign_id", "YANDEX_CAMPAIGN_ID");
  const mpstatsToken = resolveSecret(cache, "mpstats_token", "MPSTATS_TOKEN");

  return {
    ozonSeller: serviceStatus([sellerClientId, sellerApiKey]),
    ozonPerformance: serviceStatus([performanceClientId, performanceClientSecret]),
    wildberries: serviceStatus([wbReadToken, wbFinanceToken, wbPromotionToken, wbSuppliesToken]),
    yandexMarket: serviceStatus([yandexApiKey, yandexFullApiKey, yandexCampaignId]),
    mpstats: serviceStatus([mpstatsToken]),
  };
}
