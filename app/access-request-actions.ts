"use server";

import {
  randomInt,
} from "node:crypto";

import {
  createClient as createSessionClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";


// ============================================================
// ТИПЫ
// ============================================================

type WorkingRole =
  | "analyst"
  | "procurement"
  | "ved"
  | "category_manager"
  | "marketing"
  | "manager";


type CategoryMarketplace =
  | "ozon"
  | "wildberries"
  | "yandex_market";


type ApproveAccessRequestInput = {
  requestId: string;
  systemRole: string;
  categoryMarketplace: string | null;
};


export type ApproveAccessRequestResult =
  | {
      ok: true;
      email: string;
      fullName: string;
      temporaryPassword: string;
    }
  | {
      ok: false;
      error: string;
    };


export type RejectAccessRequestResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };


type AccessRequestRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
};


// ============================================================
// UUID
// ============================================================

function isUuid(
  value: string
) {

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  ).test(
    value
  );

}


// ============================================================
// РАБОЧАЯ РОЛЬ
// ============================================================

function isWorkingRole(
  value: string
): value is WorkingRole {

  switch (
    value
  ) {

    case "analyst":
    case "procurement":
    case "ved":
    case "category_manager":
    case "marketing":
    case "manager":

      return true;


    default:

      return false;

  }

}


// ============================================================
// МАРКЕТПЛЕЙС
// ============================================================

function isCategoryMarketplace(
  value: string
): value is CategoryMarketplace {

  switch (
    value
  ) {

    case "ozon":
    case "wildberries":
    case "yandex_market":

      return true;


    default:

      return false;

  }

}


// ============================================================
// ВРЕМЕННЫЙ ПАРОЛЬ
// ============================================================

function createTemporaryPassword() {

  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZ"
    +
    "abcdefghijkmnopqrstuvwxyz"
    +
    "23456789";


  let randomPart =
    "";


  for (
    let index = 0;
    index < 16;
    index += 1
  ) {

    randomPart +=
      alphabet[
        randomInt(
          0,
          alphabet.length
        )
      ];

  }


  return (
    `Ws9!${randomPart}`
  );

}


// ============================================================
// ПРОВЕРКА ТЕКУЩЕГО АДМИНИСТРАТОРА
// ============================================================

async function getCurrentAdminUserId():
Promise<
  | {
      ok: true;
      userId: string;
    }
  | {
      ok: false;
      error: string;
    }
