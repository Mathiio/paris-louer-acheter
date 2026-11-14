import {
  fmt, pct,
  estimatePropertyTax, estimateLmnpRent, estimateLmnpRentPerM2,
} from './utils.js';
import {
  SimSlider,
  SimSelect,
  SimSeg,
  SimSettingsBlock,
  SimSwitch,
} from './ui/simControls.jsx';
import {
  SimAlert, SimApplyEstimate, SimFieldLabel, SimHint, SimInfoCard, SimInfoTip,
} from './ui/primitives.jsx';
import LoansEditor from './LoansEditor.jsx';
import { resolveLoansList, ownContributionTotal } from './loans.js';

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function Sidebar({ p, set, setLoans, wealth, result }) {
  const apport = ownContributionTotal(p);
  const wealthAtStart = result?.meta?.waiting?.effectiveWealth ?? wealth;
  const remaining = wealthAtStart - apport;
  const meta = result?.meta;
  const notaryFees = p.purchasePrice * p.notaryRate;
  const acquisitionTotal = p.purchasePrice + notaryFees;

  return (
    <div className="w-full min-w-0">

      <div className="grid gap-5 lg:gap-6 xl:grid-cols-2">
        <SimSettingsBlock id="start" title="Chronologie">
          <div className="grid grid-cols-2 gap-3">
            <SimSelect
              label="Mois de l’achat"
              value={p.startMonth}
              coerceNumber
              onChange={v => set('startMonth', v)}
              options={MONTHS_FR.map((m, i) => ({ value: i + 1, label: m }))}
            />
            <SimSelect
              label="Année de l’achat"
              value={p.startYear}
              coerceNumber
              onChange={v => set('startYear', v)}
              options={[2026, 2027, 2028, 2029, 2030].map(y => ({ value: y, label: String(y) }))}
            />
          </div>

          <SimSlider
            label="Départ de Paris"
            valueLabel={`dans ${p.departureYears} ans (${p.startYear + p.departureYears})`}
            min={2}
            max={10}
            step={1}
            value={p.departureYears}
            onChange={v => set('departureYears', v)}
            info="Moment où vous quittez Paris : bascule revente ou LMNP dans les scénarios d’achat."
          />

          <SimSlider label="Horizon de simulation" valueLabel={`${p.simYears} ans`}
 min={5} max={30} step={1}
            value={p.simYears} onChange={v => set('simYears', v)} />
          {p.simYears <= p.departureYears && (
            <SimHint tone="warning">
              L&apos;horizon est plus court que le délai avant départ de Paris ({p.departureYears} ans) :
              la phase LMNP/revente ne sera jamais atteinte dans la simulation.
            </SimHint>
          )}

          {meta?.waiting?.waitMonths > 0 && (
            <SimInfoCard
            >
              <div className="flex items-baseline justify-between gap-2 py-0.5 text-sm">
                <span className="flex min-w-0 items-center gap-0.5 text-muted">
                  Patrimoine au démarrage ({meta.waiting.waitMonths} mois location)
                  <SimInfoTip label="Détail du patrimoine au démarrage" className="!size-5 min-w-5">
                    <ul className="m-0 list-none space-y-1.5 p-0">
                      <li className="flex justify-between gap-3">
                        <span>Patrimoine initial</span>
                        <span className="shrink-0 font-medium tabular-nums">{fmt(meta.waiting.baselineWealth)}</span>
                      </li>
                      <li className="flex justify-between gap-3">
                        <span>Épargne nette cumulée</span>
                        <span className="shrink-0 font-medium tabular-nums text-success">
                          +{fmt(meta.waiting.cashFlowTotal)}
                        </span>
                      </li>
                      <li className="flex justify-between gap-3">
                        <span>Intérêts générés</span>
                        <span className="shrink-0 font-medium tabular-nums text-success">
                          +{fmt(meta.waiting.interestEarned)}
                        </span>
                      </li>
                      <li className="flex justify-between gap-3 border-t border-border pt-1.5 font-medium text-foreground">
                        <span>Total</span>
                        <span className="shrink-0 tabular-nums">{fmt(meta.waiting.effectiveWealth)}</span>
                      </li>
                    </ul>
                  </SimInfoTip>
                </span>
                <span className="font-semibold tabular-nums text-foreground whitespace-nowrap">
                  {fmt(meta.waiting.effectiveWealth)}
                </span>
              </div>
            </SimInfoCard>
          )}
        </SimSettingsBlock>

        <SimSettingsBlock id="buy" title="Achat">
          <SimSelect
            label="Type de bien"
            value={p.notaryRate}
            coerceNumber
            onChange={v => set('notaryRate', v)}
            options={[
              { value: 0.075, label: 'Ancien (~7.5% frais)' },
              { value: 0.025, label: 'Neuf / VEFA (~2.5%)' },
            ]}
          />

          <SimSlider
            label="Prix d'achat"
            valueLabel={fmt(p.purchasePrice)}
            min={150000}
            max={300000}
            step={5000}
            value={p.purchasePrice}
            onChange={v => set('purchasePrice', v)}
            info="Prix net vendeur (annonce). Les frais de notaire s’ajoutent selon « Type de bien » (voir le coût total ci-dessous). L’apport : section Financement."
          />

          <SimSlider
            label="Surface habitable"
            valueLabel={`${p.surfaceM2} m²`}
            min={9}
            max={100}
            step={1}
            value={p.surfaceM2}
            onChange={v => set('surfaceM2', v)}
            info="Utilisée pour estimer le loyer LMNP visé et la taxe foncière (section LMNP & fiscalité)."
          />

          <SimInfoCard>
            <div className="flex items-baseline justify-between gap-2 py-0.5 text-sm">
              <span className="flex min-w-0 items-center gap-0.5 text-muted">
                Coût total d&apos;acquisition
                <SimInfoTip label="Détail du coût d'acquisition" className="!size-5 min-w-5">
                  <ul className="m-0 list-none space-y-1.5 p-0">
                    <li className="flex justify-between gap-3">
                      <span>Prix net vendeur</span>
                      <span className="shrink-0 font-medium tabular-nums">{fmt(p.purchasePrice)}</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span>Frais de notaire ({pct(p.notaryRate * 100)})</span>
                      <span className="shrink-0 font-medium tabular-nums">+{fmt(notaryFees)}</span>
                    </li>
                    <li className="flex justify-between gap-3 border-t border-border pt-1.5 font-medium text-foreground">
                      <span>Total à financer</span>
                      <span className="shrink-0 tabular-nums">{fmt(acquisitionTotal)}</span>
                    </li>
                  </ul>
                </SimInfoTip>
              </span>
              <span className="font-semibold tabular-nums text-foreground whitespace-nowrap">
                {fmt(acquisitionTotal)}
              </span>
            </div>
          </SimInfoCard>
        </SimSettingsBlock>

        <SimSettingsBlock id="finance" title="Financement" className="xl:col-span-2">
          <SimHint tone={remaining < 0 ? 'danger' : undefined}>
            Épargne restante après apport
            {meta?.waiting?.waitMonths > 0 ? ' (au démarrage)' : ''}
            {' : '}
            <strong className="text-foreground">{fmt(remaining)}</strong>
            {meta?.extraFromSavings > 0 && (
              <> · complément prêt : <strong className="text-warning">{fmt(meta.extraFromSavings)}</strong></>
            )}
          </SimHint>

          {!meta?.loanFeasible && meta && (
            <SimAlert title="Financement incomplet">
              Il manque {fmt(meta.remainingShortfall)} au-delà de votre épargne liquide disponible.
            </SimAlert>
          )}

          <LoansEditor
            loans={p.loans ?? resolveLoansList(p)}
            setLoans={setLoans}
            resolvedLoans={meta?.resolvedLoans}
            meta={meta}
            debtRatioCap={p.debtRatioCap ?? 0.35}
            maxOwnContribution={wealthAtStart}
          />
        </SimSettingsBlock>

        <SimSettingsBlock id="income" title="Revenus & épargne">
          <SimFieldLabel
            label="Statut"
            info={(
              <>
                Ratio cotisations salariales retenu : brut → net ≈{' '}
                {pct((p.employeeStatus === 'nonCadre' ? 78 : 76))}.
              </>
            )}
            infoLabel="Cotisations salariales"
          />
          <SimSeg
            value={p.employeeStatus ?? 'cadre'}
            onChange={v => set('employeeStatus', v)}
            options={[{ value: 'cadre', label: 'Cadre' }, { value: 'nonCadre', label: 'Non-cadre' }]}
          />

          <SimSlider
            label="Salaire CDI brut (2026)"
            valueLabel={fmt(p.cdiGross2026)}
            min={20000}
            max={90000}
            step={1000}
            value={p.cdiGross2026}
            onChange={v => set('cdiGross2026', v)}
          />

          <SimSlider label="Progression salariale annuelle" valueLabel={pct(p.salaryGrowth * 100)}
 min={0} max={5} step={0.25}
            value={p.salaryGrowth * 100} onChange={v => set('salaryGrowth', v / 100)} />

          <SimSlider
            label="Loyer actuel"
            valueLabel={`${p.currentRent} €/m`}
            min={400}
            max={1200}
            step={10}
            value={p.currentRent}
            onChange={v => set('currentRent', v)}
            info="Payé jusqu'au démarrage du projet."
          />

          <SimSlider
            label="Loyer futur"
            valueLabel={`${p.futureRent} €/m`}
            min={600}
            max={1600}
            step={10}
            value={p.futureRent}
            onChange={v => set('futureRent', v)}
            info="Utilisé dans le scénario « Location seule » à partir du démarrage, et si vous quittez Paris après la revente/LMNP."
          />

          <SimSlider label="Charges fixes (hors logement)" valueLabel={`${p.fixedExpenses} €/m`}
 min={200} max={1200} step={25}
            value={p.fixedExpenses} onChange={v => set('fixedExpenses', v)} />

          <SimSlider label="Nourriture & sorties" valueLabel={`${p.variableExpenses} €/m`}
 min={100} max={700} step={25}
            value={p.variableExpenses} onChange={v => set('variableExpenses', v)} />

        </SimSettingsBlock>

        <SimSettingsBlock id="lmnp" title="LMNP & fiscalité">
          <SimSlider
            label="Loyer LMNP meublé visé"
            valueLabel={`${p.lmnpRent} €/m`}
            min={900}
            max={1800}
            step={50}
            value={p.lmnpRent}
            onChange={v => set('lmnpRent', v)}
          />

          <SimApplyEstimate
            buttonLabel={`Appliquer · ${fmt(estimateLmnpRent(p.surfaceM2))}/mois (${p.surfaceM2} m²)`}
            onApply={() => set('lmnpRent', estimateLmnpRent(p.surfaceM2))}
            infoLabel="Estimation loyer meublé Paris"
            infoChildren={(
              <>
                Ordre de grandeur : ~{estimateLmnpRentPerM2()} €/m² × {p.surfaceM2} m². Location meublée
                longue durée à Paris, hors charges récupérables. Variable selon arrondissement et finitions.
              </>
            )}
          />

          <SimSlider
            label="Taxe foncière annuelle"
            valueLabel={fmt(p.propertyTax)}
            min={300}
            max={2000}
            step={50}
            value={p.propertyTax}
            onChange={v => set('propertyTax', v)}
          />

          <SimApplyEstimate
            buttonLabel={`Appliquer · ${fmt(estimatePropertyTax(p.surfaceM2))}/an (${p.surfaceM2} m²)`}
            onApply={() => set('propertyTax', estimatePropertyTax(p.surfaceM2))}
            infoLabel="Calcul taxe foncière"
            infoChildren={(
              <>
                (VLC × 50 % d&apos;abattement) × 20,5 % (Paris) + taxes annexes (TEOM, etc.).
                VLC indicative : ~130 €/m²/an ; le montant réel est sur l&apos;avis de taxe foncière.
              </>
            )}
          />

          <SimSlider
            label="Revalorisation taxe foncière"
            valueLabel={pct(p.propertyTaxGrowth * 100)}
            min={0}
            max={10}
            step={0.5}
            value={p.propertyTaxGrowth * 100}
            onChange={v => set('propertyTaxGrowth', v / 100)}
            info="Souvent plus rapide que l’inflation générale (+3 à 7 %/an ces dernières années)."
          />

          <SimSlider
            label="CFE annuelle (LMNP)"
            valueLabel={fmt(p.cfeAnnual)}
            min={0}
            max={800}
            step={25}
            value={p.cfeAnnual}
            onChange={v => set('cfeAnnual', v)}
            info="Cotisation foncière des entreprises, due à partir de la 2ᵉ année d’activité LMNP."
          />

          <SimSlider
            label="Appréciation immobilière"
            valueLabel={pct(p.propertyAppreciation * 100)}
            min={-3}
            max={6}
            step={0.1}
            value={p.propertyAppreciation * 100}
            onChange={v => set('propertyAppreciation', v / 100)}
            info="Variation annuelle de la valeur de marché du bien, distincte de l’inflation (charges, TF, dépenses courantes)."
          />

          <div className="sim-control mb-3 flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-0.5">
              <span className="text-sm text-muted leading-snug">Valoriser le bien net des frais de sortie</span>
              <SimInfoTip label="Valorisation LMNP nette de sortie">
                Si activé, le patrimoine LMNP compte le bien à −{pct(p.agencyFeeRate * 100)} (frais d&apos;agence),
                comme une revente mensuelle — comparaison prudente avec les scénarios liquides.
                Désactivé : valeur à 100 %, comme « Achat + Revente » avant vente.
              </SimInfoTip>
            </div>
            <SimSwitch
              className="shrink-0"
              checked={p.lmnpLiquidationAdjusted}
              onChange={v => set('lmnpLiquidationAdjusted', v)}
              aria-label="Valoriser le bien net des frais de sortie"
            />
          </div>
        </SimSettingsBlock>
      </div>
    </div>
  );
}
