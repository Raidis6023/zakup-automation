import PageHeader from "../../../ui/PageHeader";
import RatesEditorClient from "../RatesEditorClient";
import "../financier.css";
export const dynamic="force-dynamic";
export default function FinanceSettings() {
  return <main className="ozf-page">
    <PageHeader variant="financier" title="Цена закупа, ТК Маяк и КМ" description="Здесь хранятся тарифы и ответственные менеджеры. Импорт Excel и ручные изменения влияют на финансовый результат." />
    <RatesEditorClient />
  </main>;
}