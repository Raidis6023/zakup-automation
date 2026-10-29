'use client';

export type AccrualDay={date:string;amount:number;count?:number};
export type AccrualItem={name:string;amount:number;daily?:AccrualDay[]};

const rubles=(value:number)=>
  (Math.sign(value)*Math.round(Math.abs(value))||0).toLocaleString('ru-RU',{
    style:'currency',currency:'RUB',minimumFractionDigits:0,maximumFractionDigits:0,
  });

export default function AccrualBreakdownList({items,total,totalLabel,minorUnits=false,invert=false}:{
  items:AccrualItem[];total:number;totalLabel:string;minorUnits?:boolean;invert?:boolean;
}){
  const shown=(value:number)=>rubles((invert?-value:value)/(minorUnits?100:1));
  return <div className="ozf-accrual-list">
    {items.map((item,index)=><details key={item.name+'-'+index} className="ozf-accrual-item">
      <summary><span>{item.name}</span><strong>{shown(item.amount)}</strong></summary>
      <div className="ozf-accrual-days">
        {(item.daily??[]).length?(item.daily??[]).map(day=><div key={day.date}>
          <time dateTime={day.date}>{day.date.split('-').reverse().join('.')}</time>
          {day.count!=null&&<small>{day.count.toLocaleString('ru-RU')} операций</small>}
          <b>{shown(day.amount)}</b>
        </div>):<p>Дневная детализация для этой статьи отсутствует.</p>}
      </div>
    </details>)}
    <div className="ozf-accrual-total"><span>{totalLabel}</span><strong>{shown(total)}</strong></div>
  </div>;
}
