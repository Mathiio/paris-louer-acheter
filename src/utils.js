import { migrateLoansFromParams, sanitizeLoan, ensureDefaultLoans, ownContributionTotal } from './loans.js';

export const fmt = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0);

export const pct = (n) => `${Number(n).toFixed(1)} %`;

/** Mois / année courants — référence « patrimoine connu aujourd’hui » (onglet Patrimoine). */
export function wealthBaselineNow() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Ratio net/brut approximatif selon le statut, pour convertir le salaire brut
 * en net "social" (avant impôt sur le revenu). Le taux de cotisations salariales
 * d'un cadre est plus élevé (retraite complémentaire tranche 2, prévoyance
 * obligatoire, APEC) que celui d'un non-cadre.
 */
export const SOCIAL_CHARGE_RATIO = { cadre: 0.76, nonCadre: 0.78 };

export function socialChargeRatio(params) {
  return SOCIAL_CHARGE_RATIO[params?.employeeStatus] ?? 0.77;
}

/**
 * Taux de cotisations sociales URSSAF d'une micro-entreprise BNC (professions
 * libérales, régime général). Utilisé pour reconstituer le CA brut à partir du
 * CA "net URSSAF" saisi par l'utilisateur, avant d'appliquer l'abattement fiscal
 * de 34% — qui s'applique au CA brut, pas au CA déjà net de cotisations.
 */
export const MICRO_URSSAF_RATE_BNC = 0.211;

/**
 * Estimation grossière de la taxe foncière annuelle (Paris), calculée comme :
 *   Taxe foncière = (valeur locative cadastrale × 50 % d'abattement) × taux communal
 *                   + taxes annexes (TEOM, taxe spéciale d'équipement...)
 * La VLC réelle dépend de la surface pondérée, du confort et du quartier (donnée
 * propre à chaque logement, non publique). On utilise ici une VLC moyenne
 * représentative d'un bien parisien standard (~130 €/m²/an) et le taux communal
 * de Paris (20.5 % depuis 2023). Cette estimation reste indicative : le montant
 * réel figure sur l'avis de taxe foncière du bien (à demander au vendeur/agence).
 */
export const PROPERTY_TAX_ESTIMATE = {
  vlcParM2:      130,   // €/an, valeur locative cadastrale moyenne au m²
  tauxCommunal:  0.205, // Paris, depuis 2023 (13.5% → 20.5%)
  taxesAnnexes:  280,   // TEOM + taxe spéciale d'équipement + GEMAPI (moyenne)
};

export function estimatePropertyTax(surfaceM2) {
  const { vlcParM2, tauxCommunal, taxesAnnexes } = PROPERTY_TAX_ESTIMATE;
  const vlc = Math.max(0, surfaceM2 ?? 0) * vlcParM2;
  return Math.round(vlc * 0.5 * tauxCommunal + taxesAnnexes);
}

/**
 * Estimation indicative du loyer mensuel visé en location meublée (LMNP) à Paris,
 * hors charges de copropriété récupérables. Hypothèse : marché longue durée meublée
 * (~45–52 €/m² selon la taille), calibrée pour qu’un ~23 m² ≈ 1 100 €/mois.
 * Le loyer réel dépend de l’arrondissement, de l’état du bien et du niveau de charges.
 */
export const LMNP_RENT_ESTIMATE = {
  /** ~48 €/m² → 23 m² ≈ 1 100 €/mois (meublé longue durée, Paris, ordre de grandeur) */
  eurPerM2:  48,
  minRent:   650,
  maxRent:   2800,
  roundStep: 25,
};

function lmnpRentEurPerM2() {
  return LMNP_RENT_ESTIMATE.eurPerM2;
}

export function estimateLmnpRent(surfaceM2) {
  const s = Math.max(1, surfaceM2 ?? 0);
  const { minRent, maxRent, roundStep } = LMNP_RENT_ESTIMATE;
  const raw = s * lmnpRentEurPerM2();
  const rounded = Math.round(raw / roundStep) * roundStep;
  return Math.min(maxRent, Math.max(minRent, rounded));
}

/** Taux €/m² utilisé pour l’estimation (affichage aide) */
export function estimateLmnpRentPerM2() {
  return LMNP_RENT_ESTIMATE.eurPerM2;
}

/**
 * Modèles de placements proposés à l'ajout (l'utilisateur peut aussi créer une ligne vide).
 * Chaque ligne du patrimoine est stockée dans params.portfolio :
 * { id, name, desc, amount, rate, reserveForApport? }
 */
