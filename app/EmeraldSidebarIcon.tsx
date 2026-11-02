"use client";

type Kind =
  | "list"
  | "box"
  | "globe"
  | "calculator"
  | "ozon"
  | "wb"
  | "ym"
  | "orders"
  | "offers"
  | "registry"
  | "documents"
  | "references";

export default function EmeraldSidebarIcon({ kind }: { kind: Kind }) {
  if (kind === "ozon" || kind === "wb" || kind === "ym") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none">
        <rect x="3.3" y="3.3" width="25.4" height="25.4" rx="6" stroke="currentColor" strokeWidth="1.8" />
        <text
          x="16"
          y="19.7"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize={kind === "ozon" ? 8.3 : kind === "wb" ? 12 : 11}
          fontWeight="800"
          fontFamily="Arial, sans-serif"
        >
          {kind === "ozon" ? "OZON" : kind === "wb" ? "WB" : "ЯМ"}
        </text>
      </svg>
    );
  }

  if (kind === "list") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <path d="M12 9h15M12 16h15M12 23h15" />
        <circle fill="currentColor" stroke="none" cx="6" cy="9" r="1.4" />
        <circle fill="currentColor" stroke="none" cx="6" cy="16" r="1.4" />
        <circle fill="currentColor" stroke="none" cx="6" cy="23" r="1.4" />
      </svg>
    );
  }

  if (kind === "box") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M16 3 28 10 28 23 16 30 4 23 4 10Z" />
        <path d="M4 10 16 17 28 10M16 17v13" />
      </svg>
    );
  }

  if (kind === "globe") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="16" cy="16" r="13" />
        <path d="M3 16h26M16 3c-7 7-7 19 0 26M16 3c7 7 7 19 0 26" />
      </svg>
    );
  }

  if (kind === "offers") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none">
        <text
          x="16"
          y="24"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize="24"
          fontWeight="500"
          fontFamily="Arial, sans-serif"
        >
          ¥
        </text>
      </svg>
    );
  }

  if (kind === "registry") {
    return (
      <svg
        className="emerald-sidebar-glyph"
        viewBox="0 0 32 32"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 9h13M14 16h13M14 23h13" />
        <circle cx="9" cy="9" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="16" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="9" cy="23" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (kind === "orders") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 4.5h10l5 5V27H9z" />
        <path d="M19 4.5v5h5" />
        <path d="M13 14.5h7M13 18.5h7M13 22.5h4.5" />
      </svg>
    );
  }

  if (kind === "documents") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.5 13V8.5a2 2 0 0 1 2-2h6.8l3.1 3.5h9.1a2 2 0 0 1 2 2V13" />
        <path d="M4.5 13h23l-3.2 12H7.5z" />
      </svg>
    );
  }

  if (kind === "references") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 5.5h10.5a4 4 0 0 1 4 4V24H10a4 4 0 0 0-4 .5z" />
        <path d="M6 5.5V25a4 4 0 0 1 4-4h10.5" />
        <path d="M10 10h6.5M10 13.5h6.5" />
        <circle cx="22" cy="21.5" r="3" />
        <path d="m24.2 23.7 2.7 2.7" />
      </svg>
    );
  }

  return (
    <svg className="emerald-sidebar-glyph" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="2.7" width="22" height="26.6" rx="4" />
      <rect x="9" y="7" width="14" height="5.3" rx="1.1" />
      <path strokeLinecap="round" d="M10 17h2M17 17h2M23 17h.1M10 22h2M17 22h2M23 22h.1" />
    </svg>
  );
}
