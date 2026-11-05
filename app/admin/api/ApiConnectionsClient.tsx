"use client";

import { useCallback, useEffect, useState } from "react";

type Source = "vault" | "environment" | "mixed" | "partial" | null;
type ServiceStatus = { configured: boolean; source: Source; updatedAt: string | null };
type ServiceKey = "ozonSeller" | "ozonPerformance" | "wildberries" | "yandexMarket" | "mpstats";
type Service = "ozon-seller" | "ozon-performance" | "wildberries" | "yandex-market" | "mpstats";
type StatusMap = Record<ServiceKey, ServiceStatus>;

type FormValues = {
  ozonSellerClientId: string;
  ozonSellerApiKey: string;
  ozonPerformanceClientId: string;
  ozonPerformanceClientSecret: string;
  wbReadToken: string;
  wbFinanceToken: string;
  wbPromotionToken: string;
  wbSuppliesToken: string;
  yandexApiKey: string;
  yandexApiKeyFull: string;
  yandexCampaignId: string;
  mpstatsToken: string;
};

const EMPTY_STATUS: StatusMap = {
  ozonSeller: { configured: false, source: null, updatedAt: null },
  ozonPerformance: { configured: false, source: null, updatedAt: null },
  wildberries: { configured: false, source: null, updatedAt: null },
  yandexMarket: { configured: false, source: null, updatedAt: null },
  mpstats: { configured: false, source: null, updatedAt: null },
};

const EMPTY_VALUES: FormValues = {
  ozonSellerClientId: "",
  ozonSellerApiKey: "",
  ozonPerformanceClientId: "",
  ozonPerformanceClientSecret: "",
  wbReadToken: "",
  wbFinanceToken: "",
  wbPromotionToken: "",
  wbSuppliesToken: "",
  yandexApiKey: "",
  yandexApiKeyFull: "",
  yandexCampaignId: "",
  mpstatsToken: "",
};

function sourceLabel(source: Source) {
  switch (source) {
    case "vault": return "Хранится в защищённом хранилище";
    case "environment": return "Используется переменная Vercel";
    case "mixed": return "Часть значений в Vault, часть в Vercel";
    case "partial": return "Настроена только часть реквизитов";
    default: return "Ключи ещё не подключены";
  }
}

function statusLabel(status: ServiceStatus) {
  if (status.configured) return status.source === "vault" ? "Сохранено" : "Настроено";
  if (status.source === "partial") return "Частично";
  return "Не настроено";
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : "Обновлено " + date.toLocaleString("ru-RU");
}

function onlyEntered(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value.trim().length > 0),
  );
}

