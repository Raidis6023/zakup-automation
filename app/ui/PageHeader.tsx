import type { ReactNode } from "react";
import ThemeToggle from "../ThemeToggle";
import styles from "./PageHeader.module.css";

/**
 * One shared page heading structure for the workspace.
 * Visual distinctions are expressed only as variants, not duplicated JSX.
 * Breadcrumbs and decorative stripes are rendered by WorkspaceShell.
 */
type Variant = "default" | "home" | "admin" | "admin-users" | "profile" | "financier" | "sku-list" | "ved" | "ozon" | "wildberries" | "yandex-market" | "zakup";

const variants = {
  home: { root: "home-title-row", titleArea: "", heading: "", description: "", actions: "", showThemeToggle: false },
  admin: { root: "ws-page-heading ws-page-heading--admin", titleArea: "", heading: "ws-page-heading__title", description: "ws-page-heading__description", actions: "", showThemeToggle: false },
  "admin-users": { root: "admin-users-header", titleArea: "", heading: "", description: "", actions: "", showThemeToggle: false },
  profile: { root: "profile-header", titleArea: "", heading: "", description: "", actions: "", showThemeToggle: false },
  financier: { root: "header ozf-heading ws-page-heading", titleArea: "", heading: "title ws-page-heading__title", description: "subtitle ws-page-heading__description", actions: "header-actions", showThemeToggle: false },
  default: {
    root: "header",
    titleArea: "",
    heading: "title",
    description: "subtitle",
    actions: "header-actions",
    showThemeToggle: false,
  },
  "sku-list": {
    root: "header sku-list-header",
    titleArea: "",
    heading: "",
    description: "",
    actions: "header-actions sku-list-header-actions",
    showThemeToggle: false,
  },
  ved: {
    root: "header ved-header",
    titleArea: "ved-title-wrap",
    heading: "title",
    description: "subtitle",
    actions: "header-actions ved-header-actions",
    showThemeToggle: true,
  },
  ozon: {
    root: "header ozon-header",
    titleArea: "ozon-title-wrap ozon-title-wrap--text-only",
    heading: "title ozon-page-title",
    description: "subtitle ozon-page-subtitle",
    actions: "header-actions ozon-header-actions",
    showThemeToggle: true,
  },
  wildberries: {
    root: "header wb-header wb-page-header-sticky",
    titleArea: "wb-title-wrap wb-title-wrap--text-only",
    heading: "title wb-page-title",
    description: "subtitle wb-page-subtitle",
    actions: "header-actions wb-header-actions",
    showThemeToggle: true,
  },
  "yandex-market": {
    root: "header ym-header",
    titleArea: "",
    heading: "title",
    description: "subtitle",
    actions: "header-actions ym-header-actions",
    showThemeToggle: true,
  },
  zakup: {
    root: "zakup-v2-header",
    titleArea: "zakup-v2-title",
    heading: "title",
    description: "subtitle",
    actions: "zakup-v2-header-actions",
    showThemeToggle: false,
  },
} as const;

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

export default function PageHeader({
  variant = "default",
  title,
  description,
  eyebrow,
  eyebrowClassName,
  showThemeToggle,
  actions,
}: {
  variant?: Variant;
  title: string;
  description?: string;
  eyebrow?: string;
  eyebrowClassName?: string;
  showThemeToggle?: boolean;
  actions?: ReactNode;
}) {
  const config = variants[variant];

  return (
    <header className={config.root}>
      <div className={classNames(config.titleArea, styles.titleArea)}>
        <div className={styles.copy}>
          {eyebrow ? <div className={eyebrowClassName || "small-label"}>{eyebrow}</div> : null}
          <h1 className={config.heading}>{title}</h1>
          {description ? (
            <p className={classNames(
              config.description,
              styles.description,
              !["ozon", "wildberries", "yandex-market"].includes(variant) ? styles.descriptionWrap : "",
            )}>
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {((showThemeToggle ?? config.showThemeToggle) || actions) ? (
        <div className={classNames(config.actions, styles.actions)}>
          {(showThemeToggle ?? config.showThemeToggle) ? <ThemeToggle /> : null}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
