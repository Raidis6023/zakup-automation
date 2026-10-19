export function HomeBellIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
      />


      <path
        d="M10 21h4"
      />

    </svg>

  );

}


export function HomeTasksIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      {/* Планшет / чек-лист */}

      <rect
        x="5"
        y="4"
        width="14"
        height="17"
        rx="2.2"
      />


      <path
        d="
          M9 4
          V3.5
          C9 2.7 9.7 2 10.5 2
          H13.5
          C14.3 2 15 2.7 15 3.5
          V4
        "
      />


      {/* Галочка и строки внутри планшета */}

      <rect
        x="7.5"
        y="8"
        width="4"
        height="4"
        rx="1"
      />


      <path
        d="m8.4 10 1 1 1.8-2"
      />


      <path
        d="M13.2 8.8H16.8"
      />


      <path
        d="M13.2 11.2H16.2"
      />

    </svg>

  );

}
