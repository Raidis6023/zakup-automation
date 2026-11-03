import catalogue from "@/data/wb-commission-categories.json";
export type WbCategory=typeof catalogue.records[number];
const clean=(s:string)=>s.toLocaleLowerCase("ru-RU").replace(/ё/g,"е").trim();
export function findWbCategory(name:string,group?:string|null):WbCategory|null{
 const candidates=catalogue.records.filter(r=>clean(r.name)===clean(name));
 if(!candidates.length)return null;
 if(group)return candidates.find(r=>clean(r.group)===clean(group))||null;
 // Do not silently resolve duplicate subject names belonging to different groups.
 return candidates.length===1?candidates[0]:null;
}
export function searchWbCategory(q:string,max=35){
 const norm=clean(q);
 if(norm.length<2)return {items:[],total:0};
 const rows=catalogue.records.filter(r=>clean(r.name).includes(norm)||clean(r.group).includes(norm));
 rows.sort((a,b)=>{
  const rank=(n:string)=>clean(n)===norm?0:clean(n).startsWith(norm)?1:2;
  return rank(a.name)-rank(b.name)||a.name.localeCompare(b.name,"ru");
 });
 return{items:rows.slice(0,max),total:rows.length};
}
export const WB_COMMISSION_REFERENCE_DATE=catalogue.updatedAt;
