import { Button, Tooltip } from '@heroui/react';

const NAV_ICON = 'size-[1.375rem]';

function IconPortfolio() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={NAV_ICON} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

function IconTable() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={NAV_ICON} aria-hidden>
      <path d="M4 6h16M4 10h16M4 14h16M4 18h16" strokeLinecap="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={NAV_ICON} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconGap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={NAV_ICON} aria-hidden>
      <path d="M4 18h6M14 18h6M6 14l4-8M16 10l4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconComposition() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={NAV_ICON} aria-hidden>
      <path d="M12 3v18M12 12C12 7.5 16 4 20 4c0 4.5-3.5 8-8 8zM12 12C12 16.5 8 20 4 20c0-4.5 3.5-8 8-8z" strokeLinejoin="round" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={NAV_ICON} aria-hidden>
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavButton({ active, onPress, icon, children, className = '', collapsed }) {
  const label = typeof children === 'string' ? children : '';

  const button = (
    <Button
      variant="ghost"
      size="sm"
      className={`app-nav-btn ${active ? 'app-nav-btn--active' : ''} ${
        collapsed ? 'h-11 w-11 min-w-11 justify-center p-0' : 'h-11 w-full min-w-0 justify-start gap-3 px-2'
      } font-medium ${className}`}
      onPress={onPress}
    >
      {icon ? (
        <span
          className={`app-nav-icon-slot flex size-9 shrink-0 items-center justify-center ${
            active ? 'bg-accent-soft text-accent-soft-foreground' : 'text-muted'
          }`}
        >
          {icon}
        </span>
      ) : null}
      {!collapsed ? (
        <span className={`app-nav-label truncate text-left text-sm ${active ? 'text-foreground' : 'text-muted'}`}>
          {children}
        </span>
      ) : null}
    </Button>
  );

  if (!label) return button;

  return (
    <Tooltip delay={280} closeDelay={80}>
      <Tooltip.Trigger className="w-full">{button}</Tooltip.Trigger>
      <Tooltip.Content placement="right" offset={10} className="px-2.5 py-1.5 text-xs font-medium">
        {label}
      </Tooltip.Content>
    </Tooltip>
  );
}

/** Menu latéral principal */
export default function AppNav({ view, onChange, collapsed = false }) {
  return (
    <nav
      aria-label="Navigation principale"
      className="app-nav-rail flex min-h-0 w-full shrink-0 flex-row gap-2 overflow-x-auto pb-2 lg:w-full lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-1 lg:pt-0.5"
    >
      <NavButton
        active={view === 'settings'}
        icon={<IconSettings />}
        collapsed={collapsed}
        onPress={() => onChange('settings')}
      >
        Paramètres
      </NavButton>

      <NavButton
        active={view === 'portfolio'}
        icon={<IconPortfolio />}
        collapsed={collapsed}
        onPress={() => onChange('portfolio')}
      >
        Patrimoine
      </NavButton>

      <NavButton
        active={view === 'table'}
        icon={<IconTable />}
        collapsed={collapsed}
        onPress={() => onChange('table')}
      >
        Tableau mensuel
      </NavButton>

      <div className={`${collapsed ? 'hidden' : 'hidden lg:block'} my-2.5 border-t border-border`} aria-hidden />

      {!collapsed ? (
        <p className="hidden px-3 pb-1 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted lg:block">
          Graphiques
        </p>
      ) : null}

      <NavButton
        active={view === 'chart-projection'}
        icon={<IconChart />}
        collapsed={collapsed}
        onPress={() => onChange('chart-projection')}
        className={collapsed ? '' : 'lg:ps-3'}
      >
        Projection
      </NavButton>
      <NavButton
        active={view === 'chart-gap'}
        icon={<IconGap />}
        collapsed={collapsed}
        onPress={() => onChange('chart-gap')}
        className={collapsed ? '' : 'lg:ps-3'}
      >
        Vs location
      </NavButton>
      <NavButton
        active={view === 'chart-composition'}
        icon={<IconComposition />}
        collapsed={collapsed}
        onPress={() => onChange('chart-composition')}
        className={collapsed ? '' : 'lg:ps-3'}
      >
        Composition
      </NavButton>

    </nav>
  );
}
