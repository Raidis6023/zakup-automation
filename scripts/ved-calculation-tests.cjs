const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");

const raw = fs.readFileSync("lib/ved-calculation/engine.ts", "utf8");
const js = ts.transpileModule(raw, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  reportDiagnostics: true,
});
assert.ok(!js.diagnostics.some((d) => d.category === ts.DiagnosticCategory.Error));
const mod = { exports: {} };
new Function("module", "exports", "require", js.outputText)(mod, mod.exports, require);
const { calculateVed, validateVedInput, VedInputError } = mod.exports;
const near = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) < tolerance, String(actual) + " != " + expected);
};
const base = () => ({
  product: { unitPriceCny: 4.77, unitsPerCarton: 100, cartonVolumeM3: 0.1031745, cartonGrossKg: 16.8, moqUnits: 4584 },
  currency: { cnyRub: 13.5, eurRub: 95 },
  container: { usableVolumeM3: 68, maxPayloadKg: 26000 },
  expenses: {
    freightBeforeBorderRub: 500000,
    freightAfterBorderRub: 300000,
    bankCommissionRub: 10000,
    brokerServicesRub: 15000,
    customsOperationsFeeRub: 0,
    otherSharedRub: 0,
    otherRubPerUnit: 0,
    refundableSecurityRub: 0,
  },
  customs: {
    dutyMode: "ad-valorem", adValoremPercent: 10,
    specificEurPerUnit: 0, specificUnit: "gross-kg",
    vatPercent: 22, includeFreightBeforeBorderInCustomsBase: true,
    importVatRecoverable: false,
  },
});

let input = base();
let r = calculateVed(input);
near(r.scenarios["40hq"].volumeM3, 68);
near(r.scenarios["one-cbm"].volumeM3, 1);
near(r.scenarios.moq.theoreticalCartons, 45.84);
near(r.scenarios.moq.volumeM3, 45.84 * input.product.cartonVolumeM3);
near(r.scenarios.moq.bankCommissionRub, 10000 * r.scenarios.moq.volumeM3 / 68);
near(r.scenarios["one-cbm"].bankCommissionRub, 10000 / 68);
near(r.scenarios.moq.freightAfterBorderRub, 300000 * r.scenarios.moq.volumeM3 / 68);
near(r.scenarios.moq.customsValueEstimateRub, r.scenarios.moq.goodsRub + r.scenarios.moq.freightBeforeBorderRub);
near(r.scenarios.moq.dutyRub, r.scenarios.moq.customsValueEstimateRub * 0.1);
near(r.scenarios.moq.importVatRub, (r.scenarios.moq.customsValueEstimateRub + r.scenarios.moq.dutyRub) * 0.22);
near(r.averageCostPerUnitRub, (r.scenarios["40hq"].managementCostPerUnitRub + r.scenarios.moq.managementCostPerUnitRub) / 2);
assert.equal(r.feasibility.moqRequiredWholeCartons, 46);
assert.equal(r.feasibility.maxWholeCartons40hq, Math.floor(68 / input.product.cartonVolumeM3));
assert.ok(r.warnings.some(x => x.includes("не кратен")));
assert.ok(!r.scenarios.moq.warnings.some(x => x.includes("превышает рабочий объём")));
input = base(); input.customs.dutyMode = "specific"; input.customs.specificEurPerUnit = 2;
r = calculateVed(input);
near(r.scenarios.moq.dutyRub, r.scenarios.moq.grossKg * 2 * 95);
input.customs.dutyMode = "combined-sum";
r = calculateVed(input);
near(r.scenarios.moq.dutyRub, r.scenarios.moq.adValoremDutyRub + r.scenarios.moq.specificDutyRub);
input.customs.dutyMode = "combined-max";
r = calculateVed(input);
near(r.scenarios.moq.dutyRub, Math.max(r.scenarios.moq.adValoremDutyRub, r.scenarios.moq.specificDutyRub));
input.customs.dutyMode = "ad-valorem";
r = calculateVed(input);
near(r.scenarios.moq.dutyRub, r.scenarios.moq.adValoremDutyRub);
input = base(); input.customs.dutyMode = "specific"; input.customs.specificEurPerUnit = 1; input.customs.specificUnit = "net-kg";
assert.ok(validateVedInput(input).some(e => e.includes("вес нетто")));
assert.throws(() => calculateVed(input), VedInputError);
input.product.cartonNetKg = 11;
r = calculateVed(input);
near(r.scenarios.moq.dutyRub, r.scenarios.moq.theoreticalCartons * 11 * 95);
input = base(); input.product.moqUnits = 100000;
r = calculateVed(input);
assert.ok(r.scenarios.moq.containerEquivalent > 1);
assert.ok(r.scenarios.moq.warnings.some(x => x.includes("превышает")));
assert.ok(r.feasibility.estimatedMinContainers >= 2);
input = base(); input.product.cartonVolumeM3 = 70;
r = calculateVed(input);
assert.equal(r.feasibility.maxWholeCartons40hq, 0);
assert.equal(r.feasibility.estimatedMinContainers, null);
assert.ok(r.warnings.some(x => x.includes("не помещается")));
input = base(); input.expenses.refundableSecurityRub = 500000;
r = calculateVed(input);
near(r.scenarios.moq.cashRequirementRub, r.scenarios.moq.totalCostIncludingVatRub + 500000 * r.scenarios.moq.containerEquivalent);
near(r.scenarios.moq.managementCostRub, r.scenarios.moq.totalCostIncludingVatRub);
input.customs.importVatRecoverable = true;
r = calculateVed(input);
near(r.scenarios.moq.managementCostRub, r.scenarios.moq.totalCostIncludingVatRub - r.scenarios.moq.importVatRub);
near(r.scenarios.moq.cashRequirementRub, r.scenarios.moq.totalCostIncludingVatRub + r.scenarios.moq.refundableSecurityRub);
input = base(); input.product.cartonVolumeM3 = 0; input.currency.cnyRub = -1;
assert.ok(validateVedInput(input).length >= 2);
assert.throws(() => calculateVed(input), VedInputError);
console.log("PASS VED: 40HQ, MOQ fractional, 1cbm, duties (4 modes), VAT, volume fees, security, limits, validation");
