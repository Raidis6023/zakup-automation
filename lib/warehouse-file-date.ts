/**
 * Date represented by the stock values. This is NOT the upload timestamp.
 * Upload time is set by Supabase on the server (created_at/imported_at).
 *
 * File examples:
 *   "Аведэкс 19.10.xlsx" -> 2026-10-19 (during October 2026)
 *   "ОХ 31.12.xlsx" -> 2025-12-31 (if uploaded in January 2026)
 *   "ОХ 19.10.2025.xlsx" -> 2025-10-19
 */
export function parseStockDateFromFileName(fileName: string, reference = new Date()): string | null {
  const name = fileName.replace(/\.(xlsx|xls)$/i, "");
  const isoMatch = name.match(/(?:^|\D)(\d{4})[-.](\d{1,2})[-.](\d{1,2})(?=\D|$)/);
  const ruMatch = name.match(/(?:^|\D)(\d{1,2})\.(\d{1,2})(?:\.(\d{4}|\d{2}))?(?=\D|$)/);

  const day = isoMatch ? Number(isoMatch[3]) : ruMatch ? Number(ruMatch[1]) : null;
  const month = isoMatch ? Number(isoMatch[2]) : ruMatch ? Number(ruMatch[2]) : null;
  if (day === null || month === null) return null;

  const rawYear = isoMatch ? isoMatch[1] : ruMatch?.[3];
  let year = rawYear
    ? (rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear))
    : reference.getFullYear();

  const valid = (y: number) => {
    const candidate = new Date(Date.UTC(y, month - 1, day, 12));
    return candidate.getUTCFullYear() === y
      && candidate.getUTCMonth() + 1 === month
      && candidate.getUTCDate() === day;
  };
  if (!valid(year)) return null;
  if (!rawYear) {
    // A new-year rollover: don't turn a December report uploaded in January
    // into a date almost one year in the future.
    const candidate = new Date(year, month - 1, day, 12);
    const futureTolerance = 3 * 24 * 60 * 60 * 1000;
    if (candidate.getTime() > reference.getTime() + futureTolerance) year -= 1;
  }
  if (!valid(year)) return null;
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}
