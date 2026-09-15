interface Props {
  sectionNumber: number;
}

/** Niebla antes de la primera sección no alcanzada (spec §3.2): degradado al fondo y pastilla "Próximamente". */
export default function UpcomingDivider({ sectionNumber }: Props) {
  return (
    <div
      role="separator"
      className="relative flex w-full items-center justify-center"
      style={{ height: 72, background: "linear-gradient(to bottom, transparent, var(--background) 60%)" }}
    >
      <span
        className="rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-widest"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--muted)" }}
      >
        Próximamente · Sección {sectionNumber}
      </span>
    </div>
  );
}
