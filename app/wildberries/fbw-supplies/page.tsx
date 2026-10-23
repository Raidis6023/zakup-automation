import Link from "next/link";
import FbwLocationPicker from "./FbwLocationPicker";
export const dynamic = "force-dynamic";
export default function Page(){return <main style={{minHeight:"100vh",background:"#f1f2f5",padding:"16px"}}><nav style={{maxWidth:950,margin:"auto"}}><Link href="/wildberries">← Wildberries</Link></nav><FbwLocationPicker/></main>;}
