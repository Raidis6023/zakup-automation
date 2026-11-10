import {NextRequest} from 'next/server';
import {GET as advance} from '../yandex-finance-campaigns-cron/route';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
// Independent daily recovery slot. The source route validates CRON_SECRET.
export async function GET(request:NextRequest){
 const url=new URL(request.url);
 url.searchParams.set('priority','oldest');
 return advance(new NextRequest(url,{headers:request.headers}));
}
