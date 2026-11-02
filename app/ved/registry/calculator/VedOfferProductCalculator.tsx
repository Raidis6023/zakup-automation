"use client";

import type {VedCalculationInput,VedCalculationResult,VedScenarioResult} from "@/lib/ved-calculation/engine";

type InputGroup=keyof VedCalculationInput;
type Change=(group:InputGroup,key:string,value:string|number|boolean|undefined)=>void;
type SourceInfo={
 source_sheet:string;source_row:number;
 detected_data:Record<string,string|number|null>;
 missing_fields:string[];warnings:string[];
};
type Props={
 input:VedCalculationInput;
 result:VedCalculationResult|null;
 errors:string[];
 source?:SourceInfo;
 onChange:Change;
};
const format=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(n);
const exact=(n:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:6}).format(n);
const scenarios=["40hq","moq","one-cbm"] as const;
const columns=["Контейнер 40HQ","MOQ","1 м³ (справочно)"] as const;
type Item={label:string;value:(x:VedScenarioResult)=>number;emphasis?:boolean};
const expenseRows:Item[]=[
 {label:"Стоимость товара",value:x=>x.goodsRub},
 {label:"Таможенная стоимость для расчёта",value:x=>x.customsValueEstimateRub},
 {label:"Пошлина",value:x=>x.dutyRub},
 {label:"НДС при ввозе",value:x=>x.importVatRub},
 {label:"Таможенный сбор",value:x=>x.customsOperationsFeeRub},
 {label:"Брокерские услуги",value:x=>x.brokerServicesRub},
 {label:"Перевозка до границы",value:x=>x.freightBeforeBorderRub},
 {label:"Перевозка после границы",value:x=>x.freightAfterBorderRub},
 {label:"Банковские расходы",value:x=>x.bankCommissionRub},
 {label:"Сертификация",value:x=>x.certificationRub},
 {label:"Молдинг",value:x=>x.moldingRub},
 {label:"Косвенные платежи",value:x=>x.indirectPaymentsRub},
 {label:"Дополнительные расходы",value:x=>x.additionalRub},
 {label:"Прочие общие расходы",value:x=>x.otherSharedRub},
 {label:"Прочие расходы на штуку",value:x=>x.otherPerUnitRub},
 {label:"Всего с НДС, ₽",value:x=>x.totalCostIncludingVatRub,emphasis:true},
 {label:"Управленческая себестоимость партии, ₽",value:x=>x.managementCostRub,emphasis:true},
 {label:"Управленческая себестоимость 1 шт., ₽",value:x=>x.managementCostPerUnitRub,emphasis:true},
 {label:"Денежная потребность, ₽",value:x=>x.cashRequirementRub},
 {label:"Возвратное обеспечение, ₽",value:x=>x.refundableSecurityRub},
];
const physicalRows:Item[]=[
 {label:"Количество, шт.",value:x=>x.units},
 {label:"Эквивалент транспортных коробок",value:x=>x.theoreticalCartons},
 {label:"Объём, м³",value:x=>x.volumeM3},
 {label:"Вес брутто, кг",value:x=>x.grossKg},
];
export default function VedOfferProductCalculator({input,result,errors,source,onChange}:Props){
 const p=input.product,e=input.expenses,c=input.customs;
 const field=(group:InputGroup,key:string,label:string,value:number|undefined,optional=false)=>
  <label className="ved-offer-input" key={group+key}>
   <span>{label}</span>
   <input type="number" step="any" min="0" value={
    value===undefined||value===null||!Number.isFinite(value)||value<0?"":String(value)
   } placeholder={optional?"Не задано":"Введите значение"} onChange={ev=>{
    const next=ev.target.value;
    onChange(group,key,next===""?(optional?undefined:Number.NaN):Number(next));
   }}/>
  </label>;
 const textField=(group:InputGroup,key:string,label:string,value:string|undefined,max=160)=>
  <label className="ved-offer-input" key={group+key}>
   <span>{label}</span>
   <input type="text" maxLength={max} value={value||""} onChange={ev=>onChange(group,key,ev.target.value)}/>
  </label>;
 const selector=(group:InputGroup,key:string,label:string,value:string,options:Array<[string,string]>)=>
  <label className="ved-offer-input" key={group+key}>
   <span>{label}</span>
   <select value={value} onChange={ev=>onChange(group,key,ev.target.value)}>
    {options.map(([v,title])=><option value={v} key={v}>{title}</option>)}
   </select>
  </label>;
 const check=(group:InputGroup,key:string,label:string,value:boolean)=>
  <label className="ved-offer-check" key={group+key}>
   <input type="checkbox" checked={value} onChange={ev=>onChange(group,key,ev.target.checked)}/>
   <span>{label}</span>
  </label>;
 const table=(items:Item[])=>
  <div className="ved-offer-calculation-scroll"><table className="ved-offer-calculation-table">
   <thead><tr><th>Статья расчёта</th>
    {columns.map((title,i)=><th key={title}>{title}
     {result&&<small>{format(result.scenarios[scenarios[i]].managementCostPerUnitRub)} ₽/шт.</small>}
    </th>)}
   </tr></thead>
   <tbody>{items.map(item=><tr key={item.label} className={item.emphasis?"ved-offer-calculation-total":""}>
    <td>{item.label}</td>
    {scenarios.map(code=><td key={code}>{result?format(item.value(result.scenarios[code])):"—"}</td>)}
   </tr>)}</tbody>
  </table></div>;
 return <div className="ved-offer-full-calculator">
  <div className="ved-offer-calc-heading">
   <strong>Калькулятор товара: 40HQ / MOQ / 1 м³</strong>
   <span>Изменение полей сразу пересчитывает все три сценария</span>
  </div>
  {source&&<div className="ved-offer-source">
   <span>Исходное КП: лист «{source.source_sheet}», строка {source.source_row}</span>
   <span>Упаковка: {String(source.detected_data.packaging||"не указана")}</span>
   {source.missing_fields.length>0&&<span>Исходные поля требуют уточнения: {source.missing_fields.join(", ")}</span>}
   {source.warnings.map((warning,i)=><span key={i}>Проверить: {warning}</span>)}
  </div>}
  <section className="ved-offer-input-section">
   <h3>Товар, упаковка и исходные данные</h3>
   <div className="ved-offer-product-fields">
    {textField("product","productName","Название товара",p.productName)}
    {textField("product","tnVedCode","ТН ВЭД (подтверждённый)",p.tnVedCode,10)}
    {textField("product","incoterm","Условия поставки",p.incoterm,24)}
    {textField("product","departurePort","Порт / место отправления",p.departurePort)}
    {field("product","unitPriceCny","Цена за штуку, CNY",p.unitPriceCny)}
    {field("product","moqUnits","MOQ, шт.",p.moqUnits)}
    {field("product","unitsPerCarton","Вложимость в коробку, шт.",p.unitsPerCarton)}
    {field("product","cartonVolumeM3","Объём коробки, м³",p.cartonVolumeM3)}
    {field("product","cartonGrossKg","Вес брутто коробки, кг",p.cartonGrossKg)}
    {field("product","cartonNetKg","Вес нетто коробки, кг",p.cartonNetKg,true)}
    {field("product","cartonLengthCm","Длина коробки, см",p.cartonLengthCm,true)}
    {field("product","cartonWidthCm","Ширина коробки, см",p.cartonWidthCm,true)}
    {field("product","cartonHeightCm","Высота коробки, см",p.cartonHeightCm,true)}
    {field("product","individualLengthCm","Длина индивидуальной упаковки, см",p.individualLengthCm,true)}
    {field("product","individualWidthCm","Ширина индивидуальной упаковки, см",p.individualWidthCm,true)}
    {field("product","individualHeightCm","Высота индивидуальной упаковки, см",p.individualHeightCm,true)}
    {field("product","markingCnyPerUnit","Маркировка на штуку, CNY",p.markingCnyPerUnit,true)}
   </div>
  </section>
  <section className="ved-offer-input-section">
   <h3>Курсы и контейнер</h3>
   <div className="ved-offer-product-fields">
    {field("currency","cnyRub","CNY / RUB, рабочий курс ВЭД",input.currency.cnyRub)}
    {field("currency","eurRub","EUR / RUB, курс ЦБ",input.currency.eurRub)}
    {field("container","usableVolumeM3","Рабочий объём 40HQ, м³",input.container.usableVolumeM3)}
    {field("container","maxPayloadKg","Грузоподъёмность 40HQ, кг",input.container.maxPayloadKg,true)}
   </div>
  </section>
  <section className="ved-offer-input-section">
   <h3>Логистика и дополнительные расходы</h3>
   <div className="ved-offer-product-fields">
    {field("expenses","freightBeforeBorderRub","Перевозка до границы, ₽",e.freightBeforeBorderRub)}
    {field("expenses","freightAfterBorderRub","Перевозка после границы, ₽",e.freightAfterBorderRub)}
    {field("expenses","bankCommissionRub","Банковские расходы, ₽",e.bankCommissionRub)}
    {field("expenses","brokerServicesRub","Брокер / оформление, ₽",e.brokerServicesRub)}
    {field("expenses","otherSharedRub","Прочие общие, ₽",e.otherSharedRub)}
    {field("expenses","otherRubPerUnit","Прочие на штуку, ₽",e.otherRubPerUnit)}
    {field("expenses","certificationRub","Сертификация на артикул, ₽",e.certificationRub,true)}
    {field("expenses","moldingRub","Стоимость молдинга на MOQ, ₽",e.moldingRub,true)}
    {field("expenses","indirectPaymentsRub","Косвенные платежи, ₽",e.indirectPaymentsRub,true)}
    {field("expenses","additionalRub","Дополнительные платежи, ₽",e.additionalRub,true)}
    {field("expenses","refundableSecurityRub","Возвратное обеспечение, ₽",e.refundableSecurityRub)}
    {check("expenses","dangerousCargo","Опасный груз",Boolean(e.dangerousCargo))}
    {e.dangerousCargo&&field("expenses","dangerSurchargeBeforeRub","Опасный груз до границы, ₽",e.dangerSurchargeBeforeRub,true)}
    {e.dangerousCargo&&field("expenses","dangerSurchargeAfterRub","Опасный груз после границы, ₽",e.dangerSurchargeAfterRub,true)}
   </div>
  </section>
  <section className="ved-offer-input-section">
   <h3>Таможня, пошлина и НДС</h3>
   <div className="ved-offer-product-fields">
    {selector("customs","dutyMode","Тип пошлины",c.dutyMode,[
     ["ad-valorem","Адвалорная, %"],["specific","Специфическая, EUR/ед."],
     ["combined-max","Комбинированная: максимум"],["combined-sum","Комбинированная: сумма"]])}
    {field("customs","adValoremPercent","Пошлина, %",c.adValoremPercent)}
    {field("customs","specificEurPerUnit","Специфическая пошлина, EUR/ед.",c.specificEurPerUnit)}
    {selector("customs","specificUnit","Единица специфической пошлины",c.specificUnit,[
     ["gross-kg","Кг брутто"],["net-kg","Кг нетто"],["item","Штука"]])}
    {field("customs","vatPercent","Ввозной НДС, %",c.vatPercent)}
    {selector("customs","feeMode","Таможенный сбор",c.feeMode||"schedule",[
     ["schedule","По шкале"],["manual","Ручная ставка"]])}
    {c.feeMode==="manual"&&field("expenses","customsOperationsFeeRub","Таможенный сбор вручную, ₽",e.customsOperationsFeeRub)}
    {check("customs","includeFreightBeforeBorderInCustomsBase","Включать доставку до границы в таможенную стоимость",c.includeFreightBeforeBorderInCustomsBase)}
    {check("customs","importVatRecoverable","Ввозной НДС возмещается",c.importVatRecoverable)}
   </div>
   <p className="ved-offer-help">Ставку пошлины проверяем по ТН ВЭД. Общий тариф нельзя применять ко всем артикулам без проверки.</p>
  </section>
  <section className="ved-offer-calculation-results">
   <h3>Полный расчёт по сценариям</h3>
   {!result?<p role="alert" className="ved-offer-error">{errors.join("; ")||"Недостаточно данных для расчёта"}</p>:
    <>
     <div className="ved-offer-calculation-highlights">
      <div><small>40HQ, ₽/шт.</small><strong>{format(result.scenarios["40hq"].managementCostPerUnitRub)}</strong></div>
      <div><small>MOQ, ₽/шт.</small><strong>{format(result.scenarios.moq.managementCostPerUnitRub)}</strong></div>
      <div><small>1 м³, ₽/шт. (справочно)</small><strong>{format(result.scenarios["one-cbm"].managementCostPerUnitRub)}</strong></div>
      <div className="ved-offer-calculation-average"><small>Среднее 40HQ + MOQ, ₽/шт.</small><strong>{format(result.averageCostPerUnitRub)}</strong></div>
     </div>
     <h4>Количество и объём</h4>{table(physicalRows)}
     <h4>Статьи расходов и себестоимость</h4>{table(expenseRows)}
     <p className="ved-offer-help">Расходы по каждому сценарию показаны в рублях, за исключением специально отмеченной цены за штуку. Значения пересчитываются при изменении полей выше.</p>
     {result.warnings.length>0&&<p className="ved-offer-calc-warnings">{result.warnings.join("; ")}</p>}
     <p className="ved-offer-help">Физический предел 40HQ: {format(result.feasibility.maxWholeCartons40hq)} коробок, {format(result.feasibility.maxWholeUnits40hq)} шт. Минимум для MOQ: {format(result.feasibility.moqRequiredWholeCartons)} полных коробок. Объём MOQ: {exact(result.feasibility.moqRealVolumeM3)} м³.</p>
    </>}
  </section>
 </div>;
}
