import PageHeader from "../../ui/PageHeader";
import Link from "next/link";
import FinancierClient from "./FinancierClient";
import "./financier.css";
import "./campaigns.css";

export const dynamic = "force-dynamic";

export default function OzonFinancierPage() {
  return (
    <main className="ozf-page">
      <PageHeader variant="financier" title="Финансист Ozon" eyebrow="ИИ-АГЕНТ / ФИНАНСЫ / OZON" eyebrowClassName="ozf-eyebrow" />
      <div className="ozf-toolbar"><Link href="/ozon/financier/settings" className="ozf-btn">Настройки: цена закупа, ТК Маяк, КМ и импорт Excel</Link></div>
      <FinancierClient />
    </main>
  );
}
