import {NextRequest} from 'next/server';
import {GET as advance} from '../yandex-finance-cron/route';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
// Independent daily recovery slot. The source route validates CRON_SECRET.
export async function GET(request:NextRequest){return advance(request);}
