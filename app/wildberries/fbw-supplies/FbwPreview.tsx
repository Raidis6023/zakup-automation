"use client";
import {useState} from "react";
type Row={sku:string;name:string;masterCode:string|null;sales28Days:number;stock:number;days:number|null;rawNeed:number;unitsPerBox:number|null;boxes:number;quantity:number;status:string};
type Payload={ok:boolean;error?:string;rows:Row[];syncedAt:string|null;summary:{skus:number;ready:number;blocked:number;quantity:number;boxes:number}};
const number=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:1}).format(n);
export default function FbwPreview(){
 const [data,setData]=useState<Payload|null>(null);
 const [selected,setSelected]=useState<string[]>([]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [open,setOpen]=useState(false);
 async function load(){setBusy(true);setError("");try{const res=await fetch("/api/wb/fbw/preview",{cache:"no-store"});const d=await res.json() as Payload;if(!res.ok||!d.ok)throw Error(d.error||"Ошибка");setData(d);setSelected([]);setOpen(true);}catch(e){setError(e instanceof Error?e.message:"Ошибка");}finally{setBusy(false);}}
 const ready=data?.rows.filter(r=>r.status==="ready")??[];
 const chosen=ready.filter(r=>selected.includes(r.sku));
 return <section style={{margin:"24px auto",maxWidth:1150,padding:20,border:"1px solid #624879",borderRadius:14}}>
 <h2 style={{fontSize:22,fontWeight:700}}>Потребность FBW · предварительный расчёт</h2>
 <p>Как на Ozon: сначала показываем все позиции. Никаких заявок автоматически не создаём.</p>
 <button disabled={busy} onClick={load} style={{padding:"10px 18px",border:"1px solid #9471ce",borderRadius:8}}>{busy?"Рассчитываем...":"Рассчитать все варианты"}</button>
 {error&&<p role="alert" style={{color:"#ef7070"}}>{error}</p>}
 {data&&open&&<div>
 <p>Позиций с потребностью: <b>{data.summary.skus}</b> · К формированию: <b>{data.summary.ready}</b> · Требуют данных: <b>{data.summary.blocked}</b> · Коробов: <b>{number(data.summary.boxes)}</b> · Единиц: <b>{number(data.summary.quantity)}</b></p>
 <p>Остатки WB: {data.syncedAt?new Date(data.syncedAt).toLocaleString("ru-RU"):"дата синхронизации не указана"}. Товары в пути не вычтены, пока источник не подключён.</p>
 <div style={{display:"flex",gap:12,marginBottom:12}}>
 <button onClick={()=>setSelected(ready.map(x=>x.sku))}>Выбрать все готовые</button>
 <button onClick={()=>setSelected([])}>Снять выбор</button>
 </div>
 <div style={{overflowX:"auto",maxHeight:560,overflowY:"auto"}}>
 <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
 <thead><tr>{["Выбор","SKU","Товар","Продажи 28д","Остаток РФ","Потребность","В коробе","Коробов","Итого","Состояние"].map(h=><th key={h} style={{padding:8,textAlign:"left",borderBottom:"1px solid #666"}}>{h}</th>)}</tr></thead>
 <tbody>{data.rows.map(r=><tr key={r.sku} style={{opacity:r.status==="ready"?1:0.65}}>
 <td><input type="checkbox" disabled={r.status!=="ready"} checked={selected.includes(r.sku)} onChange={e=>setSelected(x=>e.target.checked?[...x,r.sku]:x.filter(k=>k!==r.sku))}/></td>
 <td>{r.sku}</td><td>{r.name}</td><td>{number(r.sales28Days)}</td><td>{number(r.stock)}</td><td>{number(r.rawNeed)}</td><td>{r.unitsPerBox??"—"}</td><td>{r.boxes}</td><td>{r.quantity}</td><td>{r.status==="ready"?"Готов":r.status==="missing_pack"?"Нет вложимости":r.status==="pack_conflict"?"Конфликт вложимости":"Нет мастер-кода"}</td>
 </tr>)}</tbody></table></div>
 <p><b>Выбрано:</b> {chosen.length} SKU · {chosen.reduce((n,r)=>n+r.boxes,0)} коробов · {chosen.reduce((n,r)=>n+r.quantity,0)} единиц.</p>
 <p>Это только предварительный расчёт. Создание черновиков и грузомест WB ещё не доступно через эту форму: не будем имитировать заявку нажатием кнопки.</p>
 </div>}
 </section>;
}
