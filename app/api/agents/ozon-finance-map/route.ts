import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ACCOUNT = "main";
const BATCH_SIZE = 180;
type Info = { sku?: string | number; offer_id?: string; id?: string | number };
type Supabase = ReturnType<typeof createAdminClient>;
function response(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
async function getAdmin(request?: NextRequest): Promise<Supabase | null> {
  if (request && process.env.CRON_SECRET &&
    request.headers.get("authorization")==="Bearer "+process.env.CRON_SECRET)
    return createAdminClient();
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return null;
  const db = createAdminClient();
  const { data: access, error: accessError } = await db.from("app_user_access")
    .select("admin_level,is_blocked").eq("user_id", user.id).maybeSingle();
  if (accessError || !access || access.is_blocked ||
    !["admin", "senior_admin"].includes(access.admin_level ?? "")) return null;
  return db;
}
async function ozonInfo(skus: string[]): Promise<Info[]> {
  const clientId = process.env.OZON_CLIENT_ID;
  const key = process.env.OZON_API_KEY;
  if (!clientId || !key) throw new Error("Seller API не настроен");
  const http = await fetch("https://api-seller.ozon.ru/v3/product/info/list", {
    method: "POST", headers: {
      "Client-Id": clientId, "Api-Key": key, "Content-Type": "application/json",
    }, body: JSON.stringify({ sku: skus }),
    cache: "no-store", signal: AbortSignal.timeout(25000),
  });
  if (!http.ok) throw new Error("Ozon не вернул сопоставление SKU (HTTP " + http.status + ")");
  const data = await http.json() as { items?: Info[] };
  if (!Array.isArray(data.items)) throw new Error("Некорректный ответ каталога Ozon");
  return data.items;
}
export async function POST(request: NextRequest) {
  const db = await getAdmin(request);
  if (!db) return response({ ok: false, error: "Нужны права администратора" }, 403);
  try {
    const body = await request.json() as { day?: string };
    const day = body.day ?? "";
    const date = new Date(day + "T00:00:00Z");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      Number.isNaN(date.getTime()) || date.toISOString().slice(0,10) !== day) {
      return response({ ok: false, error: "Неверная дата" },400);
    }
    const { data: records, error: listError } = await db.rpc(
      "ozon_finance_unmapped_skus", {
        p_day: day, p_limit: BATCH_SIZE, p_account: ACCOUNT,
      }
    );
    if (listError) throw listError;
    const skus: string[] = ((records ?? []) as Array<{ sku: string }>).map(r => r.sku);
    if (!skus.length) return response({ok:true,processed:0,resolved:0,unresolved:0,more:false});
    const infos = await ozonInfo(skus);
    const infoBySku = new Map(infos.filter(x => x.sku != null)
      .map(x => [String(x.sku), x]));
    const offerIds = [...new Set(infos.map(x => x.offer_id).filter((x): x is string => !!x))];
    const byOffer = new Map<string,string|null>();
    for (let i = 0; i < offerIds.length; i += 400) {
      const { data, error } = await db.from("products")
        .select("offer_id,master_code").in("offer_id",offerIds.slice(i,i+400));
      if (error) throw error;
      for (const item of data ?? []) {
        if(item.offer_id) byOffer.set(item.offer_id,item.master_code ?? null);
      }
    }
    const written = skus.map(sku => {
      const info=infoBySku.get(sku), offer=info?.offer_id ?? null;
      return {
        account_key: ACCOUNT, sku, offer_id: offer,
        master_code: offer ? byOffer.get(offer) ?? null : null,
        synced_at: new Date().toISOString(),
      };
    });
    const { error: saveError } = await db.from("ozon_finance_sku_map")
      .upsert(written,{onConflict:"account_key,sku"});
    if (saveError) throw saveError;
    return response({
      ok:true,
      processed:skus.length,
      resolved:written.filter(x=>x.offer_id && x.master_code).length,
      unresolved:written.filter(x=>!x.offer_id || !x.master_code).length,
      more:skus.length===BATCH_SIZE,
    });
  } catch (error) {
    return response({ok:false,error:error instanceof Error?error.message.slice(0,300):"Ошибка сопоставления SKU"},502);
  }
}
