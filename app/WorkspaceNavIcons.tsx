import styles
  from "./WorkspaceNavIcons.module.css";


// ============================================================
// СПИСОК АРТИКУЛОВ
// ДВЕ КАРТОЧКИ КАТАЛОГА
// ============================================================

export function ArticleListIcon() {

  return (

    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`
        ${styles.icon}
        ${styles.articleList}
      `}
    >

      <defs>

        <linearGradient
          id="article-list-background"
          x1="7"
          y1="5"
          x2="58"
          y2="59"
          gradientUnits="userSpaceOnUse"
        >

          <stop
            offset="0%"
            stopColor=
              "var(--article-bg-start)"
          />

          <stop
            offset="100%"
            stopColor=
              "var(--article-bg-end)"
          />

        </linearGradient>


        <linearGradient
          id="article-list-card"
          x1="12"
          y1="18"
          x2="51"
          y2="51"
          gradientUnits="userSpaceOnUse"
        >

          <stop
            offset="0%"
            stopColor=
              "var(--article-card-start)"
          />

          <stop
            offset="100%"
            stopColor=
              "var(--article-card-end)"
          />

        </linearGradient>

      </defs>


      {/* ФОН */}

      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15"
        fill=
          "url(#article-list-background)"
      />


      {/* ЗАДНЯЯ КАРТОЧКА */}

      <path
        d="
          M23 16
          C23 13.8 24.8 12 27 12
          H47
          C49.2 12 51 13.8 51 16
          V36
          C51 38.2 49.2 40 47 40
          H27
          C24.8 40 23 38.2 23 36
          Z
        "
        fill=
          "url(#article-list-card)"
        opacity="0.94"
        transform="rotate(8 37 26)"
      />


      {/* ПЕРЕДНЯЯ КАРТОЧКА */}

      <rect
        x="10"
        y="23"
        width="40"
        height="28"
        rx="7"
        fill=
          "url(#article-list-card)"
      />


      {/* ПРЕВЬЮ */}

      <rect
        x="15"
        y="29"
        width="11"
        height="14"
        rx="3"
        fill=
          "var(--article-detail-soft)"
      />


      {/* СТРОКИ */}

      <rect
        x="30"
        y="30"
        width="14"
        height="4"
        rx="2"
        fill=
          "var(--article-detail)"
      />

      <rect
        x="30"
        y="37"
        width="16"
        height="4"
        rx="2"
        fill=
          "var(--article-detail)"
      />

    </svg>

  );

}


// ============================================================
// ЗАКУП
// ТРИ КОРОБКИ ТРЕУГОЛЬНИКОМ
// ============================================================

export function ProcurementIcon() {

  return (

    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`
        ${styles.icon}
        ${styles.procurement}
      `}
    >

      <defs>

        <linearGradient
          id="procurement-background"
          x1="8"
          y1="5"
          x2="56"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >

          <stop
            offset="0%"
            stopColor=
              "var(--icon-bg-start)"
          />

          <stop
            offset="100%"
            stopColor=
              "var(--icon-bg-end)"
          />

        </linearGradient>

      </defs>


      {/* ФОН */}

      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15"
        fill=
          "url(#procurement-background)"
      />


      {/* ВЕРХНЯЯ КОРОБКА */}

      <g>

        <path
          d="
            M32 10
            L43 16
            L32 22
            L21 16
            Z
          "
          fill=
            "var(--icon-main)"
        />

        <path
          d="
            M21 16
            L32 22
            L32 34
            L21 28
            Z
          "
          fill=
            "var(--icon-main)"
        />

        <path
          d="
            M32 22
            L43 16
            L43 28
            L32 34
            Z
          "
          fill=
            "var(--icon-side)"
        />

        <path
          d="
            M28.6 12
            L31.2 10.6
            L42.1 16.5
            L39.5 17.9
            Z
          "
          fill=
            "var(--icon-accent)"
        />

      </g>


      {/* НИЖНЯЯ ЛЕВАЯ КОРОБКА */}

      <g>

        <path
          d="
            M17 29
            L28 35
            L17 41
            L6 35
            Z
          "
          fill=
            "var(--icon-main)"
        />

        <path
          d="
            M6 35
            L17 41
            L17 53
            L6 47
            Z
          "
          fill=
            "var(--icon-main)"
        />

        <path
          d="
            M17 41
            L28 35
            L28 47
            L17 53
            Z
          "
          fill=
            "var(--icon-side)"
        />

        <path
          d="
            M13.5 31
            L16.1 29.6
            L27.1 35.5
            L24.5 36.9
            Z
          "
          fill=
            "var(--icon-accent)"
        />

      </g>


      {/* НИЖНЯЯ ПРАВАЯ КОРОБКА */}

      <g>

        <path
          d="
            M47 29
            L58 35
            L47 41
            L36 35
            Z
          "
          fill=
            "var(--icon-main)"
        />

        <path
          d="
            M36 35
            L47 41
            L47 53
            L36 47
            Z
          "
          fill=
            "var(--icon-main)"
        />

        <path
          d="
            M47 41
            L58 35
            L58 47
            L47 53
            Z
          "
          fill=
            "var(--icon-side)"
        />

        <path
          d="
            M43.5 31
            L46.1 29.6
            L57.1 35.5
            L54.5 36.9
            Z
          "
          fill=
            "var(--icon-accent)"
        />

      </g>

    </svg>

  );

}


