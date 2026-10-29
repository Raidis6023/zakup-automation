import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./Button.module.css";

type Props = ComponentProps<typeof Link> & {
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
};

// Navigation remains a real link: open-in-new-tab and keyboard behavior survive.
// Preserve secondary as the default for already migrated call sites.
export default function ButtonLink({
  variant = "secondary",
  fullWidth = false,
  className,
  ...props
}: Props) {
  return (
    <Link
      {...props}
      className={[
        styles.control,
        variant === "secondary" ? styles.secondary : "",
        fullWidth ? styles.fullWidth : "",
        className,
      ].filter(Boolean).join(" ")}
    />
  );
}
