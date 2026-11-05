export function normalizeNewProductArticle(article: string): string {
  return article.trim().toUpperCase();
}

/**
 * Временный бизнес-идентификатор нового товара — артикул.
 * Для интерфейса удаляем только этот артикул в скобках,
 * остальные скобки и характеристики товара сохраняем.
 */
export function displayNewProductName(name: string, article: string): string {
  const id = article.trim();
  if (!id) return name.trim();
  const escaped = id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return name
    .replace(new RegExp("\\s*\\(" + escaped + "\\)", "gi"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/**
 * Краткое, но информативное название из ПОЛНОГО описания КП.
 * 1) Используются только явно присутствующие в КП характеристики.
 * 2) Количество товаров не путается с количеством лезвий/кассет.
 * 3) Размеры добавляются в конце, чтобы варианты одного артикула
 *    не становились неразличимыми.
 * 4) Оригинал поставщика и пользовательские override.name не изменяются.
 */
export function informativeNewProductName(description:string,article:string):string{
 const lines=String(description||"").replace(/\r/g,"").split(/\n|;/)
  .map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
 if(!lines.length)return "";
 const base=displayNewProductName(lines[0],article).replace(/[;,]+$/,"").trim();
 const features:string[]=[],dimensions:string[]=[];
 for(const part of lines.slice(1,12)){
  if(/^(?:артикул|sku|item\s*no|цена|fob|exw|moq|тн\s*вэд)\b/i.test(part))continue;
  let value=part
   .replace(/(\d+)\s*штук(?=\s|[.,;:()\-]|$)/giu,"$1 шт.")
   .replace(/(\d+)\s*зип[\s-]*лок(?=\s|[.,;:()\-]|$)/giu,"$1 зип-лок")
   .replace(/\s*\*\s*/g,"×")
   .replace(/\s{2,}/g," ")
   .replace(/[\s;,]+$/,"")
   .trim();
  value=value.replace(/^упаковка\s*:?\s*(\d+)\s*шт\.(?=\s|$)/i,"$1 шт. в упаковке")
   .replace(/^размеры?\s*:?\s*/i,"размер ");
  if(/^[^,]{0,15}шт\.\s+в\s+упаковке\.$/i.test(value))value=value.slice(0,-1);
  if(!value||base.toLocaleLowerCase("ru-RU").includes(value.toLocaleLowerCase("ru-RU")))continue;
  const dest=/^размер\s/i.test(value)?dimensions:features;
  if(dest.some(x=>x.toLocaleLowerCase("ru-RU")===value.toLocaleLowerCase("ru-RU")))continue;
  dest.push(value);
 }
 const parts=[base];
 for(const feature of [...features,...dimensions]){
  if(parts.join(", ").length+feature.length+2>285)break;
  parts.push(feature);
 }
 return displayNewProductName(parts.join(", "),article).trim();
}
