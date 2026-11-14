import { socialChargeRatio, MICRO_URSSAF_RATE_BNC, wealthBaselineNow } from './utils.js';
import {
  resolveFinancing,
  deferredLoanRepayment,
  deferredLoansFromResolved,
  amortDebtAtMonth,
  mortgageInterestAtMonth,
  ownContributionTotal,
} from './loans.js';

export { loanPayment, totalLoanMonthly, maxLoanFromPayment } from './loans.js';

/**
 * Calculates French income tax for a single person (1 part fiscal).
 * cdiGross: annual CDI gross salary
 * microRevenue: annual micro-enterprise turnover, net of URSSAF charges already paid
 * socialRatio: ratio net/brut de cotisations salariales (dépend du statut cadre/non-cadre)
 * microUrssafRate: taux de cotisations URSSAF de la micro-entreprise (régime BNC par défaut)
 */
export function calculateFrenchTax(cdiGross, microRevenue, socialRatio = 0.77, microUrssafRate = MICRO_URSSAF_RATE_BNC) {
  // Charges sociales salariales retenues à la source (retraite, chômage, CSG/CRDS...)
  const cdiNet = cdiGross * socialRatio;
  // Standard 10% deduction for professional expenses (capped at ~14k)
  const cdiTaxable = cdiNet * 0.9;

  // L'abattement fiscal micro-BNC (34%) s'applique sur le CA BRUT, pas sur le CA déjà
  // net des cotisations URSSAF. On reconstitue donc le CA brut avant d'abattre.
  const microGrossCA = microUrssafRate < 1 ? microRevenue / (1 - microUrssafRate) : microRevenue;
  const microTaxable = microGrossCA * 0.66;

  const totalTaxable = cdiTaxable + microTaxable;

  // 2026 brackets
  const brackets = [
    { from: 0,      to: 11294,  rate: 0.00 },
    { from: 11294,  to: 28797,  rate: 0.11 },
    { from: 28797,  to: 82341,  rate: 0.30 },
    { from: 82341,  to: 177106, rate: 0.41 },
    { from: 177106, to: Infinity, rate: 0.45 },
  ];

  let tax = 0;
  for (const b of brackets) {
    if (totalTaxable <= b.from) break;
    tax += (Math.min(totalTaxable, b.to) - b.from) * b.rate;
  }

  return { tax, totalTaxable, cdiNet };
}

function calendarYearAt(m, refYear, refMonth) {
  return refYear + Math.floor((m + (refMonth - 1)) / 12);
}

function calendarYear(m, p) {
  return calendarYearAt(m, p.startYear, p.startMonth ?? 6);
}

function annualCdiGross(calYear, p) {
  const yearsOfGrowth = Math.max(0, calYear - 2026);
  return p.cdiGross2026 * Math.pow(1 + p.salaryGrowth, yearsOfGrowth);
}

function annualMicroRevenue(p) {
  return p.microRevenueAnnual ?? p.microRevenue2026 ?? 0;
}

function monthlyMicroShare(p) {
  const annual = annualMicroRevenue(p);
  return annual > 0 ? annual / 12 : 0;
}

/** Revenus bruts mensuels tels que la banque les retient (HCSF) */
export function monthlyGrossIncome(m, p) {
  const calYear = calendarYear(m, p);
  let gross = annualCdiGross(calYear, p) / 12;
  gross += (annualMicroRevenue(p) * (p.microBankWeight ?? 0.7)) / 12;
  return gross;
}

/** Revenu net mensuel pour un mois m relatif à une date de référence */
function monthlyIncomeAt(m, p, refYear, refMonth) {
  const calYear = calendarYearAt(m, refYear, refMonth);
  const cdiGross = annualCdiGross(calYear, p);
  const microRevenue = monthlyMicroShare(p);
  const annualMicro = annualMicroRevenue(p);

  let vendanges = 0;
  if (calYear === 2026) {
    vendanges = p.vendanges2026 / 12;
  }

  const { tax, cdiNet } = calculateFrenchTax(cdiGross, annualMicro, socialChargeRatio(p));
  const netCDI = cdiNet / 12;
  const monthlyTax = tax / 12;

  return netCDI + microRevenue + vendanges - monthlyTax;
}

/**
 * Get monthly disposable income (net of tax, charges) for a given month index (0 = project start).
 */
