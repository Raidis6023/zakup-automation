/**
 * Read-only checks for the existing Ozon finance report.
 *
 * These signals are NOT ALIP AI's rules and must not be treated as confirmed
 * profit losses. We intentionally do not extrapolate monetary damage.
 * Seller finance charges already include advertising: never subtract
 * Performance attribution data again.
 */
export type FinanceDiagnosticRow = {
  offer_id: string;
  name: string | null;
  unit_cost: number | null;
  estimated_result: number | null;
  data_gaps: string[];
};

export type FinanceDiagnosticReport = {
  from: string;
  to: string;
  missing_days: string[];
  actual_buyouts_covered: boolean;
};

export type FinanceDiagnostic = {
  key: string;
  offerId: string | null;
  productName: string | null;
  severity: "blocking" | "review";
  title: string;
  explanation: string;
};

export function buildFinanceDiagnostics(
  report: FinanceDiagnosticReport | null,
  rows: FinanceDiagnosticRow[],
): FinanceDiagnostic[] {
  if (!report) return [];

  const signals: FinanceDiagnostic[] = [];
  const hasMissingDays = report.missing_days.length > 0;
  if (hasMissingDays) {
    signals.push({
      key: "period:missing",
      offerId: null,
      productName: null,
      severity: "blocking",
      title: "Отчётный период заполнен не полностью",
      explanation: `Нет начислений за ${report.missing_days.length} дн.: ${report.missing_days.join(", ")}. До дозагрузки нельзя оценивать итоговую прибыльность.`,
    });
  }

  if (!report.actual_buyouts_covered) {
    signals.push({
      key: "period:buyouts",
      offerId: null,
      productName: null,
      severity: "blocking",
      title: "Неполные данные о фактических выкупах",
      explanation: "Нельзя подтверждать товарную прибыльность, пока не завершена сверка выкупов за период.",
    });
  }

  const canDiscussResult = !hasMissingDays && report.actual_buyouts_covered;
  for (const row of rows) {
    const missingCost = row.unit_cost == null || !Number.isFinite(row.unit_cost);
    const dataGaps = Array.isArray(row.data_gaps) ? row.data_gaps : [];
    const name = row.name || row.offer_id;

    if (missingCost) {
      signals.push({
        key: `product:${row.offer_id}:cost`,
        offerId: row.offer_id,
        productName: name,
        severity: "blocking",
        title: "Себестоимость не подтверждена",
        explanation: "Для товара нет корректной цены закупки. Убыток и минимальную рентабельную цену определять нельзя.",
      });
      continue;
    }

    if (dataGaps.length > 0) {
      signals.push({
        key: `product:${row.offer_id}:gaps`,
        offerId: row.offer_id,
        productName: name,
        severity: "blocking",
        title: "Неполные данные для расчёта",
        explanation: `Проверьте исходные данные: ${dataGaps.join(", ")}. Денежную оценку проблемы не рассчитываем.`,
      });
      continue;
    }

    if (canDiscussResult && row.estimated_result != null &&
        Number.isFinite(row.estimated_result) && row.estimated_result < 0) {
      signals.push({
        key: `product:${row.offer_id}:negative-estimate`,
        offerId: row.offer_id,
        productName: name,
        severity: "review",
        title: "Предварительный результат отрицательный",
        explanation: `Расчётный результат за ${report.from} — ${report.to}: ${row.estimated_result.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽. Это повод для сверки начислений, а не доказанный убыток.`,
      });
    }
  }

  return signals;
}
