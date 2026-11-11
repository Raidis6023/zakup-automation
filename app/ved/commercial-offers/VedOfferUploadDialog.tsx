"use client";

import { DateField } from "@/app/ui/WorkspaceDateFields";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {createClient} from "@/lib/supabase/client";

type Supplier="ROY"|"MU";
type Selected={file:File;status:string;error?:string};
const maximum=50_000_000;
const format=(n:number)=>(n/1000000).toLocaleString("ru-RU",{maximumFractionDigits:2})+" МБ";
const moscowDate=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Moscow"});
function readJson(response:Response){return response.json() as Promise<{ok:boolean;error?:string;[key:string]:unknown}>;}
export default function VedOfferUploadDialog(){
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false);
 const [supplier,setSupplier]=useState<Supplier>("ROY"),[quoteDate,setQuoteDate]=useState(moscowDate);
 const [rows,setRows]=useState<Selected[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [completed,setCompleted]=useState<string[]>([]);
 const fileRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{setMounted(true);},[]);
 useEffect(()=>{
  if(!open)return;
  const old=document.body.style.overflow;document.body.style.overflow="hidden";
  const close=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!busy)setOpen(false);};
  window.addEventListener("keydown",close);
  return ()=>{document.body.style.overflow=old;window.removeEventListener("keydown",close);};
 },[open,busy]);
 const add=(incoming:File[])=>{
  setError("");
  const existing=new Set(rows.map(x=>x.file.name+"|"+x.file.size+"|"+x.file.lastModified));
  const next=[...rows];
  for(const f of incoming){
   const key=f.name+"|"+f.size+"|"+f.lastModified;
   if(existing.has(key))continue;
   existing.add(key);
   if(!/\.(xlsx|xls|xlsm)$/i.test(f.name)||f.size<1||f.size>maximum){
    setError("Некоторые файлы пропущены: поддерживаются .xlsx, .xls, .xlsm до 50 МБ каждый.");
    continue;
   }
   if(next.length>=8){setError("За один раз разрешено до восьми файлов.");break;}
   next.push({file:f,status:"Готов к загрузке"});
  }
  setRows(next);
 };
 const request=async(url:string,body:object)=>{
  const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const result=await readJson(response);
  if(!response.ok||!result.ok)throw Error(String(result.error||"Ошибка сервера"));
  return result;
 };
 const upload=async()=>{
  if(!rows.length||busy)return;
  setBusy(true);setError("");setCompleted([]);
  const supabase=createClient();
  let success=0;
  for(const row of rows){
   try{
    setRows(current=>current.map(x=>x.file===row.file?{...x,status:"Выделяем номер КП…"}:x));
    const init=await request("/api/ved-commercial-offers?action=init",{
     supplier,quoteDate,filename:row.file.name,size:row.file.size
    });
    setRows(current=>current.map(x=>x.file===row.file?{...x,status:"Загружаем оригинал в защищённое хранилище…"}:x));
    const {error:storageError}=await supabase.storage.from(String(init.bucket))
     .uploadToSignedUrl(String(init.storagePath),String(init.token),row.file,{
       contentType:row.file.name.toLowerCase().endsWith(".xlsx")?
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        row.file.name.toLowerCase().endsWith(".xlsm")?
        "application/vnd.ms-excel.sheet.macroEnabled.12":"application/vnd.ms-excel"
     });
    if(storageError)throw Error("Не удалось передать файл: "+storageError.message);
    setRows(current=>current.map(x=>x.file===row.file?{...x,status:"Распознаём товары и проверяем поля…"}:x));
    const done=await request("/api/ved-commercial-offers?action=complete",{offerId:init.offerId});
    const state=String(done.status);
    const summary=String(done.quoteCode)+" · товаров: "+done.count+
      (state==="needs_review"?" (необходимо проверить формат)":"");
    setCompleted(current=>[...current,summary]);
    setRows(current=>current.map(x=>x.file===row.file?{...x,status:"Загружено: "+summary}:x));
    success++;
   }catch(e){
    const message=e instanceof Error?e.message:"Ошибка загрузки";
    setRows(current=>current.map(x=>x.file===row.file?{...x,status:"Ошибка",error:message}:x));
   }
  }
  if(success)window.dispatchEvent(new Event("ved-offers-updated"));
  setBusy(false);
 };
 return <>
  <button type="button" className="ved-offer-upload-launch" onClick={()=>{
   setRows([]);setCompleted([]);setError("");setOpen(true);
  }}>
   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
   Загрузить КП
  </button>
  {mounted&&open&&createPortal(<div className="ved-upload-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setOpen(false);}}>
   <div className="ved-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="ved-upload-title">
    <div className="ved-upload-head">
     <div><h2 id="ved-upload-title">Загрузка коммерческого предложения</h2>
      <p>Исходный Excel сохраняется без изменений. Товары распознаются и добавляются в архив КП.</p></div>
     <button type="button" className="ved-upload-close" disabled={busy} aria-label="Закрыть" onClick={()=>setOpen(false)}>×</button>
    </div>
    <div className="ved-offer-import-fields">
     <label>Поставщик
      <select value={supplier} disabled={busy} onChange={e=>setSupplier(e.target.value as Supplier)}>
       <option value="ROY">ROYAUMANN (ROY)</option><option value="MU">MARKET UNION (MU)</option>
      </select>
     </label>
     <label>Дата получения КП
      <DateField  value={quoteDate} disabled={busy} onChange={e=>setQuoteDate(e.target.value)}/>
     </label>
    </div>
    <input ref={fileRef} type="file" className="ved-upload-file-input"
      accept=".xlsx,.xls,.xlsm" multiple
      onChange={event=>{add(Array.from(event.target.files||[]));event.target.value="";}}/>
    <div className="ved-upload-drop-zone" role="button" tabIndex={0}
      onClick={()=>{if(!busy)fileRef.current?.click();}}
      onKeyDown={e=>{if((e.key==="Enter"||e.key===" ")&&!busy){e.preventDefault();fileRef.current?.click();}}}
      onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)add(Array.from(e.dataTransfer.files));}}>
     <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h9l5 5v12a1 1 0 0 0 1 1H5a1 1 0 0 0 1-1V4a1 1 0 0 1-1 1Zm9 0v5h5M8 15l3 3 5-6"/></svg>
     <strong>Перетащите Excel или выберите файлы</strong>
     <span>До 8 файлов за раз. XLSX, XLS, XLSM, до 50 МБ на файл.</span>
    </div>
    {rows.length>0&&<div className="ved-upload-queue">
     {rows.map(row=><div className="ved-upload-row" key={row.file.name+"-"+row.file.lastModified}>
      <div className="ved-upload-row-head"><strong>{row.file.name}</strong>
       {!busy&&<button type="button" className="ved-upload-remove"
        onClick={()=>setRows(cur=>cur.filter(x=>x.file!==row.file))}>Убрать</button>}
      </div>
      <small className="ved-upload-metadata">{format(row.file.size)} · {row.status}</small>
      {row.error&&<small className="ved-upload-error">{row.error}</small>}
     </div>)}
    </div>}
    {error&&<p role="alert" className="ved-upload-error">{error}</p>}
    <p className="ved-upload-disclaimer">Для первого испытания включена прямая загрузка файлов до 50 МБ. Очень крупные КП и неизвестные макеты остаются на проверке, чтобы не записывать ошибочные данные. Код ТН ВЭД и ставку пошлины система не придумывает.</p>
    <div className="ved-upload-footer">
     <button type="button" disabled={busy||!rows.length||!quoteDate} className="ved-upload-import-commit"
      onClick={()=>void upload()}>{busy?"Обрабатываем КП…":"Загрузить в архив и распознать"}</button>
     <button type="button" disabled={busy} onClick={()=>setOpen(false)}>Закрыть</button>
    </div>
   </div>
  </div>,document.body)}
 </>;
}
