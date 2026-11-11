'use client';
import {useState} from 'react';
import { FINANCE_TARIFF_EFFECTIVE_FROM } from '@/lib/finance-tariff-date';
export default function OzonMissingRateEditor({master,offer,missing,onSaved}:{master:string|null;offer:string;missing:string[];day:string;onSaved:()=>Promise<void>}){
 const [cost,setCost]=useState(''),[mayak,setMayak]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const needCost=missing.some(x=>/себестоим|цена закуп/i.test(x)),needMayak=missing.some(x=>/тк маяк/i.test(x));
 if(!needCost&&!needMayak)return <span>Заполните КМ или ЕНОТ в справочнике</span>;
 if(!master)return <span>Сначала привяжите ЕНОТ в списке артикулов</span>;
 async function save(){
  setBusy(true);setMessage('');
  try{
   const body:Record<string,unknown>={action:'saveProduct',master_code:master,valid_from:FINANCE_TARIFF_EFFECTIVE_FROM};
   if(needCost){if(!/^\d+(?:[.,]\d{1,2})?$/.test(cost.trim()))throw new Error('Укажите себестоимость');body.cost=Number(cost.replace(',','.'));}
   if(needMayak){if(!/^\d+(?:[.,]\d{1,2})?$/.test(mayak.trim()))throw new Error('Укажите ТК Маяк');body.mayak=Number(mayak.replace(',','.'));}
   const response=await fetch('/api/agents/ozon-finance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.error??'Не удалось сохранить');
   setMessage('Сохранено');await onSaved();
  }catch(e){setMessage(e instanceof Error?e.message:'Ошибка сохранения');}finally{setBusy(false);}
 }
 return <div className="ozf-edit" aria-label={'Недостающие тарифы '+offer}>{needCost&&<label>Себестоимость, ₽<input inputMode="decimal" value={cost} onChange={e=>setCost(e.target.value)} placeholder="0,00"/></label>}{needMayak&&<label>ТК Маяк, ₽/шт<input inputMode="decimal" value={mayak} onChange={e=>setMayak(e.target.value)} placeholder="0,00"/></label>}<button className="ozf-btn ozf-primary" disabled={busy} onClick={()=>void save()}>{busy?'Сохраняем…':'Сохранить и пересчитать'}</button>{message&&<small role="status">{message}</small>}</div>;
}
