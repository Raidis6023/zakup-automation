export const MAX_BOXES_PER_REQUEST = 30;
export const MAX_PALLETS_PER_REQUEST = 40;

const PALLET_LENGTH_MM = 1200;
const PALLET_WIDTH_MM = 800;
const PALLET_USABLE_HEIGHT_MM = 2055;

const CLUSTER_THRESHOLDS_LITRES: Record<string, number> = {
  "воронеж": 722.0000000000001,
  "самара": 847.6923076923077,
  "саратов": 771.8750000000001,
  "беларусь": 331.06060606060606,
  "тюмень": 907.7777777777778,
  "уфа": 868.5714285714286,
  "казань": 760,
  "дальний восток": 1002.3622047244094,
  "калининград": 862.3076923076922,
  "красноярск": 871.7647058823529,
  "москва мо и дальние регионы": 550,
  "санкт петербург и сзо": 794.5454545454547,
  "ярославль": 678.5714285714287,
  "краснодар": 897.2222222222223,
  "екатеринбург": 950.0000000000001,
  "оренбург": 827.0588235294117,
  "новосибирск": 889.3617021276593,
  "тверь": 602.439024390244,
  "ростов": 860.9375000000001,
  "пермь": 831.25,
  "омск": 846.987951807229,
  "алматы": 492.59259259259255,
  "астана": 492.59259259259255,
  "невинномысск": 836.0000000000001,
  "махачкала": 856.043956043956,
};

export type CargoItem = {
  sku: number;
  offer_id: string;
  barcode: string | null;
  quantity: number;
  quant: number;
};

export type CartonUnit = CargoItem & {
  placement_zone: string;
  volume_litres: number;
  weight_kg: number | null;
  dimensions: [number, number, number] | null;
};

export type PlannedCargo = {
  key: string;
  type: "BOX" | "PALLET";
  placement_zone: string;
  items: CargoItem[];
  carton_count: number;
  volume_litres: number;
  weight_kg: number | null;
  packed_height_mm: number | null;
  cartons: CartonUnit[];
};

type OrientedCarton = CartonUnit & {
  oriented: {
    width: number;
    depth: number;
    height: number;
  };
};

type Row = { depth: number; usedWidth: number };
type Layer = {
  height: number;
  usedDepth: number;
  rows: Row[];
  cartons: OrientedCarton[];
};
type PackedPallet = {
  height: number;
  layers: Layer[];
  cartons: OrientedCarton[];
};

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function thresholdForCluster(clusterName: string) {
  const normalized = normalizeName(clusterName);
  const exact = CLUSTER_THRESHOLDS_LITRES[normalized];
  if (Number.isFinite(exact)) return exact;

  const fuzzy = Object.entries(CLUSTER_THRESHOLDS_LITRES).find(
    ([key]) => normalized.includes(key) || key.includes(normalized),
  );
  if (fuzzy) return fuzzy[1];

  throw new Error(
    `Для кластера «${clusterName}» нет порога BOX/PALLET в тарифной матрице`,
  );
}

function sanitize(value: string) {
  return normalizeName(value).replace(/\s+/g, "-").slice(0, 28) || "zone";
}

