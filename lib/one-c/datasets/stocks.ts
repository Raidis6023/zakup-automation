import { NextRequest } from "next/server";
import {
  authenticated, checked, checkedOne, db, failure, page,
  pagination, requiredChoice, result, validDate,
} from "@/lib/one-c/export";


const SOURCES = ["avedex", "babushkina"] as const;
const BABUSHKINA_OWNER = "Бабушкина Ирина Алексеевна ИП";

type StockRow = {
  id: number; product_id: string; quantity: number; warehouse_name: string;
  owner_name?: string | null; snapshot_date: string; imported_at: string | null;
};
type ProductRow = { id: string; master_code: string | null; offer_id: string; name: string | null };

export async function GET(request: NextRequest) {
  const denied = authenticated(request, "stocks");
  if (denied) return denied;

  try {
    const source = requiredChoice(request, "source", SOURCES);
    const { limit, offset } = pagination(request);
    const dateParam = request.nextUrl.searchParams.get("date");
    const requestedDate = dateParam === null ? null : validDate(dateParam, "date");
    const client = db();
    const latest = source === "avedex"
      ? await checkedOne<{ snapshot_date: string }>(
          client.from("own_stock_snapshots")
            .select("snapshot_date")
            .not("warehouse_name", "ilike", "%тест%")
            .order("snapshot_date", { ascending: false })
            .limit(1).maybeSingle(),
        )
      : await checkedOne<{ snapshot_date: string }>(
          client.from("responsible_storage_stock_snapshots")
            .select("snapshot_date")
            .eq("owner_name", BABUSHKINA_OWNER)
            .not("warehouse_name", "ilike", "%тест%")
            .order("snapshot_date", { ascending: false })
            .limit(1).maybeSingle(),
        );
    const snapshotDate = requestedDate ?? latest?.snapshot_date ?? null;
    if (!snapshotDate) {
      return result({
        source, snapshot_date: null, latest_available_date: null,
        ...page([], offset, limit),
      });
    }

    // Explicit table selections keep the schema type-safe and prevent
    // attempts to read owner_name from the own_stock_snapshots table.
    const rows = source === "avedex"
      ? await checked<StockRow>(
          client.from("own_stock_snapshots")
            .select("id,product_id,quantity,warehouse_name,snapshot_date,imported_at")
            .eq("snapshot_date", snapshotDate)
            .not("warehouse_name", "ilike", "%тест%")
            .order("id", { ascending: true })
            .range(offset, offset + limit),
        )
      : await checked<StockRow>(
          client.from("responsible_storage_stock_snapshots")
            .select("id,product_id,quantity,warehouse_name,owner_name,snapshot_date,imported_at")
            .eq("snapshot_date", snapshotDate)
            .eq("owner_name", BABUSHKINA_OWNER)
            .not("warehouse_name", "ilike", "%тест%")
            .order("id", { ascending: true })
            .range(offset, offset + limit),
        );
    const ids = [...new Set(rows.map((row) => row.product_id))];
    const products = ids.length
      ? await checked<ProductRow>(
          client.from("products")
            .select("id,master_code,offer_id,name")
            .in("id", ids),
        )
      : [];
    const byId = new Map(products.map((row) => [row.id, row]));
    return result({
      source,
      snapshot_date: snapshotDate,
      latest_available_date: latest?.snapshot_date ?? null,
      owner: source === "babushkina" ? BABUSHKINA_OWNER : "АВЕДЭКС",
      ...page(rows.map((row) => {
        const product = byId.get(row.product_id);
        return {
          id: row.id,
          product_id: row.product_id,
          enot: product?.master_code ?? null,
          offer_id: product?.offer_id ?? null,
          name: product?.name ?? null,
          warehouse_name: row.warehouse_name,
          owner_name: source === "babushkina" ? row.owner_name ?? BABUSHKINA_OWNER : null,
          quantity: row.quantity,
          snapshot_date: row.snapshot_date,
          imported_at: row.imported_at,
        };
      }), offset, limit),
      note: "Остатки из импортированных снимков, а не онлайн-остатки 1С. Источники разделены.",
    });
  } catch (error) {
    return failure(error);
  }
}
