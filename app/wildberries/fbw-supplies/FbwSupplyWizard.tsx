"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import styles from "./fbw-flow.module.css";

type DemandRow={
  sku:string;name:string;masterCode:string|null;barcode:string|null;
  sales28Days:number;stock:number;days:number|null;rawNeed:number;unitsPerBox:number|null;
  boxes:number;quantity:number;status:string;
};
type Demand={
  ok:boolean;error?:string;source:string;fresh:boolean;rows:DemandRow[];
  syncedAt:string|null;ordersSyncedAt:string|null;warnings:string[];
  summary:{skus:number;ready:number;blocked:number;quantity:number;boxes:number};
};
type Point={
  id:number;name:string;address:string;type:string;status:"confirmed"|"not_compatible"|"unverified";
  acceptedCount:number|null;totalCount:number;
  ids:number[];city:string;region:string;hours:string;lat:number|null;lon:number|null;
  source:"public"|"wb";url:string;hasLiveId:boolean;
};
type Rate={
  warehouseId:number;date:string;coefficient:number|null;available:boolean;
  deliveryCoef:string|number|null;storageCoef:string|number|null;
};
type Choices={
  ok:boolean;error?:string;points:Point[];dates:Rate[];
  optionsVerified:boolean;ratesVerified:boolean;errors:string[];fetchedAt:string;
  fallback?:{used:boolean;source:string;updated:string;total:number;note:string};
};
const num=(v:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:1}).format(v);
const DATE_FMT=new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short",weekday:"short",timeZone:"UTC"});
const dateUTC=(iso:string)=>new Date(iso+"T12:00:00Z");
function dayInKrasnoyarsk(){
 const pieces=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Krasnoyarsk",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
 const by=Object.fromEntries(pieces.map(x=>[x.type,x.value]));
 return [by.year,by.month,by.day].join("-");
}
function addDays(day:string,increment:number){
 const d=new Date(day+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+increment);
 return d.toISOString().slice(0,10);
}

