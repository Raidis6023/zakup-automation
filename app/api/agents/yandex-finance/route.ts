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
  const yesterday=new Date(Date.now()+7*3600000-86400000).toISOString().slice(0,10);
  const cappedTo=to<yesterday?to:yesterday;
  // Preserve access to previously published finance snapshots, even when
  // the user chooses a future date or a period extending beyond saved days.
  // Never present an incomplete range as a fully loaded financial report.
  const snapshots=await db.from('yandex_finance_daily_snapshots').select('snapshot_day')
   .gte('snapshot_day',from).lte('snapshot_day',cappedTo).order('snapshot_day');
  if(snapshots.error)throw snapshots.error;
  const shift=(day:string)=>new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  let availableTo:string|null=null,expected=from;
  for(const snapshot of snapshots.data??[]){
   if(snapshot.snapshot_day!==expected)break;
   availableTo=expected;expected=shift(expected);
  }
  if(availableTo){
   const partial=await readFinance(from,availableTo,scheme as 'fbo'|'fbs'|undefined);
   if(partial)return NextResponse.json({...partial,
    partial_coverage:true,requested_from:from,requested_to:to,
    coverage_warning:'Выбран период '+from+' — '+to+'. Подтверждённые финансовые данные ЯМ доступны только до '+availableTo+
     '. Показана сохранённая часть периода: '+from+' — '+availableTo+
     '. Отсутствующие даты не считаются нулевыми.'},
    {headers:{'Cache-Control':'private, no-store'}});
  }
  const [last,latestReady,failed]=await Promise.all([
   db.from('yandex_finance_daily_snapshots').select('snapshot_day')
    .lte('snapshot_day',to).order('snapshot_day',{ascending:false}).limit(1).maybeSingle(),
   db.from('yandex_finance_reports').select('completed_at')
    .eq('status','ready').lte('date_from',to).gte('date_to',from)
    .order('completed_at',{ascending:false}).limit(1).maybeSingle(),
   db.from('yandex_finance_reports').select('date_from,date_to,error,created_at')
    .eq('status','failed').lte('date_from',to).gte('date_to',from)
    .order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  for(const r of [last,latestReady,failed])if(r.error)throw r.error;
  const lastDay=last.data?.snapshot_day;
  const failedIsNew=!!failed.data?.created_at&&
    (!latestReady.data?.completed_at||Date.parse(failed.data.created_at)>Date.parse(latestReady.data.completed_at));
  const problem=failedIsNew?failed.data?.error:null;
  const explanation='За выбранный период нет полного финансового отчёта ЯМ.'
   +(to>yesterday?' Дата окончания '+to+' ещё не наступила.':'')
   +(lastDay?' Последняя сохранённая дата: '+lastDay+'.':'')
   +(problem?' Ошибка актуальной выгрузки: '+problem+'.':'')
   +' Ранее сохранённые отчёты не удалены.';
  return NextResponse.json({error:explanation,latestAvailableDay:lastDay??null},
   {status:404,headers:{'Cache-Control':'private, no-store'}});
 }
 return NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const error=e instanceof Error?e.message:'Ошибка расчёта';return NextResponse.json({error},{status:error==='Требуется авторизация'?401:error.startsWith('Недостаточно прав')?403:500});}}
