"use client";

import {
  buildFinanceDiagnostics,
  type FinanceDiagnosticReport,
  type FinanceDiagnosticRow,
} from "../../../lib/ozon/financeDiagnostics";

type Props = {
  report: FinanceDiagnosticReport | null;
  rows: FinanceDiagnosticRow[];
};

/** Only reads the already-loaded finance cache; never creates Ozon jobs. */
export default function FinanceDiagnosticsPanel({ report, rows }: Props) {
  if (!report) return null;
  const signals = buildFinanceDiagnostics(report, rows);
  const blocking = signals.filter(signal => signal.severity === "blocking").length;
  const shown = signals.slice(0, 20);

  return (
    <section className="ozf-panel" aria-label="Контроль достоверности аналитики">
      <div className="ozf-toolbar">
        <div>
          <h2>Контроль достоверности · {signals.length} сигналов</h2>
          <p>
            Проверяются только данные загруженного финансового отчёта.
            Предполагаемые убытки, упущенную прибыль и ценовые пороги без
            подтверждённых источников система не выдумывает.
          </p>
        </div>
      </div>
      <p className="ozf-footnote">
        Необходима проверка исходных данных: {blocking}. Предварительный
        отрицательный результат: {signals.length - blocking}.
        {rows.length ? ` Проверено товаров: ${rows.length}.` : " Товары пока не найдены."}
      </p>
      {signals.length === 0 ? (
        <p className="ozf-footnote">
          По выбранным товарам указанные проверки не выявили сигналов.
          Это не означает, что все финансовые риски исключены.
        </p>
      ) : (
        <div className="ozf-table-scroll">
          <table className="ozf-table">
            <thead>
              <tr><th>Категория</th><th>Товар</th><th>Сигнал</th><th>Основание</th></tr>
            </thead>
            <tbody>
              {shown.map(signal => (
                <tr key={signal.key}>
                  <td>{signal.severity === "blocking" ? "Недостаточно данных" : "Проверить"}</td>
                  <td>{signal.productName ?? "Весь период"}</td>
                  <td>{signal.title}</td>
                  <td>{signal.explanation}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {signals.length > shown.length && (
            <p className="ozf-footnote">
              Показаны первые {shown.length} из {signals.length} сигналов.
              Уточните фильтр по товару или менеджеру.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
