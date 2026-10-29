import PageHeader from "../../ui/PageHeader";
import WbFinancierClient from "./WbFinancierClient";
import "../../ozon/financier/financier.css";

export const dynamic = "force-dynamic";

export default function WildberriesFinancierPage() {
  return (
    <main className="ozf-page">
      <PageHeader
        variant="financier"
        title="ИИ-финансист Wildberries"
        description="Доходы, расходы и детализация по артикулам. Прибыль появится после загрузки справочников."
      />
      <div className="ozf-toolbar">
        <span className="ozf-guard">Режим аудита · без изменений в WB</span>
      </div>
      <WbFinancierClient />
    </main>
  );
}
