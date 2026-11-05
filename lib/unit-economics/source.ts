import { createSign } from "node:crypto";
import unitSnapshot from "@/data/unit-economics-snapshot.json";
import rateSnapshot from "@/data/unit-economics-rates.json";

import {MODEL_KEYS, MODELS, WORKBOOK_ID, type ModelKey, type SheetData} from "./model-config";
export {MODEL_KEYS,MODELS,WORKBOOK_ID,WORKBOOK_URL,MARKET_NAMES} from "./model-config";
export type {ModelKey,Marketplace,SheetData,SheetRow} from "./model-config";
const snapshot = unitSnapshot as unknown as {asOf:string;models:Record<ModelKey,SheetData>};
export const tariffSnapshot=rateSnapshot as unknown as {asOf:string;partial:boolean;tables:Record<string,{name:string;rows:(string|null)[][]}>};
const GOOGLE_SCOPE="https://www.googleapis.com/auth/spreadsheets";
function b64url(v:string){return Buffer.from(v,"utf8").toString("base64url");}
async function getGoogleToken(){
 const email=process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
 const key=process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g,"\n");
 if(!email||!key)return null;
 const now=Math.floor(Date.now()/1000);
 const header=b64url(JSON.stringify({alg:"RS256",typ:"JWT"}));
 const body=b64url(JSON.stringify({iss:email,scope:GOOGLE_SCOPE,aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3000}));
 const data=header+"."+body;const signer=createSign("RSA-SHA256");signer.update(data);signer.end();
 const assertion=data+"."+signer.sign(key).toString("base64url");
 const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion}),cache:"no-store"});
 if(!response.ok)throw new Error("Google OAuth: "+response.status);
 const json=await response.json() as {access_token:string};return json.access_token;
}
export function googleEnabled(){return Boolean(process.env.GOOGLE_SHEETS_CLIENT_EMAIL&&process.env.GOOGLE_SHEETS_PRIVATE_KEY);}
async function getSheetValues(tab:string,a1:string):Promise<string[][] | null>{
 const token=await getGoogleToken();if(!token)return null;
 const range="'"+tab.replaceAll("'","''")+"'!"+a1;
 const url="https://sheets.googleapis.com/v4/spreadsheets/"+WORKBOOK_ID+"/values/"+encodeURIComponent(range)+"?valueRenderOption=FORMATTED_VALUE";
 const response=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store"});
 if(!response.ok)throw new Error("Google Sheets: "+response.status);
 const data=await response.json() as {values?:(string|number|null)[][]};
 return (data.values??[]).map(row=>row.map(v=>v==null?"":String(v)));
}
export async function getModelData(key:ModelKey):Promise<{data:SheetData;live:boolean;asOf:string;partial:boolean;warning?:string}>{
 const def=MODELS[key];let warning:string|undefined;
 if(googleEnabled()){
  try{
   const all=await getSheetValues(def.tab,"A2:"+def.last+def.end);
   if(all){
    return {data:{tab:def.tab,constants:all[0]??[],headers:all[1]??[],rows:all.slice(2).map((v,i)=>({r:i+4,v})).filter(row=>row.v.some(Boolean)),endRow:def.end},live:true,asOf:new Date().toISOString(),partial:false};
   }
  }catch(error){warning=error instanceof Error?error.message:"Ошибка чтения Google Sheets";}
 }
 return {data:snapshot.models[key],live:false,asOf:snapshot.asOf,partial:true,warning};
}
export async function getTariffData(key:string){
 const fallback=tariffSnapshot.tables[key];if(!fallback)return null;
 if(googleEnabled()){
  try{
   const max=key.startsWith("ozon-")&&!key.endsWith("logistics")?9310:key==="wb"?7621:key.startsWith("ym-")&&!key.endsWith("logistics")?13430:1000;
   const col=key==="wb"?"E":key.startsWith("ym-")&&!key.endsWith("logistics")?"K":key.endsWith("logistics")?"L":"F";
   const values=await getSheetValues(fallback.name,"A1:"+col+max);
   if(values)return {data:{name:fallback.name,rows:values},live:true,asOf:new Date().toISOString(),partial:false};
  }catch{/* Use the labeled snapshot when live Google is unavailable. */}
 }
 return {data:fallback,live:false,asOf:tariffSnapshot.asOf,partial:true};
}
/** Категория/предмет и коэффициенты FBO из листа «Ozon Возмещение». */
export async function getOzonCompensationData():Promise<string[][]|null>{
 if(!googleEnabled())return null;
 try{return await getSheetValues("Ozon Возмещение","A1:H9310")}
 catch{return null}
}
export async function writeConstant(key:ModelKey,cell:string,value:number){
 if(!googleEnabled())throw new Error("Прямое подключение Google Sheets ещё не настроено");
 if(!/^[A-Z]{1,2}2$/.test(cell)||!Number.isFinite(value)||Math.abs(value)>1000000)throw new Error("Недопустимое значение");
 const def=MODELS[key];const ref=cell.match(/^[A-Z]+/)?.[0]??"";
 const index=ref.split("").reduce((a,x)=>a*26+x.charCodeAt(0)-64,0)-1;
 const saved=snapshot.models[key].constants[index];
 if(!saved||!/[\d%₽]|р\./.test(saved))throw new Error("Недоступная для изменения константа");
 const token=await getGoogleToken();if(!token)throw new Error("Нет подключения");
 const range="'"+def.tab+"'!"+cell;
 const url="https://sheets.googleapis.com/v4/spreadsheets/"+WORKBOOK_ID+"/values/"+encodeURIComponent(range)+"?valueInputOption=USER_ENTERED";
 const result=await fetch(url,{method:"PUT",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({range,majorDimension:"ROWS",values:[[value]]}),cache:"no-store"});
 if(!result.ok)throw new Error("Ошибка записи: "+result.status);
 return true;
}
