"use server";

import {
  createClient as createSessionClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import { createClient as createCredentialClient } from "@supabase/supabase-js";


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
  adminPassword: string;
};


export type ApproveAccessRequestResult =
  | {
      ok: true;
      email: string;
      fullName: string;
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

export async function approveAccessRequest(input: ApproveAccessRequestInput): Promise<ApproveAccessRequestResult> {
  const requestId = input.requestId.trim();
  const role = input.systemRole.trim();
  const password = input.adminPassword;
  const marketplace = role === "category_manager" ? (input.categoryMarketplace?.trim() || null) : null;

  if (!isUuid(requestId)) return { ok: false, error: "Некорректный ID заявки" };
  if (!isWorkingRole(role)) return { ok: false, error: "Выберите рабочую роль" };
  if (role === "category_manager" && (!marketplace || !isCategoryMarketplace(marketplace))) {
    return { ok: false, error: "Выберите маркетплейс" };
  }
  if (!password || password.length > 256) {
    return { ok: false, error: "Введите пароль Администратора" };
  }

  const currentAdmin = await getCurrentAdminUserId();
  if (!currentAdmin.ok) return currentAdmin;
  const session = await createSessionClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user?.email || user.id !== currentAdmin.userId) {
    return { ok: false, error: "Не удалось подтвердить личность Администратора" };
  }

  // A separate client verifies credentials without replacing the active admin's browser session.
  const verifier = createCredentialClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
  const { data: verified, error: credentialError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (credentialError || !verified.user || verified.user.id !== user.id) {
    return { ok: false, error: "Неверный пароль Администратора" };
  }
  await verifier.auth.signOut({ scope: "local" });

  const admin = createAdminClient();
  // Atomic conditional update: two admins cannot both approve one pending request.
  const { data: approved, error } = await admin.from("app_access_requests")
    .update({
      status: "approved",
      assigned_system_role: role,
      assigned_category_marketplace: marketplace,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      approved_user_id: null,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id,email,first_name,last_name")
    .maybeSingle();

  if (error || !approved) {
    return { ok: false, error: "Не удалось одобрить заявку: возможно, она уже обработана" };
  }

  return {
    ok: true,
    email: String(approved.email),
    fullName: [approved.first_name, approved.last_name].filter(Boolean).join(" "),
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
