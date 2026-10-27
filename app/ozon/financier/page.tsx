import Link from "next/link";
import FinancierClient from "./FinancierClient";
import PerformanceConnectionClient from "./PerformanceConnectionClient";
import "./financier.css";

export const dynamic = "force-dynamic";

export default function OzonFinancierPage() {
  return (
    <main className="ozf-page">
      <header className="ozf-heading">
        <div>
          <Link href="/ozon" className="ozf-back">← Ozon</Link>
          <div className="ozf-eyebrow">ИИ-АГЕНТ / ФИНАНСЫ / OZON</div>
          <h1>Финансист Ozon</h1>
          
        </div>
        
      </header>
      <div className="ozf-toolbar"><Link href="/ozon/financier/settings" className="ozf-btn">Настройки: цена закупа, ТК Маяк, КМ и импорт Excel</Link></div>
      <PerformanceConnectionClient />
      <FinancierClient />
    </main>
  );
}
