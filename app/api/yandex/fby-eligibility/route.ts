import ExcelJS from "exceljs";
import {
  FBY_WAREHOUSES, mapWarehouseColumn, normalizeHeader, normalizeOfferId,
  eligibilityIsStale, type EligibilitySnapshot, type EligibilityValue
} from "@/lib/yandex-fby-eligibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Product = {
  offer_id: string;
  is_active: boolean;
  raw_data: { offer?: { name?: string; barcodes?: string[] } | null; mapping?: { marketSkuName?: string } } | null;
};

function supabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("Не настроено подключение Supabase");
  return { url, key };
}
async function dbGet<T>(table: string, select: string, query: Record<string,string> = {}): Promise<T[]> {
  const {url,key}=supabaseConfig();
  const rows:T[]=[];
  for(let offset=0;offset<200000;offset+=1000){
    const target=new URL(url+"/rest/v1/"+table);
    target.searchParams.set("select",select);
    target.searchParams.set("limit","1000");
    target.searchParams.set("offset",String(offset));
    for(const [k,v] of Object.entries(query))target.searchParams.set(k,v);
    const response=await fetch(target,{headers:{apikey:key,Authorization:"Bearer "+key},cache:"no-store"});
    if(!response.ok)throw new Error("Supabase: HTTP "+response.status);
    const page=await response.json() as T[];
    rows.push(...page);
    if(page.length<1000)break;
  }
  return rows;
}

async function latestSnapshot() {
  const list=await dbGet<EligibilitySnapshot>("yandex_fby_eligibility_snapshots",
    "id,created_at,source_file,offers_count,warehouse_count,mapping,headers,unknown_offers",
    {order:"created_at.desc",limit:"1"});
  return list[0]||null;
}
async function activeProducts(){
  return dbGet<Product>("yandex_products","offer_id,is_active,raw_data",{is_active:"eq.true"});
}

function cellString(value: ExcelJS.CellValue): string {
  if(value===null || value===undefined)return "";
  if(typeof value==="string")return value.trim();
  if(typeof value==="number" || typeof value==="boolean")return String(value);
  if(value instanceof Date)return value.toISOString();
  if(typeof value==="object"){
    if("richText" in value && Array.isArray(value.richText))
      return value.richText.map(x=>x.text||"").join("").trim();
    if("text" in value && typeof value.text==="string")return value.text.trim();
    if("result" in value && value.result!==undefined)return cellString(value.result as ExcelJS.CellValue);
  }
  return "";
}
function status(value: string): EligibilityValue | null {
  const v=normalizeHeader(value);
  if(["да","yes","можно","разрешено"].includes(v))return "yes";
  if(["нет","no","нельзя","запрещено"].includes(v))return "no";
  return null;
}

function headersByRow(sheet: ExcelJS.Worksheet): {row: number;skuCol: number;warehouseCols: Array<{col:number;id:number;name:string}>;unknownColumns:string[]} | null {
  for(let rowNum=1;rowNum<=Math.min(sheet.rowCount,15);rowNum++){
    const row=sheet.getRow(rowNum);
    let skuCol=0;
    row.eachCell({includeEmpty:false},(cell,col)=>{
      if(normalizeHeader(cellString(cell.value))==="ваш sku")skuCol=col;
    });
    if(!skuCol)continue;
    const warehouseCols:Array<{col:number;id:number;name:string}>=[];
    const seen=new Set<number>();
    const unknownColumns:string[]=[];
    const standard=new Set(["ваш sku","наименование","штрихкод","общее кол-во для поставки","как привезти товар?"]);
    for(let col=skuCol+1;col<=Math.min(Math.max(30,sheet.columnCount),100);col++){
      const label=cellString(row.getCell(col).value);
      const warehouse=mapWarehouseColumn(label);
      if(!warehouse){
        if(col>=6&&label&&!standard.has(normalizeHeader(label)))unknownColumns.push(label);
        continue;
      }
      if(seen.has(warehouse.id))throw new Error("Повторный столбец склада "+label);
      warehouseCols.push({col,id:warehouse.id,name:warehouse.name});
      seen.add(warehouse.id);
    }
    if(warehouseCols.length>0)return {row:rowNum,skuCol,warehouseCols,unknownColumns};
  }
  return null;
}

