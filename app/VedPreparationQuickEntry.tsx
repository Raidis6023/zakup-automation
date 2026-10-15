"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PreparationItem = {
  id: string;
  our_article_snapshot: string | null;
  product_name_snapshot: string | null;
  photo_url: string | null;
  chinese_article_snapshot: string | null;
  carton_weight_kg_snapshot: number | null;
  selected_demand_units: number | null;
  units_per_carton_snapshot: number | null;
};

type Draft = {
  chineseArticle: string;
  cartonWeightKg: string;
};

type SaveResponse = {
  ok?: boolean;
  error?: string;
};

type Props = {
  items: PreparationItem[];
  actorName: string;
  actorRole: "analytics" | "procurement";
  onSaved: () => Promise<void>;
  onOpenItem: (id: string) => void;
};

function initialDraft(item: PreparationItem): Draft {
  return {
    chineseArticle: item.chinese_article_snapshot ?? "",
    cartonWeightKg:
      item.carton_weight_kg_snapshot == null
        ? ""
        : String(item.carton_weight_kg_snapshot),
  };
}

function parsedWeight(raw: string): number | null {
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  if (!normalized.trim()) return null;

  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function isComplete(draft: Draft): boolean {
  return Boolean(draft.chineseArticle.trim()) &&
    parsedWeight(draft.cartonWeightKg) !== null;
}

function hasChanges(item: PreparationItem, draft: Draft): boolean {
  return (
    draft.chineseArticle.trim() !==
      (item.chinese_article_snapshot ?? "").trim() ||
    parsedWeight(draft.cartonWeightKg) !==
      (item.carton_weight_kg_snapshot == null
        ? null
        : Number(item.carton_weight_kg_snapshot))
  );
}

const inputStyle = {
  width: "100%",
  minHeight: "36px",
  padding: "7px 9px",
  border: "1px solid var(--border)",
  borderRadius: "7px",
  background: "var(--background)",
  color: "var(--text)",
  font: "inherit",
} as const;

const thStyle = {
  padding: "10px",
  textAlign: "left" as const,
  fontWeight: 600,
  color: "var(--muted)",
  whiteSpace: "nowrap" as const,
  borderBottom: "1px solid var(--border)",
};

export default function VedPreparationQuickEntry({
  items,
  actorName,
  actorRole,
  onSaved,
  onOpenItem,
}: Props) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(items.map((item) => [item.id, initialDraft(item)]))
  );
  const [showOnlyMissing, setShowOnlyMissing] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");

  // Parent reloads order data only after saving. Sync recorded values while
  // preserving any other rows still being edited.
  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const item of items) {
        if (!next[item.id] || !hasChanges(item, next[item.id])) {
          next[item.id] = initialDraft(item);
        }
      }
      return next;
    });
  }, [items]);

  const completed = items.filter(
    (item) =>
      Boolean(item.chinese_article_snapshot?.trim()) &&
      item.carton_weight_kg_snapshot != null &&
      Number(item.carton_weight_kg_snapshot) > 0
  ).length;
  const missingCount = items.length - completed;

  const readyItems = useMemo(
    () =>
      items.filter((item) => {
        const draft = drafts[item.id] ?? initialDraft(item);
        return isComplete(draft) && hasChanges(item, draft);
      }),
    [drafts, items]
  );

  const visibleItems = useMemo(() => {
    const needle = search.toLocaleLowerCase("ru-RU").trim();

    return items.filter((item) => {
      const draft = drafts[item.id] ?? initialDraft(item);
      const incomplete =
        !item.chinese_article_snapshot?.trim() ||
        item.carton_weight_kg_snapshot == null ||
        Number(item.carton_weight_kg_snapshot) <= 0;

      if (showOnlyMissing && !incomplete && !hasChanges(item, draft)) {
        return false;
      }

      if (!needle) return true;

      return [
        item.our_article_snapshot,
        item.product_name_snapshot,
        draft.chineseArticle,
      ].some((value) => (value ?? "").toLocaleLowerCase("ru-RU").includes(needle));
    });
  }, [drafts, items, search, showOnlyMissing]);

  function changeDraft(id: string, patch: Partial<Draft>, item: PreparationItem) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? initialDraft(item)),
        ...patch,
      },
    }));
    setErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    setMessage("");
  }

  async function saveRows(rows: PreparationItem[]) {
    if (savingRef.current || rows.length === 0) return;

    if (!actorName.trim()) {
      setMessage("У заказа не назначен ответственный сотрудник. Сначала назначьте его.");
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setMessage("");

    let succeeded = 0;
    let failed = 0;
    const newErrors: Record<string, string> = {};

    try {
      for (let index = 0; index < rows.length; index++) {
        const item = rows[index];
        const draft = drafts[item.id] ?? initialDraft(item);
        setActiveItemId(item.id);
        setProgress(`Сохраняем ${index + 1} из ${rows.length}…`);

        if (!isComplete(draft)) {
          newErrors[item.id] = "Заполните китайский артикул и положительный вес короба";
          failed++;
          continue;
        }

        if (
          item.chinese_article_snapshot?.trim() &&
          draft.chineseArticle.trim() !== item.chinese_article_snapshot.trim()
        ) {
          newErrors[item.id] = "Китайский артикул уже закреплён. Изменять его нельзя";
          failed++;
          continue;
        }

        try {
          const response = await fetch(
            `/api/ved-orders/items/${encodeURIComponent(item.id)}/preparation`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chineseArticle: draft.chineseArticle.trim(),
                cartonWeightKg: parsedWeight(draft.cartonWeightKg),
                actorName: actorName.trim(),
                actorUserId: null,
                actorRole,
              }),
              cache: "no-store",
            }
          );

          const payload = (await response.json()) as SaveResponse;
          if (!response.ok || !payload.ok) {
            throw new Error(payload.error ?? "Ошибка сохранения");
          }

          succeeded++;
        } catch (cause) {
          failed++;
          newErrors[item.id] =
            cause instanceof Error ? cause.message : "Ошибка сохранения";
        }
      }

      setErrors(newErrors);

      // A single reload keeps the existing order card and readiness in sync.
      if (succeeded > 0) {
        try {
          await onSaved();
        } catch (cause) {
          setMessage(
            "Данные сохранены, но обновить страницу не удалось. Обновите её вручную."
          );
          return;
        }
      }

      setMessage(
        `Сохранено: ${succeeded}.` +
          (failed
            ? ` Не удалось: ${failed}. Проверьте ошибки в строках.`
            : " Все изменения записаны в заказ и справочник товаров.")
      );
    } finally {
      setProgress("");
      setActiveItemId(null);
      setSaving(false);
      savingRef.current = false;
    }
  }

  return (
    <section
      className="section"
      style={{ marginTop: "18px", padding: "16px" }}
      aria-label="Быстрое заполнение данных товаров"
    >
      <div
        style={{
          display: "flex",
          alignItems: "start",
          justifyContent: "space-between",
          gap: "14px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>
            Быстрое заполнение товаров
          </h2>
          <div className="muted" style={{ marginTop: "5px", fontSize: "12px" }}>
            Китайские артикулы и вес транспортного короба. Можно заполнить
            несколько строк и сохранить их вместе.
          </div>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={saving || readyItems.length === 0 || !actorName.trim()}
          onClick={() => void saveRows(readyItems)}
        >
          {saving
            ? progress || "Сохраняем…"
            : `Сохранить заполненные (${readyItems.length})`}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "14px",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: "13px" }}>
          Заполнено: {completed} из {items.length}
        </strong>
        <span className="muted" style={{ fontSize: "12px" }}>
          Осталось: {missingCount}
        </span>
        <span
          style={{
            height: "6px",
            width: "150px",
            maxWidth: "100%",
            borderRadius: "999px",
            background: "var(--border)",
            overflow: "hidden",
          }}
          aria-label={`Заполнено ${completed} из ${items.length}`}
        >
          <span
            style={{
              display: "block",
              width: `${items.length ? (100 * completed) / items.length : 100}%`,
              height: "100%",
              borderRadius: "999px",
              background: "var(--accent, #3b92d9)",
            }}
          />
        </span>
        {readyItems.length > 0 && (
          <span style={{ fontSize: "12px" }}>
            Не сохранено: <strong>{readyItems.length}</strong>
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "14px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className={showOnlyMissing ? "primary-button" : "secondary-button"}
          style={{ minHeight: "34px" }}
          onClick={() => setShowOnlyMissing(true)}
          disabled={saving}
        >
          Требуют заполнения ({missingCount})
        </button>
        <button
          type="button"
          className={!showOnlyMissing ? "primary-button" : "secondary-button"}
          style={{ minHeight: "34px" }}
          onClick={() => setShowOnlyMissing(false)}
          disabled={saving}
        >
          Все товары ({items.length})
        </button>
        <input
          type="search"
          aria-label="Поиск товара или артикула"
          placeholder="Поиск по артикулу или товару…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          disabled={saving}
          style={{ ...inputStyle, maxWidth: "300px", marginLeft: "auto" }}
        />
      </div>

      <p className="muted" style={{ fontSize: "12px", margin: "9px 0 0" }}>
        Китайский артикул фиксируется после первого сохранения.
        Вес короба можно исправлять позже. Для перехода между полями
        используйте Tab.
      </p>

      {message && (
        <div
          role="status"
          style={{
            padding: "10px 12px",
            marginTop: "12px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        >
          {message}
        </div>
      )}

      <div style={{ overflowX: "auto", marginTop: "12px" }}>
        <table
          style={{
            width: "100%",
            minWidth: "940px",
            borderCollapse: "collapse",
            fontSize: "12px",
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Товар</th>
              <th style={thStyle}>Наш артикул</th>
              <th style={{ ...thStyle, minWidth: "185px" }}>Китайский артикул</th>
              <th style={{ ...thStyle, minWidth: "130px" }}>Короб, кг</th>
              <th style={thStyle}>Потребность</th>
              <th style={thStyle}>Статус</th>
              <th style={thStyle}>Действие</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => {
              const draft = drafts[item.id] ?? initialDraft(item);
              const chineseLocked = Boolean(item.chinese_article_snapshot?.trim());
              const missingChinese = !draft.chineseArticle.trim();
              const missingWeight = parsedWeight(draft.cartonWeightKg) == null;
              const changed = hasChanges(item, draft);
              const valid = isComplete(draft);
              const isSavingThis = saving && activeItemId === item.id;
              const isPersisted =
                Boolean(item.chinese_article_snapshot?.trim()) &&
                item.carton_weight_kg_snapshot != null &&
                Number(item.carton_weight_kg_snapshot) > 0;

              return (
                <tr key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 10px", minWidth: "260px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div
                        role="img"
                        aria-label={item.product_name_snapshot ?? "Фотография товара"}
                        style={{
                          flexShrink: 0,
                          width: "42px",
                          height: "42px",
                          borderRadius: "7px",
                          border: "1px solid var(--border)",
                          backgroundColor: "var(--card)",
                          backgroundImage: item.photo_url
                            ? `url("${item.photo_url.replace(/"/g, "%22")}")`
                            : undefined,
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                          backgroundSize: "contain",
                        }}
                      />
                      <span
                        title={item.product_name_snapshot ?? "Без названия"}
                        style={{ lineHeight: 1.3 }}
                      >
                        {item.product_name_snapshot ?? "Без названия"}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "9px 10px", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {item.our_article_snapshot ?? "—"}
                  </td>
                  <td style={{ padding: "9px 10px" }}>
                    <input
                      type="text"
                      aria-label={`Китайский артикул: ${item.our_article_snapshot}`}
                      value={draft.chineseArticle}
                      placeholder="Китайский артикул"
                      disabled={saving || chineseLocked}
                      title={chineseLocked ? "Артикул закреплён в справочнике" : ""}
                      onChange={(event) =>
                        changeDraft(item.id, { chineseArticle: event.target.value }, item)
                      }
                      style={{
                        ...inputStyle,
                        borderColor: missingChinese ? "#a66c33" : "var(--border)",
                        opacity: chineseLocked ? 0.75 : 1,
                      }}
                    />
                  </td>
                  <td style={{ padding: "9px 10px" }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`Вес короба в килограммах: ${item.our_article_snapshot}`}
                      placeholder="Напр. 12,5"
                      value={draft.cartonWeightKg}
                      disabled={saving}
                      onChange={(event) =>
                        changeDraft(item.id, { cartonWeightKg: event.target.value }, item)
                      }
                      style={{
                        ...inputStyle,
                        borderColor: missingWeight ? "#a66c33" : "var(--border)",
                      }}
                    />
                  </td>
                  <td style={{ padding: "9px 10px", whiteSpace: "nowrap" }}>
                    {(item.selected_demand_units ?? 0).toLocaleString("ru-RU")} шт.
                  </td>
                  <td style={{ padding: "9px 10px", minWidth: "145px" }}>
                    {errors[item.id] ? (
                      <span title={errors[item.id]} style={{ color: "#d37b73" }}>
                        Ошибка: {errors[item.id]}
                      </span>
                    ) : isSavingThis ? (
                      "Сохраняем…"
                    ) : changed && valid ? (
                      "Не сохранено"
                    ) : isPersisted && !changed ? (
                      <span style={{ color: "#4da788" }}>Заполнено</span>
                    ) : (
                      <span className="muted">
                        {missingChinese && missingWeight
                          ? "Нужны оба поля"
                          : missingChinese
                            ? "Нет артикула"
                            : "Нет веса"}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "9px 10px" }}>
                    <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ minHeight: "32px", padding: "5px 9px" }}
                        disabled={saving || !valid || !changed}
                        onClick={() => void saveRows([item])}
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ minHeight: "32px", padding: "5px 9px" }}
                        disabled={saving}
                        title="Открыть подробную карточку товара"
                        onClick={() => onOpenItem(item.id)}
                      >
                        Карточка
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visibleItems.length === 0 && (
          <div className="muted" style={{ padding: "20px 10px", textAlign: "center" }}>
            {search ? "По вашему запросу ничего не найдено." : "Все товары заполнены."}
          </div>
        )}
      </div>
    </section>
  );
}
