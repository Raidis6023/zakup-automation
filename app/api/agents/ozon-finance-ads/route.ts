import { NextRequest,NextResponse } from "next/server";
import { runHistoricalAdvertising } from "./worker";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;
/** Cron-only, serialized Ozon Performance historical advertising sync. */
export async function GET(request:NextRequest) {
 const started=Date.now();let processed=0;
 for(let i=0;i<15;i++){
  const response=await runHistoricalAdvertising(request);
  const result=await response.json();
  if(result.phase==='report_saved')processed+=Number(result.batch_size??1);
  if(result.phase!=='report_saved'||Date.now()-started>180000||i===14)
   return NextResponse.json({...result,reports_processed:processed},{status:response.status,headers:{'Cache-Control':'no-store'}});
 }
 return NextResponse.json({ok:true,reports_processed:processed});
}
