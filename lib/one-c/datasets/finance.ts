import { NextRequest } from "next/server";
import {
  authenticated, checked, checkedOne, dateRange, db, failure, page,
  pagination, requiredChoice, result, ExportError,
} from "@/lib/one-c/export";


const MARKETS = ["ozon", "wildberries", "yandex_market"] as const;

type OzonLine = {
  run_id: string; day: string; row_index: number; amount: number | string;
  type_id: string | null; accrued_category: string | null;
  unit_number: string | null; sku: string | null; raw: unknown;
};
type WbLine = { run_day: string; line_index: number; payload: Record<string, unknown> };
type YandexLine = { report_id: string; line_index: number; payload: Record<string, unknown> };
type YandexReport = { id: string; date_from: string; date_to: string };

export async function GET(request: NextRequest) {
  const denied = authenticated(request, "finance");
  if (denied) return denied;

  try {
    const market = requiredChoice(request, "marketplace", MARKETS);
    const period = dateRange(request);
    const { limit, offset } = pagination(request);
    const client = db();

    if (market === "ozon") {
      const rows = await checked<OzonLine>(
        client.from("ozon_finance_accruals")
          .select("run_id,day,row_index,amount,type_id,accrued_category,unit_number,sku,raw")
          .eq("account_key", "main")
          .gte("day", period.from).lte("day", period.to)
          .order("day", { ascending: true })
          .order("run_id", { ascending: true })
          .order("row_index", { ascending: true })
          .range(offset, offset + limit),
      );
      return result({
        marketplace: market, period,
        ...page(rows.map((row) => ({
          id: row.run_id + ":" + row.row_index,
          day: row.day, sku: row.sku, amount: row.amount,
          type_id: row.type_id, category: row.accrued_category,
          document_number: row.unit_number, source: row.raw,
        })), offset, limit),
        note: "Начисления Ozon по датам; суммы и знаки сохранены как в источнике.",
      });
    }

    if (market === "wildberries") {
      // WB cache is a single downloaded snapshot. run_day is a cache date,
      // whereas payload.rrDate is the operation date.
      const latest = await checkedOne<{ run_day: string }>(
        client.from("wb_finance_cache_lines")
          .select("run_day").order("run_day", { ascending: false })
          .limit(1).maybeSingle(),
      );
      if (!latest) {
        return result({ marketplace: market, period, snapshot_date: null,
          ...page([], offset, limit) });
      }
      const rows = await checked<WbLine>(
        client.from("wb_finance_cache_lines")
          .select("run_day,line_index,payload")
          .eq("run_day", latest.run_day)
          .gte("payload->>rrDate", period.from)
          .lte("payload->>rrDate", period.to)
          .order("line_index", { ascending: true })
          .range(offset, offset + limit),
      );
      return result({
        marketplace: market, period, snapshot_date: latest.run_day,
        ...page(rows.map((row) => ({
          id: row.run_day + ":" + row.line_index,
          day: row.payload.rrDate ?? null,
          document_type: row.payload.docTypeName ?? null,
          source: row.payload,
        })), offset, limit),
        note: "Строки финансовой детализации WB по rrDate из последней сохранённой выгрузки.",
      });
    }

    // Yandex reports are imported as complete periods. Never return an entire
    // report as though it were a smaller requested sub-period.
    const report = await checkedOne<YandexReport>(
      client.from("yandex_finance_reports")
        .select("id,date_from,date_to")
        .eq("status", "ready")
        .eq("date_from", period.from).eq("date_to", period.to)
        .order("completed_at", { ascending: false })
        .limit(1).maybeSingle(),
    );
    if (!report) {
      throw new ExportError(
        409, "REPORT_PERIOD_UNAVAILABLE",
        "Для Яндекс Маркета нет готового финансового отчёта точно за указанный период",
      );
    }
    const rows = await checked<YandexLine>(
      client.from("yandex_finance_lines")
        .select("report_id,line_index,payload")
        .eq("report_id", report.id)
        .order("line_index", { ascending: true })
        .range(offset, offset + limit),
    );
    return result({
      marketplace: market, period, report_id: report.id,
      ...page(rows.map((row) => ({
        id: row.report_id + ":" + row.line_index,
        day: row.payload.serviceDate ?? row.payload.orderDate ?? null,
        source: row.payload,
      })), offset, limit),
      note: "Исходные строки сохранённого финансового отчёта Яндекс Маркета.",
    });
  } catch (error) {
    return failure(error);
  }
}
