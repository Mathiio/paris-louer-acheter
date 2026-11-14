import { useMemo, useState } from 'react';
import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fmt } from './utils.js';
import { sample, SCENARIO_LABELS, chartAxisColors } from './chartHelpers.js';
import ChartLegend from './ChartLegend.jsx';
import ChartHoverTooltip, { useChartExternalTooltip } from './ChartHoverTooltip.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const SCENARIOS = ['buySell', 'lmnpKeep'];

const DEBT_TOTAL_LABEL = 'Dette (banque + complément)';

const LEGEND_ITEMS = [
  { key: 'debt',   label: DEBT_TOTAL_LABEL, color: '#e2685f' },
  { key: 'prop',   label: 'Valeur du bien',           color: '#4fa8e0' },
  { key: 'sav',    label: 'Épargne investie',         color: '#35b587' },
  { key: 'net',    label: 'Patrimoine net',           color: '#6e7bf2', thick: true },
];

/** Décompose le patrimoine net d'un scénario d'achat en épargne, valeur du bien et dettes. */
export default function CompositionChart({ result, p, theme }) {
  const [scenario, setScenario] = useState('lmnpKeep');
  const scenarioKeys = useMemo(() => new Set([scenario]), [scenario]);
  const { tooltip, external } = useChartExternalTooltip({ formatValue: fmt });

  if (!result) return null;

  const axis = chartAxisColors(theme);

  // La valeur du bien affichée doit rester cohérente avec le patrimoine net (qui applique,
  // si activé, la décote "frais de sortie" uniquement au scénario LMNP).
  const discount = (scenario === 'lmnpKeep' && p?.lmnpLiquidationAdjusted) ? (1 - (p.agencyFeeRate ?? 0)) : 1;

  const details = result.details[scenario];
  const labels = sample(result.labels);
  const savings   = sample(details.map(d => d.savings));
  const propValue = sample(details.map(d => d.propertyValue * discount));
  const debtTotal = sample(details.map(d => -(d.debt + d.parentDebt)));
  const netWorth  = sample(details.map(d => d.netWorth));

  const data = {
    labels,
    datasets: [
      { label: DEBT_TOTAL_LABEL, data: debtTotal,  borderColor: '#e2685f', backgroundColor: 'rgba(226,104,95,.14)', fill: 'origin', borderWidth: 1.5, tension: 0.3, pointRadius: 0 },
      { label: 'Valeur du bien',           data: propValue,  borderColor: '#4fa8e0', backgroundColor: 'rgba(79,168,224,.12)', fill: 'origin', borderWidth: 1.5, tension: 0.3, pointRadius: 0 },
      { label: 'Épargne investie',         data: savings,    borderColor: '#35b587', backgroundColor: 'rgba(53,181,135,.16)', fill: 'origin', borderWidth: 1.5, tension: 0.3, pointRadius: 0 },
      { label: 'Patrimoine net',           data: netWorth,   borderColor: '#6e7bf2', backgroundColor: 'transparent',          fill: false,     borderWidth: 3,   tension: 0.3, pointRadius: 0 },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false, external },
    },
    scales: {
      x: { grid: { color: axis.grid }, ticks: { color: axis.tick, font: { size: 10 } } },
      y: {
        grid: { color: axis.grid },
        ticks: { color: axis.tick, font: { size: 10 }, callback: v => fmt(v) },
      },
    },
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-3">
        <ToggleButtonGroup
          selectionMode="single"
          selectedKeys={scenarioKeys}
          onSelectionChange={keys => {
            const k = [...keys][0];
            if (k && k !== scenario) setScenario(k);
          }}
          className="max-w-md"
          size="sm"
        >
          {SCENARIOS.map(key => (
            <ToggleButton key={key} id={key}>
              {SCENARIO_LABELS[key].replace(/^\d\.\s*/, '')}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <ChartLegend items={LEGEND_ITEMS} />
      </div>
      <div className="relative min-h-[240px] flex-1">
        <ChartHoverTooltip state={tooltip} />
        <Line data={data} options={options} />
      </div>
      <p className="mt-3 shrink-0 text-center text-xs leading-relaxed text-muted">
        Patrimoine net = Épargne + Valeur du bien − Dettes. La ligne violette (patrimoine net) est la
        somme des trois zones colorées.
      </p>
    </div>
  );
}
