"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { DateField } from "../../ui/WorkspaceDateFields";
import { formatAuditEvent } from "./auditLabels";

type AuditEvent = {
  id: string;
  created_at: string;
  module: string;
  action: string;
  result: string;
  actor_name: string;
  object_type: string;
  object_id: string | null;
  title: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
};
type AuditFeed = { total: number; items: AuditEvent[] };
const PAGE_SIZE = 40;
const TABS = [
  { id: "all", label: "Все события" },
  { id: "admin", label: "Сотрудники" },
  { id: "data", label: "Данные и расчёты" },
  { id: "sync", label: "Синхронизации" },
  { id: "error", label: "Ошибки" },
  { id: "security", label: "Безопасность" },
] as const;
const MODULES: Record<string,string> = {
  admin: "Администрирование",
  ved: "ВЭД",
  finance: "Финансы",
  calculations: "Юнит-экономика",
  sync: "Синхронизация",
  tasks: "Задачи",
  security: "Безопасность",
};
const STATUSES: Record<string,string> = {
  success: "Успешно",
  warning: "Предупреждение",
  error: "Ошибка",
  pending: "В процессе",
};

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp :
    new Intl.DateTimeFormat("ru-RU",{
      timeZone: "Asia/Krasnoyarsk",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(date);
}
function nextDayUtc(date: string) {
  const ms = Date.parse(date + "T00:00:00+07:00");
  return Number.isNaN(ms) ? null : new Date(ms + 86_400_000).toISOString();
}
function toUtcStart(date: string) {
  const ms = Date.parse(date + "T00:00:00+07:00");
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}
function prettyJson(value: Record<string,unknown> | null) {
  return value && Object.keys(value).length ? JSON.stringify(value,null,2) : "Данных нет";
}
export default function LogsClient() {
  const [tab,setTab] = useState("all");
  const [result,setResult] = useState("all");
  const [from,setFrom] = useState("");
  const [to,setTo] = useState("");
  const [query,setQuery] = useState("");
  const [appliedSearch,setAppliedSearch] = useState("");
  const [page,setPage] = useState(0);
  const [feed,setFeed] = useState<AuditFeed>({total:0,items:[]});
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string | null>(null);
  const [revision,setRevision] = useState(0);
  const [opened,setOpened] = useState<AuditEvent | null>(null);

  useEffect(() => {
    if (!opened) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpened(null);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [opened]);

  useEffect(() => setOpened(null), [tab, result, from, to, appliedSearch, page]);

  const refresh = useCallback(() => setRevision(n=>n+1),[]);
  useEffect(()=>{
    let active=true;
    const supabase=createClient();
    async function fetchFeed() {
      setLoading(true);
      setError(null);
      const { data, error: requestError } = await supabase.rpc("app_audit_feed", {
        p_module: tab === "all" || tab === "error" ? null : tab,
        p_result: tab === "error" ? "error" : result === "all" ? null : result,
        p_from: from ? toUtcStart(from) : null,
        p_to: to ? nextDayUtc(to) : null,
        p_search: appliedSearch || null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      });
      if (!active) return;
      if (requestError) {
        setError(requestError.message || "Не удалось загрузить журнал");
        setFeed({total:0,items:[]});
      } else {
        const incoming = data as AuditFeed | null;
        setFeed({
          total: typeof incoming?.total === "number" ? incoming.total : 0,
          items: Array.isArray(incoming?.items) ? incoming.items : [],
        });
      }
      setLoading(false);
    }
    void fetchFeed();
    return ()=>{active=false};
  },[tab,result,from,to,appliedSearch,page,revision]);

  const maxPage=Math.max(1,Math.ceil(feed.total/PAGE_SIZE));
  return <div className="logs-shell">
    <div className="logs-toolbar">
      <div className="logs-tabs" role="tablist" aria-label="Категория событий">
        {TABS.map(item=><button type="button" key={item.id} role="tab"
          aria-selected={tab===item.id}
          className={"logs-tab"+(tab===item.id?" logs-tab--active":"")}
          onClick={()=>{setTab(item.id);setPage(0)}}>{item.label}</button>)}
      </div>
      <div className="logs-filters">
        <label className="logs-filter">
          <span>С даты</span>
          <DateField value={from} onChange={e=>{setFrom(e.target.value);setPage(0)}} />
        </label>
        <label className="logs-filter">
          <span>По дату</span>
          <DateField value={to} min={from||undefined}
            onChange={e=>{setTo(e.target.value);setPage(0)}} />
        </label>
        <label className="logs-filter logs-filter-status">
          <span>Результат</span>
          <select value={result} disabled={tab==="error"}
            onChange={e=>{setResult(e.target.value);setPage(0)}}>
            <option value="all">Все</option>
            <option value="success">Успешно</option>
            <option value="warning">Предупреждение</option>
            <option value="error">Ошибка</option>
          </select>
        </label>
        <form className="logs-search" onSubmit={e=>{e.preventDefault();setAppliedSearch(query.trim());setPage(0)}}>
          <label htmlFor="logs-search-input">Поиск</label>
          <div className="logs-search-controls">
            <input id="logs-search-input" value={query} maxLength={100}
              placeholder="ЕНОТ, заказ, раздел, действие"
              onChange={e=>setQuery(e.target.value)} />
            <button type="submit">Найти</button>
          </div>
        </form>
        <button type="button" className="logs-reset"
          onClick={()=>{setFrom("");setTo("");setQuery("");setAppliedSearch("");setResult("all");setPage(0);refresh()}}>
          Сбросить
        </button>
        <button type="button" className="logs-reload" onClick={refresh}>Обновить</button>
      </div>
    </div>
    {error && <p className="logs-error" role="alert">{error}</p>}
    <div className="logs-table-viewport">
      <table className="logs-table">
        <colgroup>
          <col style={{width:"15%"}} />
          <col style={{width:"13%"}} />
          <col style={{width:"34%"}} />
          <col style={{width:"15%"}} />
          <col style={{width:"12%"}} />
          <col style={{width:"11%"}} />
        </colgroup>
        <thead><tr>
          <th>Дата и время</th><th>Раздел</th><th>Действие</th>
          <th>Сотрудник</th><th>Результат</th><th>Подробности</th>
        </tr></thead>
        <tbody>
          {!loading && feed.items.length===0 && <tr><td colSpan={6} className="logs-empty">
            {error ? "Журнал временно недоступен" : "По заданным фильтрам событий не найдено"}
          </td></tr>}
          {loading && <tr><td colSpan={6} className="logs-empty">Загружаем историю…</td></tr>}
          {!loading && feed.items.map(event=>{
            const caption = formatAuditEvent(event);
            const expanded = opened?.id === event.id;
            return <Fragment key={event.id}>
              <tr>
                <td className="logs-date">{formatTime(event.created_at)}</td>
                <td>{MODULES[event.module]||event.module}</td>
                <td className="logs-title">
                  <strong>{caption.title}</strong>
                  <span>{caption.subtitle}</span>
                </td>
                <td>{event.actor_name||"Система"}</td>
                <td><span className={"logs-status logs-status--"+event.result}>
                  {STATUSES[event.result]||event.result}
                </span></td>
                <td className="logs-details-cell">
                  <button type="button" className="logs-details-button"
                    aria-expanded={expanded}
                    onClick={()=>setOpened(expanded ? null : event)}>
                    {expanded ? "Скрыть" : "Открыть"}
                  </button>
                </td>
              </tr>
              {expanded && <tr className="logs-expanded-row">
                <td colSpan={6}>
                  <section className="logs-dialog logs-dialog-inline"
                    aria-label={"Подробности: "+caption.title}>
                    <header className="logs-dialog-header">
                      <div>
                        <span className="logs-dialog-eyebrow">{MODULES[event.module]||event.module} · {formatTime(event.created_at)}</span>
                        <h2>{caption.title}</h2>
                        <p>{caption.subtitle}</p>
                      </div>
                    </header>
                    <div className="logs-dialog-body">
                      <dl className="logs-dialog-meta">
                        <dt>Кто выполнил</dt><dd>{event.actor_name||"Система"}</dd>
                        <dt>Результат</dt><dd>{STATUSES[event.result]||event.result}</dd>
                        <dt>Тип объекта</dt><dd>{event.object_type}</dd>
                        <dt>Идентификатор</dt><dd>{event.object_id||"Нет"}</dd>
                        <dt>Системное действие</dt><dd>{event.action}</dd>
                      </dl>
                      {event.old_data && <div className="logs-dialog-section">
                        <h3>Было</h3><pre>{prettyJson(event.old_data)}</pre>
                      </div>}
                      {event.new_data && <div className="logs-dialog-section">
                        <h3>{event.old_data ? "Стало" : "Результат и параметры"}</h3>
                        <pre>{prettyJson(event.new_data)}</pre>
                      </div>}
                      {event.details && Object.keys(event.details).length > 0 &&
                        <div className="logs-dialog-section">
                          <h3>Дополнительная информация</h3>
                          <pre>{prettyJson(event.details)}</pre>
                        </div>}
                    </div>
                    <footer className="logs-dialog-footer">
                      <button type="button" onClick={()=>setOpened(null)}>Скрыть подробности</button>
                    </footer>
                  </section>
                </td>
              </tr>}
            </Fragment>;
          })}
        </tbody>
      </table>
    </div>
    <div className="logs-footer">
      <span>Найдено событий: <strong>{feed.total}</strong></span>
      <div className="logs-pagination">
        <button type="button" disabled={loading||page===0}
          onClick={()=>setPage(n=>Math.max(0,n-1))}>Назад</button>
        <span>Страница {page+1} из {maxPage}</span>
        <button type="button" disabled={loading||page+1>=maxPage}
          onClick={()=>setPage(n=>n+1)}>Далее</button>
      </div>
    </div>
  </div>;
}
