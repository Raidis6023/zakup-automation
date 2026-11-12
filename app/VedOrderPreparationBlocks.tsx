"use client";

import { useState } from "react";
import "./ved-preparation-blocks.css";

export type PreparationItem = {
  id: string;
  item_kind: string;
  product_name_snapshot: string | null;
  chinese_article_snapshot: string | null;
  our_article_snapshot: string | null;
  photo_url: string | null;
  units_per_carton_snapshot: number | null;
  carton_volume_m3_snapshot: number | null;
  carton_weight_kg_snapshot: number | null;
  import_carton_length_cm: number | null;
  import_carton_width_cm: number | null;
  import_carton_height_cm: number | null;
  import_individual_length_cm: number | null;
  import_individual_width_cm: number | null;
  import_individual_height_cm: number | null;
  import_hs_code: string | null;
  selected_demand_units: number | null;
  moq_quantity: number | null;
  unit_price_cny: number | null;
  cartons: number | null;
  order_quantity: number;
  characteristics_confirmed_at: string | null;
  order_terms_confirmed_at: string | null;
  total_price_cny: number | null;
  total_volume_m3: number | null;
  total_weight_tons: number | null;
};

type CharacteristicsForm = {
  name: string; chineseArticle: string; unitsPerCarton: string;
  cartonWeightKg: string; cartonVolumeM3: string;
  cartonLengthCm: string; cartonWidthCm: string; cartonHeightCm: string;
  individualLengthCm: string; individualWidthCm: string; individualHeightCm: string;
  hsCode: string;
};
type TermsForm = { moq: string; priceCny: string; cartons: string };
const val = (n: number | null) => n == null ? "" : String(n);
const num = (s: string) => Number(s.trim().replace(/\s/g, "").replace(",", "."));
const positive = (s: string) => s.trim() !== "" && Number.isFinite(num(s)) && num(s) > 0;
const format = (n: number, decimals = 2) => Number.isFinite(n) ?
  n.toLocaleString("ru-RU", { maximumFractionDigits: decimals }) : "—";

function initialCharacteristics(item: PreparationItem): CharacteristicsForm {
  return {
    name: item.product_name_snapshot || "",
    chineseArticle: item.chinese_article_snapshot || "",
    unitsPerCarton: val(item.units_per_carton_snapshot),
    cartonWeightKg: val(item.carton_weight_kg_snapshot),
    cartonVolumeM3: val(item.carton_volume_m3_snapshot),
    cartonLengthCm: val(item.import_carton_length_cm),
    cartonWidthCm: val(item.import_carton_width_cm),
    cartonHeightCm: val(item.import_carton_height_cm),
    individualLengthCm: val(item.import_individual_length_cm),
    individualWidthCm: val(item.import_individual_width_cm),
    individualHeightCm: val(item.import_individual_height_cm),
    hsCode: item.import_hs_code || "",
  };
}
function initialTerms(item: PreparationItem): TermsForm {
  const units = item.units_per_carton_snapshot || 0;
  const target = Math.max(item.selected_demand_units || 0, item.moq_quantity || 0);
  const cartons = item.cartons && item.cartons > 0 ? item.cartons :
    target > 0 && units > 0 ? Math.ceil(target / units) : 0;
  return { moq: val(item.moq_quantity), priceCny: val(item.unit_price_cny),
    cartons: cartons ? String(cartons) : "" };
}

