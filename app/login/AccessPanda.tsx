"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import styles from "./AccessPanda.module.css";

type AccessPandaProps = {
  success: boolean;
};

export default function AccessPanda({ success }: AccessPandaProps) {
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [animationRun, setAnimationRun] = useState(0);
  const currentObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    setIsPreviewMode(
      new URLSearchParams(window.location.search).get("panda_preview") === "1"
    );
    return () => {
      if (currentObjectUrl.current) URL.revokeObjectURL(currentObjectUrl.current);
    };
  }, []);

  function handlePandaFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (!file.name.toLowerCase().endsWith(".svg") || file.size > 1024 * 1024) {
      setFileError("Выберите SVG-файл размером не больше 1 МБ.");
      return;
    }

    if (currentObjectUrl.current) URL.revokeObjectURL(currentObjectUrl.current);
    const nextUrl = URL.createObjectURL(file);
    currentObjectUrl.current = nextUrl;
    setPreviewUrl(nextUrl);
    setPreviewFileName(file.name);
    setFileError(null);
  }

  // До утверждения новой модели никакой старой панды на обычном входе.
  if (!isPreviewMode) return null;

  return (
    <aside className={styles.assistant} aria-label="Предпросмотр красной панды WorkSpace">
      <div className={styles.bubble} role="status">
        {success ? (
          <p>
            <strong>Заявка отправлена!</strong> Теперь всё зависит от наших
            администраторов. Я за ними присмотрю.
          </p>
        ) : (
          <p>
            <strong>Новенький? Добро пожаловать!</strong>{" "}
            Не переживай, тут почти всё работает. Просто введи свои данные и
            надейся на моих Администраторов!
          </p>
        )}
      </div>

      <div className={styles.previewControls}>
        <label className={styles.previewPicker}>
          <span>{previewUrl ? "Выбрать другую SVG" : "Выбрать новую SVG-панду"}</span>
          <input
            type="file"
            accept=".svg,image/svg+xml"
            onChange={handlePandaFile}
            aria-label="Выбрать SVG красной панды для предпросмотра"
          />
        </label>
        {previewFileName && (
          <span className={styles.previewFileName} title={previewFileName}>
            {previewFileName}
          </span>
        )}
        {fileError && <span className={styles.previewError} role="alert">{fileError}</span>}
        {previewUrl && (
          <button
            type="button"
            className={styles.previewReplay}
            onClick={() => setAnimationRun((n) => n + 1)}
          >
            Повторить анимацию
          </button>
        )}
      </div>

      {previewUrl ? (
        <img
          key={`${previewUrl}-${animationRun}`}
          className={styles.character}
          src={previewUrl}
          alt="Новая анимированная SVG-модель красной панды"
          width={809}
          height={1126}
          draggable={false}
        />
      ) : (
        <div className={styles.previewPlaceholder} role="status">
          <span className={styles.previewPlaceholderIcon} aria-hidden="true">◎</span>
          <span>Старая панда отключена.</span>
          <span>Выберите файл panda_2d_suit_animated_web.svg, чтобы увидеть новую модель и её движения.</span>
        </div>
      )}
    </aside>
  );
}
