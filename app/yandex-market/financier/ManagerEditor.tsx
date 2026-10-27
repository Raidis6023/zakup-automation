'use client';
import {useState} from 'react';
export default function ManagerEditor({article,value,onSave}:{article:string;value:string;onSave:(article:string,value:string)=>Promise<void>}){
 const [manager,setManager]=useState(value),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(){setBusy(true);setMessage('');try{await onSave(article,manager);setMessage('КМ сохранён');}catch(e){setMessage(e instanceof Error?e.message:'Не удалось сохранить');}finally{setBusy(false);}}
 return <div className="ozf-edit"><label>КМ<input value={manager} maxLength={80} onChange={e=>setManager(e.target.value)}/></label><button className="ozf-btn" disabled={busy||!manager.trim()} onClick={()=>void save()}>{busy?'Сохраняем…':'Сохранить КМ'}</button><span role="status">{message}</span></div>;
}
