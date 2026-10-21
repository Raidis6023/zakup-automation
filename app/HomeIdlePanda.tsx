"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./HomeIdlePanda.module.css";

type Phrase = { title: string; text: string };

// Только согласованные фразы для режима ожидания WorkSpace.
const PHRASES: readonly Phrase[] = [
  { title: "Маленький совет!", text: "Если задача решилась сама собой, лучше не выяснять, каким образом. Иногда чудеса нужно беречь." },
  { title: "Трудимся, коллеги!", text: "Кто-то работает с таблицами, кто-то с документами, а кто-то профессионально сидит на стуле." },
  { title: "Важное объявление!", text: "Никаких важных объявлений. Просто хотел убедиться, что ты ещё обращаешь на меня внимание." },
  { title: "Рабочая мудрость дня!", text: "Если всё идёт по плану, возможно, ты просто ещё не видел обновлённый план." },
  { title: "На связи!", text: "Если понадобится помощь, я здесь. Если не понадобится, я тоже здесь. Удобно устроился." },
  { title: "Я не бездельничаю!", text: "Это стратегическое наблюдение за деятельностью компании из сидячего положения." },
  { title: "Немного мотивации!", text: "Любая большая задача начинается с маленькой. Обычно с той, которую никто не хотел делать." },
  { title: "Как дела, коллега?", text: "Надеюсь, всё хорошо. А если нет, предлагаю хотя бы сделать вид, что ситуация под контролем." },
  { title: "Запомни главное!", text: "Работа не волк. Но иногда рычит очень убедительно." },
  { title: "Пока ты работаешь, я отдыхаю!", text: "Шучу, конечно. Я обеспечиваю моральную поддержку. Это ответственная должность." },
  { title: "Маленькое улучшение!", text: "Однажды я решил потратить пять минут, чтобы навести порядок. Потом неделю разбирался, куда этот порядок подевался." },
  { title: "Стремимся к совершенству!", text: "Хочется, чтобы всё выглядело как в дорогой корпорации, а не как панель управления космическим холодильником." },
  { title: "Любопытство полезно!", text: "Но иногда за желание узнать, что делает незнакомая кнопка, приходится расплачиваться половиной рабочего дня." },
  { title: "Интересная закономерность!", text: "Иногда вчерашние результаты меняются после наступления завтра. У нашего прошлого явно собственные планы." },
  { title: "Цифры опять спорят!", text: "В одном месте одно, в другом другое. А виноваты, как обычно, Excel, техника и фазы Луны одновременно." },
  { title: "Всё спокойно!", text: "Даже интерфейс перестал предупреждать об опасности так, будто сейчас начнётся эвакуация всего офиса." },
  { title: "Вопрос к дизайнерам!", text: "Почему иногда текст выглядит так, будто его писали исключительно для муравьёв с хорошим зрением?" },
  { title: "Необычная архитектура!", text: "Иногда рабочие процессы превращаются в такую пирамиду, что хочется вызвать экскурсовода и начать продавать билеты." },
  { title: "Технологии развиваются!", text: "А человеку всё ещё приходится самому нажимать кнопки. Цивилизация явно не завершена." },
  { title: "Каждому своё!", text: "Одна задача короткая, другая растянулась на неделю, а третья вообще живёт своей жизнью. Кажется, у нас филиал анархии." },
  { title: "Маленькая просьба!", text: "Не нажимай незнакомые кнопки просто из любопытства. Человечество и без того достаточно экспериментирует на рабочем месте." },
  { title: "Красота и порядок!", text: "Главное, чтобы наше рабочее пространство не превратилось в доску с магнитами после землетрясения." },
  { title: "Держимся, коллеги!", text: "Пусть хотя бы техника сегодня поработает нормально, раз уж у людей и без неё достаточно приключений." },
  { title: "Моя должность ответственная!", text: "Ответственность колоссальная, полномочий примерно ноль. Но зато какой костюм!" },
  { title: "Я официально на посту!", text: "Слежу за порядком, поддерживаю сотрудников и поднимаю настроение. Зарплату, разумеется, мне никто не согласовывал." },
  { title: "Совет дня! Всегда уточняйте!", text: "Потому что фраза «А я думал, ты понял иначе» уже разрушила больше рабочих планов, чем любой понедельник." },
];

const FADE_MS = 380;
const MIN_DELAY_MS = 30_000;
const MAX_DELAY_MS = 45_000;

function shuffleIndices(exclude: number): number[] {
  const indices = Array.from({ length: PHRASES.length }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[other]] = [indices[other], indices[index]];
  }
  // pop() берёт последний элемент: не повторяем последнюю фразу прошлого цикла.
  if (indices[indices.length - 1] === exclude && indices.length > 1) {
    [indices[0], indices[indices.length - 1]] =
      [indices[indices.length - 1], indices[0]];
  }
  return indices;
}

export default function HomeIdlePanda() {
  const [phraseIndex, setPhraseIndex] = useState(4);
  const [visible, setVisible] = useState(true);
  const queueRef = useRef<number[]>([]);
  const currentRef = useRef(4);

  useEffect(() => {
    let rotationTimer: ReturnType<typeof setTimeout>;
    let fadeTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const rotate = () => {
      setVisible(false);
      fadeTimer = setTimeout(() => {
        if (cancelled) return;
        if (queueRef.current.length === 0) {
          queueRef.current = shuffleIndices(currentRef.current);
        }
        const next = queueRef.current.pop() ?? 4;
        currentRef.current = next;
        setPhraseIndex(next);
        setVisible(true);
        schedule();
      }, FADE_MS);
    };

    const schedule = () => {
      rotationTimer = setTimeout(
        rotate,
        MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)),
      );
    };

    schedule();
    return () => {
      cancelled = true;
      clearTimeout(rotationTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  const phrase = PHRASES[phraseIndex];

  return (
    <aside className={styles.assistant} aria-label="Панда-помощник WorkSpace">
      <div className={styles.speech}>
        <p className={visible ? styles.phraseVisible : styles.phraseHidden}>
          <strong>{phrase.title}</strong>{" "}{phrase.text}
        </p>
      </div>
      <Image
        className={styles.panda}
        src="/panda/workspace-idle-panda.avif"
        alt="Улыбающаяся красная панда в чёрном костюме сидит на высоком стуле"
        width={390}
        height={520}
        unoptimized
        draggable={false}
      />
    </aside>
  );
}
