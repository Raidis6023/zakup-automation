import { NextRequest } from "next/server";
import { authenticated, failure, result, ExportError } from "@/lib/one-c/export";
import { GET as getFinance } from "@/lib/one-c/datasets/finance";
import { GET as getSales } from "@/lib/one-c/datasets/sales";
import { GET as getProducts } from "@/lib/one-c/datasets/products";
import { GET as getStocks } from "@/lib/one-c/datasets/stocks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * ONE public integration endpoint for 1C.
 *
 * GET /api/v1/1c/export?dataset=finance|sales|products|stocks
 *
 * Never accept arbitrary DB table/column names from the client.
 * Every resource has its own explicit mapping and auth scope.
 */
export async function GET(request: NextRequest) {
  try {
    const dataset = request.nextUrl.searchParams.get("dataset") || "catalog";
    if (dataset === "catalog") {
      const denied = authenticated(request, "catalog");
      if (denied) return denied;
      return result({
        name: "Наше API-хуяпи v1",
        endpoint: "/api/v1/1c/export",
        authentication: "Authorization: Bearer <access_key>",
        datasets: {
          products: { description: "Связи товаров с ЕНОТ", parameters: ["limit", "offset", "enot"] },
          stocks: {
            description: "Снимки остатков Аведэкс и ОХ ИП Бабушкиной",
            parameters: ["source=avedex|babushkina", "date=YYYY-MM-DD (optional)", "limit", "offset"],
          },
          sales: {
            description: "Продажи по дням",
            parameters: ["marketplace=ozon|wildberries|yandex_market", "from=YYYY-MM-DD", "to=YYYY-MM-DD", "limit", "offset"],
            note: "WB: from и to должны указывать на один календарный день",
          },
          finance: {
            description: "Детальные строки финансовых отчётов",
            parameters: ["marketplace=ozon|wildberries|yandex_market", "from=YYYY-MM-DD", "to=YYYY-MM-DD", "limit", "offset"],
            note: "Для Яндекс Маркета период должен точно совпадать с готовым отчётом",
          },
        },
        pagination: { default_limit: 100, max_limit: 200, offset_starts_at: 0 },
        docs: "docs/1c-export-v1.md",
      });
    }
    if (dataset === "finance") return getFinance(request);
    if (dataset === "sales") return getSales(request);
    if (dataset === "products") return getProducts(request);
    if (dataset === "stocks") return getStocks(request);
    throw new ExportError(
      400, "UNKNOWN_DATASET",
      "Неизвестный dataset. Допустимые: catalog, products, stocks, sales, finance",
    );
  } catch (error) {
    return failure(error);
  }
}
