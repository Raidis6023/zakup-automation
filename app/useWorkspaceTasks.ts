"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import type { WorkspaceTaskSnapshot } from "./HomeTasksData";

const TASKS_REFRESH_INTERVAL = 10_000;
const TASKS_UPDATED_EVENT = "workspace-tasks-updated";

export default function useWorkspaceTasks() {
  const [snapshot, setSnapshot] = useState<WorkspaceTaskSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    let refreshQueued = false;
    const supabase = createClient();

    async function refresh() {
      if (requestInFlight) {
        refreshQueued = true;
        return;
      }

      requestInFlight = true;

      do {
        refreshQueued = false;

        try {
          const { data, error: fetchError } = await supabase
            .rpc("workspace_home_tasks_snapshot");

          if (fetchError) throw fetchError;
          if (
            !data
            || !Array.isArray(data.tasks)
            || !Array.isArray(data.notes)
          ) {
            throw new Error("Сервер вернул некорректный список задач и заметок");
          }

          if (active) {
            setSnapshot(data as WorkspaceTaskSnapshot);
            setError(null);
          }
        } catch (cause) {
          if (active) {
            setError(cause instanceof Error ? cause.message : "Не удалось загрузить задачи");
            console.error("Не удалось обновить задачи рабочего меню:", cause);
          }
        }
      } while (active && refreshQueued);

      requestInFlight = false;
      if (active) setLoading(false);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void refresh();
    }

    const channel = supabase
      .channel(`workspace-task-events-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "workspace_task_events",
        },
        () => {
          void refresh();
        }
      )
      .subscribe();

    void refresh();

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, TASKS_REFRESH_INTERVAL);

    window.addEventListener(TASKS_UPDATED_EVENT, refresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener(TASKS_UPDATED_EVENT, refresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, []);

  return { snapshot, loading, error };
}
