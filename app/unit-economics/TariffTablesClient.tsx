"use client";
import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import type {ChangeEvent} from "react";
import {MARKET_NAMES,WORKBOOK_URL,type Marketplace} from "@/lib/unit-economics/model-config";
type TariffPayload={data:{name:string;rows:(string|null)[][]};live:boolean;asOf:string;partial:boolean};
const getKeys=(market:Marketplace,kind:"commissions"|"logistics")=>kind==="logistics"?[market+"-logistics"] :market==="ozon"?["ozon-fbo","ozon-fbs"]:market==="wb"?["wb"]:["ym-fby","ym-fbs"];
const models:Marketplace[]=["ozon","wb","ym"];
type ViewData={columns:string[];rows:string[][]};
function clean(v:string|null|undefined){return String(v??"").trim().replace(/\s+/g," ")}
function merge(market:Marketplace,kind:"commissions"|"logistics",payloads:TariffPayload[]):ViewData{
 const primary=payloads[0]?.data.rows??[],secondary=payloads[1]?.data.rows??[];
 if(kind==="logistics"){
  if(market==="wb")return {columns:["Параметр","Тариф / значение","Условия","Источник"],rows:primary.slice(1).filter(r=>r.some(Boolean)).map(r=>[clean(r[0]),clean(r[1]),clean(r[2]),clean(r[3]??r[5])])};
  return {columns:["Объём, л","> 300 ₽, логистика","Объём, л","До 300 ₽, логистика","Зона приёмки","Точка приёма","Кластер","Склад"],rows:primary.slice(2).filter(r=>r.some(Boolean)).map(r=>[clean(r[0]),clean(r[1]),clean(r[3]),clean(r[4]),clean(r[8]),clean(r[9]),clean(r[10]),clean(r[11])])};
 }
 if(market==="ozon"){
  return {columns:["Тип товара","Категория","Группа","FBO до 100 ₽","FBO 100–300 ₽","FBO от 300 ₽","FBS до 100 ₽","FBS 100–300 ₽","FBS от 300 ₽"],rows:primary.slice(2).filter(r=>r[0]).map((r,i)=>{const b=secondary[i+2]??[];return [clean(r[0]),clean(r[1]),clean(r[2]),clean(r[3]),clean(r[4]),clean(r[5]),clean(b[3]),clean(b[4]),clean(b[5])]})};
 }
 if(market==="wb"){
  return {columns:["Предмет","Категория","FBW, %","FBS, %","Средняя комиссия, %"],rows:primary.slice(1).filter(r=>r[0]).map(r=>r.slice(0,5).map(clean))};
 }
 return {columns:["Категория","FBY, %","FBS, %"],rows:primary.slice(1).filter(r=>r[0]).map((r,i)=>[clean(r[0]),clean(r[9]),clean(secondary[i+1]?.[10]??secondary[i+1]?.[8])])};
}
export default function TariffTablesClient({kind}:{kind:"commissions"|"logistics"}){
 const [market,setMarket]=useState<Marketplace>("ozon");
 const [loading,setLoading]=useState(true);
 const [data,setData]=useState<TariffPayload[]>([]);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [preview,setPreview]=useState<{name:string;rows:number;columns:number;sample:string[][]}|null>(null);
 const [fileError,setFileError]=useState("");
 const [analyst,setAnalyst]=useState(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{fetch("/api/unit-economics?kind=meta",{cache:"no-store"}).then(r=>r.json()).then(x=>setAnalyst(x.analyst===true)).catch(()=>{})},[]);
 useEffect(()=>{
  let active=true;setLoading(true);setError("");setData([]);setPreview(null);setSearch("");
  Promise.all(getKeys(market,kind).map(key=>fetch("/api/unit-economics?kind=rates&table="+key,{cache:"no-store"}).then(async res=>{const j=await res.json();if(!res.ok)throw Error(j.error||"Ошибка чтения тарифов");return j as TariffPayload})))
   .then(values=>{if(active){setData(values);setLoading(false)}}).catch(err=>{if(active){setError(String(err));setLoading(false)}});
  return()=>{active=false};
 },[market,kind]);
 const view=useMemo(()=>merge(market,kind,data),[market,kind,data]);
 const rows=useMemo(()=>{const s=search.trim().toLowerCase();return s?view.rows.filter(row=>row.some(cell=>cell.toLowerCase().includes(s))):view.rows},[view,search]);
 async function handleFile(e:ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];if(!file)return;setPreview(null);setFileError("");setBusy(true);
  try{
   const xlsx=await import("xlsx");
   if(!/\.(xlsx|xls|csv)$/i.test(file.name)&&!(market==="wb"&&file.name.toLowerCase().endsWith(".pdf")))throw Error("Поддерживаются XLSX, XLS или CSV; PDF WB требует проверки вне этого окна.");
   if(file.name.toLowerCase().endsWith(".pdf"))throw Error("PDF выбран. Для автоматического обновления ставок понадобится отдельный модуль извлечения; текущие комиссии не изменены.");
   if(file.size>15_000_000)throw Error("Файл больше 15 МБ.");
   const wb=xlsx.read(await file.arrayBuffer(),{type:"array",cellDates:false});
   if(!wb.SheetNames.length)throw Error("Файл пустой");
   const grid=xlsx.utils.sheet_to_json<(string|number|null)[]>(wb.Sheets[wb.SheetNames[0]],{header:1,blankrows:false});
   const previewRows=grid.slice(0,6).map(row=>row.map(v=>String(v??"")));
   if(grid.length<2)throw Error("Не найдена таблица тарифов");
   setPreview({name:file.name,rows:grid.length,columns:Math.max(...grid.slice(0,50).map(r=>r.length),0),sample:previewRows});
  }catch(err){setFileError(err instanceof Error?err.message:"Не удалось открыть файл")}
  finally{setBusy(false);e.target.value=""}
 }
 return <section className="unit-body">
  <div className="unit-actions"><Link href="/unit-economics" className="unit-button">← К юнит-экономике</Link><Link href={kind==="commissions"?"/unit-economics/logistics":"/unit-economics/commissions"} className="unit-button">{kind==="commissions"?"Логистика и тарифы":"Комиссии"}</Link><a href={WORKBOOK_URL} target="_blank" rel="noopener noreferrer" className="unit-external">Полные справочники Google Sheets ↗</a></div>
  <div className="unit-market-tabs" role="tablist">{models.map(m=><button key={m} role="tab" aria-selected={m===market} className={m===market?"active":""} onClick={()=>setMarket(m)}>{MARKET_NAMES[m]}</button>)}</div>
  <div className="unit-table-toolbar"><div className="unit-table-title">{kind==="commissions"?"Комиссии по категориям":"Логистика и хранение"} <span>{rows.length} строк</span></div><div className="unit-toolbar-right"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по категории, параметру..." aria-label="Поиск по тарифам"/></div></div>
  {!loading&&data.some(x=>!x.live)&&<div className="unit-notice">Показан сохранённый фрагмент справочников на 28.10.2026. Полные действующие тарифы находятся в Google Sheets; автоматическая синхронизация станет доступна после настройки подключения Google.</div>}
  {loading?<p className="unit-loading">Загружаю справочники...</p>:error?<p className="unit-warning">{error}</p>:<div className="unit-table-scroller"><table className="unit-data-table"><thead><tr>{view.columns.map((c,i)=><th key={i}>{c}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{v}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={view.columns.length}>Нет данных</td></tr>}</tbody></table></div>}
  <div className="unit-import-section"><h2>Загрузка файлов тарифов {MARKET_NAMES[market]}</h2><p>Форматы исходных выгрузок площадок. Сначала проверяется структура файла; существующие тарифы при выборе файла не изменяются.</p>
  <div className="unit-upload-buttons"><label className="unit-upload"><span>Загрузить файл {MARKET_NAMES[market]}</span><small>{market==="wb"?"XLSX / CSV; PDF проверяется отдельно":"XLSX / CSV"}</small><input type="file" accept={market==="wb"?".xlsx,.xls,.csv,.pdf":".xlsx,.xls,.csv"} onChange={handleFile} disabled={busy}/></label></div>
  {busy&&<p role="status">Читаю файл...</p>}
  {fileError&&<p className="unit-warning" role="alert">{fileError}</p>}
  {preview&&<div className="unit-preview"><b>Файл: {preview.name}</b><p>Строк: {preview.rows}, столбцов: {preview.columns}. Предварительная проверка выполнена. <strong>Новые комиссии ещё не применены.</strong></p><div className="unit-table-scroller"><table className="unit-data-table"><tbody>{preview.sample.map((row,i)=><tr key={i}>{row.slice(0,10).map((v,j)=><td key={j}>{v}</td>)}</tr>)}</tbody></table></div><p>{analyst?"Окончательное обновление следует выполнять после сверки ставок в исходной Google-таблице.":"Обновление тарифов доступно только роли «Аналитик»."}</p></div>}
  </div>
 </section>;
}
