"use client";

import Link from "next/link";

import {
  useId,
  useState,
  type ReactNode,
} from "react";

import styles
from "./WorkspaceCollapsiblePanel.module.css";


export type WorkspaceCollapsibleTone =
  | "general"
  | "ozon"
  | "wildberries"
  | "yandex";


export type WorkspaceCollapsibleIcon =
  | "daily"
  | "unlinked"
  | "finance"
  | "vedOrders"
  | "newProducts";


function PanelIcon({
  name,
}: {
  name:
    WorkspaceCollapsibleIcon;
}) {

  if (
    name ===
      "daily"
  ) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect
          x="3.5"
          y="3"
          width="12"
          height="17"
          rx="2"
        />
        <path d="M7 7h5M7 10.5h5M7 14h3" />
        <circle
          cx="17"
          cy="16"
          r="4"
        />
        <path d="M17 13.8V16l1.6 1" />
      </svg>
    );

  }


  if (
    name ===
      "unlinked"
  ) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect
          x="3.5"
          y="3.5"
          width="12"
          height="16"
          rx="2"
        />
        <path d="M7 8h5M7 11.5h5M7 15h3" />
        <circle
          cx="17"
          cy="16"
          r="3.5"
        />
        <path d="m19.5 18.5 2 2" />
      </svg>
    );

  }


  if (
    name ===
      "finance"
  ) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M4 19V13M9 19V10M14 19V7M19 19V4" />
        <path d="m4 9 5-3 4 1.5L20 3" />
        <path d="m17 3h3v3" />
      </svg>
    );

  }


  if (
    name ===
      "vedOrders"
  ) {

    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M6 3.5h9l3 3v14H6z" />
        <path d="M15 3.5v4h4" />
        <path d="M9 10h6M9 14h6M9 18h4" />
      </svg>
    );

  }


  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="8"
      />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );

}


export default function WorkspaceCollapsiblePanel({
  tone,
  icon,
  title,
  subtitle,
  meta,
  actionHref,
  actionLabel,
  initialExpanded =
    true,
  className,
  children,
}: {
  tone:
    WorkspaceCollapsibleTone;

  icon:
    WorkspaceCollapsibleIcon;

  title:
    string;

  subtitle?:
    string;

  meta?:
    string;

  actionHref?:
    string;

  actionLabel?:
    string;

  initialExpanded?:
    boolean;

  className?:
    string;

  children:
    ReactNode;
}) {

  const [
    expanded,
    setExpanded,
  ] =
    useState(
      initialExpanded
    );


  const id =
    useId();


  const contentId =
    `workspace-collapsible-${id.replaceAll(":", "")}`;


  function toggle() {

    setExpanded(
      current =>
        !current
    );

  }


  return (
    <section
      className={
        [
          "section",
          styles.panel,
          styles[
            `tone_${tone}`
          ],
          className,
        ]
          .filter(
            Boolean
          )
          .join(
            " "
          )
      }
    >

      <div
        className={
          styles.header
        }

        role="button"

        tabIndex={0}

        aria-expanded={
          expanded
        }

        aria-controls={
          contentId
        }

        onClick={
          toggle
        }

        onKeyDown={
          event => {

            if (
              event.key ===
                "Enter"
              ||
              event.key ===
                " "
            ) {

              event.preventDefault();

              toggle();

            }

          }
        }
      >

        <span
          className={
            styles.icon
          }

          aria-hidden="true"
        >
          <PanelIcon
            name={
              icon
            }
          />
        </span>


        <span
          className={
            styles.copy
          }
        >

          <strong
            className={
              styles.title
            }
          >
            {title}
          </strong>


          {
            subtitle
              ? (
                <span
                  className={
                    styles.subtitle
                  }
                >
                  {subtitle}
                </span>
              )
              : null
          }

        </span>


        {
          meta
            ? (
              <span
                className={
                  styles.meta
                }
              >
                {meta}
              </span>
            )
            : null
        }


        {
          actionHref
          &&
          actionLabel
            ? (
              <Link
                href={
                  actionHref
                }

                className={
                  `secondary-button ${styles.action}`
                }

                onClick={
                  event =>
                    event.stopPropagation()
                }

                onKeyDown={
                  event =>
                    event.stopPropagation()
                }
              >
                {actionLabel}
              </Link>
            )
            : null
        }

      </div>


      {
        expanded
          ? (
            <div
              id={
                contentId
              }

              className={
                styles.body
              }
            >
              {children}
            </div>
          )
          : null
      }

    </section>
  );

}
