import {syncUnitFromVedVersion} from "@/lib/unit-economics/prospective-sync";
import {NextResponse} from "next/server";
import {requireVedAccess,VedAccessError} from "@/lib/ved-calculation/server-access";
import {calculateVed,VedInputError,type VedCalculationInput} from "@/lib/ved-calculation/engine";
import {isValidTariffDate} from "@/lib/ved-calculation/tariffs";
import {offerArticleAliases,withUniqueOfferArticles} from "@/lib/ved-commercial-offers/article-identities";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Entry={itemId:string;input:VedCalculationInput};
const bad=(text:string,status=400)=>NextResponse.json({ok:false,error:text},{status});
const failure=(e:unknown)=>{
 if(e instanceof VedAccessError)return bad(e.message,e.status);
 console.error("VED whole-offer calculation",e);
 return bad("Не удалось сохранить общий расчёт КП",500);
};
export async function GET(request:Request){
 try{
  const {admin}=await requireVedAccess();
  const offerId=new URL(request.url).searchParams.get("offerId")||"";
  if(!uuid.test(offerId))return bad("Неверный идентификатор КП");
  const versionId=new URL(request.url).searchParams.get("versionId");
  if(versionId&&!uuid.test(versionId))return bad("Неверный идентификатор версии");
  const fields="id,offer_id,version_no,calculation_date,items_data,tariffs_data,created_at";
  const {data,error}=await admin.from("ved_offer_calculation_versions")
   .select(fields).eq("offer_id",offerId).order("version_no",{ascending:false}).limit(50);
  if(error)throw error;
  const versions=[...(data||[])];
  if(versionId&&!versions.some(v=>v.id===versionId)){
   const {data:exact,error:lookupError}=await admin.from("ved_offer_calculation_versions")
    .select(fields).eq("offer_id",offerId).eq("id",versionId).maybeSingle();
   if(lookupError)throw lookupError;
   if(exact)versions.push(exact);
  }
  const {data:quoteItems,error:quoteError}=await admin.from("ved_commercial_offer_items")
   .select("id,offer_id,source_sheet,source_row,supplier_article").eq("offer_id",offerId).limit(450);
  if(quoteError)throw quoteError;
  const aliases=offerArticleAliases(quoteItems||[]);
  // Historical version JSON stays immutable; returned article labels are unique.
  const projected=versions.map(version=>({...version,
   items_data:Array.isArray(version.items_data)?version.items_data.map(
    (row:{itemId?:string;article?:string})=>({...row,article:aliases.get(row.itemId||"")||row.article})
   ):version.items_data
  }));
  return NextResponse.json({ok:true,versions:projected},{headers:{"Cache-Control":"private,no-store"}});
 }catch(e){return failure(e);}
}
export async function POST(request:Request){
 try{
  const {admin,user}=await requireVedAccess(true);
  const payload=await request.json() as {offerId?:unknown;calculationDate?:unknown;items?:unknown};
  const offerId=payload.offerId,calculationDate=payload.calculationDate;
  if(typeof offerId!=="string"||!uuid.test(offerId)||typeof calculationDate!=="string"||
   !isValidTariffDate(calculationDate)||!Array.isArray(payload.items)||
   !payload.items.length||payload.items.length>400)return bad("Неверные данные расчёта КП");
  const {data:offer,error:offerError}=await admin.from("ved_commercial_offers")
   .select("id,quote_code,quote_date,status").eq("id",offerId).maybeSingle();
  if(offerError)throw offerError;
  if(!offer)return bad("Коммерческое предложение не найдено",404);
  const {data:stored,error:itemError}=await admin.from("ved_commercial_offer_items")
   .select("id,offer_id,source_sheet,source_row,supplier_article,description_original").eq("offer_id",offerId).limit(450);
  if(itemError)throw itemError;
  const items=withUniqueOfferArticles(stored||[]);
  const byId=new Map(items.map(x=>[x.id,x]));
  const storedIds=new Set(items.map(x=>x.id));
  const source=payload.items as Entry[];
  const givenIds=source.map(x=>x?.itemId);
  if(source.length!==storedIds.size||new Set(givenIds).size!==source.length||
   givenIds.some(id=>!storedIds.has(id)))return bad("В расчёте должны присутствовать все товары этого КП",409);
  const entries=source.map((raw)=>{
   if(!raw||typeof raw.input!=="object"||raw.input===null||Array.isArray(raw.input))
    throw new Error("Некорректная структура входных данных");
   const item=byId.get(raw.itemId)!;
   const input=raw.input;
   if(JSON.stringify(input).length>18000)throw new Error("Слишком длинные исходные данные товара");
   try{
    const result=calculateVed(input);
    return {itemId:raw.itemId,article:item.supplier_article,title:item.description_original,
     input,result,errors:[] as string[]};
   }catch(e){
    if(!(e instanceof VedInputError))throw e;
    return {itemId:raw.itemId,article:item.supplier_article,title:item.description_original,
     input,result:null,errors:e.issues};
   }
  });
  const readyCount=entries.filter(x=>x.result).length;
  for(let retry=0;retry<4;retry++){
   const {data:latest,error:latestError}=await admin.from("ved_offer_calculation_versions")
    .select("version_no").eq("offer_id",offerId).order("version_no",{ascending:false}).limit(1);
   if(latestError)throw latestError;
   const version=Number(latest?.[0]?.version_no||0)+1;
   const {data:created,error:insertError}=await admin.from("ved_offer_calculation_versions").insert({
    offer_id:offerId,version_no:version,calculation_date:calculationDate,
    items_data:entries,tariffs_data:{
     status:readyCount===entries.length?"calculated":"needs_review",
     quoteCode:offer.quote_code,quoteDate:offer.quote_date,
     readyCount,totalCount:entries.length,
    },created_by:user.id,
   }).select("id,version_no,created_at").single();
   if(insertError?.code==="23505")continue;
   if(insertError)throw insertError;
   // Обновляем расчётную юнитку по всем позициям КП. При сбое событие остаётся в очереди БД.
   const unitEconomics=await syncUnitFromVedVersion(admin,"whole",created.id);
   if(!unitEconomics.ok)console.error("Whole VED unit sync queued for retry:",unitEconomics.error);
   return NextResponse.json({ok:true,version:created,readyCount,totalCount:entries.length,unitEconomics,
    warning:!unitEconomics.ok?"ВЭД сохранён. Юнит-экономика в очереди повторной обработки: "+unitEconomics.error:
      readyCount===entries.length?null:"Не все товары рассчитаны. Недостающие поля отмечены; версия сохранена для доработки."},
    {headers:{"Cache-Control":"private,no-store"}});
  }
  return bad("Не удалось выделить номер версии КП. Повторите сохранение.",409);
 }catch(e){return failure(e);}
}
