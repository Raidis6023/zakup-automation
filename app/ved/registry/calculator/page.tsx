import VedSectionIntro from "../../VedSectionIntro";
import VedCalculator from "./VedCalculator";
import "./calculator.css";

export default function VedCalculatorPage() {
  return <VedSectionIntro
    title="Калькулятор ВЭД"
    description="Черновой расчёт себестоимости: 40HQ, MOQ и справочный 1 м³"
  >
    <article className="ved-module-panel ved-calculator-panel">
      <VedCalculator />
    </article>
  </VedSectionIntro>;
}
