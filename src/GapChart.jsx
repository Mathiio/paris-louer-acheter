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

const REF_LABEL = 'Référence : rester locataire (0 €)';
const LABEL_BUY_SELL = 'Achat + Revente − location';
const LABEL_LMNP = 'Achat + LMNP − location';

const LEGEND_ITEMS = [
  { key: 'buySell', label: LABEL_BUY_SELL, color: COLORS.buySell },
  { key: 'lmnpKeep', label: LABEL_LMNP, color: COLORS.lmnpKeep, thick: true },
  { key: 'seuil', label: REF_LABEL, dashed: true },
];

const isThreshold = (label) => label === REF_LABEL;

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
      {
        label: REF_LABEL,
        data: sample(rent.map(() => 0)),
        borderColor: axis.tick,
        borderDash: [4, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      },
      {
        label: LABEL_BUY_SELL,
        data: sample(gap(buySell)),
        borderColor: COLORS.buySell,
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: LABEL_LMNP,
        data: sample(gap(lmnpKeep)),
        borderColor: COLORS.lmnpKeep,
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 0,
      },
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
        ticks: { color: axis.tick, font: { size: 10 }, callback: v => formatGap(v) },
        title: {
          display: true,
          text: 'Écart de patrimoine net (€)',
          color: axis.tick,
          font: { size: 10, weight: '500' },
        },
      },
    },
  };

  const { crossovers } = result.meta ?? {};
  const lastIdx = buySell.length - 1;
  const endGapBuySell = gap(buySell)[lastIdx];
  const endGapLmnp = gap(lmnpKeep)[lastIdx];
  const horizonLabel = result.labels[lastIdx] ?? '';

  const crossoverRows = [
    { key: 'buySell', label: 'Achat + Revente' },
    { key: 'lmnpKeep', label: 'Achat + LMNP' },
  ].filter(r => crossovers?.[r.key] != null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChartLegend items={LEGEND_ITEMS} />
      <div className="relative min-h-[240px] flex-1">
        <ChartHoverTooltip state={tooltip} />
        <Line data={data} options={options} />
      </div>
      <div className="mt-3 shrink-0 space-y-1.5 text-center text-xs leading-relaxed text-muted">
        <p>
          À l&apos;horizon ({horizonLabel}) : Achat + Revente{' '}
          <strong className="text-foreground tabular-nums">{formatGap(endGapBuySell)}</strong>
          {' · '}Achat + LMNP{' '}
          <strong className="text-foreground tabular-nums">{formatGap(endGapLmnp)}</strong>
          {' '}vs location.
        </p>
        <p>
          {crossoverRows.length > 0 ? (
            <>
              Première année où la courbe passe au-dessus de 0 :{' '}
              {crossoverRows.map((r, i) => (
                <span key={r.key}>
                  {i > 0 && ' · '}
                  <strong>{r.label}</strong> vers {crossovers[r.key].toFixed(1)} ans
                </span>
              ))}
              .
            </>
          ) : (
            <>
              Sur l&apos;horizon simulé, aucun scénario d&apos;achat ne repasse au-dessus de la
              location (courbes toujours sous 0 €).
            </>
          )}
        </p>
      </div>
    </div>
  );
}