> {

  const supabase =
    await createSessionClient();


  const {
    data: {
      user,
    },
    error:
      userError,
  } =
    await supabase
      .auth
      .getUser();


  if (
    userError
    ||
    !user
  ) {

    return {
      ok: false,
      error:
        "Требуется авторизация",
    };

  }


  const admin =
    createAdminClient();


  const {
    data:
      access,
    error:
      accessError,
  } =
    await admin
      .from(
        "app_user_access"
      )
      .select(
        "admin_level"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();


  if (
    accessError
  ) {

    console.error(
      "Ошибка проверки прав администратора:",
      accessError
    );


    return {
      ok: false,
      error:
        "Не удалось проверить права администратора",
    };

  }


  if (
    !access
    ||
    (
      access.admin_level !==
        "admin"
      &&
      access.admin_level !==
        "senior_admin"
    )
  ) {

    return {
      ok: false,
      error:
        "Недостаточно прав",
    };

  }


  return {
    ok: true,
    userId:
      user.id,
  };

}


// ============================================================
// ОДОБРЕНИЕ ЗАЯВКИ
// ============================================================

export async function approveAccessRequest(
  input:
    ApproveAccessRequestInput
):
Promise<ApproveAccessRequestResult> {

  // ==========================================================
  // 1. БАЗОВАЯ ВАЛИДАЦИЯ
  // ==========================================================

  const requestId =
    input.requestId.trim();


  const systemRole =
    input.systemRole.trim();


  const marketplaceRaw =
    input.categoryMarketplace
      ?.trim()
      ||
      null;


  if (
    !isUuid(
      requestId
    )
  ) {

    return {
      ok: false,
      error:
        "Некорректный ID заявки",
    };

  }


  if (
    !isWorkingRole(
      systemRole
    )
  ) {

    return {
      ok: false,
      error:
        "Не выбрана допустимая рабочая роль",
    };

  }


  let categoryMarketplace:
    CategoryMarketplace
    |
    null =
    null;


  if (
    systemRole ===
      "category_manager"
  ) {

    if (
      !marketplaceRaw
      ||
      !isCategoryMarketplace(
        marketplaceRaw
      )
    ) {

      return {
        ok: false,
        error:
          "Для категорийного менеджера необходимо выбрать маркетплейс",
      };

    }


    categoryMarketplace =
      marketplaceRaw;

  } else {

    categoryMarketplace =
      null;

  }


  // ==========================================================
  // 2. ПРОВЕРЯЕМ АДМИНИСТРАТОРА
  // ==========================================================

  const adminCheck =
    await getCurrentAdminUserId();


  if (
    !adminCheck.ok
  ) {

    return {
      ok: false,
      error:
        adminCheck.error,
    };

  }


  const reviewedBy =
    adminCheck.userId;


  const admin =
    createAdminClient();


  // ==========================================================
  // 3. ПОЛУЧАЕМ ЗАЯВКУ
  //
  // ВАЖНО:
  // select записан буквальной строкой.
  // Supabase TypeScript parser использует её для определения
  // полей результата.
  // ==========================================================

  const {
    data:
      requestData,
    error:
      requestError,
  } =
    await admin
      .from(
        "app_access_requests"
      )
      .select(
        "id,first_name,last_name,email,status"
      )
      .eq(
        "id",
        requestId
      )
      .maybeSingle();


  if (
    requestError
  ) {

    console.error(
      "Ошибка загрузки заявки:",
      requestError
    );


    return {
      ok: false,
      error:
        "Не удалось загрузить заявку",
    };

  }


  if (
    !requestData
  ) {

    return {
      ok: false,
      error:
        "Заявка не найдена",
    };

  }


  const request:
    AccessRequestRow =
    {
      id:
        requestData.id,

      first_name:
        requestData.first_name,

      last_name:
        requestData.last_name,

      email:
        requestData.email,

      status:
        requestData.status,
    };


  if (
    request.status !==
      "pending"
  ) {

    return {
      ok: false,
      error:
        "Заявка уже обработана",
    };

  }


  const email =
    request.email
      .trim()
      .toLowerCase();


  if (
    !email
  ) {

    return {
      ok: false,
      error:
        "В заявке отсутствует email",
    };

  }


  // ==========================================================
  // 4. СОЗДАЁМ ВРЕМЕННЫЙ ПАРОЛЬ
  // ==========================================================

  const temporaryPassword =
    createTemporaryPassword();


  // ==========================================================
  // 5. СОЗДАЁМ AUTH-ПОЛЬЗОВАТЕЛЯ
  //
  // email_confirm = true:
  // подтверждение через почту не требуется.
  // ==========================================================

  const {
    data:
      createUserData,
    error:
      createUserError,
  } =
    await admin
      .auth
      .admin
      .createUser({
        email,

        password:
          temporaryPassword,

        email_confirm:
          true,

        user_metadata: {
          first_name:
            request.first_name,

          last_name:
            request.last_name,
        },
      });


  if (
    createUserError
  ) {

    console.error(
      "Ошибка создания Auth-пользователя:",
      createUserError
    );


    const loweredMessage =
      createUserError
        .message
        .toLowerCase();


    if (
      loweredMessage.includes(
        "already"
      )
      ||
      loweredMessage.includes(
        "registered"
      )
      ||
      loweredMessage.includes(
        "exists"
      )
    ) {

      return {
        ok: false,
        error:
          "Пользователь с таким email уже существует",
      };

    }


    return {
      ok: false,
      error:
        "Не удалось создать учётную запись сотрудника",
    };

  }


  const createdUser =
    createUserData.user;


  if (
    !createdUser
  ) {

    return {
      ok: false,
      error:
        "Supabase не вернул созданного пользователя",
    };

  }


  // ==========================================================
  // 6. ФИНАЛИЗИРУЕМ ЗАЯВКУ И ДОСТУП
  // ==========================================================

  const {
    error:
      finalizeError,
  } =
    await admin
      .rpc(
        "app_finalize_access_request_approval",
        {
          p_request_id:
            requestId,

          p_approved_user_id:
            createdUser.id,

          p_reviewed_by:
            reviewedBy,

          p_system_role:
            systemRole,

          p_category_marketplace:
            categoryMarketplace,
        }
      );


  // ==========================================================
  // 7. ЕСЛИ ФИНАЛИЗАЦИЯ НЕ ПРОШЛА,
  //    УДАЛЯЕМ СОЗДАННОГО AUTH-ПОЛЬЗОВАТЕЛЯ
  // ==========================================================

  if (
    finalizeError
  ) {

    console.error(
      "Ошибка финализации заявки:",
      finalizeError
    );


    const {
      error:
        rollbackError,
    } =
      await admin
        .auth
        .admin
        .deleteUser(
          createdUser.id
        );


    if (
      rollbackError
    ) {

      console.error(
        "КРИТИЧЕСКАЯ ОШИБКА отката Auth-пользователя:",
        rollbackError
      );


      return {
        ok: false,
        error:
          "Не удалось завершить создание сотрудника, а автоматический откат также завершился ошибкой. Повторно заявку не одобряйте до проверки пользователя в Supabase Auth.",
      };

    }


    return {
      ok: false,
      error:
        "Не удалось завершить одобрение заявки. Созданная учётная запись автоматически удалена.",
    };

  }


  // ==========================================================
  // 8. УСПЕХ
  // ==========================================================

  const fullName =
    [
      request.first_name,
      request.last_name,
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      );


  return {
    ok: true,

    email,

    fullName,

    temporaryPassword,
  };

}


// ============================================================
// ОТКЛОНЕНИЕ ЗАЯВКИ
// ============================================================

export async function rejectAccessRequest(
  requestIdRaw: string
):
Promise<RejectAccessRequestResult> {

  const requestId =
    requestIdRaw.trim();


  if (
    !isUuid(
      requestId
    )
  ) {

    return {
      ok: false,
      error:
        "Некорректный ID заявки",
    };

  }


  // ==========================================================
  // 1. ПРОВЕРЯЕМ АДМИНИСТРАТОРА
  // ==========================================================

  const adminCheck =
    await getCurrentAdminUserId();


  if (
    !adminCheck.ok
  ) {

    return {
      ok: false,
      error:
        adminCheck.error,
    };

  }


  const admin =
    createAdminClient();


  // ==========================================================
  // 2. ОТКЛОНЯЕМ ЗАЯВКУ
  // ==========================================================

  const {
    error:
      rejectError,
  } =
    await admin
      .rpc(
        "app_reject_access_request",
        {
          p_request_id:
            requestId,

          p_reviewed_by:
            adminCheck.userId,
        }
      );


  if (
    rejectError
  ) {

    console.error(
      "Ошибка отклонения заявки:",
      rejectError
    );


    const loweredMessage =
      rejectError
        .message
        .toLowerCase();


    if (
      loweredMessage.includes(
        "уже обработана"
      )
      ||
      loweredMessage.includes(
        "не найдена"
      )
    ) {

      return {
        ok: false,
        error:
          "Заявка уже обработана или больше не существует",
      };

    }


    return {
      ok: false,
      error:
        "Не удалось отклонить заявку",
    };

  }


  return {
    ok: true,
  };

}
