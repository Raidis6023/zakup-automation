"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";

const PART_BYTES = 50_000_000; // 50 decimal MB, deliberately not 50 MiB.
const MAX_FILE_BYTES = 500_000_000;
const MAX_FILES = 40;
const INSPECT_BYTES = 12_000_000;
const EXCEL_EXTENSIONS = /\.(xlsx|xls|xlsm)$/i;

type SelectedFile = {
  id: number;
  source: File;
  kp: string;
  state: "checking" | "ready" | "invalid";
  sheets: string[] | null;
  message: string;
};

type NamedPart = { label: string; from: number; to: number };

function canonicalKp(value: string) {
  const suffix = value.trim()
    .replace(/^КП[\s\-–—№#]*/i, "")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/^-+|-+$/g, "");
  return suffix ? "КП-" + suffix.slice(0, 64) : "";
}

function formattedSize(bytes: number) {
  return (bytes / 1_000_000).toFixed(2) + " МБ";
}

function validExcelSignature(signature: Uint8Array, name: string) {
  const zip = signature.length >= 4
    && signature[0] === 0x50 && signature[1] === 0x4b
    && signature[2] === 0x03 && signature[3] === 0x04;
  const ole = signature.length >= 8
    && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
      .every((byte, i) => signature[i] === byte);
  return /\.xls$/i.test(name) ? ole : zip;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Stage-one browser preparation only. Parts are byte-exact Blob slices of the
 * original Excel file. They are NOT independent Excel workbooks. No server
 * upload or archive is claimed until the permission-aware backend exists.
 */
export default function VedOfferUploadDialog() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<SelectedFile[]>([]);
  const [batchKp, setBatchKp] = useState("");
  const [error, setError] = useState("");
  const idCounter = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const prepared = useMemo(() => {
    const counters = new Map<string, number>();
    return rows.map(row => {
      const name = canonicalKp(row.kp);
      const numberOfParts = Math.ceil(row.source.size / PART_BYTES);
      const startIndex = name ? counters.get(name) ?? 0 : 0;
      if (name) counters.set(name, startIndex + numberOfParts);
      const parts: NamedPart[] = name && row.state === "ready"
        ? Array.from({ length: numberOfParts }, (_, index) => ({
            label: name + "-" + (startIndex + index + 1),
            from: index * PART_BYTES,
            to: Math.min(row.source.size, (index + 1) * PART_BYTES),
          }))
        : [];
      return { ...row, name, parts, numberOfParts };
    });
  }, [rows]);

  const totalPieces = prepared.reduce((sum, row) => sum + row.parts.length, 0);
  const validFiles = prepared.filter(row => row.state === "ready").length;

  async function inspectFile(entry: SelectedFile) {
    try {
      const signature = new Uint8Array(await entry.source.slice(0, 8).arrayBuffer());
      if (!validExcelSignature(signature, entry.source.name)) {
        throw new Error("Файл не похож на Excel указанного формата.");
      }
      let sheets: string[] | null = null;
      // Avoid decompressing 150 MB workbooks in the browser.
      if (entry.source.size <= INSPECT_BYTES) {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(await entry.source.arrayBuffer(), {
          type: "array",
          bookSheets: true,
        });
        sheets = workbook.SheetNames ?? [];
        if (!sheets.length) throw new Error("Листы Excel не обнаружены.");
      }
      setRows(previous => previous.map(row => row.id === entry.id
        ? { ...row, state: "ready", sheets, message: "" } : row));
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Не удалось проверить Excel.";
      setRows(previous => previous.map(row => row.id === entry.id
        ? { ...row, state: "invalid", message } : row));
    }
  }

  function addFiles(incoming: File[]) {
    if (!incoming.length) return;
    const eligible = incoming.filter(file =>
      EXCEL_EXTENSIONS.test(file.name) && file.size > 0 && file.size <= MAX_FILE_BYTES
    );
    const dropped = incoming.length - eligible.length;
    if (dropped) {
      setError("Пропущено файлов: " + dropped
        + ". Нужны Excel (.xlsx, .xls, .xlsm) размером до 500 МБ.");
    } else {
      setError("");
    }

    const occupied = new Set(rows.map(row =>
      [row.source.name, row.source.size, row.source.lastModified].join("|")
    ));
    const freeSlots = Math.max(0, MAX_FILES - rows.length);
    const additions: SelectedFile[] = [];
    for (const file of eligible) {
      const key = [file.name, file.size, file.lastModified].join("|");
      if (occupied.has(key)) continue;
      occupied.add(key);
      if (additions.length >= freeSlots) break;
      additions.push({
        id: ++idCounter.current,
        source: file,
        kp: batchKp,
        state: "checking",
        sheets: null,
        message: "",
      });
    }
    if (eligible.length > additions.length) {
      setError("Некоторые файлы уже выбраны либо превышен лимит очереди: 40 файлов.");
    }
    if (!additions.length) return;
    setRows(previous => [...previous, ...additions]);
    for (const entry of additions) void inspectFile(entry);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function onZoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.current?.click();
    }
  }

  function setFileKp(id: number, value: string) {
    setRows(previous => previous.map(row => row.id === id
      ? { ...row, kp: value } : row));
  }

  function exportManifest() {
    const sources = prepared.filter(row => row.parts.length).map(row => ({
      kp: row.name,
      originalFilename: row.source.name,
      originalSizeBytes: row.source.size,
      lastModified: row.source.lastModified,
      parts: row.parts.map(part => ({
        label: part.label,
        filename: part.label + ".part",
        offsetStart: part.from,
        offsetEnd: part.to,
        sizeBytes: part.to - part.from,
      })),
    }));
    if (!sources.length) {
      setError("Укажите номер КП для проверенного Excel-файла.");
      return;
    }
    const data = JSON.stringify({
      format: "ved-kp-chunks-v1",
      chunkSizeBytes: PART_BYTES,
      note: "Части .part не открываются как Excel. Для импорта требуется собрать исходный файл по манифесту.",
      sources,
    }, null, 2);
    downloadBlob(new Blob([data], { type: "application/json" }), "ved-kp-manifest.json");
  }

  return (
    <>
      <button className="ved-offer-upload-launch" type="button" onClick={() => {
        setOpen(true);
        setRows([]);
        setBatchKp("");
        setError("");
      }}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        Загрузить КП
      </button>
      {mounted && open && createPortal(
        <div className="ved-upload-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <div className="ved-upload-dialog" role="dialog" aria-modal="true"
            aria-labelledby="ved-upload-title">
            <div className="ved-upload-head">
              <div>
                <h2 id="ved-upload-title">Подготовить коммерческие предложения</h2>
                <p>Выберите несколько Excel-файлов или перенесите их в окно.</p>
              </div>
              <button type="button" className="ved-upload-close" ref={closeButton}
                aria-label="Закрыть окно" onClick={() => setOpen(false)}>×</button>
            </div>
            <input ref={fileInput} className="ved-upload-file-input" type="file"
              multiple accept=".xlsx,.xls,.xlsm" onChange={onFileChange}
              aria-label="Выберите Excel-файлы коммерческих предложений" />
            <div
              className={"ved-upload-drop-zone" + (dragging ? " ved-upload-drop-zone--dragging" : "")}
              role="button" tabIndex={0}
              aria-label="Перетащите Excel-файлы или нажмите для выбора"
              onClick={() => fileInput.current?.click()}
              onKeyDown={onZoneKeyDown}
              onDragOver={event => { event.preventDefault(); setDragging(true); }}
              onDragLeave={event => { event.preventDefault(); setDragging(false); }}
              onDrop={onDrop}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 3h9l5 5v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm9 0v5h5M8 15l3 3 5-6" />
              </svg>
              <strong>Перетащите Excel-файлы сюда</strong>
              <span>или нажмите, чтобы выбрать сразу несколько файлов</span>
              <small>XLSX, XLS, XLSM · до 500 МБ на файл · части по 50 МБ</small>
            </div>
            <div className="ved-upload-batch-row">
              <label htmlFor="ved-batch-kp">Общий номер КП (необязательно)</label>
              <div className="ved-upload-batch-controls">
                <input id="ved-batch-kp" type="text" value={batchKp}
                  onChange={event => setBatchKp(event.target.value)}
                  placeholder="КП-123" maxLength={70} />
                <button type="button" disabled={!rows.length} onClick={() =>
                  setRows(previous => previous.map(row => ({ ...row, kp: batchKp })))
                }>Применить ко всем</button>
              </div>
            </div>
            {error && <p className="ved-upload-error" role="alert">{error}</p>}
            {!!rows.length && (
              <section className="ved-upload-queue" aria-label="Очередь Excel-файлов">
                <div className="ved-upload-queue-title">
                  <strong>Выбрано: {rows.length}</strong>
                  <span>Проверено: {validFiles} · подготовлено частей: {totalPieces}</span>
                </div>
                {prepared.map(row => (
                  <article className="ved-upload-row" key={row.id}>
                    <div className="ved-upload-row-head">
                      <strong title={row.source.name}>{row.source.name}</strong>
                      <button type="button" className="ved-upload-remove"
                        aria-label={"Убрать " + row.source.name}
                        onClick={() => setRows(previous => previous.filter(item => item.id !== row.id))}>
                        Убрать
                      </button>
                    </div>
                    <span className="ved-upload-metadata">
                      {formattedSize(row.source.size)} · {row.state === "checking" ? "Проверяем…"
                        : row.state === "invalid" ? "Ошибка файла" : "Готов к подготовке"}
                      {row.sheets ? " · листов: " + row.sheets.length : ""}
                    </span>
                    {row.sheets && (
                      <small className="ved-upload-metadata">
                        {row.sheets.slice(0, 5).join(" · ")}
                        {row.sheets.length > 5 ? " · ещё " + (row.sheets.length - 5) : ""}
                      </small>
                    )}
                    {row.state === "ready" && !row.sheets && (
                      <small className="ved-upload-metadata">
                        Для большого файла пока проверена только сигнатура. Листы будут разобраны при импорте.
                      </small>
                    )}
                    {row.message && <small className="ved-upload-error">{row.message}</small>}
                    <label className="ved-upload-kp-field">
                      Номер КП
                      <input value={row.kp} placeholder="КП-123"
                        onChange={event => setFileKp(row.id, event.target.value)}
                        maxLength={70} />
                    </label>
                    {row.state === "ready" && (
                      row.parts.length ? (
                        <div className="ved-upload-parts">
                          {row.parts.map(part => (
                            <button key={part.label} type="button"
                              onClick={() => downloadBlob(
                                row.source.slice(part.from, part.to),
                                part.label + ".part"
                              )}>
                              {part.label} · {formattedSize(part.to - part.from)}
                            </button>
                          ))}
                        </div>
                      ) : <small className="ved-upload-metadata">Укажите номер КП для формирования частей.</small>
                    )}
                  </article>
                ))}
              </section>
            )}
            <p className="ved-upload-disclaimer">
              Части формируются локально, без изменения исходного Excel. Файлы .part
              не открываются отдельно в Excel. Для восстановления потребуется манифест.
              Пока ничего не отправляется на сервер и не сохраняется в реестр КП.
            </p>
            <div className="ved-upload-footer">
              <button type="button" disabled={!totalPieces}
                onClick={exportManifest}>Скачать манифест</button>
              <button type="button" onClick={() => setOpen(false)}>Закрыть</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