async function exportCatalog():Promise<Response>{
  const products=await activeProducts();
  const wb=new ExcelJS.Workbook();
  const sheet=wb.addWorksheet("Поставка");
  sheet.columns=[
    {header:"Ваш SKU",key:"sku",width:40},
    {header:"Наименование",key:"name",width:68},
    {header:"Штрихкод",key:"barcode",width:33},
    {header:"Общее кол-во для поставки",key:"quantity",width:30}
  ];
  sheet.getRow(1).font={bold:true};
  sheet.getRow(1).eachCell(cell=>cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:"FFE2EEF9"}});
  for(const product of products.sort((a,b)=>a.offer_id.localeCompare(b.offer_id,"ru"))){
    const raw=product.raw_data;
    const name=raw?.offer?.name||raw?.mapping?.marketSkuName||"";
    const barcodes=(raw?.offer?.barcodes||[]).filter(Boolean).join(", ");
    const row=sheet.addRow({sku:product.offer_id,name,barcode:barcodes,quantity:1});
    row.getCell(1).numFmt="@";
    row.getCell(3).numFmt="@";
  }
  const instructions=wb.addWorksheet("ИНСТРУКЦИЯ");
  instructions.getColumn(1).width=115;
  [
    "ТОЛЬКО ДЛЯ ПРОВЕРКИ ВОЗМОЖНОСТИ ПОСТАВКИ. НЕ ПОДТВЕРЖДАТЬ СОЗДАНИЕ ПОСТАВКИ!",
    "Файл содержит все активные SKU из нашего каталога Яндекс Маркета.",
    "Загрузите его в шаге создания мультипоставки Яндекс Селлера, чтобы Яндекс добавил к файлу колонки «да/нет» по складам.",
    "Скачайте получившийся файл со столбцами складов и загрузите его в наш блок проверки допустимости.",
    "1 шт. в проверочном файле служит только для проверки допуска, а не для фактической отгрузки.",
    "Результат проверки временный; перед реальной поставкой обновляйте проверочную матрицу."
  ].forEach((x,i)=>instructions.getCell(i+1,1).value=x);
  instructions.getRow(1).font={bold:true,color:{argb:"FFB02A2A"}};
  const buffer=await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer) as BodyInit,{
    headers:{
      "Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":'attachment; filename="yandex-fby-check-all-skus.xlsx"',
      "Cache-Control":"no-store"
    }
  });
}

export async function GET(request:Request) {
  try{
    if(new URL(request.url).searchParams.get("mode")==="catalog")return await exportCatalog();
    const [snapshot,products]=await Promise.all([latestSnapshot(),activeProducts()]);
    const current=new Set(products.map(p=>normalizeOfferId(p.offer_id)));
    const matched=snapshot?products.filter(p=>snapshot.mapping[normalizeOfferId(p.offer_id)]!==undefined).length:0;
    const unknown=snapshot?products.filter(p=>snapshot.mapping[normalizeOfferId(p.offer_id)]===undefined)
      .slice(0,25).map(p=>p.offer_id):products.slice(0,25).map(p=>p.offer_id);
    return Response.json({
      ok:true,verified:Boolean(snapshot),sourceFile:snapshot?.source_file||null,
      checkedAt:snapshot?.created_at||null,stale:snapshot?eligibilityIsStale(snapshot):true,
      activeOffers:current.size,matchedOffers:matched,missingOffers:current.size-matched,
      missingSamples:unknown,headers:snapshot?.headers||[],
      extraOffers:snapshot?.unknown_offers||[],
      ready:Boolean(snapshot&&matched>0&&snapshot.headers.length>0)
    });
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:"Ошибка чтения матрицы"}, {status:500});
  }
}

