import {
  runChinaCalculation,
  simulateChinaTransport,
  saveChinaManualAdjustment,
  createVedOrderDraft,
} from "../actions";

import ThemeToggle from "../ThemeToggle";


// ============================================
// ТИП ТОВАРА
// ============================================

type ChinaItem = {
  calculation_item_id: string;

  offer_id: string;
  name: string | null;

  avg_sales_per_day: number;

  own_stock_quantity: number;
  ozon_stock_quantity: number;

  physical_stock: number;

  active_ved_quantity: number;
  effective_stock: number;

  coverage_days: number | null;


  // ==========================================
  // КОНТЕЙНЕР — СИСТЕМНЫЙ РАСЧЁТ
  // ==========================================

  container_order_units: number;
  container_cartons: number;
  container_final_units: number;
  container_order_volume_m3: number;


  // ==========================================
  // КОНТЕЙНЕР — РУЧНАЯ КОРРЕКТИРОВКА
  // ==========================================

  container_manual_quantity:
    number | null;

  container_manual_final_units:
    number | null;

  container_manual_volume_m3:
    number | null;

  container_manual_comment:
    string | null;


  // Итог после учёта ручной корректировки
  container_effective_final_units:
    number;

  container_effective_volume_m3:
    number;


  // ==========================================
  // ФУРА — СИСТЕМНЫЙ РАСЧЁТ
  // ==========================================

  truck_order_units: number;
  truck_cartons: number;
  truck_final_units: number;
  truck_order_volume_m3: number;


  // ==========================================
  // ФУРА — РУЧНАЯ КОРРЕКТИРОВКА
  // ==========================================

  truck_manual_quantity:
    number | null;

  truck_manual_final_units:
    number | null;

  truck_manual_volume_m3:
    number | null;

  truck_manual_comment:
    string | null;


  // Итог после учёта ручной корректировки
  truck_effective_final_units:
    number;

  truck_effective_volume_m3:
    number;
};


// ============================================
// ТИП ДАШБОРДА
// ============================================

type ChinaDashboard = {
  run: {
    id: string;

    calculated_at: string;

    calculation_version: string;

    sales_window_days: number;

    container_lead_days: number;

    truck_lead_days: number;

    safety_buffer_days: number;

    container_order_point_days: number;

    truck_order_point_days: number;
