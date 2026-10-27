import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./Button.module.css";

// Navigation remains a real link: open-in-new-tab and keyboard behavior survive.
export default function ButtonLink({ className, ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={[styles.control, styles.secondary, className].filter(Boolean).join(" ")}
    />
  );
}
