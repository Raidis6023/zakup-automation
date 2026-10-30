import VedSectionIntro from "../VedSectionIntro";
import VedOfferUploadDialog from "./VedOfferUploadDialog";
import "./ved-offer-upload.css";

export default function VedCommercialOffersPage() {
  return (
    <VedSectionIntro
      title="Коммерческие предложения"
      description="Предложения поставщиков и связанные с ними расчёты."
      actions={<VedOfferUploadDialog />}
    >
      <article className="ved-module-panel">
        <h2>Предложения поставщиков</h2>
        <p>После подключения импорта здесь появятся КП с датами, поставщиками, версиями и исходными Excel-файлами.</p>
      </article>
      <article className="ved-module-panel">
        <h2>Состав предложений</h2>
        <p>Внутри каждого КП будут товары и расчётные варианты. Карточки расчётов будут открываться поверх реестра.</p>
      </article>
    </VedSectionIntro>
  );
}
