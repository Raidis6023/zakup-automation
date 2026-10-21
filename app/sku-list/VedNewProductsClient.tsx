"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
type Product={article:string;name:string;quantity:number;activeQuantity:number;orders:string;classification:"new"|"review";masterCode:string|null;productId:string|null};
type Result={ok?:boolean;rows?:Product[];error?:string;masterCode?:string};
type Filter="all"|"new"|"review";
export default function VedNewProductsClient(){
 const [rows,setRows]=useState<Product[]>([]);
 const [filter,setFilter]=useState<Filter>("all");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [inputs,setInputs]=useState<Record<string,string>>({});
 const [messages,setMessages]=useState<Record<string,string>>({});
 const [error,setError]=useState("");
 const load=useCallback(async()=>{
  const response=await fetch("/api/sku-list/new-products",{cache:"no-store"});
  const data=await response.json() as Result;
  if(!response.ok||!data.ok||!Array.isArray(data.rows))throw Error(data.error||"Не удалось загрузить товары");
  setRows(data.rows);
 },[]);
 useEffect(()=>{
  void load().catch(e=>setError(e instanceof Error?e.message:"Ошибка загрузки")).finally(()=>setLoading(false));
 },[load]);
 const newCount=rows.filter(r=>r.classification==="new").length;
 const reviewCount=rows.filter(r=>r.classification==="review").length;
 const visible=useMemo(()=>rows.filter(r=>filter==="all"||r.classification===filter),[rows,filter]);
 async function act(row:Product,action:"classify"|"link"|"generate"){
  setBusy(row.article);setMessages(m=>({...m,[row.article]:""}));
  try{
   const r=await fetch("/api/sku-list/new-products",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,article:row.article,masterCode:inputs[row.article]||""}),
   });
   const result=await r.json() as Result;
   if(!r.ok||!result.ok)throw Error(result.error||"Не удалось сохранить");
   await load();
   setMessages(m=>({...m,[row.article]:action==="classify"?"Подтверждено: новый товар":"Привязано к ЕНОТ "+(result.masterCode||inputs[row.article])}));
  }catch(e){setMessages(m=>({...m,[row.article]:e instanceof Error?e.message:"Ошибка"}));}
  finally{setBusy("");}
 }
 return <section className="sku-new-section" aria-label="Новые товары из заказов ВЭД">
  <div className="sku-new-heading"><div><h2>Новые товары</h2><p>Товары из заказов ВЭД, пока не размещённые на маркетплейсах. Привязанные остаются здесь до появления на МП.</p></div>
   <span className="sku-new-count">{loading?"Загрузка…":rows.length+" артикулов"}</span></div>
  <div className="sku-new-tabs">
   <button className={filter==="all"?"active":""} type="button" onClick={()=>setFilter("all")}>Все ({rows.length})</button>
   <button className={filter==="new"?"active":""} type="button" onClick={()=>setFilter("new")}>Новые ({newCount})</button>
   <button className={filter==="review"?"active":""} type="button" onClick={()=>setFilter("review")}>Требуют проверки ({reviewCount})</button>
  </div>
  {error&&<p role="alert" className="sku-new-message">{error}</p>}
  {loading?<div className="sku-new-empty">Загружаем…</div>:visible.length===0?<div className="sku-new-empty">Товаров нет</div>:
   <div className="sku-new-scroll"><table className="sku-new-table"><thead><tr>
    <th>ЕНОТ</th><th>Артикул</th><th>Наименование</th><th>Заказы ВЭД</th><th>Количество, шт.</th><th>Состояние</th><th>Привязка к ЕНОТ</th>
   </tr></thead><tbody>{visible.map(row=><tr key={row.article}>
    <td className="sku-new-enot">{row.masterCode||"—"}</td>
    <td className="sku-new-article">{row.article}</td>
    <td className="sku-new-name">{row.name}</td>
    <td className="sku-new-orders">{row.orders}</td>
    <td className="sku-new-quantity">{Number(row.quantity).toLocaleString("ru-RU")}</td>
    <td><span className={row.classification==="new"?"sku-new-status sku-new-status--new":"sku-new-status sku-new-status--review"}>{row.classification==="new"?"Новый":"На проверке"}</span></td>
    <td className="sku-new-action">
     {row.classification==="review"?
      <button type="button" disabled={busy===row.article} onClick={()=>void act(row,"classify")}>Это новый товар</button>:
      row.masterCode?<span className="sku-new-linked">Привязан, ожидает появления на МП</span>:
      <div className="sku-new-controls">
       <input placeholder="Код ЕНОТ" aria-label={"Код ЕНОТ для "+row.article} maxLength={6}
        value={inputs[row.article]||""} disabled={busy===row.article}
        onChange={e=>setInputs(v=>({...v,[row.article]:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")}))}/>
       <button type="button" disabled={busy===row.article||!/^[A-Z0-9]{6}$/.test(inputs[row.article]||"")}
        onClick={()=>void act(row,"link")}>Привязать</button>
       <button type="button" disabled={busy===row.article} onClick={()=>void act(row,"generate")}>Создать новый</button>
      </div>}
     {messages[row.article]&&<div role="status" className="sku-new-message">{messages[row.article]}</div>}
    </td>
   </tr>)}</tbody></table></div>}
  <p className="sku-new-footnote">Количество суммируется по заказам. Привязка ЕНОТ не меняет статус заказа и не прибавляет товар к складским остаткам.</p>
 </section>;
}
