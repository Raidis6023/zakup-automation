import Link from "next/link";
import FinancierClient from "./FinancierClient";
import RatesEditorClient from "./RatesEditorClient";
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
          <p>Начисления, расходы, сверка по товарам и анализ отклонений. Без придуманных показателей прибыли.</p>
        </div>
        <span className="ozf-guard">Режим аудита · без изменений в Ozon</span>
      </header>
      <RatesEditorClient />
      <FinancierClient />
    </main>
  );
}
