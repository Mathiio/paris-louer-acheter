/** Standard loan monthly payment (annuité constante) */
export function loanPayment(principal, annualRate, years) {
  if (principal <= 0) return 0;
  if (annualRate === 0) return principal / (years * 12);
  const r = annualRate / 12;
  const n = years * 12;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export function totalLoanMonthly(principal, annualRate, years, insuranceRate) {
  if (principal <= 0) return 0;
  return loanPayment(principal, annualRate, years) + principal * (insuranceRate / 12);
}

export function maxLoanFromPayment(maxPayment, annualRate, years, insuranceRate) {
  if (maxPayment <= 0) return 0;
  let lo = 0;
  let hi = 2_000_000;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (totalLoanMonthly(mid, annualRate, years, insuranceRate) <= maxPayment) lo = mid;
    else hi = mid;
  }
  return lo;
}

let loanIdSeq = 0;
export function nextLoanId() {
  loanIdSeq += 1;
  return `loan-${loanIdSeq}`;
}

/** @typedef {'manual' | 'max_hcsf' | 'fill_gap'} LoanAmountMode */
/** @typedef {'mortgage' | 'help_at_purchase' | 'own_contribution'} LoanRole */
/** @typedef {'amortize' | 'deferred_surplus' | 'deferred_fixed'} LoanRepayMode */

/**
 * @typedef {Object} SimLoan
 * @property {string} id
 * @property {string} label
 * @property {LoanAmountMode} amountMode
 * @property {number} amount
 * @property {number} rate
 * @property {number} insuranceRate
 * @property {number|null} years
 * @property {LoanRole} role
 * @property {boolean} hcsf
 * @property {LoanRepayMode} repayMode
 * @property {number} fixedRepay
 * @property {boolean} opportunistic
 */

export function newLoan(overrides = {}) {
  const id = overrides.id ?? nextLoanId();
  return {
    id,
    label: 'Nouveau prêt',
    amountMode: 'manual',
    amount: 0,
    rate: 0.035,
    insuranceRate: 0,
    years: 25,
    role: 'mortgage',
    hcsf: true,
    repayMode: 'amortize',
    fixedRepay: 250,
    opportunistic: true,
    ...overrides,
    id,
  };
}

export const DEFAULT_LOANS = [
  newLoan({
    id: 'apport',
    label: 'Apport personnel',
    amountMode: 'manual',
    amount: 40_000,
    rate: 0,
    insuranceRate: 0,
    years: null,
    role: 'own_contribution',
    hcsf: false,
    repayMode: 'amortize',
  }),
  newLoan({
    id: 'bank',
    label: 'Prêt bancaire',
    amountMode: 'max_hcsf',
    amount: 0,
    rate: 0.035,
    insuranceRate: 0.0015,
    years: 25,
    role: 'mortgage',
    hcsf: true,
    repayMode: 'amortize',
  }),
  newLoan({
    id: 'supplement',
    label: 'Prêt complémentaire',
    amountMode: 'manual',
    amount: 20_000,
    rate: 0,
    insuranceRate: 0,
    years: null,
    role: 'help_at_purchase',
    hcsf: false,
    repayMode: 'deferred_fixed',
    fixedRepay: 200,
  }),
];

export function sanitizeLoan(raw) {
  const base = newLoan();
  const o = { ...base, ...raw, id: String(raw?.id ?? base.id) };
  if (o.id === 'family') {
    o.id = 'supplement';
    if (!raw?.label || raw?.id === 'family') o.label = 'Prêt complémentaire';
  }
  o.label = String(o.label ?? base.label);
  o.amountMode = ['manual', 'max_hcsf', 'fill_gap'].includes(o.amountMode) ? o.amountMode : 'manual';
  o.amount = Math.max(0, Number(o.amount) || 0);
  o.rate = Math.max(0, Number(o.rate) || 0);
  o.insuranceRate = Math.max(0, Number(o.insuranceRate) || 0);
  o.years = o.years == null || o.years === '' ? null : Math.max(1, Math.round(Number(o.years) || 25));
  o.role = ['mortgage', 'help_at_purchase', 'own_contribution'].includes(o.role)
    ? o.role
    : 'mortgage';
  o.hcsf = Boolean(o.hcsf);
  if (o.role === 'help_at_purchase' && o.repayMode !== 'deferred_fixed') {
    o.repayMode = 'deferred_fixed';
  } else {
    o.repayMode = ['amortize', 'deferred_surplus', 'deferred_fixed'].includes(o.repayMode)
      ? o.repayMode
      : 'amortize';
  }
  o.fixedRepay = Math.max(0, Number(o.fixedRepay) || 0);
  o.opportunistic = o.opportunistic !== false;
  if (o.role === 'own_contribution') {
    o.amountMode = 'manual';
    o.hcsf = false;
    o.rate = 0;
    o.insuranceRate = 0;
    o.years = null;
  }
  if (o.role === 'help_at_purchase') {
    o.repayMode = 'deferred_fixed';
    o.hcsf = false;
  }
  return o;
}

