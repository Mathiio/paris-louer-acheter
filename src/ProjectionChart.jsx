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
  { key: 'rent',     label: '1. Location seule',   color: COLORS.rent },
  { key: 'buySell',  label: '2. Achat + Revente',  color: COLORS.buySell },
  { key: 'lmnpKeep', label: '3. Achat + LMNP',      color: COLORS.lmnpKeep, thick: true },
];

export default function ProjectionChart({ result, theme }) {
  const { tooltip, external } = useChartExternalTooltip({ formatValue: fmt });

  if (!result) return null;

  const axis = chartAxisColors(theme);
  const labels = sample(result.labels);
  const idx    = (arr) => sample(arr);

  const data = {
    labels,
    datasets: [
      { label: '1. Location seule', data: idx(result.series.rent),    borderColor: COLORS.rent,    backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 0 },
      { label: '2. Achat + Revente', data: idx(result.series.buySell), borderColor: COLORS.buySell, backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 0 },
      { label: '3. Achat + LMNP',    data: idx(result.series.lmnpKeep),borderColor: COLORS.lmnpKeep,backgroundColor: 'transparent', borderWidth: 3, tension: 0.3, pointRadius: 0 },
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
      <ChartLegend items={LEGEND_ITEMS} />
      <div className="relative min-h-[240px] flex-1">
        <ChartHoverTooltip state={tooltip} />
        <Line data={data} options={options} />
      </div>
      <p className="mt-3 shrink-0 text-center text-xs leading-relaxed text-muted">
        Valeur nette = Épargne + Valeur du bien - Dettes.
        {result.meta?.crossovers?.lmnpKeep != null && (
          <> L&apos;achat (LMNP) dépasse la location à partir de{' '}
            <strong>{result.meta.crossovers.lmnpKeep.toFixed(1)} ans</strong>.</>
        )}
        {result.meta?.crossovers?.lmnpKeep == null && (
          <> Avec un rendement épargne élevé, la location peut rester devant longtemps.</>
        )}
      </p>
    </div>
  );
}
