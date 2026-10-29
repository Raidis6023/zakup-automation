import VedSectionIntro from "../VedSectionIntro";

export default function VedSectionPage() {
  return (
    <VedSectionIntro title="Коммерческие предложения" description="Предложения поставщиков и связанные с ними расчёты.">
      <article className="ved-module-panel">
        <h2>Предложения поставщиков</h2>
        <p>Здесь будет общий список КП с датами, поставщиками, версиями и исходными файлами. Записи пока не импортированы.</p>
      </article>
      <article className="ved-module-panel">
        <h2>Состав предложений</h2>
        <p>Внутри каждого КП будут товары и расчётные варианты. Карточки расчётов будут открываться поверх реестра.</p>
      </article>
    </VedSectionIntro>
  );
}
