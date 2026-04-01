import React from "react";
import Image from "next/image";
const Fire = "/images/icons/fire.png";

export default function Streak() {
  const raw = typeof window !== "undefined" ? localStorage.getItem("streak") : null;
  const streak = raw ? parseInt(raw, 10) || 0 : 0;
  const day = streak === 1 ? "day" : "days";

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ background: "rgba(251,191,36,0.15)", border: "1.5px solid rgba(251,191,36,0.35)" }}
    >
      <div className="w-4 h-4 relative shrink-0">
        <Image src={Fire} alt="fire" fill className="object-contain animate-pulse" />
      </div>
      <span className="text-xs font-extrabold" style={{ color: "#b45309" }}>
        {streak} {day} streak!
      </span>
    </div>
  );
}