function chooseOrientation(
  dimensions: [number, number, number],
): OrientedCarton["oriented"] | null {
  const sorted = [...dimensions].sort((a, b) => a - b);
  const smallest = sorted[0];
  const largest = sorted[2];

  // Старое правило из расчёта: если один размер минимум в 2 раза меньше
  // другого, самым маленьким размером ставим короб по высоте.
  const allowedHeights =
    largest >= smallest * 2
      ? dimensions
          .map((value, index) => ({ value, index }))
          .filter(({ value }) => value === smallest)
          .map(({ index }) => index)
      : [0, 1, 2];

  const candidates: Array<OrientedCarton["oriented"] & { score: number }> = [];

  for (const heightIndex of allowedHeights) {
    const height = dimensions[heightIndex];
    if (height > PALLET_USABLE_HEIGHT_MM) continue;

    const base = dimensions.filter((_, index) => index !== heightIndex);
    for (const [width, depth] of [
      [base[0], base[1]],
      [base[1], base[0]],
    ] as Array<[number, number]>) {
      if (width > PALLET_LENGTH_MM || depth > PALLET_WIDTH_MM) continue;

      const perLayer =
        Math.floor(PALLET_LENGTH_MM / width) *
        Math.floor(PALLET_WIDTH_MM / depth);
      const layers = Math.floor(PALLET_USABLE_HEIGHT_MM / height);
      candidates.push({ width, depth, height, score: perLayer * layers });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.height - b.height);
  const winner = candidates[0];
  return winner
    ? { width: winner.width, depth: winner.depth, height: winner.height }
    : null;
}

function tryPlace(layer: Layer, carton: OrientedCarton) {
  const variants: Array<[number, number]> = [
    [carton.oriented.width, carton.oriented.depth],
    [carton.oriented.depth, carton.oriented.width],
  ];

  for (const [width, depth] of variants) {
    if (width > PALLET_LENGTH_MM || depth > PALLET_WIDTH_MM) continue;

    for (const row of layer.rows) {
      if (
        depth <= row.depth &&
        row.usedWidth + width <= PALLET_LENGTH_MM
      ) {
        row.usedWidth += width;
        layer.cartons.push(carton);
        return true;
      }
    }

    if (layer.usedDepth + depth <= PALLET_WIDTH_MM) {
      layer.rows.push({ depth, usedWidth: width });
      layer.usedDepth += depth;
      layer.cartons.push(carton);
      return true;
    }
  }

  return false;
}

function packPallets(cartons: CartonUnit[]) {
  const oriented = cartons
    .map((carton): OrientedCarton | null => {
      if (!carton.dimensions) return null;
      const orientation = chooseOrientation(carton.dimensions);
      return orientation ? { ...carton, oriented: orientation } : null;
    })
    .filter((carton): carton is OrientedCarton => carton !== null)
    .sort(
      (a, b) =>
        b.oriented.height - a.oriented.height ||
        b.oriented.width * b.oriented.depth -
          a.oriented.width * a.oriented.depth,
    );

  const pallets: PackedPallet[] = [];

  for (const carton of oriented) {
    let placed = false;

    for (const pallet of pallets) {
      for (const layer of pallet.layers) {
        if (
          carton.oriented.height <= layer.height &&
          tryPlace(layer, carton)
        ) {
          pallet.cartons.push(carton);
          placed = true;
          break;
        }
      }
      if (placed) break;

      if (
        pallet.height + carton.oriented.height <=
        PALLET_USABLE_HEIGHT_MM
      ) {
        const layer: Layer = {
          height: carton.oriented.height,
          usedDepth: 0,
          rows: [],
          cartons: [],
        };
        if (tryPlace(layer, carton)) {
          pallet.layers.push(layer);
          pallet.height += carton.oriented.height;
          pallet.cartons.push(carton);
          placed = true;
          break;
        }
      }
    }

    if (!placed) {
      const layer: Layer = {
        height: carton.oriented.height,
        usedDepth: 0,
        rows: [],
        cartons: [],
      };
      if (!tryPlace(layer, carton)) continue;
      pallets.push({
        height: carton.oriented.height,
        layers: [layer],
        cartons: [carton],
      });
    }
  }

  return pallets;
}

function aggregateItems(cartons: CartonUnit[]): CargoItem[] {
  const map = new Map<string, CargoItem>();

  for (const carton of cartons) {
    const key = [
      carton.sku,
      carton.offer_id,
      carton.quant,
      carton.barcode ?? "",
    ].join("|");

    const current = map.get(key);
    if (current) {
      current.quantity += carton.quantity;
    } else {
      map.set(key, {
        sku: carton.sku,
        offer_id: carton.offer_id,
        barcode: carton.barcode,
        quantity: carton.quantity,
        quant: carton.quant,
      });
    }
  }

  return Array.from(map.values());
}

function boxCargo(
  carton: CartonUnit,
  orderId: number,
  supplyId: number,
  index: number,
): PlannedCargo {
  return {
    key: [
      "auto-fbo",
      orderId,
      supplyId,
      "box",
      sanitize(carton.placement_zone),
      index,
    ].join("-"),
    type: "BOX",
    placement_zone: carton.placement_zone,
    items: [
      {
        sku: carton.sku,
        offer_id: carton.offer_id,
        barcode: carton.barcode,
        quantity: carton.quantity,
        quant: carton.quant,
      },
    ],
    carton_count: 1,
    volume_litres: carton.volume_litres,
    weight_kg: carton.weight_kg,
    packed_height_mm: null,
    cartons: [carton],
  };
}

function palletCargo(
  pallet: PackedPallet,
  placementZone: string,
  orderId: number,
  supplyId: number,
  index: number,
): PlannedCargo {
  return {
    key: [
      "auto-fbo",
      orderId,
      supplyId,
      "pallet",
      sanitize(placementZone),
      index,
    ].join("-"),
    type: "PALLET",
    placement_zone: placementZone,
    items: aggregateItems(pallet.cartons),
    carton_count: pallet.cartons.length,
    volume_litres: pallet.cartons.reduce(
      (sum, carton) => sum + carton.volume_litres,
      0,
    ),
    weight_kg: pallet.cartons.every(
      (carton) => carton.weight_kg !== null,
    )
      ? pallet.cartons.reduce(
          (sum, carton) => sum + (carton.weight_kg ?? 0),
          0,
        )
      : null,
    packed_height_mm: pallet.height + 145,
    cartons: pallet.cartons,
  };
}

export function planCargoesForZone({
  cartons,
  thresholdLitres,
  orderId,
  supplyId,
}: {
  cartons: CartonUnit[];
  thresholdLitres: number;
  orderId: number;
  supplyId: number;
}) {
  if (cartons.length === 0) return [] as PlannedCargo[];

  const zone = cartons[0].placement_zone || "UNRESOLVED";
  const zoneLitres = cartons.reduce(
    (sum, carton) => sum + carton.volume_litres,
    0,
  );

  // Не превращаем неизвестную зону в паллету наугад.
  if (
    ["UNSPECIFIED", "UNRESOLVED"].includes(zone) ||
    zoneLitres < thresholdLitres
  ) {
    return cartons.map((carton, index) =>
      boxCargo(carton, orderId, supplyId, index + 1),
    );
  }

  const palletizable = cartons.filter(
    (carton) =>
      carton.dimensions !== null &&
      chooseOrientation(carton.dimensions) !== null,
  );
  const forcedBoxes = cartons.filter(
    (carton) => !palletizable.includes(carton),
  );

  // После исключения коробов без пригодных габаритов экономика могла измениться.
  const palletizableLitres = palletizable.reduce(
    (sum, carton) => sum + carton.volume_litres,
    0,
  );
  if (palletizableLitres < thresholdLitres) {
    return cartons.map((carton, index) =>
      boxCargo(carton, orderId, supplyId, index + 1),
    );
  }

  const pallets = packPallets(palletizable);
  const palletCargoes: PlannedCargo[] = [];
  const fallbackBoxes: CartonUnit[] = [...forcedBoxes];

  let palletIndex = 1;
  for (const pallet of pallets) {
    const litres = pallet.cartons.reduce(
      (sum, carton) => sum + carton.volume_litres,
      0,
    );

    // Каждая физическая паллета должна сама быть выгоднее коробочной тарификации.
    if (litres >= thresholdLitres) {
      palletCargoes.push(
        palletCargo(pallet, zone, orderId, supplyId, palletIndex++),
      );
    } else {
      fallbackBoxes.push(...pallet.cartons);
    }
  }

  const boxCargoes = fallbackBoxes.map((carton, index) =>
    boxCargo(carton, orderId, supplyId, index + 1),
  );

  return [...palletCargoes, ...boxCargoes];
}


export function summarizeCargoes(
  cargoes: PlannedCargo[],
) {
  const palletGm = cargoes.filter(
    (cargo) => cargo.type === "PALLET",
  ).length;

  const boxCargoes = cargoes.filter(
    (cargo) => cargo.type === "BOX",
  );

  const allCartons = cargoes.flatMap(
    (cargo) => cargo.cartons,
  );

  const totalVolumeLitres = allCartons.reduce(
    (sum, carton) => sum + carton.volume_litres,
    0,
  );

  const knownWeightKg = allCartons.reduce(
    (sum, carton) => sum + (carton.weight_kg ?? 0),
    0,
  );

  const missingWeightCartons = allCartons.filter(
    (carton) => carton.weight_kg === null,
  ).length;

  const boxCartons = boxCargoes.flatMap(
    (cargo) => cargo.cartons,
  );

  const transportPallets = packPallets(
    boxCartons,
  );

  const transportPlacedBoxes = transportPallets.reduce(
    (sum, pallet) => sum + pallet.cartons.length,
    0,
  );

  const transportUnplacedBoxes =
    boxCartons.length - transportPlacedBoxes;

  const palletHeights = [
    ...cargoes
      .filter(
        (cargo) =>
          cargo.type === "PALLET" &&
          cargo.packed_height_mm !== null,
      )
      .map(
        (cargo) => cargo.packed_height_mm as number,
      ),
    ...transportPallets.map(
      (pallet) => pallet.height + 145,
    ),
  ];

  return {
    pallet_gm: palletGm,
    box_gm: boxCargoes.length,
    transport_pallets_for_boxes: transportPallets.length,
    total_volume_litres: totalVolumeLitres,
    total_weight_kg:
      missingWeightCartons === 0
        ? knownWeightKg
        : null,
    known_weight_kg: knownWeightKg,
    missing_weight_cartons: missingWeightCartons,
    transport_unplaced_boxes: transportUnplacedBoxes,
    max_height_mm:
      palletHeights.length > 0
        ? Math.max(...palletHeights)
        : null,
  };
}
