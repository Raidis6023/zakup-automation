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

export default function LoginPanda() {
  const [greeting, setGreeting] = useState<string | null>(null);
  useEffect(() => {
    setGreeting(GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  }, []);

  return (
    <aside className={styles.assistant} aria-label="Помощник WorkSpace">
      <div className={styles.bubble} aria-live="off">
        <p className={greeting ? styles.phraseVisible : styles.phraseHidden}>
          {greeting ?? "\u00a0"}
        </p>
      </div>
      <img
        className={styles.panda}
        src="/panda/login-panda.webp"
        alt="Красная панда в деловом костюме машет лапой и держит папку «Сотрудники»"
        width={390}
        height={528}
        decoding="async"
      />
    </aside>
  );
}
