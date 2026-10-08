"use client";

import {
  FormEvent,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "../../lib/supabase/client";


type ProfileFormProps = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
};


type SaveStatus =
  | "idle"
  | "success"
  | "error";


export default function ProfileForm({
  userId,
  firstName,
  lastName,
  email,
}: ProfileFormProps) {

  const router =
    useRouter();


  const [
    currentFirstName,
    setCurrentFirstName,
  ] =
    useState(
      firstName
    );


  const [
    currentLastName,
    setCurrentLastName,
  ] =
    useState(
      lastName
    );


  const [
    savedFirstName,
    setSavedFirstName,
  ] =
    useState(
      firstName.trim()
    );


  const [
    savedLastName,
    setSavedLastName,
  ] =
    useState(
      lastName.trim()
    );


  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );


  const [
    saveStatus,
    setSaveStatus,
  ] =
    useState<
      SaveStatus
    >(
      "idle"
    );


  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState(
      ""
    );


  const normalizedFirstName =
    currentFirstName.trim();


  const normalizedLastName =
    currentLastName.trim();


  const hasChanges =
    useMemo(
      () => {

        return (
          normalizedFirstName !==
            savedFirstName
          ||
          normalizedLastName !==
            savedLastName
        );

      },
      [
        normalizedFirstName,
        normalizedLastName,
        savedFirstName,
        savedLastName,
      ]
    );


  function handleFirstNameChange(
    value: string
  ) {

    setCurrentFirstName(
      value
    );


    setSaveStatus(
      "idle"
    );


    setErrorMessage(
      ""
    );

  }


  function handleLastNameChange(
    value: string
  ) {

    setCurrentLastName(
      value
    );


    setSaveStatus(
      "idle"
    );


    setErrorMessage(
      ""
    );

  }


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault();


    if (
      saving
    ) {

      return;

    }


    if (
      normalizedFirstName.length <
        1
    ) {

      setSaveStatus(
        "error"
      );


      setErrorMessage(
        "Укажите имя"
      );


      return;

    }


    if (
      normalizedLastName.length <
        1
    ) {

      setSaveStatus(
        "error"
      );


      setErrorMessage(
        "Укажите фамилию"
      );


      return;

    }


    if (
      normalizedFirstName.length >
        100
      ||
      normalizedLastName.length >
        100
    ) {

      setSaveStatus(
        "error"
      );


      setErrorMessage(
        "Имя и фамилия не должны быть длиннее 100 символов"
      );


      return;

    }


    if (
      !hasChanges
    ) {

      return;

    }


    setSaving(
      true
    );


    setSaveStatus(
      "idle"
    );


    setErrorMessage(
      ""
    );


    try {

      const supabase =
        createClient();


      const {
        error,
      } =
        await supabase
          .from(
            "app_profiles"
          )
          .update(
            {
              first_name:
                normalizedFirstName,

              last_name:
                normalizedLastName,
            }
          )
          .eq(
            "id",
            userId
          );


      if (
        error
      ) {

        console.error(
          "Ошибка сохранения профиля:",
          error
        );


        setSaveStatus(
          "error"
        );


        setErrorMessage(
          "Не удалось сохранить изменения"
        );


        return;

      }


      setCurrentFirstName(
        normalizedFirstName
      );


      setCurrentLastName(
        normalizedLastName
      );


      setSavedFirstName(
        normalizedFirstName
      );


      setSavedLastName(
        normalizedLastName
      );


      setSaveStatus(
        "success"
      );


      router.refresh();

    } catch (
      error
    ) {

      console.error(
        "Ошибка сохранения профиля:",
        error
      );


      setSaveStatus(
        "error"
      );


      setErrorMessage(
        "Не удалось сохранить изменения"
      );

    } finally {

      setSaving(
        false
      );

    }

  }


  return (

    <form
      className=
        "profile-form"

      onSubmit={
        handleSubmit
      }
    >

      <div
        className=
          "profile-edit-grid"
      >

        <div
          className=
            "profile-edit-field"
        >

          <label
            htmlFor=
              "profile-first-name"
          >
            Имя
          </label>


          <input
            id=
              "profile-first-name"

            className=
              "profile-input"

            type="text"

            value={
              currentFirstName
            }

            maxLength={
              100
            }

            autoComplete=
              "given-name"

            disabled={
              saving
            }

            onChange={
              event =>
                handleFirstNameChange(
                  event
                    .currentTarget
                    .value
                )
            }
          />

        </div>


        <div
          className=
            "profile-edit-field"
        >

          <label
            htmlFor=
              "profile-last-name"
          >
            Фамилия
          </label>


          <input
            id=
              "profile-last-name"

            className=
              "profile-input"

            type="text"

            value={
              currentLastName
            }

            maxLength={
              100
            }

            autoComplete=
              "family-name"

            disabled={
              saving
            }

            onChange={
              event =>
                handleLastNameChange(
                  event
                    .currentTarget
                    .value
                )
            }
          />

        </div>


        <div
          className="
            profile-edit-field
            profile-edit-field-full
          "
        >

          <label
            htmlFor=
              "profile-email"
          >
            Email
          </label>


          <input
            id=
              "profile-email"

            className=
              "profile-input"

            type="email"

            value={
              email
            }

            disabled
            readOnly
          />


          <span
            className=
              "profile-readonly-hint"
          >
            Изменение email подключим
            отдельным безопасным сценарием.
          </span>

        </div>

      </div>


      <div
        className=
          "profile-form-footer"
      >

        <div
          className={
            saveStatus ===
              "success"

              ? `
                  profile-form-status
                  profile-form-status-success
                `

              : saveStatus ===
                  "error"

                ? `
                    profile-form-status
                    profile-form-status-error
                  `

                : "profile-form-status"
          }
          aria-live="polite"
        >

          {
            saveStatus ===
              "success"

              ? "Изменения сохранены"

              : saveStatus ===
                  "error"

                ? errorMessage

                : ""
          }

        </div>


        <button
          type="submit"

          className=
            "profile-save-button"

          disabled={
            saving
            ||
            !hasChanges
          }
        >
          {
            saving

              ? "Сохраняем..."

              : "Сохранить"
          }
        </button>

      </div>

    </form>

  );

}
