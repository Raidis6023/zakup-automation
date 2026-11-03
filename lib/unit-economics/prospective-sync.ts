/**
 * Синхронизация сохранённых версий ВЭД с расчётной юнит-экономикой.
 * Вызывается после POST обоих калькуляторов и повторно из очереди.
 * Исторические версии ВЭД не изменяет.
 */
import type {createAdminClient} from "@/lib/supabase/admin";
import type {VedCalculationInput,VedCalculationResult} from "@/lib/ved-calculation/engine";
import {displayNewProductName,normalizeNewProductArticle} from "@/lib/products/new-product-identity";
import {PRELIMINARY_MODELS,calculatePreliminary,suggestPreliminaryTargetPrice,type PreliminarySettings,type PreliminarySource} from "./prospective-engine";
type Db=ReturnType<typeof createAdminClient>;
export type VedEventKind="single"|"whole";
type Pending=PreliminarySource&{itemId:string|null};
const chunk=<T>(items:readonly T[],size:number):T[][]=>{
 const out:T[][]=[];for(let n=0;n<items.length;n+=size)out.push(items.slice(n,n+size));return out;
};
function validArticle(article:string){return article.trim().length>0&&article.trim().length<=120}
function extractInputs(type:VedEventKind,data:Record<string,unknown>):Pending[]{
 if(type==="single"){
  const source={
   article:typeof data.article==="string"?data.article:"",
   name:typeof data.title==="string"?data.title:"",
   input:data.input_data as VedCalculationInput,
   result:data.result_data as VedCalculationResult,
   itemId:typeof data.offer_item_id==="string"?data.offer_item_id:null
  };
  return [source];
 }
 const values=data.items_data;
 if(!Array.isArray(values))throw Error("В версии КП отсутствует массив товаров");
 return values.map((value)=>{
  const v=value as Record<string,unknown>;
  return {
   article:typeof v.article==="string"?v.article:"",
   name:typeof v.title==="string"?v.title:"",
   input:v.input as VedCalculationInput,
   result:v.result as VedCalculationResult|null,
   itemId:typeof v.itemId==="string"?v.itemId:null
  };
 });
}
function reason(e:unknown){return e instanceof Error?e.message:String(e)}
const ready=(results:readonly{ok:boolean}[])=>results.every(x=>x.ok);
export async function syncUnitFromVedVersion(db:Db,type:VedEventKind,versionId:string,
 options:{force?:boolean}={}):Promise<{ok:boolean;processed:number;skipped:number;error?:string}>{
 const eventKey={source_type:type,source_version_id:versionId};
 const {data:event,error:eventErr}=await db.from("unit_ved_events")
  .select("id,status,attempts").eq("source_type",type).eq("source_version_id",versionId).maybeSingle();
 if(eventErr)return{ok:false,processed:0,skipped:0,error:"Нет очереди юнит-экономики: "+eventErr.message};
 if(!event)return{ok:false,processed:0,skipped:0,error:"Версия отсутствует в очереди"};
 if(event.status==="ready"&&!options.force)return{ok:true,processed:0,skipped:0};
 const {error:markErr}=await db.from("unit_ved_events").update({
  status:"processing",last_error:null,attempts:Number(event.attempts||0)+1
 }).eq("id",event.id);
 if(markErr)return{ok:false,processed:0,skipped:0,error:markErr.message};
 let processed=0,skipped=0;
 try{
  // Literal .select() strings are required for Supabase's typed result parser.
  const response=type==="single"
   ?await db.from("ved_calculation_snapshots")
      .select("id,article,title,created_at,offer_item_id,input_data,result_data")
      .eq("id",versionId).single()
   :await db.from("ved_offer_calculation_versions")
      .select("id,created_at,items_data").eq("id",versionId).single();
  const {data:saved,error:saveErr}=response;
  if(saveErr||!saved)throw Error("Не найдена версия ВЭД: "+(saveErr?.message||versionId));
  const timestamp=String(saved.created_at);
  const unique=new Map<string,Pending>();
  for(const row of extractInputs(type,saved as Record<string,unknown>)){
   const sku=normalizeNewProductArticle(row.article);
   if(!validArticle(sku)||!row.input?.product){
    skipped++;continue;
   }
   if(unique.has(sku)){
    // Нельзя незаметно объединять две строки КП с одним артикулом.
    throw Error("В сохранённой версии есть две позиции с одним артикулом: "+sku);
   }
   unique.set(sku,{
    ...row,article:sku,
    name:displayNewProductName(row.input.product.productName||row.name,sku)
   });
  }
  for(const list of chunk([...unique.values()],40)){
   const articles=list.map(x=>x.article);
   const {data:existing,error:existingErr}=await db.from("unit_ved_products")
    .select("id,article,ved_created_at").in("article",articles);
   if(existingErr)throw existingErr;
   const before=new Map((existing||[]).map(x=>[x.article,x]));
   const relevant=list.filter(x=>{
    const old=before.get(x.article);
    if(old&&String(old.ved_created_at)>timestamp){skipped++;return false}
    return true;
   });
   if(!relevant.length)continue;
   const rows=relevant.map(item=>{
    const first=calculatePreliminary(item,"ozon-fbo");
    return{
     article:item.article,name:item.name,source_type:type,source_version_id:versionId,
     source_item_id:item.itemId,ved_created_at:timestamp,
     input_data:item.input,result_data:item.result,
     cost_gross_rub:first.costGrossRub,purchase_vat_credit_rub:first.purchaseVatCreditRub,
     volume_liters:first.volumeLiters,volume_source:first.volumeSource,
     updated_at:new Date().toISOString()
    };
   });
   const {data:products,error:prodErr}=await db.from("unit_ved_products")
    .upsert(rows,{onConflict:"article"}).select("id,article");
   if(prodErr||!products)throw Error("Не сохранены новые товары: "+(prodErr?.message||"нет данных"));
   const ids=products.map(x=>x.id);
   const {data:settings,error:settingsErr}=await db.from("unit_ved_settings")
    .select("product_id,model,data,revision").in("product_id",ids);
   if(settingsErr)throw settingsErr;
   const settingsMap=new Map((settings||[]).map(x=>[x.product_id+":"+x.model,x]));
   const rowsCalc:Record<string,unknown>[]=[],rowsHistory:Record<string,unknown>[]=[];
   for(const p of products){
    const source=relevant.find(x=>x.article===p.article)!;
    for(const model of PRELIMINARY_MODELS){
     const config=settingsMap.get(p.id+":"+model);
     const revision=Number(config?.revision||1);
     let result:ReturnType<typeof calculatePreliminary>;
     try{
      const settings=(config?.data||{}) as PreliminarySettings;
      const target=suggestPreliminaryTargetPrice(source,model,settings);
      const selectedPrice=typeof settings.priceRub==="number"&&settings.priceRub>0
        ?settings.priceRub:target.priceRub;
      result=calculatePreliminary(source,model,{
       ...settings,...(selectedPrice===null?{}:{priceRub:selectedPrice})
      });
      result.targetPriceRub=target.priceRub;
     }catch(e){
      const fallback=calculatePreliminary(source,model,{});
      result={...fallback,status:"needs_input",missing:[...fallback.missing,"Ошибка настроек: "+reason(e)]};
     }
     rowsCalc.push({
      product_id:p.id,model,source_type:type,source_version_id:versionId,
      status:result.status,missing:result.missing,result_data:result,computed_at:new Date().toISOString()
     });
     rowsHistory.push({
      product_id:p.id,model,source_type:type,source_version_id:versionId,
      settings_revision:revision,status:result.status,result_data:result
     });
    }
    processed++;
   }
   for(const portion of chunk(rowsCalc,100)){
    const {error}=await db.from("unit_ved_calculations")
     .upsert(portion,{onConflict:"product_id,model"});
    if(error)throw Error("Не сохранены расчёты: "+error.message);
   }
   for(const portion of chunk(rowsHistory,100)){
    const {error}=await db.from("unit_ved_history")
     .upsert(portion,{onConflict:"product_id,model,source_type,source_version_id,settings_revision",ignoreDuplicates:true});
    if(error)throw Error("Не сохранена история: "+error.message);
   }
  }
  const {error:doneErr}=await db.from("unit_ved_events").update({
   status:"ready",processed_at:new Date().toISOString(),last_error:null
  }).eq("id",event.id);
  if(doneErr)throw Error(doneErr.message);
  return{ok:true,processed,skipped};
 }catch(e){
  const error=reason(e).slice(0,1000);
  await db.from("unit_ved_events").update({status:"failed",last_error:error}).eq("id",event.id);
  return{ok:false,processed,skipped,error};
 }
}
export async function retryPendingUnitVedEvents(db:Db,limit=10){
 const {data,error}=await db.from("unit_ved_events")
  .select("source_type,source_version_id").in("status",["pending","failed"])
  .order("created_at",{ascending:true}).limit(Math.max(1,Math.min(limit,25)));
 if(error)throw error;
 const output:Awaited<ReturnType<typeof syncUnitFromVedVersion>>[]=[];
 for(const event of data||[])output.push(await syncUnitFromVedVersion(
  db,event.source_type as VedEventKind,event.source_version_id,{force:true}
 ));
 return output;
}
