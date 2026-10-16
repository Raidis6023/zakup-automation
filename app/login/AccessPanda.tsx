import styles from "./AccessPanda.module.css";

type AccessPandaProps = {
  success: boolean;
};

export default function AccessPanda({ success }: AccessPandaProps) {
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
      <img
        className={styles.character}
        src="/panda/red-panda-welcome.svg"
        alt="Красная панда в костюме-тройке машет лапой и проверяет список в папке"
        width={420}
        height={540}
        draggable={false}
      />
    </aside>
  );
}
