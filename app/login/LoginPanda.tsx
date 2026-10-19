"use client";
import { useEffect, useState } from "react";
import styles from "./LoginPanda.module.css";

type Mode = "login" | "access" | "blocked";

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

const BLOCKED_GREETINGS = [
  "Привет! Я бы рад тебя пропустить, но система говорит, что пока нельзя. А спорить с системой мне не разрешают.",
  "Извини, сегодня без WorkSpace. Не переживай, это не моё решение. Я вообще здесь больше для красоты.",
  "Твой доступ заблокирован. Я бы с удовольствием всё исправил, но меня даже к настройкам не подпускают. И правильно, наверное.",
  "Ситуация неловкая… Ты хочешь войти, я хочу помочь, а система против. Похоже, нужен кто-то с полномочиями посерьёзнее моих.",
  "Кажется, доступ временно закрыт. Мне очень жаль. Давай доверим этот вопрос Администраторам, у них кнопок побольше.",
  "Похоже, твоя учётная запись заблокирована. Я проверил всё, что мог. Правда, мои возможности немного ограничены наличием лап.",
  "Я бы открыл тебе дверь в WorkSpace, но ключи, оказывается, выдают не пандам. Обратись к Администратору.",
  "Мне поручили встречать сотрудников, а не расстраивать их. Но сегодня, похоже, придётся: доступ заблокирован. Администратор поможет разобраться.",
  "Вот ведь ситуация… Костюм есть, папка есть, серьёзное выражение мордочки тоже. А полномочий разблокировать тебя нет.",
] as const;

const STARTS = [
  "Добро пожаловать!", "Приветствую!", "Рад встрече!", "Рад тебя видеть!", "Привет!",
  "Хочешь к нам присоединиться?", "Посмотрим…", "Любопытно…", "Хм…",
  "Надеюсь, ты умеешь ждать.",
  "Извини, сегодня без WorkSpace.",
  "Твой доступ заблокирован.",
  "Ситуация неловкая…",
  "Кажется, доступ временно закрыт.",
  "Похоже, твоя учётная запись заблокирована.",
  "Я бы открыл тебе дверь в WorkSpace,",
  "Мне поручили встречать сотрудников, а не расстраивать их.",
  "Вот ведь ситуация…",
];

export default function LoginPanda({ mode }: { mode: Mode }) {
  const [greeting, setGreeting] = useState<string | null>(null);
  const [imageFallback, setImageFallback] = useState(false);

  useEffect(() => {
    const pool = mode === "access" ? ACCESS_GREETINGS : mode === "blocked" ? BLOCKED_GREETINGS : LOGIN_GREETINGS;
    setGreeting(pool[Math.floor(Math.random() * pool.length)]);
    setImageFallback(false);
  }, [mode]);

  const introduction = greeting && STARTS.find(part => greeting.startsWith(part));
  const rest = greeting && introduction ? greeting.slice(introduction.length).trimStart() : greeting;
  const src = mode === "access"
    ? (imageFallback ? "/panda/login-panda-approved.webp" : "/panda/access-panda.webp?v=20261019-2")
    : mode === "blocked"
      ? (imageFallback ? "/panda/login-panda-approved.webp" : "/panda/blocked-panda.webp?v=20261019-1")
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
          : mode === "blocked"
            ? "Грустная красная панда разводит лапой и держит папку «Сотрудники»"
            : "Красная панда приветственно машет лапой и держит папку «Сотрудники»"}
        width={mode === "access" ? 820 : 820}
        height={mode === "login" ? 1108 : 1093}
        decoding="async"
      />
    </aside>
  );
}
