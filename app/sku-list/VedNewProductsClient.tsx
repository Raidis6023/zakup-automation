"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import WorkspaceCollapsiblePanel from "../WorkspaceCollapsiblePanel";
type Product={article:string;name:string;quantity:number;activeQuantity:number;orders:string;classification:"new"|"review";masterCode:string|null;productId:string|null};
type Result={ok?:boolean;rows?:Product[];error?:string;masterCode?:string;proposedCode?:string};
type Filter="all"|"new"|"review";
export default function VedNewProductsClient(){
 const [rows,setRows]=useState<Product[]>([]);
 const [filter,setFilter]=useState<Filter>("all");
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState("");
 const [inputs,setInputs]=useState<Record<string,string>>({});
 const [proposals,setProposals]=useState<Record<string,string>>({});
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
 async function act(row:Product,action:"classify"|"link"|"preview"|"confirm"){
  setBusy(row.article);
  setMessages(m=>({...m,[row.article]:""}));
  try{
   const masterCode=action==="confirm"?(proposals[row.article]||""):(inputs[row.article]||"");
   if(action==="confirm"&&!/^[A-Z0-9]{6}$/.test(masterCode))
    throw Error("Сначала сгенерируйте код ЕНОТ");
   const r=await fetch("/api/sku-list/new-products",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({action,article:row.article,masterCode}),
   });
   const result=await r.json() as Result;
   if(!r.ok||!result.ok)throw Error(result.error||"Не удалось сохранить");
   if(action==="preview"){
    if(!result.proposedCode)throw Error("Система не вернула код ЕНОТ");
    setProposals(p=>({...p,[row.article]:result.proposedCode!}));
    return;
   }
   await load();
   if(action==="confirm")setProposals(p=>{const v={...p};delete v[row.article];return v;});
   setMessages(m=>({...m,[row.article]:action==="classify"?"Подтверждено: новый товар":"Привязано к ЕНОТ "+(result.masterCode||masterCode)}));
  }catch(e){
   const message=e instanceof Error?e.message:"Ошибка";
   if(action==="confirm"&&message.includes("устарел"))
    setProposals(p=>{const v={...p};delete v[row.article];return v;});
   setMessages(m=>({...m,[row.article]:message}));
  }finally{setBusy("");}
 }
 return <WorkspaceCollapsiblePanel
  tone="general"
  icon="newProducts"
  title="Новые товары"
  subtitle="Товары из заказов ВЭД, пока не размещённые на маркетплейсах. Привязанные остаются здесь до появления на МП."
  meta={loading?"Загрузка…":rows.length+" артикулов"}
  className="sku-new-section"
 >
  <div className="sku-new-content">
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
       {proposals[row.article]?
        <div className="sku-new-proposal" role="group" aria-label={"Подтверждение нового ЕНОТ для "+row.article}>
         <span className="sku-new-proposal-label">Предлагаемый ЕНОТ, ещё не сохранён:</span>
         <strong className="sku-new-proposal-code">{proposals[row.article]}</strong>
         <button type="button" disabled={busy===row.article} onClick={()=>void act(row,"confirm")}>Подтвердить ЕНОТ</button>
         <button type="button" disabled={busy===row.article} onClick={()=>setProposals(p=>{const v={...p};delete v[row.article];return v;})}>Отмена</button>
        </div>:
        <>
         <input placeholder="Код ЕНОТ" aria-label={"Код ЕНОТ для "+row.article} maxLength={6}
          value={inputs[row.article]||""} disabled={busy===row.article}
          onChange={e=>setInputs(v=>({...v,[row.article]:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"")}))}/>
         <button type="button" disabled={busy===row.article||!/^[A-Z0-9]{6}$/.test(inputs[row.article]||"")}
          onClick={()=>void act(row,"link")}>Привязать</button>
         <button type="button" disabled={busy===row.article} onClick={()=>void act(row,"preview")}>Создать новый</button>
        </>}
      </div>}
     {messages[row.article]&&<div role="status" className="sku-new-message">{messages[row.article]}</div>}
    </td>
   </tr>)}</tbody></table></div>}
  <p className="sku-new-footnote">Количество суммируется по заказам. Привязка ЕНОТ не меняет статус заказа и не прибавляет товар к складским остаткам.</p>
  </div>
 </WorkspaceCollapsiblePanel>;
}