function monthlyIncome(m, p) {
  return monthlyIncomeAt(m, p, p.startYear, p.startMonth ?? 6);
}

/** Personal living expenses (excluding housing) */
function monthlyExpenses(m, p) {
  const infl = Math.pow(1 + p.inflation, m / 12);
  return (p.fixedExpenses + p.variableExpenses) * infl;
}

/**
 * Simule la période d'attente entre la date du patrimoine de référence et le début du projet.
 * Hypothèse : on reste locataire, on épargne le surplus et les placements fructifient.
 * L'apport de financement n'intervient pas ici : le patrimoine au démarrage ne dépend
 * que du portefeuille, des revenus et de la chronologie (pas du montant d'apport saisi).
 */
export function simulateWaitingPeriod(p) {
  const { year: baseYear, month: baseMonth } = wealthBaselineNow();
  const startMonth = p.startMonth ?? 6;
  const waitMonths = (p.startYear - baseYear) * 12 + (startMonth - baseMonth);

  const baselineWealth = p.currentWealth;

  if (waitMonths <= 0) {
    return {
      effectiveWealth: baselineWealth,
      waitMonths: 0,
      cashFlowTotal: 0,
      interestEarned: 0,
      wealthGain: 0,
      baselineWealth,
      baselineYear: baseYear,
      baselineMonth: baseMonth,
    };
  }

  let wealth = baselineWealth;
  let rentAmt = p.currentRent;
  let cashFlowTotal = 0;
  let interestEarned = 0;

  for (let m = 0; m < waitMonths; m++) {
    if (m > 0 && m % 12 === 0) rentAmt *= (1 + p.rentInflation);
    const income = monthlyIncomeAt(m, p, baseYear, baseMonth);
    const expenses = monthlyExpenses(m, p);
    const cashFlow = income - rentAmt - expenses;
    const interest = wealth * ((p.savingsYield ?? 0) / 12);
    interestEarned += interest;
    cashFlowTotal += cashFlow;
    wealth += interest + cashFlow;
  }

  const effectiveWealth = wealth;

  return {
    effectiveWealth,
    waitMonths,
    cashFlowTotal,
    interestEarned,
    wealthGain: effectiveWealth - baselineWealth,
    baselineWealth,
    baselineYear: baseYear,
    baselineMonth: baseMonth,
  };
}

/** Patrimoine total disponible au moment de l'achat (après période d'attente éventuelle). */
export function wealthAtPurchase(p) {
  return simulateWaitingPeriod(p).effectiveWealth;
}

function applyDeferredRepayments(surplus, balances, deferredLoans, p) {
  let remaining = surplus;
  let totalPaid = 0;
  const next = { ...balances };
  for (const loan of deferredLoans) {
    const id = loan.id;
    const bal = next[id] ?? 0;
    if (bal <= 0 || remaining <= 0) continue;
    const paid = deferredLoanRepayment(remaining, bal, loan, p);
    next[id] = Math.max(0, bal - paid);
    remaining -= paid;
    totalPaid += paid;
  }
  return { paid: totalPaid, balances: next };
}

/** Budget mensuel type (mois 0) pour affichage */
export function monthlyBudget(m, p, mortgage) {
  const income = monthlyIncome(m, p);
  const expenses = monthlyExpenses(m, p);
  const gross = monthlyGrossIncome(m, p);
  const maxPayment = gross * (p.debtRatioCap ?? 0.35);

    const foncier = (p.propertyTax / 12) * Math.pow(1 + (p.propertyTaxGrowth ?? p.inflation), m / 12);
  const charges = p.coopCharges * Math.pow(1 + p.inflation, m / 12);
  const maint = (p.purchasePrice * p.maintenanceRate / 12) * Math.pow(1 + p.inflation, m / 12);
  const ownerHousing = mortgage.totalMonthlyLoan + foncier + charges + maint;
  const rentHousing = p.futureRent ?? p.currentRent;

  const ownerSurplus = income - ownerHousing - expenses;
  const rentSurplus = income - rentHousing - expenses;

  return {
    income,
    expenses,
    gross,
    maxPayment,
    ownerHousing,
    rentHousing,
    ownerSurplus,
    rentSurplus,
    ownerInvestable: ownerSurplus,
    rentInvestable: rentSurplus,
  };
}

