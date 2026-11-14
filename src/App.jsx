import { useState, useMemo, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import './index.css';
import {
  DEFAULT_PARAMS, fmt, totalWealth, loadParams, saveParams, clearSavedParams,
  exportParams, importParamsFile, effectiveSavingsYield, effectiveGrossSalary, livretARate,
  loadTheme, saveTheme, normalizeParams, loadActiveView, saveActiveView,
  loadSidebarOpen, saveSidebarOpen, loadBootstrapParams, fetchLocalDefaults,
} from './utils.js';
import { runSimulation, wealthAtPurchase } from './simulator.js';
import { ownContributionTotal, clampOwnContributionToCap, sanitizeLoan } from './loans.js';
import Sidebar from './Sidebar.jsx';
import AppNav from './AppNav.jsx';
import ProjectionChart from './ProjectionChart.jsx';
import GapChart from './GapChart.jsx';
import CompositionChart from './CompositionChart.jsx';
import MonthlyTable from './MonthlyTable.jsx';
import Portfolio, { PortfolioResetModal } from './Portfolio.jsx';
import { Button, useOverlayState } from '@heroui/react';

function ScenarioStrip({ rentW, sellW, keepW, bestKey, simYears }) {
  const rows = [
    { key: 'rent', label: 'Location', value: rentW },
    { key: 'buySell', label: 'Achat · vente', value: sellW },
    { key: 'keep', label: 'Achat · LMNP', value: keepW },
  ];
  return (
    <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border overflow-hidden rounded-lg border border-border bg-surface-secondary/50">
      {rows.map(row => (
        <div
          key={row.key}
          className={`px-4 py-3 ${row.key === bestKey ? 'bg-accent-soft' : 'bg-transparent'}`}
        >
          <p className={`text-xs mb-0.5 ${row.key === bestKey ? 'text-accent-soft-foreground font-medium' : 'text-muted'}`}>
            {row.label}
          </p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{fmt(row.value)}</p>
          <p className="text-[0.65rem] text-muted mt-0.5">à {simYears} ans</p>
        </div>
      ))}
    </div>
  );
}

const VIEW_TITLE = {
  settings: 'Paramètres',
  portfolio: 'Patrimoine de départ',
  table: 'Tableau mensuel',
  'chart-projection': 'Projection patrimoine',
  'chart-gap': 'Avantage achat vs rester locataire',
  'chart-composition': 'Composition du patrimoine',
};

function HeaderBtnIcon({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5 shrink-0" aria-hidden>
      {children}
    </svg>
  );
}

const iconExport = (
  <HeaderBtnIcon>
    <path d="M12 3v12M7 11l5 5 5-5M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
  </HeaderBtnIcon>
);
const iconImport = (
  <HeaderBtnIcon>
    <path d="M12 21V9M7 14l5-5 5 5M4 3h16" strokeLinecap="round" strokeLinejoin="round" />
  </HeaderBtnIcon>
);
const iconReset = (
  <HeaderBtnIcon>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 3v6h-6M21 12a9 9 0 0 1-15 6.7L3 21v-6h6" strokeLinecap="round" strokeLinejoin="round" />
  </HeaderBtnIcon>
);
const iconSun = (
  <HeaderBtnIcon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
  </HeaderBtnIcon>
);
const iconMoon = (
  <HeaderBtnIcon>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" strokeLinecap="round" strokeLinejoin="round" />
  </HeaderBtnIcon>
);

const headerActionBtnClass = '!inline-flex items-center gap-1.5';

export default function App() {
  const [params, setParams] = useState(() => loadBootstrapParams());
  const [view, setView] = useState(() => loadActiveView());
  const [savedAt, setSavedAt] = useState(null);
  const [theme, setTheme] = useState(() => loadTheme());
  const [navOpen, setNavOpen] = useState(() => loadSidebarOpen());
  const [isLgNav, setIsLgNav] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const saveTimer = useRef(null);
  const importRef = useRef(null);
  const resetModal = useOverlayState();
  const navCollapsed = !navOpen && isLgNav;

  // Sans sauvegarde navigateur : tenter defaults.local.json (machine locale uniquement, hors git).
  useEffect(() => {
    if (loadParams()) return;
    let cancelled = false;
    fetchLocalDefaults().then(local => {
      if (cancelled || !local) return;
      setParams(local);
      saveParams(local);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveParams(params);
      setSavedAt(new Date());
    }, 400);
    return () => clearTimeout(saveTimer.current);
  }, [params]);

  useEffect(() => {
    saveActiveView(view);
  }, [view]);

  useEffect(() => {
    saveSidebarOpen(navOpen);
  }, [navOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsLgNav(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.vibrantPalette = 'true';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const apply = () => setTheme(t => (t === 'light' ? 'dark' : 'light'));
    if (typeof document !== 'undefined' && document.startViewTransition) {
      document.startViewTransition(() => {
        flushSync(apply);
      });
    } else {
      apply();
    }
  };

  const set = (key, value) => setParams(prev => ({ ...prev, [key]: value }));
  const setPortfolio = (portfolio) => setParams(prev => ({ ...prev, portfolio }));
  const setLoans = (loans) => setParams(prev => {
    const sanitized = (loans ?? []).map(sanitizeLoan);
    const simSlice = {
      ...prev,
      loans: sanitized,
      currentWealth: totalWealth(prev),
      savingsYield: effectiveSavingsYield(prev),
      apportReserveYield: livretARate(prev),
    };
    const cap = wealthAtPurchase(simSlice);
    const capped = clampOwnContributionToCap(sanitized, cap);
    const unchanged = capped.every(
      (l, i) => sanitized[i]?.id === l.id && sanitized[i]?.amount === l.amount,
    );
    if (unchanged && ownContributionTotal(prev) === ownContributionTotal({ ...prev, loans: capped })) {
      return prev;
    }
    const next = { ...prev, loans: capped };
    next.aport = ownContributionTotal(next);
    return next;
  });

  const resetToDefaults = () => {
    clearSavedParams();
    setParams(normalizeParams(DEFAULT_PARAMS));
  };

  const handleExport = () => exportParams(params);
  const handleImport = async (file) => {
    try {
      const imported = await importParamsFile(file);
      setParams(normalizeParams(imported));
    } catch {
      window.alert('Fichier invalide : impossible de lire ces paramètres.');
    }
  };

  const wealth = totalWealth(params);

  const simParams = useMemo(() => {
    const yieldEff = effectiveSavingsYield(params);
    const { gross2026 } = effectiveGrossSalary(params);
    return {
      ...params,
      currentWealth: wealth,
      savingsYield: yieldEff,
      cdiGross2026: gross2026,
      apportReserveYield: livretARate(params),
    };
  }, [params, wealth]);

  const result = useMemo(() => {
    try { return runSimulation(simParams); }
    catch (e) { console.error(e); return null; }
  }, [simParams]);

  const purchaseWealthCap = useMemo(() => wealthAtPurchase(simParams), [simParams]);
  const apportTotal = ownContributionTotal(params);

  useEffect(() => {
    if (!params.loans?.length || apportTotal <= purchaseWealthCap) return;
    setLoans(params.loans);
  }, [purchaseWealthCap, apportTotal, params.loans]);

  const effectiveWealth = result?.meta?.waiting?.effectiveWealth ?? wealth;
  const waiting = result?.meta?.waiting;
  const last = result ? result.series.rent.length - 1 : 0;
  const rentW = result?.series.rent[last] ?? 0;
  const sellW = result?.series.buySell[last] ?? 0;
  const keepW = result?.series.lmnpKeep[last] ?? 0;

  const bestKey = [
    { key: 'rent', v: rentW },
    { key: 'buySell', v: sellW },
    { key: 'keep', v: keepW },
  ].sort((a, b) => b.v - a.v)[0]?.key ?? 'rent';

  const isChart = view === 'chart-projection' || view === 'chart-gap' || view === 'chart-composition';

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[min(100%,1600px)] flex-col overflow-hidden px-4 py-4 sm:px-6 lg:px-8">
      <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">
            Paris - Louer vs acheter
          </h1>
          <p className="mt-1 text-sm text-muted">
            Patrimoine {fmt(effectiveWealth)}
            {waiting?.waitMonths > 0 && ` · après ${waiting.waitMonths} mois d’attente`}
            {savedAt && (
              <span className="text-muted/80">
                {' · '}sauvegardé {savedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Données de la simulation">
            <Button size="sm" variant="secondary" className={headerActionBtnClass} onPress={handleExport}>
              {iconExport}
              Export
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className={headerActionBtnClass}
              onPress={() => importRef.current?.click()}
            >
              {iconImport}
              Import
            </Button>
            <Button size="sm" variant="secondary" className={headerActionBtnClass} onPress={() => resetModal.open()}>
              {iconReset}
              Réinitialiser
            </Button>
          </div>
          <div className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />
          <Button
            size="sm"
            variant="secondary"
            className={headerActionBtnClass}
            onPress={toggleTheme}
            aria-label={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            {theme === 'dark' ? iconSun : iconMoon}
            {theme === 'dark' ? 'Clair' : 'Sombre'}
          </Button>
        </div>
        <input
          ref={importRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = '';
          }}
        />
      </header>

      <PortfolioResetModal state={resetModal} onConfirm={resetToDefaults} />

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:gap-6">
        <aside
          className="app-nav-shell shrink-0 rounded-xl border border-border bg-surface p-3 lg:min-h-0 lg:self-stretch"
          data-collapsed={navOpen ? 'false' : 'true'}
        >
          <div className="mb-2 hidden items-center justify-end lg:flex">
            <Button
              size="sm"
              variant="ghost"
              className="app-nav-toggle !rounded-lg size-9 min-w-9 p-0"
              aria-expanded={navOpen}
              aria-label={navOpen ? 'Replier le menu' : 'Déplier le menu'}
              onPress={() => setNavOpen(o => !o)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-[1.125rem] transition-transform duration-300 ease-[cubic-bezier(0.34,1.2,0.64,1)]"
                style={{ transform: navOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
                aria-hidden
              >
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
          <AppNav view={view} onChange={setView} collapsed={navCollapsed} />
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0 py-1 sm:py-2">
          <h2 key={`title-${view}`} className="app-view-title mb-3 shrink-0 text-base font-semibold text-foreground">
            {VIEW_TITLE[view] ?? 'Simulateur'}
          </h2>

          {isChart ? (
            <div key={view} className="app-view-panel flex min-h-0 flex-1 flex-col">
              <ScenarioStrip
                rentW={rentW}
                sellW={sellW}
                keepW={keepW}
                bestKey={bestKey}
                simYears={params.simYears}
              />
              <div className="min-h-0 flex-1">
                {view === 'chart-projection' && <ProjectionChart result={result} theme={theme} />}
                {view === 'chart-gap' && <GapChart result={result} theme={theme} />}
                {view === 'chart-composition' && (
                  <CompositionChart result={result} p={simParams} theme={theme} />
                )}
              </div>
            </div>
          ) : (
            <div
              key={view}
              className={`app-view-panel min-h-0 flex-1 ${
                view === 'table'
                  ? 'flex flex-col overflow-hidden'
                  : view === 'portfolio'
                  ? 'overflow-y-auto overflow-x-hidden'
                  : 'overflow-y-auto overflow-x-hidden'
              }`}
            >
              {view === 'settings' && (
                <Sidebar
                  p={params}
                  set={set}
                  setLoans={setLoans}
                  wealth={wealth}
                  result={result}
                />
              )}
              {view === 'portfolio' && (
                <Portfolio params={params} setPortfolio={setPortfolio} theme={theme} />
              )}
              {view === 'table' && (
                <MonthlyTable result={result} departureYears={params.departureYears} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
