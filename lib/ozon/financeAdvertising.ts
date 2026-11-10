/**
 * Single source of truth for advertising in the finance agent.
 *
 * Financial accruals from Seller API are the ONLY advertising charge
 * contributing to P&L. Performance API is attribution/analytics metadata.
 * NEVER add Performance moneySpent to ozonAmount or subtract it from profit:
 * the Seller finance charges already contain the expense.
 *
 * Use the source financial type dictionary; type IDs below are a fallback,
 * and are intentionally reported as a classification rather than a financial
 * source. Unknown expense types remain inside total ledger.
 */
const OZON_ADVERTISING_TYPES = new Set<string>(); // Type IDs require reconciliation with Ozon's live dictionary.

export type AdvertisingClassification = {
  isAdvertising: boolean;
  reason: "type_id" | "description" | "none";
};

export function classifyAdvertisingAccrual(
  typeId: string | number | null,
  description: string | null | undefined,
  category?: string | null,
): AdvertisingClassification {
  const id = String(typeId ?? "").trim();
  const combined = `${description ?? ""} ${category ?? ""}`
    .normalize("NFKC")
    .toLocaleLowerCase("ru");

  // Only label, NEVER filter out unknown items from financial ledger.
  const matchingDescription =
    /реклам|продвижен|трафарет|спецразмещ|оплата за клик|внешнее продвижение|advertis|promo|маркетингов|медийн/.test(combined);

  if (matchingDescription) return { isAdvertising: true, reason: "description" };
  if (OZON_ADVERTISING_TYPES.has(id)) return { isAdvertising: true, reason: "type_id" };
  return { isAdvertising: false, reason: "none" };
}

/** Exact kopeck parsing to safe integer to avoid fractional arithmetic. */
export function toKopecks(value: string | number): number {
  const input = String(value).trim();
  const matched = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!matched) throw new Error("Некорректная сумма финансового начисления: " + input);
  const rubles = Number(matched[2]);
  const kopecks = Number((matched[3] ?? "").padEnd(2, "0") || "0");
  const total = rubles * 100 + kopecks;
  if (!Number.isSafeInteger(total)) throw new Error("Начисление превышает безопасный диапазон");
  return matched[1] === "-" ? -total : total;
}

export function fromKopecks(value: number): number {
  if (!Number.isSafeInteger(value)) throw new Error("Сумма превышает безопасный диапазон");
  return value / 100;
}

/** Disjoint sources and counts. Performance isn't an accounting source. */
export type AccrualReconciliation = {
  ledgerKopecks: number;
  directKopecks: number;
  unallocatedKopecks: number;
  advertisingTotalKopecks: number;
  advertisingDirectKopecks: number;
  advertisingUnallocatedKopecks: number;
  classifiedAdvertisingOperations: number;
  unknownTypeOperations: number;
};

export function emptyAccrualReconciliation(): AccrualReconciliation {
  return {
    ledgerKopecks: 0,
    directKopecks: 0,
    unallocatedKopecks: 0,
    advertisingTotalKopecks: 0,
    advertisingDirectKopecks: 0,
    advertisingUnallocatedKopecks: 0,
    classifiedAdvertisingOperations: 0,
    unknownTypeOperations: 0,
  };
}

export function assertAdvertisingAccountingInvariant(input: AccrualReconciliation) {
  if (input.ledgerKopecks !== input.directKopecks + input.unallocatedKopecks) {
    throw new Error("Ошибка сверки Ozon: распределённые начисления не равны общей сумме");
  }
  if (input.advertisingTotalKopecks !==
      input.advertisingDirectKopecks + input.advertisingUnallocatedKopecks) {
    throw new Error("Ошибка сверки рекламы: сумма рекламных начислений не сходится");
  }
}

/**
 * IMPORTANT: This signature intentionally excludes Performance API spending.
 * It is used only for metrics/attribution. The cash flow is already charged
 * inside sellerFinanceAmount. Adding Performance spending here is prohibited.
 */
export function provisionalResult(
  sellerFinanceAmount: number,
  cogs: number,
  mayak: number,
): number {
  return Math.round((sellerFinanceAmount - cogs - mayak + Number.EPSILON) * 100) / 100;
}

/**
 * Profit uses authoritative Ozon Seller ledger postings, never the presence
 * of optional fee-detail types. A SKU can have posted revenue without a
 * distinct SALES/COMMISSION/acquiring line in the requested date range:
 * those accruals may be booked in different periods or be absent by scheme.
 * Do not fabricate missing cost, or report the result if order coverage fails.
 */
export function calculateProvisionalSkuProfit(
  sellerNet: number,
  cogs: number | null,
  mayak: number | null,
  salesCovered: boolean,
): number | null {
  if (!salesCovered || cogs === null || mayak === null) return null;
  if (![sellerNet,cogs,mayak].every(Number.isFinite)) return null;
  return provisionalResult(sellerNet,cogs,mayak);
}
