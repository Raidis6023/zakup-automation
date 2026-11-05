/** Stable per-row identity when a supplier reuses the same model/article. */
export type OfferArticleRow={id:string;supplier_article:string;offer_id?:string|null;
 source_sheet?:string|null;source_row?:number|null};
const key=(v:string)=>v.trim().toLocaleUpperCase("ru-RU");
export function offerArticleAliases<T extends OfferArticleRow>(rows:readonly T[]):Map<string,string>{
 const groups=new Map<string,T[]>();
 for(const row of rows){
  const id=String(row.offer_id??"");
  const group=groups.get(id)||[];group.push(row);groups.set(id,group);
 }
 const aliases=new Map<string,string>();
 for(const group of groups.values()){
  const ordered=[...group].sort((a,b)=>String(a.source_sheet??"").localeCompare(String(b.source_sheet??""),"ru")||
   Number(a.source_row??0)-Number(b.source_row??0)||a.id.localeCompare(b.id));
  const counts=new Map<string,number>(),bases=new Map<string,string>(),reserved=new Set<string>();
  for(const row of ordered){
   const article=row.supplier_article.trim(),id=key(article);
   counts.set(id,(counts.get(id)||0)+1);
   if(!bases.has(id))bases.set(id,article);
   reserved.add(id);
  }
  const counters=new Map<string,number>(),used=new Set<string>();
  for(const row of ordered){
   const raw=row.supplier_article.trim(),id=key(raw);
   if((counts.get(id)||0)<2){
    aliases.set(row.id,raw);used.add(id);continue;
   }
   const base=bases.get(id)!;
   let n=counters.get(id)||1,article=base+"_"+n;
   while(reserved.has(key(article))||used.has(key(article))){n++;article=base+"_"+n;}
   counters.set(id,n+1);used.add(key(article));aliases.set(row.id,article);
  }
 }
 return aliases;
}
export function withUniqueOfferArticles<T extends OfferArticleRow>(rows:readonly T[]):T[]{
 const aliases=offerArticleAliases(rows);
 return rows.map(row=>({...row,supplier_article:aliases.get(row.id)??row.supplier_article}));
}
