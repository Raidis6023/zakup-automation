import PageHeader from "../../ui/PageHeader";
import {redirect} from 'next/navigation';
import {financeAccess} from '../../../lib/yandex/finance-access';
import {readFinance} from '../../../lib/yandex/finance-cache';
import YandexFinancierClient from './YandexFinancierClient';
import '../../ozon/financier/financier.css';
import './finance.css';
import '../../ozon/financier/campaigns.css';
export const dynamic='force-dynamic';
export default async function Page(){
 let db;try{db=await financeAccess();}catch{redirect('/yandex-market');}
 let initial=null,error='';try{const {data:snapshot,error:readError}=await db.from('yandex_finance_daily_snapshots').select('snapshot_day').order('snapshot_day',{ascending:false}).limit(1).maybeSingle();if(readError)throw readError;if(snapshot){const to=snapshot.snapshot_day,from=new Date(Date.parse(to+'T00:00:00Z')-27*86400000).toISOString().slice(0,10);initial=await readFinance(from,to);}else{const {data:latest,error:latestError}=await db.from('yandex_finance_reports').select('date_from,date_to').eq('status','ready').order('created_at',{ascending:false}).limit(1).maybeSingle();if(latestError)throw latestError;if(latest)initial=await readFinance(latest.date_from,latest.date_to);}}catch(e){error=e instanceof Error?e.message:'Не удалось прочитать отчёт';}
 return <main className="ozf-page ymf"><PageHeader variant="financier" title="ИИ-финансист Яндекс Маркета" description="Финансовая аналитика, доходы и расходы по артикулам Яндекс Маркета." /><YandexFinancierClient initial={initial} initialError={error}/></main>;
}