/** Limite les lignes « apport personnel » au plafond de liquidités disponibles. */
export function clampOwnContributionToCap(loans, cap) {
  const limit = Math.max(0, cap);
  let remaining = limit;
  return loans.map(l => {
    if (l.role !== 'own_contribution') return l;
    const amount = Math.min(Math.max(0, l.amount), remaining);
    remaining -= amount;
    return { ...l, amount };
  });
}

/** Total apport personnel (lignes dédiées, sinon repli params.apport). */
export function ownContributionTotal(params) {
  const loans = resolveLoansList(params);
  const fromLoans = loans
    .filter(l => l.role === 'own_contribution')
    .reduce((s, l) => s + l.amount, 0);
  if (fromLoans > 0) return fromLoans;
  return Math.max(0, Number(params?.apport) || 0);
}

/** Ajoute une ligne apport si absente (migration saves existants). */
export function ensureDefaultLoans(loans, params = {}) {
  const list = loans.map(sanitizeLoan);
  if (list.some(l => l.role === 'own_contribution')) return list;
  return [
    newLoan({
      id: 'apport',
      label: 'Apport personnel',
      amountMode: 'manual',
      amount: params.aport ?? 40_000,
      rate: 0,
      insuranceRate: 0,
      years: null,
      role: 'own_contribution',
      hcsf: false,
      repayMode: 'amortize',
    }),
    ...list,
  ];
}

export function migrateLoansFromParams(params) {
  if (Array.isArray(params?.loans) && params.loans.length > 0) {
    return params.loans.map(sanitizeLoan);
  }
  const loans = [
    newLoan({
      id: 'apport',
      label: 'Apport personnel',
      amountMode: 'manual',
      amount: params.aport ?? 40_000,
      rate: 0,
      insuranceRate: 0,
      years: null,
      role: 'own_contribution',
      hcsf: false,
      repayMode: 'amortize',
    }),
    newLoan({
      id: 'bank',
      label: 'Prêt bancaire',
      amountMode: 'max_hcsf',
      amount: 0,
      rate: params.bankRate ?? 0.035,
      insuranceRate: params.insuranceRate ?? 0.0015,
      years: params.loanYears ?? 25,
      role: 'mortgage',
      hcsf: true,
      repayMode: 'amortize',
    }),
    newLoan({
      id: 'supplement',
      label: 'Prêt complémentaire',
      amountMode: 'manual',
      amount: params.parentLoan ?? 0,
      rate: params.parentLoanHasRate ? (params.parentLoanRate ?? 0) : 0,
      insuranceRate: 0,
      years: null,
      role: 'help_at_purchase',
      hcsf: false,
      repayMode: 'deferred_fixed',
      fixedRepay: params.parentFixedPayment ?? 250,
    }),
  ];
  if (params.ptzEnabled) {
    const cap = Math.round((params.purchasePrice ?? 0) * 0.4);
    loans.splice(1, 0, newLoan({
      id: 'ptz',
      label: 'PTZ',
      amountMode: 'manual',
      amount: cap,
      rate: 0,
      insuranceRate: 0,
      years: params.loanYears ?? 25,
      role: 'mortgage',
      hcsf: true,
      repayMode: 'amortize',
    }));
  }
  return loans;
}

export function resolveLoansList(params) {
  return migrateLoansFromParams(params).map(sanitizeLoan);
}

function amortYears(loan) {
  return loan.years ?? 25;
}

