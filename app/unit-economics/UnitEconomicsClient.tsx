"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import type {DragEvent} from "react";
import {MODELS,MARKET_NAMES,WORKBOOK_URL,type ModelKey,type Marketplace,type SheetData} from "@/lib/unit-economics/model-config";

type Payload={data:SheetData;live:boolean;asOf:string;partial:boolean;warning?:string};
type StoredView={order:number[];hidden:number[]};
const marketplaces:Marketplace[]=["ozon","wb","ym"];
const choices:Record<Marketplace,ModelKey[]>={ozon:["ozon-fbo","ozon-fbs"],wb:["wb-fbw","wb-fbs"],ym:["ym-fby","ym-fbs"]};
const importantNames=["Наименование товара","Артикул","Код товара","Предмет","Категория","Себестоимость","Цена продажи","Цена Акции","Комиссия","Ст-ть логистики","Логистика","ТК Маяк","Эквайринг","ДРР","НДС","Чистая прибыль","Маржинальность","Рентабельность"];
const fmt=(value:string)=>value.replace(/\n/g," ").trim();
const colName=(index:number)=>{let n=index+1,s="";while(n){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26)}return s};
const defaultColumns=(data:SheetData)=>data.headers.map((h,i)=>({h,i})).filter(x=>x.h&&importantNames.some(t=>x.h.includes(t))).map(x=>x.i);
const numberValue=(s:string)=>Number(s.replace(/[\s\u00a0₽%]/g,"").replace(",",".").replace(/[^\d.\-]/g,""));
function readPreference(key:string):StoredView|null{try{const s=localStorage.getItem("unit-columns-v1:"+key);return s?JSON.parse(s) as StoredView:null}catch{return null}}
function writePreference(key:string,view:StoredView){try{localStorage.setItem("unit-columns-v1:"+key,JSON.stringify(view))}catch{/* Local preferences are optional. */}}
export default function UnitEconomicsClient(){
 const [market,setMarket]=useState<Marketplace>("ozon");
 const [selected,setSelected]=useState<Record<Marketplace,ModelKey>>({ozon:"ozon-fbo",wb:"wb-fbw",ym:"ym-fby"});
 const model=selected[market];
 const [payload,setPayload]=useState<Payload|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [settings,setSettings]=useState(false);
 const [order,setOrder]=useState<number[]>([]);
 const [hidden,setHidden]=useState<number[]>([]);
 const [dragging,setDragging]=useState<number|null>(null);
 const [analyst,setAnalyst]=useState(false);
 const [connected,setConnected]=useState(false);
 const [editOpen,setEditOpen]=useState(false);
 const [editCell,setEditCell]=useState("");
 const [editValue,setEditValue]=useState("");
 const [saveMessage,setSaveMessage]=useState("");
 useEffect(()=>{let alive=true;fetch("/api/unit-economics?kind=meta",{cache:"no-store"}).then(r=>r.json()).then(j=>{if(alive){setAnalyst(j.analyst===true);setConnected(j.googleConnected===true)}}).catch(()=>{});return()=>{alive=false}},[]);
 useEffect(()=>{
  let alive=true;setLoading(true);setPayload(null);setError("");setSettings(false);setSearch("");
  fetch("/api/unit-economics?kind=model&model="+model,{cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||"Не удалось прочитать таблицу");return data as Payload})
  .then(result=>{if(!alive)return;setPayload(result);const available=result.data.headers.map((h,i)=>h?i:-1).filter(i=>i>=0);const preference=readPreference(model);if(preference){const valid=preference.order.filter(i=>available.includes(i));setOrder([...valid,...available.filter(i=>!valid.includes(i))]);setHidden(preference.hidden.filter(i=>available.includes(i)))}else{setOrder(available);setHidden(available.filter(i=>!defaultColumns(result.data).includes(i)))}setLoading(false)})
  .catch(e=>{if(alive){setError(String(e));setLoading(false)}});
  return()=>{alive=false};
 },[model]);
 const data=payload?.data;
 const visible=useMemo(()=>order.filter(i=>!hidden.includes(i)),[order,hidden]);
 const filtered=useMemo(()=>{
  const rows=data?.rows??[];const term=search.trim().toLowerCase();
  if(!term)return rows;return rows.filter(r=>r.v.slice(0,7).some(v=>v?.toLowerCase().includes(term)));
 },[data,search]);
 const updateView=(nextOrder:number[],nextHidden:number[])=>{setOrder(nextOrder);setHidden(nextHidden);writePreference(model,{order:nextOrder,hidden:nextHidden})};
 function dropColumn(event:DragEvent<HTMLLIElement>,target:number){
  event.preventDefault();if(dragging===null||dragging===target)return;
  const next=order.filter(i=>i!==dragging);next.splice(next.indexOf(target),0,dragging);updateView(next,hidden);setDragging(null);
 }
 function move(index:number,step:number){const a=[...order],p=a.indexOf(index),next=p+step;if(next<0||next>=a.length)return;[a[p],a[next]]=[a[next],a[p]];updateView(a,hidden)}
 async function saveConstant(){
  const v=Number(editValue.replace(",","."));
  if(!editCell||!Number.isFinite(v)||editValue.trim()===""){setSaveMessage("Введите корректное значение");return}
  setSaveMessage("Сохранение...");
  try{
   const response=await fetch("/api/unit-economics",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"constant",model,cell:editCell,value:v})});
   const json=await response.json();if(!response.ok)throw Error(json.error||"Не удалось обновить");
   setSaveMessage("Значение сохранено в Google Sheets. Обновите страницу для пересчёта.");
  }catch(e){setSaveMessage(e instanceof Error?e.message:"Ошибка записи")}
 }
 const constants=(data?.constants??[]).map((value,i)=>({value,cell:colName(i)+"2",title:data?.headers[i]??""})).filter(item=>item.value&&/(\d|%|₽)/.test(item.value)&&!item.value.includes("////"));
 return <section className="unit-body">
  <div className="unit-actions">
   <div className="unit-actions-main"><Link href="/unit-economics/commissions" className="unit-button">Комиссии</Link><Link href="/unit-economics/logistics" className="unit-button">Логистика и тарифы</Link></div>
   <a href={WORKBOOK_URL} target="_blank" rel="noopener noreferrer" className="unit-external">Открыть исходные Google Таблицы ↗</a>
  </div>
  <div className="unit-market-tabs" role="tablist" aria-label="Маркетплейс">{marketplaces.map(m=><button role="tab" aria-selected={m===market} className={m===market?"active":""} onClick={()=>setMarket(m)} key={m}>{MARKET_NAMES[m]}</button>)}</div>
  <div className="unit-model-bar"><span>Модель продаж</span><div className="unit-model-tabs" role="tablist">{choices[market].map(k=><button role="tab" aria-selected={k===model} key={k} onClick={()=>setSelected(x=>({...x,[market]:k}))} className={k===model?"active":""}>{MODELS[k].label}</button>)}</div><span className="unit-model-caption">{MODELS[model].tab}</span></div>
  {payload&&!payload.live&&<div className="unit-notice">Данные: сохранённый снимок от {payload.asOf.slice(0,10)}. {payload.partial?"Он не содержит все строки исходной книги. ":""}Для постоянной синхронизации требуется подключение сервисного аккаунта Google в настройках сервера.</div>}
  {payload?.warning&&<div className="unit-warning">{payload.warning}</div>}
  <div className="unit-table-toolbar">
   <div className="unit-table-title">Расчётная таблица <span>{filtered.length} строк</span></div>
   <div className="unit-toolbar-right"><input className="workspace-search-field" aria-label="Поиск товара" value={search} onChange={e=>setSearch(e.target.value)}/>
   {analyst&&<button className="unit-button" onClick={()=>{setEditOpen(!editOpen);setSettings(false);setSaveMessage("")}}>Поменять тарифы</button>}
   <button type="button" className={"unit-gear "+(settings?"active":"")} aria-label="Настройка отображения столбцов" aria-expanded={settings} onClick={()=>{setSettings(!settings);setEditOpen(false)}} title="Показать / скрыть и перетащить столбцы">⚙</button></div>
  </div>
  {editOpen&&analyst&&<section className="unit-settings-panel"><b>Изменение констант {MODELS[model].label}</b><p>Текущие значения из строки 2 исходной юнитки. Изменять разрешено только роли «Аналитик».</p><div className="unit-editor"><select value={editCell} onChange={e=>{setEditCell(e.target.value);setEditValue("")}}><option value="">Выберите константу</option>{constants.map(c=><option key={c.cell} value={c.cell}>{c.cell}: {c.title||"Константа"} · {c.value}</option>)}</select><input aria-label="Новое значение" placeholder="Новое числовое значение" value={editValue} onChange={e=>setEditValue(e.target.value)}/><button onClick={saveConstant} disabled={!connected||!editCell}>Сохранить</button></div>{!connected&&<p className="unit-warning">Запись недоступна до подключения Google Sheets на сервере. Значения здесь пока только для просмотра.</p>}<p role="status">{saveMessage}</p></section>}
  {settings&&data&&<aside className="unit-settings-panel" aria-label="Настройки столбцов"><div className="unit-settings-title"><b>Отображение и порядок столбцов</b><button onClick={()=>{const h=order.filter(i=>!defaultColumns(data).includes(i));updateView(order,h)}}>Сбросить видимость</button></div><p>Перетаскивайте строки за ☰, чтобы менять порядок. Можно также использовать стрелки.</p><ul className="unit-columns-list">{order.map((i,n)=><li draggable onDragStart={()=>setDragging(i)} onDragOver={e=>e.preventDefault()} onDrop={e=>dropColumn(e,i)} onDragEnd={()=>setDragging(null)} key={i} className={dragging===i?"dragging":""}><span className="unit-drag" aria-hidden>☰</span><label><input type="checkbox" checked={!hidden.includes(i)} onChange={()=>updateView(order,hidden.includes(i)?hidden.filter(x=>x!==i):[...hidden,i])}/><span>{colName(i)} · {fmt(data.headers[i]||"Столбец")}</span></label><button aria-label="Переместить вверх" disabled={n===0} onClick={()=>move(i,-1)}>↑</button><button aria-label="Переместить вниз" disabled={n===order.length-1} onClick={()=>move(i,1)}>↓</button></li>)}</ul></aside>}
  {loading?<p className="unit-loading">Загружаю расчёты...</p>:error?<p className="unit-warning">{error}</p>:data?<div className="unit-table-scroller" role="region" aria-label="Таблица юнит-экономики" tabIndex={0}><table className="unit-data-table"><thead><tr>{visible.map(i=><th key={i} scope="col" title={data.headers[i]}>{fmt(data.headers[i])}<span className="unit-col-label">{colName(i)}</span></th>)}</tr></thead><tbody>{filtered.map(row=><tr key={row.r} title={"Строка Google Sheets: "+row.r}>{visible.map((i,n)=><td key={i} className={n===0?"unit-key-cell":""} title={fmt(row.v[i]||"")}>{fmt(row.v[i]||"")}</td>)}</tr>)}{filtered.length===0&&<tr><td colSpan={Math.max(1,visible.length)}>Товары не найдены</td></tr>}</tbody></table></div>:null}
  {data&&<details className="unit-constants"><summary>Справочник констант · {MODELS[model].label} ({constants.length})</summary><p>Значения на дату получения данных. Нормативы из ваших Google Sheets сохраняются без изменения.</p><div className="unit-constants-scroller"><table><thead><tr><th>Ячейка</th><th>Что означает</th><th>Текущее значение</th></tr></thead><tbody>{constants.map(c=><tr key={c.cell}><td>{c.cell}</td><td>{c.title||"Внутренний норматив / тариф"}</td><td>{c.value}</td></tr>)}</tbody></table></div></details>}
 </section>;
}
