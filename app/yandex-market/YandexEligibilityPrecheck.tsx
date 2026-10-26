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
  const [phase, setPhase] = useState("");

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
    setPhase("Проверяю разрешённые и запрещённые артикулы…");
    setResult("");
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/yandex/fby-eligibility", {method:"POST",body});
      const data = await response.json() as {ok:boolean;error?:string;checked?:number;activeOffers?:number;warehouses?:number;missing?:number};
      if (!data.ok || !response.ok) throw new Error(data.error || "Не удалось проверить матрицу");
      setFile(null);
      setVersion(v=>v+1);
      window.dispatchEvent(new Event("yandex-eligibility-updated"));
      setPhase("Сопоставляю ответы Яндекса с продажами, остатками и потребностью каждого кластера…");
      const planResponse = await fetch("/api/yandex/fby-supply-plan", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ mode: "plan", allowPartial: true, allowStale: true })
      });
      if (!planResponse.ok) {
        const detail = await planResponse.json().catch(() => ({})) as {error?:string};
        setResult("Матрица сохранена ("+data.checked+" SKU, "+data.warehouses+" складов), но Excel пока не сформирован: "
          +(detail.error || "Ошибка расчёта")+". Исправь исходные данные в панели ниже.");
        return;
      }
      const blob = await planResponse.blob();
      const link = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = link;
      a.download = "yandex-fby-plan-checked-" + new Date().toISOString().slice(0,10) + ".xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(link), 60000);
      setResult("Сверено "+data.checked+" SKU по "+data.warehouses+" складам. Excel с потребностью по кластерам, разрешёнными, запрещёнными и непроверенными товарами скачан. "
        + (data.missing ? "В каталоге ещё "+data.missing+" артикулов без проверки, они отдельно проверяются на наличие потребности." : "")
        + " Для загрузки в ЯМ используется отдельная кнопка «Excel для загрузки в ЯМ» ниже, она доступна только после проверки актуальности и отсутствия ошибок.");

    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки Excel");
    } finally { setBusy(false); setPhase(""); }
  }

  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <div className={styles.tag}>ШАГ 1 · ПРОВЕРКА ДО РАСЧЁТА ПОТРЕБНОСТИ</div>
          <h2>Загрузить проверку ЯМ → получить Excel по кластерам</h2>
          <p>Загружаешь файл с «да/нет» по складам, сайт сверяет его с потребностью и сразу скачивает расчётный Excel. Не надо отдельно запускать сопоставление.</p>
        </div>
        <button type="button" className={styles.secondary} onClick={()=>setVersion(v=>v+1)}>Обновить проверку</button>
      </div>

      {status && <div className={styles.facts}>
        <div><span>Активных SKU в каталоге</span><strong>{status.activeOffers}</strong></div>
        <div><span>Проверено по ЯМ</span><strong>{status.matchedOffers}</strong></div>
        <div><span>Без проверки</span><strong>{status.missingOffers}</strong></div>
        <div><span>Складов с ответом</span><strong>{status.headers.length}</strong></div>
      </div>}

      {status?.ready && !status.stale && <p className={styles.info}>Матрица Яндекс Маркета загружена. Непроверенные сочетания SKU и кластеров с потребностью будут показаны отдельно, в загрузочный Excel они не попадут.</p>}
      {status && (!status.ready || status.stale || status.missingOffers>0) &&
        <div className={styles.alertWarning}>
          <strong>{!status.verified ? "Матрица допусков пока не загружена." : status.stale ? "Последняя проверка старше 48 часов." : "Проверен не весь ассортимент."}</strong>
          {" "}Допускается файл только с товарами из текущей потребности. Если у SKU с потребностью нет подтверждения, он попадёт в «Не прошли проверку», а не в готовую поставку.
          {status.missingSamples.length>0 && status.verified && <p>Примеры без подтверждения: {status.missingSamples.slice(0,6).join(", ")}</p>}
        </div>
      }

      <p className={styles.meta}>
        {status?.checkedAt ? "Последняя проверка: " + new Date(status.checkedAt).toLocaleString("ru-RU") + " · " + status.sourceFile : "Нет загруженной матрицы."}
      </p>
      {status?.headers && status.headers.length > 0 && <p className={styles.meta}>Проверенные склады: {status.headers.map(h=>h.name).join("; ")}</p>}

      <div className={styles.info}>
        <strong>Как работает:</strong> скачай список SKU (или используй уже выгруженный из ЯМ файл по товарам на поставку), загрузи в Яндекс Селлер и получи отметки «да/нет» по складам.
        Верни проверенную таблицу сюда. Сайт сразу скачает Excel с итогами по кластерам и отдельными листами проблемных товаров.
        Проверочный файл с 1 шт. предназначен только для получения ограничений: <strong>не подтверждай тестовую поставку в Яндексе.</strong>
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.secondary} onClick={()=>void catalog()} disabled={busy}>
          Скачать все SKU для проверки
        </button>
        <div className={styles.actions}>
          <input
            key={version}
            aria-label="Проверенный Excel от Яндекс Маркета"
            type="file" accept=".xlsx" disabled={busy}
            onChange={e=>setFile(e.target.files?.[0] || null)}
          />
          <button type="button" className={styles.primary} disabled={!file||busy} onClick={()=>void upload()}>
            {busy ? "Проверяю и считаю…" : "Загрузить и получить Excel"}
          </button>
        </div>
      </div>
      {phase && <p aria-live="polite" className={styles.meta}>{phase}</p>}
      {result && <p className={styles.info}>{result}</p>}
      {error && <p role="alert" className={styles.alertDanger}>{error}</p>}
    </section>
  );
}
