"use client";

import { useEffect, useState } from "react";
import styles from "./YandexFbySupplyPlanner.module.css";

type Status = {
  ok: boolean;
  verified: boolean;
  sourceFile: string | null;
  checkedAt: string | null;
  stale: boolean;
  activeOffers: number;
  matchedOffers: number;
  missingOffers: number;
  missingSamples: string[];
  headers: Array<{id:number;name:string}>;
  extraOffers: string[];
  ready: boolean;
  error?: string;
};

export default function YandexEligibilityPrecheck() {
  const [status, setStatus] = useState<Status | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/yandex/fby-eligibility", {cache:"no-store"});
        const data = await response.json() as Status;
        if (!response.ok || !data.ok) throw new Error(data.error || "Ошибка проверки");
        if (!cancelled) setStatus(data);
      } catch(e) {if (!cancelled) setError(e instanceof Error ? e.message : "Ошибка связи");}
    }
    void load();
    return () => { cancelled = true; };
  }, [version]);

  async function catalog() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/yandex/fby-eligibility?mode=catalog");
      if (!response.ok) throw new Error("Не удалось сформировать каталог всех SKU");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "yandex-fby-check-all-skus.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка скачивания");
    } finally {setBusy(false);}
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setResult("");
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/yandex/fby-eligibility", {method:"POST",body});
      const data = await response.json() as {ok:boolean;error?:string;checked?:number;activeOffers?:number;warehouses?:number;missing?:number};
      if (!data.ok || !response.ok) throw new Error(data.error || "Не удалось проверить матрицу");
      setResult("Импортировано: " + data.checked + " из " + data.activeOffers + " SKU; складов: " + data.warehouses +
        ". Непроверенных SKU: " + data.missing + ". " + (data.missing ? "Выгрузка поставки будет заблокирована до полной проверки." : "Допуски сохранены."));
      setFile(null);
      setVersion(v=>v+1);
      window.dispatchEvent(new Event("yandex-eligibility-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки Excel");
    } finally { setBusy(false); }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <div className={styles.tag}>ШАГ 1 · ПРОВЕРКА ДО РАСЧЁТА ПОТРЕБНОСТИ</div>
          <h2>Допуск всех SKU на склады Яндекс Маркета</h2>
          <p>Проверяем матрицу «да / нет» по каждому артикулу и складу. Остатки не подтверждают допуск: проверка производится по файлу из Яндекс Селлера.</p>
        </div>
        <button type="button" className={styles.secondary} onClick={()=>setVersion(v=>v+1)}>Обновить проверку</button>
      </div>

      {status && <div className={styles.facts}>
        <div><span>Активных SKU в каталоге</span><strong>{status.activeOffers}</strong></div>
        <div><span>Проверено по ЯМ</span><strong>{status.matchedOffers}</strong></div>
        <div><span>Без проверки</span><strong>{status.missingOffers}</strong></div>
        <div><span>Складов с ответом</span><strong>{status.headers.length}</strong></div>
      </div>}

      {status?.ready && !status.stale && <p className={styles.info}>Проверка по всему каталогу есть. Теперь можно рассчитывать потребность только для разрешённых сочетаний товар / склад.</p>}
      {status && (!status.ready || status.stale) &&
        <div className={styles.alertWarning}>
          <strong>{!status.verified ? "Матрица допусков пока не загружена." : !status.ready ? "Не все товары проверены." : "Матрица устарела."}</strong>
          {" "}До полной проверки сайт не будет выдавать поставку как подтверждённую.
          {status.missingSamples.length>0 && status.verified && <p>Примеры непроверенных артикулов: {status.missingSamples.slice(0,6).join(", ")}</p>}
        </div>
      }

      <p className={styles.meta}>
        {status?.checkedAt ? "Последняя проверка: " + new Date(status.checkedAt).toLocaleString("ru-RU") + " · " + status.sourceFile : "Нет загруженной матрицы."}
      </p>
      {status?.headers && status.headers.length > 0 && <p className={styles.meta}>Проверенные склады: {status.headers.map(h=>h.name).join("; ")}</p>}

      <div className={styles.info}>
        <strong>Как получить проверку:</strong> скачай проверочный Excel со всеми SKU, загрузи в Яндекс Селлер при создании мультипоставки,
        получи таблицу, где Яндекс выставил «да / нет» напротив каждого склада, и загрузи <strong>этот проверенный файл</strong> сюда.
        В проверочном файле стоит 1 шт. только для оценки доступности: <strong>не подтверждай эту тестовую поставку в Яндексе.</strong>
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.secondary} onClick={()=>void catalog()} disabled={busy}>
          Скачать все SKU для проверки
        </button>
        <div className={styles.actions}>
          <input
            aria-label="Проверенный Excel от Яндекс Маркета"
            type="file" accept=".xlsx" disabled={busy}
            onChange={e=>setFile(e.target.files?.[0] || null)}
          />
          <button type="button" className={styles.primary} disabled={!file||busy} onClick={()=>void upload()}>
            {busy ? "Обрабатываем…" : "Загрузить проверенную матрицу"}
          </button>
        </div>
      </div>
      {result && <p className={styles.info}>{result}</p>}
      {error && <p role="alert" className={styles.alertDanger}>{error}</p>}
    </section>
  );
}
