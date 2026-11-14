import { DEFAULT_PARAMS, totalWealth, effectiveSavingsYield, effectiveGrossSalary, livretARate } from '../src/utils.js';
import { runSimulation, loanPayment } from '../src/simulator.js';

function buildSimParams(params) {
  const wealth = totalWealth(params);
  const yieldEff = effectiveSavingsYield(params);
  const { gross2026 } = effectiveGrossSalary(params);
  return {
    ...params,
    currentWealth: wealth,
    savingsYield: yieldEff,
    cdiGross2026: gross2026,
    apportReserveYield: livretARate(params),
    parentLoanRate: params.parentLoanHasRate ? params.parentLoanRate : 0,
  };
}

const durations = [10, 15, 20, 25, 30];
const base = buildSimParams(DEFAULT_PARAMS);
console.log(
  `Rendement épargne retenu : ${(base.savingsYield * 100).toFixed(2)} % | ` +
  `Taux prêt + assurance : ${((DEFAULT_PARAMS.bankRate + DEFAULT_PARAMS.insuranceRate) * 100).toFixed(2)} %\n`
);

for (const loanYears of durations) {
  const params = { ...DEFAULT_PARAMS, loanYears };
  const sp = buildSimParams(params);
  const result = runSimulation(sp);
  const last = result.series.rent.length - 1;
  const m = result.meta;

  // Coût total du crédit (intérêts + assurance) sur toute sa durée
  const bankPayment = loanPayment(m.bankLoan, params.bankRate, loanYears);
  const totalInterest = bankPayment * loanYears * 12 - m.bankLoan;
  const totalInsurance = m.bankLoan * params.insuranceRate * loanYears;

  console.log(
    `${String(loanYears).padStart(2)} ans | Mensualité ${Math.round(m.totalMonthlyLoan).toLocaleString('fr-FR').padStart(5)}€/m | ` +
    `Coût crédit (intérêts+assurance) ${Math.round(totalInterest + totalInsurance).toLocaleString('fr-FR').padStart(7)}€ | ` +
    `Achat+LMNP @${DEFAULT_PARAMS.simYears}ans = ${Math.round(result.series.lmnpKeep[last]).toLocaleString('fr-FR').padStart(7)}€ | ` +
    `Achat+Revente = ${Math.round(result.series.buySell[last]).toLocaleString('fr-FR').padStart(7)}€`
  );
}
