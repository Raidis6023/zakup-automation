"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import { createPortal } from "react-dom";

const MAX_BYTES = 25 * 1024 * 1024;
const EXCEL_EXTENSIONS = /\.(xlsx|xls|xlsm)$/i;

type LocalPreview = {
  name: string;
  size: number;
  sheets: string[];
};

/**
 * First stage of the VED import flow: deliberate, local validation and preview.
 * No data is sent to a server until a reviewed, permission-aware import backend
 * and archival schema are implemented.
 */
export default function VedOfferUploadDialog() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<LocalPreview | null>(null);
  const [error, setError] = useState("");
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

  const selectFile = useCallback(async (file: File | undefined) => {
    setPreview(null);
    setError("");
    if (!file) return;
    if (!EXCEL_EXTENSIONS.test(file.name)) {
      setError("Выберите документ Excel (.xlsx, .xls или .xlsm).");
      return;
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      setError("Размер файла должен быть от 1 байта до 25 МБ.");
      return;
    }
    setLoading(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", bookSheets: true });
      const sheets = workbook.SheetNames ?? [];
      if (!sheets.length) throw new Error("Не удалось обнаружить листы Excel.");
      setPreview({ name: file.name, size: file.size, sheets });
    } catch {
      setError("Файл не удалось прочитать. Проверьте, что он не повреждён и имеет формат Excel.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void selectFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void selectFile(event.dataTransfer.files?.[0]);
  };

  const onZoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.current?.click();
    }
  };

  return (
    <>
      <button
        className="ved-offer-upload-launch"
        type="button"
        onClick={() => {
          setOpen(true);
          setPreview(null);
          setError("");
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
        </svg>
        Загрузить КП
      </button>
      {mounted && open && createPortal(
        <div className="ved-upload-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <div className="ved-upload-dialog" role="dialog" aria-modal="true" aria-labelledby="ved-upload-title">
            <div className="ved-upload-head">
              <div>
                <h2 id="ved-upload-title">Загрузить коммерческое предложение</h2>
                <p>Выберите один Excel-файл. Каждый лист будет обнаружен автоматически.</p>
              </div>
              <button
                type="button"
                className="ved-upload-close"
                aria-label="Закрыть окно"
                ref={closeButton}
                onClick={() => setOpen(false)}
              >×</button>
            </div>
            <input
              ref={fileInput}
              className="ved-upload-file-input"
              type="file"
              accept=".xlsx,.xls,.xlsm"
              onChange={onFileChange}
              aria-label="Выберите коммерческое предложение Excel"
            />
            <div
              className={`ved-upload-drop-zone${dragging ? " ved-upload-drop-zone--dragging" : ""}`}
              role="button"
              tabIndex={0}
              aria-label="Перетащите Excel или нажмите, чтобы выбрать файл"
              onClick={() => fileInput.current?.click()}
              onKeyDown={onZoneKeyDown}
              onDragOver={event => { event.preventDefault(); setDragging(true); }}
              onDragLeave={event => { event.preventDefault(); setDragging(false); }}
              onDrop={onDrop}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 3h9l5 5v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm9 0v5h5M8 15l3 3 5-6" />
              </svg>
              <strong>{loading ? "Проверяем Excel…" : "Перетащите файл сюда"}</strong>
              <span>или нажмите на эту область, чтобы выбрать файл с компьютера</span>
              <small>XLSX, XLS, XLSM · до 25 МБ</small>
            </div>
            {error && <p className="ved-upload-error" role="alert">{error}</p>}
            {preview && (
              <div className="ved-upload-preview" role="status">
                <strong>{preview.name}</strong>
                <span>{(preview.size / 1024 / 1024).toFixed(2)} МБ · листов: {preview.sheets.length}</span>
                <small>{preview.sheets.slice(0, 6).join(" · ")}
                  {preview.sheets.length > 6 ? ` · ещё ${preview.sheets.length - 6}` : ""}
                </small>
              </div>
            )}
            <p className="ved-upload-disclaimer">
              Сейчас файл проверяется только на вашем компьютере.
              Сохранение КП в реестр и автоматический перенос расчётов подключим отдельным этапом.
            </p>
            <div className="ved-upload-footer">
              <button type="button" onClick={() => setOpen(false)}>Закрыть</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