type ManualSlotRecord = {
  savedAt:string;date:string;wbSupplyNumber:string;
  point:{id:number;name:string;address:string};
  supplyType:"box"|"mono";source:"seller-manual";
  items:Array<{sku:string;name:string;barcode:string;quantity:number;boxes:number;unitsPerBox:number}>;
  units:number;boxes:number;
};
const SLOT_STORAGE_KEY="wb-fbw-manual-booking-v1";
function csvField(value:string|number){
  return '"'+String(value).replace(/"/g,'""')+'"';
}
function downloadManifest(record:ManualSlotRecord){
  const header=["Артикул WB","Наименование","Баркод","Количество","Вложимость","Коробов"];
  const rows=record.items.map(x=>[x.sku,x.name,x.barcode,x.quantity,x.unitsPerBox,x.boxes]);
  const csv="\uFEFF"+[header,...rows].map(row=>row.map(csvField).join(";")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const link=document.createElement("a");link.href=url;link.download="WB-FBW-"+record.wbSupplyNumber+".csv";
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
}
const reasons:Record<string,string>={
 missing_master:"Нет мастер-кода",missing_pack:"Нет вложимости",
 pack_conflict:"Конфликт вложимости",missing_barcode:"Нет баркода WB",
 barcode_conflict:"Несколько баркодов",below_half_box:"≤ половины короба",
};
export default function FbwSupplyWizard(){
 const [demand,setDemand]=useState<Demand|null>(null);
 const [selection,setSelection]=useState<string[]>([]);
 const [loading,setLoading]=useState(false);
 const [finding,setFinding]=useState(false);
 const [error,setError]=useState("");
 const [choice,setChoice]=useState<Choices|null>(null);
 const [pointId,setPointId]=useState<number|null>(null);
 const [search,setSearch]=useState("");
 const [kind,setKind]=useState<"all"|"сц"|"лц">("all");
 const [onlyConfirmed,setOnlyConfirmed]=useState(false);
 const calendarRef=useRef<HTMLElement|null>(null);
 const [supplyDate,setSupplyDate]=useState("");
 const [manualDate,setManualDate]=useState("");
 const [wbSupplyNumber,setWbSupplyNumber]=useState("");
 const [manualConfirmed,setManualConfirmed]=useState(false);
 const [savedSlot,setSavedSlot]=useState<ManualSlotRecord|null>(null);
 const [saveMessage,setSaveMessage]=useState("");
 const [typeOverride,setTypeOverride]=useState<"auto"|"box">("auto");
 useEffect(()=>{
   try{
     const saved=window.localStorage.getItem(SLOT_STORAGE_KEY);
     if(saved){const data=JSON.parse(saved) as ManualSlotRecord;
       if(data.source==="seller-manual"&&Array.isArray(data.items))setSavedSlot(data);
     }
   }catch{/* Storage may be disabled by browser privacy settings */}
 },[]);
 const selected=useMemo(()=>demand?.rows.filter(x=>selection.includes(x.sku)&&x.status==="ready")??[],[selection,demand]);
 const type: "box"|"mono"=selected.length>0&&selected.length<=3&&typeOverride!=="box"?"mono":"box";
 const totals=selected.reduce((a,r)=>({units:a.units+r.quantity,boxes:a.boxes+r.boxes}),{units:0,boxes:0});
 const today=dayInKrasnoyarsk();
 // No slot time from API: +6 calendar dates guarantees at least 120 hours have elapsed.
 const safeDay=addDays(today,6);
 const cells=Array.from({length:14},(_,i)=>addDays(today,i));
 const point=choice?.points.find(x=>x.id===pointId);
 const pointRates=(choice?.dates??[]).filter(x=>point?.ids.includes(x.warehouseId));
 const points=useMemo(()=>choice?.points.filter(x=>{
   const haystack=(x.name+" "+x.address+" "+x.city+" "+x.region+" "+x.type).toLocaleLowerCase("ru");
   return haystack.includes(search.trim().toLocaleLowerCase("ru"))
     &&(kind==="all"||x.type.toLocaleLowerCase("ru").includes(kind))
     &&(!onlyConfirmed||x.status==="confirmed");
 })??[],[choice,search,kind,onlyConfirmed]);
 const clearManualForm=()=>{setManualDate("");setWbSupplyNumber("");setManualConfirmed(false);setSaveMessage("");};
 const resetFollowing=()=>{setChoice(null);setPointId(null);setSupplyDate("");setOnlyConfirmed(false);clearManualForm();};
 function pickPoint(id:number){setPointId(id);setSupplyDate("");clearManualForm();window.setTimeout(()=>calendarRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),120);}
 async function calculate(){
   setLoading(true);setError("");setDemand(null);setSelection([]);resetFollowing();
   try{
     const res=await fetch("/api/wb/fbw/preview",{cache:"no-store"});
     const data=await res.json() as Demand;
     if(!res.ok||!data.ok)throw Error(data.error??"Не удалось получить расчёт");
     setDemand(data);
     setSelection(data.fresh?data.rows.filter(x=>x.status==="ready").map(x=>x.sku):[]);
   }catch(e){setError(e instanceof Error?e.message:"Ошибка");}finally{setLoading(false);}
 }
 function toggle(sku:string){
   setSelection(old=>old.includes(sku)?old.filter(x=>x!==sku):[...old,sku]);resetFollowing();
 }
 async function find(){
   if(!demand?.fresh||!selected.length)return;
   setFinding(true);setError("");resetFollowing();
   try{
     const res=await fetch("/api/wb/fbw/availability",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({type,items:selected.map(x=>({barcode:x.barcode,quantity:x.quantity}))}),
     });
     const data=await res.json() as Choices;
     if(!res.ok||!data.ok)throw Error(data.error??"Ошибка проверки WB");
     setChoice(data);
   }catch(e){setError(e instanceof Error?e.message:"Ошибка связи с WB");}finally{setFinding(false);}
 }
 function selectDate(day:string,rate:Rate|undefined){
   if(day<safeDay||!rate?.available||point?.status!=="confirmed")return;
   setSupplyDate(day);
 }
 const currentRate=pointRates.find(r=>r.date===supplyDate);
 const unavailable=!!point&&(point.status!=="confirmed"||!choice?.ratesVerified||pointRates.length===0);
 function saveManualSlot(){
   setSaveMessage("");
   if(!point||!selected.length){setSaveMessage("Выбери товары и точку сдачи.");return;}
   if(!/^\d{4}-\d{2}-\d{2}$/.test(manualDate)||manualDate<safeDay){
     setSaveMessage("Выбранная в WB дата должна быть не раньше "+safeDay+" (минимум 5 полных суток).");return;
   }
   const number=wbSupplyNumber.trim();
   if(number.length<3||number.length>80){setSaveMessage("Укажи номер реально созданной поставки WB.");return;}
   if(!manualConfirmed){setSaveMessage("Подтверди, что дата и точка уже выбраны в кабинете WB.");return;}
   const record:ManualSlotRecord={
     savedAt:new Date().toISOString(),date:manualDate,wbSupplyNumber:number,
     point:{id:point.id,name:point.name,address:point.address},
     supplyType:type,source:"seller-manual",
     items:selected.map(row=>({sku:row.sku,name:row.name,barcode:row.barcode??"",
       quantity:row.quantity,boxes:row.boxes,unitsPerBox:row.unitsPerBox??0})),
     units:totals.units,boxes:totals.boxes,
   };
   try{
     window.localStorage.setItem(SLOT_STORAGE_KEY,JSON.stringify(record));
     setSavedSlot(record);setSaveMessage("Состав и реквизиты записаны в этом браузере. В WB ничего не создавалось.");
   }catch{setSaveMessage("Браузер запретил хранение данных. Состав не сохранён.");}
 }

 return <div className={styles.wizard}>
   <div className={styles.hero}>
     <div><div className={styles.eyebrow}>ЗАКУП / WILDBERRIES / FBW</div><h1>Формирование поставки FBW</h1>
       <p>Расчёт по всей России → тип упаковки → проверка точек сдачи → выбор даты. По образцу Ozon, но с правилами Wildberries.</p></div>
     <span className={styles.badge}>Подбор · без списания и бронирования</span>
   </div>
   <div className={styles.steps}><span>01 · Потребность</span><span>02 · Тип поставки</span><span>03 · Точка сдачи</span><span>04 · Дата</span></div>
   <section className={styles.panel}>
     <header><span className={styles.number}>1</span><div><h2>Рассчитать потребность</h2><p>28 дней продаж, общий остаток WB по РФ, исключение отмен, округление до целого короба по правилу Ozon.</p></div></header>
     <button className={styles.primary} disabled={loading} onClick={calculate}>{loading?"Выполняю расчёт...":"Рассчитать все варианты"}</button>
     {demand&&<>
       <div className={styles.metrics}><div><b>{demand.summary.skus}</b><span>SKU с потребностью</span></div><div><b>{demand.summary.ready}</b><span>Готовы</span></div><div><b>{demand.summary.blocked}</b><span>Нужны данные</span></div><div><b>{num(demand.summary.boxes)}</b><span>Коробов по расчёту</span></div></div>
       <p className={styles.hint}>Снимок остатков: {demand.syncedAt?new Date(demand.syncedAt).toLocaleString("ru-RU"):"нет даты"} · Заказы: {demand.ordersSyncedAt?new Date(demand.ordersSyncedAt).toLocaleString("ru-RU"):"нет даты"}</p>
       {!demand.fresh&&<p className={styles.error}>Данные старше 24 часов. Сначала обнови синхронизацию WB на главной странице.</p>}
       <div className={styles.bar}><div><button onClick={()=>{setSelection(demand.rows.filter(x=>x.status==="ready").map(x=>x.sku));resetFollowing();}} disabled={!demand.fresh}>Выбрать все готовые</button><button onClick={()=>{setSelection([]);resetFollowing();}}>Снять выбор</button></div><strong>{selection.length} выбрано</strong></div>
       <div className={styles.tableWrap}><table><thead><tr><th></th><th>Артикул</th><th>Продажи 28д</th><th>Остаток РФ</th><th>Потребность</th><th>В коробе</th><th>Коробов</th><th>К отгрузке</th><th>Статус</th></tr></thead>
       <tbody>{demand.rows.map(row=><tr key={row.sku}>
         <td><input aria-label={"Выбрать "+row.sku} type="checkbox" disabled={!demand.fresh||row.status!=="ready"} checked={selection.includes(row.sku)} onChange={()=>toggle(row.sku)}/></td>
         <td><strong>{row.name}</strong><small>{row.sku} · {row.masterCode??"нет ЕНОТ"} · {row.barcode??"нет баркода"}</small></td>
         <td>{num(row.sales28Days)}</td><td>{num(row.stock)}</td><td>{num(row.rawNeed)}</td><td>{row.unitsPerBox??"—"}</td><td>{row.boxes}</td><td>{row.quantity||"—"}</td>
         <td><span className={row.status==="ready"?styles.ok:styles.warning}>{row.status==="ready"?"Готов":reasons[row.status]??row.status}</span></td>
       </tr>)}</tbody></table></div>
       {demand.warnings.map(x=><p key={x} className={styles.warningText}>{x}</p>)}
     </>}
   </section>
   <section className={styles.panel}>
     <header><span className={styles.number}>2</span><div><h2>Тип поставки</h2><p>Определяется из фактического состава выбранных SKU, а не из количества коробов.</p></div></header>
     <div className={styles.two}>
       <div className={[styles.typeCard,type==="box"?styles.active:""].join(" ")}><strong>Короб</strong><p>Один SKU в транспортировочном коробе. Основной вариант для состава более 3 SKU.</p><small>Тип WB: короба</small></div>
       <div className={[styles.typeCard,type==="mono"?styles.active:""].join(" ")}><strong>Монопаллета</strong><p>Не более 3 разных баркодов. Требует проверки физической вместимости паллеты.</p><small>Тип WB: монопаллеты</small></div>
     </div>
     <div className={styles.bar}><div><label><input type="checkbox" checked={typeOverride==="box"} onChange={e=>{setTypeOverride(e.target.checked?"box":"auto");resetFollowing();}}/> Использовать короба вместо монопаллеты</label></div><strong>{selected.length} SKU · {num(totals.boxes)} коробов · {num(totals.units)} шт.</strong></div>
     {selected.length<=3&&selected.length>0&&type==="mono"&&<p className={styles.warningText}>Монопаллета предлагается только по ограничению в 3 баркода. Высоту, вес и количество паллет необходимо проверить перед оформлением.</p>}
     <p className={styles.hint}>Поштучная паллета и суперсейф автоматически не выбираются: у нас нет подтверждённых признаков товара для этих схем.</p>
   </section>
   <section className={styles.panel}>
     <header><span className={styles.number}>3</span><div><h2>Куда отгрузить товары</h2><p>Только прямая поставка. Показываем склады и сортировочные центры с адресами, затем проверяем возможность приёмки состава по WB API.</p></div></header>
     <button className={styles.primary} onClick={find} disabled={!demand?.fresh||!selected.length||finding}>{finding?"Проверяю WB...":"Найти точки приёмки для выбранных товаров"}</button>
     {choice&&<>
       <div className={styles.bar}>
         <strong>Точки отгрузки: {points.length} из {choice.points.length}</strong>
         <input className={styles.search} placeholder="Город, склад, СЦ или адрес" value={search} onChange={e=>setSearch(e.target.value)}/>
       </div>
       <div className={styles.filters}>
         <button className={kind==="all"?styles.filterActive:""} onClick={()=>setKind("all")}>Все точки</button>
         <button className={kind==="сц"?styles.filterActive:""} onClick={()=>setKind("сц")}>Сортировочные центры</button>
         <button className={kind==="лц"?styles.filterActive:""} onClick={()=>setKind("лц")}>Склады / ЛЦ</button>
         <label><input type="checkbox" checked={onlyConfirmed} onChange={e=>setOnlyConfirmed(e.target.checked)}/> Только подтверждённые WB</label>
       </div>
       {choice.fallback?.used&&<div className={styles.notice}>
         <b>Резервный справочник:</b> {choice.fallback.total} складов и СЦ, актуальность: {choice.fallback.updated}.
         <div>Список содержит реальные адреса, но не означает, что WB сейчас принимает весь состав. ПВЗ здесь не представлены.</div>
         <small>Источник: <a href="https://iseller.pro/otkrytye-dannye" target="_blank" rel="noreferrer">iseller.pro, открытые данные</a>.</small>
       </div>}
       {!choice.optionsVerified&&<p className={styles.warningText}>WB временно не подтверждает совместимость товаров: выбирай нужный склад из справочника. Шаг 4 покажет доступность даты, если WB вернёт её.</p>}
       {choice.errors.map((e,i)=><p key={i} className={styles.warningText}>{e}</p>)}
       <div className={styles.locations}>{points.map(x=><button type="button" key={x.id} className={[styles.location,x.id===pointId?styles.locationActive:""].join(" ")} disabled={x.status==="not_compatible"} onClick={()=>pickPoint(x.id)}>
         <strong>{x.name} <small className={styles.locationType}>{x.type||"Склад"}</small></strong>
         <span>{[x.city,x.region].filter(Boolean).join(" · ")}</span>
         <span className={styles.locationAddress}>{x.address||"Адрес не указан в справочнике"}</span>
         {x.hours&&<span>Часы: {x.hours}</span>}
         <small className={x.status==="confirmed"?styles.ok:x.status==="not_compatible"?styles.warning:styles.unknown}>
          {x.status==="confirmed"?"✓ WB подтвердил все баркоды":x.status==="not_compatible"?"✕ WB не принимает весь состав":"? Приёмка ещё не подтверждена"}
         </small>
         {!x.hasLiveId&&<small className={styles.warningText}>ID для проверки даты отсутствует</small>}
       </button>)}
       {!points.length&&<p className={styles.hint}>Нет точек по выбранным фильтрам. Сбрось поиск или выключи фильтр подтверждения.</p>}</div>
       <p className={styles.hint}>В СЦ Wildberries может самостоятельно распределить товар по складам хранения. Это не транзитная поставка с выбранным тобой складом назначения.</p>
     </>}
   </section>
   <section className={styles.panel} ref={calendarRef}>
     <header><span className={styles.number}>4</span><div><h2>Дата отгрузки</h2><p>Проверка официального календаря WB. При недоступности API можно перенести сюда уже оформленную в кабинете поставку.</p></div></header>
     {!point?<p className={styles.hint}>Сначала выбери точку сдачи на шаге 3.</p>:<>
       <p className={styles.hint}>Прямая сдача: <b>{point.name}</b>, {point.address||point.city}. Минимальная разрешённая дата для новой отгрузки: <b>{dateUTC(safeDay).toLocaleDateString("ru-RU",{day:"2-digit",month:"long",year:"numeric",timeZone:"UTC"})}</b>. Это консервативный порог в 5 полных суток.</p>
       {unavailable?<div className={styles.slotFallback}>
         <div className={styles.slotFallbackTitle}>Свободные даты через API WB сейчас недоступны</div>
         <p>WB возвращает 404 для методов опций приёмки и/или тарифов. Склад в справочнике не означает свободный слот, а календарь ниже не может подтвердить бронирование. Поэтому не показываем 14 выдуманных дат с возможностью выбора.</p>
         <a href="https://seller.wildberries.ru/" target="_blank" rel="noopener noreferrer" className={styles.sellerLink}>Открыть кабинет Wildberries ↗</a>
         <p>В кабинете: <b>Поставки FBW → Новая поставка → состав → прямая поставка → точка сдачи → дата</b>. После фактического создания поставки занеси дату и её номер сюда. Тип и состав должны совпадать с выбранными на сайте.</p>
         <div className={styles.manualInputs}>
           <label>Дата, подтверждённая в кабинете WB
             <input type="date" min={safeDay} value={manualDate} onChange={e=>{setManualDate(e.target.value);setSaveMessage("");}}/>
           </label>
           <label>Номер уже созданной поставки WB
             <input type="text" maxLength={80} placeholder="Номер из кабинета продавца" value={wbSupplyNumber} onChange={e=>{setWbSupplyNumber(e.target.value);setSaveMessage("");}}/>
           </label>
         </div>
         <label className={styles.manualAgreement}><input type="checkbox" checked={manualConfirmed} onChange={e=>setManualConfirmed(e.target.checked)}/>
           Я действительно оформил(а) поставку на эту дату и в эту точку в кабинете WB. Понимаю, что этот сайт не бронирует её самостоятельно.
         </label>
         <button className={styles.primary} onClick={saveManualSlot} disabled={!manualConfirmed||!manualDate||!wbSupplyNumber.trim()||manualDate<safeDay}>Сохранить данные оформленной поставки</button>
         {saveMessage&&<p className={styles.hint} role="status">{saveMessage}</p>}
         <p className={styles.warningText}>Сохранение действует только в этом браузере. Номер и дата введены пользователем, не проверены API WB и не синхронизированы с общей базой сотрудников.</p>
       </div>:<>
         <div className={styles.calendar}>{cells.map(day=>{
           const rate=pointRates.find(x=>x.date===day);
           const allowed=point.status==="confirmed"&&day>=safeDay&&rate?.available===true;
           return <button type="button" key={day} onClick={()=>selectDate(day,rate)} disabled={!allowed} className={[styles.date,allowed?styles.dateAvailable:"",supplyDate===day?styles.dateActive:""].join(" ")}>
             <strong>{DATE_FMT.format(dateUTC(day))}</strong>
             {day<safeDay?<span>Менее 5 полных суток</span>:!rate?<span>Нет данных WB</span>:!rate.available?<span>Приёмка недоступна</span>:<>
               <span className={styles.ok}>WB: тариф доступен</span>
               <span>Коэффициент: {rate.coefficient??"—"}</span>
               <span>Логистика: {rate.deliveryCoef??"—"}%</span>
               <span>Хранение: {rate.storageCoef??"—"}%</span>
             </>}
           </button>;
         })}</div>
         {supplyDate&&<div className={styles.confirm}><strong>Плановая дата: {point.name} · {supplyDate}</strong><span>{type==="mono"?"Монопаллета":"Короба"} · {selected.length} SKU · {num(totals.units)} шт. · коэффициент {currentRate?.coefficient??"—"}</span><span>Это тарифная доступность. Бронь в WB не создана.</span></div>}
       </>}
     </>}
     {savedSlot&&<div className={styles.savedSlot}>
       <strong>Последняя запись из кабинета WB</strong>
       <div>Поставка № {savedSlot.wbSupplyNumber} · {savedSlot.date} · {savedSlot.point.name}</div>
       <small>{savedSlot.items.length} SKU · {num(savedSlot.units)} шт. · {num(savedSlot.boxes)} коробов. Реквизиты внесены вручную и не подтверждены API.</small>
       <button type="button" onClick={()=>downloadManifest(savedSlot)}>Скачать состав в CSV</button>
     </div>}
     <p className={styles.warningText}>Официальный API WB пока не предоставляет подтверждённое бронирование даты и запись грузомест FBW. Данные из кабинета можно перенести на сайт вручную, не выдавая их за API-подтверждение.</p>
   </section>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
 </div>;
}
