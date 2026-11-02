export type VedRegistryOffer={id:string;quote_code:string;supplier_code:string;quote_date:string};
export type VedRegistrySourceItem={
 id:string;offer_id:string;supplier_article:string;description_original:string;
 source_sheet?:string|null;source_row?:number|null;
};
export type VedRegistrySavedEntry={
 itemId:string;article?:string;title?:string;
 input?:{product?:{tnVedCode?:string}};
 result?:{
  averageCostPerUnitRub?:number;
  scenarios?:{"40hq"?:{managementCostPerUnitRub?:number};moq?:{managementCostPerUnitRub?:number}};
 }|null;
 errors?:string[];
};
export type VedRegistrySavedVersion={
 id:string;offer_id:string;version_no:number;calculation_date:string;
 created_at:string;items_data:VedRegistrySavedEntry[];
};
export type VedRegistryCost={average:number;container:number|null;moq:number|null};
export type VedRegistrySingleSnapshot={
 id:string;calculation_id:string;title:string;article:string;version_no:number;
 calculation_date:string;created_at:string;offer_item_id?:string|null;
 input_data?:{product?:{tnVedCode?:string;productName?:string}};
 result_data?:VedRegistrySavedEntry["result"];
};
export type VedRegistryHistory={
 id:string;number:number;date:string;createdAt:string;type:"whole"|"single";
 cost:VedRegistryCost|null;issues:string[];tnVedCode:string;
};
export type VedRegistryRow={
 id:string;offerId:string;article:string;title:string;sourceSheet:string;
 quoteCode:string;supplier:string;quoteDate:string;
 history:VedRegistryHistory[];
};
function valid(x:unknown):number|null{
 return typeof x==="number"&&Number.isFinite(x)?x:null;
}
function cost(result:VedRegistrySavedEntry["result"]):VedRegistryCost|null{
 if(!result)return null;
 const avg=valid(result.averageCostPerUnitRub);
 if(avg===null)return null;
 return {average:avg,container:valid(result.scenarios?.["40hq"]?.managementCostPerUnitRub),
  moq:valid(result.scenarios?.moq?.managementCostPerUnitRub)};
}
/** Join existing KP items and immutable whole-offer versions without editing historical data. */
export function buildVedRegistry(
 offers:VedRegistryOffer[],items:VedRegistrySourceItem[],versions:VedRegistrySavedVersion[],
 snapshots:VedRegistrySingleSnapshot[]=[],
):VedRegistryRow[]{
 const knownOffers=new Map(offers.map(o=>[o.id,o]));
 const byKey=new Map<string,VedRegistryRow>();
 const make=(id:string,offerId:string,article:string,title:string,sourceSheet="")=>{
  const key=offerId+":"+id;
  const existing=byKey.get(key);
  if(existing)return existing;
  const quote=knownOffers.get(offerId);
  const row:VedRegistryRow={
   id,offerId,article,title:title.split("\n")[0]||article,sourceSheet,
   quoteCode:quote?.quote_code||"—",supplier:quote?.supplier_code||"—",
   quoteDate:quote?.quote_date||"",history:[],
  };
  byKey.set(key,row);
  return row;
 };
 for(const item of items)make(item.id,item.offer_id,item.supplier_article,
  item.description_original,item.source_sheet||"");
 // Versions may include incomplete snapshots: show those in history, but keep
 // the latest successfully computed cost visible rather than replacing it with zero.
 for(const version of [...versions].sort((a,b)=>
  b.created_at.localeCompare(a.created_at)||b.version_no-a.version_no)){
  if(!knownOffers.has(version.offer_id)||!Array.isArray(version.items_data))continue;
  for(const entry of version.items_data){
   if(!entry||typeof entry.itemId!=="string")continue;
   const row=make(entry.itemId,version.offer_id,entry.article||"",
    entry.title||entry.article||"");
   if(row.history.some(x=>x.id===version.id))continue;
   row.history.push({id:version.id,number:version.version_no,type:"whole",
    date:version.calculation_date,createdAt:version.created_at,
    cost:cost(entry.result),issues:Array.isArray(entry.errors)?entry.errors:[],
    tnVedCode:entry.input?.product?.tnVedCode||""});
  }
 }
 // Standalone calculator snapshots also belong in the registry. Link to a
 // source-KP item when possible; otherwise show an independent calculation.
 const byItemId=new Map(items.map(item=>[item.id,item]));
 for(const saved of snapshots){
  const matched=saved.offer_item_id?byItemId.get(saved.offer_item_id):undefined;
  const row=matched?make(matched.id,matched.offer_id,matched.supplier_article,
   matched.description_original,matched.source_sheet||""):
   make(saved.calculation_id,"",saved.article||"Без артикула",
    saved.title||saved.input_data?.product?.productName||"Отдельный расчёт");
  row.history.push({id:saved.id,number:saved.version_no,type:"single",
   date:saved.calculation_date,createdAt:saved.created_at,
   cost:cost(saved.result_data),issues:[],
   tnVedCode:saved.input_data?.product?.tnVedCode||""});
 }
 for(const row of byKey.values())row.history.sort((a,b)=>
  b.createdAt.localeCompare(a.createdAt)||b.number-a.number);
 return [...byKey.values()].sort((a,b)=>{
  const x=a.history[0]?.createdAt||"";
  const y=b.history[0]?.createdAt||"";
  return y.localeCompare(x)||a.quoteCode.localeCompare(b.quoteCode)||
   a.article.localeCompare(b.article,"ru");
 });
}