/** Mensualité capital + assurance (hors remboursement différé) */
export function loanMonthlyTotal(principal, loan) {
  if (principal <= 0) return { capital: 0, insurance: 0, total: 0 };
  const ins = principal * (loan.insuranceRate / 12);
  if (loan.repayMode === 'amortize' && loan.years != null) {
    const cap = loanPayment(principal, loan.rate, loan.years);
    return { capital: cap, insurance: ins, total: cap + ins };
  }
  if (loan.repayMode === 'amortize' && loan.years == null && loan.rate > 0) {
    const interest = principal * (loan.rate / 12);
    return { capital: interest, insurance: ins, total: interest + ins };
  }
  if (loan.repayMode === 'deferred_fixed' && loan.hcsf) {
    return { capital: loan.fixedRepay ?? 0, insurance: 0, total: loan.fixedRepay ?? 0 };
  }
  return { capital: 0, insurance: ins, total: ins };
}

/** Part retenue pour le taux d'endettement (HCSF) */
export function loanHcsfMonthly(principal, loan) {
  if (!loan.hcsf || principal <= 0) return 0;
  return loanMonthlyTotal(principal, loan).total;
}

/** Taux « tout compris » annualisé sur le capital initial (indicatif) */
export function loanAllInRate(principal, loan) {
  if (principal <= 0) return { insurancePct: 0, allInPct: 0, monthly: 0 };
  const { total, insurance } = loanMonthlyTotal(principal, loan);
  const insurancePct = loan.insuranceRate;
  const allInPct = (total * 12) / principal;
  return {
    insurancePct,
    allInPct,
    monthly: total,
    insuranceMonthly: insurance,
  };
}

function buildSchedule(principal, annualRate, years) {
  const n = years * 12;
  const payment = loanPayment(principal, annualRate, years);
  const schedule = [principal];
  let bal = principal;
  for (let i = 0; i < n; i++) {
    const interest = bal * (annualRate / 12);
    const cap = Math.min(bal, payment - interest);
    bal = Math.max(0, bal - cap);
    schedule.push(bal);
  }
  return schedule;
}

/**
 * Résout les montants empruntés et construit les tableaux d'amortissement.
 * @param {object} p params simulation (apport, purchasePrice, …)
 * @param {(m:number,p:object)=>number} monthlyGrossIncome
 */
