import Link from "next/link";
import WbFinancierClient from "./WbFinancierClient";
export const dynamic="force-dynamic";
export default function Page(){return <main style={{maxWidth:1600,margin:"0 auto",padding:"26px 12px"}}>
<Link href="/wildberries">← Wildberries</Link>
<h1>ИИ-финансист Wildberries</h1>
<p>Детализация по артикулам. Черновой режим аудита источников, без расчёта прибыли и без изменений в кабинете WB.</p>
<WbFinancierClient/>
</main>;}
