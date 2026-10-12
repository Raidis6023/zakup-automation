import styles
  from "./WorkspaceNavIcons.module.css";


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
// КОНТЕЙНЕР + ЯРКИЙ ГЛОБУС
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

        <linearGradient
          id="ved-background"
          x1="7"
          y1="4"
          x2="57"
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
          "url(#ved-background)"
      />


      {/* ГЛОБУС НА ЗАДНЕМ ПЛАНЕ */}

      <g
        fill="none"
        stroke=
          "var(--icon-globe)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >

        <circle
          cx="32"
          cy="27"
          r="16"
        />

        <path
          d="
            M16 27
            H48
          "
        />

        <path
          d="
            M19.5 18.5
            C27 22
            37 22
            44.5 18.5
          "
        />

        <path
          d="
            M19.5 35.5
            C27 32
            37 32
            44.5 35.5
          "
        />

        <path
          d="
            M32 11
            C27 16
            25 21
            25 27
            C25 33
            27 38
            32 43
          "
        />

        <path
          d="
            M32 11
            C37 16
            39 21
            39 27
            C39 33
            37 38
            32 43
          "
        />

      </g>


      {/* КОНТЕЙНЕР */}

      <path
        d="
          M10 34
          L28 29
          L54 36
          L54 52
          L28 57
          L10 50
          Z
        "
        fill=
          "var(--icon-container)"
      />


      {/* РЁБРА КОНТЕЙНЕРА */}

      <g
        stroke=
          "var(--icon-container-detail)"
        strokeWidth="2"
        strokeLinecap="round"
      >

        <path d="M16 35.5V50" />
        <path d="M21 34V52" />
        <path d="M27 32V54" />

        <path d="M34 32V54" />
        <path d="M40 34V53" />
        <path d="M46 35V52" />
        <path d="M51 36V50" />

      </g>


      <path
        d="
          M28 29
          V57
        "
        stroke=
          "var(--icon-container-detail)"
        strokeWidth="2"
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
