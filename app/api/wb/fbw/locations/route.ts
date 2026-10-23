import { NextResponse } from "next/server";
import { createClient } from "../../../../../lib/supabase/server";
import { wbFbw } from "../../../../../lib/wb/fbw-api";
export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({error:"Необходим вход"}, {status:401});
  try {
    const [warehouses,transit] = await Promise.all([wbFbw.listWarehouses(),wbFbw.listTransitTariffs()]);
    return NextResponse.json({warehouses,transit,source:"Wildberries",fetchedAt:new Date().toISOString()}, {headers:{"Cache-Control":"private, no-store"}});
  } catch (error) {
    return NextResponse.json({error:error instanceof Error?error.message:"Ошибка WB"}, {status:502});
  }
}
