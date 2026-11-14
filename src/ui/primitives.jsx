import { Alert, Button, Tooltip } from '@heroui/react';

const toneValue = {
  pos: 'text-success',
  neg: 'text-danger',
  warn: 'text-warning',
  accent: 'text-accent',
};

/** Texte d’aide sous un paramètre (sidebar, portfolio…). */
export function SimHint({ children, className = '', tone }) {
  const toneClass =
    tone === 'warning' || tone === 'warn' ? 'text-warning'
    : tone === 'danger' ? 'text-danger'
    : 'text-muted';
  return (
    <p className={`sim-hint text-xs leading-relaxed text-muted mb-2 ${toneClass} ${className}`}>
      {children}
    </p>
  );
}

/** Bloc récap (budget, capacité bancaire, etc.). */
export function SimInfoCard({ title, children, className = '' }) {
  return (
    <section className={`my-2 rounded-lg border border-border bg-surface-secondary p-3 space-y-0.5 ${className}`}>
      {title && (
        <p className="mb-1.5 text-xs font-medium leading-snug text-accent-soft-foreground">
          {title}
        </p>
      )}
      {children}
    </section>
  );
}

/** Ligne libellé / valeur dans un SimInfoCard. */
export function SimStatRow({ label, value, tone }) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-0.5 text-sm">
      <span className="text-muted shrink min-w-0">{label}</span>
      <span
        className={`font-semibold tabular-nums whitespace-nowrap ${tone ? toneValue[tone] ?? '' : 'text-foreground'}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Libellé au-dessus d’un SimSeg ou groupe de champs. */
export function SimFieldLabel({ label, value, info, infoLabel }) {
  return (
    <div className="sim-control-header mb-0.5 flex min-w-0 items-center justify-between gap-2 text-sm text-muted">
      <div className="flex min-h-6 min-w-0 flex-1 items-center gap-0.5">
        <span className="min-w-0 leading-snug">{label}</span>
        {info ? (
          <SimInfoTip label={infoLabel ?? label}>{info}</SimInfoTip>
        ) : (
          <span className="size-6 min-w-6 shrink-0" aria-hidden />
        )}
      </div>
      {value != null ? (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{value}</span>
      ) : null}
    </div>
  );
}

/** Pastille « i » — info au survol / focus. */
export function SimInfoTip({ label, children, className = '' }) {
  return (
    <Tooltip delay={200} closeDelay={100}>
      <Tooltip.Trigger>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          aria-label={label}
          className={`size-6 min-w-6 shrink-0 text-muted hover:text-foreground ${className}`}
        >
          <span
            className="inline-flex size-[1.125rem] items-center justify-center rounded-full border border-border bg-surface-secondary text-[0.6rem] font-bold leading-none"
            aria-hidden
          >
            i
          </span>
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-[min(17.5rem,calc(100vw-2rem))] p-2.5 text-xs leading-relaxed text-foreground">
        {children}
      </Tooltip.Content>
    </Tooltip>
  );
}

/** Bouton d’estimation + infobulle (évite les libellés qui dépassent). */
export function SimApplyEstimate({ buttonLabel, onApply, infoLabel, infoChildren }) {
  return (
    <div className="sim-estimate mb-3 flex min-w-0 items-center gap-1.5">
      <Button
        size="sm"
        variant="secondary"
        className="min-h-8 h-auto min-w-0 flex-1 max-w-full justify-start py-1.5 px-2.5 text-left text-xs leading-snug whitespace-normal"
        onPress={onApply}
      >
        {buttonLabel}
      </Button>
      <SimInfoTip label={infoLabel}>{infoChildren}</SimInfoTip>
    </div>
  );
}

export function SimAlert({ title, children, status = 'danger', className = '' }) {
  return (
    <Alert status={status} className={`mb-3 ${className}`}>
      <Alert.Content>
        {title && <Alert.Title>{title}</Alert.Title>}
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
