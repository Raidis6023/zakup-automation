import {NextRequest,NextResponse} from 'next/server';
import {financeAccess} from '../../../../lib/yandex/finance-access';
import {readFinance} from '../../../../lib/yandex/finance-cache';
import {validDate} from '../../../../lib/yandex/finance';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:NextRequest){try{
 await financeAccess();const from=req.nextUrl.searchParams.get('from')??'',to=req.nextUrl.searchParams.get('to')??'';
 if(!validDate(from)||!validDate(to)||from>to)return NextResponse.json({error:'Некорректный период'},{status:400});
 const scheme=req.nextUrl.searchParams.get('scheme');if(scheme!==null&&!['fbo','fbs'].includes(scheme))return NextResponse.json({error:'Неверная схема'},{status:400});
 const data=await readFinance(from,to,scheme as 'fbo'|'fbs'|undefined);
 if(!data){
  const {createAdminClient}=await import('../../../../lib/supabase/admin');
  const db=createAdminClient();
  const [last,failed]=await Promise.all([
   db.from('yandex_finance_daily_snapshots').select('snapshot_day')
    .lte('snapshot_day',to).order('snapshot_day',{ascending:false}).limit(1).maybeSingle(),
   db.from('yandex_finance_reports').select('date_from,date_to,error')
    .eq('status','failed').lte('date_from',to).gte('date_to',from)
    .order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  const lastDay=last.data?.snapshot_day;
  const problem=failed.data?.error;
  const explanation='За выбранный период нет полного финансового отчёта ЯМ.'
   +(lastDay?' Последняя сохранённая дата: '+lastDay+'.':'')
   +(problem?' Причина последнего сбоя: '+problem+'.':'')
   +' Используйте «Загрузить / продолжить из ЯМ».';
  return NextResponse.json({error:explanation,latestAvailableDay:lastDay??null},
   {status:404,headers:{'Cache-Control':'private, no-store'}});
 }
 return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const error=e instanceof Error?e.message:'Ошибка расчёта';return NextResponse.json({error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}}
