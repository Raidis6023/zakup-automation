"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "./ui/Button";
import "./ved-add-items.css";
import VedOrderExcelImport from "./VedOrderExcelImport";

type CatalogProduct = {
  id: string;
  master_code: string | null;
  offer_id: string;
  name: string | null;
  chinese_article: string | null;
  main_photo_url: string | null;
  units_per_carton: number | null;
  transport_carton_volume_m3: number | null;
  carton_volume_m3: number | null;
  carton_weight_kg: number | null;
  last_unit_price_cny: number | null;
  last_moq: number | null;
};

type NewDraft = {
  name: string;
  our_article: string;
  chinese_article: string;
  cartons: string;
  units_per_carton: string;
  unit_price_cny: string;
  carton_volume_m3: string;
  carton_weight_kg: string;
};

const emptyNew: NewDraft = {
  name: "", our_article: "", chinese_article: "", cartons: "",
  units_per_carton: "", unit_price_cny: "", carton_volume_m3: "", carton_weight_kg: ""
};
const normalizeNumber = (v: string) => v.replace(/\s/g, "").replace(",", ".");

export default function VedOrderAddItemsDialog({
  orderId, existingProductIds, onAdded
}: {
  orderId: string;
  existingProductIds: string[];
  onAdded: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"catalog" | "new">("catalog");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [newItem, setNewItem] = useState<NewDraft>(emptyNew);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [excelActive,setExcelActive] = useState(false);

  const existing = useMemo(() => new Set(existingProductIds), [existingProductIds]);
  const selectedCount = Object.keys(selected).length;

  useEffect(() => {
    if (!open || mode !== "catalog") return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(
          "/api/ved-orders/" + encodeURIComponent(orderId) +
          "/add-items?q=" + encodeURIComponent(query.trim()),
          { cache: "no-store", signal: controller.signal }
        );
        const data = await response.json() as {
          ok?: boolean; error?: string; products?: CatalogProduct[];
        };
        if (!response.ok || !data.ok) throw new Error(data.error || "Ошибка поиска");
        setResults(data.products || []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Ошибка каталога");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 270);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, mode, query, orderId]);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, saving]);

  function toggleProduct(product: CatalogProduct) {
    if (existing.has(product.id)) return;
    setError("");
    setSelected(current => {
      const next = { ...current };
      if (Object.prototype.hasOwnProperty.call(next, product.id)) {
        delete next[product.id];
      } else {
        next[product.id] = "";
      }
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setError("");
    const items: Record<string, unknown>[] = mode === "catalog"
      ? Object.entries(selected).map(([product_id, cartons]) => ({
          mode: "catalog", product_id, cartons: cartons.trim() ? cartons : "0"
        }))
      : [{
          mode: "new",
          name: newItem.name.trim(),
          our_article: newItem.our_article.trim(),
          chinese_article: newItem.chinese_article.trim(),
          cartons: newItem.cartons.trim() || "0",
          units_per_carton: normalizeNumber(newItem.units_per_carton),
          unit_price_cny: normalizeNumber(newItem.unit_price_cny),
          carton_volume_m3: normalizeNumber(newItem.carton_volume_m3),
          carton_weight_kg: normalizeNumber(newItem.carton_weight_kg),
        }];
    if (mode === "catalog" && items.length < 1) {
      setError("Выберите хотя бы один товар.");
      return;
    }
    if (mode === "new" && newItem.name.trim().length < 2) {
      setError("Введите название нового товара.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        "/api/ved-orders/" + encodeURIComponent(orderId) + "/add-items",
        {
          method: "POST", cache: "no-store", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items })
        }
      );
      const data = await response.json() as { ok?: boolean; added?: number; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Не удалось добавить товары");
      await onAdded();
      setOpen(false);
      setSelected({});
      setNewItem(emptyNew);
      setQuery("");
      setMode("catalog");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant="primary" onClick={() => {
        setError(""); setOpen(true);
      }}>+ Добавить товар</Button>
      {open && (
        <div className="ved-add-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !saving) setOpen(false);
        }}>
          <section
            role="dialog" aria-modal="true" aria-label="Добавление товара в заказ"
            className="ved-add-dialog"
          >
            <header className="ved-add-header">
              <div>
                <h3>Добавление товара в заказ</h3>
                <p>Выберите товар из каталога или создайте новую позицию в черновике.</p>
              </div>
              <button
                className="ved-add-close" type="button" disabled={saving}
                onClick={() => setOpen(false)} aria-label="Закрыть окно"
              >×</button>
            </header>
            <div className="ved-add-tabs" role="group" aria-label="Тип добавления">
              <button type="button" aria-pressed={mode === "catalog"}
                onClick={() => { setMode("catalog"); setError(""); setExcelActive(false); }}>Из каталога ЕНОТ</button>
              <button type="button" aria-pressed={mode === "new"}
                onClick={() => { setMode("new"); setError(""); }}>Новый товар</button>
            </div>

            {mode === "catalog" ? (
              <div className="ved-add-body">
                <label className="ved-add-label" htmlFor="ved-add-search">
                  Поиск по ЕНОТ, нашему или китайскому артикулу, названию
                </label>
                <input
                  id="ved-add-search" autoFocus className="ved-add-input"
                  placeholder="Введите ЕНОТ, артикул или название..."
                  value={query} onChange={event => setQuery(event.target.value)}
                />
                <div className="ved-add-results" role="list">
                  {searching && <p className="ved-add-hint">Поиск товаров…</p>}
                  {!searching && results.length === 0 && (
                    <p className="ved-add-hint">Товары не найдены. Попробуйте изменить запрос.</p>
                  )}
                  {results.map(product => {
                    const chosen = Object.prototype.hasOwnProperty.call(selected, product.id);
                    const already = existing.has(product.id);
                    const units = product.units_per_carton ?? 0;
                    return (
                      <div key={product.id} role="listitem" className="ved-add-product">
                        <label className="ved-add-product-choice">
                          <input type="checkbox" disabled={already}
                            checked={already || chosen}
                            onChange={() => toggleProduct(product)} />
                          {product.main_photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.main_photo_url} alt="" loading="lazy" />
                          ) : <span className="ved-add-photo-empty">▣</span>}
                          <span className="ved-add-product-meta">
                            <strong>{product.offer_id}</strong>
                            <span>{product.name || "Название не заполнено"}</span>
                            <small>ЕНОТ: {product.master_code || "нет"} · Китай: {product.chinese_article || "нет"}
                              {units > 0 ? " · " + units + " шт./кор." : " · Нет упаковки"}
                            </small>
                          </span>
                        </label>
                        {already ? (
                          <span className="ved-add-existing">Уже в заказе</span>
                        ) : chosen ? (
                          <label className="ved-add-qty">
                            Коробов
                            <input type="number" min="0" max="100000" step="1"
                              aria-label={"Коробов для " + product.offer_id}
                              value={selected[product.id]}
                              placeholder="0" onChange={event => {
                                const value = event.target.value;
                                setSelected(current => ({ ...current, [product.id]: value }));
                              }} />
                          </label>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <p className="ved-add-hint">
                  Можно выбрать несколько товаров. Если упаковка неизвестна,
                  добавьте позицию с 0 коробов и заполните данные позже.
                </p>
              </div>
            ) : (
              <div className="ved-add-body ved-add-new">
                <VedOrderExcelImport orderId={orderId}
                  onStateChange={setExcelActive}
                  onImported={async () => {
                    await onAdded();
                    setExcelActive(false);
                    setOpen(false);
                  }}
                />
                {!excelActive && <>
                <div className="ved-add-manual-divider">Или добавьте один товар вручную</div>
                <p className="ved-add-hint">Позиция будет создана только в этом заказе.
                  ЕНОТ и новый товар в общем каталоге автоматически не создаются.</p>
                <label className="ved-add-label ved-add-full">Название товара *
                  <input autoFocus className="ved-add-input" maxLength={250}
                    placeholder="Название нового товара" value={newItem.name}
                    onChange={event => setNewItem(current => ({ ...current, name: event.target.value }))} />
                </label>
                {([
                  ["our_article", "Наш артикул", "Например, AVD-001"],
                  ["chinese_article", "Китайский артикул", "Артикул поставщика"],
                  ["cartons", "Количество коробов", "0"],
                  ["units_per_carton", "Штук в коробке", "0"],
                  ["unit_price_cny", "Цена за штуку, CNY", "0,00"],
                  ["carton_volume_m3", "Объём короба, м³", "0,000"],
                  ["carton_weight_kg", "Вес короба, кг", "0,00"]
                ] as const).map(([key, title, hint]) => (
                  <label className="ved-add-label" key={key}>{title}
                    <input className="ved-add-input" placeholder={hint}
                      type={["our_article", "chinese_article"].includes(key) ? "text" : "text"}
                      inputMode={["our_article", "chinese_article"].includes(key) ? "text" : "decimal"}
                      maxLength={key === "our_article" || key === "chinese_article" ? 120 : 24}
                      value={newItem[key]}
                      onChange={event => setNewItem(current => ({ ...current, [key]: event.target.value }))} />
                  </label>
                ))}
                </>}
              </div>
            )}
            {error && <div className="ved-add-error" role="alert">{error}</div>}
            {(mode !== "new" || !excelActive) && <footer className="ved-add-footer">
              <span>{mode === "catalog" ? "Выбрано: " + selectedCount : "Новая позиция"}</span>
              <div className="ved-add-footer-actions">
                <Button type="button" variant="secondary" disabled={saving}
                  onClick={() => setOpen(false)}>Отмена</Button>
                <Button type="button" variant="primary" disabled={saving ||
                  (mode === "catalog" ? selectedCount === 0 : newItem.name.trim().length < 2)}
                  onClick={() => void save()}>
                  {saving ? "Сохраняем…" : mode === "catalog" ? "Добавить выбранные" : "Добавить товар"}
                </Button>
              </div>
            </footer>}
          </section>
        </div>
      )}
    </>
  );
}
