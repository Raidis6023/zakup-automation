import Link from "next/link";
import RatesEditorClient from "../RatesEditorClient";
import "../financier.css";
export const dynamic="force-dynamic";
export default function FinanceSettings() {
  return <main className="ozf-page">
    <header className="ozf-heading"><div>
      <Link href="/ozon/financier" className="ozf-back">← Финансовые результаты</Link>
      <div className="ozf-eyebrow">СПРАВОЧНИК ФИНАНСИСТА OZON</div>
      <h1>Цена закупа, ТК Маяк и КМ</h1>
      <p>Здесь хранятся тарифы и ответственные менеджеры. Импорт Excel и ручные изменения влияют на финансовый результат.</p>
    </div></header>
    <RatesEditorClient />
  </main>;
}