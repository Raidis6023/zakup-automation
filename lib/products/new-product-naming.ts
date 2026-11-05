import {displayNewProductName} from "./new-product-identity";

/** Generated names and characteristics are derived only from supplier text.
 * Original source remains in ved_commercial_offer_items.description_original.
 * Manual overrides are stored separately in unit_ved_products.overrides.
 */
export type NewProductNaming={
 shortName:string;
 fullName:string;
 attributes:Record<string,string>;
};
const clean=(s:string)=>s.replace(/\s+/g," ").trim();
const dimensions=(s:string)=>clean(s.replace(/\s*[xх*×]\s*/gi,"×"));
const amount=(s:string)=>s.replace(".",",");
function extractDimensions(text:string):string|null{
 const m=text.match(/(?:^|\n)\s*(?:размер(?:ы)?(?:\s+изделия)?|габариты(?:\s+изделия)?)\s*:\s*((?:\d+(?:[.,]\d+)?\s*[*xх×]\s*){1,2}\d+(?:[.,]\d+)?)\s*(мм|см)/i);
 return m?dimensions(m[1])+" "+m[2].toLowerCase():null;
}
const first=(s:string,pattern:RegExp)=>s.match(pattern)?.[1]||null;
function attrList(lines:readonly string[]):Record<string,string>{
 const attrs:Record<string,string>={};
 let unnamed=1;
 for(const line of lines.slice(1)){
  // Splits compound labels without touching decimal commas (1,5).
  const sections=line.split(/,\s+(?=[\p{L}][\p{L}\s]{1,40}:)/u);
  for(const section of sections){
   const colon=section.indexOf(":");
   if(colon>0&&colon<55){
    const key=clean(section.slice(0,colon));
    const value=clean(section.slice(colon+1)).replace(/\/$/,"").trim();
    if(key&&value){
     // Preserve duplicate labels without silently overwriting source values.
     let k=key,n=2;
     while(Object.prototype.hasOwnProperty.call(attrs,k)){k=key+" "+n++; }
     attrs[k]=value;
     continue;
    }
   }
   if(clean(section))attrs["Дополнительная характеристика "+unnamed++]=clean(section);
  }
 }
 return attrs;
}
function fallbackShort(base:string,lines:string[]):string{
 const ranked=lines.slice(1).map((value,index)=>({
  value,index,weight:
   /\bмодель\s*:|^артикул\s*:/i.test(value)?0:
   /кассет|лезви|количеств|комплект|упаковк|объем|объём|материал|вместимост|мощност|скорост/i.test(value)?1:
   /размер\s+изделия|^размер\s*:|габарит|длин[аы]|диаметр/i.test(value)?2:
   /вес|подсвет|светодиод/i.test(value)?3:5
 })).sort((a,b)=>a.weight-b.weight||a.index-b.index);
 const parts=[base];
 for(const {value} of ranked){
  const candidate=clean(value.replace(/^(размер(?:ы)?(?:\s+изделия)?)\s*:/i,"размер"));
  if(parts.join(", ").length+candidate.length+2>290)continue;
  if(!parts.some(p=>p.toLowerCase()===candidate.toLowerCase()))parts.push(candidate);
  if(parts.length>=5)break;
 }
 return parts.join(", ");
}
export function buildNewProductNaming(description:string,article:string):NewProductNaming{
 const lines=String(description||"").replace(/\r/g,"").split(/\n|;/)
  .map(s=>clean(s).replace(/\s*[*×]\s*/g,"×").replace(/\/$/,"").trim())
  .filter(Boolean);
 if(!lines.length)return{shortName:"",fullName:"",attributes:{}};
 const base=displayNewProductName(lines[0],article).replace(/\s+,/g,",").trim();
 const full=lines.join("; ");
 const attrs=attrList(lines);
 const dims=extractDimensions(String(description||""));
 const all=lines.join("\n");
 let name="";
 const add=(...values:(string|null|undefined)[])=>values.filter(Boolean).join(", ");
 if(/рулетк[аи-]?[- ]?поводок|поводок[- ]?рулетк/i.test(base)){
  const len=first(all,/длина\s+троса\s*:\s*(\d+(?:[.,]\d+)?)\s*м/i);
  name=add("Рулетка-поводок"+(/автоматич/i.test(base)?" автоматическая":"")+" для животных",len?amount(len)+" м":null,dims);
 }else if(/кормушк/i.test(base)&&/поилк/i.test(base)){
  const food=first(all,/для\s+корма\s*(\d+(?:[.,]\d+)?)\s*л/i);
  const water=first(all,/для\s+воды\s*(\d+(?:[.,]\d+)?)\s*л/i);
  name=add("Кормушка-поилка"+(/2\s*в\s*1/i.test(base)?" 2 в 1":"")+" для животных",food?"корм "+amount(food)+" л":null,
   water?"вода "+amount(water)+" л":null);
 }else if(/миск/i.test(base)){
  const ceramic=/керамич/i.test(base)?"керамическая":null;
  const size=first(base,/\(([SMLX]{1,4})\)/i);
  name=add("Миска"+(ceramic?" "+ceramic:"")+" для животных",
   size?"размер "+size.toUpperCase():null,dims);
 }else if(/подставк/i.test(base)&&/ноутбук/i.test(base)&&/охлажден|охлаждающ/i.test(base)){
  const model=first(all,/модель\s*:\s*([a-zа-я0-9-]+)/i);
  const count=first(all,/количество\s+вентиляторов\s*:\s*(\d+)\s*шт/i);
  const fan=all.match(/размер\s+вентилятор(?:ов|а)\s*:\s*(\d+(?:[.,]\d+)?)(?:\s*[×*хx]\s*\d+(?:[.,]\d+)?){0,2}\s*(см|мм)/i);
  const fanSize=fan?Math.round(Number(fan[1].replace(",","."))*(fan[2].toLowerCase()==="см"?10:1)):null;
  const speed=first(all,/скорость\s+вращения\s*:\s*(\d+(?:[.,]\d+)?)/i);
  const led=/\bLED\b|светодиод/i.test(all);
  const prefix="Подставка охлаждающая для ноутбука"+(model?" "+model.toUpperCase():"");
  name=add(prefix,count?count+" вентилятора"+(count==="5"?"ов":""):null);
  // Decline "2 вентилятора", "5 вентиляторов", etc.
  if(count){
   const n=Number(count);
   const noun=n%10===1&&n%100!==11?"вентилятор":
    n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?"вентилятора":"вентиляторов";
   name=prefix+", "+n+" "+noun+(fanSize?" "+fanSize+" мм":"");
  }else if(fanSize)name=add(prefix,fanSize+" мм");
  name=add(name,speed?amount(speed)+" об/мин":null,led&&!model?"LED":null,dims);
 }else if(/бритв|брить/i.test(base)){
  const cartridges=first(all,/(\d+)\s*сменн\w*\s+кассет/i);
  const blades=first(all,/(\d+)\s*лезви(?:я|й|е)/i);
  const qty=first(all,/(?:упаковка)\s*(\d+)\s*шт/i);
  name=add(base,cartridges?
   (/ручка/i.test(all)?"ручка + ":"")+cartridges+" сменные кассеты":qty?qty+" шт. в упаковке":null,
   blades?blades+" лезвий":null,dims);
 }else if(/ватн.*палочк/i.test(base)){
  const qty=first(all,/(\d+)\s*(?:штук|шт\.)/i);
  const zip=all.match(/(\d+)\s*зип[\s-]*лок\s+по\s+(\d+)\s*(?:штук|шт\.)/i);
  name=add(base,qty?qty+" шт.":null,
   zip?zip[1]+" зип-лок по "+zip[2]+" шт.":null);
 }else{
  name=fallbackShort(base,lines);
 }
 // Keep short name compact; never truncate an individual property mid-word.
 const segments=name.split(", "),parts:string[]=[];
 for(const segment of segments){
  if(parts.join(", ").length+segment.length+(parts.length?2:0)>300)break;
  parts.push(segment);
 }
 return{shortName:displayNewProductName(parts.join(", ")||base,article),
  fullName:displayNewProductName(full,article),attributes:attrs};
}
