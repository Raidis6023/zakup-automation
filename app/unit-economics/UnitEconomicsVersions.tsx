"use client";
import {useState} from "react";
import UnitEconomicsClient from "./UnitEconomicsClient";
import UnitEconomicsPilotClient from "./UnitEconomicsPilotClient";
export default function UnitEconomicsVersions(){
 const [version,setVersion]=useState<"classic"|"pilot">("classic");
 return <div className="unit-version-root">
  <div className="unit-version-controls" role="group" aria-label="Версия юнит-экономики">
   <span>Версия:</span>
   <button type="button" className={version==="classic"?"active":""} aria-pressed={version==="classic"} onClick={()=>setVersion("classic")}>Текущая</button>
   <button type="button" className={version==="pilot"?"active":""} aria-pressed={version==="pilot"} onClick={()=>setVersion("pilot")}>Новая · пилот</button>
  </div>
  {version==="classic"?<UnitEconomicsClient/>:<UnitEconomicsPilotClient/>}
 </div>;
}