/**
 * Core simulation. Returns { labels, rent, buySell, lmnpKeep, details }
 * details[scenario][month] = { income, housing, lmnpNet, expenses, cashFlow, interest, debt, netWorth, propertyValue, savings }
 */
export function runSimulation(p) {
  const apport = ownContributionTotal(p);
  const waiting = simulateWaitingPeriod(p);
  const sp = { ...p, apport, currentWealth: waiting.effectiveWealth };

  const MONTHS = p.simYears * 12;
  const DEP_M = p.departureYears * 12;
  const mortgage = resolveFinancing(sp, monthlyGrossIncome);
  const deferredLoans = deferredLoansFromResolved(mortgage.resolvedLoans);
  const initialDeferred = Object.fromEntries(
    mortgage.resolvedLoans
      .filter(l => l.deferredBalance > 0)
      .map(l => [l.id, l.principal]),
  );

  // Fiscalité LMNP réel : amortissement du bien (85% du prix, linéaire sur 25 ans),
  // déductible du résultat locatif jusqu'à épuisement. Au-delà, le résultat net
  // redevient imposable (IR tranche marginale + prélèvements sociaux via lmnpTaxRate).
  const lmnpAmortBase = p.purchasePrice * 0.85;
  const lmnpAnnualAmort = lmnpAmortBase / 25;
  const lmnpTaxRate = p.lmnpTaxRate ?? 0.472;
  const {
    notary,
    totalCost,
    downPayment,
    bankLoanNeeded,
    bankLoan,
    ptzAmount,
    totalMonthlyLoan,
    maxPayment,
    hcsfMonthly,
    extraFromSavings,
    remainingShortfall,
    shortfallBeyondLiquid,
    liquidAfterApport,
    loanFeasible,
    investableSavings,
    resolvedLoans,
  } = mortgage;

  // Labels (every month) — start date comes from params
  const labels = [];
  const startDate = new Date(p.startYear, (p.startMonth ?? 6) - 1, 1);
  for (let m = 0; m < MONTHS; m++) {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + m);
    labels.push(d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }));
  }

  const buyStartSavings = investableSavings;

  // ==========================================
  // SCENARIO 1: LOCATION
  // L'apport (réservé achat) reste en placement prudent ; le reste au rendement choisi.
  // ==========================================
  const rentSeries = [];
  const rentDetails = [];
  let rentReserve = sp.apport;
  let rentLiquid = Math.max(0, sp.currentWealth - sp.apport);
  let rentAmt = sp.futureRent ?? sp.currentRent;
  const reserveYield = sp.apportReserveYield ?? 0.0175;

  for (let m = 0; m < MONTHS; m++) {
    if (m > 0 && m % 12 === 0) rentAmt *= (1 + sp.rentInflation);
    const income = monthlyIncome(m, sp);
    const expenses = monthlyExpenses(m, sp);
    const housing = rentAmt;
    const cashFlow = income - housing - expenses;
    const reserveInterest = rentReserve * (reserveYield / 12);
    const liquidInterest = rentLiquid * (sp.savingsYield / 12);
    rentReserve += reserveInterest;
    rentLiquid += liquidInterest + cashFlow;
    const rentSavings = rentReserve + rentLiquid;

    const nw = Math.round(rentSavings);
    rentSeries.push(nw);
    rentDetails.push({
      income, housing, lmnpRevenue: 0, lmnpOutflow: 0, expenses, parentPaid: 0,
      cashFlow, interest: reserveInterest + liquidInterest, debt: 0, parentDebt: 0,
      netWorth: nw, propertyValue: 0, savings: Math.round(rentSavings),
    });
  }

  // ==========================================
  // SCENARIO 2: ACHAT + REVENTE au départ
  // ==========================================
  const buySellSeries = [];
  const buySellDetails = [];
  let bsSavings = buyStartSavings;
  let bsDeferred = { ...initialDeferred };
  let bsPropVal = sp.purchasePrice;
  let bsSold = false;

  for (let m = 0; m < MONTHS; m++) {
    bsPropVal *= Math.pow(1 + p.propertyAppreciation, 1 / 12);
    const income = monthlyIncome(m, p);
    const expenses = monthlyExpenses(m, p);
    let housing = 0;
    let cashFlow = 0;
    let lmnpRevenue = 0;
    let lmnpOutflow = 0;
    let parentPaid = 0;
    let debt = amortDebtAtMonth(m, resolvedLoans);
    const deferredTotal = () => Object.values(bsDeferred).reduce((s, v) => s + v, 0);

    if (m < DEP_M) {
      const foncier = (p.propertyTax / 12) * Math.pow(1 + (p.propertyTaxGrowth ?? p.inflation), m / 12);
      const charges = p.coopCharges * Math.pow(1 + p.inflation, m / 12);
      const maint = (p.purchasePrice * p.maintenanceRate / 12) * Math.pow(1 + p.inflation, m / 12);
      housing = totalMonthlyLoan + foncier + charges + maint;
      const surplus = income - housing - expenses;

      const rep = applyDeferredRepayments(surplus, bsDeferred, deferredLoans, p);
      parentPaid = rep.paid;
      bsDeferred = rep.balances;
      cashFlow = surplus - parentPaid;
    } else {
      if (!bsSold) {
        const salePrice = bsPropVal;
        const agencyFees = salePrice * p.agencyFeeRate;
        const netProceeds = salePrice - agencyFees;
        const payoff = amortDebtAtMonth(DEP_M, resolvedLoans);
        const def = deferredTotal();
        bsSavings += netProceeds - payoff - def;
        bsDeferred = Object.fromEntries(Object.keys(bsDeferred).map(k => [k, 0]));
        debt = 0;
        bsPropVal = 0;
        bsSold = true;
      }
      const newRent = (p.futureRent ?? p.currentRent) * Math.pow(1 + p.rentInflation, m / 12);
      housing = newRent;
      cashFlow = income - housing - expenses;
      debt = 0;
    }

    const interest = bsSavings * (p.savingsYield / 12);
    bsSavings += interest + cashFlow;
    const netWorth = Math.round(bsSavings + bsPropVal - debt - deferredTotal());
    buySellSeries.push(netWorth);
    buySellDetails.push({
      income, housing, lmnpRevenue, lmnpOutflow, expenses, parentPaid, cashFlow, interest,
      debt, parentDebt: deferredTotal(), netWorth, propertyValue: Math.round(bsPropVal),
      savings: Math.round(bsSavings),
    });
  }

  // ==========================================
  // SCENARIO 3: ACHAT + LMNP (GARDER LE PRÊT)
  // ==========================================
  const lmnpKeepSeries = [];
  const lmnpKeepDetails = [];
  let lkSavings = buyStartSavings;
  let lkDeferred = { ...initialDeferred };
  let lkPropVal = p.purchasePrice;
  let lkAmortUsed = 0;

  for (let m = 0; m < MONTHS; m++) {
    lkPropVal *= Math.pow(1 + p.propertyAppreciation, 1 / 12);
    const income = monthlyIncome(m, p);
    const expenses = monthlyExpenses(m, p);
    let housing = 0;
    let cashFlow = 0;
    let lmnpRevenue = 0;
    let lmnpOutflow = 0;
    let parentPaid = 0;
    const debt = amortDebtAtMonth(m, resolvedLoans);
    const lkDeferredTotal = () => Object.values(lkDeferred).reduce((s, v) => s + v, 0);

    if (m < DEP_M) {
      const foncier = (p.propertyTax / 12) * Math.pow(1 + (p.propertyTaxGrowth ?? p.inflation), m / 12);
      const charges = p.coopCharges * Math.pow(1 + p.inflation, m / 12);
      const maint = (p.purchasePrice * p.maintenanceRate / 12) * Math.pow(1 + p.inflation, m / 12);
      housing = totalMonthlyLoan + foncier + charges + maint;
      const surplus = income - housing - expenses;

      const rep = applyDeferredRepayments(surplus, lkDeferred, deferredLoans, p);
      parentPaid = rep.paid;
      lkDeferred = rep.balances;
      cashFlow = surplus - parentPaid;
    } else {
      lmnpRevenue = p.lmnpRent * Math.pow(1 + p.rentInflation, m / 12);
      const foncier = (p.propertyTax / 12) * Math.pow(1 + (p.propertyTaxGrowth ?? p.inflation), m / 12);
      const nonRecovChg = p.coopCharges * 0.30 * Math.pow(1 + p.inflation, m / 12);
      const maint = (p.purchasePrice * p.maintenanceRate / 12) * Math.pow(1 + p.inflation, m / 12);
      const acctFee = (500 / 12) * Math.pow(1 + p.inflation, m / 12);
      const pnoIns = 15 * Math.pow(1 + p.inflation, m / 12);
      const cfe = ((p.cfeAnnual ?? 0) / 12) * Math.pow(1 + p.inflation, m / 12);
      const interestPortion = mortgageInterestAtMonth(m, resolvedLoans);

      // Amortissement accru linéairement depuis le début de la phase LMNP, plafonné
      // à la base amortissable ; non consommé s'il n'y a pas de bénéfice à éponger
      // (report d'un "stock" disponible pour les mois suivants).
      const monthsInLmnp = m - DEP_M + 1;
      const accruedAmort = Math.min(monthsInLmnp * (lmnpAnnualAmort / 12), lmnpAmortBase);
      const profitBeforeAmort = lmnpRevenue - (foncier + nonRecovChg + maint + acctFee + pnoIns + cfe + interestPortion);
      const amortAvailable = Math.max(0, accruedAmort - lkAmortUsed);
      const amortUsedNow = Math.min(Math.max(0, profitBeforeAmort), amortAvailable);
      lkAmortUsed += amortUsedNow;
      const lmnpTax = Math.max(0, profitBeforeAmort - amortUsedNow) * lmnpTaxRate;

      lmnpOutflow = totalMonthlyLoan + foncier + nonRecovChg + maint + acctFee + pnoIns + cfe + lmnpTax;
      const aptNet = lmnpRevenue - lmnpOutflow;

      const newRent = (p.futureRent ?? p.currentRent) * Math.pow(1 + p.rentInflation, m / 12);
      housing = newRent;
      const surplus = income + aptNet - housing - expenses;

      const rep = applyDeferredRepayments(surplus, lkDeferred, deferredLoans, p);
      parentPaid = rep.paid;
      lkDeferred = rep.balances;
      cashFlow = surplus - parentPaid;
    }

    const interest = lkSavings * (p.savingsYield / 12);
    lkSavings += interest + cashFlow;
    // Optionnel : valeur du bien nette des frais de sortie (agence), pour une comparaison
    // prudente avec les scénarios 100% liquides. Désactivé par défaut (valeur à 100%).
    const lkPropValNet = p.lmnpLiquidationAdjusted ? lkPropVal * (1 - p.agencyFeeRate) : lkPropVal;
    const netWorth = Math.round(lkSavings + lkPropValNet - debt - lkDeferredTotal());
    lmnpKeepSeries.push(netWorth);
    lmnpKeepDetails.push({
      income, housing, lmnpRevenue, lmnpOutflow, expenses, parentPaid, cashFlow, interest,
      debt, parentDebt: lkDeferredTotal(), netWorth, propertyValue: Math.round(lkPropVal),
      savings: Math.round(lkSavings),
    });
  }

  const budget = monthlyBudget(0, p, mortgage);

  /** Première année où un scénario achat dépasse la location */
  function findCrossover(buySeries) {
    for (let i = 12; i < buySeries.length; i++) {
      if (buySeries[i] > rentSeries[i]) return i / 12;
    }
    return null;
  }

  const crossovers = {
    buySell: findCrossover(buySellSeries),
    lmnpKeep: findCrossover(lmnpKeepSeries),
  };

  return {
    labels,
    series: { rent: rentSeries, buySell: buySellSeries, lmnpKeep: lmnpKeepSeries },
    details: { rent: rentDetails, buySell: buySellDetails, lmnpKeep: lmnpKeepDetails },
    meta: {
      totalMonthlyLoan,
      bankLoan,
      ptzAmount,
      notary,
      bankLoanNeeded,
      downPayment,
      maxPayment,
      extraFromSavings,
      remainingShortfall,
      shortfallBeyondLiquid,
      liquidAfterApport,
      loanFeasible,
      investableSavings,
      hcsfMonthly,
      hcsfOver: mortgage.hcsfOver,
      mortgagePrincipal: mortgage.mortgagePrincipal,
      resolvedLoans,
      budget,
      crossovers,
      waiting,
    },
  };
}
