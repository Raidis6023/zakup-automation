import VedSectionIntro from "../VedSectionIntro";

export default function VedSectionPage() {
  return (
    <VedSectionIntro title="Справочники ВЭД" description="Общие параметры и классификационные данные раздела.">
      <article className="ved-module-panel">
        <h2>ТН ВЭД и пошлины</h2>
        <p>Коды, пояснения, формулы ставок и история подтверждённых таможенных классификаций.</p>
      </article>
      <article className="ved-module-panel">
        <h2>Валюты и поставщики</h2>
        <p>Курсы CNY и EUR по датам документов, надбавки, условия поставки и справочник поставщиков.</p>
      </article>
    </VedSectionIntro>
  );
}
