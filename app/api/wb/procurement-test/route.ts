import { NextResponse } from "next/server";

import {
  calculateAverageDailySales,
  normalizeWarehouseRemains,
  getPhysicalWarehouseStocks,
  calculateNeed,
  WBOrder,
  WBRemainItem,
} from "../../../../lib/wb/procurement";

export const dynamic = "force-dynamic";

export async function GET() {
  const orders: WBOrder[] = [];

  // SKU 1001: 10 нормальных FBW-заказов
  for (let i = 0; i < 10; i++) {
    orders.push({
      nmId: 1001,
      supplierArticle: "Тестовый товар 1",
      warehouseName: "Склад WB РФ",
      warehouseType: "Склад WB",
      isCancel: false,
    });
  }

  // 2 отменённых заказа — не должны учитываться
  for (let i = 0; i < 2; i++) {
    orders.push({
      nmId: 1001,
      supplierArticle: "Тестовый товар 1",
      warehouseName: "Склад WB РФ",
      warehouseType: "Склад WB",
      isCancel: true,
    });
  }

  // 3 заказа со склада продавца — тоже не должны учитываться
  for (let i = 0; i < 3; i++) {
    orders.push({
      nmId: 1001,
      supplierArticle: "Тестовый товар 1",
      warehouseName: "Склад продавца",
      warehouseType: "Склад продавца",
      isCancel: false,
    });
  }

  // SKU 1002: 4 нормальных FBW-заказа
  for (let i = 0; i < 4; i++) {
    orders.push({
      nmId: 1002,
      supplierArticle: "Тестовый товар 2",
      warehouseName: "Склад WB РФ",
      warehouseType: "Склад WB",
      isCancel: false,
    });
  }

  // Средние продажи за 2 дня
  const averageSales = calculateAverageDailySales(orders, 2);

  const remains: WBRemainItem[] = [
    {
      vendorCode: "Тестовый товар 1",
      nmId: 1001,
      barcode: "1111111111111",
      techSize: "0",
      volume: 1,
      warehouses: [
        {
          warehouseName: "Всего находится на складах",
          quantity: 500,
        },
        {
          warehouseName: "Склад WB РФ",
          quantity: 100,
        },
        {
          warehouseName: "Коледино",
          quantity: 150,
        },
        {
          warehouseName: "Электросталь",
          quantity: 250,
        },
        {
          warehouseName: "В пути до получателей",
          quantity: 25,
        },
        {
          warehouseName: "В пути возвраты на склад WB",
          quantity: 5,
        },
      ],
    },
  ];

  const normalizedStocks =
    normalizeWarehouseRemains(remains);

  const physicalStocks =
    getPhysicalWarehouseStocks(normalizedStocks);

  const needTests = {
    // 200 / 5 = 40 дней → потребность 0
    moreThan30Days: calculateNeed(200, 5),

    // 20 / 5 = 4 дня → 5 × 30 = 150
    lessThan10Days: calculateNeed(20, 5),

    // 100 / 5 = 20 дней → (40 - 20) × 5 = 100
    between10And30Days: calculateNeed(100, 5),

    // Нет продаж
    noSales: calculateNeed(100, 0),

    // Ровно 30 дней → по текущей формуле:
    // (40 - 30) × 5 = 50
    exactly30Days: calculateNeed(150, 5),

    // Ровно 10 дней → по текущей формуле:
    // (40 - 10) × 5 = 150
    exactly10Days: calculateNeed(50, 5),
  };

  const sku1001 = averageSales.find(
    (item) => item.nmId === 1001
  );

  const sku1002 = averageSales.find(
    (item) => item.nmId === 1002
  );

  const checks = {
    sku1001OrdersShouldBe10:
      sku1001?.ordersCount === 10,

    sku1001DailySalesShouldBe5:
      sku1001?.dailySales === 5,

    sku1002OrdersShouldBe4:
      sku1002?.ordersCount === 4,

    sku1002DailySalesShouldBe2:
      sku1002?.dailySales === 2,

    physicalWarehousesShouldBe2:
      physicalStocks.length === 2,

    moreThan30NeedShouldBe0:
      needTests.moreThan30Days.need === 0,

    lessThan10NeedShouldBe150:
      needTests.lessThan10Days.need === 150,

    betweenNeedShouldBe100:
      needTests.between10And30Days.need === 100,

    noSalesNeedShouldBe0:
      needTests.noSales.need === 0,

    exactly30NeedShouldBe50:
      needTests.exactly30Days.need === 50,

    exactly10NeedShouldBe150:
      needTests.exactly10Days.need === 150,
  };

  const allChecksPassed =
    Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok: allChecksPassed,

    message: allChecksPassed
      ? "Все тесты расчёта закупа WB пройдены"
      : "В логике расчёта WB обнаружена ошибка",

    inputOrdersCount: orders.length,

    averageSales,
    normalizedStocks,
    physicalStocks,
    needTests,
    checks,
    allChecksPassed,
  });
}