export default function VedOrderPreparationBlocks({
  item, onSaved
}: {
  item: PreparationItem; onSaved: () => Promise<void>;
}) {
  const [characteristics, setCharacteristics] = useState(() => initialCharacteristics(item));
  const [terms, setTerms] = useState(() => initialTerms(item));
  const [charDirty, setCharDirty] = useState(false);
  const [termsDirty, setTermsDirty] = useState(false);
  const [busy, setBusy] = useState<"characteristics" | "terms" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function changeCharacteristic(key: keyof CharacteristicsForm, value: string) {
    setCharDirty(true); setError(""); setMessage("");
    setCharacteristics(prev => {
      const next = { ...prev, [key]: value };
      if (["cartonLengthCm", "cartonWidthCm", "cartonHeightCm"].includes(key)) {
        const dims = [next.cartonLengthCm, next.cartonWidthCm, next.cartonHeightCm];
        if (dims.every(positive)) {
          const volume = dims.reduce((p, d) => p * num(d), 1) / 1000000;
          next.cartonVolumeM3 = String(Number(volume.toFixed(6)));
        }
      }
      return next;
    });
  }
  function changeTerms(key: keyof TermsForm, value: string) {
    setTermsDirty(true); setError(""); setMessage("");
    setTerms(prev => ({ ...prev, [key]: value }));
  }
  async function confirm(block: "characteristics" | "terms") {
    if (busy) return;
    setBusy(block); setError(""); setMessage("");
    try {
      const response = await fetch(
        "/api/ved-orders/items/" + encodeURIComponent(item.id) + "/preparation-block",
        {
          method: "POST", credentials: "same-origin", cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            block, values: block === "characteristics" ? characteristics : terms
          })
        }
      );
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Не удалось подтвердить блок");
      }
      setMessage(block === "characteristics" ?
        "Характеристики подтверждены." : "Условия заказа подтверждены.");
      if (block === "characteristics") setCharDirty(false);
      else setTermsDirty(false);
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка сохранения");
    } finally {
      setBusy(null);
    }
  }

  const quantity = positive(terms.cartons) && positive(characteristics.unitsPerCarton)
    ? num(terms.cartons) * num(characteristics.unitsPerCarton) : 0;
  const cost = quantity * (positive(terms.priceCny) ? num(terms.priceCny) : 0);
  const vol = positive(characteristics.cartonVolumeM3) && positive(terms.cartons)
    ? num(characteristics.cartonVolumeM3) * num(terms.cartons) : 0;
  const weight = positive(characteristics.cartonWeightKg) && positive(terms.cartons)
    ? num(characteristics.cartonWeightKg) * num(terms.cartons) / 1000 : 0;
  const minBoxes = positive(terms.moq) && positive(characteristics.unitsPerCarton)
    ? Math.ceil(num(terms.moq) / num(characteristics.unitsPerCarton)) : 0;
  const charsReady = !!item.characteristics_confirmed_at && !charDirty;
  const termsReady = !!item.order_terms_confirmed_at && !termsDirty && charsReady;

  const charFields: Array<{ key: keyof CharacteristicsForm; label: string; hint?: string }> = [
    { key: "name", label: "Название товара *" },
    { key: "chineseArticle", label: "Китайский артикул *" },
    { key: "unitsPerCarton", label: "Штук в транспортном коробе *" },
    { key: "cartonWeightKg", label: "Вес транспортного короба, кг *" },
    { key: "cartonLengthCm", label: "Длина короба, см" },
    { key: "cartonWidthCm", label: "Ширина короба, см" },
    { key: "cartonHeightCm", label: "Высота короба, см" },
    { key: "cartonVolumeM3", label: "Объём транспортного короба, м³ *",
      hint: "Рассчитывается автоматически, если указаны все три габарита" },
    { key: "individualLengthCm", label: "Длина индивидуальной упаковки, см" },
    { key: "individualWidthCm", label: "Ширина индивидуальной упаковки, см" },
    { key: "individualHeightCm", label: "Высота индивидуальной упаковки, см" },
    { key: "hsCode", label: "ТН ВЭД (предварительный)" },
  ];
  return (
    <div className="ved-two-blocks">
      <section className="ved-confirm-block" aria-label="Характеристики товара">
        <div className="ved-confirm-header">
          <strong>1. Характеристики товара</strong>
          <span className={charsReady ? "ved-confirm-status is-confirmed" : "ved-confirm-status"}>
            {charsReady ? "Подтверждено" : "Не подтверждено"}
          </span>
        </div>
        <p className="ved-confirm-description">
          Можно исправить характеристики и нового, и уже продаваемого товара.
          Изменения сохраняются в заказе, исходный каталог ЕНОТ не меняется.
        </p>
        <div className="ved-confirm-grid">
          {charFields.map(({ key, label, hint }) => (
            <label key={key} className="ved-confirm-field">
              {label}
              <input type="text" inputMode={
                ["name", "chineseArticle", "hsCode"].includes(key) ? "text" : "decimal"
              } value={characteristics[key]}
                maxLength={key === "name" ? 250 : key === "chineseArticle" ? 120 : 25}
                onChange={event => changeCharacteristic(key, event.target.value)}
                disabled={busy !== null}
                aria-label={label}
              />
              {hint && <small>{hint}</small>}
            </label>
          ))}
          <div className="ved-confirm-field ved-confirm-readonly">
            <span>Наш артикул</span>
            <strong>{item.our_article_snapshot || "Заполняет ВЭД"}</strong>
          </div>
          <div className="ved-confirm-field ved-confirm-readonly">
            <span>Основное фото товара *</span>
            <strong>{item.photo_url ? "Прикреплено" : "Отсутствует, загрузите выше"}</strong>
          </div>
        </div>
        <div className="ved-confirm-actions">
          <button type="button" disabled={busy !== null}
            onClick={() => void confirm("characteristics")}>
            {busy === "characteristics" ? "Сохраняем…" : "Подтвердить характеристики"}
          </button>
          <span>Если меняются упаковка, объём или вес, условия заказа придётся подтвердить повторно.</span>
        </div>
      </section>

      <section className="ved-confirm-block" aria-label="Условия заказа">
        <div className="ved-confirm-header">
          <strong>2. Условия заказа</strong>
          <span className={termsReady ? "ved-confirm-status is-confirmed" : "ved-confirm-status"}>
            {termsReady ? "Подтверждено" : "Не подтверждено"}
          </span>
        </div>
        <p className="ved-confirm-description">
          Вводятся MOQ, цена и количество транспортных коробов. FOB/FCA и порт
          заполняет ВЭД после передачи заказа.
        </p>
        <div className="ved-confirm-grid">
          {([
            ["moq", "MOQ, шт. *"],
            ["priceCny", "Цена за штуку, CNY *"],
            ["cartons", "Количество коробов к заказу *"],
          ] as const).map(([key, label]) => (
            <label key={key} className="ved-confirm-field">
              {label}
              <input type="text" inputMode={key === "priceCny" ? "decimal" : "numeric"}
                disabled={busy !== null || !charsReady}
                value={terms[key]}
                onChange={event => changeTerms(key, event.target.value)}
                aria-label={label}
              />
            </label>
          ))}
        </div>
        <div className="ved-confirm-calculation">
          <div><span>Минимум по MOQ</span><strong>{minBoxes ? format(minBoxes, 0) + " кор." : "—"}</strong></div>
          <div><span>Выбрано к заказу</span><strong>{quantity ? format(quantity, 0) + " шт." : "—"}</strong></div>
          <div><span>Стоимость</span><strong>{cost ? format(cost) + " CNY" : "—"}</strong></div>
          <div><span>Объём</span><strong>{vol ? format(vol, 6) + " м³" : "—"}</strong></div>
          <div><span>Вес</span><strong>{weight ? format(weight, 6) + " т" : "—"}</strong></div>
        </div>
        {item.selected_demand_units != null && (
          <p className="ved-confirm-description">
            Потребность из закупки: {format(item.selected_demand_units, 0)} шт.
            Итоговое количество можно изменить, если оно не меньше MOQ.
          </p>
        )}
        <div className="ved-confirm-actions">
          <button type="button" disabled={busy !== null || !charsReady}
            onClick={() => void confirm("terms")}>
            {busy === "terms" ? "Сохраняем…" : "Подтвердить условия заказа"}
          </button>
          {!charsReady && <span>Сначала подтвердите характеристики товара.</span>}
        </div>
      </section>

      <section className="ved-confirm-summary" aria-label="Готовность позиции">
        <strong>Готовность к передаче в ВЭД</strong>
        <span>{charsReady ? "✓" : "○"} Характеристики</span>
        <span>{termsReady ? "✓" : "○"} Условия заказа</span>
        <small>Нужны оба подтверждения. FOB/FCA, порт и наш артикул на этом этапе не требуются.</small>
      </section>
      {error && <p role="alert" className="ved-confirm-error">{error}</p>}
      {message && <p role="status" className="ved-confirm-success">{message}</p>}
    </div>
  );
}
