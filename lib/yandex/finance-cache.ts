import {createAdminClient} from '../supabase/admin';
import {calculate,type Line} from './finance';
export async function readFinance(from:string,to:string){
 const db=createAdminClient();const {data:report,error}=await db.from('yandex_finance_reports').select('id,date_from,date_to,status,line_count,completed_at').eq('status','ready').lte('date_from',from).gte('date_to',to).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)throw error;if(!report)return null;
 const lines:Line[]=[];
 for(let offset=0;offset<report.line_count;offset+=1000){const {data,error}=await db.from('yandex_finance_lines').select('payload').eq('report_id',report.id).order('line_index').range(offset,offset+999);if(error)throw error;lines.push(...(data??[]).map(x=>x.payload as Line));}
 if(lines.length!==report.line_count)throw new Error('Кэш неполный: количество строк не совпало');
 return {...calculate(lines,from,to),report};
}
