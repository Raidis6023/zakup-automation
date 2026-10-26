// Run with Node >=22: node --experimental-strip-types --test scripts/tests/finance-diagnostics.test.cjs
const test = require("node:test");
const assert = require("node:assert/strict");
const { buildFinanceDiagnostics } = require("../../lib/ozon/financeDiagnostics.ts");

const complete = {
  from: "2026-10-18",
  to: "2026-10-24",
  missing_days: [],
  actual_buyouts_covered: true,
};
const row = (changes = {}) => ({
  offer_id: "sample-1",
  name: "Товар",
  unit_cost: 400,
  estimated_result: 100,
  data_gaps: [],
  ...changes,
});

test("does not create diagnostics without a report", () => {
  assert.deepEqual(buildFinanceDiagnostics(null, [row()]), []);
});

test("does not mistake absent cost for proven loss", () => {
  const signals = buildFinanceDiagnostics(complete, [
    row({ unit_cost: null, estimated_result: -5000 }),
  ]);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].severity, "blocking");
  assert.match(signals[0].title, /Себестоимость/);
});

test("zero estimated result is not an anomaly", () => {
  assert.deepEqual(buildFinanceDiagnostics(complete, [row({ estimated_result: 0 })]), []);
});

test("incomplete period prevents negative-result claim", () => {
  const signals = buildFinanceDiagnostics({
    ...complete, missing_days: ["2026-10-20"],
  }, [row({ estimated_result: -5000 })]);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].key, "period:missing");
});

test("buyout coverage prevents a negative result claim", () => {
  const signals = buildFinanceDiagnostics({
    ...complete, actual_buyouts_covered: false,
  }, [row({ estimated_result: -5000 })]);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].key, "period:buyouts");
});

test("known data gaps block monetary conclusions", () => {
  const signals = buildFinanceDiagnostics(complete, [
    row({ data_gaps: ["Не заполнена ТК Маяк"], estimated_result: -500 }),
  ]);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].severity, "blocking");
});

test("negative result is explicitly preliminary when inputs complete", () => {
  const signals = buildFinanceDiagnostics(complete, [
    row({ estimated_result: -366.95 }),
  ]);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].severity, "review");
  assert.match(signals[0].title, /Предварительный/);
  assert.match(signals[0].explanation, /не доказанный убыток/);
});

test("non-finite figures cannot produce negative-result claims", () => {
  assert.deepEqual(buildFinanceDiagnostics(complete, [
    row({ estimated_result: Number.NaN }),
  ]), []);
});
