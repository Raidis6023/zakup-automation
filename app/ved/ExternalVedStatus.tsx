"use client";
import {useState} from "react";
import {useRouter} from "next/navigation";
type Status="ved_in_work"|"production_confirmed"|"in_transit"|"cancelled";
const labels:Record<Status,string>={
 ved_in_work:"В работе",
 production_confirmed:"Передан в производство",
 in_transit:"В пути",
 cancelled:"Отменён",
};
export default function ExternalVedStatus({id,current,number}:{id:string;current:string;number:string}){
 const router=useRouter();
 const [value,setValue]=useState<Status>((current in labels?current:"ved_in_work") as Status);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function save(){
  setError("");
  if(value===current)return;
  setBusy(true);
  try{
   const r=await fetch("/api/ved-orders/external-status",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id,status:value}),
   });
   const data=await r.json() as {ok?:boolean;error?:string};
   if(!r.ok||!data.ok)throw Error(data.error||"Не удалось обновить статус");
   router.refresh();
  }catch(e){setError(e instanceof Error?e.message:"Ошибка обновления");}
  finally{setBusy(false);}
 }
 return <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
  <select value={value} aria-label={"Статус "+number} disabled={busy}
   onChange={e=>setValue(e.target.value as Status)}
   style={{color:"var(--text)",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:8,padding:"7px"}}>
   {Object.entries(labels).map(([key,label])=><option value={key} key={key}>{label}</option>)}
  </select>
  <button type="button" className="secondary-button" disabled={busy||value===current} onClick={save}>
   {busy?"Сохраняем...":"Сохранить"}
  </button>
  {error&&<span role="alert" style={{color:"#d37a71",fontSize:12,width:"100%"}}>{error}</span>}
 </div>;
}
