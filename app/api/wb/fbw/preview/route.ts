import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { calculateNeed } from "../../../../../lib/wb/procurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WbRow = {
  nmId: number;
  sellerArticle: string | null;
  productName: string | null;
  masterCode: string | null;
  sales28Days: number;
  fbwStock: number;
};
type SnapshotBarcode = { nm_id: number; barcode: string | null };
type Pack = { master_code: string | null; units_per_carton: number | null; carton_length_mm:number|null;carton_width_mm:number|null;carton_height_mm:number|null;carton_weight_kg:number|null;transport_carton_volume_m3:number|null };
type Sync = { ordersLastSuccessAt?: string | null; stocksLastSuccessAt?: string | null; stocksAndSalesLastSuccessAt?: string | null; stockSnapshotId?: string | null };
const json = (data: object, status = 200) => NextResponse.json(data, {status, headers:{"Cache-Control":"private, no-store"}});
const isFresh = (t: string | null | undefined) => {
  const n = Date.parse(t ?? "");
  return Number.isFinite(n) && n <= Date.now() + 300000 && Date.now() - n < 86400000;
};
export async function GET() {
  const auth = await createClient();
  const {data:{user}} = await auth.auth.getUser();
  if (!user) return json({ok:false,error:"Войдите на сайт"},401);
  try {
    const db = createAdminClient();
    const {data:dash,error:dashboardError} = await db.rpc("get_wb_sync_dashboard");
    if (dashboardError || !dash?.ok) throw new Error(dashboardError?.message || "Нет успешного расчёта WB");
    const sync = (dash.status ?? {}) as Sync;
    const reportTime=sync.stocksAndSalesLastSuccessAt??sync.stocksLastSuccessAt;
    const fresh = isFresh(reportTime);
    const [packs,barcodeRows,ordersBarcodes] = await Promise.all([
      db.from("products").select("master_code,units_per_carton,carton_length_mm,carton_width_mm,carton_height_mm,carton_weight_kg,transport_carton_volume_m3").not("master_code","is",null).range(0,9999),
      // The current WB product snapshot has no barcode column. The legacy
      // detailed stock snapshot still contains barcode mappings.
      db.from("wb_stock_snapshots").select("nm_id,barcode").not("barcode","is",null).range(0,9999),
      db.from("wb_orders").select("nm_id,barcode").not("barcode","is",null)
        .order("synced_at",{ascending:false}).range(0,999),
    ]);
    if (packs.error) throw new Error(packs.error.message);
    if (barcodeRows.error) throw new Error(barcodeRows.error.message);
    if (ordersBarcodes.error) throw new Error(ordersBarcodes.error.message);
    const packByMaster = new Map<string,Set<number>>();
    const dimensionByMaster=new Map<string,Set<string>>();
    for (const p of (packs.data ?? []) as Pack[]) {
      const key = (p.master_code ?? "").trim();
      const n = Number(p.units_per_carton);
      if (!key || !Number.isSafeInteger(n) || n <= 0) continue;
      const set = packByMaster.get(key) ?? new Set<number>();
      set.add(n); packByMaster.set(key,set);
      const dims=[p.carton_length_mm,p.carton_width_mm,p.carton_height_mm,p.carton_weight_kg,p.transport_carton_volume_m3];
      if(dims.some(x=>x!==null&&Number(x)>0)){
        const dimensions=dimensionByMaster.get(key)??new Set<string>();
        dimensions.add(JSON.stringify(dims.map(x=>x===null?null:Number(x))));
        dimensionByMaster.set(key,dimensions);
      }
    }
    const barcodeByNm = new Map<number,Set<string>>();
    for (const b of ([...(barcodeRows.data??[]),...(ordersBarcodes.data??[])]) as SnapshotBarcode[]) {
      const value=String(b.barcode??"").trim(); if (!value) continue;
      const set=barcodeByNm.get(Number(b.nm_id)) ?? new Set<string>();
      set.add(value);barcodeByNm.set(Number(b.nm_id),set);
    }
    const rows = ((dash.products ?? []) as WbRow[]).map(p=>{
      const sales = Number(p.sales28Days);
      const stock = Number(p.fbwStock);
      if (!Number.isFinite(sales) || sales<0 || !Number.isFinite(stock) || stock<0) return null;
      const need = calculateNeed(stock,sales/28);
      if (need.need <= 0) return null;
      const packs = packByMaster.get(String(p.masterCode??"").trim()) ?? new Set<number>();
      const pack = packs.size===1 ? [...packs][0] : null;
      // Same transport-carton threshold as the Ozon FBO preview:
      // <= 0.5 box -> zero; otherwise nearest full carton.
      const boxes = pack && need.need>pack*0.5 ? Math.round(need.need/pack) : 0;
      const quantity = boxes*(pack??0);
      const found=dimensionByMaster.get(String(p.masterCode??"").trim())??new Set<string>();
      const dims=found.size===1?JSON.parse([...found][0]) as Array<number|null>:null;
      const codes = barcodeByNm.get(Number(p.nmId)) ?? new Set<string>();
      const barcode = codes.size===1 ? [...codes][0] : null;
      let status="ready";
      if (!p.masterCode) status="missing_master";
      else if (packs.size>1) status="pack_conflict";
      else if (!pack) status="missing_pack";
      else if (!barcode) status=codes.size>1?"barcode_conflict":"missing_barcode";
      else if (boxes===0) status="below_half_box";
      return {
        sku:String(p.nmId), name:p.productName??p.sellerArticle??String(p.nmId),
        masterCode:p.masterCode,barcode,sales28Days:sales,stock,
        days:need.daysOfStock,rawNeed:need.need,unitsPerBox:pack,boxes,quantity,status,
        cartonLengthMm:dims?.[0]??null,cartonWidthMm:dims?.[1]??null,cartonHeightMm:dims?.[2]??null,
        cartonWeightKg:dims?.[3]??null,cartonVolumeM3:dims?.[4]??null,
        packagingConflict:found.size>1,
      };
    }).filter((x): x is NonNullable<typeof x> => x!==null);
    rows.sort((a,b)=>b.rawNeed-a.rawNeed);
    return json({
      ok:true,source:"WB: общий остаток РФ / 28 дней / короб Ozon",
      syncedAt:reportTime??null,ordersSyncedAt:reportTime??null,
      fresh, rows,
      summary:{
        skus:rows.length,ready:rows.filter(x=>x.status==="ready").length,
        blocked:rows.filter(x=>x.status!=="ready").length,
        quantity:rows.filter(x=>x.status==="ready").reduce((n,x)=>n+x.quantity,0),
        boxes:rows.filter(x=>x.status==="ready").reduce((n,x)=>n+x.boxes,0)
      },
      warnings: fresh?[
        "Товары в пути на WB не вычтены: источник их количества не подключён."
      ]:["Данные WB старше 24 часов. Подбор точки приёмки заблокирован до синхронизации."],
    });
  } catch (error) {
    return json({ok:false,error:error instanceof Error?error.message:"Ошибка расчёта"},500);
  }
}
