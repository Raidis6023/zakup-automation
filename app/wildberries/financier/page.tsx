import Link from "next/link";
import WbFinancierClient from "./WbFinancierClient";
import "../../ozon/financier/financier.css";
export const dynamic="force-dynamic";
export default function Page(){return <main className="ozf-page">
<header className="ozf-heading"><div><Link className="ozf-back" href="/wildberries">← Wildberries</Link><div className="ozf-eyebrow">ИИ-АГЕНТ / ФИНАНСЫ / WILDBERRIES</div><h1>ИИ-финансист Wildberries</h1><p>Доходы, расходы и детализация по артикулам. Прибыль появится после загрузки справочников.</p></div><span className="ozf-guard">Режим аудита · без изменений в WB</span></header>
<WbFinancierClient/>
</main>;}
