import { NextRequest } from "next/server";
import {
  authenticated, checked, dateRange, db, ExportError, failure,
  nextDate, page, pagination, requiredChoice, result,
} from "@/lib/one-c/export";


const MARKETS = ["ozon", "wildberries", "yandex_market"] as const;

type OzonSale = {
  id: number; product_id: string; sale_date: string; cluster_id: string | null;
  cluster_name: string | null; sales_quantity: number; cancelled_quantity: number;
  imported_at: string | null;
};
type YandexSale = {
  id: number; product_id: string | null; master_code: string | null; shop_sku: string;
  sale_date: string; warehouse_id: number | null; warehouse_name: string | null;
  ordered_quantity: number; sales_quantity: number; cancelled_quantity: number;
  unredeemed_quantity: number; returned_quantity: number; net_sales_quantity: number;
  updated_at: string | null;
};
type WbSale = {
  sale_id: string; sale_date: string; nm_id: number | null;
  supplier_article: string | null; barcode: string | null; warehouse_name: string | null;
};
type Product = { id: string; master_code: string | null; offer_id: string };

export async function GET(request: NextRequest) {
  const denied = authenticated(request, "sales");
  if (denied) return denied;

  try {
    const marketplace = requiredChoice(request, "marketplace", MARKETS);
    const period = dateRange(request);
    const { limit, offset } = pagination(request);
    const client = db();

    if (marketplace === "ozon") {
      const rows = await checked<OzonSale>(
        client.from("ozon_sales_daily")
          .select("id,product_id,sale_date,cluster_id,cluster_name,sales_quantity,cancelled_quantity,imported_at")
          .gte("sale_date", period.from).lte("sale_date", period.to)
          .order("sale_date", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + limit),
      );
      const ids = [...new Set(rows.map((row) => row.product_id))];
      const products = ids.length
        ? await checked<Product>(
            client.from("products").select("id,master_code,offer_id").in("id", ids),
          )
        : [];
      const byId = new Map(products.map((row) => [row.id, row]));
      return result({
        marketplace, period,
        ...page(rows.map((row) => ({
          id: row.id, day: row.sale_date, product_id: row.product_id,
          enot: byId.get(row.product_id)?.master_code ?? null,
          offer_id: byId.get(row.product_id)?.offer_id ?? null,
          cluster_id: row.cluster_id, cluster_name: row.cluster_name,
          sales_quantity: row.sales_quantity,
          cancelled_quantity: row.cancelled_quantity,
          updated_at: row.imported_at,
        })), offset, limit),
        note: "Продажи Ozon в разрезе дня, товара и кластера.",
      });
    }

    if (marketplace === "yandex_market") {
      const rows = await checked<YandexSale>(
        client.from("yandex_sales_daily")
          .select("id,product_id,master_code,shop_sku,sale_date,warehouse_id,warehouse_name,ordered_quantity,sales_quantity,cancelled_quantity,unredeemed_quantity,returned_quantity,net_sales_quantity,updated_at")
          .gte("sale_date", period.from).lte("sale_date", period.to)
          .order("sale_date", { ascending: true })
          .order("id", { ascending: true })
          .range(offset, offset + limit),
      );
      return result({
        marketplace, period,
        ...page(rows.map((row) => ({
          id: row.id, day: row.sale_date, product_id: row.product_id,
          enot: row.master_code, offer_id: row.shop_sku,
          warehouse_id: row.warehouse_id, warehouse_name: row.warehouse_name,
          ordered_quantity: row.ordered_quantity,
          sales_quantity: row.sales_quantity,
          cancelled_quantity: row.cancelled_quantity,
          unredeemed_quantity: row.unredeemed_quantity,
          returned_quantity: row.returned_quantity,
          net_sales_quantity: row.net_sales_quantity,
          updated_at: row.updated_at,
        })), offset, limit),
        note: "Продажи Яндекс Маркета по дням, товарам и складам.",
      });
    }

    // The WB source consists of individual sales, not pre-aggregated days.
    // Restrict grouping to one calendar date to keep the query bounded and
    // prevent partial daily aggregates when records exceed the page limit.
    if (period.from !== period.to) {
      throw new ExportError(400, "WB_ONE_DAY_ONLY", "Для WB передайте один день: from и to должны совпадать");
    }
    const raw: WbSale[] = [];
    const batchSize = 1000;
    const maxRows = 20000;
    for (let position = 0; position < maxRows; position += batchSize) {
      const batch = await checked<WbSale>(
        client.from("wb_sales")
          .select("sale_id,sale_date,nm_id,supplier_article,barcode,warehouse_name")
          .like("sale_id", "S%")
          .gte("sale_date", period.from + "T00:00:00")
          .lt("sale_date", nextDate(period.to) + "T00:00:00")
          .order("sale_id", { ascending: true })
          .range(position, position + batchSize - 1),
      );
      raw.push(...batch);
      if (batch.length < batchSize) break;
      if (position + batchSize >= maxRows) {
        throw new ExportError(422, "WB_DAY_TOO_LARGE", "Слишком много записей WB за день. Требуется серверная агрегация");
      }
    }
    const groups = new Map<string, {
      id: string; day: string; nm_id: number | null; supplier_article: string | null;
      barcode: string | null; warehouse_name: string | null; sales_quantity: number;
    }>();
    for (const row of raw) {
      const key = JSON.stringify([
        row.sale_date.slice(0, 10), row.nm_id, row.supplier_article, row.barcode, row.warehouse_name,
      ]);
      const existing = groups.get(key);
      if (existing) {
        existing.sales_quantity++;
      } else {
        groups.set(key, {
          id: key, day: row.sale_date.slice(0, 10),
          nm_id: row.nm_id, supplier_article: row.supplier_article,
          barcode: row.barcode, warehouse_name: row.warehouse_name,
          sales_quantity: 1,
        });
      }
    }
    const grouped = [...groups.values()]
      .sort((a, b) => a.id.localeCompare(b.id));
    return result({
      marketplace, period,
      ...page(grouped.slice(offset, offset + limit + 1).map((row) => ({
        ...row,
        enot: null,
        note: "ЕНОТ не установлен: нет надёжной связи nm_id с master_code.",
      })), offset, limit),
      note: "WB: количество событий продаж за календарный день, без возвратов; по текущему источнику нет гарантированной связи с ЕНОТ.",
    });
  } catch (error) {
    return failure(error);
  }
}
