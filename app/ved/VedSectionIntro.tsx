import type { ReactNode } from "react";
import PageHeader from "../ui/PageHeader";
import Link from "next/link";
import "./ved-sections.css";

export default function VedSectionIntro({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="page ved-reference-page ved-module-page">
      <div className="container">
        <PageHeader
          variant="ved"
          title={title}
          description={description}
          showThemeToggle={false}
        />
        {actions && <div className="ved-module-toolbar">{actions}</div>}
        <section className="ved-module-content">
          {children}
        </section>
        <p className="ved-module-footer">
          Документы, исходные предложения и сохранённые расчёты ВЭД доступны в соответствующих разделах.{" "}
          <Link href="/orders">Перейти к заказам</Link>
        </p>
      </div>
    </main>
  );
}
