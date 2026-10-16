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

  return (
    <aside className={styles.assistant} aria-label="Красная панда, помощник WorkSpace">
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

      {isPreviewMode && (
        <div className={styles.previewControls}>
          <label className={styles.previewPicker}>
            <span>Проверить SVG-анимацию</span>
            <input
              type="file"
              accept=".svg,image/svg+xml"
              onChange={handlePandaFile}
              aria-label="Загрузить SVG красной панды для предварительного просмотра"
            />
          </label>
          {previewFileName && (
            <span className={styles.previewFileName} title={previewFileName}>
              {previewFileName}
            </span>
          )}
          {fileError && <span className={styles.previewError} role="alert">{fileError}</span>}
        </div>
      )}

      <img
        key={previewUrl ?? "default"}
        className={styles.character}
        src={previewUrl ?? "/panda/red-panda-welcome.svg"}
        alt={previewUrl
          ? "Выбранная анимированная SVG-модель красной панды"
          : "Красная панда в костюме-тройке приветствует нового сотрудника"}
        width={809}
        height={1126}
        draggable={false}
      />
    </aside>
  );
}
