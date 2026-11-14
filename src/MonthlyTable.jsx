import { useState } from 'react';
import { Button } from '@heroui/react';
import { fmt } from './utils.js';
import { SimSelect } from './ui/simControls.jsx';

const SCENARIOS = [
  { key: 'rent', label: '1. Location seule' },
  { key: 'buySell', label: '2. Achat + Revente' },
  { key: 'lmnpKeep', label: '3. Achat + LMNP' },
];

function cashTone(v) {
  if (v > 0) return 'text-success font-medium';
  if (v < 0) return 'text-danger font-medium';
  return '';
}

function roundExport(n) {
  return Math.round(Number(n) || 0);
}

function exportMonthlyCsv(result, scenario, departureYears) {
  const rows = result.details[scenario];
  const isLmnp = scenario === 'lmnpKeep';
  const isBuy = scenario !== 'rent';
  const depIdx = departureYears * 12;
  const scenarioLabel = SCENARIOS.find(s => s.key === scenario)?.label ?? scenario;

  const headers = [
    'Date',
    'Revenu net',
    'Logement',
    ...(isLmnp ? ['LMNP net'] : []),
    'Dépenses',
    ...(isBuy ? ['Remb. complément'] : []),
    'Investissable',
    'Intérêts placés',
    'Dette immo',
    'Patrimoine net',
  ];

  const lines = [headers.join(';')];
  rows.forEach((row, i) => {
    const lmnpNet = (row.lmnpRevenue || 0) - (row.lmnpOutflow || 0);
    const date = result.labels[i] + (i === depIdx ? ' (départ)' : '');
    const cells = [
      date,
      roundExport(row.income),
      roundExport(row.housing),
      ...(isLmnp ? [roundExport(lmnpNet)] : []),
      roundExport(row.expenses),
      ...(isBuy ? [roundExport(row.parentPaid)] : []),
      roundExport(row.cashFlow),
      roundExport(row.interest),
      row.debt > 0 ? roundExport(row.debt) : '',
      roundExport(row.netWorth),
    ];
    lines.push(cells.join(';'));
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = scenarioLabel.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flux-mensuels-${slug}-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MonthlyTable({ result, departureYears }) {
  const [scenario, setScenario] = useState('lmnpKeep');
  if (!result) return null;

  const rows = result.details[scenario];
  const depIdx = departureYears * 12;
  const isLmnp = scenario === 'lmnpKeep';
  const isBuy = scenario !== 'rent';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-[240px] flex-1 sm:max-w-xs">
          <SimSelect
            label="Scénario"
            value={scenario}
            onChange={setScenario}
            options={SCENARIOS.map(s => ({ value: s.key, label: s.label }))}
          />
        </div>
        <Button
          size="sm"
          variant="secondary"
          onPress={() => exportMonthlyCsv(result, scenario, departureYears)}
        >
          Exporter CSV
        </Button>
      </div>

      <p className="mb-2 shrink-0 text-xs text-muted">
        {rows.length} mois · le mois de départ est surligné
      </p>

      <div className="app-table-wrap min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 z-[5] bg-background/95 backdrop-blur-sm border-b border-border text-left text-xs font-semibold text-muted whitespace-nowrap">
              <th className="px-3 py-2.5">Date</th>
              <th className="px-3 py-2.5">Revenu net</th>
              <th className="px-3 py-2.5">Logement / Prêt</th>
              {isLmnp && <th className="px-3 py-2.5">LMNP net</th>}
              <th className="px-3 py-2.5">Dépenses</th>
              {isBuy && <th className="px-3 py-2.5">Remb. complément</th>}
              <th className="px-3 py-2.5">Investissable</th>
              <th className="px-3 py-2.5">Intérêts placés</th>
              <th className="px-3 py-2.5">Dette immo</th>
              <th className="px-3 py-2.5">Patrimoine net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isDep = i === depIdx;
              const lmnpNet = (row.lmnpRevenue || 0) - (row.lmnpOutflow || 0);
              return (
                <tr
                  key={i}
                  className={
                    isDep
                      ? 'bg-accent/10 border-y border-dashed border-accent'
                      : 'hover:bg-accent-soft/40 border-b border-border/60'
                  }
                >
                  <td className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">
                    {result.labels[i]}{isDep ? ' · départ' : ''}
                  </td>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{fmt(row.income)}</td>
                  <td className="px-3 py-2 text-danger font-medium tabular-nums whitespace-nowrap">−{fmt(row.housing)}</td>
                  {isLmnp && (
                    <td className={`px-3 py-2 tabular-nums whitespace-nowrap ${lmnpNet >= 0 ? 'text-success font-medium' : 'text-danger font-medium'}`}>
                      {lmnpNet >= 0 ? '+' : ''}{fmt(lmnpNet)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-danger font-medium tabular-nums whitespace-nowrap">−{fmt(row.expenses)}</td>
                  {isBuy && (
                    <td className={`px-3 py-2 tabular-nums whitespace-nowrap ${row.parentPaid > 0 ? 'text-danger font-medium' : ''}`}>
                      {row.parentPaid > 0 ? `−${fmt(row.parentPaid)}` : '—'}
                    </td>
                  )}
                  <td className={`px-3 py-2 tabular-nums whitespace-nowrap ${cashTone(row.cashFlow)}`}>
                    {row.cashFlow >= 0 ? '+' : ''}{fmt(row.cashFlow)}
                  </td>
                  <td className="px-3 py-2 text-success font-medium tabular-nums whitespace-nowrap">+{fmt(row.interest)}</td>
                  <td className={`px-3 py-2 tabular-nums whitespace-nowrap ${row.debt > 0 ? 'text-warning' : 'text-muted'}`}>
                    {row.debt > 0 ? fmt(row.debt) : '—'}
                  </td>
                  <td className="px-3 py-2 font-semibold text-success tabular-nums whitespace-nowrap">{fmt(row.netWorth)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
