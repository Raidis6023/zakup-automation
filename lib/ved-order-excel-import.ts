import ExcelJS from "exceljs";
import sharp from "sharp";

export const IMPORT_MAX_BYTES = 30 * 1024 * 1024;
export const IMPORT_MAX_SHEETS = 100;
export const IMPORT_BUCKET = "ved-commercial-offers";
export const IMPORT_PHOTOS_BUCKET = "ved-product-photos";

export type VedExcelRow = {
  sheet: string;
  name: string;
  our_article: string;
  chinese_article: string;
  cartons: string;
  units_per_carton: string;
  unit_price_cny: string;
  moq_quantity: string;
  carton_length_cm: string;
  carton_width_cm: string;
  carton_height_cm: string;
  carton_volume_m3: string;
  carton_weight_kg: string;
  individual_length_cm: string;
  individual_width_cm: string;
  individual_height_cm: string;
  hs_code: string;
  has_photo: boolean;
  photo_preview: string | null;
  warnings: string[];
};

export type EmbeddedPhoto = { buffer: Buffer; extension: string };
export type ParsedVedExcel = {
  rows: VedExcelRow[];
  photos: Map<string, EmbeddedPhoto>;
  skipped: Array<{ sheet: string; reason: string }>;
};

type ReadableCell = ExcelJS.CellValue;

function display(value: ReadableCell): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (typeof value === "boolean") return "";
  if (value instanceof Date) return "";
  if (typeof value === "object") {
    if ("result" in value) return display(value.result as ReadableCell);
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map(part => part.text || "").join("").trim();
    }
  }
  return "";
}

function text(cell: ExcelJS.Cell): string {
  // ExcelJS resolves merged cells through their master automatically. The
  // E16:F16 MOQ *label* is therefore NOT mistaken for an amount.
  return display(cell.value);
}

