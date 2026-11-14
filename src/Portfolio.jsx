import { useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { chartAxisColors } from './chartHelpers.js';
import {
  Button,
  Input,
  Label,
  Modal,
  TextArea,
  useOverlayState,
} from '@heroui/react';
import {
  resolvePortfolio,
  newPortfolioItem,
  fmt,
  pct,
  weightedPortfolioYield,
  totalWealth,
} from './utils.js';
import { SimSwitch } from './ui/simControls.jsx';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, ChartTooltip);

const DONUT_COLORS = ['#6e7bf2', '#4fa8e0', '#35b587', '#d9a441', '#e2685f', '#a888e0', '#5b6170'];

const MODAL_ICON_TONE = {
  accent: 'bg-accent-soft text-accent-soft-foreground',
  danger: 'bg-danger-soft text-danger',
  warning: 'bg-warning-soft text-warning-soft-foreground',
};

function PortfolioModalHeader({ title, tone = 'accent', icon }) {
  return (
    <Modal.Header className="!flex-row items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 pr-1">
        <Modal.Icon
          className={`!size-7 rounded-2xl shrink-0 ${MODAL_ICON_TONE[tone] ?? MODAL_ICON_TONE.accent}`}
          aria-hidden
        >
          {icon}
        </Modal.Icon>
        <Modal.Heading className="text-base font-semibold leading-snug">{title}</Modal.Heading>
      </div>
      <Modal.CloseTrigger className="shrink-0 self-center" />
    </Modal.Header>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconInfo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconReset() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 21v-6h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AllocationDonut({ items, total, theme }) {
  const withShare = items.filter(i => i.amount > 0);
  if (withShare.length === 0) return null;

  const isLight = theme === 'light';
  const data = {
    labels: withShare.map(i => i.name),
    datasets: [{
      data: withShare.map(i => i.amount),
      backgroundColor: withShare.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]),
      borderColor: isLight ? '#ffffff' : '#14161f',
      borderWidth: 2,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: ctx => `${fmt(ctx.raw)} (${((ctx.raw / total) * 100).toFixed(1)}%)` },
      },
    },
  };

  return (
    <div className="relative mx-auto h-52 w-52 shrink-0 sm:h-56 sm:w-56">
      <Doughnut data={data} options={options} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-semibold tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  );
}

