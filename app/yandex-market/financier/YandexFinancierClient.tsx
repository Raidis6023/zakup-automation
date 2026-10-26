'use client';
import {useEffect,useRef,useState} from 'react';
import {calculate,rules} from '../../../lib/yandex/finance';
type Data=ReturnType<typeof calculate>&{report:{id:string;completed_at:string|null}};
const money=(n:number)=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100)+' ₽';
function csv(name:string,records:Record<string,unknown>[]){
 if(!records.length)return;const keys=Object.keys(records[0]);const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@]/,"'$&").replace(/"/g,'""')+'"';
 const text='\ufeff'+[keys,...records.map(r=>keys.map(k=>r[k]))].map(row=>row.map(cell).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export default function YandexFinancierClient({initial,initialError}:{initial:Data|null;initialError:string}){
 const [from,setFrom]=useState(initial?.from??'2026-10-01'),[to,setTo]=useState(initial?.to??'2026-10-26');
 const [data,setData]=useState(initial),[error,setError]=useState(initialError),[search,setSearch]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState('');
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 async function request(url:string,body?:unknown){const r=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error(d.error??'Ошибка запроса');return d;}
 async function load(){setError('');setBusy(true);try{const d=await request(`/api/agents/yandex-finance?from=${from}&to=${to}`);if(alive.current)setData(d);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Ошибка');}finally{if(alive.current)setBusy(false);}}
 async function sync(){setBusy(true);setError('');try{
  let job=await request('/api/agents/yandex-finance-sync',{action:'start',from,to});
  const phases:Record<string,string>={services_request:'Запрос отчёта услуг',services_poll:'ЯМ формирует отчёт услуг',orders_request:'Ожидание лимита перед запросом заказов',orders_poll:'ЯМ формирует отчёт заказов',done:'Готово'};
  while(alive.current&&job.status==='loading'){
   setProgress(`${phases[job.phase]??job.phase} · ${job.date_from} — ${job.date_to}`);
   job=await request('/api/agents/yandex-finance-sync',{action:'advance',id:job.id});
   if(job.status==='loading')await new Promise(resolve=>setTimeout(resolve,8000));
  }
  if(job.status==='failed')throw new Error(job.error??'Не удалось загрузить отчёты');
  if(alive.current){setProgress('Отчёты загружены');setData(await request(`/api/agents/yandex-finance?from=${from}&to=${to}`));}
 }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Ошибка');}finally{if(alive.current)setBusy(false);}}
 const rows=data?.rows.filter(r=>(r.article+' '+r.name).toLowerCase().includes(search.toLowerCase()))??[];
 return <>
 <section className="ymf-controls"><label>С <input type="date" value={from} onChange={e=>setFrom(e.target.value)} disabled={busy}/></label><label>По <input type="date" value={to} onChange={e=>setTo(e.target.value)} disabled={busy}/></label><button onClick={load} disabled={busy}>Сформировать из кэша</button><button onClick={sync} disabled={busy}>Загрузить / продолжить из ЯМ</button><span role="status">{busy?'Загрузка… ':''}{progress}</span></section>
 {error&&<p role="alert" className="ymf-warning">{error}</p>}
 {data&&<>
 <p>Показан период: <b>{data.from} — {data.to}</b> включительно. Кэш: {data.report.completed_at?new Date(data.report.completed_at).toLocaleString('ru-RU',{timeZone:'Asia/Krasnoyarsk'}):'—'} (Красноярск).</p>
 <div className="ymf-kpis">{[['Доход по правилу N × V',data.totals.income],['Все расходы ЯМ',data.totals.expenses],['Нераспределённые расходы',data.totals.common],['Результат до себестоимости',data.totals.result]].map(([label,value])=><section className="ymf-card" key={String(label)}><span>{label}</span><strong className={Number(value)<0?'ymf-negative':''}>{money(Number(value))}</strong></section>)}</div>
 <section className="ymf-warning"><b>{data.warnings.length?'Расчёт содержит неполные строки':'Проверка исходных данных'}</b><p>Выкупы: {data.totals.buyouts} шт. {data.warnings.length>0&&`В ${data.warnings.length} строках пусто в V. Их суммы не рассчитаны; итог предварительный.`}</p><button disabled={!data.warnings.length} onClick={()=>csv('Yandex_пустое_количество.csv',data.warnings)}>Скачать строки без количества</button></section>
 <section className="ymf-card"><h2>По артикулам</h2><label>Поиск <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Артикул или название"/></label><button onClick={()=>csv('Yandex_расчёт.csv',rows.map(r=>({Артикул:r.article,Товар:r.name,Выкупы:r.buyouts,Доход:r.income/100,...Object.fromEntries(rules.map(([name])=>[name,(r.expenses[name]??0)/100])),Расходы:r.expense/100,Результат:r.result/100})))}>Скачать расчёт CSV</button>
 <p>{rows.length} из {data.rows.length} артикулов. Общие расходы учтены в результате периода и показаны ниже.</p>
 <div className="ymf-scroll"><table><thead><tr><th>Артикул / товар</th><th>Доставлено, ₽</th><th>Отмены, ₽</th><th>Возвраты, ₽</th><th>Невыкупы, ₽</th><th>Выкупы, шт.</th><th>Доход, ₽</th>{rules.map(([name])=><th key={name}>{name}</th>)}<th>Расходы, ₽</th><th>Результат до себестоимости, ₽</th></tr></thead><tbody>{rows.map(r=><tr key={r.article}><th><b>{r.article}</b><small>{r.name}</small></th><td>{money(r.delivered)}</td><td>{money(r.cancelled)}</td><td>{money(r.returned)}</td><td>{money(r.unredeemed)}</td><td>{r.buyouts}</td><td>{money(r.income)}</td>{rules.map(([name])=><td key={name}>{money(r.expenses[name]??0)}</td>)}<td>{money(r.expense)}</td><td className={r.result<0?'ymf-negative':'ymf-positive'}>{money(r.result)}</td></tr>)}</tbody></table></div></section>
 <div className="ymf-columns"><section className="ymf-card"><h2>Все расходы по статьям</h2><table><tbody>{rules.map(([name,col])=><tr key={name}><th>{name} <small>Столбец {col}</small></th><td>{money(data.articleTotals[name]??0)}</td></tr>)}<tr><th>Итого</th><td><b>{money(data.totals.expenses)}</b></td></tr></tbody></table></section><section className="ymf-card"><h2>Нераспределённые расходы</h2><table><tbody>{Object.entries(data.common).map(([name,n])=><tr key={name}><th>{name}</th><td>{money(n)}</td></tr>)}</tbody></table><h3>Подписки</h3><p>{money(data.totals.subscription)} распределены пропорционально положительному количеству чистых выкупов. База: {data.totals.subscriptionDenominator} шт. Отрицательные выкупы не создают отрицательный расход подписки. Копейки распределяются так, чтобы итог совпал.</p><h3>Исключённые строки</h3><p>{data.excluded.length} строк: даты заказа/услуги вне периода либо отсутствуют необходимые данные.</p><button onClick={()=>csv('Yandex_исключённые_строки.csv',data.excluded.map(r=>({...r,amount:r.amount/100})))}>Скачать исключённые строки</button><p>Сверка расходов: {money(data.totals.allocated)} по артикулам + {money(data.totals.common)} общих = {money(data.totals.expenses)}.</p></section></div>
 <details className="ymf-card"><summary>Правила расчёта и даты</summary><p>Доход: N × V. Доставленные минус отменённые, возвраты и невыкупы. Другие статусы не дают доход. V — «Передано в доставку»; W не подставляется вместо пустого V.</p><p>Заказы отбираются по дате оформления/создания. Услуги, связанные с заказом, учитываются только при дате заказа и дате услуги внутри периода. Если дату заказа нельзя установить, строка попадает в исключения. Для расходов без заказа используется дата услуги.</p><p>Все указанные столбцы расходов суммируются как есть, включая P программы лояльности и Z средней мили. Дополнительного умножения тарифа на количество нет. AJ размещения берётся до скидок и наценок. Это пользовательская методика; суммы отличаются от итоговой стоимости услуг в сводке ЯМ.</p><p>Результат периода = доход − все расходы ЯМ. Себестоимость, ТК Маяк и налоги пока не включены.</p></details>
 </>}
 </>;
}
