"use client";

import type {
  ChangeEvent,
} from "react";

import {
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/client";


type ProfileAvatarUploaderProps = {
  firstName: string;
  lastName: string;
  initialAvatarPath: string | null;
  initialAvatarUrl: string | null;
};


type AvatarStatus =
  | "idle"
  | "uploading"
  | "success"
  | "error";


const MAX_SOURCE_FILE_SIZE =
  10 * 1024 * 1024;


const MAX_STORED_FILE_SIZE =
  1024 * 1024;


const AVATAR_SIZE =
  256;


const ALLOWED_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);


function getInitials(
  firstName: string,
  lastName: string
) {

  const first =
    firstName
      .trim()
      .charAt(
        0
      );


  const last =
    lastName
      .trim()
      .charAt(
        0
      );


  return (
    `${first}${last}`
      .toUpperCase()
    ||
    "П"
  );

}


function loadImage(
  file: File
): Promise<HTMLImageElement> {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const objectUrl =
        URL.createObjectURL(
          file
        );


      const image =
        new Image();


      image.onload =
        () => {

          URL.revokeObjectURL(
            objectUrl
          );


          resolve(
            image
          );

        };


      image.onerror =
        () => {

          URL.revokeObjectURL(
            objectUrl
          );


          reject(
            new Error(
              "Не удалось прочитать изображение"
            )
          );

        };


      image.src =
        objectUrl;

    }
  );

}


async function prepareAvatar(
  file: File
): Promise<Blob> {

  const image =
    await loadImage(
      file
    );


  const sourceSize =
    Math.min(
      image.naturalWidth,
      image.naturalHeight
    );


  if (
    sourceSize < 1
  ) {

    throw new Error(
      "Изображение имеет некорректный размер"
    );

  }


  const sourceX =
    Math.floor(
      (
        image.naturalWidth
        -
        sourceSize
      )
      /
      2
    );


  const sourceY =
    Math.floor(
      (
        image.naturalHeight
        -
        sourceSize
      )
      /
      2
    );


  const canvas =
    document.createElement(
      "canvas"
    );


  canvas.width =
    AVATAR_SIZE;


  canvas.height =
    AVATAR_SIZE;


  const context =
    canvas.getContext(
      "2d"
    );


  if (
    !context
  ) {

    throw new Error(
      "Браузер не смог подготовить изображение"
    );

  }


  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE
  );


  const blob =
    await new Promise<Blob>(
      (
        resolve,
        reject
      ) => {

        canvas.toBlob(
          result => {

            if (
              !result
            ) {

              reject(
                new Error(
                  "Не удалось обработать изображение"
                )
              );


              return;

            }


            resolve(
              result
            );

          },
          "image/webp",
          0.82
        );

      }
    );


  if (
    blob.size >
      MAX_STORED_FILE_SIZE
  ) {

    throw new Error(
      "После обработки изображение всё ещё слишком большое"
    );

  }


  return blob;

}


