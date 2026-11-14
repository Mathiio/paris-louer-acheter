// Recherche de la combinaison de paramètres (parmi ceux réellement "actionnables") qui maximise
// le patrimoine net final, en respectant la faisabilité du prêt (plafond HCSF 35 %).
import { DEFAULT_PARAMS, totalWealth, effectiveSavingsYield, effectiveGrossSalary, livretARate } from '../src/utils.js';
import { runSimulation } from '../src/simulator.js';

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

function simulate(overrides) {
  const params = { ...DEFAULT_PARAMS, ...overrides };
  const sp = buildSimParams(params);
  const result = runSimulation(sp);
  const last = result.series.rent.length - 1;
  return {
    params,
    meta: result.meta,
    rent: result.series.rent[last],
    buySell: result.series.buySell[last],
    lmnpKeep: result.series.lmnpKeep[last],
  };
}

const fmt = (n) => Math.round(n).toLocaleString('fr-FR') + ' €';

console.log('='.repeat(78));
console.log('BASELINE (paramètres par défaut actuels)');
console.log('='.repeat(78));
const base = simulate({});
console.log(`Location seule   : ${fmt(base.rent)}`);
console.log(`Achat + Revente  : ${fmt(base.buySell)}`);
console.log(`Achat + LMNP     : ${fmt(base.lmnpKeep)}  ← référence à battre`);
console.log(`Faisable : ${base.meta.loanFeasible} | Mensualité : ${fmt(base.meta.totalMonthlyLoan)}/m\n`);

console.log('='.repeat(78));
console.log('1) SENSIBILITÉ APPORT (0 = tout emprunter, si faisable)');
console.log('='.repeat(78));
for (const apport of [0, 5000, 10000, 20000, 30000, 45000, 60000, 75000]) {
  const r = simulate({ apport });
  console.log(
    `Apport ${String(apport).padStart(6)}€ | Faisable=${String(r.meta.loanFeasible).padEnd(5)} ` +
    `(manque ${fmt(r.meta.remainingShortfall)}) | Mensualité ${fmt(r.meta.totalMonthlyLoan)}/m | LMNP = ${fmt(r.lmnpKeep)}`
  );
}

console.log('\n' + '='.repeat(78));
console.log('2) SENSIBILITÉ DURÉE DU PRÊT');
console.log('='.repeat(78));
for (const loanYears of [10, 15, 20, 25, 30]) {
  const r = simulate({ loanYears });
  console.log(`${String(loanYears).padStart(2)} ans | Faisable=${String(r.meta.loanFeasible).padEnd(5)} | Mensualité ${fmt(r.meta.totalMonthlyLoan)}/m | LMNP = ${fmt(r.lmnpKeep)}`);
}

console.log('\n' + '='.repeat(78));
console.log('3) PTZ (prêt à taux zéro, si éligible neuf)');
console.log('='.repeat(78));
for (const ptzEnabled of [false, true]) {
  const r = simulate({ ptzEnabled });
  console.log(`PTZ=${String(ptzEnabled).padEnd(5)} | Faisable=${String(r.meta.loanFeasible).padEnd(5)} | Mensualité ${fmt(r.meta.totalMonthlyLoan)}/m | LMNP = ${fmt(r.lmnpKeep)}`);
}

console.log('\n' + '='.repeat(78));
console.log('4) PRÊT COMPLÉMENTAIRE (gratuit, remboursé seulement si + rentable)');
console.log('='.repeat(78));
for (const parentLoan of [0, 15000, 30000, 45000, 60000, 80000]) {
  const r = simulate({ parentLoan });
  console.log(`Prêt complément. ${String(parentLoan).padStart(6)}€ | Faisable=${String(r.meta.loanFeasible).padEnd(5)} | Mensualité ${fmt(r.meta.totalMonthlyLoan)}/m | LMNP = ${fmt(r.lmnpKeep)}`);
}

console.log('\n' + '='.repeat(78));
console.log('5) DATE DE DÉPART DE PARIS (bascule vers LMNP)');
console.log('='.repeat(78));
for (const departureYears of [2, 3, 4, 5, 6, 7, 8, 9, 10]) {
  const r = simulate({ departureYears });
  console.log(`Départ dans ${String(departureYears).padStart(2)} ans | LMNP = ${fmt(r.lmnpKeep)} | Revente = ${fmt(r.buySell)}`);
}

console.log('\n' + '='.repeat(78));
console.log('COMBINAISON OPTIMALE (cumul des meilleurs leviers actionnables)');
console.log('='.repeat(78));

// On part du principe : apport minimal tant que le prêt reste faisable, durée maximale,
// PTZ activé si éligible, prêt complémentaire maximal (gratuit). On cherche l'apport minimal faisable.
let bestApport = DEFAULT_PARAMS.apport;
for (const apport of [0, 2500, 5000, 7500, 10000, 15000, 20000, 30000, 45000, 60000, 75000]) {
  const r = simulate({ apport, loanYears: 30, ptzEnabled: true, parentLoan: 80000 });
  if (r.meta.loanFeasible) { bestApport = apport; break; }
}

const optimal = simulate({ apport: bestApport, loanYears: 30, ptzEnabled: true, parentLoan: 80000 });
console.log(`Apport retenu (minimal faisable) : ${fmt(bestApport)}`);
console.log(`Durée : 30 ans | PTZ activé | Prêt complémentaire : 80 000 €`);
console.log(`Faisable=${optimal.meta.loanFeasible} | Mensualité ${fmt(optimal.meta.totalMonthlyLoan)}/m`);
console.log(`Location seule   : ${fmt(optimal.rent)}`);
console.log(`Achat + Revente  : ${fmt(optimal.buySell)}`);
console.log(`Achat + LMNP     : ${fmt(optimal.lmnpKeep)}`);
console.log(`\nGain vs baseline (LMNP) : ${fmt(optimal.lmnpKeep - base.lmnpKeep)} (+${((optimal.lmnpKeep / base.lmnpKeep - 1) * 100).toFixed(1)}%)`);
