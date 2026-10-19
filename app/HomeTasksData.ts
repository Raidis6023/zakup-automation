export type TaskRole =
  | "administrators"
  | "category_manager"
  | "ved"
  | "procurement"
  | "analyst"
  | "marketing";

export type TaskStatus =
  | "red"
  | "yellow"
  | "green";

export type TaskItem = {
  id: string;
  title: string;
  creator: string;
  assignee: string;
  role: TaskRole;
  status: TaskStatus;
};

export type PersonalNote = {
  id: string;
  title: string;
};

export type TaskProfile = {
  user_id?: string;
  first_name?: string;
  last_name?: string;
  role_name?: string;
  has_admin_access?: boolean;
};

export const PRIVILEGED_TASKS: TaskItem[] = [
  {
    id: "task-admin-1",
    title: "Проверить права доступа нового сотрудника",
    creator: "Иван Петров",
    assignee: "Администраторы",
    role: "administrators",
    status: "red",
  },
  {
    id: "task-ved-1",
    title: "Проверить расчёт по новому товару",
    creator: "Анна Волкова",
    assignee: "Мария Соколова",
    role: "ved",
    status: "red",
  },
  {
    id: "task-procurement-1",
    title: "Подтвердить заказ поставщику",
    creator: "Илья Петров",
    assignee: "Алексей Орлов",
    role: "procurement",
    status: "yellow",
  },
  {
    id: "task-analyst-1",
    title: "Согласовать цену на товар",
    creator: "Елена Смирнова",
    assignee: "Олег Крылов",
    role: "analyst",
    status: "yellow",
  },
  {
    id: "task-category-1",
    title: "Проверить карточки новой категории",
    creator: "Алексей Орлов",
    assignee: "Мария Соколова",
    role: "category_manager",
    status: "green",
  },
  {
    id: "task-marketing-1",
    title: "Подготовить материалы для акции",
    creator: "Мария Соколова",
    assignee: "Елена Смирнова",
    role: "marketing",
    status: "green",
  },
];

export const MANAGER_TASKS: TaskItem[] =
  PRIVILEGED_TASKS.filter(
    task => task.role !== "administrators"
  );

export function getTaskProfileName(
  profile: TaskProfile | null
) {
  if (!profile) {
    return "Текущий сотрудник";
  }

  const value = [
    profile.first_name,
    profile.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return value || "Текущий сотрудник";
}

export function isManagerTaskProfile(
  profile: TaskProfile | null
) {
  const role =
    profile?.role_name?.trim().toLowerCase()
    || "";

  return (
    role === "руководитель"
    || role.startsWith("руководитель ")
  );
}

export function getTaskRole(
  profile: TaskProfile | null
): TaskRole | null {
  if (!profile) {
    return null;
  }

  const role =
    profile.role_name?.trim().toLowerCase()
    || "";

  if (role.startsWith("категорийный менеджер")) {
    return "category_manager";
  }
  if (role === "вэд") {
    return "ved";
  }
  if (role === "закуп") {
    return "procurement";
  }
  if (role === "аналитик" || role === "аналитика") {
    return "analyst";
  }
  if (role === "маркетинг") {
    return "marketing";
  }

  return null;
}

export function buildCurrentUserTasks(
  profile: TaskProfile | null
): TaskItem[] {
  if (!profile || isManagerTaskProfile(profile)) {
    return [];
  }

  const role = getTaskRole(profile);
  if (!role) {
    return [];
  }

  const assignee = getTaskProfileName(profile);

  return [
    {
      id: `${profile.user_id ?? "current"}-task-1`,
      title: "Проверить расчёт по новому товару",
      creator: "Анна Волкова",
      assignee,
      role,
      status: "red",
    },
    {
      id: `${profile.user_id ?? "current"}-task-2`,
      title: "Подтвердить данные перед отправкой",
      creator: "Илья Петров",
      assignee,
      role,
      status: "yellow",
    },
    {
      id: `${profile.user_id ?? "current"}-task-3`,
      title: "Проверить изменения по товару",
      creator: "Мария Соколова",
      assignee,
      role,
      status: "green",
    },
  ];
}

export function buildAdministratorTasks(
  profile: TaskProfile | null
): TaskItem[] {
  if (!profile || !profile.has_admin_access) {
    return [];
  }

  return [
    {
      id: `${profile.user_id ?? "current"}-admin-task-1`,
      title: "Проверить права доступа нового сотрудника",
      creator: "Иван Петров",
      assignee: "Администраторы",
      role: "administrators",
      status: "red",
    },
    {
      id: `${profile.user_id ?? "current"}-admin-task-2`,
      title: "Проверить настройки доступа к разделу",
      creator: "Анна Волкова",
      assignee: "Администраторы",
      role: "administrators",
      status: "yellow",
    },
  ];
}

export function buildPersonalNotes(
  profile: TaskProfile | null
): PersonalNote[] {
  if (!profile) {
    return [];
  }

  const ownerKey =
    profile.user_id ?? "current-user";

  return [
    {
      id: `${ownerKey}-note-1`,
      title: "Не забыть проверить новые позиции",
    },
    {
      id: `${ownerKey}-note-2`,
      title: "Вернуться к сверке отчёта",
    },
  ];
}
