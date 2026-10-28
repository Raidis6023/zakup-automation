"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Breadcrumbs, { type BreadcrumbItem } from "./ui/Breadcrumbs";
import WorkspaceDecoration from "./WorkspaceDecoration";

/**
 * Keep breadcrumbs and stripes fixed without detaching them from the
 * workspace theme/accent CSS variables. The outer shell is not transformed,
 * so position: fixed remains anchored to the viewport while scrolling.
 */
export default function FixedWorkspaceBrand({
  items,
}: {
  items: BreadcrumbItem[];
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // document.body does not inherit --ws-decor-* / --ws-blue from .home-shell.
  // Portaling into the shell preserves one central palette for all modules.
  const shell = document.querySelector<HTMLElement>(".home-shell");
  if (!shell) return null;

  return createPortal(
    <div className="workspace-fixed-brand">
      <div className="workspace-fixed-path">
        <Breadcrumbs items={items} />
      </div>
      <div className="workspace-fixed-logo">
        <WorkspaceDecoration />
      </div>
    </div>,
    shell,
  );
}
