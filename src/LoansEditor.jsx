import { Button } from '@heroui/react';
import { fmt, pct } from './utils.js';
import { newLoan, sanitizeLoan } from './loans.js';
import { SimSelect, SimSlider } from './ui/simControls.jsx';
import { SimHint, SimStatRow } from './ui/primitives.jsx';

const AMOUNT_MODE_OPTIONS = [
  { value: 'manual', label: 'Montant fixe' },
  { value: 'max_hcsf', label: 'Auto · max. HCSF' },
  { value: 'fill_gap', label: 'Auto · compléter le besoin' },
];

const ROLE_OPTIONS = [
  { value: 'own_contribution', label: 'Apport personnel' },
  { value: 'mortgage', label: 'Crédit immobilier' },
  { value: 'help_at_purchase', label: 'Apport complémentaire (prêt)' },
];

function labelForRole(role) {
  return ROLE_OPTIONS.find(o => o.value === role)?.label ?? 'Prêt';
}

function patchLoan(loans, id, patch) {
  return loans.map(l => (l.id === id ? sanitizeLoan({ ...l, ...patch }) : l));
}

function financingIncompleteCopy(meta) {
  if (meta.shortfallBeyondLiquid > 0) {
    return (
      <>
        Il manque {fmt(meta.remainingShortfall)} pour couvrir l&apos;acquisition, dont{' '}
        {fmt(meta.shortfallBeyondLiquid)} au-delà de votre épargne liquide après apport. Les
        scénarios d&apos;achat restent indicatifs tant que le plan n&apos;est pas bouclé.
      </>
    );
  }
  return (
    <>
      Il manque {fmt(meta.remainingShortfall)} : augmentez les prêts, l&apos;apport complémentaire
      ou réduisez l&apos;apport personnel. L&apos;épargne restante n&apos;est pas utilisée
      automatiquement.
    </>
  );
}

/** Carte récap financement — HCSF + alerte intégrée si besoin */
const financeCardClass = (incomplete) =>
  `rounded-lg border p-3 space-y-2 ${
    incomplete
      ? 'border-danger/50 bg-danger/10'
      : 'border-border bg-surface-secondary'
  }`;

