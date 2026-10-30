import VedSectionIntro from "../VedSectionIntro";
import VedTariffEditor from "./VedTariffEditor";

export default function VedReferencesPage() {
  return (
    <VedSectionIntro title="Справочники ВЭД" description="Единые тарифы, даты действия и история редакций для первоначальных расчётов.">
      <VedTariffEditor/>
    </VedSectionIntro>
  );
}
