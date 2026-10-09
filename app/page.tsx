
import WorkspaceDecoration from "./WorkspaceDecoration";

// ============================================================
// ГЛАВНАЯ СТРАНИЦА WORKSPACE
// ============================================================

export default function Home() {
  return (
    <section aria-label="Главная страница">

      {/* ЗАГОЛОВОК И ДЕКОРАТИВНЫЕ ПОЛОСЫ */}

      <div className="home-title-row">

        <div>
          <h1>
            Главная страница
          </h1>

          <p>
            Основные рабочие пространства
            и быстрый доступ к разделам системы
          </p>
        </div>

        <WorkspaceDecoration />

      </div>

      {/* ПУСТАЯ РАБОЧАЯ ОБЛАСТЬ */}

      <div className="home-empty-space" />

    </section>
  );
}