// ============================================================
// ВЭД
// ГЛОБУС + КРУГОВЫЕ СТРЕЛКИ
// ============================================================

export function VedIcon() {

  return (

    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`
        ${styles.icon}
        ${styles.ved}
      `}
    >

      <defs>

        {/* ФОН */}

        <linearGradient
          id="ved-background"
          x1="7"
          y1="5"
          x2="57"
          y2="59"
          gradientUnits="userSpaceOnUse"
        >

          <stop
            offset="0%"
            stopColor=
              "var(--ved-bg-start)"
          />

          <stop
            offset="48%"
            stopColor=
              "var(--ved-bg-middle)"
          />

          <stop
            offset="100%"
            stopColor=
              "var(--ved-bg-end)"
          />

        </linearGradient>


        {/* ЛЁГКИЙ БЛИК */}

        <linearGradient
          id="ved-highlight"
          x1="12"
          y1="5"
          x2="40"
          y2="35"
          gradientUnits="userSpaceOnUse"
        >

          <stop
            offset="0%"
            stopColor=
              "var(--ved-highlight)"
          />

          <stop
            offset="100%"
            stopColor=
              "rgba(255,255,255,0)"
          />

        </linearGradient>

      </defs>


      {/* =====================================================
          ФОН
          ===================================================== */}

      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15"
        fill=
          "url(#ved-background)"
      />


      {/* ЛЁГКИЙ ГЛЯНЦЕВЫЙ БЛИК */}

      <path
        d="
          M8 10
          C18 3
          39 3
          54 10
          C42 13
          22 14
          8 10
          Z
        "
        fill=
          "url(#ved-highlight)"
      />


      {/* =====================================================
          ГЛОБУС
          ===================================================== */}

      <g
        fill="none"
        stroke=
          "var(--ved-symbol)"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >

        {/* КРУГ */}

        <circle
          cx="32"
          cy="31"
          r="16"
        />


        {/* ВЕРТИКАЛЬНЫЕ МЕРИДИАНЫ */}

        <path
          d="
            M32 15
            C25.5 20
            24 26
            24 31
            C24 36
            25.5 42
            32 47
          "
        />

        <path
          d="
            M32 15
            C38.5 20
            40 26
            40 31
            C40 36
            38.5 42
            32 47
          "
        />


        {/* ГОРИЗОНТАЛЬНЫЕ ЛИНИИ */}

        <path
          d="
            M18 24
            C26 27
            38 27
            46 24
          "
        />

        <path
          d="
            M18 38
            C26 35
            38 35
            46 38
          "
        />

      </g>


      {/* =====================================================
          ЛЕВАЯ СТРЕЛКА
          ===================================================== */}

      <path
        d="
          M14.5 39
          C9.5 35
          8.5 27
          12.5 21
        "
        fill="none"
        stroke=
          "var(--ved-symbol)"
        strokeWidth="3.8"
        strokeLinecap="round"
      />


      <path
        d="
          M8.5 22
          L13 17
          L14.5 24
          Z
        "
        fill=
          "var(--ved-symbol)"
      />


      {/* =====================================================
          ПРАВАЯ СТРЕЛКА
          ===================================================== */}

      <path
        d="
          M49.5 22
          C54.5 26
          55.5 34
          51.5 40
        "
        fill="none"
        stroke=
          "var(--ved-symbol)"
        strokeWidth="3.8"
        strokeLinecap="round"
      />


      <path
        d="
          M55.5 39
          L51 44
          L49.5 37
          Z
        "
        fill=
          "var(--ved-symbol)"
      />

    </svg>

  );

}


// ============================================================
// СОТРУДНИКИ
// КАРТОЧКА СОТРУДНИКА
// ============================================================

export function EmployeesIcon() {

  return (

    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={`
        ${styles.icon}
        ${styles.employees}
      `}
    >

      <defs>

        <linearGradient
          id="employees-background"
          x1="5"
          y1="4"
          x2="58"
          y2="59"
          gradientUnits="userSpaceOnUse"
        >

          <stop
            offset="0%"
            stopColor=
              "var(--icon-bg-start)"
          />

          <stop
            offset="100%"
            stopColor=
              "var(--icon-bg-end)"
          />

        </linearGradient>

      </defs>


      {/* ФОН */}

      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="15"
        fill=
          "url(#employees-background)"
      />


      {/* КАРТОЧКА */}

      <rect
        x="11"
        y="18"
        width="42"
        height="29"
        rx="5"
        fill=
          "var(--icon-card)"
      />


      {/* ГОЛОВА */}

      <circle
        cx="24"
        cy="29"
        r="5"
        fill=
          "var(--icon-detail)"
      />


      {/* ПЛЕЧИ */}

      <path
        d="
          M16.5 40
          C17.2 34.8
          20 32.5
          24 32.5
          C28 32.5
          30.8 34.8
          31.5 40
          Z
        "
        fill=
          "var(--icon-detail)"
      />


      {/* СТРОКИ */}

      <rect
        x="35"
        y="26"
        width="11"
        height="3"
        rx="1.5"
        fill=
          "var(--icon-detail)"
      />

      <rect
        x="35"
        y="32"
        width="11"
        height="3"
        rx="1.5"
        fill=
          "var(--icon-detail)"
      />

      <rect
        x="35"
        y="38"
        width="7"
        height="3"
        rx="1.5"
        fill=
          "var(--icon-detail)"
      />

    </svg>

  );

}
