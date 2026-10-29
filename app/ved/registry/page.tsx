import VedSectionIntro from "../VedSectionIntro";

export default function VedSectionPage() {
  return (
    <VedSectionIntro title="Реестр товаров и расчётов" description="Сквозной поиск товаров и исторических расчётов ВЭД.">
      <article className="ved-module-panel">
        <h2>По товарам</h2>
        <p>Общее представление расчётов с группировкой по товарам, предложениям и поставщикам.</p>
      </article>
      <article className="ved-module-panel">
        <h2>История себестоимости</h2>
        <p>Сохранённые версии, расчёты по MOQ, полному контейнеру и справочный сценарий 1 м³.</p>
      </article>
    </VedSectionIntro>
  );
}