export const PORTFOLIO_TEMPLATES = [
  { name: 'Livret A / épargne réglementée', desc: 'Fonds d\'urgence, défiscalisé', amount: 0, rate: 0.0175, reserveForApport: true },
  { name: 'LEP', desc: 'Plafonné, sous conditions de revenus', amount: 0, rate: 0.025 },
  { name: 'Assurance-vie', desc: 'Fonds euros + UC — taux net estimé', amount: 0, rate: 0.06 },
  { name: 'CTO', desc: 'Compte-titres — flat tax déjà déduite si taux net', amount: 0, rate: 0.07 },
  { name: 'Cryptomonnaie', desc: 'Actifs volatils — taux net / rendement prudent', amount: 0, rate: 0.05 },
  { name: 'Liquidités', desc: 'Compte courant, espèces', amount: 0, rate: 0 },
  { name: 'Autre placement', desc: 'Description libre', amount: 0, rate: 0.03 },
];

/** Ancien format fixe — sert uniquement à migrer les sauvegardes v1 */
const LEGACY_PORTFOLIO_ITEMS = [
  { key: 'pf_crowdlending', rateKey: 'pf_crowdlending_rate', name: 'Crowdlending (Première Brique...)', defaultRate: 0.0854, desc: 'Ex : 12.2% brut − 30% flat tax → net' },
  { key: 'pf_livretA', rateKey: 'pf_livretA_rate', name: 'Livret A + Livret Jeune', defaultRate: 0.0175, desc: 'Fonds d\'urgence liquide, défiscalisé', reserveForApport: true },
  { key: 'pf_lep', rateKey: 'pf_lep_rate', name: 'LEP', defaultRate: 0.025, desc: 'Plafonné, sous conditions de revenus' },
  { key: 'pf_av', rateKey: 'pf_av_rate', name: 'Assurance-Vie', defaultRate: 0.062, desc: 'Fonds euros + UC, avantage fiscal après 8 ans' },
  { key: 'pf_cto', rateKey: 'pf_cto_rate', name: 'CTO (Trade Republic...)', defaultRate: 0.07, desc: 'Compte-titres, flat tax 30% déjà déduite' },
  { key: 'pf_pea', rateKey: 'pf_pea_rate', name: 'PEA', defaultRate: 0.0745, desc: 'IR exonéré après 5 ans (18.2% PS restants)' },
  { key: 'pf_liquide', rateKey: 'pf_liquide_rate', name: 'Liquidités & divers', defaultRate: 0.0, desc: 'Compte courant, parts sociales...' },
];

/** @deprecated — alias pour scripts / ancien code */
export const PORTFOLIO_ITEMS = LEGACY_PORTFOLIO_ITEMS;

/** Patrimoine d’exemple au premier lancement (aucune donnée réelle — personnalisable dans l’app). */
export const DEFAULT_PORTFOLIO = [
  { id: 'pf_livretA', name: 'Livret A / épargne réglementée', desc: 'Fonds d\'urgence, défiscalisé', amount: 25_000, rate: 0.0175, reserveForApport: true },
  { id: 'pf_av', name: 'Assurance-vie', desc: 'Fonds euros + UC — taux net estimé', amount: 35_000, rate: 0.05, reserveForApport: false },
  { id: 'pf_cto', name: 'CTO', desc: 'Compte-titres — flat tax si taux net', amount: 15_000, rate: 0.06, reserveForApport: false },
  { id: 'pf_crypto', name: 'Cryptomonnaie', desc: 'Actifs volatils — taux net / rendement prudent', amount: 15_000, rate: 0.05, reserveForApport: false },
  { id: 'pf_liquide', name: 'Liquidités', desc: 'Compte courant', amount: 10_000, rate: 0, reserveForApport: false },
];

