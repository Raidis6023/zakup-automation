import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
const ACCESS_HASH = '05ebcc48153e85e9f811bf293ae3a5430c6439f0628d2808fe66191e457bc041';
const EXPIRES = Date.parse('2026-10-27T09:00:00Z');
export async function POST(req: NextRequest) {
  if (Date.now() > EXPIRES || createHash('sha256').update(req.headers.get('x-export-access') || '').digest('hex') !== ACCESS_HASH) return NextResponse.json({error:'Unauthorized'}, {status:401});
  try {
    const key = process.env.YANDEX_API_KEY_FULL?.trim();
    if (!key) throw new Error('YANDEX_API_KEY_FULL is missing');
    const input = await req.json();
    const base = 'https://api.partner.market.yandex.ru';
    async function call(path:string, body?:unknown) {
      const r = await fetch(base + path, {method:body === undefined ? 'GET':'POST',headers:{'Api-Key':key!, 'Content-Type':'application/json'},body:body === undefined ? undefined:JSON.stringify(body),cache:'no-store', signal:AbortSignal.timeout(90000)});
      const data = await r.json();
      if (!r.ok) throw new Error(JSON.stringify({status:r.status,response:data}));
      return data;
    }
    const businessId = 142954647;
    if (input.action === 'services' || input.action === 'orders-report') {
      const report = input.action === 'services' ? 'united-marketplace-services':'united-orders';
      return NextResponse.json(await call(`/v2/reports/${report}/generate?format=FILE&language=RU`, {businessId,dateFrom:'2026-10-01',dateTo:'2026-10-26'}));
    }
    if (input.action === 'info') {
      if (!/^[a-zA-Z0-9_-]{1,200}$/.test(input.reportId)) throw new Error('Invalid report ID');
      return NextResponse.json(await call(`/v2/reports/info/${input.reportId}`));
    }
    if (input.action === 'orders') {
      const q = new URLSearchParams({limit:'50'});
      if(input.pageToken) q.set('pageToken',input.pageToken);
      return NextResponse.json(await call(`/v1/businesses/${businessId}/orders?${q}`, {dates:{creationDateFrom:'2026-10-01',creationDateTo:'2026-10-27'},fake:false}));
    }
    return NextResponse.json({error:'Unknown action'}, {status:400});
  } catch (e) { return NextResponse.json({error:e instanceof Error ? e.message:'Export error'}, {status:502}); }
}
