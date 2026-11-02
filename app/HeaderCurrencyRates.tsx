"use client";
import {useEffect,useState} from "react";
import styles from "./HeaderCurrencyRates.module.css";
type Currency="USD"|"EUR"|"CNY";
type Rate={official:number;previous:number|null;effectiveDate:string;previousDate:string|null;trend:"up"|"down"|"flat"|"unknown"};
type Reply={ok:boolean;rates?:Record<Currency,Rate>;error?:string};
const fmt=(n:number,d:number)=>new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:d}).format(n);
export default function HeaderCurrencyRates(){
 const [reply,setReply]=useState<Reply|null>(null);
 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const response=await fetch("/api/cbr-rates",{cache:"no-store"});
    const data=await response.json() as Reply;
    if(!response.ok||!data.ok||!data.rates)throw Error(data.error||"Курсы не получены");
    if(active)setReply(data);
   }catch{if(active)setReply({ok:false,error:"Курсы ЦБ временно недоступны"});}
  };
  void load();const id=window.setInterval(()=>void load(),3600000);
  return ()=>{active=false;window.clearInterval(id);};
 },[]);
 return <div className={styles.rates} aria-label="Курсы Банка России без надбавок">
  {(["USD","EUR","CNY"] as const).map(code=>{
   const r=reply?.rates?.[code];
   const arrow=r?.trend==="up"?"↑":r?.trend==="down"?"↓":r?.trend==="flat"?"→":"";
   const tooltip=r?code+": ЦБ "+fmt(r.official,6)+" ₽ с "+r.effectiveDate+
    (r.previous!==null?"; ранее "+fmt(r.previous,6)+" ₽ с "+r.previousDate:"")+
    ". Без надбавок":reply?.error||"Загрузка курса ЦБ";
   return <span key={code} className={styles.item} title={tooltip}>
    <span className={styles.code}>{code}</span>
    <span className={styles.value}>{r?fmt(r.official,2):"—"}</span>
    {arrow&&<span className={r?.trend==="up"?styles.up:r?.trend==="down"?styles.down:styles.flat}
      aria-label={r?.trend==="up"?"Курс вырос":r?.trend==="down"?"Курс снизился":"Без изменений"}>{arrow}</span>}
   </span>;
  })}
 </div>;
}