export async function POST(request:Request){
  try{
    const origin=request.headers.get("origin");
    if(origin && new URL(origin).host!==new URL(request.url).host)
      return Response.json({ok:false,error:"Неверный источник загрузки"}, {status:403});
    const form=await request.formData();
    const file=form.get("file");
    if(!(file instanceof File))return Response.json({ok:false,error:"Выберите Excel-файл от Яндекс Маркета"},{status:400});
    if(!/\.xlsx$/i.test(file.name)||file.size>12*1024*1024||file.size<100)
      return Response.json({ok:false,error:"Допустим только Excel .xlsx до 12 МБ"},{status:400});
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
    let matchedHeader:ReturnType<typeof headersByRow>=null;
    let sheet:ExcelJS.Worksheet|undefined;
    for(const currentSheet of wb.worksheets){
      const h=headersByRow(currentSheet);
      if(h){sheet=currentSheet;matchedHeader=h;break;}
    }
    if(!sheet||!matchedHeader)
      return Response.json({ok:false,error:"Не найдена матрица Яндекса: нужны столбцы «Ваш SKU» и «да/нет» с названиями складов. Обычный шаблон с четырьмя полями не подойдёт."},{status:422});
    const header=matchedHeader;
    if(header.unknownColumns.length){
      return Response.json({ok:false,error:"Не удалось сопоставить склады в Excel: "+header.unknownColumns.join(", ")
        +". Расчёт заблокирован, чтобы не принять запрет за разрешение или наоборот."},{status:422});
    }
    const mapping:Record<string,Record<string,EligibilityValue>>=Object.create(null);
    const offerIds=new Set<string>();
    const products=await activeProducts();
    const knownOffers=new Set(products.map(p=>normalizeOfferId(p.offer_id)));
    const unknownOffers:string[]=[];
    let checked=0;
    for(let rowNum=header.row+1;rowNum<=Math.min(sheet.rowCount,6000);rowNum++){
      const row=sheet.getRow(rowNum);
      const offerId=normalizeOfferId(cellString(row.getCell(header.skuCol).value));
      if(!offerId||offerId.toLowerCase()==="итого")continue;
      if(offerIds.has(offerId))throw new Error("В Excel дублируется артикул "+offerId);
      offerIds.add(offerId);
      if(!knownOffers.has(offerId)){
        if(unknownOffers.length<100)unknownOffers.push(offerId);
        continue;
      }
      const statuses:Record<string,EligibilityValue>=Object.create(null);
      for(const c of header.warehouseCols){
        const raw=cellString(row.getCell(c.col).value);
        const parsed=status(raw);
        if(parsed)statuses[String(c.id)]=parsed;
        else if(raw)throw new Error('Неизвестный статус для '+offerId+' / '+c.name+': "'+raw+'"');
      }
      if(Object.keys(statuses).length===0)continue;
      mapping[offerId]=statuses;
      checked++;
    }
    if(!checked)return Response.json({ok:false,error:"В файле нет ни одной строки с подтверждёнными статусами да/нет"},{status:422});
    const {url,key}=supabaseConfig();
    const response=await fetch(url+"/rest/v1/yandex_fby_eligibility_snapshots",{
      method:"POST",
      headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",Prefer:"return=representation"},
      body:JSON.stringify({
        source_file:file.name.slice(0,180),
        offers_count:checked,
        warehouse_count:header.warehouseCols.length,
        mapping,
        headers:header.warehouseCols.map(x=>({id:x.id,name:x.name})),
        unknown_offers:unknownOffers
      }),
      cache:"no-store"
    });
    if(!response.ok)throw new Error("Не удалось сохранить матрицу в Supabase: HTTP "+response.status+" "+(await response.text()).slice(0,200));
    return Response.json({ok:true,checked,activeOffers:knownOffers.size,
      missing:Math.max(0,knownOffers.size-checked),warehouses:header.warehouseCols.length,
      unknownOffers:unknownOffers.length,ready:checked>0
    });
  }catch(error){
    return Response.json({ok:false,error:error instanceof Error?error.message:"Ошибка Excel"},{status:422});
  }
}
