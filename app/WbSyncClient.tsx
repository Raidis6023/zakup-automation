"use client";

import {
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";


type Props = {

  endpoint:
    string;

  label:
    string;

  loadingLabel:
    string;

};


type ApiResult = {

  ok?:
    boolean;

  skipped?:
    boolean;

  message?:
    string;

  error?:
    unknown;

};


function getResultMessage(
  data:
    ApiResult | null,
  fallback:
    string
) {

  if (
    data
    &&
    typeof data.message ===
      "string"
    &&
    data.message.trim()
  ) {

    return data.message;

  }


  if (
    data
    &&
    typeof data.error ===
      "string"
    &&
    data.error.trim()
  ) {

    return data.error;

  }


  return fallback;

}


export default function WbSyncClient({
  endpoint,
  label,
  loadingLabel,
}: Props) {

  const router =
    useRouter();


  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    message,
    setMessage,
  ] =
    useState(
      ""
    );


  const [
    error,
    setError,
  ] =
    useState(
      false
    );


  async function runSync() {

    if (loading) {
      return;
    }


    setLoading(
      true
    );


    setMessage(
      ""
    );


    setError(
      false
    );


    try {

      const response =
        await fetch(
          endpoint,
          {
            method:
              "GET",

            cache:
              "no-store",
          }
        );


      const text =
        await response.text();


      let data:
        ApiResult | null =
        null;


      try {

        data =
          text
            ? JSON.parse(
                text
              ) as ApiResult
            : null;

      } catch {

        data =
          null;

      }


      if (
        !response.ok
        ||
        data?.ok === false
      ) {

        setError(
          true
        );


        setMessage(
          getResultMessage(
            data,
            `Ошибка HTTP ${response.status}`
          )
        );


        return;

      }


      setMessage(
        getResultMessage(
          data,
          data?.skipped
            ? "Обновление не потребовалось"
            : "Синхронизация завершена"
        )
      );


      router.refresh();

    } catch (
      syncError
    ) {

      setError(
        true
      );


      setMessage(
        syncError instanceof Error
          ? syncError.message
          : "Не удалось выполнить синхронизацию"
      );

    } finally {

      setLoading(
        false
      );

    }

  }


  return (

    <div
      style={{
        display:
          "flex",

        flexDirection:
          "column",

        alignItems:
          "flex-end",

        gap:
          "8px",
      }}
    >

      <button

        type="button"

        className=
          "primary-button"

        onClick={
          runSync
        }

        disabled={
          loading
        }

      >

        {
          loading
            ? loadingLabel
            : label
        }

      </button>


      {
        message
        &&
        (

          <div

            className=
              "muted"

            style={{
              maxWidth:
                "420px",

              textAlign:
                "right",

              color:
                error
                  ? "var(--text)"
                  : undefined,
            }}

          >

            {
              message
            }

          </div>

        )
      }

    </div>

  );

}
