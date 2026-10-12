"use client";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import styles
  from "./WorkspaceModeSwitcher.module.css";


function WorkIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <rect
        x="4"
        y="7"
        width="16"
        height="12"
        rx="2"
      />


      <path
        d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
      />


      <path
        d="M4 11h16"
      />

    </svg>

  );

}


function AdminIcon() {

  return (

    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <path
        d="
          M12 3
          19 6
          v5
          c0 4.8-2.8 8-7 10
          -4.2-2-7-5.2-7-10V6z
        "
      />


      <path
        d="m9.5 12 1.7 1.7 3.5-3.7"
      />

    </svg>

  );

}


export default function WorkspaceModeSwitcher() {

  const pathname =
    usePathname()
    ??
    "/";


  const router =
    useRouter();


  const adminMode =
    pathname ===
      "/admin"
    ||
    pathname.startsWith(
      "/admin/"
    );


  function handleSwitchMode() {

    if (
      adminMode
    ) {

      const previousPath =
        window
          .sessionStorage
          .getItem(
            "workspace-last-work-path"
          );


      const safePreviousPath =
        previousPath
        &&
        previousPath.startsWith(
          "/"
        )
        &&
        !previousPath.startsWith(
          "/admin"
        )

          ? previousPath

          : "/";


      router.push(
        safePreviousPath
      );


      return;

    }


    window
      .sessionStorage
      .setItem(
        "workspace-last-work-path",
        pathname
      );


    router.push(
      "/admin"
    );

  }


  return (

    <button
      type="button"

      className={
        adminMode

          ? `
              ${styles.modeButton}
              ${styles.modeButtonAdmin}
            `

          : styles.modeButton
      }

      onClick={
        handleSwitchMode
      }

      aria-label={
        adminMode

          ? "Переключиться в рабочий режим"

          : "Переключиться в режим администрирования"
      }

      title={
        adminMode

          ? "Вернуться в рабочий режим"

          : "Перейти в администрирование"
      }
    >

      <span
        className={
          styles.modeIcon
        }
      >

        {
          adminMode

            ? <AdminIcon />

            : <WorkIcon />
        }

      </span>


      <span
        className={
          styles.modeLabel
        }
      >

        {
          adminMode

            ? "Администрирование"

            : "Рабочий режим"
        }

      </span>

    </button>

  );

}
