import { NextRequest } from "next/server";
import {
  authenticated, checked, db, failure, page, pagination, result, ExportError,
} from "@/lib/one-c/export";


type ProductRow = {
  id: string; master_code: string; offer_id: string; name: string | null;
  ozon_product_id: number | null; is_active: boolean | null;
  is_discontinued: boolean | null; chinese_article: string | null;
  updated_at: string | null;
};
type StatusRow = { master_code: string; status: string };

export async function GET(request: NextRequest) {
  const denied = authenticated(request, "products");
  if (denied) return denied;
  try {
    const { limit, offset } = pagination(request);
    const enot = request.nextUrl.searchParams.get("enot")?.trim() || null;
    if (enot && (enot.length > 100 || /[\u0000-\u001f]/.test(enot))) {
      throw new ExportError(400, "INVALID_PARAMETER", "Некорректный ЕНОТ");
    }
    const client = db();
    let query = client.from("products")
      .select("id,master_code,offer_id,name,ozon_product_id,is_active,is_discontinued,chinese_article,updated_at")
      .not("master_code", "is", null)
      .neq("master_code", "")
      .order("master_code", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + limit);
    if (enot) query = query.eq("master_code", enot);
    const rows = await checked<ProductRow>(query);
    const codes = [...new Set(rows.map((row) => row.master_code))];
    const statuses = codes.length
      ? await checked<StatusRow>(
          client.from("product_article_statuses")
            .select("master_code,status").in("master_code", codes),
        )
      : [];
    const statusMap = new Map(statuses.map((row) => [row.master_code, row.status]));
    return result({
      ...page(rows.map((row) => ({
        product_id: row.id,
        enot: row.master_code,
        offer_id: row.offer_id,
        name: row.name,
        ozon_product_id: row.ozon_product_id,
        article_china: row.chinese_article,
        status: statusMap.get(row.master_code) ?? null,
        is_active: row.is_active,
        is_discontinued: row.is_discontinued,
        updated_at: row.updated_at,
      })), offset, limit),
      note: "Одна запись на товарный артикул; один ЕНОТ может встречаться у нескольких артикулов.",
    });
  } catch (error) {
    return failure(error);
  }
}
