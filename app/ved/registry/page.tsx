import Link from "next/link";
import VedSectionIntro from "../VedSectionIntro";

export default function VedSectionPage() {
  return (
    <VedSectionIntro title="Реестр товаров и расчётов" description="Сквозной поиск товаров и исторических расчётов ВЭД.">
      <article className="ved-module-panel">
        <h2>По товарам</h2>
        <p>Общее представление расчётов с группировкой по товарам, предложениям и поставщикам.</p>
        <Link className="ved-calc-open" style={{ display: "inline-flex", marginTop: 13, color: "var(--ws-active, #37c98e)", fontSize: 13, fontWeight: 650, textDecoration: "none" }} href="/ved/registry/calculator">Открыть черновой калькулятор ВЭД</Link>
      </article>
      <article className="ved-module-panel">
        <h2>История себестоимости</h2>
        <p>Сохранённые версии, расчёты по MOQ, полному контейнеру и справочный сценарий 1 м³.</p>
      </article>
    </VedSectionIntro>
  );
}
