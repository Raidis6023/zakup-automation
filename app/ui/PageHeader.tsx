import ThemeToggle from "../ThemeToggle";
import styles from "./PageHeader.module.css";

/**
 * One shared page heading structure for the workspace.
 * Visual distinctions are expressed only as variants, not duplicated JSX.
 * Breadcrumbs and decorative stripes are rendered by WorkspaceShell.
 */
type Variant = "ozon" | "wildberries" | "yandex-market" | "zakup";

const variants = {
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
  variant,
  title,
  description,
}: {
  variant: Variant;
  title: string;
  description: string;
}) {
  const config = variants[variant];

  return (
    <header className={config.root}>
      <div className={classNames(config.titleArea, styles.titleArea)}>
        <div className={styles.copy}>
          <h1 className={config.heading}>{title}</h1>
          <p className={classNames(config.description, styles.description)}>
            {description}
          </p>
        </div>
      </div>

      <div className={classNames(config.actions, styles.actions)}>
        {config.showThemeToggle ? <ThemeToggle /> : null}
      </div>
    </header>
  );
}