export function newPortfolioId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `pf_${crypto.randomUUID()}`;
  return `pf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newPortfolioItem(partial = {}) {
  return {
    id: partial.id ?? newPortfolioId(),
    name: partial.name ?? 'Nouveau placement',
    desc: partial.desc ?? '',
    amount: Math.max(0, Number(partial.amount) || 0),
    rate: Math.max(0, Number(partial.rate) || 0),
    reserveForApport: Boolean(partial.reserveForApport),
  };
}

function sanitizePortfolioItem(raw) {
  if (!raw || typeof raw !== 'object') return newPortfolioItem();
  return newPortfolioItem(raw);
}

/** Reconstruit portfolio[] depuis l'ancien format pf_* / pf_*_rate */
function migrateLegacyPortfolio(params) {
  const hasLegacy = LEGACY_PORTFOLIO_ITEMS.some(item => params[item.key] != null || params[item.rateKey] != null);
  if (!hasLegacy) return DEFAULT_PORTFOLIO.map(i => ({ ...i }));
  return LEGACY_PORTFOLIO_ITEMS.map(item => newPortfolioItem({
    id: item.key,
    name: item.name,
    desc: item.desc ?? '',
    amount: params[item.key] ?? 0,
    rate: params[item.rateKey] ?? item.defaultRate ?? 0,
    reserveForApport: item.reserveForApport ?? item.key === 'pf_livretA',
  }));
}

/** Patrimoine effectif (tableau de lignes éditables) */
export function resolvePortfolio(params) {
  if (Array.isArray(params?.portfolio) && params.portfolio.length > 0) {
    return params.portfolio.map(sanitizePortfolioItem);
  }
  return migrateLegacyPortfolio(params ?? {});
}

/** Fusionne défauts, migre le patrimoine, nettoie la structure */
export function normalizeParams(params) {
  const merged = { ...DEFAULT_PARAMS, ...params };
  if (Array.isArray(params?.portfolio) && params.portfolio.length > 0) {
    merged.portfolio = params.portfolio.map(sanitizePortfolioItem);
  } else {
    merged.portfolio = migrateLegacyPortfolio(merged);
  }
  const fromSaved = Array.isArray(params?.loans) && params.loans.length > 0;
  const rawLoans = fromSaved ? params.loans : migrateLoansFromParams(merged);
  merged.loans = (fromSaved ? rawLoans : ensureDefaultLoans(rawLoans, merged)).map(sanitizeLoan);
  merged.aport = ownContributionTotal(merged);
  return merged;
}

/** Hypothèses par défaut (démonstration publique). Les vraies valeurs restent dans le navigateur (localStorage) ou un export JSON local. */
export const DEFAULT_PARAMS = {
  // Simulation start date
  startYear:  2026,
  startMonth: 6,   // 1-indexed (6 = June)
  // Achat
  purchasePrice:    250_000,
  notaryRate:       0.075,
  aport:            40_000,
  ptzEnabled:       false,
  /** Surface habitable — utilisée uniquement pour estimer la taxe foncière */
  surfaceM2:        28,

  // Financement
  bankRate:          0.035,
  loanYears:         25,
  insuranceRate:     0.0015,
  parentLoan:        20_000,
  parentRepayMode:   'fixed',
  parentFixedPayment: 200,
  /** Taux du prêt complémentaire (legacy parentLoanRate) — 0 = gratuit par défaut */
  parentLoanRate:    0,
  /** Autoriser un taux non nul sur le prêt complémentaire (legacy) */
  parentLoanHasRate: false,

  /** 'cadre' ou 'nonCadre' — impacte le ratio de cotisations salariales brut→net */
  employeeStatus:    'cadre',
  cdiGross2026:      45_000,
  salaryGrowth:      0.015,
  /** CA micro-entreprise annuel, net des cotisations URSSAF déjà payées (régime BNC) */
  microRevenueAnnual: 0,
  vendanges2026:     0,
  /** Part du CA micro prise en compte par la banque (HCSF) */
  microBankWeight:   0.70,
  /** Plafond d'endettement bancaire (HCSF) */
  debtRatioCap:      0.35,

  // Épargne — rendement
  /** 'auto' = moyenne pondérée des taux du patrimoine ; 'manual' = valeur fixe ci-dessous */
  savingsYieldMode:   'auto',
  savingsYieldManual: 0.06,
  /** Loyer actuel (ex : colocation) — utilisé pendant l'attente avant le démarrage du projet */
  currentRent:       850,
  /** Loyer si vous restez locataire seul(e) à partir du démarrage du projet (ou après un départ de Paris) */
  futureRent:        1_050,
  rentInflation:     0.015,
  departureYears:    5,

  // LMNP / Revente
  lmnpRent:          1_200,
  propertyTax:       900,
  coopCharges:       120,
  maintenanceRate:   0.008,
  propertyAppreciation: 0.015,
  agencyFeeRate:     0.04,
  /** Cotisation Foncière des Entreprises (LMNP), due à partir de la 2e année d'activité */
  cfeAnnual:         300,
  /**
   * Taux d'imposition appliqué au résultat LMNP une fois l'amortissement comptable
   * épuisé (85% du prix amorti sur 25 ans) : IR tranche marginale (~30%) + prélèvements
   * sociaux (17.2%). Avant épuisement, le résultat imposable est nul.
   */
  lmnpTaxRate:       0.472,
  /** Revalorisation annuelle de la taxe foncière — historiquement plus rapide que l'inflation générale */
  propertyTaxGrowth: 0.04,
  /**
   * Si activé, la valeur du bien dans le patrimoine LMNP est comptée nette des frais de sortie
   * (agence) — pour une comparaison prudente avec les scénarios 100% liquides. Désactivé par défaut :
   * la valeur du bien est comptée à 100%, cohérent avec "Achat + Revente" avant la vente effective.
   */
  lmnpLiquidationAdjusted: false,

  // Divers
  inflation:         0.02,
  fixedExpenses:     500,
  variableExpenses:  250,
  simYears:          15,

  /** Lignes de patrimoine (montant + taux net annuel, libellés personnalisables) */
  portfolio: DEFAULT_PORTFOLIO,

  /** Prêts (voir loans.js) — source de vérité pour le financement */
  loans: null,
};

/** Calcule le patrimoine total à partir des postes */
export function totalWealth(params) {
  return resolvePortfolio(params).reduce((s, item) => s + (item.amount ?? 0), 0);
}

/** Rendement net moyen pondéré du patrimoine, calculé à partir des taux par poste */
export function weightedPortfolioYield(params) {
  const items = resolvePortfolio(params);
  const total = totalWealth(params);
  if (total <= 0) return params.savingsYieldManual ?? 0.03;
  const weighted = items.reduce((s, item) => s + (item.amount ?? 0) * (item.rate ?? 0), 0);
  return weighted / total;
}

/** Rendement effectif retenu pour la simulation (auto = pondéré, sinon manuel) */
export function effectiveSavingsYield(params) {
  return params.savingsYieldMode === 'manual'
    ? (params.savingsYieldManual ?? 0.06)
    : weightedPortfolioYield(params);
}

/** Taux « prudent » pour l'épargne réservée à l'apport (ligne marquée réserve, ou Livret, ou 1.75 %) */
export function livretARate(params) {
  const items = resolvePortfolio(params);
  const reserved = items.find(i => i.reserveForApport);
  if (reserved) return reserved.rate ?? 0.0175;
  const livret = items.find(i => /livret|lep|réglementé/i.test(i.name ?? ''));
  if (livret) return livret.rate ?? 0.0175;
  return 0.0175;
}

/** Salaire brut annuel de référence (2026) ; les années suivantes suivent la progression salariale. */
export function effectiveGrossSalary(params) {
  return { gross2026: params.cdiGross2026 };
}

/** Fichier servi depuis `public/` — présent uniquement en local, ignoré par git. */
export const LOCAL_DEFAULTS_URL = '/defaults.local.json';

/**
 * Charge les paramètres perso depuis le disque (développement / usage local).
 * Absent sur le déploiement public → retourne null (on garde DEFAULT_PARAMS).
 */
export async function fetchLocalDefaults() {
  try {
    const res = await fetch(LOCAL_DEFAULTS_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const parsed = await res.json();
    return normalizeParams(parsed);
  } catch {
    return null;
  }
}

/** Ordre de bootstrap : localStorage → DEFAULT_PARAMS (démo publique). */
export function loadBootstrapParams() {
  return normalizeParams(loadParams() ?? DEFAULT_PARAMS);
}

// ── Persistance locale (localStorage) ──────────────────────────────
const STORAGE_KEY = 'appart-sim-params-v1';
const SIDEBAR_OPEN_KEY = 'appart-sidebar-open';
const ACTIVE_VIEW_KEY = 'appart-active-view';

const VALID_VIEWS = new Set([
  'settings',
  'portfolio',
  'table',
  'chart-projection',
  'chart-gap',
  'chart-composition',
]);

export function loadActiveView() {
  try {
    const v = localStorage.getItem(ACTIVE_VIEW_KEY);
    if (v && VALID_VIEWS.has(v)) return v;
    if (v === 'report') return 'chart-projection';
    return 'chart-projection';
  } catch {
    return 'chart-projection';
  }
}

export function saveActiveView(view) {
  try {
    localStorage.setItem(ACTIVE_VIEW_KEY, view);
  } catch { /* noop */ }
}

export function loadSidebarOpen() {
  try {
    return localStorage.getItem(SIDEBAR_OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveSidebarOpen(open) {
  try {
    localStorage.setItem(SIDEBAR_OPEN_KEY, open ? '1' : '0');
  } catch { /* noop */ }
}

/** Charge les paramètres sauvegardés, fusionnés avec les valeurs par défaut */
export function loadParams() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (typeof saved !== 'object' || saved === null) return null;
    return normalizeParams(saved);
  } catch {
    return null;
  }
}

/** Sauvegarde les paramètres courants */
export function saveParams(params) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
    return true;
  } catch {
    return false;
  }
}

/** Efface la sauvegarde locale */
export function clearSavedParams() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
}

// ── Thème (clair / sombre) ──────────────────────────────────────────
const THEME_KEY = 'appart-sim-theme-v1';

/** Charge le thème sauvegardé, sinon respecte la préférence système, sinon sombre par défaut */
export function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* noop */ }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

export function saveTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* noop */ }
}

/** Déclenche le téléchargement des paramètres actuels au format JSON */
export function exportParams(params) {
  const blob = new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `simulateur-immo-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Lit un fichier JSON importé et renvoie les paramètres fusionnés avec les défauts */
export function importParamsFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        resolve(normalizeParams(parsed));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
