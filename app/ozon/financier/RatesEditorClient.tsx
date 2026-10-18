"use client";
import { useCallback, useEffect, useMemo, useState } from "react";

type Rate = {
  master_code: string; offer_id: string; name: string | null; manager: string;
  cost: number | null; cost_date: string | null;
  mayak: number | null; mayak_date: string | null;
};
function today() { return new Date().toISOString().slice(0,10); }
function asNumericCell(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n=Number(String(value).trim().replace(",","."));
  if (!Number.isFinite(n) || n<0) throw new Error("Некорректная цена в файле: " + String(value));
  return n;
}
async function execute(payload: Record<string,unknown>) {
  const response=await fetch("/api/agents/ozon-finance",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify(payload),cache:"no-store",
  });
  const result=await response.json();
  if(!response.ok || !result.ok) throw new Error(result.error || "Ошибка сохранения");
  return result;
}
export default function RatesEditorClient() {
  const [rates,setRates]=useState<Rate[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [query,setQuery]=useState("");
  const [selected,setSelected]=useState("");
  const [effectiveDate,setEffectiveDate]=useState(today);
  const [manager,setManager]=useState("");
  const [cost,setCost]=useState("");
  const [mayak,setMayak]=useState("");
  const getRates=useCallback(async()=>{
    try{
      const r=await fetch("/api/agents/ozon-finance?mode=settings",{cache:"no-store"});
      const json=await r.json();
      if(!r.ok || !json.ok) throw new Error(json.error || "Не удалось получить тарифы");
      setRates(json.rows || []);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setLoaded(true);}
  },[]);
  useEffect(()=>{void getRates();},[getRates]);
  const visible=useMemo(()=>rates.filter(r=>(
    r.master_code+" "+r.offer_id+" "+(r.name||"")+" "+r.manager
  ).toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"))).slice(0,150),[query,rates]);
  const current=rates.find(r=>r.master_code===selected);
  function choose(r:Rate){
    setSelected(r.master_code);
    setManager(r.manager==="Не назначен"?"":r.manager);
    setCost(r.cost===null?"":String(r.cost));
    setMayak(r.mayak===null?"":String(r.mayak));
    setMessage("");
  }
  async function save(){
    if(!current) return;
    if(!effectiveDate){setError("Укажите дату начала действия тарифа");return;}
    setBusy(true);setError("");setMessage("");
    try{
      const payload:Record<string,unknown>={
        action:"saveProduct",master_code:current.master_code,
        manager:manager.trim(),valid_from:effectiveDate,
      };
      if(cost.trim()!=="") payload.cost=asNumericCell(cost);
      if(mayak.trim()!=="") payload.mayak=asNumericCell(mayak);
      await execute(payload);
      setMessage("Сохранено: "+current.master_code+". Тарифы действуют с "+effectiveDate);
      await getRates();
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  async function uploadWorkbook(file:File){
    if(!effectiveDate){setError("Сначала укажите дату начала действия данных");return;}
    if(!window.confirm(
      "Импорт "+file.name+" заменит тарифы и назначение КМ для совпавших master_code с датой "+effectiveDate+". Продолжить?"
    ))return;
    setBusy(true);setError("");setMessage("");
    try{
      const XLSX=await import("xlsx");
      const book=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});
      if(!book.SheetNames.length)throw new Error("В файле нет листов");
      const arr= XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[book.SheetNames[0]],{header:1,defval:null,raw:true});
      const headers=arr[0] || [];
      const expected=["Код товара","КМ","Артикул","Product id","Название","SKU","Категория","Цена закупа","ТК маяк"];
      if(expected.some((x,i)=>String(headers[i]??"").trim().toLocaleLowerCase("ru")!==x.toLocaleLowerCase("ru")))
        throw new Error("Неверные столбцы. Ожидаются A: Код товара, B: КМ, D: Product id, F: SKU, H: Цена закупа, I: ТК маяк.");
      const rows=arr.slice(1).filter(x=>x.some(v=>v!==null&&v!=="")).map(x=>({
        master_code:x[0]==null?"":String(x[0]).trim(),
        manager:x[1]==null?"":String(x[1]).trim(),
        offer_id:x[2]==null?"":String(x[2]).trim(),
        product_id:x[3]==null?"":String(x[3]).trim(),
        sku:x[5]==null?"":String(x[5]).trim(),
        cost:asNumericCell(x[7]),mayak:asNumericCell(x[8]),
      }));
      const result=await execute({action:"importWorkbook",rows,valid_from:effectiveDate});
      setMessage("Импортировано "+result.imported+" товаров: себестоимость "+result.prices+
        ", ТК Маяк "+result.mayak+", КМ "+result.managers+". Строк без master_code: "+result.skipped_blank_rows+".");
      await getRates();
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setBusy(false);}
  }
  return (
    <section id="ozf-rates" className="ozf-panel ozf-rates">
      <div className="ozf-toolbar">
        <div>
          <h2>Справочник: закупка, ТК Маяк и КМ</h2>
          <p>Настройки редактируются на сайте независимо от того, загружен ли финансовый отчёт Ozon.</p>
        </div>
        <span className="ozf-count">{loaded?rates.length+" master_code":"Загрузка…"}</span>
      </div>
      <div className="ozf-rate-controls">
        <label>Тарифы действуют с
          <input type="date" value={effectiveDate} onChange={e=>setEffectiveDate(e.target.value)} disabled={busy}/>
        </label>
        <label>Импорт Excel (A:I)
          <input type="file" accept=".xlsx,.xls" disabled={busy} onChange={e=>{
            const file=e.target.files?.[0];
            if(file)void uploadWorkbook(file);
            e.currentTarget.value="";
          }}/>
        </label>
        <label>Найти товар
          <input value={query} onChange={e=>setQuery(e.target.value)}
            placeholder="Код, артикул, КМ или название"/>
        </label>
      </div>
      <p className="ozf-footnote">При импорте сверяем Product ID и master_code с базой. Пустую себестоимость не заменяем нулём. Повторная загрузка на ту же дату обновит тарифы, поэтому импорт требует подтверждения.</p>
      {error&&<p className="ozf-error" role="alert">{error}</p>}
      {message&&<p className="ozf-progress" role="status">{message}</p>}
      <div className="ozf-table-scroll ozf-rates-scroll">
        <table className="ozf-table"><thead><tr>
          <th>master_code</th><th>Артикул Ozon</th><th>КМ</th><th>Себестоимость, ₽/шт</th><th>ТК Маяк, ₽/шт</th>
        </tr></thead><tbody>
          {visible.map(r=><tr key={r.master_code} className={selected===r.master_code?"ozf-row-active":""} onClick={()=>choose(r)}>
            <td><b>{r.master_code}</b></td><td>{r.offer_id}<small>{r.name||""}</small></td>
            <td>{r.manager}</td><td>{r.cost===null?"Не задана":r.cost.toLocaleString("ru-RU")}</td>
            <td>{r.mayak===null?"Не задан":r.mayak.toLocaleString("ru-RU")}</td>
          </tr>)}
        </tbody></table>
      </div>
      <p className="ozf-footnote">Показано {visible.length} из {rates.filter(r=>(r.master_code+" "+r.offer_id+" "+(r.name||"")+" "+r.manager).toLocaleLowerCase("ru").includes(query.toLocaleLowerCase("ru"))).length} совпадений. Используйте поиск для остальных.</p>
      {current&&<div className="ozf-rate-edit">
        <div><h3>{current.master_code} · {current.offer_id}</h3>
          <p>Правки применяются ко всем размещениям с этим master_code. Ранее записанные тарифы по другим датам сохраняются.</p>
        </div>
        <div className="ozf-edit">
          <label>Ответственный КМ<input value={manager} onChange={e=>setManager(e.target.value)}/></label>
          <label>Закупка, ₽/шт<input inputMode="decimal" value={cost} onChange={e=>setCost(e.target.value)} placeholder="Не задана"/></label>
          <label>ТК Маяк, ₽/шт<input inputMode="decimal" value={mayak} onChange={e=>setMayak(e.target.value)} placeholder="Не задан"/></label>
          <button className="ozf-btn ozf-primary" disabled={busy} onClick={()=>void save()}>
            {busy?"Сохраняем…":"Сохранить изменения"}
          </button>
        </div>
      </div>}
    </section>
  );
}
