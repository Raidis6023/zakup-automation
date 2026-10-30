import ExcelJS from 'exceljs';
import {NextRequest} from 'next/server';
import {createClient} from '../../../../lib/supabase/server';
import {createAdminClient} from '../../../../lib/supabase/admin';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
type Json=Record<string,unknown>;
const num=(value:unknown)=>{const n=Number(value??0);return Number.isFinite(n)?n:0;};
const dayOf=(row:Json)=>String(row.rrDate??row.rrdDt??row.rrdDate??row.saleDt??row.orderDt??'').slice(0,10);
const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'));

async function access(){const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user)throw Error('Требуется авторизация');const db=createAdminClient();const {data,error}=await db.from('app_user_access').select('admin_level,is_blocked').eq('user_id',user.id).maybeSingle();if(error||!data||data.is_blocked||!['admin','senior_admin'].includes(data.admin_level??''))throw Error('Недостаточно прав для финансовой аналитики');return db;}
async function pages<T>(read:(from:number,to:number)=>Promise<{data:T[]|null;error:unknown}>){const all:T[]=[];for(let offset=0;;offset+=1000){const {data,error}=await read(offset,offset+999);if(error)throw error;all.push(...(data??[]));if((data?.length??0)<1000)break;}return all;}
function sheet(workbook:ExcelJS.Workbook,name:string,headers:string[]){const ws=workbook.addWorksheet(name);ws.addRow(headers);ws.views=[{state:'frozen',ySplit:1}];ws.autoFilter={from:{row:1,column:1},to:{row:1,column:headers.length}};const row=ws.getRow(1);row.font={bold:true,color:{argb:'FFFFFFFF'}};row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF173328'}};row.alignment={vertical:'middle',horizontal:'center'};row.height=24;return ws;}
function fit(ws:ExcelJS.Worksheet,max=38){ws.columns.forEach(column=>{let width=10;column.eachCell?.({includeEmpty:false},cell=>{width=Math.max(width,Math.min(max,String(cell.value??'').length+2));});column.width=width;});}

export async function GET(req:NextRequest){
 try{
  const db=await access(),from=req.nextUrl.searchParams.get('from')??'',to=req.nextUrl.searchParams.get('to')??'';
  if(!valid(from)||!valid(to)||from>to||Date.parse(to)-Date.parse(from)>90*86400000)return Response.json({ok:false,error:'Выберите период до 91 дня'},{status:400});
  const jobs=await db.from('wb_finance_cache_jobs').select('run_day,date_from,date_to,status,rows_saved,completed_at').gt('rows_saved',0).lte('date_from',to).gte('date_to',from).order('run_day',{ascending:false}).limit(30);if(jobs.error)throw jobs.error;
  const job=(jobs.data??[]).sort((a,b)=>(b.status==='complete'?1:0)-(a.status==='complete'?1:0)||b.rows_saved-a.rows_saved)[0];
  const finance:Json[]=[];
  if(job){const records=await pages<{payload:Json}>(async(a,b)=>db.from('wb_finance_cache_lines').select('payload').eq('run_day',job.run_day).order('line_index').range(a,b));for(const record of records){const d=dayOf(record.payload);if(d>=from&&d<=to)finance.push(record.payload);}}
  const [ads,storage,orders,adCoverage,storageCoverage]=await Promise.all([
   pages<Json>(async(a,b)=>db.from('wb_finance_ad_daily').select('*').gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day').range(a,b)),
   pages<Json>(async(a,b)=>db.from('wb_finance_storage_daily').select('*').gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day').range(a,b)),
   pages<Json>(async(a,b)=>db.from('wb_orders').select('*').gte('order_date',from+'T00:00:00Z').lte('order_date',to+'T23:59:59Z').order('order_date').range(a,b)),
   db.from('wb_finance_ad_snapshots').select('snapshot_day,row_count,captured_at').gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day'),
   db.from('wb_finance_storage_snapshots').select('snapshot_day,row_count,captured_at').gte('snapshot_day',from).lte('snapshot_day',to).order('snapshot_day')
  ]);
  if(adCoverage.error)throw adCoverage.error;if(storageCoverage.error)throw storageCoverage.error;
  const grouped=new Map<string,Json>();
  for(const row of finance){const day=dayOf(row),nm=String(row.nmId??'0'),operation=String(row.sellerOperName??row.docTypeName??'Неизвестно'),key=[day,nm,operation].join('|'),old=grouped.get(key)??{day,nm_id:nm,article:String(row.vendorCode??''),name:String(row.title??row.subjectName??''),operation,rows:0,quantity:0,realization:0,to_transfer:0,delivery:0,storage_in_report:0,acceptance:0,penalty:0,deduction:0,raw_sample:JSON.stringify(row)};old.rows=num(old.rows)+1;old.quantity=num(old.quantity)+num(row.quantity);old.realization=num(old.realization)+num(row.retailAmount);old.to_transfer=num(old.to_transfer)+num(row.forPay);old.delivery=num(old.delivery)+num(row.deliveryAmount);old.storage_in_report=num(old.storage_in_report)+num(row.paidStorage);old.acceptance=num(old.acceptance)+num(row.paidAcceptance);old.penalty=num(old.penalty)+num(row.penalty);old.deduction=num(old.deduction)+num(row.deduction);grouped.set(key,old);}
  const summary=new Map<string,Json>();
  for(const row of grouped.values()){const id=String(row.nm_id),old=summary.get(id)??{nm_id:id,article:row.article,name:row.name,finance_rows:0,quantity:0,realization:0,to_transfer:0,delivery:0,storage_in_report:0,acceptance:0,penalty:0,deduction:0,orders:0,cancelled:0,advertising:0,separate_storage:0};for(const key of ['finance_rows','quantity','realization','to_transfer','delivery','storage_in_report','acceptance','penalty','deduction'])old[key]=num(old[key])+num(row[key==='finance_rows'?'rows':key]);summary.set(id,old);}
  for(const row of orders){const id=String(row.nm_id??(row.raw as Json|undefined)?.nmId??'0'),old=summary.get(id)??{nm_id:id,article:row.supplier_article??'',name:'',finance_rows:0,quantity:0,realization:0,to_transfer:0,delivery:0,storage_in_report:0,acceptance:0,penalty:0,deduction:0,orders:0,cancelled:0,advertising:0,separate_storage:0};old.orders=num(old.orders)+1;if(row.is_cancel)old.cancelled=num(old.cancelled)+1;summary.set(id,old);}
  for(const row of ads){const id=String(row.nm_id??'0'),old=summary.get(id)??{nm_id:id,article:'',name:'',finance_rows:0,quantity:0,realization:0,to_transfer:0,delivery:0,storage_in_report:0,acceptance:0,penalty:0,deduction:0,orders:0,cancelled:0,advertising:0,separate_storage:0};old.advertising=num(old.advertising)+num(row.spend);summary.set(id,old);}
  for(const row of storage){const id=String(row.nm_id??'0'),old=summary.get(id)??{nm_id:id,article:row.article??'',name:'',finance_rows:0,quantity:0,realization:0,to_transfer:0,delivery:0,storage_in_report:0,acceptance:0,penalty:0,deduction:0,orders:0,cancelled:0,advertising:0,separate_storage:0};old.separate_storage=num(old.separate_storage)+num(row.amount);summary.set(id,old);}
  const wb=new ExcelJS.Workbook();wb.creator='КПК МИА WorkSpace';wb.created=new Date();
  const cover=sheet(wb,'Покрытие',['Раздел','Период/дата','Статус','Строк','Обновлено','Комментарий']);
  cover.addRow(['Финансы',from+' — '+to,job?.status??'нет данных',finance.length,job?.completed_at??'',job?'Источник: '+job.run_day+', сохранено '+job.rows_saved+' строк':'Нет финансового задания с данными']);
  cover.addRow(['Заказы',from+' — '+to,orders.length?'получено':'нет данных',orders.length,'','Предварительные данные WB']);
  for(const d of adCoverage.data??[])cover.addRow(['Реклама',d.snapshot_day,'готово',d.row_count,d.captured_at,'fullstats']);
  for(const d of storageCoverage.data??[])cover.addRow(['Хранение',d.snapshot_day,'готово',d.row_count,d.captured_at,'Отдельный отчёт платного хранения']);
  const sum=sheet(wb,'Сводка_по_товарам',['nmId','Артикул','Товар','Финансовых строк','Количество в фин. отчёте','Реализация, ₽','К перечислению, ₽','Логистика, ₽','Хранение в реализации, ₽','Приёмка, ₽','Штрафы, ₽','Удержания, ₽','Заказы, шт','Отмены, шт','Реклама, ₽','Отдельное хранение, ₽']);
  for(const row of [...summary.values()].sort((a,b)=>String(a.article).localeCompare(String(b.article),'ru')))sum.addRow(['nm_id','article','name','finance_rows','quantity','realization','to_transfer','delivery','storage_in_report','acceptance','penalty','deduction','orders','cancelled','advertising','separate_storage'].map(k=>row[k]??''));
  const fin=sheet(wb,'Финансы_по_дням',['Дата','nmId','Артикул','Товар','Операция','Строк','Количество','Реализация, ₽','К перечислению, ₽','Логистика, ₽','Хранение, ₽','Приёмка, ₽','Штраф, ₽','Удержание, ₽','Пример исходной строки JSON']);for(const r of grouped.values())fin.addRow(['day','nm_id','article','name','operation','rows','quantity','realization','to_transfer','delivery','storage_in_report','acceptance','penalty','deduction','raw_sample'].map(k=>r[k]??''));
  const ad=sheet(wb,'Реклама',['Дата','Кампания','nmId','Расход, ₽','Показы','Клики','Заказы','Сумма заказов, ₽','Исходные данные JSON']);for(const r of ads)ad.addRow([r.snapshot_day,r.campaign_id,r.nm_id,r.spend,r.views,r.clicks,r.orders,r.sum_price,JSON.stringify(r.payload??{})]);
  const stor=sheet(wb,'Хранение',['Дата','nmId','Артикул','Склад','Сумма, ₽','Исходные данные JSON']);for(const r of storage)stor.addRow([r.snapshot_day,r.nm_id??'',r.article??'',r.warehouse??'',r.amount,JSON.stringify(r.payload??{})]);
  const ord=sheet(wb,'Заказы',['Дата заказа','srid','nmId','Артикул','Штрихкод','Склад','Тип склада','Отменён','Дата отмены','Исходные данные JSON']);for(const r of orders)ord.addRow([r.order_date,r.srid,r.nm_id,r.supplier_article,r.barcode,r.warehouse_name,r.warehouse_type,r.is_cancel?'Да':'Нет',r.cancel_date??'',JSON.stringify(r.raw??{})]);
  for(const ws of wb.worksheets)fit(ws,ws.name==='Финансы_по_дням'?28:42);
  const buffer=await wb.xlsx.writeBuffer();return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="WB_finance_${from}_${to}.xlsx"`,'Cache-Control':'private, no-store'}});
 }catch(e){return Response.json({ok:false,error:e instanceof Error?e.message:String(e)},{status:500});}
}
