// Downsample series to ~every N months for chart rendering performance,
// always keeping the first and last point.
export function sample(arr, every = 3) {
  return arr.filter((_, i) => i === 0 || (i + 1) % every === 0 || i === arr.length - 1);
}

export const SCENARIO_COLORS = {
  rent:     '#8d94a3',
  buySell:  '#4fa8e0',
  lmnpKeep: '#35b587',
};

/** Couleurs d'axes Chart.js (grille + ticks) adaptées au thème clair/sombre courant. */
export function chartAxisColors(theme) {
  return theme === 'light'
    ? { grid: 'rgba(15,23,42,.07)', tick: '#868c9c' }
    : { grid: 'rgba(255,255,255,.04)', tick: '#5b6170' };
}

export const SCENARIO_LABELS = {
  rent:     '1. Location seule',
  buySell:  '2. Achat + Revente',
  lmnpKeep: '3. Achat + LMNP',
};

/**
 * Tooltip Chart.js externe → état React (voir ChartHoverTooltip).
 *
 * @param {object} opts
 * @param {(raw: number, dataset) => string} [opts.formatValue]
 * @param {(label: string) => boolean} [opts.filterLabel]
 * @param {(state: object|null) => void} [opts.onUpdate]
 */
export function makeExternalTooltip({
  formatValue = (v) => v,
  filterLabel,
  onUpdate,
} = {}) {
  return (context) => {
    const { chart, tooltip } = context;

    if (!onUpdate) return;

    if (tooltip.opacity === 0) {
      onUpdate(null);
      return;
    }

    const points = (tooltip.dataPoints || []).filter(
      dp => !filterLabel || !filterLabel(dp.dataset.label),
    );
    if (points.length === 0) {
      onUpdate(null);
      return;
    }

    const title = tooltip.title?.[0] ?? '';
    const rows = points.map(dp => ({
      color: dp.dataset.borderColor,
      label: dp.dataset.label.replace(/^\d\.\s*/, ''),
      value: formatValue(dp.raw, dp.dataset),
    }));

    onUpdate({
      left: chart.canvas.offsetLeft + tooltip.caretX,
      top: chart.canvas.offsetTop + tooltip.caretY,
      xAlign: tooltip.xAlign || 'center',
      yAlign: tooltip.yAlign || 'center',
      title,
      rows,
    });
  };
}
