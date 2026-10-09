
import type { ReactNode } from "react";

// ============================================================
// LAYOUT РАЗДЕЛА ВЭД
// ============================================================

// Общая оболочка WorkSpace подключается
// через app/layout.tsx.
//
// Дополнительная оболочка здесь больше
// не требуется.

export default function VedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}
