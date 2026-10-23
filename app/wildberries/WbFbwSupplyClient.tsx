"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PlanItem = {
  nmId:number;article:string;name:string;masterCode:string|null;sku:string;
  stock:number;sales28:number;rawNeed:number;pack:number|null;cartons:number;
  quantity:number;cartonSizeMm:[number,number,number]|null;
  cartonWeightKg:number|null;blockingReason:string|null;warnings:string[];
};
type Plan = {
  ok:true;scope:string;calculatedAt:string;fingerprint:string;
  period:{start:string;end:string;days:number};stockSnapshotId:string|null;
  items:PlanItem[];
  summary:{
    demandedSku:number;eligibleSku:number;eligibleUnits:number;
    transportCartons:number;blockedSku:number;zeroAfterPackSku:number;missingPackagingSku:number;
  };
  packRule:string;limitations:string[];
};
type DraftRun = {
  id:string;status:string;draft_id:string|null;sku_count:number;
  units:number;cartons:number;error_message:string|null;created_at:string;period_end:string;
};

const number = (value:number) => new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(value);
function csvEscape(value:unknown):string {
  const s = String(value ?? "");
  return '"' + s.replace(/"/g,'""') + '"';
}
function downloadCartons(plan:Plan):void {
  const rows:string[][] = [[
    "Грузоместо №","Тип","Артикул WB","Артикул продавца","ЕНОТ","Баркод WB",
    "Штук в коробке","Длина, мм","Ширина, мм","Высота, мм","Вес, кг",
  ]];
  let boxNumber=0;
  for (const item of plan.items) {
    if (item.blockingReason || item.quantity<=0 || !item.pack) continue;
    for (let i=0;i<item.cartons;i++) {
      boxNumber++;
      rows.push([
        String(boxNumber),"Короб",String(item.nmId),item.article,item.masterCode || "",
        item.sku,String(item.pack),String(item.cartonSizeMm?.[0] ?? ""),
        String(item.cartonSizeMm?.[1] ?? ""),String(item.cartonSizeMm?.[2] ?? ""),
        String(item.cartonWeightKg ?? ""),
      ]);
    }
  }
  const csv = "\uFEFF" + rows.map(row => row.map(csvEscape).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const element=document.createElement("a");
  element.href=url;
  element.download="WB_FBW_Грузоместа_"+plan.period.end+".csv";
  document.body.append(element);
  element.click();
  element.remove();
  URL.revokeObjectURL(url);
}

export default function WbFbwSupplyClient() {
  const [plan,setPlan]=useState<Plan|null>(null);
  const [runs,setRuns]=useState<DraftRun[]>([]);
  const [loading,setLoading]=useState(false);
  const [creating,setCreating]=useState(false);
  const [message,setMessage]=useState("");
  const [lastDraft,setLastDraft]=useState<string|null>(null);
  const eligible = useMemo(()=>plan?.items.filter(x=>x.quantity>0 && !x.blockingReason) || [],[plan]);
  const attention = useMemo(()=>plan?.items.filter(x=>x.blockingReason || x.warnings.length) || [],[plan]);

  const loadHistory=useCallback(async ()=>{
    try {
      const res=await fetch("/api/wb/fbw/drafts",{cache:"no-store"});
      const json=await res.json();
      if (json.ok && Array.isArray(json.runs)) setRuns(json.runs as DraftRun[]);
    } catch { /* Non-critical: the next button can refresh the list. */ }
  },[]);
  useEffect(()=>{void loadHistory();},[loadHistory]);

  async function calculate() {
    setLoading(true);setMessage("");setLastDraft(null);setPlan(null);
    try {
      const res=await fetch("/api/wb/fbw/plan",{cache:"no-store"});
      const json=await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Не удалось рассчитать поставку");
      setPlan(json as Plan);
      setMessage("План рассчитан. WB пока ничего не отправляли.");
    } catch(e) {
      setMessage(e instanceof Error ? e.message : "Ошибка расчёта");
    } finally {setLoading(false);}
  }

  async function createDraft() {
    if (!plan || creating || !eligible.length) return;
    const accepted=window.confirm(
      "Создать НАСТОЯЩИЙ черновик в Wildberries на "+number(plan.summary.eligibleUnits)+
      " шт. ("+number(plan.summary.transportCartons)+" коробов)? Поставка и таймслот не подтверждаются."
    );
    if (!accepted) return;
    setCreating(true);setMessage("");
    try {
      const res=await fetch("/api/wb/fbw/drafts",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({fingerprint:plan.fingerprint}),
      });
      const json=await res.json();
      if (!res.ok || !json.ok) {
        if (json.draftId || json.existing?.draft_id) setLastDraft(json.draftId || json.existing.draft_id);
        throw new Error(json.error || "WB отклонил черновик");
      }
      setLastDraft(json.draftId as string);
      setMessage("Черновик WB № "+json.draftId+" создан. "+json.skuCount+
        " баркодов, "+number(json.units)+" шт. и "+number(json.cartons)+" транспортировочных коробов. Склад, СЦ, таймслот и упаковка оформляются в кабинете WB.");
    } catch(e) {setMessage(e instanceof Error ? e.message : "Ошибка создания черновика");}
    finally {setCreating(false);void loadHistory();}
  }

  return <section className="section wb-fbw-section">
    <div className="wb-fbw-heading">
      <div>
        <h2 className="section-title">Поставка FBW: расчёт и черновики</h2>
        <p className="muted">
          Вся Россия, без кластеров и FBS. Один баркод в коробе, количество кратно транспортировочной вложимости.
        </p>
      </div>
      <div className="wb-fbw-actions">
        <button className="primary-button" type="button" disabled={loading||creating} onClick={()=>void calculate()}>
          {loading?"Проверяем данные…":"Рассчитать поставку"}
        </button>
        <button className="primary-button" type="button" disabled={!plan||!eligible.length||creating||loading} onClick={()=>void createDraft()}>
          {creating?"Создаём черновик…":"Создать черновик в WB"}
        </button>
        <button className="secondary-button" type="button" disabled={!plan||!eligible.length} onClick={()=>plan&&downloadCartons(plan)}>
          Скачать грузоместа CSV
        </button>
      </div>
    </div>
    {message&&<p className="wb-fbw-message" role="status">{message}</p>}
    {lastDraft&&<p className="muted">ID настоящего черновика WB: <code>{lastDraft}</code></p>}
    <p className="muted">
      Создаётся именно черновик. Опубликованный FBW API не даёт программно забронировать таймслот,
      определить конечный склад при сдаче в СЦ или записать грузоместа. CSV формируется для последующего оформления в кабинете.
    </p>
    {plan&&<>
      <div className="wb-fbw-kpis">
        <div className="card"><span className="card-label">SKU с потребностью</span><strong>{number(plan.summary.demandedSku)}</strong></div>
        <div className="card"><span className="card-label">SKU к отправке</span><strong>{number(plan.summary.eligibleSku)}</strong></div>
        <div className="card"><span className="card-label">Штук к отправке</span><strong>{number(plan.summary.eligibleUnits)}</strong></div>
        <div className="card"><span className="card-label">Транспортных коробов</span><strong>{number(plan.summary.transportCartons)}</strong></div>
        <div className="card"><span className="card-label">Заблокировано SKU</span><strong>{number(plan.summary.blockedSku)}</strong></div>
      </div>
      <p className="muted">Период продаж: {plan.period.start} → {plan.period.end}. {plan.packRule}</p>
      {plan.summary.missingPackagingSku>0&&
        <p className="wb-fbw-warning">Размеры или вес короба не заполнены у {plan.summary.missingPackagingSku} SKU. Состав черновика возможен по вложимости, но реальную маркировку нужно проверить.</p>
      }
      <div className="wb-fbw-scroll">
        <table className="wb-fbw-table">
          <thead><tr><th>Артикул</th><th>Баркод</th><th>Остаток РФ</th><th>Заказов 28 д.</th><th>Потребность</th><th>Вложимость</th><th>Коробов</th><th>Штук</th><th>Проверка</th></tr></thead>
          <tbody>{plan.items.map((x,i)=><tr key={String(x.nmId)+"-"+i}>
            <td><strong>{x.article}</strong><small>{x.masterCode||"Нет ЕНОТ"}</small></td>
            <td>{x.sku||"—"}</td><td>{number(x.stock)}</td><td>{number(x.sales28)}</td>
            <td>{number(x.rawNeed)}</td><td>{x.pack??"—"}</td>
            <td>{number(x.cartons)}</td><td><strong>{number(x.quantity)}</strong></td>
            <td className={x.blockingReason?"wb-fbw-bad":"wb-fbw-note"}>{x.blockingReason||x.warnings.join("; ")||"Готово"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {attention.length>0&&<p className="muted">Позиций, требующих проверки: {attention.length}. Причина указана в последнем столбце таблицы.</p>}
    </>}
    <div className="wb-fbw-history">
      <div className="wb-fbw-history-title"><h3>История черновиков</h3>
        <button className="secondary-button" type="button" onClick={()=>void loadHistory()}>Обновить</button>
      </div>
      {runs.length===0?<p className="muted">Черновиков этого модуля пока нет.</p>:
        <div className="wb-fbw-scroll"><table className="wb-fbw-table">
          <thead><tr><th>Создан</th><th>ID WB</th><th>SKU</th><th>Шт.</th><th>Коробов</th><th>Статус</th></tr></thead>
          <tbody>{runs.map(x=><tr key={x.id}><td>{new Date(x.created_at).toLocaleString("ru-RU")}</td>
            <td>{x.draft_id||"—"}</td><td>{x.sku_count}</td><td>{number(x.units)}</td>
            <td>{number(x.cartons)}</td><td>{x.status}{x.error_message&&<small>{x.error_message}</small>}</td>
          </tr>)}</tbody>
        </table></div>}
    </div>
  </section>;
}