function quantity(cell: ExcelJS.Cell): string {
  const raw = text(cell).replace(/\s/g,"").replace(",",".");
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return "";
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

function integer(cell: ExcelJS.Cell): string {
  const raw = quantity(cell);
  return raw && Number.isSafeInteger(Number(raw)) ? raw : "";
}

function sourceImage(image: ExcelJS.Image): EmbeddedPhoto | null {
  const ext = String(image.extension || "").toLowerCase();
  if (!["jpeg","jpg","png","webp","gif"].includes(ext)) return null;
  const raw=image as ExcelJS.Image & {base64?:string};
  const buffer = image.buffer
    ? Buffer.from(image.buffer)
    : raw.base64
      ? Buffer.from(raw.base64.replace(/^data:[^,]+,/,""),"base64")
      : null;
  return buffer && buffer.byteLength>0
    ? { buffer, extension: ext } : null;
}

function findProductPhoto(book: ExcelJS.Workbook,sheet: ExcelJS.Worksheet): EmbeddedPhoto | null {
  // Only the product image area J3:Q19 (merged or unmerged).
  // Ignore G11:I19: it contains packaging photographs.
  for(const drawing of sheet.getImages()) {
    const tl = drawing.range?.tl;
    if (!tl) continue;
    const col = Number(tl.nativeCol ?? Math.floor(tl.col));
    const row = Number(tl.nativeRow ?? Math.floor(tl.row));
    if (!Number.isFinite(col) || !Number.isFinite(row)) continue;
    if (col < 9 || col > 16 || row < 2 || row > 18) continue;
    const media = book.getImage(Number(drawing.imageId));
    if (!media) continue;
    const image = sourceImage(media);
    if (image) return image;
  }
  return null;
}

async function photoThumbnail(photo: EmbeddedPhoto): Promise<string | null> {
  try {
    const output = await sharp(photo.buffer,{failOn:"none",limitInputPixels:18_000_000})
      .rotate().resize(100,100,{fit:"contain",withoutEnlargement:true})
      .webp({quality:62}).toBuffer();
    return "data:image/webp;base64,"+output.toString("base64");
  } catch {
    return null;
  }
}

export async function convertProductPhoto(photo: EmbeddedPhoto):Promise<Buffer> {
  const image=await sharp(photo.buffer,{failOn:"none",limitInputPixels:18_000_000})
    .rotate().resize(1200,1200,{fit:"inside",withoutEnlargement:true})
    .webp({quality:78,effort:4}).toBuffer();
  if(image.byteLength>2_097_152) throw new Error("Фотография после обработки превышает 2 МБ");
  return image;
}

export async function parseVedExcel(bytes:Buffer,includeThumbnails=false):Promise<ParsedVedExcel>{
  if(!bytes.byteLength || bytes.byteLength>IMPORT_MAX_BYTES) {
    throw new Error("Допускается Excel-файл объёмом до 30 МБ");
  }
  if(bytes[0]!==0x50 || bytes[1]!==0x4b){
    throw new Error("Неверный формат Excel: нужен .xlsx");
  }
  const workbook=new ExcelJS.Workbook();
  try { await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]); }
  catch { throw new Error("Не удалось открыть Excel. Используйте корректный файл .xlsx"); }
  if(workbook.worksheets.length>IMPORT_MAX_SHEETS){
    throw new Error("В Excel больше 100 листов. Разделите книгу на несколько файлов");
  }

  const rows:VedExcelRow[]=[];
  const skipped:Array<{sheet:string;reason:string}>=[];
  const photos=new Map<string,EmbeddedPhoto>();
  for(const sheet of workbook.worksheets) {
    const name=text(sheet.getCell("B22")) || text(sheet.getCell("B23"));
    // The recognizable 40HQ/MOQ layout distinguishes a calculation sheet
    // from an instructions or totals tab.
    const isCalculation =
      /40\s*HQ/i.test(text(sheet.getCell("A1"))) ||
      /40\s*HQ/i.test(text(sheet.getCell("C22"))) ||
      text(sheet.getCell("E4")).toLowerCase().includes("цена");
    if (!isCalculation || !name || name.length<2) {
      skipped.push({sheet:sheet.name,reason:!isCalculation?
        "Не распознан лист расчёта ВЭД":"Не заполнено название товара (B22)"});
      continue;
    }
    const warnings:string[]=[];
    const price15=quantity(sheet.getCell("F15"));
    const price4=/цена/i.test(text(sheet.getCell("E4")))
      ?quantity(sheet.getCell("F4")):"";
    const unitPrice=price15||price4;
    if(!unitPrice)warnings.push("Нет закупочной цены CNY");
    const pieces=integer(sheet.getCell("D22"));
    if(!pieces)warnings.push("Нет количества штук в коробке (D22)");
    const mass=quantity(sheet.getCell("E22"));
    if(!mass)warnings.push("Нет веса короба (E22)");
    const l=quantity(sheet.getCell("G5"));
    const w=quantity(sheet.getCell("H5"));
    const h=quantity(sheet.getCell("I5"));
    const volume= l&&w&&h
      ?String(Number((Number(l)*Number(w)*Number(h)/1e6).toFixed(6)))
      :quantity(sheet.getCell("F19"));
    if(!volume)warnings.push("Нет объёма короба");
    // E16:F16 is a merged label "MOQ" in older files.
    const moq=integer(sheet.getCell("E16"));
    if(!moq)warnings.push("MOQ не указан числом");
    const photo=findProductPhoto(workbook,sheet);
    if(photo)photos.set(sheet.name,photo);
    else warnings.push("Не найдено основное фото в J3:Q19");
    const hs=text(sheet.getCell("A22")).replace(/[^0-9]/g,"").slice(0,14);
    rows.push({
      sheet:sheet.name,
      name:name.slice(0,250),
      our_article:"",
      chinese_article:sheet.name.slice(0,120),
      cartons:"0",
      units_per_carton:pieces,
      unit_price_cny:unitPrice,
      moq_quantity:moq,
      carton_length_cm:l,carton_width_cm:w,carton_height_cm:h,
      carton_volume_m3:volume,
      carton_weight_kg:mass,
      individual_length_cm:quantity(sheet.getCell("G7")),
      individual_width_cm:quantity(sheet.getCell("H7")),
      individual_height_cm:quantity(sheet.getCell("I7")),
      hs_code:hs,
      has_photo:Boolean(photo),
      photo_preview:photo && includeThumbnails ? await photoThumbnail(photo):null,
      warnings
    });
  }
  if(rows.length<1)throw new Error("В книге не найдено ни одного заполненного товарного листа ВЭД");
  return {rows,photos,skipped};
}
