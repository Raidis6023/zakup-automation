import VedSectionIntro from "../VedSectionIntro";
import VedRegistryTable from "./VedRegistryTable";
import {buildVedRegistry,type VedRegistryOffer,type VedRegistrySavedVersion,
 type VedRegistrySourceItem,type VedRegistrySingleSnapshot} from "@/lib/ved-calculation/registry";
import {requireVedAccess,VedAccessError} from "@/lib/ved-calculation/server-access";
import {withUniqueOfferArticles} from "@/lib/ved-commercial-offers/article-identities";
import "./ved-registry.css";

export const dynamic="force-dynamic";
export const runtime="nodejs";

/** Read existing saved calculation versions. No schema migration or backfill required. */
export default async function VedRegistryPage(){
 let issue="";
 let rows:ReturnType<typeof buildVedRegistry>=[];
 let limited=false;
 try{
  const {admin}=await requireVedAccess();
  const [offerResult,snapshotResult]=await Promise.all([
   admin.from("ved_commercial_offers")
    .select("id,quote_code,supplier_code,quote_date")
    .order("created_at",{ascending:false}).limit(100),
   admin.from("ved_calculation_snapshots")
    .select("id,calculation_id,title,article,version_no,calculation_date,created_at,offer_item_id,input_data,result_data")
    .order("created_at",{ascending:false}).limit(200),
  ]);
  if(offerResult.error)throw offerResult.error;
  if(snapshotResult.error)throw snapshotResult.error;
  const offers=offerResult.data;
  const savedSingles=(snapshotResult.data||[]) as VedRegistrySingleSnapshot[];
  const list=(offers||[]) as VedRegistryOffer[];
  const ids=list.map(o=>o.id);
  let items:VedRegistrySourceItem[]=[];
  let versions:VedRegistrySavedVersion[]=[];
  if(ids.length){
   const [itemsFromDb,versionResult]=await Promise.all([
    (async()=>{
     const all:VedRegistrySourceItem[]=[];
     // PostgREST installations commonly cap a response to 1,000 rows.
     // Page explicitly so a busy archive doesn't silently lose SKUs.
     for(let offset=0;offset<5000;offset+=1000){
      const result=await admin.from("ved_commercial_offer_items")
       .select("id,offer_id,supplier_article,description_original,source_sheet,source_row")
       .in("offer_id",ids).order("offer_id",{ascending:true})
       .order("source_row",{ascending:true}).range(offset,offset+999);
      if(result.error)throw result.error;
      const batch=(result.data||[]) as VedRegistrySourceItem[];
      all.push(...batch);
      if(batch.length<1000)break;
     }
     return all;
    })(),
    admin.from("ved_offer_calculation_versions")
     .select("id,offer_id,version_no,calculation_date,created_at,items_data")
     .in("offer_id",ids).order("created_at",{ascending:false}).limit(200),
   ]);
   if(versionResult.error)throw versionResult.error;
   items=withUniqueOfferArticles(itemsFromDb);
   versions=(versionResult.data||[]) as VedRegistrySavedVersion[];
  }
  rows=buildVedRegistry(list,items,versions,savedSingles);
  limited=list.length===100||items.length===5000||versions.length===200||savedSingles.length===200;
 }catch(error){
  console.error("VED registry failed",error);
  issue=error instanceof VedAccessError?error.message:
   "Не удалось получить сохранённые расчёты из базы. Попробуйте открыть раздел повторно.";
 }
 return <VedSectionIntro title="Реестр товаров и расчётов"
  description="Поиск товаров, версии расчётов себестоимости и переход к исходным КП.">
  {issue?<article className="ved-module-panel ved-registry-panel" role="alert">
   <h2>Реестр недоступен</h2><p>{issue}</p>
  </article>:<VedRegistryTable rows={rows} limited={limited}/>}
 </VedSectionIntro>;
}
