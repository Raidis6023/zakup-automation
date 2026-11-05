'use client';
export type UnitCostItem={name:string;amount:number|null};
const fmt=(v:number|null)=>v===null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2,minimumFractionDigits:Math.abs(v)<1?2:0}).format(v)+' ₽';
export default function CostPerUnitComparison({units,items,market}:{units:number|null;items:UnitCostItem[];market:string}){
 const list=items.filter(x=>x.amount===null||Number.isFinite(x.amount)&&Math.abs(x.amount)>0.005);
 const total=list.some(x=>x.amount===null)?null:list.reduce((sum,x)=>sum+(x.amount??0),0);
 const unit=units!==null&&units>0?units:null;
 return <aside className="ozf-cost-unit" aria-label={'Расходы '+market+' на единицу товара'}>
  <div className="ozf-cost-unit-title"><strong>Расходы на 1 ед. товара</strong><span>Фактические затраты за выбранный период</span></div>

  <table className="ozf-cost-unit-table"><thead><tr><th>Вид расхода</th><th>За период</th><th>На 1 ед.</th></tr></thead><tbody>
  {list.map((row,i)=><tr key={row.name+i}><td>{row.name}</td><td>{fmt(row.amount)}</td><td>{fmt(row.amount!==null&&unit!==null?row.amount/unit:null)}</td></tr>)}
  {!list.length&&<tr><td colSpan={3}>В этом периоде нет подтверждённых расходов</td></tr>}
  </tbody><tfoot><tr><th>Все расходы</th><th>{fmt(total)}</th><th>{fmt(total!==null&&unit!==null?total/unit:null)}</th></tr></tfoot></table>
 </aside>;
}
