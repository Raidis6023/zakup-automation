export type YandexFinancialRow = {
  row: number;
  article: string;
  profit: number;
  revenue: number;
  buys: number;
};


const YANDEX_SEPTEMBER_DATA:
ReadonlyArray<YandexFinancialRow> =
[
  {
    "row": 2,
    "article": "AVD-WM528",
    "profit": 25877.85139737991,
    "revenue": 61163,
    "buys": 43
  },
  {
    "row": 3,
    "article": "Смеситель 031/032 белый, AVF-1194",
    "profit": 18074.22240174673,
    "revenue": 79808,
    "buys": 39
  },
  {
    "row": 4,
    "article": "Люстра 6 рожков",
    "profit": 15635.233362445433,
    "revenue": 121983,
    "buys": 63
  },
  {
    "row": 5,
    "article": "AVDSB-322G складной короб серый 2 шт",
    "profit": 13462.71183406112,
    "revenue": 80086,
    "buys": 63
  },
  {
    "row": 6,
    "article": "смеситель AVF-1191 пластик",
    "profit": 13092.699344978173,
    "revenue": 72314,
    "buys": 62
  },
  {
    "row": 7,
    "article": "AVD-WG528",
    "profit": 11617.443449781662,
    "revenue": 37881,
    "buys": 18
  },
  {
    "row": 8,
    "article": "AVDSB-322B складной короб коричневый 2 шт",
    "profit": 10683.151877729266,
    "revenue": 62644,
    "buys": 54
  },
  {
    "row": 9,
    "article": "AVDSB-322BG складной короб бежевый 2 шт",
    "profit": 10437.830349344978,
    "revenue": 66840,
    "buys": 57
  },
  {
    "row": 10,
    "article": "L25092304, белая с золотыми элементами",
    "profit": 10306.201484716155,
    "revenue": 36537,
    "buys": 7
  },
  {
    "row": 11,
    "article": "Термос 1",
    "profit": 9057.805414847193,
    "revenue": 67214,
    "buys": 36
  },
  {
    "row": 12,
    "article": "RMCA-1629",
    "profit": 9018.517379912662,
    "revenue": 39904,
    "buys": 46
  },
  {
    "row": 13,
    "article": "смеситель 1163B черный",
    "profit": 7075.874454148463,
    "revenue": 38720,
    "buys": 20
  },
  {
    "row": 14,
    "article": "L25092302, 8 рожков",
    "profit": 6858.583930130997,
    "revenue": 46250,
    "buys": 21
  },
  {
    "row": 15,
    "article": "смеситель AVF-1189 черный",
    "profit": 6773.700917030557,
    "revenue": 48596,
    "buys": 29
  },
  {
    "row": 16,
    "article": "смеситель 1163G серый",
    "profit": 6767.972445414842,
    "revenue": 40480,
    "buys": 22
  },
  {
    "row": 17,
    "article": "Смеситель 031/032 черный, AVF-1193",
    "profit": 6197.509432314415,
    "revenue": 35760,
    "buys": 20
  },
  {
    "row": 18,
    "article": "Смеситель 031/032 серый, AVF-1192",
    "profit": 6082.177423580797,
    "revenue": 37440,
    "buys": 21
  },
  {
    "row": 19,
    "article": "смеситель AVF-1187 хром",
    "profit": 6016.295982532749,
    "revenue": 31800,
    "buys": 6
  },
  {
    "row": 20,
    "article": "AVD-VP1",
    "profit": 5997.973362445417,
    "revenue": 16214,
    "buys": 55
  },
  {
    "row": 21,
    "article": "DM-GG85",
    "profit": 5839.960917030567,
    "revenue": 39366,
    "buys": 33
  },
  {
    "row": 22,
    "article": "AVDSB-B короб коричневый",
    "profit": 5800.489912663761,
    "revenue": 29326,
    "buys": 36
  },
  {
    "row": 23,
    "article": "AVD-WBG528",
    "profit": 5653.707947598257,
    "revenue": 25553,
    "buys": 13
  },
  {
    "row": 24,
    "article": "AVDSB-BL короб чёрный",
    "profit": 4599.668427947598,
    "revenue": 23581,
    "buys": 31
  },
  {
    "row": 25,
    "article": "смеситель 1152B черный",
    "profit": 4555.721441048034,
    "revenue": 38400,
    "buys": 23
  },
  {
    "row": 26,
    "article": "смеситель AVF-1190 хром",
    "profit": 4280.203973799125,
    "revenue": 21650,
    "buys": 11
  },
  {
    "row": 27,
    "article": "смеситель AVF-1185 хром",
    "profit": 4168.455414847158,
    "revenue": 83130,
    "buys": 30
  },
  {
    "row": 28,
    "article": "L25092303, c регулируемой высотой",
    "profit": 4163.115982532752,
    "revenue": 25732,
    "buys": 6
  },
  {
    "row": 29,
    "article": "DMGG96",
    "profit": 4140.332445414846,
    "revenue": 28854,
    "buys": 19
  },
  {
    "row": 30,
    "article": "DM-GG128",
    "profit": 3821.3624454148485,
    "revenue": 32490,
    "buys": 17
  },
  {
    "row": 31,
    "article": "смеситель 1152G серый",
    "profit": 3719.7774672489068,
    "revenue": 22203,
    "buys": 13
  },
  {
    "row": 32,
    "article": "смеситель 1163BG бежевый",
    "profit": 3689.2254585152805,
    "revenue": 30400,
    "buys": 16
  },
  {
    "row": 33,
    "article": "AVDSB-G короб серый",
    "profit": 3687.7554148471627,
    "revenue": 21406,
    "buys": 26
  },
  {
    "row": 34,
    "article": "смеситель 1163W белый",
    "profit": 3681.5499563318754,
    "revenue": 26400,
    "buys": 15
  },
  {
    "row": 35,
    "article": "7700",
    "profit": 3522.9028820960684,
    "revenue": 15098,
    "buys": 45
  },
  {
    "row": 36,
    "article": "смеситель AVF-1183 черный",
    "profit": 3494.363973799129,
    "revenue": 18480,
    "buys": 6
  },
  {
    "row": 37,
    "article": "AVDSB-BG короб бежевый",
    "profit": 3409.550436681224,
    "revenue": 18127,
    "buys": 22
  },
  {
    "row": 38,
    "article": "L25092401-GB, черная с золотом",
    "profit": 3162.4834061135407,
    "revenue": 26286,
    "buys": 13
  },
  {
    "row": 39,
    "article": "смеситель AVF-1188 черный",
    "profit": 3095.6889519650667,
    "revenue": 22740,
    "buys": 17
  },
  {
    "row": 40,
    "article": "H251126-2",
    "profit": 2512.4504803493446,
    "revenue": 7948,
    "buys": 5
  },
  {
    "row": 41,
    "article": "смеситель 1181C хром",
    "profit": 2416.675458515283,
    "revenue": 17250,
    "buys": 11
  },
  {
    "row": 42,
    "article": "AVD-P01",
    "profit": 2076.973624454069,
    "revenue": 75008,
    "buys": 172
  },
  {
    "row": 43,
    "article": "смеситель AVF-1184 хром",
    "profit": 2045.2699563318783,
    "revenue": 18250,
    "buys": 8
  },
  {
    "row": 44,
    "article": "AVDTB-1863a",
    "profit": 2010.9804803493444,
    "revenue": 10728,
    "buys": 2
  },
  {
    "row": 45,
    "article": "DM-P5846",
    "profit": 1991.3594759825319,
    "revenue": 13500,
    "buys": 8
  },
  {
    "row": 46,
    "article": "смеситель 1165C хром",
    "profit": 1714.156986899564,
    "revenue": 9346,
    "buys": 5
  },
  {
    "row": 47,
    "article": "VFC-1000",
    "profit": 1669.373973799129,
    "revenue": 15404,
    "buys": 10
  },
  {
    "row": 48,
    "article": "L25092401-B",
    "profit": 1665.9219650655032,
    "revenue": 15750,
    "buys": 8
  },
  {
    "row": 49,
    "article": "диффузор_тёплый хлопок",
    "profit": 1634.4009606986901,
    "revenue": 10950,
    "buys": 15
  },
  {
    "row": 50,
    "article": "диффузор_зимний лес",
    "profit": 1627.0869432314394,
    "revenue": 17520,
    "buys": 23
  },
  {
    "row": 51,
    "article": "АД100",
    "profit": 1503.7969432314403,
    "revenue": 15330,
    "buys": 18
  },
  {
    "row": 52,
    "article": "AVD-GS30B",
    "profit": 1292.9569868995636,
    "revenue": 6152,
    "buys": 3
  },
  {
    "row": 53,
    "article": "смеситель AVF-1186 хром+черный",
    "profit": 1255.3884716157208,
    "revenue": 13250,
    "buys": 3
  },
  {
    "row": 54,
    "article": "AVDTB-1865a",
    "profit": 1116.1534934497822,
    "revenue": 7638,
    "buys": 2
  },
  {
    "row": 55,
    "article": "смеситель 1168G серый",
    "profit": 919.0644978165938,
    "revenue": 1800,
    "buys": 1
  },
  {
    "row": 56,
    "article": "AVD-TH2 термос 2л",
    "profit": 852.5334934497819,
    "revenue": 5718,
    "buys": 2
  },
  {
    "row": 57,
    "article": "Сучкорез 77 см",
    "profit": 688.6344978165939,
    "revenue": 1405,
    "buys": 1
  },
  {
    "row": 58,
    "article": "диффузор_ноты бергамота",
    "profit": 656.0574672489074,
    "revenue": 10022,
    "buys": 13
  },
  {
    "row": 59,
    "article": "AVD - GS15",
    "profit": 647.9989519650662,
    "revenue": 12938,
    "buys": 13
  },
  {
    "row": 60,
    "article": "EW-21",
    "profit": 644.0464628820957,
    "revenue": 3680,
    "buys": 10
  },
  {
    "row": 61,
    "article": "диффузор_тёмно-красный сандал",
    "profit": 562.6079475982515,
    "revenue": 14234,
    "buys": 19
  },
  {
    "row": 62,
    "article": "AVDSB-633G корзина серая 60*35*35 см",
    "profit": 537.5534934497819,
    "revenue": 5400,
    "buys": 3
  },
  {
    "row": 63,
    "article": "AVD-W2",
    "profit": 392.9944978165938,
    "revenue": 1350,
    "buys": 1
  },
  {
    "row": 64,
    "article": "DM-GG5846",
    "profit": 203.75799126637548,
    "revenue": 2300,
    "buys": 1
  },
  {
    "row": 65,
    "article": "AVD-GS75B",
    "profit": 180.62449781659393,
    "revenue": 2999,
    "buys": 1
  },
  {
    "row": 66,
    "article": "AVDSB-633B коричневая 60*35*35 см",
    "profit": 178.784497816594,
    "revenue": 1800,
    "buys": 1
  },
  {
    "row": 67,
    "article": "AVDSB-633BG бежевая 60*35*35 см",
    "profit": 178.784497816594,
    "revenue": 1800,
    "buys": 1
  },
  {
    "row": 68,
    "article": "Топор1",
    "profit": 161.2889956331877,
    "revenue": 1242,
    "buys": 1
  },
  {
    "row": 69,
    "article": "AVD-680HM молоток 680 гр",
    "profit": 112.74449781659382,
    "revenue": 840,
    "buys": 1
  },
  {
    "row": 70,
    "article": "диффузор_шалфей и морская соль",
    "profit": 101.72148471615719,
    "revenue": 1460,
    "buys": 2
  },
  {
    "row": 71,
    "article": "AVDSB-322BL складной короб чёрный 2 шт",
    "profit": 101.07799126637553,
    "revenue": 1122,
    "buys": 1
  },
  {
    "row": 72,
    "article": "смеситель 1162W белый",
    "profit": 80.57449781659386,
    "revenue": 1300,
    "buys": 1
  },
  {
    "row": 73,
    "article": "AVDSB-236BG  корзина бежевая 21*39*60 см",
    "profit": 20.028995633187606,
    "revenue": 2430,
    "buys": 2
  },
  {
    "row": 74,
    "article": "H251126-3",
    "profit": 16.69598253275103,
    "revenue": 1452,
    "buys": 1
  },
  {
    "row": 75,
    "article": "0011-ф",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 76,
    "article": "0012-ф",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 77,
    "article": "301",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 78,
    "article": "AV-FS55O",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 79,
    "article": "AV-GS22BR",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 80,
    "article": "AV-GS23",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 81,
    "article": "AV-GS2GB",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 82,
    "article": "AV-GS2RB",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 83,
    "article": "AVA-1952",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 84,
    "article": "AVA-1953",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 85,
    "article": "AVD-GS50B",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 86,
    "article": "AVD-GS75R",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 87,
    "article": "AVD-NY150G",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 88,
    "article": "AVD-NY150GR",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 89,
    "article": "AVD-NY150S",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 90,
    "article": "AVD-W1",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 91,
    "article": "AVD-W3",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 92,
    "article": "AVDP-160B",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 93,
    "article": "AVDP-210B",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 94,
    "article": "AVDP-300B",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 95,
    "article": "AVDT-1909BY",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 96,
    "article": "AVDT-1909GY",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 97,
    "article": "AVDT-1910H",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 98,
    "article": "AVT332",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 99,
    "article": "CT6243",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 100,
    "article": "DM-GM5846",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 101,
    "article": "G30",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 102,
    "article": "GH-06",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 103,
    "article": "MRKT-01CK70S5",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 104,
    "article": "PK-195",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 105,
    "article": "RMCA-1635",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 106,
    "article": "RMCA-1643М",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 107,
    "article": "RMCA-1652",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 108,
    "article": "RMCA-1741",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 109,
    "article": "RMCA-822",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 110,
    "article": "RMCAH-0008",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 111,
    "article": "RMCAH-0010",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 112,
    "article": "RMCAH-0011",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 113,
    "article": "RMCAH-0012",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 114,
    "article": "RMCAH-0013",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 115,
    "article": "RMCAH-0014",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 116,
    "article": "RMCAH-0015",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 117,
    "article": "Suchkorez",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 118,
    "article": "AVP270",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 119,
    "article": "Вешалка 150 см",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 120,
    "article": "смеситель 1162G серый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 121,
    "article": "смеситель 1162B черный",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 122,
    "article": "Фитолампа 52,8 см",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 123,
    "article": "Ролл-штора белая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 124,
    "article": "Amistar 100 Л",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 125,
    "article": "AVT 3325",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 126,
    "article": "C-210 графит",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 127,
    "article": "Липкая лента от мух",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 128,
    "article": "AVD-TH5 термос 0,5л",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 129,
    "article": "смеситель 1169W белый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 130,
    "article": "Смеситель 031/032",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 131,
    "article": "RMCA-1046, секатор 18 см",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 132,
    "article": "Сучкорез малый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 133,
    "article": "Ролл-штора бежевая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 134,
    "article": "Сучкорез 73 см",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 135,
    "article": "Ролл-штора бежевая 50",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 136,
    "article": "Ролл-штора белая 50",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 137,
    "article": "AVDSB-236B корзина коричневая 21*39*60 см",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 138,
    "article": "Крышки 100+60",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 139,
    "article": "AVT432S, шатер болотный",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 140,
    "article": "смеситель 1169B черный",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 141,
    "article": "Зеркало для ванной",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 142,
    "article": "Контейнер для хранения корма 8л",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 143,
    "article": "Ролл-штора день/ночь RBYW-0549",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 144,
    "article": "Вешалка настенная самоклеящаяся",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 145,
    "article": "Ролл-штора бежевая 160",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 146,
    "article": "Сумка детская",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 147,
    "article": "ANTIMOSKITNAYA SETKA",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 148,
    "article": "Ролл-штора серая 160",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 149,
    "article": "Крючки настенные самоклеящиеся",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 150,
    "article": "Ролл-штора белая 160",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 151,
    "article": "Ролл-штора коричневая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 152,
    "article": "Смеситель 031/032 белый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 153,
    "article": "AVT432G, шатер серый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 154,
    "article": "Ролл-штора слоновая кость",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 155,
    "article": "20 шт винтовые",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 156,
    "article": "AVT222B, шатер черный",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 157,
    "article": "Лента Светодиод 5 м",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 158,
    "article": "L25092401-W, белая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 159,
    "article": "вак пак 10",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 160,
    "article": "Скатерть, тканевой основе ,Ракушки , темно-серая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 161,
    "article": "GH - 06",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 162,
    "article": "смеситель AVF-1182 хром",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 163,
    "article": "Бритва 31 касс",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 164,
    "article": "Лампа RGB",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 165,
    "article": "Швабра с распылителем ,комплект 2 насадки",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 166,
    "article": "Ролл-штора светло-серая 160",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 167,
    "article": "Ролл-штора светло-серая 50",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 168,
    "article": "Ролл-штора серая 50",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 169,
    "article": "Ролл-штора светло-серая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 170,
    "article": "AVTD2",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 171,
    "article": "корзина ива",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 172,
    "article": "Щетка автомобильная со скребком",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 173,
    "article": "Крючки настенные самоклеящиеся розовые",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 174,
    "article": "Бумага (пергамент) для выпечки силиконизированная",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 175,
    "article": "Газ 400 мл.",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 176,
    "article": "Скатерть ,тканевая основа ,цветочки,светло-бежевая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 177,
    "article": "смеситель 1168W белый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 178,
    "article": "лампа 1",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 179,
    "article": "Ролл-штора фисташковая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 180,
    "article": "L25092305, черная с золотыми элементами матовая",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 181,
    "article": "Р102",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 182,
    "article": "Самокат",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 183,
    "article": "СамокатГолубой",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 184,
    "article": "СамокатЖелтый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 185,
    "article": "СамокатКрасный",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 186,
    "article": "СамокатРозовый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 187,
    "article": "СамокатСиний",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 188,
    "article": "СамокатФиолетовый",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 189,
    "article": "бусы_прозрачные",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 190,
    "article": "бусы_сверкающие",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 191,
    "article": "бусы_серебристые",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 192,
    "article": "фитолампа",
    "profit": 0,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 193,
    "article": "H 109",
    "profit": -0.24,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 194,
    "article": "AVT222BG, Шатер бежевый",
    "profit": -3.92,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 195,
    "article": "AVD-GS50R, красный 50м",
    "profit": -39.09550218340611,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 196,
    "article": "AVD-GS30R",
    "profit": -65.65301310043651,
    "revenue": 1901,
    "buys": 1
  },
  {
    "row": 197,
    "article": "Смеситель 1142 хром",
    "profit": -103.18200873362446,
    "revenue": 0,
    "buys": 0
  },
  {
    "row": 198,
    "article": "AVDSB-236G корзина серая 21*39*60 см",
    "profit": -340.5510043668121,
    "revenue": 1600,
    "buys": 2
  },
  {
    "row": 199,
    "article": "Фонарь туристический",
    "profit": -2591.473013100436,
    "revenue": 6800,
    "buys": 1
  }
];


export function getYandexSeptemberRows():
YandexFinancialRow[] {
  return Array.from(
    YANDEX_SEPTEMBER_DATA
  );
}
