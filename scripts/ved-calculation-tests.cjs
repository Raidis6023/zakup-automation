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


// Regression: exact inclusive brackets for ordinary import operations fees, 2025/2026.
const { ordinaryImportCustomsFee, ORDINARY_IMPORT_FEE_SCHEDULES } = mod.exports;
assert.equal(ORDINARY_IMPORT_FEE_SCHEDULES[2026].length, 8);
for (const [value, amount] of [
  [0,1231],[200000,1231],[200000.01,2462],[450000,2462],[450000.01,4924],
  [1200000,4924],[1200000.01,13541],[2700000.01,18465],
  [4200000.01,21344],[5500000.01,49240],[10000000,49240],[10000000.01,73860],
  [100000000,73860],
]) assert.equal(ordinaryImportCustomsFee(value,2026),amount,"2026 customs bracket "+value);
assert.equal(ordinaryImportCustomsFee(7000000,2025),27540);
assert.equal(ordinaryImportCustomsFee(7000000.01,2025),30000);
assert.equal(ordinaryImportCustomsFee(100000000,2025),30000);
input = base();
input.customs.feeDate = "2026-10-30";
let testResult = calculateVed(input);
for (const id of ["40hq","moq","one-cbm"]) {
  const sr = testResult.scenarios[id];
  assert.equal(sr.customsOperationsFeeRub,ordinaryImportCustomsFee(sr.customsValueEstimateRub,2026));
  assert.equal(sr.customsFeeSource,"schedule-2026");
  assert.equal(sr.brokerServicesRub,input.expenses.brokerServicesRub,"broker is full amount per scenario");
}
input.expenses.certificationRub = 90000;
input.expenses.moldingRub = 50000;
input.expenses.indirectPaymentsRub = 7000;
input.expenses.additionalRub = 500000; // Historical security manually entered as additional expense.
input.product.markingCnyPerUnit = 0.2;
input.expenses.dangerousCargo = true;
input.expenses.dangerSurchargeBeforeRub = 60000;
input.expenses.dangerSurchargeAfterRub = 60000;
testResult=calculateVed(input);
for (const id of ["40hq","moq","one-cbm"]) {
  const sr=testResult.scenarios[id], ref=calculateVed(base()).scenarios[id];
  near(sr.certificationRub,90000);
  near(sr.brokerServicesRub,15000);
  near(sr.indirectPaymentsRub,7000);
  near(sr.additionalRub,500000);
  near(sr.moldingRub / sr.units,50000/input.product.moqUnits);
  near(sr.markingRub/sr.units,0.2*13.5);
  near(sr.freightBeforeBorderRub - ref.freightBeforeBorderRub,60000*sr.containerEquivalent);
  near(sr.freightAfterBorderRub - ref.freightAfterBorderRub,60000*sr.containerEquivalent);
}
near(testResult.scenarios["40hq"].freightBeforeBorderRub - calculateVed(base()).scenarios["40hq"].freightBeforeBorderRub,60000);
near(testResult.scenarios["40hq"].freightAfterBorderRub - calculateVed(base()).scenarios["40hq"].freightAfterBorderRub,60000);
input = base();
input.product.moqUnits=1000000;input.customs.feeDate="2026-10-30";
testResult=calculateVed(input);
assert.equal(testResult.scenarios.moq.customsOperationsFeeRub,73860,
  "MOQ exceeding one container uses highest bracket, NEVER prorates above statutory bracket");
input.customs.feeMode="manual";
input.expenses.customsOperationsFeeRub=32123;
testResult=calculateVed(input);
for (const id of ["40hq","moq","one-cbm"]) {
  assert.equal(testResult.scenarios[id].customsOperationsFeeRub,32123,
    "manual customs fee is fixed per scenario");
  assert.equal(testResult.scenarios[id].customsFeeSource,"manual");
}
input.customs.feeDate="2027-01-15";input.customs.feeMode="schedule";
assert.throws(()=>calculateVed(input),VedInputError);
input.customs.feeMode="manual";
assert.doesNotThrow(()=>calculateVed(input));
input.customs.feeDate="2026-02-30";
assert.throws(()=>calculateVed(input),VedInputError);
console.log("PASS VED: 2025/26 bracket boundaries, fees without scaling, certification, molding MOQ, fixed expenses, dangerous cargo");