export default function LoansEditor({
  loans,
  setLoans,
  resolvedLoans,
  meta,
  debtRatioCap = 0.35,
  maxOwnContribution,
}) {
  const roleOrder = { own_contribution: 0, help_at_purchase: 1, mortgage: 2 };
  const list = [...(loans ?? [])].sort(
    (a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9),
  );

  const update = (id, patch) => setLoans(patchLoan(list, id, patch));
  const remove = (id) => setLoans(list.filter(l => l.id !== id));
  const add = () => setLoans([...list, newLoan({ label: labelForRole('mortgage') })]);

  const resolvedById = Object.fromEntries((resolvedLoans ?? []).map(r => [r.id, r]));

  return (
    <div className="space-y-3">
      {list.map(loan => {
        const resolved = resolvedById[loan.id];
        const principal = resolved?.principal ?? 0;
        const isHelp = loan.role === 'help_at_purchase';
        const isOwn = loan.role === 'own_contribution';
        const otherOwn = list
          .filter(l => l.role === 'own_contribution' && l.id !== loan.id)
          .reduce((s, l) => s + l.amount, 0);
        const ownMax = isOwn
          ? Math.max(0, (maxOwnContribution ?? 0) - otherOwn)
          : 400_000;
        const showAmount = loan.amountMode === 'manual' || isHelp || isOwn;
        const showTerm = !isHelp && !isOwn && loan.repayMode === 'amortize';

        return (
          <section
            key={loan.id}
            className="rounded-lg border border-border bg-surface-secondary p-2.5 space-y-2"
          >
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <SimSelect
                  hideLabel
                  label="Type"
                  value={loan.role}
                  onChange={v => {
                    const role = v;
                    update(loan.id, {
                      role,
                      label: labelForRole(role),
                      hcsf: role === 'mortgage',
                      amountMode: role === 'mortgage' ? loan.amountMode : 'manual',
                      repayMode: role === 'help_at_purchase' ? 'deferred_fixed' : 'amortize',
                      years: role === 'mortgage' ? (loan.years ?? 25) : null,
                      rate: role === 'own_contribution' ? 0 : loan.rate,
                      insuranceRate: role === 'own_contribution' ? 0 : loan.insuranceRate,
                    });
                  }}
                  options={ROLE_OPTIONS}
                />
                {!isHelp && !isOwn && (
                  <SimSelect
                    hideLabel
                    label="Montant"
                    value={loan.amountMode}
                    onChange={v => update(loan.id, { amountMode: v })}
                    options={AMOUNT_MODE_OPTIONS}
                  />
                )}
              </div>
              {!(list.length === 1 && loan.role === 'own_contribution') && (
                <Button
                  size="sm"
                  variant="tertiary"
                  isIconOnly
                  className="shrink-0 self-start"
                  aria-label="Supprimer"
                  onPress={() => remove(loan.id)}
                >
                  ×
                </Button>
              )}
            </div>

            {showAmount && (
              <SimSlider
                label={isOwn ? 'Montant apporté' : 'Capital'}
                valueLabel={fmt(isOwn ? Math.min(loan.amount, ownMax) : loan.amount)}
                min={0}
                max={isOwn ? ownMax : 400_000}
                step={1000}
                value={isOwn ? Math.min(loan.amount, ownMax) : loan.amount}
                onChange={v => update(loan.id, {
                  amount: isOwn ? Math.min(v, ownMax) : v,
                })}
                info={isOwn && maxOwnContribution != null ? (
                  <>Plafond : {fmt(maxOwnContribution)} (patrimoine au démarrage de l&apos;achat).</>
                ) : undefined}
              />
            )}

            {!showAmount && resolved && (
              <SimHint className="mb-0 -mt-2">
                Capital retenu : <strong className="text-foreground">{fmt(principal)}</strong>
              </SimHint>
            )}

            {!isOwn && (
              <SimSlider
                label="Taux d'intérêt"
                valueLabel={pct(loan.rate * 100)}
                min={0}
                max={8}
                step={0.05}
                value={loan.rate * 100}
                onChange={v => update(loan.id, { rate: v / 100 })}
              />
            )}

            {!isHelp && !isOwn && (
              <SimSlider
                label="Assurance (sur capital / an)"
                valueLabel={pct(loan.insuranceRate * 100)}
                min={0}
                max={0.5}
                step={0.01}
                value={loan.insuranceRate * 100}
                onChange={v => update(loan.id, { insuranceRate: v / 100 })}
              />
            )}

            {showTerm && (
              <>
                {loan.years != null && (
                  <SimSlider
                    label="Durée"
                    valueLabel={`${loan.years} ans`}
                    min={5}
                    max={30}
                    step={1}
                    value={loan.years}
                    onChange={v => update(loan.id, { years: v })}
                  />
                )}
              </>
            )}

            {isHelp && (
              <SimSlider
                label="Mensualité"
                valueLabel={`${loan.fixedRepay} €/m`}
                min={0}
                max={1500}
                step={25}
                value={loan.fixedRepay}
                onChange={v => update(loan.id, { fixedRepay: v, repayMode: 'deferred_fixed' })}
              />
            )}

          </section>
        );
      })}

      <Button size="sm" variant="secondary" className="w-full" onPress={add}>
        + Ajouter un financement
      </Button>

      {meta && (
        <section className={financeCardClass(!meta.loanFeasible)}>
          {!meta.loanFeasible && (
            <div className="space-y-1 pb-2 border-b border-danger/25">
              <p className="text-sm font-semibold text-danger">Financement incomplet</p>
              <p className="text-xs leading-relaxed text-foreground">
                {financingIncompleteCopy(meta)}
              </p>
            </div>
          )}
          <p className="text-xs font-medium text-accent-soft-foreground">
            Synthèse HCSF ({pct(debtRatioCap * 100)} du brut)
          </p>
          <div className="space-y-0.5">
            <SimStatRow label="Plafond mensualités" value={`${fmt(meta.maxPayment)}/m`} tone="warn" />
            <SimStatRow
              label="Retenue HCSF"
              value={`${fmt(meta.hcsfMonthly ?? meta.totalMonthlyLoan)}/m`}
              tone={meta.hcsfOver ? 'neg' : undefined}
            />
            <SimStatRow label="Mensualités crédit" value={`${fmt(meta.totalMonthlyLoan)}/m`} />
            {meta.remainingShortfall > 0 && (
              <SimStatRow
                label="Manque au financement"
                value={fmt(meta.remainingShortfall)}
                tone="neg"
              />
            )}
          </div>
          {meta.hcsfOver && (
            <SimHint tone="danger" className="mb-0">
              Dépassement du plafond d&apos;endettement sur les prêts marqués HCSF.
            </SimHint>
          )}
        </section>
      )}
    </div>
  );
}
