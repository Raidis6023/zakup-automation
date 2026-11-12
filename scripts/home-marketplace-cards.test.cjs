const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const layoutSource = fs.readFileSync(path.join(root, "app/home-marketplace-layout.ts"), "utf8");
const output = ts.transpileModule(layoutSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", output)(mod, mod.exports);
const {
  METRIC_IDS, DEFAULT_SIZES, DEFAULT_SLOTS,
  CARD_HEIGHT, CARD_GAP, baseCardWidth, planCardLayout,
  assistantReserve, collides, resizeCardRectangle,
} = mod.exports;

const boardWidth = 1840;
const boardHeight = 680;
const viewportWidth = 1920;
const baseWidth = baseCardWidth(boardWidth);

function checkLayout(layout) {
  assert.ok(layout, "card layout must be feasible");
  const reserve = assistantReserve(boardWidth, boardHeight, viewportWidth);
  for (const id of METRIC_IDS) {
    const card = layout[id];
    assert.ok(card.width >= baseWidth, id + " width cannot drop below original");
    assert.ok(card.height >= CARD_HEIGHT, id + " height cannot drop below original");
    assert.ok(card.x >= 0 && card.y >= 0);
    assert.ok(card.x + card.width <= boardWidth + .5);
    assert.ok(card.y + card.height <= boardHeight + .5);
    assert.equal(collides(card, reserve), false, id + " must not cover panda");
    for (const other of METRIC_IDS) {
      if (other === id) continue;
      assert.equal(collides(card, layout[other], CARD_GAP - .01), false,
        id + " must not overlap " + other);
    }
  }
}

const start = planCardLayout(DEFAULT_SLOTS, DEFAULT_SIZES,
  boardWidth, boardHeight, viewportWidth);
checkLayout(start);
assert.deepEqual(METRIC_IDS.map(id => start[id].y), [0, 0, 0, 0]);
assert.deepEqual(METRIC_IDS.map(id => start[id].width), [baseWidth, baseWidth, baseWidth, baseWidth]);

const expanded = {
  ...DEFAULT_SIZES,
  all: { widthUnits: 1.6, height: 216 },
};
const resized = planCardLayout(DEFAULT_SLOTS, expanded,
  boardWidth, boardHeight, viewportWidth);
checkLayout(resized);
assert.ok(resized.all.width > start.all.width);
assert.equal(resized.all.height, 216);
assert.ok(METRIC_IDS.some(id => id !== "all" && resized[id].y > 0),
  "enlarging a tile must reflow remaining tiles rather than overlap");

const swapped = { ...DEFAULT_SLOTS, all: 2, wildberries: 0 };
checkLayout(planCardLayout(swapped, DEFAULT_SIZES,
  boardWidth, boardHeight, viewportWidth));
assert.equal(planCardLayout(DEFAULT_SLOTS, DEFAULT_SIZES, 0, 100, viewportWidth), null);


const ozonOriginal = start.ozon;
const leftExpanded = resizeCardRectangle(
  ozonOriginal, "left", -90, 0, baseWidth, boardWidth, boardHeight,
);
assert.equal(leftExpanded.x, ozonOriginal.x - 90);
assert.equal(leftExpanded.width, ozonOriginal.width + 90);
assert.equal(leftExpanded.x + leftExpanded.width, ozonOriginal.x + ozonOriginal.width,
  "resizing left must preserve the opposite (right) edge");
const leftSizes = {
  ...DEFAULT_SIZES,
  ozon: { widthUnits: leftExpanded.width / baseWidth, height: leftExpanded.height },
};
const leftOrigins = {
  ozon: { x: leftExpanded.x / boardWidth, y: leftExpanded.y / boardHeight },
};
const leftLayout = planCardLayout(
  DEFAULT_SLOTS, leftSizes, boardWidth, boardHeight, viewportWidth,
  leftOrigins, "ozon",
);
checkLayout(leftLayout);
assert.ok(Math.abs(leftLayout.ozon.x - leftExpanded.x) <= 1);
assert.ok(METRIC_IDS.some(id => id !== "ozon" && leftLayout[id].y > 0),
  "left resize must reflow neighbours");

const originallyLower = { ...ozonOriginal, y: 175 };
const topExpanded = resizeCardRectangle(
  originallyLower, "top", 0, -55, baseWidth, boardWidth, boardHeight,
);
assert.equal(topExpanded.y, 120);
assert.equal(topExpanded.height, CARD_HEIGHT + 55);
assert.equal(topExpanded.y + topExpanded.height,
  originallyLower.y + originallyLower.height,
  "resizing top must preserve bottom edge");
const topSizes = {
  ...DEFAULT_SIZES,
  ozon: { widthUnits: 1, height: topExpanded.height },
};
const topOrigins = {
  ozon: { x: topExpanded.x / boardWidth, y: topExpanded.y / boardHeight },
};
checkLayout(planCardLayout(
  DEFAULT_SLOTS, topSizes, boardWidth, boardHeight, viewportWidth,
  topOrigins, "ozon",
));
const minLeft = resizeCardRectangle(
  ozonOriginal, "left", 10000, 0, baseWidth, boardWidth, boardHeight,
);
assert.equal(minLeft.width, baseWidth);
const minTop = resizeCardRectangle(
  originallyLower, "top", 0, 10000, baseWidth, boardWidth, boardHeight,
);
assert.equal(minTop.height, CARD_HEIGHT);

const homepage = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
const component = fs.readFileSync(path.join(root, "app/HomeMarketplaceCards.tsx"), "utf8");
const css = fs.readFileSync(path.join(root, "app/home.css"), "utf8");
for (const expected of [
  "getOzonOctoberRows", "getWbOctoberRows", "getYandexOctoberRows",
  "getOzonSeptemberRows", "getWbSeptemberRows", "getYandexSeptemberRows",
]) assert.ok(homepage.includes(expected), "missing dataset: " + expected);
for (const expected of [
  "2026-09", "2026-10", "Сентябрь", "Октябрь",
  "PERIOD_STORAGE_KEY", "SIZES_STORAGE_KEY", "onPointerDown",
  "home-marketplace-resize-handle",
]) assert.ok(component.includes(expected), "missing interaction: " + expected);
assert.ok(component.includes("home-marketplace-month-menu"), "styled month listbox missing");
assert.ok(component.includes("aria-haspopup=\"listbox\""), "period trigger must have listbox semantics");
assert.ok(!component.includes("<select"), "never render native Windows month dropdown");
assert.ok(css.includes(".home-marketplace-month-option"));
for (const side of ["top", "left", "bottom", "right", "top-left", "top-right", "bottom-left", "bottom-right"]) {
  assert.ok(css.includes(".home-marketplace-resize-handle--" + side), "missing resize edge " + side);
  assert.ok(component.includes('["' + side + '"'), "missing React resize control " + side);
}
assert.ok(css.includes("overflow: clip !important"), "tile must never show native scrollbars");
assert.ok(css.includes("content: none !important"), "remove decorative resize corners");
assert.ok(css.includes("font-variant-numeric: tabular-nums"));
console.log("PASS homepage: themed period menu, 8 invisible resize edges, left/top fixed-opposite-edge geometry, reflow, no scrollbars, persisted data");
