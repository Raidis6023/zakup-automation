// lib/wb/procurement.ts

// ============================================================
// ТИПЫ
// ============================================================

export type WBOrder = {
  nmId: number;
  supplierArticle?: string;
  warehouseName?: string;
  warehouseType?: string;
  isCancel?: boolean;
};

export type WBWarehouseRemain = {
  warehouseName: string;
  quantity: number;
};

export type WBRemainItem = {
  vendorCode: string;
  nmId: number;
  barcode: string;
  techSize?: string;
  volume?: number;
  warehouses: WBWarehouseRemain[];
};

export type WBDailySales = {
  nmId: number;
  supplierArticle: string;
  ordersCount: number;
  dailySales: number;
};

export type WBStockRow = {
  nmId: number;
  vendorCode: string;
  barcode: string;
  warehouseName: string;
  stock: number;

  warehouseType:
    | "physical"
    | "wbRussiaAggregate"
    | "total"
    | "toClient"
    | "returning";
};

export type WBNeedResult = {
  stock: number;
  dailySales: number;

  daysOfStock: number | null;

  need: number;

  rule:
    | "NO_SALES"
    | "MORE_THAN_30_DAYS"
    | "LESS_THAN_10_DAYS"
    | "BETWEEN_10_AND_30_DAYS";
};


// ============================================================
// 1. СРЕДНИЕ ПРОДАЖИ
// ============================================================

export function calculateAverageDailySales(
  orders: WBOrder[],
  days: number
): WBDailySales[] {
  if (days <= 0) {
    throw new Error("Количество дней должно быть больше 0");
  }

  const grouped = new Map<
    number,
    {
      supplierArticle: string;
      ordersCount: number;
    }
  >();

  for (const order of orders) {
    // Для автоматизации FBW нас интересует только склад WB.
    if (order.warehouseType !== "Склад WB") {
      continue;
    }

    // Отменённые заказы не считаем.
    if (order.isCancel === true) {
      continue;
    }

    const current = grouped.get(order.nmId);

    if (current) {
      current.ordersCount += 1;
    } else {
      grouped.set(order.nmId, {
        supplierArticle: order.supplierArticle ?? "",
        ordersCount: 1,
      });
    }
  }

  return Array.from(grouped.entries())
    .map(([nmId, value]) => ({
      nmId,
      supplierArticle: value.supplierArticle,
      ordersCount: value.ordersCount,
      dailySales: value.ordersCount / days,
    }))
    .sort((a, b) => b.dailySales - a.dailySales);
}


// ============================================================
// 2. РАЗБОР ОСТАТКОВ WB
// ============================================================

function detectWarehouseType(
  warehouseName: string
): WBStockRow["warehouseType"] {
  if (warehouseName === "Всего находится на складах") {
    return "total";
  }

  if (warehouseName === "В пути до получателей") {
    return "toClient";
  }

  if (warehouseName === "В пути возвраты на склад WB") {
    return "returning";
  }

  if (warehouseName === "Склад WB РФ") {
    return "wbRussiaAggregate";
  }

  return "physical";
}

export function normalizeWarehouseRemains(
  items: WBRemainItem[]
): WBStockRow[] {
  const rows: WBStockRow[] = [];

  for (const item of items) {
    for (const warehouse of item.warehouses ?? []) {
      rows.push({
        nmId: item.nmId,
        vendorCode: item.vendorCode,
        barcode: item.barcode,
        warehouseName: warehouse.warehouseName,
        stock: warehouse.quantity,
        warehouseType: detectWarehouseType(
          warehouse.warehouseName
        ),
      });
    }
  }

  return rows;
}


// ============================================================
// 3. ТОЛЬКО ФИЗИЧЕСКИЕ СКЛАДЫ
// ============================================================

export function getPhysicalWarehouseStocks(
  rows: WBStockRow[]
): WBStockRow[] {
  return rows.filter(
    (row) => row.warehouseType === "physical"
  );
}


// ============================================================
// 4. РАСЧЁТ ПОТРЕБНОСТИ
// ============================================================
//
// Формула пользователя:
//
// ЕСЛИ(Остатки / Продажи > 30;
//      0;
//      ЕСЛИ(
//        Остатки / Продажи < 10;
//        Продажи * 30;
//        (40 - Остатки / Продажи) * Продажи
//      )
// )
//
// Здесь dailySales = средние продажи в сутки.
//
// ============================================================

export function calculateNeed(
  stock: number,
  dailySales: number
): WBNeedResult {
  // Если продаж нет, потребность автоматически не создаём.
  if (dailySales <= 0) {
    return {
      stock,
      dailySales,
      daysOfStock: null,
      need: 0,
      rule: "NO_SALES",
    };
  }

  const daysOfStock = stock / dailySales;

  // Остатка больше чем на 30 дней.
  if (daysOfStock > 30) {
    return {
      stock,
      dailySales,
      daysOfStock,
      need: 0,
      rule: "MORE_THAN_30_DAYS",
    };
  }

  // Остатка меньше чем на 10 дней.
  if (daysOfStock < 10) {
    const need = dailySales * 30;

    return {
      stock,
      dailySales,
      daysOfStock,
      need,
      rule: "LESS_THAN_10_DAYS",
    };
  }

  // Остаток от 10 до 30 дней включительно.
  const need =
    (40 - daysOfStock) * dailySales;

  return {
    stock,
    dailySales,
    daysOfStock,
    need,
    rule: "BETWEEN_10_AND_30_DAYS",
  };
}
