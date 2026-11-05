/** Тарифы для воспроизведения юниток. Снимок справочников на 2026-11-03.
 * Обновление тарифов выполняется отдельно от формул, с версионированием.
 * НЕ считать юридически действующими ставками МП без проверки дат.
 */
export const logisticsTariffSnapshot = {
  "source": {
    "spreadsheetId": "1_fiAA9789kfHsn2FO5x7MUS07TiBaJJ1thgFbU1qf-E",
    "sourceTabs": [
      "Ozon Тарифы перевозки",
      "WB Тарифы",
      "ЯМ Юнитка",
      "ЯМ ЮНИТКА FBS"
    ],
    "capturedOn": "2026-11-03",
    "note": "Reference workbook snapshot, not verified current marketplace tariff schedule"
  },
  "ozon": {
    "shippingHigh": [
      [
        0,
        66.5
      ],
      [
        0.1,
        66.5
      ],
      [
        0.2,
        66.5
      ],
      [
        0.4,
        77.01
      ],
      [
        0.6,
        84.59
      ],
      [
        0.8,
        85
      ],
      [
        1,
        86.94
      ],
      [
        1.25,
        96
      ],
      [
        1.5,
        103.57
      ],
      [
        1.75,
        103.57
      ],
      [
        2,
        103.57
      ],
      [
        3,
        107.73
      ],
      [
        4,
        129.24
      ],
      [
        5,
        155.83
      ],
      [
        6,
        156.03
      ],
      [
        7,
        177
      ],
      [
        8,
        180.86
      ],
      [
        9,
        186.59
      ],
      [
        10,
        188.74
      ],
      [
        11,
        196.88
      ],
      [
        12,
        196.88
      ],
      [
        13,
        199.04
      ],
      [
        14,
        211.78
      ],
      [
        15,
        228.38
      ],
      [
        17,
        249.32
      ],
      [
        20,
        275.8
      ],
      [
        25,
        320.91
      ],
      [
        30,
        373.38
      ],
      [
        35,
        425.22
      ],
      [
        40,
        481.64
      ],
      [
        45,
        534.95
      ],
      [
        50,
        591.81
      ],
      [
        60,
        647.74
      ],
      [
        70,
        757.2
      ],
      [
        80,
        868.91
      ]
    ],
    "shippingLow": [
      [
        0,
        17.28
      ],
      [
        0.1,
        17.28
      ],
      [
        0.2,
        17.28
      ],
      [
        0.4,
        19.32
      ],
      [
        0.6,
        21.35
      ],
      [
        0.8,
        22.37
      ],
      [
        1,
        23.38
      ],
      [
        1.25,
        25.42
      ],
      [
        1.5,
        26.43
      ],
      [
        1.75,
        27.45
      ],
      [
        2,
        29.48
      ],
      [
        3,
        31.52
      ],
      [
        4,
        35.58
      ],
      [
        5,
        38.63
      ],
      [
        6,
        42.7
      ],
      [
        7,
        57.95
      ],
      [
        8,
        62.02
      ],
      [
        9,
        65.07
      ],
      [
        10,
        69.13
      ],
      [
        11,
        79.3
      ],
      [
        12,
        83.37
      ],
      [
        13,
        87.43
      ],
      [
        14,
        92.52
      ],
      [
        15,
        96.58
      ],
      [
        17,
        101.67
      ],
      [
        20,
        110.82
      ],
      [
        25,
        118.95
      ],
      [
        30,
        131.15
      ],
      [
        35,
        146.4
      ],
      [
        40,
        156.57
      ],
      [
        45,
        175.88
      ],
      [
        50,
        189.1
      ],
      [
        60,
        207.4
      ],
      [
        70,
        230.78
      ],
      [
        80,
        249.08
      ]
    ],
    "returnsExtraRub": 15.25,
    "receivingPerLiter": 4.444117647058824,
    "lastMileRate": 0.015,
    "lastMileMax": 25,
    "palletVolumeM3": 1.824,
    "palletFillRatio": 0.8,
    "palletTransportRub": 2500,
    "labelingPerPalletRub": 1000,
    "handlingFirstLiterRub": 5,
    "handlingExtraLiterRub": 1,
    "handlingMaxRub": 60
  },
  "wb": {
    "storageFirstLiterRub": 0.08,
    "storageExtraLiterRub": 0.08,
    "storageAverageDays": 45,
    "shippingTierRates": [
      [
        0.2,
        23
      ],
      [
        0.4,
        26
      ],
      [
        0.6,
        29
      ],
      [
        0.8,
        30
      ],
      [
        1,
        32
      ]
    ],
    "shippingAboveOneLiterBase": 46,
    "shippingExtraLiterRub": 14,
    "warehouseCoefficient": 1.7,
    "localizationCoefficient": 1,
    "revenuePercentage": 0,
    "storageBaseLiters": 1,
    "receiptPerLiterRub": 1.7,
    "receiptCoefficient": 1,
    "shipmentToMarketPerUnitRub": 15,
    "fbsReserveRub": 20
  },
  "ym": {
    "middleMileBaseRub": 92,
    "middleMileExtraThrough200Rub": 8,
    "middleMileExtraOver200Rub": 5,
    "middleMileMaxRub": 5500,
    "lastMileRate": 0.05,
    "lastMileMaxRub": 1000,
    "lowPriceThreshold": 300,
    "lowPriceMaxLiters": 5,
    "fulfillmentFbyRub": 15,
    "processingFbsRub": 25,
    "orderAcceptanceRub": 0.12,
    "mayakDefaultFbyRub": 15
  }
} as const;