export function resolveFinancing(p, monthlyGrossIncome) {
  const configs = resolveLoansList(p);
  const notary = p.purchasePrice * p.notaryRate;
  const totalCost = p.purchasePrice + notary;
  const ownContribution = configs
    .filter(l => l.role === 'own_contribution')
    .reduce((s, l) => s + l.amount, 0);

  let need = Math.max(0, totalCost);

  const principalById = Object.fromEntries(configs.map(l => [l.id, 0]));
  const setPrincipal = (id, v) => { principalById[id] = Math.max(0, v); };

  for (const loan of configs) {
    if (loan.role === 'own_contribution') {
      const amt = loan.amount;
      need = Math.max(0, need - amt);
      setPrincipal(loan.id, amt);
    }
  }

  for (const loan of configs) {
    if (loan.role === 'help_at_purchase' && loan.amountMode === 'manual') {
      const amt = loan.amount;
      need = Math.max(0, need - amt);
      setPrincipal(loan.id, amt);
    }
  }

  let hcsfUsed = 0;
  const maxPayment = monthlyGrossIncome(0, p) * (p.debtRatioCap ?? 0.35);
  const budgetLeft = () => Math.max(0, maxPayment - hcsfUsed);

  const applyMortgage = (loan, amt) => {
    const taken = Math.max(0, Math.min(amt, need));
    need = Math.max(0, need - taken);
    setPrincipal(loan.id, taken);
    hcsfUsed += loanHcsfMonthly(taken, loan);
  };

  for (const loan of configs) {
    if (loan.role !== 'mortgage' || loan.amountMode !== 'manual') continue;
    applyMortgage(loan, loan.amount);
  }

  for (const loan of configs) {
    if (loan.role !== 'mortgage' || loan.amountMode !== 'max_hcsf') continue;
    const years = amortYears(loan);
    const maxPrincipal = maxLoanFromPayment(
      budgetLeft(),
      loan.rate,
      years,
      loan.insuranceRate,
    );
    applyMortgage(loan, maxPrincipal);
  }

  for (const loan of configs) {
    if (loan.role !== 'mortgage' || loan.amountMode !== 'fill_gap') continue;
    applyMortgage(loan, need);
  }

  const mortgagePrincipal = configs
    .filter(l => l.role === 'mortgage')
    .reduce((s, l) => s + principalById[l.id], 0);

  const loanShortfall = need;
  const liquidAfterApport = Math.max(0, p.currentWealth - ownContribution);
  const extraFromSavings = Math.min(loanShortfall, liquidAfterApport);
  const remainingShortfall = loanShortfall - extraFromSavings;

  const resolved = configs.map(loan => {
    const principal = principalById[loan.id];
    const monthly = loanMonthlyTotal(principal, loan);
    const allIn = loanAllInRate(principal, loan);
    const hcsfMonthly = loanHcsfMonthly(principal, loan);
    let schedule = null;
    if (loan.repayMode === 'amortize' && principal > 0 && loan.years != null) {
      schedule = buildSchedule(principal, loan.rate, loan.years);
    }
    return {
      ...loan,
      principal,
      monthly,
      allIn,
      hcsfMonthly,
      schedule,
      deferredBalance: loan.role === 'help_at_purchase' ? principal : 0,
    };
  });

  const totalMonthlyLoan = resolved
    .filter(l => l.role === 'mortgage')
    .reduce((s, l) => s + l.monthly.total, 0);

  const hcsfMonthly = resolved.reduce((s, l) => s + l.hcsfMonthly, 0);

  const bankLoan = resolved
    .filter(l => l.role === 'mortgage' && l.id !== 'ptz')
    .reduce((s, l) => s + l.principal, 0);
  const ptzAmount = principalById.ptz ?? 0;

  const helpAtPurchase = resolved
    .filter(l => l.role === 'help_at_purchase')
    .reduce((s, l) => s + l.principal, 0);
  const downPayment = ownContribution + helpAtPurchase;

  return {
    notary,
    totalCost,
    downPayment,
    ownContribution,
    bankLoanNeeded: Math.max(0, totalCost - ownContribution - helpAtPurchase),
    mortgagePrincipal,
    bankLoan,
    ptzAmount,
    totalMonthlyLoan,
    hcsfMonthly,
    maxPayment,
    hcsfUsed: hcsfMonthly,
    hcsfOver: hcsfMonthly > maxPayment + 0.01,
    extraFromSavings,
    remainingShortfall,
    loanFeasible: remainingShortfall <= 0,
    investableSavings: Math.max(0, liquidAfterApport - extraFromSavings),
    resolvedLoans: resolved,
  };
}

/** Remboursement mensuel d'un prêt différé (apport complémentaire, etc.) */
export function deferredLoanRepayment(surplus, balance, loan, p) {
  if (balance <= 0) return 0;
  if (loan.repayMode === 'deferred_fixed') {
    return Math.min(loan.fixedRepay ?? 0, balance);
  }
  if (loan.repayMode === 'deferred_surplus') {
    const rate = loan.rate ?? 0;
    if (loan.opportunistic && (p.savingsYield ?? 0) > rate) return 0;
    return Math.max(0, Math.min(surplus, balance));
  }
  return 0;
}

export function deferredLoansFromResolved(resolvedLoans) {
  return resolvedLoans.filter(l => l.principal > 0 && l.role === 'help_at_purchase');
}

/** Encours d'amortissement à un mois m */
export function amortDebtAtMonth(m, resolvedLoans) {
  let debt = 0;
  for (const loan of resolvedLoans) {
    if (!loan.schedule) continue;
    const idx = Math.min(m, loan.schedule.length - 1);
    debt += loan.schedule[idx] ?? 0;
  }
  return debt;
}

/** Intérêts déductibles LMNP (portion intérêts du mois) */
export function mortgageInterestAtMonth(m, resolvedLoans) {
  let interest = 0;
  for (const loan of resolvedLoans) {
    if (!loan.schedule || loan.principal <= 0) continue;
    if (m >= loan.schedule.length - 1) continue;
    const bal = loan.schedule[m] ?? 0;
    interest += bal * (loan.rate / 12);
  }
  return interest;
}
