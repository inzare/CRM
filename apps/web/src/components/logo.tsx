export function Logo({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3" aria-label="ConsultFlow CRM">
      <span
        className="grid size-10 place-items-center rounded-xl bg-teal-500 text-sm font-black text-white shadow-lg shadow-teal-900/20"
        aria-hidden="true"
      >
        CF
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[0.72rem] font-bold uppercase tracking-[0.22em] text-teal-600">
            ConsultFlow
          </span>
          <span className="block text-lg font-extrabold tracking-tight text-ink-950">CRM</span>
        </span>
      )}
    </div>
  );
}
