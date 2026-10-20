"use client";

import { useEffect, useState } from "react";
import styles from "../login/LoginPanda.module.css";

// The approved employee-pass pose is used only on the first-password screen.
// Keep the nine approved phrases unchanged.
const GREETINGS = [
  [
    "Проход разрешён!",
    "Ты уже почти свой. Остался последний шаг — не подведи на пароле."
  ],
  [
    "Пропуск на месте!",
    "Осталось только придумать пароль, который не стыдно показать службе безопасности."
  ],
  [
    "Доступ согласован!",
    "Поздравляю, бюрократия отступила. Осталось только оформить отношения с паролем."
  ],
  [
    "Проход открыт!",
    "Я бы уже махнул тебе через турникет, но сначала нужен новый пароль."
  ],
  [
    "Добро пожаловать на борт!",
    "Пропуск оформлен, доступ открыт, паника отменяется. Создавай пароль и заходи."
  ],
  [
    "Доступ подтверждён!",
    "Даже я немного горжусь этой бюрократической победой. Теперь придумай новый пароль."
  ],
  [
    "Проходной режим одобряет.",
    "Я, кстати, тоже. Осталось только создать пароль без банального “123456”."
  ],
  [
    "Теперь всё по-настоящему.",
    "Доступ открыт, роль назначена, осталось только придумать пароль и не потерять его в первый же день."
  ],
  [
    "Добро пожаловать!",
    "Формально ты уже почти наш человек. Неформально — станешь им сразу после создания пароля."
  ]
] as const;

export default function PasswordPanda() {
  const [index, setIndex] = useState<number | null>(null);

  // Choose once on mount, never while the employee types a password.
  useEffect(() => {
    setIndex(Math.floor(Math.random() * GREETINGS.length));
  }, []);

  const greeting = index === null ? null : GREETINGS[index];

  return (
    <aside className={styles.assistant} aria-label="Помощник WorkSpace">
      <div className={styles.bubble}>
        <p className={greeting ? styles.phraseVisible : styles.phraseHidden}>
          {greeting ? (
            <>
              <strong>{greeting[0]}</strong>{" "}{greeting[1]}
            </>
          ) : "\u00a0"}
        </p>
      </div>
      <img
        className={styles.panda}
        src="/panda/password-panda.webp?v=20261020-1"
        width={820}
        height={1093}
        alt="Радостная красная панда в костюме показывает пропуск с зелёной галочкой и держит папку «Сотрудники»"
        decoding="async"
      />
    </aside>
  );
}
