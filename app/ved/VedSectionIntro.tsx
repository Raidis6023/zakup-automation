import type { ReactNode } from "react";
import PageHeader from "../ui/PageHeader";
import Link from "next/link";
import "./ved-sections.css";

export default function VedSectionIntro({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="ved-module-page">
      <PageHeader variant="ved" title={title} description={description} />
      <section className="ved-module-content">
        {children}
      </section>
      <p className="ved-module-footer">
        Раздел подключён к общей навигации ВЭД. Данные и операции добавляются отдельно, без изменения существующих заказов.
        {" "}<Link href="/ved">Перейти к заказам</Link>
      </p>
    </main>
  );
}