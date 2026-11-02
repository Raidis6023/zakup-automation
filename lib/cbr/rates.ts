/** Server-side official CBR daily XML rates, RUB per ONE currency unit. No business markup. */
export const CBR_CURRENCIES=["USD","EUR","CNY"] as const;
export type CbrCurrency=(typeof CBR_CURRENCIES)[number];
export type CbrRate={
 official:number;previous:number|null;effectiveDate:string;previousDate:string|null;
 trend:"up"|"down"|"flat"|"unknown";
};
export type CbrRates={asOf:string;source:string;rates:Record<CbrCurrency,CbrRate>};
type Doc={effectiveDate:string;rates:Record<CbrCurrency,number>};
const SOURCE="https://www.cbr.ru/scripts/XML_daily.asp";
export const moscowToday=()=>new Date().toLocaleDateString("sv-SE",{timeZone:"Europe/Moscow"});
function before(date:string,n:number){const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);}
function num(s:string){const n=Number(s.trim().replace(/\s/g,"").replace(",","."));if(!Number.isFinite(n))throw Error("Некорректный курс ЦБ");return n;}
export function parseCbrXml(xml:string):Doc{
 const m=xml.match(/<ValCurs\b[^>]*\bDate=["'](\d{2})\.(\d{2})\.(\d{4})["']/i);
 if(!m)throw Error("Ответ Банка России без даты");
 const effectiveDate=m[3]+"-"+m[2]+"-"+m[1];
 const rates={} as Record<CbrCurrency,number>;
 for(const part of xml.match(/<Valute\b[^>]*>[\s\S]*?<\/Valute>/gi)||[]){
  const code=part.match(/<CharCode>\s*([A-Z]{3})\s*<\/CharCode>/i)?.[1]?.toUpperCase();
  if(!code||!CBR_CURRENCIES.some(c=>c===code))continue;
  const nominal=part.match(/<Nominal>\s*([\d\s]+)\s*<\/Nominal>/i)?.[1];
  const value=part.match(/<Value>\s*([\d\s,.]+)\s*<\/Value>/i)?.[1];
  if(!nominal||!value)throw Error("В ответе ЦБ не указан номинал "+code);
  const v=num(value)/num(nominal);
  if(!(v>0))throw Error("Некорректное значение "+code);
  rates[code as CbrCurrency]=v;
 }
 if(CBR_CURRENCIES.some(code=>!rates[code]))throw Error("ЦБ не вернул USD, EUR или CNY");
 return {effectiveDate,rates};
}
async function load(date:string):Promise<Doc>{
 const [y,m,d]=date.split("-");
 const url=SOURCE+"?date_req="+encodeURIComponent(d+"/"+m+"/"+y);
 const res=await fetch(url,{next:{revalidate:3600},signal:AbortSignal.timeout(10000),headers:{Accept:"application/xml, text/xml, */*"}});
 if(!res.ok)throw Error("ЦБ РФ: HTTP "+res.status);
 return parseCbrXml(new TextDecoder("windows-1251").decode(await res.arrayBuffer()));
}
export async function getCbrRates(asOf:string=moscowToday()):Promise<CbrRates>{
 const current=await load(asOf);
 let prev:Doc|null=null;
 for(let n=1;n<=8;n++){
  try{const p=await load(before(current.effectiveDate,n));if(p.effectiveDate<current.effectiveDate){prev=p;break;}}
  catch{break;}
 }
 const rates={} as Record<CbrCurrency,CbrRate>;
 for(const code of CBR_CURRENCIES){
  const official=current.rates[code],previous=prev?.rates[code]??null;
  rates[code]={
   official,previous,effectiveDate:current.effectiveDate,previousDate:prev?.effectiveDate??null,
   trend:previous===null?"unknown":official>previous+1e-8?"up":official<previous-1e-8?"down":"flat",
  };
 }
 return {asOf,source:SOURCE,rates};
}
