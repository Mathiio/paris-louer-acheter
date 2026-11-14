import { useCallback, useMemo, useRef, useState } from 'react';
import { makeExternalTooltip } from './chartHelpers.js';

function sameTooltip(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.left !== b.left
    || a.top !== b.top
    || a.title !== b.title
    || a.xAlign !== b.xAlign
    || a.yAlign !== b.yAlign
    || a.rows.length !== b.rows.length
  ) {
    return false;
  }
  return a.rows.every((row, i) => {
    const other = b.rows[i];
    return row.color === other.color && row.label === other.label && row.value === other.value;
  });
}

/**
 * Infobulle sobre au survol des courbes (tokens HeroUI overlay / border / shadow).
 */
export default function ChartHoverTooltip({ state }) {
  if (!state?.rows?.length) return null;

  const originX = { left: '0%', center: '-50%', right: '-100%' }[state.xAlign ?? 'center'];
  const originY = { top: '10px', center: 'calc(-100% - 10px)', bottom: '-4px' }[state.yAlign ?? 'center'];

  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-30 w-max max-w-[15rem] rounded-xl border border-border bg-overlay px-3 py-2.5 text-xs shadow-overlay"
      style={{
        left: state.left,
        top: state.top,
        transform: `translate(${originX}, ${originY})`,
      }}
    >
      {state.title ? (
        <p className="mb-2 border-b border-border pb-1.5 text-[0.68rem] font-medium text-muted">
          {state.title}
        </p>
      ) : null}
      <ul className="space-y-1">
        {state.rows.map(row => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-[3px] w-3 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
                aria-hidden
              />
              <span className="truncate text-muted">{row.label}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-foreground">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Branche le handler Chart.js external + état React pour ChartHoverTooltip. */
export function useChartExternalTooltip(options = {}) {
  const [state, setState] = useState(null);
  const stateRef = useRef(null);
  const { formatValue, filterLabel } = options;

  const onUpdate = useCallback((next) => {
    if (sameTooltip(stateRef.current, next)) return;
    stateRef.current = next;
    setState(next);
  }, []);

  const external = useMemo(
    () => makeExternalTooltip({ formatValue, filterLabel, onUpdate }),
    [formatValue, filterLabel, onUpdate],
  );

  return { tooltip: state, external };
}
