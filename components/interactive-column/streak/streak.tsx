import React from "react";
import Image from "next/image";
const Fire = "/images/icons/fire.png";

export default function Streak() {
  const raw = typeof window !== "undefined" ? localStorage.getItem("streak") : null;
  const streak = raw ? parseInt(raw, 10) || 0 : 0;
  const day = streak === 1 ? "day" : "days";

  return (
    <div className="flex items-center gap-2">
      <div className="w-5 h-5 relative">
        <Image src={Fire} alt="fire" fill className="object-contain animate-pulse" />
      </div>
      <div className="text-sm font-medium text-gray-800">
        {streak} {day} streak!
      </div>
    </div>
  );
}
