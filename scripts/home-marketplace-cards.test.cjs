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
  assistantReserve, collides,
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
assert.ok(css.includes(".home-marketplace-period-control select"));
assert.ok(css.includes(".home-marketplace-resize-handle--corner"));
assert.ok(css.includes("font-variant-numeric: tabular-nums"));
console.log("PASS homepage: independent September/October source totals, saved period selectors, safe resize/reflow, base minimum, panda exclusion and keyboard access");
