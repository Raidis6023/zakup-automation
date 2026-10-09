
import type { ReactNode } from "react";

import WorkspaceShell from "../WorkspaceShell";

export default function VedLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <WorkspaceShell module>
      {children}
    </WorkspaceShell>
  );
}
