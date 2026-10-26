import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { POST as mapFinanceSkus } from "../ozon-finance-map/route";
import { GET as syncTransit } from "../ozon-finance-transit/route";
import { GET as syncCrossdock } from "../ozon-finance-crossdock/route";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=300;

export async function GET(request:NextRequest) {
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!=="Bearer "+secret)
    return NextResponse.json({ok:false,error:"Unauthorized"},{status:401});
  const db=createAdminClient();
  const localToday=new Date(Date.now()+7*3600000).toISOString().slice(0,10);
  const dateFrom=new Date(Date.parse(localToday+"T00:00:00Z")-35*86400000)
    .toISOString().slice(0,10);
  const results:Record<string,unknown>={};
  try {
    const {data,error}=await db.from("ozon_finance_sync_days")
      .select("day").eq("account_key","main")
      .gte("day",dateFrom).lt("day",localToday).order("day",{ascending:false}).limit(35);
    if(error)throw error;
    for(const d of data??[]) {
      const {data:skus,error:unmappedError}=await db.rpc("ozon_finance_unmapped_skus",{
        p_day:d.day,p_limit:1,p_account:"main"
      });
      if(unmappedError){results.mapping={ok:false,error:unmappedError.message};break;}
      if(!skus?.length)continue;
      const routeRequest=new NextRequest(new URL("/api/agents/ozon-finance-map",request.url),{
        method:"POST",headers:{Authorization:"Bearer "+secret,"Content-Type":"application/json"},
        body:JSON.stringify({day:d.day})
      });
      const response=await mapFinanceSkus(routeRequest);
      results.mapping={day:d.day,status:response.status,...await response.json()};
      break;
    }
    if(!results.mapping)results.mapping={ok:true,status:"no_missing_skus"};
    // Each provider works independently, so a temporary HTTP 429 from
    // Performance must not starve stock or crossdock updates.
    for(const [name,handler] of [
      ["transit",syncTransit],
      ["crossdock",syncCrossdock],
    ] as const) {
      try {
        const res=await handler(request);
        results[name]={http_status:res.status,...await res.json()};
      }catch(error){
        const message=error instanceof Error?error.message:"Unknown";
        results[name]={ok:false,error:message.slice(0,280)};
        console.warn("Ozon financier supporting sync:",name,message.slice(0,250));
      }
    }
    return NextResponse.json({ok:true,source:"independent_apis",
      storage:"Supabase",results},{headers:{"Cache-Control":"no-store"}});
  }catch(error) {
    const message=error instanceof Error?error.message:"Unexpected failure";
    return NextResponse.json({ok:false,error:message.slice(0,310)},{status:503});
  }
}
