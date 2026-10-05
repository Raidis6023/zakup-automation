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

export type WBSkuProcurementResult = {
  nmId: number;
  supplierArticle: string;
  vendorCode: string;
  barcode: string;

  ordersCount: number;
  dailySales: number;

  totalStock: number;

  daysOfStock: number | null;
  need: number;

  rule: WBNeedResult["rule"];
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
    // Берём только FBW.
    if (order.warehouseType !== "Склад WB") {
      continue;
    }

    // Отменённые заказы исключаем.
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
// 2. РАЗБОР ОСТАТКОВ
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
// 4. ОБЩИЙ ОСТАТОК SKU
// ============================================================
//
// Используем строку WB:
// "Всего находится на складах"
//
// НЕ складываем физические склады вручную,
// чтобы не получить двойной учёт.
// ============================================================

export function getTotalStockBySku(
  items: WBRemainItem[]
): Map<number, number> {
  const result = new Map<number, number>();

  for (const item of items) {
    const totalRow = item.warehouses?.find(
      (warehouse) =>
        warehouse.warehouseName ===
        "Всего находится на складах"
    );

    result.set(
      item.nmId,
      totalRow?.quantity ?? 0
    );
  }

  return result;
}


// ============================================================
// 5. РАСЧЁТ ПОТРЕБНОСТИ
// ============================================================
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
// ============================================================

export function calculateNeed(
  stock: number,
  dailySales: number
): WBNeedResult {
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

  if (daysOfStock > 30) {
    return {
      stock,
      dailySales,
      daysOfStock,
      need: 0,
      rule: "MORE_THAN_30_DAYS",
    };
  }

  if (daysOfStock < 10) {
    return {
      stock,
      dailySales,
      daysOfStock,
      need: dailySales * 30,
      rule: "LESS_THAN_10_DAYS",
    };
  }

  return {
    stock,
    dailySales,
    daysOfStock,
    need:
      (40 - daysOfStock) * dailySales,
    rule: "BETWEEN_10_AND_30_DAYS",
  };
}


// ============================================================
// 6. ИТОГОВЫЙ РАСЧЁТ ПО SKU
// ============================================================

export function calculateProcurementBySku(
  orders: WBOrder[],
  remains: WBRemainItem[],
  days: number
): WBSkuProcurementResult[] {
  const sales =
    calculateAverageDailySales(orders, days);

  const salesMap = new Map(
    sales.map((item) => [item.nmId, item])
  );

  const totalStocks =
    getTotalStockBySku(remains);

  const result: WBSkuProcurementResult[] = [];

  // Берём ассортимент из остатков WB.
  for (const item of remains) {
    const sale = salesMap.get(item.nmId);

    const ordersCount =
      sale?.ordersCount ?? 0;

    const dailySales =
      sale?.dailySales ?? 0;

    const totalStock =
      totalStocks.get(item.nmId) ?? 0;

    const needResult =
      calculateNeed(totalStock, dailySales);

    result.push({
      nmId: item.nmId,

      supplierArticle:
        sale?.supplierArticle ??
        item.vendorCode ??
        "",

      vendorCode:
        item.vendorCode ?? "",

      barcode:
        item.barcode ?? "",

      ordersCount,
      dailySales,

      totalStock,

      daysOfStock:
        needResult.daysOfStock,

      need:
        needResult.need,

      rule:
        needResult.rule,
    });
  }

  return result.sort((a, b) => {
    // Сначала товары, которым требуется поставка.
    if (a.need !== b.need) {
      return b.need - a.need;
    }

    return b.dailySales - a.dailySales;
  });
}