export default function ProfileAvatarUploader({
  firstName,
  lastName,
  initialAvatarPath,
  initialAvatarUrl,
}: ProfileAvatarUploaderProps) {

  const router =
    useRouter();


  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );


  const [
    avatarPath,
    setAvatarPath,
  ] =
    useState<string | null>(
      initialAvatarPath
    );


  const [
    avatarUrl,
    setAvatarUrl,
  ] =
    useState<string | null>(
      initialAvatarUrl
    );


  const [
    status,
    setStatus,
  ] =
    useState<AvatarStatus>(
      "idle"
    );


  const [
    statusMessage,
    setStatusMessage,
  ] =
    useState(
      ""
    );


  const initials =
    getInitials(
      firstName,
      lastName
    );


  const busy =
    status ===
      "uploading";


  function openFilePicker() {

    if (
      busy
    ) {

      return;

    }


    fileInputRef.current
      ?.click();

  }


  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {

    const file =
      event.currentTarget
        .files
        ?.[0];


    event.currentTarget.value =
      "";


    if (
      !file
    ) {

      return;

    }


    if (
      !ALLOWED_TYPES.has(
        file.type
      )
    ) {

      setStatus(
        "error"
      );


      setStatusMessage(
        "Подойдут JPG, PNG или WebP"
      );


      return;

    }


    if (
      file.size >
        MAX_SOURCE_FILE_SIZE
    ) {

      setStatus(
        "error"
      );


      setStatusMessage(
        "Исходный файл должен быть не больше 10 МБ"
      );


      return;

    }


    setStatus(
      "uploading"
    );


    setStatusMessage(
      "Обрабатываем и загружаем фото..."
    );


    try {

      const preparedAvatar =
        await prepareAvatar(
          file
        );


      const supabase =
        createClient();


      const {
        data: {
          user,
        },
        error: userError,
      } =
        await supabase
          .auth
          .getUser();


      if (
        userError
        ||
        !user
      ) {

        throw new Error(
          "Сессия пользователя не найдена"
        );

      }


      const nextAvatarPath =
        `${user.id}/avatar-${Date.now()}.webp`;


      const {
        error: uploadError,
      } =
        await supabase
          .storage
          .from(
            "avatars"
          )
          .upload(
            nextAvatarPath,
            preparedAvatar,
            {
              contentType:
                "image/webp",

              cacheControl:
                "3600",

              upsert:
                false,
            }
          );


      if (
        uploadError
      ) {

        throw new Error(
          uploadError.message
        );

      }


      const {
        error: profileError,
      } =
        await supabase
          .from(
            "app_profiles"
          )
          .update(
            {
              avatar_path:
                nextAvatarPath,
            }
          )
          .eq(
            "id",
            user.id
          );


      if (
        profileError
      ) {

        await supabase
          .storage
          .from(
            "avatars"
          )
          .remove([
            nextAvatarPath,
          ]);


        throw new Error(
          profileError.message
        );

      }


      const {
        data: signedData,
        error: signedError,
      } =
        await supabase
          .storage
          .from(
            "avatars"
          )
          .createSignedUrl(
            nextAvatarPath,
            60 * 60
          );


      if (
        signedError
      ) {

        throw new Error(
          signedError.message
        );

      }


      const previousAvatarPath =
        avatarPath;


      setAvatarPath(
        nextAvatarPath
      );


      setAvatarUrl(
        signedData.signedUrl
      );


      if (
        previousAvatarPath
        &&
        previousAvatarPath !==
          nextAvatarPath
      ) {

        const {
          error: removeOldError,
        } =
          await supabase
            .storage
            .from(
              "avatars"
            )
            .remove([
              previousAvatarPath,
            ]);


        if (
          removeOldError
        ) {

          console.error(
            "Не удалось удалить старый аватар:",
            removeOldError
          );

        }

      }


      setStatus(
        "success"
      );


      setStatusMessage(
        "Фото профиля обновлено"
      );


      router.refresh();

    } catch (
      error
    ) {

      console.error(
        "Ошибка загрузки аватара:",
        error
      );


      setStatus(
        "error"
      );


      setStatusMessage(
        error instanceof Error

          ? error.message

          : "Не удалось загрузить фото"
      );

    }

  }


  async function handleRemoveAvatar() {

    if (
      busy
      ||
      !avatarPath
    ) {

      return;

    }


    setStatus(
      "uploading"
    );


    setStatusMessage(
      "Удаляем фото..."
    );


    try {

      const supabase =
        createClient();


      const {
        data: {
          user,
        },
        error: userError,
      } =
        await supabase
          .auth
          .getUser();


      if (
        userError
        ||
        !user
      ) {

        throw new Error(
          "Сессия пользователя не найдена"
        );

      }


      const pathToRemove =
        avatarPath;


      const {
        error: profileError,
      } =
        await supabase
          .from(
            "app_profiles"
          )
          .update(
            {
              avatar_path:
                null,
            }
          )
          .eq(
            "id",
            user.id
          );


      if (
        profileError
      ) {

        throw new Error(
          profileError.message
        );

      }


      const {
        error: removeError,
      } =
        await supabase
          .storage
          .from(
            "avatars"
          )
          .remove([
            pathToRemove,
          ]);


      if (
        removeError
      ) {

        console.error(
          "Не удалось удалить файл аватара:",
          removeError
        );

      }


      setAvatarPath(
        null
      );


      setAvatarUrl(
        null
      );


      setStatus(
        "success"
      );


      setStatusMessage(
        "Фото удалено"
      );


      router.refresh();

    } catch (
      error
    ) {

      console.error(
        "Ошибка удаления аватара:",
        error
      );


      setStatus(
        "error"
      );


      setStatusMessage(
        error instanceof Error

          ? error.message

          : "Не удалось удалить фото"
      );

    }

  }


  return (

    <div
      className=
        "profile-avatar-control"
    >

      <button
        type="button"

        className="
          profile-avatar
          profile-avatar-button
        "

        onClick={
          openFilePicker
        }

        disabled={
          busy
        }

        aria-label=
          "Изменить фото профиля"
      >

        {
          avatarUrl

            ? (

              <img
                src={
                  avatarUrl
                }

                alt=""

                className=
                  "profile-avatar-image"
              />

            )

            : initials
        }


        <span
          className=
            "profile-avatar-overlay"
        >
          {
            busy

              ? "..."

              : "Фото"
          }
        </span>

      </button>


      <input
        ref={
          fileInputRef
        }

        type="file"

        accept="image/jpeg,image/png,image/webp"

        className=
          "profile-avatar-input"

        onChange={
          handleFileChange
        }
      />


      <button
        type="button"

        className=
          "profile-avatar-change"

        onClick={
          openFilePicker
        }

        disabled={
          busy
        }
      >
        {
          avatarPath

            ? "Заменить фото"

            : "Добавить фото"
        }
      </button>


      {
        avatarPath
        &&
        (

          <button
            type="button"

            className=
              "profile-avatar-remove"

            onClick={
              handleRemoveAvatar
            }

            disabled={
              busy
            }
          >
            Удалить
          </button>

        )
      }


      {
        statusMessage
        &&
        (

          <span
            className={
              status ===
                "error"

                ? "profile-avatar-status profile-avatar-status-error"

                : status ===
                    "success"

                  ? "profile-avatar-status profile-avatar-status-success"

                  : "profile-avatar-status"
            }

            aria-live="polite"
          >
            {
              statusMessage
            }
          </span>

        )
      }

    </div>

  );

}
