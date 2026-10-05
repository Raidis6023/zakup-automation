import { NextResponse } from "next/server";

import {
  calculateProcurementBySku,
  WBOrder,
  WBRemainItem,
} from "../../../../lib/wb/procurement";

export const dynamic = "force-dynamic";

export async function GET() {
  const orders: WBOrder[] = [];

  // ============================================================
  // SKU 1001
  // ============================================================
  // 10 нормальных FBW-заказов за 2 дня
  // Средние продажи = 5 шт./день
  // ============================================================

  for (let i = 0; i < 10; i++) {
    orders.push({
      nmId: 1001,
      supplierArticle: "Товар 1",
      warehouseName: "Склад WB РФ",
      warehouseType: "Склад WB",
      isCancel: false,
    });
  }

  // 2 отменённых — не должны учитываться
  for (let i = 0; i < 2; i++) {
    orders.push({
      nmId: 1001,
      supplierArticle: "Товар 1",
      warehouseName: "Склад WB РФ",
      warehouseType: "Склад WB",
      isCancel: true,
    });
  }

  // 3 заказа со склада продавца — тоже не учитываются
  for (let i = 0; i < 3; i++) {
    orders.push({
      nmId: 1001,
      supplierArticle: "Товар 1",
      warehouseName: "Склад продавца",
      warehouseType: "Склад продавца",
      isCancel: false,
    });
  }

  // ============================================================
  // SKU 1002
  // ============================================================
  // 4 нормальных FBW-заказа за 2 дня
  // Средние продажи = 2 шт./день
  // ============================================================

  for (let i = 0; i < 4; i++) {
    orders.push({
      nmId: 1002,
      supplierArticle: "Товар 2",
      warehouseName: "Склад WB РФ",
      warehouseType: "Склад WB",
      isCancel: false,
    });
  }

  // ============================================================
  // ОСТАТКИ
  // ============================================================

  const remains: WBRemainItem[] = [
    {
      vendorCode: "Товар 1",
      nmId: 1001,
      barcode: "1111111111111",
      techSize: "0",
      volume: 1,

      warehouses: [
        {
          warehouseName: "Всего находится на складах",
          quantity: 20,
        },
        {
          warehouseName: "Коледино",
          quantity: 8,
        },
        {
          warehouseName: "Электросталь",
          quantity: 12,
        },
      ],
    },

    {
      vendorCode: "Товар 2",
      nmId: 1002,
      barcode: "2222222222222",
      techSize: "0",
      volume: 1,

      warehouses: [
        {
          warehouseName: "Всего находится на складах",
          quantity: 100,
        },
        {
          warehouseName: "Коледино",
          quantity: 40,
        },
        {
          warehouseName: "Электросталь",
          quantity: 60,
        },
      ],
    },

    // Товар есть на складе, но продаж нет
    {
      vendorCode: "Товар 3",
      nmId: 1003,
      barcode: "3333333333333",
      techSize: "0",
      volume: 1,

      warehouses: [
        {
          warehouseName: "Всего находится на складах",
          quantity: 10,
        },
        {
          warehouseName: "Коледино",
          quantity: 10,
        },
      ],
    },
  ];

  // ============================================================
  // ИТОГОВЫЙ РАСЧЁТ
  // ============================================================

  const result = calculateProcurementBySku(
    orders,
    remains,
    2
  );

  const sku1001 = result.find(
    (item) => item.nmId === 1001
  );

  const sku1002 = result.find(
    (item) => item.nmId === 1002
  );

  const sku1003 = result.find(
    (item) => item.nmId === 1003
  );

  // ============================================================
  // ПРОВЕРКИ
  // ============================================================

  const checks = {
    // SKU 1001:
    // 10 заказов / 2 дня = 5 в день
    sku1001OrdersShouldBe10:
      sku1001?.ordersCount === 10,

    sku1001DailySalesShouldBe5:
      sku1001?.dailySales === 5,

    // Остаток = 20
    sku1001StockShouldBe20:
      sku1001?.totalStock === 20,

    // 20 / 5 = 4 дня
    sku1001DaysShouldBe4:
      sku1001?.daysOfStock === 4,

    // При запасе < 10 дней:
    // 5 × 30 = 150
    sku1001NeedShouldBe150:
      sku1001?.need === 150,

    // SKU 1002:
    // 4 / 2 = 2 в день
    sku1002DailySalesShouldBe2:
      sku1002?.dailySales === 2,

    // 100 / 2 = 50 дней
    sku1002DaysShouldBe50:
      sku1002?.daysOfStock === 50,

    // > 30 дней → потребность 0
    sku1002NeedShouldBe0:
      sku1002?.need === 0,

    // SKU 1003:
    // продаж нет
    sku1003DailySalesShouldBe0:
      sku1003?.dailySales === 0,

    sku1003NeedShouldBe0:
      sku1003?.need === 0,

    sku1003DaysShouldBeNull:
      sku1003?.daysOfStock === null,

    // Товар с максимальной потребностью
    // должен идти первым
    firstSkuShouldBe1001:
      result[0]?.nmId === 1001,
  };

  const allChecksPassed =
    Object.values(checks).every(Boolean);

  return NextResponse.json({
    ok: allChecksPassed,

    message: allChecksPassed
      ? "Итоговый расчёт потребности WB работает правильно"
      : "В итоговом расчёте потребности WB обнаружена ошибка",

    result,

    checks,

    allChecksPassed,
  });
}
