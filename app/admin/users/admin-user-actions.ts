"use server";

import {
  createClient as createSessionClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export type DeleteAdminUserResult =
  | {
      ok: true;
      warning?: string;
    }
  | {
      ok: false;
      error: string;
    };

function isUuid(value: string) {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  ).test(value);
}

export async function deleteAdminUser(
  targetUserIdRaw: string
): Promise<DeleteAdminUserResult> {
  const targetUserId =
    targetUserIdRaw.trim();

  if (!isUuid(targetUserId)) {
    return {
      ok: false,
      error: "Некорректный ID пользователя",
    };
  }

  const session =
    await createSessionClient();

  const {
    data: { user: currentUser },
    error: currentUserError,
  } =
    await session.auth.getUser();

  if (currentUserError || !currentUser) {
    return {
      ok: false,
      error: "Требуется авторизация",
    };
  }

  if (currentUser.id === targetUserId) {
    return {
      ok: false,
      error:
        "Старший администратор не может удалить собственную учётную запись",
    };
  }

  const admin =
    createAdminClient();

  const {
    data: currentAccess,
    error: currentAccessError,
  } =
    await admin
      .from("app_user_access")
      .select("admin_level")
      .eq("user_id", currentUser.id)
      .maybeSingle();

  if (
    currentAccessError
    || currentAccess?.admin_level !== "senior_admin"
  ) {
    return {
      ok: false,
      error:
        "Удалять пользователей может только Старший администратор",
    };
  }

  const {
    data: targetAuthData,
    error: targetAuthError,
  } =
    await admin
      .auth
      .admin
      .getUserById(targetUserId);

  if (
    targetAuthError
    || !targetAuthData.user
  ) {
    return {
      ok: false,
      error:
        "Учётная запись пользователя не найдена",
    };
  }

  const targetEmail =
    targetAuthData.user.email
      ?.trim()
      .toLowerCase()
    || null;

  const {
    data: targetProfile,
  } =
    await admin
      .from("app_profiles")
      .select("avatar_path")
      .eq("id", targetUserId)
      .maybeSingle();

  const {
    error: deleteAuthError,
  } =
    await admin
      .auth
      .admin
      .deleteUser(targetUserId);

  if (deleteAuthError) {
    console.error(
      "Ошибка удаления Auth-пользователя:",
      deleteAuthError
    );

    return {
      ok: false,
      error:
        deleteAuthError.message
        || "Не удалось удалить учётную запись пользователя",
    };
  }

  const warnings: string[] = [];
  const avatarPaths = new Set<string>();

  if (targetProfile?.avatar_path) {
    avatarPaths.add(targetProfile.avatar_path);
  }

  const {
    data: avatarFiles,
    error: avatarListError,
  } =
    await admin
      .storage
      .from("avatars")
      .list(
        targetUserId,
        { limit: 100 }
      );

  if (avatarListError) {
    console.error(
      "Не удалось получить список аватаров:",
      avatarListError
    );
  } else {
    for (const file of avatarFiles ?? []) {
      if (file.name) {
        avatarPaths.add(
          `${targetUserId}/${file.name}`
        );
      }
    }
  }

  if (avatarPaths.size > 0) {
    const {
      error: avatarDeleteError,
    } =
      await admin
        .storage
        .from("avatars")
        .remove(
          Array.from(avatarPaths)
        );

    if (avatarDeleteError) {
      console.error(
        "Не удалось удалить аватар:",
        avatarDeleteError
      );
      warnings.push(
        "файл фото потребует ручной проверки"
      );
    }
  }

  const {
    error: profileDeleteError,
  } =
    await admin
      .from("app_profiles")
      .delete()
      .eq("id", targetUserId);

  if (profileDeleteError) {
    console.error(
      "Не удалось очистить app_profiles:",
      profileDeleteError
    );
    warnings.push(
      "профиль потребует ручной проверки"
    );
  }

  const {
    error: accessDeleteError,
  } =
    await admin
      .from("app_user_access")
      .delete()
      .eq("user_id", targetUserId);

  if (accessDeleteError) {
    console.error(
      "Не удалось очистить app_user_access:",
      accessDeleteError
    );
    warnings.push(
      "запись доступа потребует ручной проверки"
    );
  }

  if (targetEmail) {
    const {
      error: requestDeleteError,
    } =
      await admin
        .from("app_access_requests")
        .delete()
        .ilike("email", targetEmail);

    if (requestDeleteError) {
      console.error(
        "Не удалось очистить заявку пользователя:",
        requestDeleteError
      );
      warnings.push(
        "заявка на доступ потребует ручной проверки"
      );
    }
  }

  return {
    ok: true,
    warning:
      warnings.length > 0
        ? warnings.join("; ")
        : undefined,
  };
}
