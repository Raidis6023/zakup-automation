"use client";

import { useCallback, useEffect, useState } from "react";

type Source = "vault" | "environment" | "mixed" | "partial" | null;
type ServiceStatus = { configured: boolean; source: Source; updatedAt: string | null };
type ServiceKey = "ozonSeller" | "ozonPerformance" | "mpstats";
type Service = "ozon-seller" | "ozon-performance" | "mpstats";
type StatusMap = Record<ServiceKey, ServiceStatus>;

type FormValues = {
  ozonSellerClientId: string;
  ozonSellerApiKey: string;
  ozonPerformanceClientId: string;
  ozonPerformanceClientSecret: string;
  mpstatsToken: string;
};

const EMPTY_STATUS: StatusMap = {
  ozonSeller: { configured: false, source: null, updatedAt: null },
  ozonPerformance: { configured: false, source: null, updatedAt: null },
  mpstats: { configured: false, source: null, updatedAt: null },
};

const EMPTY_VALUES: FormValues = {
  ozonSellerClientId: "",
  ozonSellerApiKey: "",
  ozonPerformanceClientId: "",
  ozonPerformanceClientSecret: "",
  mpstatsToken: "",
};

function sourceLabel(source: Source) {
  switch (source) {
    case "vault": return "Ключи хранятся в защищённом хранилище";
    case "environment": return "Сейчас используются переменные Vercel";
    case "mixed": return "Часть ключей хранится в Vault, часть — в Vercel";
    case "partial": return "Настроена только часть реквизитов";
    default: return "Ключи ещё не подключены";
  }
}

function statusLabel(status: ServiceStatus) {
  if (status.configured) return status.source === "vault" ? "Сохранено" : "Подключено";
  if (status.source === "partial") return "Частично";
  return "Не подключено";
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : "Обновлено " + date.toLocaleString("ru-RU");
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
    setErrors(current => ({ ...current, ozonSeller: undefined, ozonPerformance: undefined, mpstats: undefined }));
    setSuccess({});
  }

  async function save(service: ServiceKey) {
    if (saving) return;

    let payload: { service: Service; values: Record<string, string> };
    if (service === "ozonSeller") {
      payload = {
        service: "ozon-seller",
        values: { clientId: values.ozonSellerClientId, apiKey: values.ozonSellerApiKey },
      };
    } else if (service === "ozonPerformance") {
      payload = {
        service: "ozon-performance",
        values: { clientId: values.ozonPerformanceClientId, clientSecret: values.ozonPerformanceClientSecret },
      };
    } else {
      payload = { service: "mpstats", values: { apiKey: values.mpstatsToken } };
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

      setValues(current => ({
        ...current,
        ...(service === "ozonSeller" ? { ozonSellerClientId: "", ozonSellerApiKey: "" } : {}),
        ...(service === "ozonPerformance" ? { ozonPerformanceClientId: "", ozonPerformanceClientSecret: "" } : {}),
        ...(service === "mpstats" ? { mpstatsToken: "" } : {}),
      }));
      setSuccess(current => ({ ...current, [service]: "Ключи сохранены. Сервер уже использует новые значения." }));
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
          <p>Ключи сохраняются на сервере в Supabase Vault. После сохранения секреты не возвращаются в браузер.</p>
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
              <span className="api-settings-service-icon api-settings-service-icon--ozon">O</span>
              <div><h2>Ozon Seller API</h2><p>Товары, поставки, финансы и складские данные</p></div>
            </div>
            {statusCard(services.ozonSeller)}
          </div>
          <div className="api-settings-fields">
            <label className="api-settings-field"><span>Client ID</span><input value={values.ozonSellerClientId} onChange={event => updateValue("ozonSellerClientId", event.target.value)} autoComplete="off" placeholder="Введите Client ID" /></label>
            <label className="api-settings-field"><span>API-ключ</span><input type="password" value={values.ozonSellerApiKey} onChange={event => updateValue("ozonSellerApiKey", event.target.value)} autoComplete="new-password" placeholder="Вставьте API-ключ Ozon Seller" /></label>
          </div>
          <div className="api-settings-card-note">Для замены укажите оба значения. Если ключи здесь не сохранены, продолжают использоваться текущие переменные Vercel.</div>
          {errors.ozonSeller && <div className="api-settings-error" role="alert">{errors.ozonSeller}</div>}
          {success.ozonSeller && <div className="api-settings-success" role="status">{success.ozonSeller}</div>}
          <div className="api-settings-card-footer"><span>Ключи применяются к новым запросам Ozon Seller.</span><button type="button" onClick={() => void save("ozonSeller")} disabled={saving !== null || !values.ozonSellerClientId.trim() || !values.ozonSellerApiKey.trim()}>{saving === "ozonSeller" ? "Сохраняем..." : "Сохранить ключи"}</button></div>
        </article>

        <article className="api-settings-card">
          <div className="api-settings-card-head">
            <div className="api-settings-service">
              <span className="api-settings-service-icon api-settings-service-icon--ozon-performance">O</span>
              <div><h2>Ozon Performance API</h2><p>Рекламная статистика и расходы по кампаниям</p></div>
            </div>
            {statusCard(services.ozonPerformance)}
          </div>
          <div className="api-settings-fields">
            <label className="api-settings-field"><span>Client ID</span><input value={values.ozonPerformanceClientId} onChange={event => updateValue("ozonPerformanceClientId", event.target.value)} autoComplete="off" placeholder="Введите Client ID" /></label>
            <label className="api-settings-field"><span>Client Secret</span><input type="password" value={values.ozonPerformanceClientSecret} onChange={event => updateValue("ozonPerformanceClientSecret", event.target.value)} autoComplete="new-password" placeholder="Вставьте Client Secret" /></label>
          </div>
          <div className="api-settings-card-note">Для замены укажите оба значения. Существующие ключи Vercel остаются резервом до сохранения новых.</div>
          {errors.ozonPerformance && <div className="api-settings-error" role="alert">{errors.ozonPerformance}</div>}
          {success.ozonPerformance && <div className="api-settings-success" role="status">{success.ozonPerformance}</div>}
          <div className="api-settings-card-footer"><span>Ключи используются серверным загрузчиком рекламы.</span><button type="button" onClick={() => void save("ozonPerformance")} disabled={saving !== null || !values.ozonPerformanceClientId.trim() || !values.ozonPerformanceClientSecret.trim()}>{saving === "ozonPerformance" ? "Сохраняем..." : "Сохранить ключи"}</button></div>
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
            <label className="api-settings-field"><span>API-ключ MPStats</span><input type="password" value={values.mpstatsToken} onChange={event => updateValue("mpstatsToken", event.target.value)} autoComplete="new-password" placeholder="Вставьте API-ключ MPStats" /></label>
          </div>
          <div className="api-settings-card-note">После сохранения ключ автоматически используется в юнит-экономике после подтверждения категории WB для получения процента выкупа и СПП. Сам ключ в браузер не возвращается.</div>
          {errors.mpstats && <div className="api-settings-error" role="alert">{errors.mpstats}</div>}
          {success.mpstats && <div className="api-settings-success" role="status">{success.mpstats}</div>}
          <div className="api-settings-card-footer"><span>Никаких дополнительных переменных Vercel добавлять не нужно.</span><button type="button" onClick={() => void save("mpstats")} disabled={saving !== null || !values.mpstatsToken.trim()}>{saving === "mpstats" ? "Сохраняем..." : "Сохранить ключ"}</button></div>
        </article>
      </div>
    </section>
  );
}
