"use client";
import { useMemo, useState } from "react";
import Button from "../ui/Button";

export type StockEvent = {
  date: string; source: "АВЕДЭКС" | "ОХ"; previous: number; current: number; delta: number;
};
export type StockRow = {
  code: string; article: string; name: string; masterCode: string | null;
  avedex: number; oh: number; aDelta: number | null; oDelta: number | null;
  missingAvedex: boolean; missingOh: boolean; history: StockEvent[];
};
type Props = {
  rows: StockRow[]; aDate: string | null; aPrev: string | null;
  oDate: string | null; oPrev: string | null;
  aTotal: number; oTotal: number; missing: number; calculatedFromLatest: boolean;
  aUploadedAt: string | null; oUploadedAt: string | null;
};
const num = (n: number) => new Intl.NumberFormat("ru-RU").format(n);
const day = (d: string | null) => d ? d.split("-").reverse().join(".") : "Нет загрузок";
const uploaded = (d: string | null) => d
  ? new Intl.DateTimeFormat("ru-RU", {
      timeZone: "Asia/Krasnoyarsk",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(d)) + " (Красноярск)"
  : "Нет загрузок";
const diff = (v: number | null) => v === null ? "—" : (v > 0 ? "+" : "") + num(v);

export default function StocksClient(props: Props) {
  const { rows, aDate, aPrev, oDate, oPrev, aTotal, oTotal, missing, calculatedFromLatest, aUploadedAt, oUploadedAt } = props;
  const [search, setSearch] = useState("");
  const [changed, setChanged] = useState(false);
  const [open, setOpen] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const filtered = useMemo(() => rows.filter((r) =>
    (r.article + " " + r.name + " " + (r.masterCode || "")).toLowerCase()
      .includes(search.toLowerCase().trim())
    && (!changed || !!r.aDelta || !!r.oDelta || r.missingAvedex || r.missingOh)
  ), [rows, search, changed]);

  const outdated = (d: string | null) => !d
    || (Date.now() - new Date(d + "T23:59:59Z").getTime() > 10 * 86400000);

  return <>
    <section className="stocks-stats">
      <div className="card"><div className="card-label">АВЕДЭКС</div>
        <div className="big-number">{num(aTotal)} шт.</div>
        <div className="muted">Остатки на: {day(aDate)}</div>
        <div className="stocks-tiny">Загружено: {uploaded(aUploadedAt)}</div>
        <div className="stocks-tiny">Предыдущий: {day(aPrev)}</div></div>
      <div className="card"><div className="card-label">Ответственное хранение</div>
        <div className="big-number">{num(oTotal)} шт.</div>
        <div className="muted">Остатки на: {day(oDate)}</div>
        <div className="stocks-tiny">Загружено: {uploaded(oUploadedAt)}</div>
        <div className="stocks-tiny">Предыдущий: {day(oPrev)}</div></div>
      <div className="card"><div className="card-label">Общие остатки</div>
        <div className="big-number">{num(aTotal + oTotal)} шт.</div>
        <div className="muted">АВЕДЭКС + ОХ</div>
        <div className="stocks-tiny">{num(rows.length)} товарных позиций</div></div>
    </section>
    {(aDate !== oDate || outdated(aDate) || outdated(oDate)) && <div className="ws-notice ws-notice--warning">
      Данные складов за разные даты или устарели: АВЕДЭКС {day(aDate)}, ОХ {day(oDate)}.
      Общая сумма не является единым складским срезом.
    </div>}
    {!calculatedFromLatest && <div className="ws-notice ws-notice--warning">
      Последний сохранённый расчёт Китая пока не использует обе последние даты Excel.
      Исходные остатки доступны в общей базе; проверьте расчёт на странице «Закуп».
    </div>}
    {missing > 0 && <div className="ws-notice ws-notice--warning">
      {num(missing)} товаров исчезли из выгрузки одного из складов относительно прошлой.
      Они не обязательно имеют нулевой остаток. Проверьте полноту файла.
    </div>}
    <section className="section">
      <div className="section-header"><div><h2 className="section-title">Товары и история изменений</h2>
        <p className="stocks-caption">Δ означает разницу между двумя Excel-снимками.
          Причину изменения система пока не знает.</p></div></div>
      <div className="stocks-controls">
        <input className="ws-text-field stocks-search workspace-search-field" aria-label="Поиск по артикулу, названию или ЕНОТ"
          value={search} onChange={(e) => {setSearch(e.target.value);setLimit(50);}} />
        <label><input type="checkbox" checked={changed}
          onChange={(e) => {setChanged(e.target.checked);setLimit(50);}} /> Только с изменениями</label>
        <span className="muted">Найдено: {num(filtered.length)}</span>
      </div>
      <div className="table-wrapper"><table className="table stocks-table">
        <thead><tr><th>Артикул / товар</th><th className="right">АВЕДЭКС</th>
          <th className="right">ОХ</th><th className="right">Всего</th>
          <th className="right">Δ АВЕДЭКС</th><th className="right">Δ ОХ</th></tr></thead>
        <tbody>
          {filtered.slice(0, limit).map((r) => {
            const expanded = open.includes(r.code);
            return <StockLine key={r.code} row={r} expanded={expanded} onClick={() =>
              setOpen((s) => s.includes(r.code) ? s.filter((key) => key !== r.code) : [...s, r.code])} />;
          })}
          {filtered.length === 0 && <tr><td colSpan={6}>Товары не найдены.</td></tr>}
        </tbody>
      </table></div>
      {filtered.length > limit && <Button variant="secondary" className="stocks-more"
        onClick={() => setLimit((n) => n + 50)}>Показать ещё 50</Button>}
    </section>
    <div className="ws-notice ws-notice--warning">
      История за 30 дней показывает изменения между еженедельными снимками.
      Полного журнала подтверждённых складских движений пока нет, поэтому
      реальную недостачу по формуле «прошлый остаток + приход − расход» пока не вычисляем.
      Возвраты с МП автоматически на АВЕДЭКС или ОХ не приходуем.
    </div>
  </>;
}
function StockLine({row:r,expanded,onClick}:{row:StockRow;expanded:boolean;onClick:()=>void}) {
  return <>
    <tr>
      <td><button type="button" className="ws-inline-toggle stocks-expand" aria-expanded={expanded} onClick={onClick}>
        {expanded ? "▾" : "▸"} <strong>{r.article}</strong></button>
        <div className="stocks-tiny">{r.name}</div>
        {r.masterCode && <div className="stocks-tiny">Код: {r.masterCode}</div>}</td>
      <td className="right">{num(r.avedex)}{r.missingAvedex && <span title="Нет строки в последнем Excel"> *</span>}</td>
      <td className="right">{num(r.oh)}{r.missingOh && <span title="Нет строки в последнем Excel"> *</span>}</td>
      <td className="right"><strong>{num(r.avedex + r.oh)}</strong></td>
      <td className="right">{diff(r.aDelta)}</td><td className="right">{diff(r.oDelta)}</td>
    </tr>
    {expanded && <tr className="stocks-detail"><td colSpan={6}>
      <strong>Изменения по Excel за месяц</strong>
      {r.history.length ? r.history.map((e, i) => <div className="stocks-event" key={e.source+e.date+i}>
        <span>{day(e.date)}</span><strong>{e.source}</strong>
        <span>{num(e.previous)} → {num(e.current)}</span>
        <strong>{diff(e.delta)}</strong><span className="stocks-tiny">Причина не установлена</span>
      </div>) : <p className="stocks-tiny">Нет двух сравнимых выгрузок за последний месяц.</p>}
    </td></tr>}
  </>;
}
