import { DEFAULT_PARAMS, totalWealth, effectiveSavingsYield, effectiveGrossSalary, livretARate } from '../src/utils.js';
import { runSimulation } from '../src/simulator.js';

function buildSimParams(params) {
  const wealth = totalWealth(params);
  const yieldEff = effectiveSavingsYield(params);
  const { gross2026, gross2027 } = effectiveGrossSalary(params);
  return {
    ...params,
    currentWealth: wealth,
    savingsYield: yieldEff,
    cdiGross2026: gross2026,
    cdiGross2027: gross2027,
    apportReserveYield: livretARate(params),
    parentLoanRate: params.parentLoanHasRate ? params.parentLoanRate : 0,
  };
}

const apports = [10000, 20000, 30000, 45000, 60000, 75000];
console.log(`Rendement épargne : ${(effectiveSavingsYield(DEFAULT_PARAMS) * 100).toFixed(2)} % | Taux prêt + assurance : ${((DEFAULT_PARAMS.bankRate + DEFAULT_PARAMS.insuranceRate) * 100).toFixed(2)} %\n`);

for (const apport of apports) {
  const params = { ...DEFAULT_PARAMS, apport };
  const sp = buildSimParams(params);
  const result = runSimulation(sp);
  const last = result.series.rent.length - 1;
  const m = result.meta;
  console.log(
    `Apport ${String(apport).padStart(6)}€ | Prêt bancaire ${Math.round(m.bankLoan).toLocaleString('fr-FR').padStart(8)}€ | ` +
    `Mensualité ${Math.round(m.totalMonthlyLoan).toLocaleString('fr-FR').padStart(5)}€/m | ` +
    `Faisable=${m.loanFeasible} (manque ${Math.round(m.remainingShortfall)}€) | ` +
    `LMNP-garder @15ans = ${Math.round(result.series.lmnpKeep[last]).toLocaleString('fr-FR')}€`
  );
}
