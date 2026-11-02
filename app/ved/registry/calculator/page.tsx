import VedSectionIntro from "../../VedSectionIntro";
import VedCalculator from "./VedCalculator";
import VedWholeOfferCalculator from "./VedWholeOfferCalculator";
import "./calculator.css";
import "./ved-whole-offer.css";

export default async function VedCalculatorPage({searchParams}:{
 searchParams:Promise<{offerId?:string;offerItem?:string}>;
}){
 const search=await searchParams;
 const offerId=typeof search.offerId==="string"?search.offerId:"";
 return <VedSectionIntro
  title={offerId?"Общий расчёт коммерческого предложения":"Калькулятор ВЭД"}
  description={offerId?"Все товары КП, сохранение общей версии, Excel с фото и формулами":
   "Расчёт себестоимости: 40HQ, MOQ и справочный 1 м³"}>
  <article className="ved-module-panel ved-calculator-panel">
   {offerId?<VedWholeOfferCalculator offerId={offerId}/>:<VedCalculator/>}
  </article>
 </VedSectionIntro>;
}
