"use client";
import { DateField } from "@/app/ui/WorkspaceDateFields";
import {useCallback,useEffect,useMemo,useState} from "react";
import {VED_TARIFFS,type VedTariffKey,type TariffRow} from "@/lib/ved-calculation/tariffs";
import "./ved-tariffs.css";
type Response={ok:boolean;error?:string;canEdit?:boolean;selected?:Record<string,TariffRow>;history?:TariffRow[];fxError?:string|null};
const groups=["Курсы","Контейнеры и фуры","Логистика","Разовые расходы","Налоги"] as const;
const itemsForGroup=(group:typeof groups[number])=>VED_TARIFFS.filter(item=>
 group==="Контейнеры и фуры"
  ? item.section==="Контейнер"||item.section==="Фуры"
  : item.section===group
);
const fmt=(n:number,digits=6)=>new Intl.NumberFormat("ru-RU",{minimumFractionDigits:digits===2?2:0,maximumFractionDigits:digits}).format(n);
const currencyKeys=new Set<VedTariffKey>(["usdRub","eurRub","cnyRub"]);
const today=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Moscow"});
export default function VedTariffEditor(){
 const [date,setDate]=useState(today),[data,setData]=useState<Response|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 const [key,setKey]=useState<VedTariffKey>("usableVolumeM3"),[amount,setAmount]=useState("");
 const [effectiveFrom,setEffectiveFrom]=useState(today),[reason,setReason]=useState("");
 const [filter,setFilter]=useState(""),[editorOpen,setEditorOpen]=useState(false);
 const fetchRates=useCallback(async(d:string)=>{
  setLoading(true);setError("");
  try{
   const res=await fetch("/api/ved-tariffs?asOf="+encodeURIComponent(d)+"&history=1",{cache:"no-store"});
   const json=await res.json() as Response;
   if(!res.ok||!json.ok)throw Error(json.error||"Ошибка загрузки справочника");
   setData(json);
  }catch(e){setData(null);setError(e instanceof Error?e.message:"Не удалось загрузить справочник");}
  finally{setLoading(false);}
 },[]);
 useEffect(()=>{void fetchRates(date)},[fetchRates,date]);
 const current=useMemo(()=>VED_TARIFFS.find(t=>t.key===key)!,[key]);
 const edit=(k:VedTariffKey,row?:TariffRow)=>{
  setKey(k);setAmount(row?String(row.amount):"");setEffectiveFrom(today());setReason("");setEditorOpen(true);
 };
 const save=async()=>{
  const value=Number(amount);
  if(!amount.trim()||!Number.isFinite(value)||value<0){setError("Введите корректное неотрицательное значение");return;}
  setSaving(true);setError("");
  try{
   const res=await fetch("/api/ved-tariffs",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({key,amount:value,effectiveFrom,reason})});
   const json=await res.json() as Response;
   if(!res.ok||!json.ok)throw Error(json.error||"Не удалось сохранить");
   setEditorOpen(false);setAmount("");setReason("");setDate(effectiveFrom);
   await fetchRates(effectiveFrom);
  }catch(e){setError(e instanceof Error?e.message:"Ошибка сохранения");}
  finally{setSaving(false);}
 };
 return <article className="ved-module-panel ved-tariffs">
  <div className="ved-tariffs-top">
   <div><h2>Единые справочники тарифов</h2><p>Каждая редакция сохраняется отдельно с датой действия. Старые расчёты не пересчитываются.</p></div>
   <label className="ved-tariffs-control"><span>Показать значения на дату</span>
    <DateField  value={date} onChange={e=>setDate(e.target.value)}/></label>
  </div>
  {error&&<p role="alert" className="ved-tariffs-error">{error}</p>}
  {data?.fxError&&<p role="alert" className="ved-tariffs-error">Курсы ЦБ недоступны: {data.fxError}. Транспортные константы доступны, валютные значения не подменяются старыми.</p>}
  {loading&&<p className="ved-tariffs-muted">Загрузка…</p>}
  <div className="ved-tariffs-groups">
   {groups.map(group=><section key={group} className="ved-tariffs-group">
    <h3>{group}</h3><div className="ved-tariffs-rows">
     {itemsForGroup(group).map(item=>{
      const row=data?.selected?.[item.key];
      return <div className="ved-tariffs-line" key={item.key}>
       <span>{item.title}</span>
       <div className="ved-tariffs-value">
        <strong>{row?fmt(Number(row.amount),item.section==="Курсы"?2:6):"Не установлено"} <small>{row?item.unit:""}</small></strong>
        {data?.canEdit&&!item.automatic&&<button type="button" className="ved-tariffs-edit-button"
         onClick={()=>edit(item.key,row)} title="Редактировать" aria-label={"Редактировать: "+item.title}>✎</button>}
       </div>
       <span className="ved-tariffs-valid">{row?"с "+row.effective_from+(item.automatic?" · ЦБ":""):item.automatic?"Нет данных ЦБ":"Значение не задано"}</span>
      </div>;
     })}
    </div>
   </section>)}
  </div>
  <p className="ved-tariffs-muted">USD и EUR по официальному курсу ЦБ. CNY для ВЭД: официальный курс ЦБ + 1 ₽. В верхней панели CNY отображается без надбавки.</p>
  {data?.canEdit&&<section className="ved-tariffs-editor">
   <div className="ved-tariffs-editor-title">
    <strong>{editorOpen?"Новая редакция параметра":"Редактирование параметров"}</strong>
    <button type="button" onClick={()=>{setEditorOpen(v=>!v);setKey("usableVolumeM3");setAmount("");}}>
     {editorOpen?"Закрыть":"Редактировать"}
    </button>
   </div>
   {editorOpen&&<div className="ved-tariffs-form">
    <label className="ved-tariffs-control"><span>Параметр</span>
     <select value={key} onChange={e=>{const k=e.target.value as VedTariffKey;setKey(k);setAmount(data?.selected?.[k]?String(data.selected[k].amount):"");}}>
      {VED_TARIFFS.filter(t=>!t.automatic).map(t=><option value={t.key} key={t.key}>{t.title}</option>)}
     </select></label>
    <label className="ved-tariffs-control"><span>Значение ({current.unit})</span>
     <input inputMode="decimal" type="number" min="0" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <label className="ved-tariffs-control"><span>Действует с даты</span>
     <DateField  value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)}/></label>
    <label className="ved-tariffs-control"><span>Причина изменения / источник</span>
     <input type="text" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Договор перевозчика, решение ВЭД…"/></label>
    <button type="button" disabled={saving||!effectiveFrom} onClick={()=>void save()}>{saving?"Сохранение…":"Сохранить новую редакцию"}</button>
   </div>}
  </section>}
  {data?.canEdit&&<details className="ved-tariffs-editor">
   <summary>История изменений ({data.history?.length??0} последних записей)</summary>
   <label className="ved-tariffs-control"><span>Фильтр истории</span>
    <input className="workspace-search-field" aria-label="Поиск по истории тарифов" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
   <div className="ved-tariffs-history">
    {(data.history||[]).filter(row=>!filter||VED_TARIFFS.find(t=>t.key===row.tariff_key)?.title.toLowerCase().includes(filter.toLowerCase())).map(row=><div className="ved-tariffs-line" key={row.id}>
     <span>{VED_TARIFFS.find(t=>t.key===row.tariff_key)?.title||row.tariff_key}</span>
     <strong>{fmt(Number(row.amount),currencyKeys.has(row.tariff_key)?2:6)}</strong>
     <span className="ved-tariffs-valid">{row.effective_from} · {row.reason||"Без комментария"}</span>
    </div>)}
   </div>
  </details>}
  <p className="ved-tariffs-muted">Исторические расчёты хранят применённые значения в отдельных версиях.</p>
 </article>;
}
