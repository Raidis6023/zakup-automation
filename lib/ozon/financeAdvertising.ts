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

/** Exact kopeck parsing. Avoid floating point errors in ledger reconciliation. */
export function toKopecks(value: string | number): bigint {
  const input = String(value).trim();
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(input);
  if (!m) throw new Error("Некорректная сумма финансового начисления: " + input);
  const amount = BigInt(m[2]) * BigInt(100) +
    BigInt((m[3] ?? "").padEnd(2, "0") || "0");
  return m[1] === "-" ? -amount : amount;
}

export function fromKopecks(value: bigint): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new Error("Финансовая сумма превышает безопасный диапазон");
  }
  return n / 100;
}

/** Disjoint sources and counts. Performance isn't an accounting source. */
export type AccrualReconciliation = {
  ledgerKopecks: bigint;
  directKopecks: bigint;
  unallocatedKopecks: bigint;
  advertisingTotalKopecks: bigint;
  advertisingDirectKopecks: bigint;
  advertisingUnallocatedKopecks: bigint;
  classifiedAdvertisingOperations: number;
  unknownTypeOperations: number;
};

export function emptyAccrualReconciliation(): AccrualReconciliation {
  return {
    ledgerKopecks: BigInt(0),
    directKopecks: BigInt(0),
    unallocatedKopecks: BigInt(0),
    advertisingTotalKopecks: BigInt(0),
    advertisingDirectKopecks: BigInt(0),
    advertisingUnallocatedKopecks: BigInt(0),
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
