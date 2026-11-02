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
      <svg className="emerald-sidebar-glyph" viewBox="0 0 96 96" aria-hidden="true" fill="currentColor" fillRule="evenodd">
        <path d="M41,13 30,17 23,22 19,27 13,39 12,52 16,64 27,76 38,81 51,82 64,78 71,73 77,66 82,54 82,40 76,27 69,20 63,16 54,13Z M41,18 55,18 64,22 73,31 77,41 77,54 73,63 67,70 56,76 43,77 38,76 30,72 23,65 18,55 17,46 18,45 18,40 22,31 31,22Z M32,28 31,32 40,45 39,46 34,46 33,51 43,53 42,55 34,55 33,60 42,60 43,61 43,68 45,70 49,70 51,69 51,61 52,60 61,60 62,59 61,55 52,55 51,52 52,51 53,52 54,51 55,52 56,51 60,52 62,50 61,46 56,46 55,44 63,33 64,29 63,28 57,28 47,43 40,30 38,28Z" />
      </svg>
    );
  }

  if (kind === "registry") {
    return (
      <svg className="emerald-sidebar-glyph" viewBox="0 0 96 96" aria-hidden="true" fill="currentColor" fillRule="evenodd">
        <path d="M41,9 31,12 23,17 13,28 8,41 8,55 13,67 24,79 33,84 41,86 53,86 61,84 69,80 80,70 87,55 87,41 82,28 71,16 62,11 55,9Z M44,14 57,15 70,22 77,30 80,36 82,44 81,56 76,66 66,75 54,80 41,80 30,76 19,66 15,59 13,51 14,39 19,29 28,20 36,16Z M40,61 40,64 43,66 66,66 69,64 69,60 66,58 58,58 57,59 56,58 44,58 41,59Z M30,58 27,61 27,63 29,66 32,67 36,64 36,60 33,58Z M40,47 40,50 42,52 68,52 69,51 69,47 67,45 43,45Z M32,44 29,45 27,48 27,50 30,53 34,53 36,51 36,47 35,45Z M40,34 40,37 43,39 67,39 69,37 69,33 67,32 42,32Z M30,31 27,36 29,39 33,40 36,37 36,34 35,32Z" />
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
