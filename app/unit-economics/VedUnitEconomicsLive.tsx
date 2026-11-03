"use client";
import {useEffect,useState} from "react";
type Scheme={
 model:string;status:string;missing:string[];
 costGrossRub:number|null;volumeLiters:number|null;
 unitWeightKg:number|null;unitWeightFormula:string|null;unitWeightWarning:string|null;
 priceRub:number|null;priceAfterSppRub:number|null;targetPriceRub:number|null;
 profitRub:number|null;roi:number|null;margin:number|null;computedAt:string;
};
type Product={
 id:string;article:string;name:string;ved_created_at:string;
 overrides?:{name?:string;productType?:string;costGrossRub?:number;
  product?:Record<string,number>};
 input_data?:{product?:Record<string,number|string|undefined>};
 edit_revision?:number;
 cost_gross_rub:number|null;volume_liters:number|null;unit_weight_kg:number|null;
 volume_source:string|null;source_type:string;source_version_id:string;
 schemes:Record<string,Scheme>;
};
const MODELS=[
 ["ozon-fbo","Ozon FBO"],["ozon-fbs","Ozon FBS"],
 ["wb-fbw","WB FBW"],["wb-fbs","WB FBS"],
 ["ym-fby","Яндекс FBY"],["ym-fbs","Яндекс FBS"]
] as const;
function formatNumber(n:number|null,percent=false){
 if(n===null||!Number.isFinite(n))return "—";
 const value=percent?n*100:n;
 if(value===0)return "0";
 const magnitude=Math.abs(value);
 for(let digits=0;digits<14;digits++){
  const unit=10**digits;
  const rounded=Math.round((magnitude+Number.EPSILON*magnitude)*unit)/unit;
  if(rounded!==0)return(value<0?"−":"")+new Intl.NumberFormat("ru-RU",{
   minimumFractionDigits:digits,maximumFractionDigits:digits
  }).format(rounded)+(percent?"%":"");
 }
 return String(value);
}
export default function VedUnitEconomicsLive({modalProductId,activeModel,onClose,onSaved}:{
 modalProductId?:string|null;
 activeModel?:string;
 onClose?:()=>void;
 onSaved?:()=>void;
}={}){
 const [products,setProducts]=useState<Product[]>([]);
 const [localModel,setModel]=useState<string>("ozon-fbo");
 const model=activeModel||localModel;
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [revision,setRevision]=useState(0);
 const [retrying,setRetrying]=useState(false);
 const [editing,setEditing]=useState<string|null>(modalProductId||null);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [dirty,setDirty]=useState<string[]>([]);
 const [saving,setSaving]=useState(false);
 const [saveError,setSaveError]=useState("");
 const selectedProduct=products.find(p=>p.id===editing);
 function closeEditor(){setEditing(null);onClose?.();}
 const editFields=[
  {key:"individualLengthCm",label:"Длина индивидуальной упаковки, см"},
  {key:"individualWidthCm",label:"Ширина индивидуальной упаковки, см"},
  {key:"individualHeightCm",label:"Высота индивидуальной упаковки, см"},
  {key:"cartonGrossKg",label:"Вес транспортировочной коробки брутто, кг"},
  {key:"cartonVolumeM3",label:"Объём транспортировочной коробки, м³"},
  {key:"unitsPerCarton",label:"Количество штук в коробке"},
  {key:"moqUnits",label:"MOQ, шт."}
 ] as const;
 function openEditor(p:Product){
  const next:Record<string,string>={
   name:p.name,productType:p.overrides?.productType||"",
   costGrossRub:p.cost_gross_rub===null?"":String(p.cost_gross_rub),
   priceRub:p.schemes[model]?.priceRub===null||p.schemes[model]?.priceRub===undefined
    ?"":String(p.schemes[model].priceRub)
  };
  for(const entry of editFields){
   const value=p.overrides?.product?.[entry.key]??p.input_data?.product?.[entry.key];
   next[entry.key]=value===null||value===undefined?"":String(value);
  }
  setDraft(next);setDirty([]);setSaveError("");setEditing(p.id);
 }
 function changeDraft(key:string,value:string){
  setDraft(prev=>({...prev,[key]:value}));
  setDirty(prev=>prev.includes(key)?prev:[...prev,key]);
 }
 async function saveEditor(e:React.FormEvent){
  e.preventDefault();
  if(!selectedProduct||!dirty.length){closeEditor();return;}
  const productPatch:Record<string,unknown>={};
  const shared=new Set(["name","productType","costGrossRub",...editFields.map(x=>x.key)]);
  for(const key of dirty){
   if(!shared.has(key))continue;
   const value=draft[key]?.trim()??"";
   productPatch[key]=key==="name"||key==="productType"?value||null:value===""?null:Number(value.replace(",","."));
  }
  const data:Record<string,unknown>={productId:selectedProduct.id,model,productPatch};
  if(dirty.includes("priceRub")){
   const price=draft.priceRub?.trim()??"";
   data.priceRub=price===""?null:Number(price.replace(",","."));
  }
  setSaving(true);setSaveError("");
  try{
   const response=await fetch("/api/unit-economics/prospective",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",body:JSON.stringify(data)
   });
   const answer=await response.json();
   if(!response.ok||!answer.ok)throw Error(answer.error||answer.warning||"Не удалось сохранить");
   if(modalProductId){onSaved?.();closeEditor();}
   else {setEditing(null);setLoading(true);setRevision(x=>x+1);}
  }catch(e){setSaveError(e instanceof Error?e.message:String(e))}
  finally{setSaving(false)}
 }
 async function retryQueue(){
  setRetrying(true);
  try{
   const response=await fetch("/api/unit-economics/prospective",{
    method:"POST",headers:{"Content-Type":"application/json"},
    credentials:"same-origin",body:JSON.stringify({action:"retry-pending"})
   });
   const result=await response.json();
   if(!response.ok||!result.ok)throw Error(result.error||"Не удалось обработать очередь");
   if(result.failures?.length)setError("Часть версий ожидает повторной обработки: "+result.failures.join("; "));
   setRevision(x=>x+1);
  }catch(e){setError(e instanceof Error?e.message:String(e))}
  finally{setRetrying(false)}
 }
 useEffect(()=>{
  const controller=new AbortController();
  fetch("/api/unit-economics/prospective"+(modalProductId?"?productId="+encodeURIComponent(modalProductId):""),{cache:"no-store",signal:controller.signal})
   .then(async response=>{
    const body=await response.json();
    if(!response.ok||!body.ok)throw Error(body.error||"Не удалось прочитать новые товары");
    if(!controller.signal.aborted){setProducts(body.products||[]);setError("");}
   }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e))})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false)});
  return ()=>controller.abort();
 },[revision,modalProductId]);
 useEffect(()=>{
  if(!modalProductId)return;
  const product=products.find(p=>p.id===modalProductId);
  if(product&&draft.name===undefined)openEditor(product);
 // Product rows only reload after save; avoid resetting edits on each keystroke.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[modalProductId,products]);
 return <>
  {!modalProductId&&<section className="unit-pilot" style={{marginBottom:20}}>
  <div className="unit-pilot-top">
   <strong>Товары из реестра ВЭД · автоматическая юнит-экономика</strong>
   <div style={{display:"flex",gap:8}}>
    <button type="button" onClick={()=>{setLoading(true);setRevision(x=>x+1)}}>Обновить данные</button>
    <button type="button" disabled={retrying} onClick={()=>void retryQueue()}>
     {retrying?"Пересчёт…":"Обработать ожидающие версии"}
    </button>
   </div>
  </div>
  <p className="unit-pilot-notice">После сохранения версии ВЭД подтягиваются себестоимость, габариты и упаковка. Вес единицы товара автоматически рассчитывается по брутто-весу транспортной коробки и её вложимости; вручную не редактируется.
   При отсутствии категории, процента выкупа или WB СПП расчёт остаётся незавершённым.
   ЕНОТ новым товарам не присваивается.</p>
  <div className="unit-pilot-tabs" role="tablist" aria-label="Схема продаж">
   {MODELS.map(([key,label])=><button key={key} type="button" role="tab"
    aria-selected={model===key} className={model===key?"active":""}
    onClick={()=>setModel(key)}>{label}</button>)}
  </div>
  {loading?<p className="unit-pilot-notice">Загрузка записей ВЭД…</p>:
   error?<p className="unit-pilot-notice" role="alert">Невозможно прочитать автоматические расчёты: {error}</p>:
   !products.length?<p className="unit-pilot-notice">Пока нет рассчитанных товаров из сохранённых версий ВЭД.</p>:
   <div className="unit-pilot-scroller"><table className="unit-pilot-table">
    <thead><tr><th>Название / артикул</th><th>Себестоимость, ₽</th><th>Литраж ИУ</th>
     <th>Вес ед., кг</th><th>Цена продажи, ₽</th><th>Чистая прибыль, ₽</th><th>ROI</th><th>Статус</th><th>Правка</th></tr></thead>
    <tbody>{products.map(p=>{
     const s=p.schemes[model];
     return <tr key={p.id}>
      <td className="unit-pilot-name">{p.name}<small>{p.article}</small></td>
      <td>{formatNumber(s?.costGrossRub??p.cost_gross_rub)}</td>
      <td>{formatNumber(s?.volumeLiters??p.volume_liters)}</td>
      <td title={s?.unitWeightFormula||s?.unitWeightWarning||"Вес коробки брутто / количество товаров в коробке. Данных ВЭД пока нет."}>
       <output aria-label="Расчётный вес единицы товара, кг">{formatNumber(s?.unitWeightKg??p.unit_weight_kg??null)}</output>
       <small style={{display:"block",opacity:.7}}>Вес коробки / шт.</small>
      </td>
      <td>{formatNumber(s?.priceRub??null)}</td>
      <td>{formatNumber(s?.profitRub??null)}</td>
      <td>{formatNumber(s?.roi??null,true)}</td>
      <td title={(s?.missing||[]).join("; ")}>{s?.status==="calculated"?"Рассчитано":
       s?.status==="estimated"?"Предварительно":
       s?.status==="invalid_ved"?"Ошибка ВЭД":
       (s?.missing?.length?"Не хватает: "+s.missing.join(", "):"Ожидает данных")}</td>
      <td><button type="button" onClick={()=>openEditor(p)}>Изменить</button></td>
     </tr>;
    })}</tbody>
   </table></div>}
  </section>}
  {modalProductId&&error&&<p role="alert" className="unit-pilot-notice">{error}</p>}
  {modalProductId&&loading&&!selectedProduct&&<p className="unit-pilot-notice">Загрузка товара из ВЭД…</p>}
  {selectedProduct&&<div className="unit-pilot-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving)closeEditor()}}>
   <div className="unit-pilot-modal" role="dialog" aria-modal="true" aria-label="Редактирование исходных данных товара" style={{width:"min(95vw,860px)"}}>
    <form onSubmit={saveEditor} style={{overflow:"auto"}}>
     <header className="unit-pilot-modal-head">
      <div style={{flex:1}}>
       <label style={{display:"block",fontWeight:700}}>Название товара
        <input value={draft.name||""} onChange={e=>changeDraft("name",e.target.value)}
         aria-label="Название товара" required maxLength={300} className="unit-pilot-price-input" style={{width:"100%",marginTop:7}}/>
       </label>
       <p style={{fontSize:12,opacity:.7}}>Артикул: {selectedProduct.article} (не редактируется)</p>
      </div>
      <button type="button" onClick={closeEditor} disabled={saving} aria-label="Закрыть">×</button>
     </header>
     <div className="unit-pilot-modal-body">
      <p className="unit-pilot-notice">Исходные данные ВЭД не изменяются. Ручные корректировки сохраняются отдельно
       и применяются ко всем маркетплейсам. Цена продажи относится только к выбранной схеме.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:12}}>
       <label>Тип товара (вводится вручную)
        <input className="unit-pilot-price-input" style={{display:"block",width:"100%",marginTop:5}}
         value={draft.productType||""} maxLength={150} onChange={e=>changeDraft("productType",e.target.value)}/>
       </label>
       <label>Себестоимость с НДС, ₽
        <input className="unit-pilot-price-input" style={{display:"block",width:"100%",marginTop:5}}
         type="number" min="0.000001" step="any" value={draft.costGrossRub||""}
         onChange={e=>changeDraft("costGrossRub",e.target.value)}/>
       </label>
       {editFields.map(field=><label key={field.key}>{field.label}
        <input className="unit-pilot-price-input" style={{display:"block",width:"100%",marginTop:5}}
         type="number" min="0.000001" step={field.key==="unitsPerCarton"||field.key==="moqUnits"?"1":"any"}
         value={draft[field.key]||""} onChange={e=>changeDraft(field.key,e.target.value)}/>
       </label>)}
       <label>Цена продажи, ₽ · {MODELS.find(x=>x[0]===model)?.[1]}
        <input className="unit-pilot-price-input" style={{display:"block",width:"100%",marginTop:5}}
         type="number" min="0.01" step="any" value={draft.priceRub||""}
         onChange={e=>changeDraft("priceRub",e.target.value)}/>
       </label>
       <label>Вес товара, кг · рассчитывается автоматически
        <output style={{display:"block",padding:"10px 12px",marginTop:5,
         borderRadius:8,background:"var(--ws-surface-soft)",fontWeight:700}}
         title="Вес брутто транспортировочной коробки / количество штук в ней">
         {Number(draft.cartonGrossKg)>0&&Number(draft.unitsPerCarton)>0?
          formatNumber(Number(draft.cartonGrossKg)/Number(draft.unitsPerCarton))+" кг":"Нет данных"}
        </output>
       </label>
      </div>
      <p className="unit-pilot-note">Тип товара сохраняется как исходный параметр. Категорию комиссии,
       процент выкупа и WB СПП нужно определить отдельно, как согласовали ранее.</p>
      {saveError&&<p role="alert" className="unit-pilot-notice">{saveError}</p>}
      <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
       <button type="button" disabled={saving} onClick={closeEditor}>Отмена</button>
       <button type="submit" disabled={saving||dirty.length===0}>{saving?"Сохранение…":"Сохранить и пересчитать"}</button>
      </div>
     </div>
    </form>
   </div>
  </div>}
 </>;
}
