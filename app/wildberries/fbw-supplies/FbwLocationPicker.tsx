"use client";
import { useEffect, useMemo, useState } from "react";
type Warehouse = { ID?:number; id?:number; name?:string; warehouseName?:string; address?:string; isActive?:boolean; isTransitActive?:boolean; warehouseType?:string; type?:string };
type Transit = { transitWarehouseId?:number; destinationWarehouseId?:number; warehouseID?:number; destinationWarehouseID?:number; [key:string]:unknown };
const arr=(v:unknown): Record<string,unknown>[] => Array.isArray(v)?v.filter((x):x is Record<string,unknown>=>Boolean(x)&&typeof x==="object"): (v && typeof v==="object" ? Object.values(v as object).find(Array.isArray) as Record<string,unknown>[] || [] : []);
const id=(w:Warehouse)=>Number(w.ID??w.id);
const name=(w:Warehouse)=>String(w.name??w.warehouseName??"Склад №"+id(w));
const localDay=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Krasnoyarsk",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function minDay(){const parts=localDay().split("-").map(Number); const d=new Date(Date.UTC(parts[0],parts[1]-1,parts[2]+5));return d.toISOString().slice(0,10);}
export default function FbwLocationPicker(){
 const [mode,setMode]=useState<"direct"|"transit">("direct");
 const [warehouses,setWarehouses]=useState<Warehouse[]>([]);
 const [routes,setRoutes]=useState<Transit[]>([]);
 const [from,setFrom]=useState("");
 const [to,setTo]=useState("");
 const [kind,setKind]=useState("all");
 const [query,setQuery]=useState("");
 const [date,setDate]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [loaded,setLoaded]=useState("");
 const minimum=minDay();
 async function load(){setBusy(true);setError("");try{
  const res=await fetch("/api/wb/fbw/locations",{cache:"no-store"});
  const data=await res.json();if(!res.ok)throw new Error(data.error??"Ошибка");
  setWarehouses(arr(data.warehouses) as Warehouse[]);
  setRoutes(arr(data.transit) as Transit[]);setLoaded(data.fetchedAt);
 }catch(e){setError(e instanceof Error?e.message:"Ошибка загрузки");}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 const filtered=useMemo(()=>warehouses.filter(w=>{
  const active=mode==="direct"?w.isActive!==false:w.isTransitActive!==false;
  const label=(name(w)+" "+(w.address??"")+" "+(w.warehouseType??w.type??"")).toLowerCase();
  return active&&label.includes(query.toLowerCase())&&(kind==="all"||label.includes(kind));
 }),[warehouses,mode,query,kind]);
 const selectedFrom=warehouses.find(w=>String(id(w))===from);
 const selectedTo=warehouses.find(w=>String(id(w))===to);
 return <section style={{maxWidth:950,margin:"32px auto",padding:24,background:"#fff",color:"#161616",borderRadius:18}}>
  <h1 style={{fontSize:26,fontWeight:700}}>FBW · Маршрут и точка сдачи</h1>
  <p>Данные WB в момент загрузки. Этот экран выбирает маршрут, но не бронирует таймслот и не создаёт поставку.</p>
  <div style={{display:"flex",gap:12,margin:"20px 0"}}>
   <button style={{padding:12,border:"1px solid #777",background:mode==="direct"?"#d7d3ff":"#fff"}} onClick={()=>{setMode("direct");setFrom("");setTo("");}}>Прямая поставка</button>
   <button style={{padding:12,border:"1px solid #777",background:mode==="transit"?"#d7d3ff":"#fff"}} onClick={()=>{setMode("transit");setFrom("");setTo("");}}>Транзитом</button>
  </div>
  <label>Тип точки сдачи <select style={{marginLeft:12,padding:8}} value={kind} onChange={e=>setKind(e.target.value)}>
   <option value="all">Все точки WB</option><option value="пвз">ПВЗ (если доступны в ответе API)</option>
   <option value="сц">СЦ (если доступны в ответе API)</option><option value="склад">Склад (если доступен в ответе API)</option>
  </select></label>
  <p><input style={{padding:10,width:"100%",border:"1px solid #999"}} placeholder="Поиск по названию, адресу и типу" value={query} onChange={e=>setQuery(e.target.value)}/></p>
  <p><button onClick={load} disabled={busy}>{busy?"Загрузка...":"Обновить список WB"}</button> {loaded&&<small>Получено: {new Date(loaded).toLocaleString("ru-RU")}</small>}</p>
  {error&&<p role="alert" style={{color:"#b00020"}}>{error}</p>}
  <label>Точка сдачи<br/><select style={{width:"100%",padding:12}} value={from} onChange={e=>{setFrom(e.target.value);setTo("");}}>
   <option value="">Выберите точку</option>{filtered.map(w=><option key={id(w)} value={id(w)}>{name(w)}{w.address?" · "+w.address:""}</option>)}
  </select></label>
  {mode==="transit"&&<p><label>Склад назначения<br/><select style={{width:"100%",padding:12}} value={to} onChange={e=>setTo(e.target.value)}>
   <option value="">Выберите склад назначения</option>{warehouses.filter(w=>w.isActive!==false&&id(w)!==Number(from)).map(w=><option key={id(w)} value={id(w)}>{name(w)}</option>)}
  </select></label></p>}
  {mode==="direct"&&<p>Для прямой поставки выбранный склад/СЦ является точкой сдачи. Последующее распределение WB по складам хранения заранее не обещаем.</p>}
  {mode==="transit"&&<p>Транзитное направление необходимо дополнительно подтвердить по тарифам WB. Сам по себе выбор двух складов не доказывает существование маршрута.</p>}
  <hr style={{margin:"24px 0"}}/>
  <h2 style={{fontSize:20,fontWeight:650}}>Плановая дата</h2>
  <p>Не ранее <strong>{minimum}</strong>, пять календарных дней по Красноярску от текущей даты. Дата не означает подтверждённый свободный слот.</p>
  <input type="date" min={minimum} value={date} onChange={e=>setDate(e.target.value)} style={{padding:12,border:"1px solid #999"}}/>
  {date&&date<minimum&&<p style={{color:"#b00020"}}>Запрещена дата ранее пяти дней.</p>}
  <p style={{padding:16,background:"#f3f3f3",borderRadius:8}}>
   Маршрут: {mode==="direct"?"прямой":"транзитный"} · {selectedFrom?name(selectedFrom):"точка не выбрана"} {mode==="transit"?"→ "+(selectedTo?name(selectedTo):"склад назначения не выбран"):""} · Дата: {date&&date>=minimum?date:"не назначена"}.
  </p>
  <p><strong>Бронирование заблокировано.</strong> Свободные таймслоты и совместимость товарного состава с выбранным складом нужно проверить в кабинете WB. Доступный API не даёт надёжно оформить слот из этого экрана.</p>
 </section>;
}
