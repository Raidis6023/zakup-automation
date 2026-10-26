// Результат проверки допустимости берётся ТОЛЬКО из файла Яндекс Селлера.
// Наличие остатка или карточки товара не доказывает, что склад его примет.
export const FBY_WAREHOUSES = [
  { id: 172, name: "МО Софьино (кроме КГТ) - 1", cluster: "Москва" },
  { id: 308, name: "МО Софьино (кроме КГТ) - 2", cluster: "Москва" },
  { id: 304, name: "МО Софьино (КГТ)", cluster: "Москва" },
  { id: 300, name: "Екатеринбург", cluster: "Екатеринбург" },
  { id: 305, name: "Ростов-на-Дону-2", cluster: "Ростов-на-Дону" },
  { id: 147, name: "Ростов-на-Дону-1", cluster: "Ростов-на-Дону" },
  { id: 313, name: "ЛО Шушары", cluster: "Санкт-Петербург" },
  { id: 301, name: "ЛО Парголово", cluster: "Санкт-Петербург" },
  { id: 314, name: "Казань", cluster: "Казань" },
  { id: 302, name: "Самара", cluster: "Самара" }
] as const;

export type EligibilityValue = "yes" | "no";
export type EligibilitySnapshot = {
  id: string;
  created_at: string;
  source_file: string;
  offers_count: number;
  warehouse_count: number;
  mapping: Record<string, Record<string, EligibilityValue>>;
  headers: Array<{ id: number; name: string }>;
  unknown_offers: string[];
};

export const normalizeOfferId = (v: string) => v.normalize("NFKC").replace(/\u00a0/g, " ").trim();
export const normalizeHeader = (v: string) =>
  v.normalize("NFKC").toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[–—−]/g, "-").replace(/\s+/g, " ").trim();

export function mapWarehouseColumn(header: string): (typeof FBY_WAREHOUSES)[number] | undefined {
  const x = normalizeHeader(header);
  return FBY_WAREHOUSES.find(w => normalizeHeader(w.name) === x);
}

export function eligibleOnCluster(
  snapshot: EligibilitySnapshot,
  offerId: string,
  cluster: string
): "yes" | "no" | "unknown" {
  const knownForCluster = new Set(FBY_WAREHOUSES.filter(w => w.cluster === cluster).map(w => w.id));
  const idsInOfficialFile = snapshot.headers
    .map(w => w.id)
    .filter(id => knownForCluster.has(id as typeof FBY_WAREHOUSES[number]["id"]));
  if (idsInOfficialFile.length === 0) return "unknown";
  const statuses = idsInOfficialFile.map(id => snapshot.mapping[normalizeOfferId(offerId)]?.[String(id)]);
  if (statuses.includes("yes")) return "yes";
  // Если хотя бы один склад не проверен, считать "нет" нельзя.
  if (statuses.every(s => s === "no")) return "no";
  return "unknown";
}

export function eligibilityIsStale(snapshot: EligibilitySnapshot): boolean {
  return Date.now() - Date.parse(snapshot.created_at) > 48 * 3600000;
}
