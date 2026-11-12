import Link from "next/link";
import styles from "./Breadcrumbs.module.css";

export type BreadcrumbItem = {
  label: string;
  href: string;
  shortLabel?: string;
};

export default function Breadcrumbs({
  items,
}: {
  items: readonly BreadcrumbItem[];
}) {
  if (items.length === 0) return null;

  return (
    <nav className={styles.root} aria-label="Хлебные крошки">
      <ol className={styles.list}>
        {items.map((item, index) => {
          const current = index === items.length - 1;

          return (
            <li
              className={[styles.item, current ? styles.current : ""].filter(Boolean).join(" ")}
              key={item.href + ":" + index}
            >
              {index > 0 && (
                <svg
                  className={styles.chevron}
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <path d="m6 3.5 4.5 4.5L6 12.5" />
                </svg>
              )}
              <Link
                href={item.href}
                className={styles.link}
                aria-current={current ? "page" : undefined}
              >
                <span className={styles.fullLabel}>{item.label}</span>
                {item.shortLabel && (
                  <span className={styles.shortLabel}>{item.shortLabel}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
