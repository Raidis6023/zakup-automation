export function normalizeNewProductArticle(article: string): string {
  return article.trim().toUpperCase();
}

/**
 * Временный бизнес-идентификатор нового товара — артикул.
 * Для интерфейса удаляем только этот артикул в скобках,
 * остальные скобки и характеристики товара сохраняем.
 */
export function displayNewProductName(name: string, article: string): string {
  const id = article.trim();
  if (!id) return name.trim();
  const escaped = id.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  return name
    .replace(new RegExp("\\s*\\(" + escaped + "\\)", "gi"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}