// Read-only comparison fixtures from 15 tabs of the department's live 2026 workbook.
// The Excel formulas intentionally differ where they calculate customs fee from total
// landed cost (instead of customs value) or CBM bank commission as 10000/3.
const realFixture=require("./ved-live-audit-15.json");
assert.equal(realFixture.cases.length,15);
let fullyMatched40hq=0,changedMoq=0,changedOne=0;
for(const sheet of realFixture.cases){
 const input={
   product:{unitPriceCny:sheet.price,unitsPerCarton:sheet.unitsPerCarton,
     cartonVolumeM3:sheet.cartonVolumeM3,cartonGrossKg:sheet.cartonGrossKg,
     moqUnits:sheet.moq,markingCnyPerUnit:sheet.markingCnyPerUnit},
   currency:{cnyRub:sheet.cnyRub,eurRub:sheet.eurRub},
   container:{usableVolumeM3:68},
   expenses:{freightBeforeBorderRub:sheet.freightBeforeBorderRub,
     freightAfterBorderRub:sheet.freightAfterBorderRub,
     bankCommissionRub:sheet.bankCommissionRub,brokerServicesRub:sheet.brokerServicesRub,
     customsOperationsFeeRub:0,otherSharedRub:0,otherRubPerUnit:0,refundableSecurityRub:0,
     certificationRub:0,moldingRub:0,indirectPaymentsRub:0,additionalRub:0,
     dangerousCargo:sheet.dangerousCargo,dangerSurchargeBeforeRub:60000,dangerSurchargeAfterRub:60000},
   customs:{dutyMode:"ad-valorem",adValoremPercent:sheet.adValoremPercent,
     specificEurPerUnit:sheet.specificEurPerUnit,specificUnit:"gross-kg",
     vatPercent:sheet.vatPercent,includeFreightBeforeBorderInCustomsBase:true,
     importVatRecoverable:false,feeDate:"2026-10-30",feeMode:"schedule"},
 };
 const actual=calculateVed(input);
 const full=actual.scenarios["40hq"],moq=actual.scenarios.moq,one=actual.scenarios["one-cbm"];
 near(full.managementCostPerUnitRub,sheet.excel.forty,1e-6);
 fullyMatched40hq++;
 const expectedMoqDelta=sheet.audit.feeDifferences[1]/moq.units;
 const expectedOneDelta=(sheet.audit.feeDifferences[2]+one.bankCommissionRub-sheet.excel.oneBank)/one.units;
 near(moq.managementCostPerUnitRub-sheet.excel.moq,expectedMoqDelta,1e-6);
 near(one.managementCostPerUnitRub-sheet.excel.one,expectedOneDelta,1e-6);
 near(full.customsOperationsFeeRub-sheet.excel.fees[0],sheet.audit.feeDifferences[0],1e-8);
 near(moq.customsOperationsFeeRub-sheet.excel.fees[1],sheet.audit.feeDifferences[1],1e-8);
 near(one.customsOperationsFeeRub-sheet.excel.fees[2],sheet.audit.feeDifferences[2],1e-8);
 if(Math.abs(expectedMoqDelta)>1e-6)changedMoq++;
 if(Math.abs(expectedOneDelta)>1e-6)changedOne++;
}
assert.equal(fullyMatched40hq,15);
assert.equal(changedMoq,7);
assert.equal(changedOne,15);
console.log("PASS VED: 15 real 2026 workbook tabs (40HQ exact; MOQ and CBM deltas explained by agreed corrections)");
