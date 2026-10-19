"use client";
import { useEffect, useState } from "react";
import styles from "./LoginPanda.module.css";

type Mode = "login" | "access";

const LOGIN_GREETINGS = [
  "Добро пожаловать! Я уже подготовил серьёзный вид. Осталось заняться делами.",
  "Приветствую! Всё под контролем. Ну, почти всё.",
  "Добро пожаловать! Я бы предложил отдохнуть, но мы оба знаем, зачем ты здесь.",
  "Рад встрече! Я уже проверил обстановку. Работа сама себя не сделала.",
  "Рад тебя видеть! У меня всё записано. Даже то, о чём некоторые предпочли бы забыть.",
  "Привет! Я уже на рабочем месте. Преимущества отсутствия трудового договора.",
] as const;

const ACCESS_GREETINGS = [
  "Привет! Не переживай, процедура простая. Даже я почти во всём разобрался.",
  "Хочешь к нам присоединиться? Отлично! Только сначала немного бюрократии. Совсем чуть-чуть.",
  "Посмотрим… В папке тебя пока нет. Зато у нас есть отличная форма для исправления этой ситуации.",
  "Любопытно… Новый человек, новая заявка. Надеюсь, хоть пароль не забудешь.",
  "Хм… Ещё один коллега? Придётся расширять мой список знакомых. И папку заодно.",
  "Надеюсь, ты умеешь ждать. Наши Администраторы иногда любят создавать интригу. Я бы, конечно, ускорил процесс, но моё мнение здесь почему-то никто не спрашивает. Хотя я даже костюм надел!",
] as const;

const STARTS = [
  "Добро пожаловать!", "Приветствую!", "Рад встрече!", "Рад тебя видеть!", "Привет!",
  "Хочешь к нам присоединиться?", "Посмотрим…", "Любопытно…", "Хм…",
  "Надеюсь, ты умеешь ждать.",
];

export default function LoginPanda({ mode }: { mode: Mode }) {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [imageFallback, setImageFallback] = useState(false);

  useEffect(() => {
    const pool = mode === "access" ? ACCESS_GREETINGS : LOGIN_GREETINGS;
    setGreeting(pool[Math.floor(Math.random() * pool.length)]);
    setImageFallback(false);
  }, [mode]);

  const introduction = greeting && STARTS.find(part => greeting.startsWith(part));
  const rest = greeting && introduction ? greeting.slice(introduction.length).trimStart() : greeting;
  const src = mode === "access"
    ? (imageFallback ? "/panda/login-panda-approved.webp" : "/panda/access-panda.webp")
    : (imageFallback ? "/panda/login-panda.webp" : "/panda/login-panda-approved.webp");

  return (
    <aside className={styles.assistant} aria-label="Помощник WorkSpace">
      <div className={styles.bubble}>
        <p className={greeting ? styles.phraseVisible : styles.phraseHidden} aria-live="off">
          {introduction ? <><strong>{introduction}</strong>{" "}{rest}</> : (greeting ?? "\u00a0")}
        </p>
      </div>
      <img
        className={styles.panda}
        src={src}
        onError={() => { if (!imageFallback) setImageFallback(true); }}
        alt={mode === "access"
          ? "Красная панда задумчиво изучает папку «Сотрудники», придерживая подбородок"
          : "Красная панда приветственно машет лапой и держит папку «Сотрудники»"}
        width={mode === "access" ? 820 : 820}
        height={mode === "access" ? 1147 : 1108}
        decoding="async"
      />
    </aside>
  );
}
