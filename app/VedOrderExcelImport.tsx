"use client";

import { useRef,useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Row={
 sheet:string;name:string;our_article:string;chinese_article:string;
 cartons:string;units_per_carton:string;unit_price_cny:string;moq_quantity:string;
 carton_length_cm:string;carton_width_cm:string;carton_height_cm:string;
 carton_volume_m3:string;carton_weight_kg:string;
 individual_length_cm:string;individual_width_cm:string;individual_height_cm:string;
 hs_code:string;has_photo:boolean;photo_preview:string|null;warnings:string[];
};
type Skipped={sheet:string;reason:string};
type Preview={path:string;items:Row[];skipped:Skipped[]};
type Field=keyof Pick<Row,
 "name"|"our_article"|"chinese_article"|"cartons"|"units_per_carton"|
 "unit_price_cny"|"moq_quantity"|"carton_length_cm"|"carton_width_cm"|
 "carton_height_cm"|"carton_volume_m3"|"carton_weight_kg">;
const fields:[Field,string][]=[
 ["name","Название товара"],
 ["chinese_article","Китайский артикул"],
 ["cartons","Заказываем коробов"],
 ["units_per_carton","Штук в коробке"],
 ["unit_price_cny","Цена за шт., CNY"],
 ["moq_quantity","MOQ, шт."],
 ["carton_length_cm","Длина короба, см"],
 ["carton_width_cm","Ширина короба, см"],
 ["carton_height_cm","Высота короба, см"],
 ["carton_volume_m3","Объём короба, м³"],
 ["carton_weight_kg","Вес короба, кг"]
];
const MAX_BYTES=30*1024*1024;
const fmt=(n:number)=>n.toLocaleString("ru-RU");

export default function VedOrderExcelImport({
 orderId,onImported,onStateChange
}:{
 orderId:string;onImported:()=>Promise<void>;onStateChange:(active:boolean)=>void;
}){
 const input=useRef<HTMLInputElement>(null);
 const [hover,setHover]=useState(false);
 const [fileName,setFileName]=useState("");
 const [phase,setPhase]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [rows,setRows]=useState<Row[]>([]);
 const [excluded,setExcluded]=useState<Set<string>>(new Set());
 const [expanded,setExpanded]=useState<string|null>(null);
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const [saved,setSaved]=useState("");
 const selectedCount=rows.filter(row=>!excluded.has(row.sheet)).length;

 async function call<T extends {ok?:boolean;error?:string}>(payload:Record<string,unknown>){
  const response=await fetch("/api/ved-orders/"+encodeURIComponent(orderId)+"/import-excel",{
   method:"POST",credentials:"same-origin",cache:"no-store",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify(payload)
  });
  const body=await response.json() as T;
  if(!response.ok||body.ok!==true)throw new Error(body.error||"Ошибка импорта Excel");
  return body;
 }
 async function openFile(file:File){
  if(busy)return;
  setError("");setSaved("");setPreview(null);setRows([]);setExcluded(new Set());setExpanded(null);
  if(!file.name.toLowerCase().endsWith(".xlsx")){
   setError("Поддерживаются только файлы Excel .xlsx");return;
  }
  if(file.size>MAX_BYTES||file.size<100){
   setError("Размер Excel должен быть от 100 байт до 30 МБ");return;
  }
  onStateChange(true);
  setFileName(file.name);setBusy(true);
  try{
   setPhase("Готовим безопасную загрузку…");
   const ticket=await call<{
    ok?:boolean;error?:string;path:string;token:string;bucket:string
   }>({action:"begin",filename:file.name,size:file.size});
   setPhase("Загружаем Excel в приватное хранилище…");
   const db=createClient();
   const {error:uploadError}=await db.storage.from(ticket.bucket).uploadToSignedUrl(
    ticket.path,ticket.token,file,{contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
   );
   if(uploadError)throw new Error("Не удалось передать Excel: "+uploadError.message);
   setPhase("Читаем листы и фотографии…");
   const parsed=await call<{
    ok?:boolean;error?:string;items:Row[];skipped:Skipped[];path:string
   }>({action:"preview",path:ticket.path});
   setPreview(parsed);
   setRows(parsed.items);
   if(parsed.items.length>50)setError(
    "В файле более 50 товарных листов. Выберите до 50 для одного импорта."
   );
   setPhase("");
  }catch(cause){
   setError(cause instanceof Error?cause.message:"Не удалось загрузить файл");
   onStateChange(false);
   setPhase("");
  }finally{
   setBusy(false);
   if(input.current)input.current.value="";
  }
 }

 function edit(sheet:string,field:Field,value:string){
  setError("");
  setRows(old=>old.map(row=>row.sheet===sheet?{...row,[field]:value}:row));
 }
 function toggle(sheet:string){
  setError("");
  setExcluded(old=>{
   const next=new Set(old);
   if(next.has(sheet))next.delete(sheet);else next.add(sheet);
   return next;
  });
 }
 function reset(){
  if(busy)return;
  setPreview(null);setRows([]);setFileName("");setError("");setSaved("");
  setExcluded(new Set());setExpanded(null);onStateChange(false);
 }
 async function confirm(){
  if(!preview||busy||selectedCount<1||selectedCount>50)return;
  const selected=rows.filter(row=>!excluded.has(row.sheet));
  const invalid=selected.find(row=>row.name.trim().length<2);
  if(invalid){setError("На листе "+invalid.sheet+" отсутствует название товара");return;}
  setError("");setBusy(true);setPhase("Сохраняем товары и фотографии…");
  try{
   const result=await call<{ok?:boolean;error?:string;added:number;
    photosAdded:number;missingPhotos:number}>({
    action:"confirm",path:preview.path,selectedSheets:selected.map(row=>row.sheet),
    overrides:Object.fromEntries(selected.map(row=>[row.sheet,Object.fromEntries(
      fields.map(([key])=>[key,row[key]])
    )]))
   });
   setSaved("Добавлено "+fmt(result.added)+" товаров. Фотографий: "+
    fmt(result.photosAdded)+". Без фото: "+fmt(result.missingPhotos)+".");
   await onImported();
   reset();
  }catch(cause){
   setError(cause instanceof Error?cause.message:"Импорт не завершён");
  }finally{setBusy(false);setPhase("");}
 }

 return (
  <section className="ved-excel-import" aria-label="Импорт расчётов ВЭД из Excel">
   <div className="ved-excel-heading">
    <strong>Импорт расчётов ВЭД из Excel</strong>
    {fileName&&<span title={fileName}>{fileName}</span>}
   </div>
   {!preview&&(
    <div
     className={"ved-excel-drop"+(hover?" ved-excel-drop--active":"")}
     role="button" tabIndex={busy?-1:0}
     aria-label="Перетащите Excel сюда или нажмите для выбора файла"
     onClick={()=>!busy&&input.current?.click()}
     onKeyDown={event=>{
      if((event.key==="Enter"||event.key===" ")&&!busy){
       event.preventDefault();input.current?.click();
      }
     }}
     onDragEnter={event=>{event.preventDefault();setHover(true);}}
     onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="copy";setHover(true);}}
     onDragLeave={event=>{event.preventDefault();if(!event.currentTarget.contains(event.relatedTarget as Node))setHover(false);}}
     onDrop={event=>{event.preventDefault();setHover(false);
      const file=event.dataTransfer.files?.[0];if(file)void openFile(file);
     }}
    >
     <span className="ved-excel-drop-icon" aria-hidden="true">⇩</span>
     <strong>Перетащите Excel-файл сюда</strong>
     <span>или нажмите, чтобы выбрать .xlsx</span>
     <small>Один товарный лист = одна позиция заказа · до 30 МБ</small>
     <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      hidden onChange={event=>{
       const file=event.target.files?.[0];if(file)void openFile(file);
      }}/>
    </div>
   )}
   {busy&&<p className="ved-excel-progress" role="status">{phase}</p>}
   {preview&&(
    <div className="ved-excel-preview">
     <div className="ved-excel-summary">
      <strong>{fmt(rows.length)} товарных листов</strong>
      <span>Выбрано к добавлению: {fmt(selectedCount)}</span>
      <button type="button" disabled={busy} onClick={reset}>Другой файл</button>
     </div>
     <div className="ved-excel-list">
      {rows.map(row=>(
       <div className="ved-excel-row" key={row.sheet}>
        <div className="ved-excel-row-heading">
         <input type="checkbox" checked={!excluded.has(row.sheet)} disabled={busy}
          aria-label={"Добавить лист "+row.sheet} onChange={()=>toggle(row.sheet)}/>
         {row.photo_preview?(
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.photo_preview} alt={"Фото товара с листа "+row.sheet}/>
         ):<span className="ved-excel-no-photo">Нет фото</span>}
         <div className="ved-excel-row-title">
          <strong>{row.name}</strong>
          <span>Лист: {row.sheet} · Цена: {row.unit_price_cny||"не заполнена"} CNY
           · Короб: {row.units_per_carton||"?"} шт.</span>
          {row.warnings.length>0&&(
           <small>{row.warnings.join(" · ")}</small>
          )}
         </div>
         <button type="button" className="ved-excel-expand"
          aria-expanded={expanded===row.sheet}
          onClick={()=>setExpanded(expanded===row.sheet?null:row.sheet)}>
          {expanded===row.sheet?"Свернуть":"Изменить"}
         </button>
        </div>
        {expanded===row.sheet&&(
         <div className="ved-excel-row-fields">
          {fields.map(([key,label])=>(
           <label key={key}>{label}
            <input type="text" inputMode={
             ["name","our_article","chinese_article"].includes(key)?"text":"decimal"
            } value={row[key]} maxLength={key==="name"?250:120}
             onChange={event=>edit(row.sheet,key,event.target.value)}/>
           </label>
          ))}
          <div className="ved-excel-row-note">
           Фото упаковки не импортируем. FOB/FCA и порт сотрудник заполнит вручную.
           ТН ВЭД: {row.hs_code||"не указан"}.
          </div>
         </div>
        )}
       </div>
      ))}
     </div>
     {preview.skipped.length>0&&(
      <details className="ved-excel-skipped">
       <summary>Пропущенные листы ({preview.skipped.length})</summary>
       {preview.skipped.map(sheet=><p key={sheet.sheet}>{sheet.sheet}: {sheet.reason}</p>)}
      </details>
     )}
     <div className="ved-excel-footer">
      <span>Добавление выполняется только после подтверждения. Пропущенные листы не добавляются.</span>
      <button type="button" disabled={busy||selectedCount<1||selectedCount>50}
       className="ved-excel-submit" onClick={()=>void confirm()}>
       {busy?"Сохраняем…":"Добавить товары ("+selectedCount+")"}
      </button>
     </div>
    </div>
   )}
   {error&&<p className="ved-excel-error" role="alert">{error}</p>}
   {saved&&<p role="status">{saved}</p>}
  </section>
 );
}