function PortfolioEditorModal({ state, draft, setDraft, onSave }) {
  if (!draft) return null;
  const set = patch => setDraft(prev => ({ ...prev, ...patch }));
  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="md">
          <Modal.Dialog>
            <PortfolioModalHeader
              title={draft.id ? 'Modifier le placement' : 'Nouveau placement'}
              tone="accent"
              icon={draft.id ? <IconPencil /> : <IconPlus />}
            />
            <Modal.Body className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Nom</Label>
                <Input
                  size="sm"
                  value={draft.name}
                  onChange={e => set({ name: e.target.value })}
                  placeholder="Ex. Livret A, assurance-vie…"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Montant</Label>
                  <Input
                    size="sm"
                    value={draft.amountStr}
                    onChange={e => set({ amountStr: e.target.value })}
                    placeholder="0"
                    endContent={<span className="text-xs text-muted">€</span>}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Taux net</Label>
                  <Input
                    size="sm"
                    value={draft.rateStr}
                    onChange={e => set({ rateStr: e.target.value })}
                    placeholder="0"
                    endContent={<span className="text-xs text-muted">%</span>}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Note</Label>
                <TextArea
                  size="sm"
                  rows={3}
                  value={draft.desc}
                  onChange={e => set({ desc: e.target.value })}
                  placeholder="Optionnel"
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label className="font-normal text-muted">Réserve apport</Label>
                <SimSwitch
                  checked={draft.reserveForApport}
                  onChange={v => set({ reserveForApport: v })}
                  aria-label="Réserve apport"
                />
              </div>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button size="sm" variant="tertiary" onPress={() => state.close()}>Annuler</Button>
              <Button size="sm" variant="primary" onPress={onSave}>Enregistrer</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

export function PortfolioResetModal({ state, onConfirm }) {
  const close = () => state.close();

  const confirm = () => {
    onConfirm();
    state.close();
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <PortfolioModalHeader
              title="Réinitialiser la simulation ?"
              tone="warning"
              icon={<IconReset />}
            />
            <Modal.Body>
              <p className="text-sm text-muted leading-relaxed">
                Tous les paramètres (barre latérale, patrimoine de départ, scénarios) repassent aux
                valeurs par défaut Paris. La sauvegarde locale est effacée. Cette action est irréversible.
              </p>
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button size="sm" variant="tertiary" onPress={close}>Annuler</Button>
              <Button size="sm" variant="danger" onPress={confirm}>Réinitialiser</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** Revenus annuels estimés (montant × taux) — complète le donut, sans recopier le tableau. */
function PortfolioIncomeChart({ items, theme }) {
  const rows = items
    .map(i => ({ ...i, annual: i.amount * i.rate }))
    .filter(i => i.amount > 0 && i.annual > 0)
    .sort((a, b) => b.annual - a.annual);
  if (rows.length === 0) return (
    <p className="flex h-52 items-center justify-center text-sm text-muted sm:h-60">
      Aucun revenu annuel estimé sur les placements renseignés.
    </p>
  );

  const axes = chartAxisColors(theme);
  const data = {
    labels: rows.map(i => i.name),
    datasets: [{
      data: rows.map(i => i.annual),
      backgroundColor: rows.map((_, i) => DONUT_COLORS[i % DONUT_COLORS.length]),
      borderRadius: 6,
      maxBarThickness: 28,
    }],
  };
  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => {
            const row = rows[ctx.dataIndex];
            return `${fmt(ctx.raw)}/an · taux ${pct(row.rate * 100)}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: axes.grid },
        ticks: { color: axes.tick, callback: v => fmt(v) },
      },
      y: {
        grid: { display: false },
        ticks: { color: axes.tick },
      },
    },
  };

  return (
    <div className="h-52 w-full sm:h-60">
      <Bar data={data} options={options} />
    </div>
  );
}

function PortfolioDeleteModal({ state, item, blocked, onConfirm, onDismiss }) {
  const close = () => {
    state.close();
    onDismiss();
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <PortfolioModalHeader
              title={blocked ? 'Impossible de supprimer' : 'Supprimer ce placement ?'}
              tone={blocked ? 'warning' : 'danger'}
              icon={blocked ? <IconInfo /> : <IconTrash />}
            />
            <Modal.Body>
              {blocked ? (
                <p className="text-sm text-muted leading-relaxed">
                  Gardez au moins une ligne dans le patrimoine de départ (même à 0&nbsp;€).
                  Modifiez-la ou remplacez son contenu plutôt que de tout effacer.
                </p>
              ) : item ? (
                <p className="text-sm text-muted leading-relaxed">
                  <span className="font-medium text-foreground">{item.name || 'Sans titre'}</span>
                  {' — '}
                  <span className="tabular-nums">{fmt(item.amount)}</span>
                  {' · '}
                  <span className="tabular-nums">{pct(item.rate * 100)}</span>
                  {' '}
                  sera retiré du patrimoine de départ. Cette action est irréversible.
                </p>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              {blocked ? (
                <Button size="sm" variant="primary" onPress={close}>Compris</Button>
              ) : (
                <>
                  <Button size="sm" variant="tertiary" onPress={close}>Annuler</Button>
                  <Button size="sm" variant="danger" onPress={onConfirm}>Supprimer</Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function emptyDraft() {
  return {
    id: null,
    name: '',
    amountStr: '',
    rateStr: '',
    desc: '',
    reserveForApport: false,
  };
}

function draftFromItem(item) {
  return {
    id: item.id,
    name: item.name,
    amountStr: item.amount.toLocaleString('fr-FR'),
    rateStr: (item.rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 }),
    desc: item.desc ?? '',
    reserveForApport: Boolean(item.reserveForApport),
  };
}

function parseDraft(draft) {
  const amount = parseInt(draft.amountStr.replace(/\s/g, '').replace(/\D/g, ''), 10);
  const rate = parseFloat(draft.rateStr.replace(',', '.'));
  return {
    name: draft.name.trim() || 'Sans titre',
    amount: Number.isFinite(amount) ? amount : 0,
    rate: Number.isFinite(rate) ? rate / 100 : 0,
    desc: draft.desc,
    reserveForApport: draft.reserveForApport,
  };
}

export default function Portfolio({ params, setPortfolio, theme }) {
  const editModal = useOverlayState();
  const deleteModal = useOverlayState();
  const [draft, setDraft] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);

  const items = resolvePortfolio(params);
  const total = totalWealth(params);
  const yieldPct = weightedPortfolioYield(params) * 100;

  const commit = next => setPortfolio(next.map(i => ({ ...i })));

  const openNew = () => {
    setDraft(emptyDraft());
    editModal.open();
  };

  const openEdit = item => {
    setDraft(draftFromItem(item));
    editModal.open();
  };

  const saveDraft = () => {
    if (!draft) return;
    const parsed = parseDraft(draft);
    let next;
    if (draft.id) {
      next = items.map(it => (it.id === draft.id ? { ...it, ...parsed } : it));
    } else {
      next = [...items, newPortfolioItem(parsed)];
    }
    if (parsed.reserveForApport) {
      const targetId = draft.id ?? next[next.length - 1].id;
      next = next.map(it => ({
        ...it,
        reserveForApport: it.id === targetId,
      }));
    }
    commit(next);
    editModal.close();
    setDraft(null);
  };

  const requestDelete = id => {
    if (items.length <= 1) {
      setPendingDelete(null);
      setDeleteBlocked(true);
      deleteModal.open();
      return;
    }
    const item = items.find(i => i.id === id) ?? null;
    setPendingDelete(item);
    setDeleteBlocked(false);
    deleteModal.open();
  };

  const confirmDelete = () => {
    if (!pendingDelete || deleteBlocked) return;
    commit(items.filter(item => item.id !== pendingDelete.id));
    deleteModal.close();
    setPendingDelete(null);
  };

  const clearDeleteModal = () => {
    setPendingDelete(null);
    setDeleteBlocked(false);
  };

  const sorted = [...items].sort((a, b) => b.amount - a.amount);

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 pb-2">
      <div className="flex justify-end">
        <Button size="sm" variant="primary" onPress={openNew}>Ajouter un placement</Button>
      </div>

      <div className="app-table-wrap w-full min-w-0 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted bg-surface-secondary">
              <th className="px-4 py-3 font-medium">Placement</th>
              <th className="px-4 py-3 font-medium text-right">Montant</th>
              <th className="px-4 py-3 font-medium text-right">Taux</th>
              <th className="px-4 py-3 font-medium text-right">Part</th>
              <th className="px-4 py-3 w-[1%]" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(item => {
              const share = total > 0 ? (item.amount / total) * 100 : 0;
              return (
                <tr
                  key={item.id}
                  className="border-b border-border/80 last:border-0 hover:bg-accent-soft/50 cursor-pointer"
                  onClick={() => openEdit(item)}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{item.name || 'Sans titre'}</p>
                    {item.desc ? (
                      <p className="text-xs text-muted mt-0.5 line-clamp-1">{item.desc}</p>
                    ) : null}
                    {item.reserveForApport ? (
                      <span className="text-[0.65rem] text-accent-soft-foreground font-medium">Réserve apport</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(item.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{pct(item.rate * 100)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted">
                    {share.toFixed(1)} %
                  </td>
                  <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="tertiary"
                      isIconOnly
                      aria-label="Supprimer"
                      onPress={() => requestDelete(item.id)}
                    >
                      ×
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-border bg-surface/60 p-4 sm:p-5">
        <p className="mb-4 text-sm font-semibold text-foreground">Synthèse du patrimoine</p>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
          <section className="flex min-w-0 flex-col items-center gap-3">
            <h3 className="w-full text-left text-xs font-medium uppercase tracking-wide text-muted">
              Répartition
            </h3>
            <AllocationDonut items={items} total={total} theme={theme} />
            <div className="w-full space-y-0.5 text-center text-sm text-muted">
              <p>
                Total{' '}
                <span className="font-semibold text-foreground tabular-nums">{fmt(total)}</span>
              </p>
              <p>
                Rendement pondéré{' '}
                <span className="font-semibold text-foreground tabular-nums">{pct(yieldPct)}</span>
              </p>
            </div>
          </section>
          <section className="flex min-w-0 flex-col gap-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
              Revenus annuels estimés
            </h3>
            <p className="text-xs leading-relaxed text-muted">
              Montant × taux net : poids de chaque ligne dans le rendement pondéré affiché à gauche.
            </p>
            <PortfolioIncomeChart items={items} theme={theme} />
          </section>
        </div>
      </section>

      <PortfolioEditorModal
        state={editModal}
        draft={draft}
        setDraft={setDraft}
        onSave={saveDraft}
      />

      <PortfolioDeleteModal
        state={deleteModal}
        item={pendingDelete}
        blocked={deleteBlocked}
        onConfirm={confirmDelete}
        onDismiss={clearDeleteModal}
      />

    </div>
  );
}
