"use client";

import {
  useState,
} from "react";


type SyncPhotosResponse = {
  ok: boolean;

  error?: string;

  order_id?: string;

  existing_items?: number;

  already_had_photo?: number;

  copied_from_product?: number;

  loaded_from_ozon?: number;

  missing_in_ozon?: number;

  missing_offer_id?: number;
};


export default function OzonPhotoSyncButton(
  {
    orderId,
  }:
  {
    orderId: string;
  }
) {

  const [
    loading,
    setLoading,
  ] =
    useState(
      false
    );


  const [
    error,
    setError,
  ] =
    useState(
      ""
    );


  const [
    result,
    setResult,
  ] =
    useState<SyncPhotosResponse | null>(
      null
    );


  async function syncPhotos() {

    setLoading(
      true
    );

    setError(
      ""
    );

    setResult(
      null
    );


    try {

      const response =
        await fetch(
          `/api/ved-orders/${orderId}/sync-photos`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",
          }
        );


      const data:
        SyncPhotosResponse =
          await response.json();


      if (
        !response.ok
        ||
        !data.ok
      ) {

        throw new Error(
          data.error
          ||
          "Не удалось загрузить фотографии из Ozon"
        );

      }


      setResult(
        data
      );


      // Даём пользователю увидеть результат,
      // затем обновляем всю страницу заказа,
      // чтобы исчезли блокеры «Нет фото».
      window.setTimeout(
        () => {

          window.location.reload();

        },
        1200
      );


    } catch (
      caughtError
    ) {

      setError(

        caughtError
        instanceof Error

          ? caughtError.message

          : "Неизвестная ошибка загрузки фотографий"

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
          "grid",

        gap:
          "10px",
      }}
    >

      <button
        type="button"

        className=
          "secondary-button"

        disabled={
          loading
        }

        onClick={
          () => {

            void syncPhotos();

          }
        }
      >

        {loading

          ? "Загружаем фото..."

          : "Загрузить фото из Ozon"}

      </button>


      {result && (

        <div
          className="reason-box"
        >

          <strong>
            Фотографии обработаны
          </strong>


          <div className="reason-text">

            Существующих товаров:{" "}

            <strong>
              {result.existing_items ?? 0}
            </strong>

          </div>


          <div className="reason-text">

            Уже были сохранены:{" "}

            <strong>
              {result.already_had_photo ?? 0}
            </strong>

          </div>


          <div className="reason-text">

            Взято из карточки товара:{" "}

            <strong>
              {result.copied_from_product ?? 0}
            </strong>

          </div>


          <div className="reason-text">

            Загружено из Ozon:{" "}

            <strong>
              {result.loaded_from_ozon ?? 0}
            </strong>

          </div>


          {(result.missing_in_ozon ?? 0) > 0 && (

            <div className="reason-text">

              Фото не найдено в Ozon:{" "}

              <strong>
                {result.missing_in_ozon}
              </strong>

            </div>

          )}


          {(result.missing_offer_id ?? 0) > 0 && (

            <div className="reason-text">

              Нет offer_id:{" "}

              <strong>
                {result.missing_offer_id}
              </strong>

            </div>

          )}

        </div>

      )}


      {error && (

        <div
          style={{
            color:
              "#d64545",

            fontWeight:
              600,
          }}
        >

          {error}

        </div>

      )}

    </div>

  );

}
