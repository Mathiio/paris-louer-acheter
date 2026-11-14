import { DEFAULT_PARAMS, totalWealth, effectiveSavingsYield, effectiveGrossSalary, livretARate } from '../src/utils.js';
import { runSimulation } from '../src/simulator.js';

const HORIZON_YEARS = 15; // horizon absolu fixe depuis la date de référence du patrimoine
const BASE_YEAR = DEFAULT_PARAMS.wealthBaselineYear;
const BASE_MONTH = DEFAULT_PARAMS.wealthBaselineMonth;

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

function runDelay(delayMonths, { growPrice } = {}) {
  const startTotalMonths = delayMonths;
  const startYear = BASE_YEAR + Math.floor((BASE_MONTH - 1 + startTotalMonths) / 12);
  const startMonth = ((BASE_MONTH - 1 + startTotalMonths) % 12) + 1;

  const remainingMonths = HORIZON_YEARS * 12 - delayMonths;
  const simYears = remainingMonths / 12;

  let purchasePrice = DEFAULT_PARAMS.purchasePrice;
  if (growPrice) {
    purchasePrice = DEFAULT_PARAMS.purchasePrice * Math.pow(1 + DEFAULT_PARAMS.propertyAppreciation, delayMonths / 12);
  }

  const params = {
    ...DEFAULT_PARAMS,
    startYear,
    startMonth,
    simYears,
    purchasePrice,
  };

  const sp = buildSimParams(params);
  const result = runSimulation(sp);
  const last = result.series.rent.length - 1;
  return {
    delayMonths,
    startYear,
    startMonth,
    simYears,
    purchasePrice: Math.round(purchasePrice),
    rent: result.series.rent[last],
    buySell: result.series.buySell[last],
    lmnpKeep: result.series.lmnpKeep[last],
    lmnpPayoff: result.series.lmnpPayoff[last],
    loanFeasible: result.meta.loanFeasible,
    remainingShortfall: Math.round(result.meta.remainingShortfall),
    waitingEffectiveWealth: Math.round(result.meta.waiting.effectiveWealth),
    crossoverLmnpKeep: result.meta.crossovers.lmnpKeep,
  };
}

const delays = [0, 3, 6, 9, 12, 18, 24, 36];

console.log(`\n=== Horizon fixe : ${HORIZON_YEARS} ans depuis ${BASE_MONTH}/${BASE_YEAR} ===`);
console.log(`Patrimoine de départ (portefeuille) : ${Math.round(totalWealth(DEFAULT_PARAMS)).toLocaleString('fr-FR')} €`);
console.log(`Rendement épargne effectif : ${(effectiveSavingsYield(DEFAULT_PARAMS) * 100).toFixed(2)} %\n`);

console.log('--- Scénario A : prix d\'achat CONSTANT si on attend (optimiste pour "attendre") ---');
for (const d of delays) {
  const r = runDelay(d, { growPrice: false });
  console.log(
    `Délai ${String(d).padStart(2)} mois | achat ${r.purchasePrice.toLocaleString('fr-FR')}€ | ` +
    `apport dispo au départ ${r.waitingEffectiveWealth.toLocaleString('fr-FR')}€ | ` +
    `prêt faisable=${r.loanFeasible} (manque ${r.remainingShortfall}€) | ` +
    `LMNP-garder @ ${HORIZON_YEARS}ans = ${Math.round(r.lmnpKeep).toLocaleString('fr-FR')}€ | ` +
    `Location seule = ${Math.round(r.rent).toLocaleString('fr-FR')}€ | ` +
    `crossover=${r.crossoverLmnpKeep?.toFixed(1) ?? 'jamais'}`
  );
}

console.log('\n--- Scénario B : prix d\'achat qui MONTE avec l\'appréciation immo pendant l\'attente (réaliste) ---');
for (const d of delays) {
  const r = runDelay(d, { growPrice: true });
  console.log(
    `Délai ${String(d).padStart(2)} mois | achat ${r.purchasePrice.toLocaleString('fr-FR')}€ | ` +
    `apport dispo au départ ${r.waitingEffectiveWealth.toLocaleString('fr-FR')}€ | ` +
    `prêt faisable=${r.loanFeasible} (manque ${r.remainingShortfall}€) | ` +
    `LMNP-garder @ ${HORIZON_YEARS}ans = ${Math.round(r.lmnpKeep).toLocaleString('fr-FR')}€ | ` +
    `Location seule = ${Math.round(r.rent).toLocaleString('fr-FR')}€ | ` +
    `crossover=${r.crossoverLmnpKeep?.toFixed(1) ?? 'jamais'}`
  );
}
