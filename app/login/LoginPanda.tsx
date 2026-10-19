"use client";

import { useEffect, useState } from "react";
import styles from "./LoginPanda.module.css";

const GREETINGS = [
  "Добро пожаловать! Я уже подготовил серьёзный вид. Осталось заняться делами.",
  "Приветствую! Всё под контролем. Ну, почти всё.",
  "Добро пожаловать! Я бы предложил отдохнуть, но мы оба знаем, зачем ты здесь.",
  "Рад встрече! Я уже проверил обстановку. Работа сама себя не сделала.",
  "Рад тебя видеть! У меня всё записано. Даже то, о чём некоторые предпочли бы забыть.",
  "Привет! Я уже на рабочем месте. Преимущества отсутствия трудового договора.",
] as const;

const FONT_OPTIONS = [
  { value: "nunito", label: "Nunito Sans", family: '"Nunito Sans", sans-serif' },
  { value: "onest", label: "Onest", family: '"Onest", sans-serif' },
  { value: "manrope", label: "Manrope", family: '"Manrope", sans-serif' },
  { value: "montserrat", label: "Montserrat Alternates", family: '"Montserrat Alternates", sans-serif' },
] as const;

type FontChoice = (typeof FONT_OPTIONS)[number]["value"];

const STARTS = [
  "Добро пожаловать!",
  "Приветствую!",
  "Рад встрече!",
  "Рад тебя видеть!",
  "Привет!",
];

export default function LoginPanda() {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [font, setFont] = useState<FontChoice>("nunito");
  const [imageFallback, setImageFallback] = useState(false);

  useEffect(() => {
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  }, []);

  const family = FONT_OPTIONS.find((entry) => entry.value === font)?.family
    ?? FONT_OPTIONS[0].family;
  const introduction = greeting && STARTS.find((start) => greeting.startsWith(start));
  const rest = greeting && introduction
    ? greeting.slice(introduction.length).trimStart()
    : greeting;

  return (
    <aside className={styles.assistant} aria-label="Помощник WorkSpace">
      <div className={styles.bubble}>
        <p
          className={greeting ? styles.phraseVisible : styles.phraseHidden}
          style={{ fontFamily: family }}
          aria-live="off"
        >
          {introduction ? (
            <>
              <strong>{introduction}</strong>{" "}{rest}
            </>
          ) : (greeting ?? "\u00a0")}
        </p>
        <label className={styles.fontPicker}>
          <span>Шрифт</span>
          <select
            value={font}
            onChange={(event) => setFont(event.target.value as FontChoice)}
            aria-label="Сравнить шрифты приветствия"
          >
            {FONT_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <img
        className={styles.panda}
        src={imageFallback ? "/panda/login-panda.webp" : "/panda/login-panda-approved.webp"}
        onError={() => setImageFallback(true)}
        alt="Красная панда машет лапой и держит папку «Сотрудники»"
        width={820}
        height={1108}
        decoding="async"
      />
    </aside>
  );
}