export default function ApiConnectionsClient() {
  const [services, setServices] = useState<StatusMap>(EMPTY_STATUS);
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState<ServiceKey | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ServiceKey, string>>>({});
  const [success, setSuccess] = useState<Partial<Record<ServiceKey, string>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/admin/integrations", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Не удалось загрузить состояние подключений");
      setServices(payload.services as StatusMap);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Не удалось загрузить состояние подключений");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateValue(field: keyof FormValues, value: string) {
    setValues(current => ({ ...current, [field]: value }));
    setErrors({});
    setSuccess({});
  }

  async function save(service: ServiceKey) {
    if (saving) return;

    let payload: { service: Service; values: Record<string, string> };
    if (service === "ozonSeller") {
      payload = {
        service: "ozon-seller",
        values: onlyEntered({ clientId: values.ozonSellerClientId, apiKey: values.ozonSellerApiKey }),
      };
    } else if (service === "ozonPerformance") {
      payload = {
        service: "ozon-performance",
        values: onlyEntered({ clientId: values.ozonPerformanceClientId, clientSecret: values.ozonPerformanceClientSecret }),
      };
    } else if (service === "wildberries") {
      payload = {
        service: "wildberries",
        values: onlyEntered({
          readToken: values.wbReadToken,
          financeToken: values.wbFinanceToken,
          promotionToken: values.wbPromotionToken,
          suppliesToken: values.wbSuppliesToken,
        }),
      };
    } else if (service === "yandexMarket") {
      payload = {
        service: "yandex-market",
        values: onlyEntered({
          apiKey: values.yandexApiKey,
          apiKeyFull: values.yandexApiKeyFull,
          campaignId: values.yandexCampaignId,
        }),
      };
    } else {
      payload = { service: "mpstats", values: onlyEntered({ apiKey: values.mpstatsToken }) };
    }

    if (Object.keys(payload.values).length === 0) {
      setErrors(current => ({ ...current, [service]: "Введите хотя бы одно новое значение." }));
      return;
    }

    setSaving(service);
    setErrors(current => ({ ...current, [service]: undefined }));
    setSuccess(current => ({ ...current, [service]: undefined }));

    try {
      const response = await fetch("/api/admin/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Не удалось сохранить ключи");

      const clearFields: Partial<FormValues> =
        service === "ozonSeller" ? { ozonSellerClientId: "", ozonSellerApiKey: "" } :
        service === "ozonPerformance" ? { ozonPerformanceClientId: "", ozonPerformanceClientSecret: "" } :
        service === "wildberries" ? { wbReadToken: "", wbFinanceToken: "", wbPromotionToken: "", wbSuppliesToken: "" } :
        service === "yandexMarket" ? { yandexApiKey: "", yandexApiKeyFull: "", yandexCampaignId: "" } :
        { mpstatsToken: "" };

      setValues(current => ({ ...current, ...clearFields }));
      setSuccess(current => ({ ...current, [service]: "Сохранено в Supabase Vault. Новые запросы будут использовать обновлённые реквизиты." }));
      await load();
    } catch (error) {
      setErrors(current => ({
        ...current,
        [service]: error instanceof Error ? error.message : "Не удалось сохранить ключи",
      }));
    } finally {
      setSaving(null);
    }
  }

  function statusCard(status: ServiceStatus) {
    return (
      <div className="api-settings-status-wrap">
        <span className={`api-settings-status ${status.configured ? "is-ready" : status.source === "partial" ? "is-partial" : "is-empty"}`}>
          <span className="api-settings-status-dot" />
          {statusLabel(status)}
        </span>
        <span className="api-settings-status-detail">{loading ? "Проверяем..." : sourceLabel(status.source)}</span>
        {status.updatedAt && <span className="api-settings-updated">{formatUpdatedAt(status.updatedAt)}</span>}
      </div>
    );
  }

  return (
    <section className="api-settings-root">
      <div className="api-settings-intro">
        <div>
          <strong>Подключения внешних сервисов</strong>
          <p>Секреты хранятся на сервере в Supabase Vault. После сохранения значения не возвращаются в браузер. Пустые поля не изменяют уже сохранённые ключи.</p>
        </div>
        <span className="api-settings-security">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V7a6 6 0 0 1 12 0v3" /><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M12 14v3" /></svg>
          Защищённое хранение
        </span>
      </div>

      {loadError && <div className="api-settings-error api-settings-load-error" role="alert">{loadError}</div>}

      <div className="api-settings-grid">
        <article className="api-settings-card">
          <div className="api-settings-card-head">
            <div className="api-settings-service">
              <span className="api-settings-service-icon">O</span>
              <div><h2>Ozon Seller</h2><p>Товары, поставки, складские и финансовые данные</p></div>
            </div>
            {statusCard(services.ozonSeller)}
          </div>
          <div className="api-settings-fields">
            <label className="api-settings-field"><span>Client ID</span><input value={values.ozonSellerClientId} onChange={event => updateValue("ozonSellerClientId", event.target.value)} autoComplete="off" placeholder="Введите Client ID" /></label>
            <label className="api-settings-field"><span>API-ключ</span><input type="password" value={values.ozonSellerApiKey} onChange={event => updateValue("ozonSellerApiKey", event.target.value)} autoComplete="new-password" placeholder="Вставьте ключ Ozon Seller" /></label>
          </div>
          <div className="api-settings-card-note">Укажите оба значения, если подключаете или заменяете реквизиты. До сохранения используются действующие ключи.</div>
          {errors.ozonSeller && <div className="api-settings-error" role="alert">{errors.ozonSeller}</div>}
          {success.ozonSeller && <div className="api-settings-success" role="status">{success.ozonSeller}</div>}
          <div className="api-settings-card-footer"><span>Ключи Ozon Seller</span><button type="button" onClick={() => void save("ozonSeller")} disabled={saving !== null || !values.ozonSellerClientId.trim() || !values.ozonSellerApiKey.trim()}>{saving === "ozonSeller" ? "Сохраняем..." : "Сохранить"}</button></div>
        </article>

        <article className="api-settings-card">
          <div className="api-settings-card-head">
            <div className="api-settings-service">
              <span className="api-settings-service-icon api-settings-service-icon--ozon-performance">O</span>
              <div><h2>Ozon Performance</h2><p>Рекламная статистика и расходы по кампаниям</p></div>
            </div>
            {statusCard(services.ozonPerformance)}
          </div>
          <div className="api-settings-fields">
            <label className="api-settings-field"><span>Client ID</span><input value={values.ozonPerformanceClientId} onChange={event => updateValue("ozonPerformanceClientId", event.target.value)} autoComplete="off" placeholder="Введите Client ID" /></label>
            <label className="api-settings-field"><span>Client Secret</span><input type="password" value={values.ozonPerformanceClientSecret} onChange={event => updateValue("ozonPerformanceClientSecret", event.target.value)} autoComplete="new-password" placeholder="Вставьте Client Secret" /></label>
          </div>
          <div className="api-settings-card-note">Для подключения или замены укажите оба значения. Пустые поля не перезаписывают уже сохранённые реквизиты.</div>
          {errors.ozonPerformance && <div className="api-settings-error" role="alert">{errors.ozonPerformance}</div>}
          {success.ozonPerformance && <div className="api-settings-success" role="status">{success.ozonPerformance}</div>}
          <div className="api-settings-card-footer"><span>Ключи Ozon Performance</span><button type="button" onClick={() => void save("ozonPerformance")} disabled={saving !== null || !values.ozonPerformanceClientId.trim() || !values.ozonPerformanceClientSecret.trim()}>{saving === "ozonPerformance" ? "Сохраняем..." : "Сохранить"}</button></div>
        </article>

        <article className="api-settings-card api-settings-card--wide">
          <div className="api-settings-card-head">
            <div className="api-settings-service">
              <span className="api-settings-service-icon api-settings-service-icon--wb">WB</span>
              <div><h2>Wildberries</h2><p>Отдельные токены для чтения, финансов, рекламы и поставок</p></div>
            </div>
            {statusCard(services.wildberries)}
          </div>
          <div className="api-settings-fields">
            <label className="api-settings-field"><span>Основной токен чтения</span><input type="password" value={values.wbReadToken} onChange={event => updateValue("wbReadToken", event.target.value)} autoComplete="new-password" placeholder="WB_READ_TOKEN" /></label>
            <label className="api-settings-field"><span>Токен финансов</span><input type="password" value={values.wbFinanceToken} onChange={event => updateValue("wbFinanceToken", event.target.value)} autoComplete="new-password" placeholder="WB_FINANCE_TOKEN" /></label>
            <label className="api-settings-field"><span>Токен продвижения и рекламы</span><input type="password" value={values.wbPromotionToken} onChange={event => updateValue("wbPromotionToken", event.target.value)} autoComplete="new-password" placeholder="WB_PROMOTION_TOKEN" /></label>
            <label className="api-settings-field"><span>Токен поставок с правом записи</span><input type="password" value={values.wbSuppliesToken} onChange={event => updateValue("wbSuppliesToken", event.target.value)} autoComplete="new-password" placeholder="WB_SUPPLIES_API_TOKEN" /></label>
          </div>
          <div className="api-settings-card-note">Токен чтения не заменяет токен поставок с правом записи. Можно сохранять отдельные поля по мере необходимости.</div>
          {errors.wildberries && <div className="api-settings-error" role="alert">{errors.wildberries}</div>}
          {success.wildberries && <div className="api-settings-success" role="status">{success.wildberries}</div>}
          <div className="api-settings-card-footer"><span>Пустые поля не изменяют сохранённые токены.</span><button type="button" onClick={() => void save("wildberries")} disabled={saving !== null || ![values.wbReadToken, values.wbFinanceToken, values.wbPromotionToken, values.wbSuppliesToken].some(value => value.trim())}>{saving === "wildberries" ? "Сохраняем..." : "Сохранить токены"}</button></div>
        </article>

        <article className="api-settings-card api-settings-card--wide">
          <div className="api-settings-card-head">
            <div className="api-settings-service">
              <span className="api-settings-service-icon api-settings-service-icon--yandex">Я</span>
              <div><h2>Яндекс Маркет</h2><p>Партнёрский доступ и финансовые отчёты</p></div>
            </div>
            {statusCard(services.yandexMarket)}
          </div>
          <div className="api-settings-fields">
            <label className="api-settings-field"><span>Основной API-ключ партнёра</span><input type="password" value={values.yandexApiKey} onChange={event => updateValue("yandexApiKey", event.target.value)} autoComplete="new-password" placeholder="YANDEX_API_KEY" /></label>
            <label className="api-settings-field"><span>API-ключ полного доступа (финансы)</span><input type="password" value={values.yandexApiKeyFull} onChange={event => updateValue("yandexApiKeyFull", event.target.value)} autoComplete="new-password" placeholder="YANDEX_API_KEY_FULL" /></label>
            <label className="api-settings-field"><span>ID кампании / бизнеса</span><input inputMode="numeric" value={values.yandexCampaignId} onChange={event => updateValue("yandexCampaignId", event.target.value.replace(/\D/g, ""))} autoComplete="off" placeholder="Числовой ID" /></label>
          </div>
          <div className="api-settings-card-note">Основной ключ используется для товаров, заказов, остатков и возвратов. Ключ полного доступа нужен для финансовых отчётов. ID используется для получения Business ID.</div>
          {errors.yandexMarket && <div className="api-settings-error" role="alert">{errors.yandexMarket}</div>}
          {success.yandexMarket && <div className="api-settings-success" role="status">{success.yandexMarket}</div>}
          <div className="api-settings-card-footer"><span>Поля можно сохранять по отдельности.</span><button type="button" onClick={() => void save("yandexMarket")} disabled={saving !== null || ![values.yandexApiKey, values.yandexApiKeyFull, values.yandexCampaignId].some(value => value.trim())}>{saving === "yandexMarket" ? "Сохраняем..." : "Сохранить настройки"}</button></div>
        </article>

        <article className="api-settings-card api-settings-card--mpstats">
          <div className="api-settings-card-head">
            <div className="api-settings-service">
              <span className="api-settings-service-icon api-settings-service-icon--mpstats">M</span>
              <div><h2>MPStats</h2><p>Данные Wildberries для расчёта юнит-экономики</p></div>
            </div>
            {statusCard(services.mpstats)}
          </div>
          <div className="api-settings-fields api-settings-fields--single">
            <label className="api-settings-field"><span>API-ключ MPStats</span><input type="password" value={values.mpstatsToken} onChange={event => updateValue("mpstatsToken", event.target.value)} autoComplete="new-password" placeholder="Вставьте персональный API-токен MPStats" /></label>
          </div>
          <div className="api-settings-card-note">Ключ используется сервером юнит-экономики WB после подтверждения категории. Он не передаётся в браузер и не показывается после сохранения.</div>
          {errors.mpstats && <div className="api-settings-error" role="alert">{errors.mpstats}</div>}
          {success.mpstats && <div className="api-settings-success" role="status">{success.mpstats}</div>}
          <div className="api-settings-card-footer"><span>Отдельная переменная Vercel не нужна.</span><button type="button" onClick={() => void save("mpstats")} disabled={saving !== null || !values.mpstatsToken.trim()}>{saving === "mpstats" ? "Сохраняем..." : "Сохранить ключ"}</button></div>
        </article>
      </div>
    </section>
  );
}
