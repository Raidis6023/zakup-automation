import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildFbwPlan } from "@/lib/wb/fbw-supply-plan";
import { requireFbwSupplyUser } from "@/lib/wb/fbw-supply-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const WB_API = "https://supplies-api.wildberries.ru";
const pause = () => new Promise<void>(resolve => setTimeout(resolve, 2200));

async function callWb<T>(token: string, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const response = await fetch(WB_API + path, {
    method, headers: {
      Authorization: token,
      ...(body === undefined ? {} : {"Content-Type":"application/json"}),
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
    cache:"no-store",
    signal:AbortSignal.timeout(45000),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(
      "WB Supplies HTTP " + response.status + ": " +
      (response.status === 429
        ? "лимит запросов, повторить позднее; " + (response.headers.get("Retry-After") || "")
        : raw.slice(0,450))
    );
  }
  if (!raw) return {} as T;
  try { return JSON.parse(raw) as T; }
  catch { throw new Error("WB Supplies вернул не-JSON ответ"); }
}

export async function GET() {
  try {
    await requireFbwSupplyUser();
    const db = createAdminClient();
    const {data,error} = await db.from("wb_fbw_draft_runs")
      .select("id,status,draft_id,sku_count,units,cartons,error_message,created_at,period_end")
      .order("created_at",{ascending:false}).limit(20);
    if (error) throw new Error(error.message);
    return NextResponse.json({ok:true,runs:data || []},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {
    const message = error instanceof Error ? error.message : "Ошибка истории FBW";
    return NextResponse.json({ok:false,error:message},{status:403});
  }
}

/**
 * Creates a real WB draft, NOT a booked supply. Only explicit user POST is allowed.
 * Recalculate before writing so no stale or manipulated browser quantities reach WB.
 */
export async function POST(request:NextRequest) {
  let recordId: string | null = null;
  let draftId: string | null = null;
  try {
    const userId = await requireFbwSupplyUser();
    const token = process.env.WB_SUPPLIES_TOKEN?.trim();
    if (!token) return NextResponse.json({
      ok:false,error:"Нет WB_SUPPLIES_TOKEN в серверных переменных Vercel (нужен токен категории «Поставки» с правом записи)"
    },{status:503});
    const body = await request.json() as {fingerprint?:string};
    if (!body || typeof body.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(body.fingerprint)) {
      return NextResponse.json({ok:false,error:"Сначала пересчитайте план и подтвердите его актуальную версию"},{status:400});
    }
    const plan = await buildFbwPlan(request);
    if (plan.fingerprint !== body.fingerprint) {
      return NextResponse.json({ok:false,error:"За время подтверждения изменился состав поставки. Пересчитайте план."},{status:409});
    }
    const eligible = plan.items.filter(x => !x.blockingReason && x.quantity > 0);
    if (!eligible.length) return NextResponse.json({ok:false,error:"Нет товаров с полной коробной потребностью и баркодами"},{status:400});
    if (eligible.length > 1000) return NextResponse.json({ok:false,error:"Черновик WB допускает до 1000 баркодов; требуется разделение на несколько черновиков"},{status:400});
    const grouped = new Map<string, number>();
    for (const item of eligible) {
      if (grouped.has(item.sku)) {
        return NextResponse.json({ok:false,error:"Баркод "+item.sku+" встречается в нескольких строках; устраните дубликаты до создания"},{status:409});
      }
      if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.pack) || item.quantity % item.pack !== 0) {
        throw new Error("Некратное вложимости количество: "+item.article);
      }
      grouped.set(item.sku,item.quantity);
    }
    const draftItems = [...grouped].map(([sku,quantity])=>({sku,quantity}));
    const db = createAdminClient();
    const requestKey = plan.fingerprint;
    const {data:run,error:insertError} = await db.from("wb_fbw_draft_runs").insert({
      request_key:requestKey,
      fingerprint:plan.fingerprint,
      period_end:plan.period.end,
      stock_snapshot_id:plan.stockSnapshotId,
      status:"creating",
      sku_count:draftItems.length,
      units:plan.summary.eligibleUnits,
      cartons:plan.summary.transportCartons,
      items:eligible,
      created_by:userId,
    }).select("id").single();
    if (insertError) {
      if (insertError.code === "23505") {
        const {data:existing} = await db.from("wb_fbw_draft_runs")
          .select("id,status,draft_id,error_message").eq("request_key",requestKey).maybeSingle();
        return NextResponse.json({
          ok:false,existing,duplicate:true,
          error:"Этот состав уже отправлялся в WB. Не создаём дубль. Проверьте историю и черновик."
        },{status:409});
      }
      throw new Error("Нельзя зафиксировать идемпотентность: "+insertError.message);
    }
    if (!run) throw new Error("WB draft ledger не вернул id");
    recordId = run.id as string;
    // API creates an empty draft. Actual goods are written separately.
    const created = await callWb<{draftId:string}>(token,"POST","/api/supplies/v1/drafts");
    draftId = created.draftId;
    if (!draftId || !/^[0-9a-f-]{36}$/i.test(draftId)) throw new Error("WB не вернул корректный draftId");
    const {error:saveIdError} = await db.from("wb_fbw_draft_runs")
      .update({draft_id:draftId,status:"draft_created",updated_at:new Date().toISOString()})
      .eq("id",recordId);
    if (saveIdError) throw new Error("Черновик создан, но локальное сохранение ID не удалось: "+saveIdError.message);
    await pause(); // 2 sec documented minimum interval.
    const added = await callWb<{results?:Array<{sku:string;error:unknown}>}>(
      token,"POST","/api/supplies/v1/drafts/"+encodeURIComponent(draftId)+"/items",
      {items:draftItems},
    );
    // WB returns HTTP 200 even when validation rejected the WHOLE atomic batch.
    if (!added || !Array.isArray(added.results)) throw new Error("WB не подтвердил результат добавления (results)");
    if (added.results.length > 0) {
      throw new Error("WB отклонил все позиции из-за баркодов: "+JSON.stringify(added.results).slice(0,800));
    }
    await pause();
    const check = await callWb<{items:Array<{sku:string;quantity:number}>}>(
      token,"GET","/api/supplies/v1/drafts/"+encodeURIComponent(draftId)+"/items",
    );
    if (!Array.isArray(check.items) || check.items.length !== draftItems.length) {
      throw new Error("Черновик создан, но WB вернул другое число позиций: требуется ручная проверка");
    }
    const received = new Map(check.items.map(x=>[String(x.sku),Number(x.quantity)]));
    if (draftItems.some(x => received.get(x.sku) !== x.quantity)) {
      throw new Error("Состав черновика WB не совпадает с подтверждённым планом");
    }
    const {error:saveReadyError} = await db.from("wb_fbw_draft_runs").update({
      status:"ready",error_message:null,updated_at:new Date().toISOString(),
    }).eq("id",recordId);
    if (saveReadyError) throw new Error("Черновик заполнен, но статус в КПК МИА не сохранился: "+saveReadyError.message);
    return NextResponse.json({
      ok:true,realDraftCreated:true,supplyBooked:false,
      draftId,runId:recordId,
      skuCount:draftItems.length,units:plan.summary.eligibleUnits,
      cartons:plan.summary.transportCartons,
      message:"Черновик WB создан, товары записаны и проверены. Таймслот, пункт сдачи и упаковка оформляются в кабинете WB.",
    });
  } catch(error) {
    const message = error instanceof Error ? error.message : "Ошибка создания черновика WB";
    if (recordId) {
      try {
        const db=createAdminClient();
        await db.from("wb_fbw_draft_runs").update({
          status:draftId?"draft_created":"failed",
          draft_id:draftId,error_message:message.slice(0,1400),updated_at:new Date().toISOString(),
        }).eq("id",recordId);
      } catch { /* Error must still be visible to the operator. */ }
    }
    return NextResponse.json({
      ok:false,draftId,runId:recordId,realDraftCreated:!!draftId,supplyBooked:false,
      error:message,manualReviewRequired:!!draftId,
    },{status:502});
  }
}
