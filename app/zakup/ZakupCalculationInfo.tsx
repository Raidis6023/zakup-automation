type Rules = {
  sales_window_days?: number;
  container_order_point_days?: number;
  truck_order_point_days?: number;
  container_capacity_m3?: number;
  container_tolerance_m3?: number;
} | null;

export default function ZakupCalculationInfo({ rules }: { rules: Rules }) {
  const windowDays = rules?.sales_window_days ?? 28;
  const containerDays = rules?.container_order_point_days ?? 100;
  const truckDays = rules?.truck_order_point_days ?? 70;
  const containerCapacity = rules?.container_capacity_m3 ?? 68;
  const containerTolerance = containerCapacity + (rules?.container_tolerance_m3 ?? 0.5);

  return (
    <details className="zakup-calc-info">
      <summary
        className="zakup-calc-info-trigger"
        aria-label="Справка о расчёте потребности и транспорта"
        title="Правила расчёта"
      >i</summary>
      <div className="zakup-calc-info-panel">
        <strong className="zakup-calc-info-heading">Как считается закупка</strong>
        <dl>
          <div><dt>Продажи</dt><dd>{windowDays} дней, среднее за сутки</dd></div>
          <div><dt>Порог отбора</dt><dd>Запас меньше 60 дней продаж</dd></div>
          <div><dt>Контейнер</dt><dd>Пополнение до {containerDays} дней (90 + 10 буфер)</dd></div>
          <div><dt>Фура</dt><dd>Пополнение до {truckDays} дней (60 + 10 буфер)</dd></div>
          <div><dt>Вместимость</dt><dd>Контейнер {containerCapacity} м³ (до {containerTolerance.toLocaleString("ru-RU")} м³ на проверку), фура 90/100 м³</dd></div>
          <div><dt>Остатки</dt><dd>Склад, ОХ, три маркетплейса и заказы ВЭД, сопоставленные по ЕНОТ</dd></div>
          <div><dt>Кубатура</dt><dd>Из вложимости и габаритов транспортных коробок товаров с потребностью</dd></div>
        </dl>
        <p>Ozon и Яндекс Маркет: сохранённые ежедневные продажи. Wildberries: подтверждённые выкупы FBW (статус buyout, isMp=false) из «Ленты заказов». На ещё не проверенных датах временно используется завершённый финансовый отчёт WB без двойного учёта.</p>
        <p>Подтверждённые статусы WB обновляются автоматически по расписанию с учётом ограничений WB. Кнопка «Рассчитать потребность» не отправляет запросы в WB и использует только полностью проверенные данные. Если Лента недоступна, сохраняется резервный финансовый источник, а дата фактического периода указывается в результате.</p>
        <p>Включение товаров в заказ выбирается отдельно, в таблице «Потребность в закупке». После решения объём пересчитывается.</p>
      </div>
    </details>
  );
}
