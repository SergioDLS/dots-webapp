import type React from "react";

// ── Panel wrapper ────────────────────────────────────────────────────────────
export function PanelWrapper({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "relative w-full flex flex-col items-center gap-6 rounded-3xl p-6 overflow-hidden",
        className,
      ].join(" ")}
      style={{
        minHeight: "22rem",
        background: "var(--surface)",
        border: "2px solid var(--border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
        animation: "pc-pop 0.4s ease-out both",
      }}
    >
      {/* Decorative corner circles */}
      <div
        className="absolute -top-6 -right-6 w-20 h-20 rounded-full"
        style={{ background: "var(--accent)", opacity: 0.06 }}
      />
      <div
        className="absolute -bottom-4 -left-4 w-14 h-14 rounded-full"
        style={{ background: "var(--accent)", opacity: 0.04 }}
      />
      {children}
    </div>
  );
}

// ── Section label (e.g. "What do you hear?") ─────────────────────────────────
export function SectionLabel({ children, emoji }: { children: React.ReactNode; emoji?: string }) {
  return (
    <div className="flex items-center gap-2.5 self-start">
      {emoji && (
        <span
          className="text-xl leading-none"
          style={{ animation: "pc-wiggle 2s ease-in-out infinite" }}
        >
          {emoji}
        </span>
      )}
      <span
        className="inline-block w-1.5 h-5 rounded-full"
        style={{ background: "var(--accent)" }}
      />
      <span
        className="text-sm font-extrabold uppercase tracking-widest"
        style={{ color: "var(--muted)" }}
      >
        {children}
      </span>
    </div>
  );
}
