import VedSectionIntro from "../VedSectionIntro";

export default function VedSectionPage() {
  return (
    <VedSectionIntro title="Документы" description="Архив исходных документов, связанных с предложениями и поставками.">
      <article className="ved-module-panel">
        <h2>Исходные файлы</h2>
        <p>Коммерческие предложения, проформы, инвойсы и упаковочные листы с сохранением оригиналов.</p>
      </article>
      <article className="ved-module-panel">
        <h2>Связи документов</h2>
        <p>Позднее документы будут связаны с заказами, товарами и фактическими таможенными оформлениями.</p>
      </article>
    </VedSectionIntro>
  );
}
