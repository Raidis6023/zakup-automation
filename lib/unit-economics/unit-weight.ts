/**
 * Расчётный вес единицы товара для предварительной юнит-экономики.
 *
 * Источник: вес транспортировочной коробки БРУТТО / количество товаров в ней.
 * Включает распределённую массу внешнего картона; не равен измеренному
 * весу индивидуальной упаковки и не должен выдавать точную зону Ozon.
 *
 * Это только производное поле: самостоятельного ручного значения нет.
 */
export type CalculatedUnitWeight = Readonly<{
  kilograms: number | null;
  formula: string | null;
  source: "carton-gross" | null;
  warning: string | null;
}>;
export function calculateUnitWeight(
  cartonGrossKg: number | null | undefined,
  unitsPerCarton: number | null | undefined
): CalculatedUnitWeight {
  if (typeof cartonGrossKg !== "number" || !Number.isFinite(cartonGrossKg) || cartonGrossKg <= 0) {
    return {kilograms: null, formula: null, source: null, warning: "Не указан положительный вес брутто транспортировочной коробки"};
  }
  if (typeof unitsPerCarton !== "number" || !Number.isSafeInteger(unitsPerCarton) || unitsPerCarton <= 0) {
    return {kilograms: null, formula: null, source: null, warning: "Не указано корректное целое количество штук в коробке"};
  }
  const kilograms = cartonGrossKg / unitsPerCarton;
  if (!Number.isFinite(kilograms) || kilograms <= 0) {
    return {kilograms: null, formula: null, source: null, warning: "Не удалось рассчитать вес единицы товара"};
  }
  // Только для текста формулы убираем двоичные артефакты дробных чисел.
  // Сам kilograms остаётся без округления и используется в дальнейших вычислениях.
  const shownKilograms = Number(kilograms.toPrecision(15));
  return {
    kilograms,
    formula: `${cartonGrossKg} кг / ${unitsPerCarton} шт. = ${shownKilograms} кг/шт.`,
    source: "carton-gross",
    warning: null
  };
}
