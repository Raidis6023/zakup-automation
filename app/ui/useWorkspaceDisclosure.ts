"use client";

import { useId, useState, type KeyboardEvent } from "react";

/**
 * The single disclosure contract for workspace panels and product sections.
 * Every new page visit starts closed; no localStorage or caller defaults.
 */
export function useWorkspaceDisclosure() {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const contentId = `workspace-disclosure-${id.replaceAll(":", "")}`;

  function toggle() {
    setExpanded(previous => !previous);
  }

  function onHeaderKeyDown(event: KeyboardEvent<HTMLElement>) {
    // Buttons and links inside a clickable panel header keep their own keys.
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }

  return { expanded, contentId, toggle, onHeaderKeyDown };
}
