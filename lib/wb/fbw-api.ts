/**
 * Server-only WB FBW API wrapper.
 * FBW supplies API is NOT FBS supplies API: never use /api/v3/supplies here.
 * Creating a draft is not booking a slot or creating WB cargo places.
 */
import "server-only";

const BASE = "https://supplies-api.wildberries.ru";

export class WbFbwApiError extends Error {
  constructor(public status: number, public retryAfter: string | null, message: string) {
    super(message);
    this.name = "WbFbwApiError";
  }
}

async function request<T>(path: string, options: { method?: "GET" | "POST" | "DELETE"; body?: unknown } = {}): Promise<T> {
  const token = process.env.WB_SUPPLIES_API_TOKEN;
  if (!token) throw new Error("Не задан WB_SUPPLIES_API_TOKEN (персональный/сервисный, Поставки)");
  const response = await fetch(BASE + path, {
    method: options.method ?? "GET",
    headers: {
      Authorization: token,
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: "no-store",
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new WbFbwApiError(response.status, response.headers.get("Retry-After"),
      "WB FBW HTTP " + response.status + ": " + raw.slice(0, 1200));
  }
  if (!raw) return null as T;
  try { return JSON.parse(raw) as T; }
  catch { throw new Error("WB FBW вернул некорректный JSON"); }
}
export const wbFbw = {
  listDrafts: (limit = 100, offset = 0) =>
    request<unknown>("/api/supplies/v1/drafts?limit=" + Math.min(1000, Math.max(1, Math.floor(limit))) +
      "&offset=" + Math.max(0, Math.floor(offset))),
  listDraftItems: (draftId: string) =>
    request<unknown>("/api/supplies/v1/drafts/" + encodeURIComponent(draftId) + "/items"),
  listWarehouses: () => request<unknown>("/api/v1/warehouses"),
  listTransitTariffs: () => request<unknown>("/api/v1/transit-tariffs"),
  acceptanceOptions: (payload: unknown) =>
    request<unknown>("/api/v1/acceptance/options", { method: "POST", body: payload }),
  listSupplies: (filters: unknown, limit = 100, offset = 0) =>
    request<unknown>("/api/v1/supplies?limit=" + Math.max(1, Math.floor(limit)) +
      "&offset=" + Math.max(0, Math.floor(offset)), { method: "POST", body: filters }),
  supplyDetails: (id: number) => request<unknown>("/api/v1/supplies/" + encodeURIComponent(String(id))),
  supplyGoods: (id: number) => request<unknown>("/api/v1/supplies/" + encodeURIComponent(String(id)) + "/goods"),
  supplyPackaging: (id: number) => request<unknown>("/api/v1/supplies/" + encodeURIComponent(String(id)) + "/package"),
  // Mutating operations deliberately NOT exposed through public HTTP routes.
  // Never call without verified user authorization and duplicate-draft guards.
  createEmptyDraft: () => request<unknown>("/api/supplies/v1/drafts", { method: "POST" }),
  deleteDraft: (draftId: string) =>
    request<unknown>("/api/supplies/v1/drafts/" + encodeURIComponent(draftId), { method: "DELETE" }),
};
