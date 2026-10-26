"use client";

import {useMemo,useRef,useState} from "react";
import styles from "./fbw-flow.module.css";
import {estimateFbwPacking, PALLET_TARE_KG} from "../../../lib/wb/fbw-packing";

type DemandRow={
  sku:string;name:string;masterCode:string|null;barcode:string|null;
  sales28Days:number;stock:number;days:number|null;rawNeed:number;unitsPerBox:number|null;
  boxes:number;quantity:number;status:string;
  cartonLengthMm:number|null;cartonWidthMm:number|null;cartonHeightMm:number|null;
  cartonWeightKg:number|null;cartonVolumeM3:number|null;packagingConflict:boolean;
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
 const calendarRef=useRef<HTMLElement|null>(null);
 const [draftBusy,setDraftBusy]=useState(false);
 const [draft,setDraft]=useState<{draftId:string;url:string}|null>(null);
 const [draftError,setDraftError]=useState("");
 const [draftsLoading,setDraftsLoading]=useState(false);
 const [draftsError,setDraftsError]=useState("");
 const [draftList,setDraftList]=useState<Array<{draftId:string;createdAt:string|null;skuQuantity:number;itemQuantity:number}>|null>(null);

 const [typeOverride,setTypeOverride]=useState<"auto"|"box"|"mono"|"piece">("auto");
 const selected=useMemo(()=>demand?.rows.filter(x=>selection.includes(x.sku)&&x.status==="ready")??[],[selection,demand]);
 const type: "box"|"mono"|"piece"=(typeOverride==="auto"||(typeOverride==="mono"&&selected.length>3))?(selected.length>0&&selected.length<=3?"mono":"box"):typeOverride;
 const totals=selected.reduce((a,r)=>({units:a.units+r.quantity,boxes:a.boxes+r.boxes}),{units:0,boxes:0});
 const packing=useMemo(()=>{
   try{
     return {result:estimateFbwPacking(selected.map(x=>({
       sku:x.sku,barcode:x.barcode??"",boxes:x.boxes,unitsPerBox:x.unitsPerBox??0,
       cartonLengthMm:x.cartonLengthMm,
       cartonWidthMm:x.cartonWidthMm,
       cartonHeightMm:x.cartonHeightMm,
       cartonWeightKg:x.cartonWeightKg,
       cartonVolumeM3:x.cartonVolumeM3,
     })),type),error:""};
   }catch(e){return {result:null,error:e instanceof Error?e.message:"Ошибка паллетирования"};}
 },[selected,type]);
 const today=dayInKrasnoyarsk();
 // No slot time from API: +6 calendar dates guarantees at least 120 hours have elapsed.
 const safeDay=addDays(today,6);
 const point=choice?.points.find(x=>x.id===pointId);
 const points=useMemo(()=>choice?.points.filter(x=>{
   const haystack=(x.name+" "+x.address+" "+x.city+" "+x.region+" "+x.type).toLocaleLowerCase("ru");
   return haystack.includes(search.trim().toLocaleLowerCase("ru"))
     &&(kind==="all"||x.type.toLocaleLowerCase("ru").includes(kind))
     &&((type!=="mono"&&type!=="piece")||x.type.toLocaleLowerCase("ru").includes("сц"));
 })??[],[choice,search,kind,type]);
 const resetFollowing=()=>{setChoice(null);setPointId(null);setDraft(null);setDraftError("");};
 function pickPoint(id:number){setPointId(id);setDraft(null);setDraftError("");window.setTimeout(()=>calendarRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),120);}
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
 async function checkDrafts(){
   setDraftsLoading(true);setDraftsError("");
   try{
     const response=await fetch("/api/wb/fbw/drafts",{cache:"no-store"});
     const json=await response.json() as {
       ok:boolean;error?:string;
       drafts?:Array<{draftId:string;createdAt:string|null;skuQuantity:number;itemQuantity:number}>;
     };
     if(!response.ok||!json.ok||!Array.isArray(json.drafts))throw Error(json.error??"WB не вернул список черновиков");
     setDraftList(json.drafts);
   }catch(error){setDraftsError(error instanceof Error?error.message:"Сбой загрузки");}
   finally{setDraftsLoading(false);}
 }
 async function createDraft(){
   if(!point||!selected.length||!demand?.fresh||draftBusy)return;
   setDraftError("");setDraftBusy(true);
   try{
     if(type==="mono" && (!packing.result?.canUseMono||packing.result.missingWeight>0)){
       throw Error("Монопаллета не проходит проверку высоты, габаритов или веса. Измени состав/тип или внеси данные.");
     }
     const response=await fetch("/api/wb/fbw/draft",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({
         point:{id:point.id,name:point.name},type,
         items:selected.map(x=>({sku:x.sku,barcode:x.barcode,
           quantity:x.quantity,boxes:x.boxes,unitsPerBox:x.unitsPerBox})),
       })
     });
     const data=await response.json() as {ok:boolean;draftId?:string;url?:string;error?:string};
     if(!response.ok||!data.ok||!data.draftId)throw Error(data.error||"WB не подтвердил создание черновика");
     setDraft({draftId:data.draftId,url:data.url??"https://seller.wildberries.ru/"});
     window.setTimeout(()=>calendarRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),150);
   }catch(e){setDraftError(e instanceof Error?e.message:"Ошибка создания черновика");}
   finally{setDraftBusy(false);}
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
     <div className={styles.supplyTypes}>
       <button type="button" aria-pressed={type==="box"}
         className={[styles.typeCard,type==="box"?styles.active:""].join(" ")}
         onClick={()=>{setTypeOverride("box");resetFollowing();}}>
         <strong>Короб</strong><p>Короба с одним баркодом. При сдаче в СЦ объёмом свыше 1 м³ размещаем на паллетах.</p><small>Поштучная приёмка</small>
       </button>
       <button type="button" aria-pressed={type==="mono"} disabled={selected.length>3}
         className={[styles.typeCard,type==="mono"?styles.active:""].join(" ")}
         onClick={()=>{setTypeOverride("mono");resetFollowing();}}>
         <strong>Монопаллета</strong><p>Максимум 3 баркода, 50–180 см вместе с поддоном.</p><small>Паллетная приёмка</small>
       </button>
       <button type="button" aria-pressed={type==="piece"}
         className={[styles.typeCard,type==="piece"?styles.active:""].join(" ")}
         onClick={()=>{setTypeOverride("piece");resetFollowing();}}>
         <strong>Поштучная паллета</strong><p>Короба на паллете, до 3 баркодов на одной паллете. Для крупных партий небольших товаров.</p><small>Поштучная приёмка, маркировка паллет</small>
       </button>
     </div>
     <div className={styles.bar}><div><button onClick={()=>{setTypeOverride("auto");resetFollowing();}}>Выбрать автоматически</button></div>
       <strong>{selected.length} SKU · {num(totals.boxes)} коробов · {num(totals.units)} шт.</strong>
     </div>
     {type==="piece"&&<p className={styles.hint}>Для поштучной паллеты WB проверяет габариты и вес товаров в индивидуальной упаковке. Эти сведения отдельно от размеров транспортировочного короба, поэтому окончательную пригодность подтвердит WB.</p>}
     {selected.length>0&&<div className={styles.packingSummary}>
       <h3>Физическая укладка: транспортировочные короба на европаллетах</h3>
       <div className={styles.packingMetrics}>
         <div><b>{num(totals.boxes)}</b><span>Коробов</span></div>
         <div><b>{packing.result?num(packing.result.volumeM3)+" м³":"—"}</b>
           <span>{packing.result?.volumeComplete?"Объём всех коробов":"Объём известных коробов (не полный)"}</span></div>
         <div><b>{packing.result?num(packing.result.cargoWeightKg)+" кг":"—"}</b>
           <span>{packing.result?.weightComplete?"Вес всех коробов":"Вес известных коробов (не полный)"}</span></div>
         <div><b>{packing.result?.pallets.length??"—"}</b>
           <span>{packing.result?.packingComplete?"Паллет":"Рассчитано паллет (без коробов без габаритов)"}</span></div>
         <div><b>{packing.result?.maxHeightCm!==null&&packing.result?.maxHeightCm!==undefined?num(packing.result.maxHeightCm)+" см":"—"}</b>
           <span>{packing.result?.packingComplete?"Макс. высота с поддоном":"Макс. высота рассчитанных паллет"}</span></div>
         <div><b>{packing.result?num(packing.result.grossWeightKg)+" кг":"—"}</b>
           <span>{packing.result?.packingComplete&&packing.result?.weightComplete?"Вес с поддонами (15 кг/шт.)":"Известный вес + рассчитанные поддоны (не полный)"}</span></div>
       </div>
       <p className={styles.hint}>Основание паллеты 120 × 80 см, высота поддона 14,5 см, <b>вес каждого поддона всегда {PALLET_TARE_KG} кг</b>. {type==="mono"?
         "Монопаллета: общая высота от 50 до 180 см включительно.":
         type==="piece"?"Поштучная паллета: лимита высоты 50–180 см нет; ограничение по кузову транспорта. План укладки предварительный.":
         "Короб: план укладки по принципу Ozon. Грузоместами WB остаются короба."}</p>
       {type==="box"&&packing.result&&packing.result.volumeM3>1&&
         <p className={styles.warningText}>При сдаче коробами в СЦ, если общий объём превышает 1 м³, короба нужно разместить на паллетах.</p>}
       {packing.error&&<p className={styles.error}>{packing.error}</p>}
       {packing.result?.warnings.map((w,i)=><p key={i} className={styles.warningText}>{w}</p>)}
       {packing.result&&packing.result.pallets.length>0&&<div className={styles.palletGrid}>
         {packing.result.pallets.map(p=><div key={p.index} className={styles.palletItem}>
           <b>Паллета №{p.index}</b>
           <span>{p.cartons} коробов · {p.skuCount} SKU · {p.heightCm} см с поддоном</span>
           <span>Объём {p.volumeM3} м³ · Вес коробов {p.cargoWeightKg??"нет данных"} кг</span>
           <span>Вес с поддоном: {p.totalWeightKg!==null?num(p.totalWeightKg)+" кг":"часть весов неизвестна"}</span>
           <span>Состав: {p.contents.map(x=>x.sku+" × "+x.boxes+" кор.").join(", ")}</span>
           <span className={p.validHeight?styles.ok:styles.warning}>{type==="mono"?(p.validHeight?"Высота монопаллеты допустима":"Высота монопаллеты вне 50–180 см"):"Предварительная укладка, проверить высоту кузова"}</span>
         </div>)}
       </div>}
     </div>}
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
       </div>
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
       {choice.fallback?.used&&<small className={styles.directoryCredit}>Адреса: <a href="https://iseller.pro/otkrytye-dannye" target="_blank" rel="noreferrer">iseller.pro</a>. Доступность складов подтверждается в WB.</small>}
       {point&&<div className={styles.draftPanel}>
         <h3>Подготовить заявку в WB</h3>
         <p>Создадим настоящий черновик FBW в кабинете Wildberries, заполним и повторно проверим состав. Тип, точку сдачи и слот API черновиков не закрепляет. Их понадобится подтвердить в кабинете.</p>
         {draft?<p className={styles.ok}><strong>Черновик WB создан и проверен: {draft.draftId}</strong></p>:<>
           <button className={styles.primary} type="button" onClick={createDraft}
             disabled={draftBusy||!demand?.fresh||!selected.length||
               (type==="mono"&&(!packing.result?.canUseMono||packing.result.missingWeight>0))}>
             {draftBusy?"Создаю и проверяю черновик WB...":"Создать черновик WB с выбранными товарами"}
           </button>
           {draftError&&<p role="alert" className={styles.error}>{draftError}</p>}
         </>}
         <div className={styles.draftAudit}>
           <button type="button" disabled={draftsLoading} onClick={checkDrafts}>
             {draftsLoading?"Запрашиваю список WB...":"Проверить список черновиков через API WB"}
           </button>
           {draftsError&&<p role="alert" className={styles.error}>{draftsError}</p>}
           {draftList&&<div className={styles.draftAuditList}>
             <small>WB вернул {draftList.length} черновиков из первых 30. Это официальный GET /api/supplies/v1/drafts.</small>
             {draftList.length===0?<p>Черновиков пока нет.</p>:draftList.slice(0,30).map(item=><div key={item.draftId} className={styles.draftAuditRow}>
               <span>№ {item.draftId}</span>
               <span>{item.skuQuantity} SKU · {item.itemQuantity} шт.</span>
               <span>{item.createdAt?new Date(item.createdAt).toLocaleString("ru-RU"):"Без даты"}</span>
               {draft?.draftId===item.draftId&&<strong className={styles.ok}>Создан нами</strong>}
             </div>)}
           </div>}
         </div>
       </div>}

     </>}
   </section>
   <section className={styles.panel} ref={calendarRef}>
     <header><span className={styles.number}>4</span><div><h2>Выбрать дату и таймслот</h2><p>Переход в кабинет WB возможен после создания и проверки черновика товаров через API.</p></div></header>
     {!point?<p className={styles.hint}>Сначала выбери пункт прямой сдачи на шаге 3.</p>:
     !draft?<div className={styles.slotFallback}>
       <div className={styles.slotFallbackTitle}>Черновик WB ещё не создан</div>
       <p>Для продолжения нажми «Создать черновик WB с выбранными товарами» на шаге 3. Без этого ссылка в кабинет не означает, что товары загружены.</p>
     </div>:<>
       <div className={styles.confirm}>
         <strong>Черновик № {draft.draftId} создан, состав товаров проверен WB</strong>
         <span>Точка для выбора в кабинете: {point.name} · {point.address||point.city}</span>
         <span>{selected.length} SKU · {totals.boxes} коробов · {totals.units} шт. · {type==="mono"?"Монопаллета":type==="piece"?"Поштучная паллета":"Короб"}</span>
       </div>
       <div className={styles.slotFallback}>
         <div className={styles.slotFallbackTitle}>Продолжить оформление в Wildberries</div>
         <p>API позволяет создать только черновик с товарами. Он не может закрепить выбранную здесь точку сдачи, тип поставки и открыть непосредственно шаг календаря по draftId. В кабинете перейди в <b>Поставки и заказы → Поставки (FBW) → Черновики</b>, найди ID выше, выбери тип и точку сдачи, затем дату.</p>
         <p>Дата не ранее <b>{dateUTC(safeDay).toLocaleDateString("ru-RU",{day:"2-digit",month:"long",year:"numeric",timeZone:"UTC"})}</b>: это гарантирует минимум 120 часов без точного времени слота.</p>
         <a href={draft.url} target="_blank" rel="noopener noreferrer" className={styles.sellerLink}>Открыть кабинет WB и продолжить оформление черновика ↗</a>
         <p className={styles.warningText}>Открывается официальный кабинет продавца. Прямой адрес вкладки выбора времени для конкретного черновика WB не опубликован, поэтому адрес шага не подставляем наугад.</p>
       </div>
     </>}
     <p className={styles.warningText}>Черновик FBW ≠ подтверждённая поставка: бронирование слота и фактическое создание поставки завершаются на портале Wildberries.</p>
   </section>
   {error&&<p role="alert" className={styles.error}>{error}</p>}
 </div>;
}
