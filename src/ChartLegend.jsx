/** Légende partagée des graphiques — un trait coloré par série plutôt que le carré Chart.js par défaut. */
export default function ChartLegend({ items }) {
  return (
    <div className="flex flex-wrap items-center gap-4 mb-3 text-xs">
      {items.map(item => (
        <span key={item.key} className="flex items-center gap-1.5 font-medium text-muted">
          <span
            className={
              item.dashed
                ? 'inline-block w-[18px] h-0 border-t-[1.5px] border-dashed border-muted shrink-0'
                : 'inline-block w-[18px] rounded-sm shrink-0'
            }
            style={item.dashed ? undefined : { background: item.color, height: item.thick ? 3 : 2 }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}
