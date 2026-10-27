import {NextRequest,NextResponse} from 'next/server';
import {advancePromotion} from '../yandex-finance-campaigns/worker';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=300;
export async function GET(req:NextRequest){if(!process.env.CRON_SECRET||req.headers.get('authorization')!=='Bearer '+process.env.CRON_SECRET)return NextResponse.json({error:'Unauthorized'},{status:401});const result=await advancePromotion();return NextResponse.json(result.phase==='saved'?await advancePromotion():result);}
