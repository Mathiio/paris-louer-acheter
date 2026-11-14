import { useMemo } from 'react';
import {
  Button,
  Label,
  ListBox,
  Select,
  Slider,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from '@heroui/react';
import { SimInfoTip } from './primitives.jsx';

/** Ligne libellé (+ ⓘ optionnel) + valeur, alignée au-dessus d’un slider / seg. */
export function SimControlHeader({ label, valueLabel, info, infoLabel }) {
  return (
    <div className="sim-control-header mb-0.5 flex min-w-0 items-center justify-between gap-2 text-sm text-muted">
      <div className="flex min-h-6 min-w-0 flex-1 items-center gap-0.5">
        <Label className="min-w-0 leading-snug text-muted">{label}</Label>
        {info ? (
          <SimInfoTip label={infoLabel ?? label}>{info}</SimInfoTip>
        ) : (
          <span className="size-6 min-w-6 shrink-0" aria-hidden />
        )}
      </div>
      {valueLabel != null ? (
        <span className="max-w-[45%] shrink-0 text-right text-sm font-semibold leading-snug text-foreground tabular-nums">
          {valueLabel}
        </span>
      ) : null}
    </div>
  );
}

/** Slider paramètre avec libellé + valeur affichée (sidebar). */
export function SimSlider({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  info,
  infoLabel,
}) {
  return (
    <div className="sim-control mb-3 w-full min-w-0">
      <SimControlHeader
        label={label}
        valueLabel={valueLabel}
        info={info}
        infoLabel={infoLabel}
      />
      <Slider
        aria-label={label}
        minValue={min}
        maxValue={max}
        step={step}
        value={value}
        onChange={v => onChange(Array.isArray(v) ? v[0] : v)}
        className="w-full"
      >
        <Slider.Track className="w-full">
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
    </div>
  );
}

/** Liste déroulante HeroUI (remplace les &lt;select&gt;). */
export function SimSelect({
  label,
  hideLabel = false,
  value,
  onChange,
  options,
  fullWidth = true,
  coerceNumber = false,
}) {
  const selectedKey = value == null ? null : String(value);

  const handleSelection = (key) => {
    if (key == null) return;
    const raw = String(key);
    onChange(coerceNumber ? Number(raw) : raw);
  };

  return (
    <Select
      className="sim-control mb-3 w-full"
      fullWidth={fullWidth}
      selectedKey={selectedKey}
      onSelectionChange={handleSelection}
      aria-label={label}
    >
      {label && !hideLabel ? <Label className="mb-0.5 block leading-snug text-muted">{label}</Label> : null}
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map(opt => (
            <ListBox.Item key={String(opt.value)} id={String(opt.value)} textValue={opt.label}>
              {opt.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Interrupteur HeroUI v3 (track + thumb obligatoires). */
export function SimSwitch({ checked, onChange, 'aria-label': ariaLabel, size = 'sm', className }) {
  return (
    <Switch
      size={size}
      className={className}
      isSelected={checked}
      onChange={onChange}
      aria-label={ariaLabel}
    >
      <Switch.Content aria-label={ariaLabel}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

export function SimSwitchRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <span className="text-sm text-muted">{label}</span>
      <SimSwitch checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}

/** Boutons segmentés (ex. Brut / Net, Cadre / Non-cadre). */
export function SimSeg({ options, value, onChange }) {
  const valueKey = String(value);
  const selected = useMemo(() => new Set([valueKey]), [valueKey]);

  return (
    <ToggleButtonGroup
      selectionMode="single"
      selectedKeys={selected}
      onSelectionChange={keys => {
        const key = [...keys][0];
        if (key != null && String(key) !== valueKey) onChange(key);
      }}
      className="sim-control mb-3 w-full"
      size="sm"
    >
      {options.map(opt => (
        <ToggleButton key={String(opt.value)} id={String(opt.value)} className="flex-1">
          {opt.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** Bloc de paramètres (page Paramètres, sans accordéon). */
export function SimSettingsBlock({ id, title, children, className = '' }) {
  return (
    <section
      id={`settings-${id}`}
      className={`sim-settings-block scroll-mt-2 rounded-xl border border-border bg-surface/60 p-4 sm:p-5 ${className}`}
    >
      <h3 className="sim-settings-heading mb-4 border-b border-border pb-2 text-sm font-semibold uppercase tracking-wide text-foreground">
        {title}
      </h3>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export { Button, Label, Switch };
