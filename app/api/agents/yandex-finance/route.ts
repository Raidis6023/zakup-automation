import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {readFinance} from '../../../../lib/yandex/finance-cache';
import {validDate} from '../../../../lib/yandex/finance';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 await financeAccess();const from=req.nextUrl.searchParams.get('from')??'',to=req.nextUrl.searchParams.get('to')??'';
 if(!validDate(from)||!validDate(to)||from>to)return NextResponse.json({error:'Некорректный период'},{status:400});
 const scheme=req.nextUrl.searchParams.get('scheme');if(scheme!==null&&!['fbo','fbs'].includes(scheme))return NextResponse.json({error:'Неверная схема'},{status:400});
 const data=await readFinance(from,to,scheme as 'fbo'|'fbs'|undefined);if(!data)return NextResponse.json({error:'За этот период нет загруженных отчётов. Загрузите данные из ЯМ.'},{status:404});
 return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const error=e instanceof Error?e.message:'Ошибка расчёта';return NextResponse.json({error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}}
