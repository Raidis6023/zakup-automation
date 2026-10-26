import Link from "next/link";
import FbwSupplyWizard from "./FbwSupplyWizard";
export const dynamic="force-dynamic";
export default function Page(){
  return <main style={{minHeight:"100vh",background:"#130f19"}}>
    <nav style={{padding:"20px 30px",borderBottom:"1px solid #38264a"}}>
      <Link href="/wildberries" style={{color:"#c69bed",fontSize:14}}>← Вернуться в Wildberries</Link>
    </nav>
    <FbwSupplyWizard/>
  </main>;
}
