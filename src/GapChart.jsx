import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fmt } from './utils.js';
import { sample, SCENARIO_COLORS as COLORS, chartAxisColors } from './chartHelpers.js';
import ChartLegend from './ChartLegend.jsx';
import ChartHoverTooltip, { useChartExternalTooltip } from './ChartHoverTooltip.jsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

const LEGEND_ITEMS = [
  { key: 'buySell',  label: '2. Achat + Revente', color: COLORS.buySell },
  { key: 'lmnpKeep', label: '3. Achat + LMNP',     color: COLORS.lmnpKeep, thick: true },
  { key: 'seuil',    label: 'Seuil (location)',    dashed: true },
];

const isThreshold = (label) => label === 'Seuil (location)';

const formatGap = (v) => `${v >= 0 ? '+' : ''}${fmt(v)}`;

/** Écart de patrimoine net de chaque scénario d'achat par rapport à la location seule. */
export default function GapChart({ result, theme }) {
  const { tooltip, external } = useChartExternalTooltip({
    formatValue: formatGap,
    filterLabel: isThreshold,
  });

  if (!result) return null;

  const axis = chartAxisColors(theme);
  const { rent, buySell, lmnpKeep } = result.series;
  const gap = (series) => series.map((v, i) => v - rent[i]);

  const labels = sample(result.labels);
  const data = {
    labels,
    datasets: [
      { label: 'Seuil (location)', data: sample(rent.map(() => 0)), borderColor: axis.tick, borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0, fill: false },
      { label: '2. Achat + Revente', data: sample(gap(buySell)), borderColor: COLORS.buySell, backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 0 },
      { label: '3. Achat + LMNP',    data: sample(gap(lmnpKeep)),borderColor: COLORS.lmnpKeep,backgroundColor: 'transparent', borderWidth: 3, tension: 0.3, pointRadius: 0 },
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

  const { crossovers } = result.meta ?? {};
  const rows = [
    { key: 'buySell',  label: 'Achat + Revente' },
    { key: 'lmnpKeep', label: 'Achat + LMNP' },
  ].filter(r => crossovers?.[r.key] != null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChartLegend items={LEGEND_ITEMS} />
      <div className="relative min-h-[240px] flex-1">
        <ChartHoverTooltip state={tooltip} />
        <Line data={data} options={options} />
      </div>
      <p className="mt-3 shrink-0 text-center text-xs leading-relaxed text-muted">
        {rows.length > 0 ? (
          <>Point de bascule : {rows.map((r, i) => (
            <span key={r.key}>{i > 0 && ' · '}<strong>{r.label}</strong> à {crossovers[r.key].toFixed(1)} ans</span>
          ))}.</>
        ) : (
          'Avec les paramètres actuels, aucun scénario d\'achat ne dépasse la location sur l\'horizon simulé.'
        )}
      </p>
    </div>
  );
}
