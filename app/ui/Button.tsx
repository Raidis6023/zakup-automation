import type { ComponentProps } from "react";
import styles from "./Button.module.css";

type Props = ComponentProps<"button"> & {
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
};

export default function Button({
  variant = "primary",
  fullWidth = false,
  type = "button",
  className,
  ...props
}: Props) {
  return (
    <button
      {...props}
      type={type}
      className={[styles.control, variant === "secondary" ? styles.secondary : "",
        fullWidth ? styles.fullWidth : "", className].filter(Boolean).join(" ")}
    />
  );
}
