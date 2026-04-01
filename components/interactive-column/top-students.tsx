import React, { useState } from "react";
import Doty from "../ui/doty/doty";
import Image from "next/image";
//import { getRankingStudentsService } from "../../../services/progress.service";
import { BASE_URL_IMAGES } from "../../constants";
const GoldCup = "/images/cups/gold_cup.png";
const SilverCup = "/images/cups/silver_cup.png";
const bronzeCup = "/images/cups/bronze_cup.png";

type Student = {
  id: number;
  name: string;
  last_name?: string;
  profile_pic?: string | null;
};

const cupSrc = [GoldCup, SilverCup, bronzeCup];
const cupAlt = ["gold", "silver", "bronze"];

export default function TopStudents() {
  const [ranking] = useState<Student[]>([]);

  // data fetch (wired when service is ready)
  // useEffect(() => { ... }, []);

  return (
    <div className="w-full h-full overflow-auto flex flex-col gap-4 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <Doty pose="17" size="mini" />
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">
          Top students this week
        </span>
      </div>

      {/* List */}
      <div className="flex flex-col gap-2">
        {ranking.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200"
            style={{
              background: "var(--background)",
              border: "1.5px solid var(--border)",
            }}
          >
            {/* Rank medal or number */}
            <div className="shrink-0 w-10 flex items-center justify-center">
              {index < 3 ? (
                <div className="w-9 h-9 relative">
                  <Image src={cupSrc[index]} alt={cupAlt[index]} fill className="object-contain" />
                </div>
              ) : (
                <span className="text-sm font-bold text-(--muted)">{index + 1}</span>
              )}
            </div>

            {/* Avatar */}
            {item.profile_pic ? (
              <div className="w-9 h-9 rounded-full overflow-hidden relative shrink-0">
                <Image
                  src={`${BASE_URL_IMAGES}/users/${item.profile_pic}`}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="shrink-0">
                <Doty size="mini" pose="03" />
              </div>
            )}

            {/* Name */}
            <span className="text-sm font-semibold text-foreground truncate">
              {item.name} {item.last_name ?? ""}
            </span>
          </div>
        ))}

        {/* Empty state */}
        {ranking.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 opacity-50">
            <Doty pose="17" size="small" />
            <p className="text-sm text-(--muted) text-center">Rankings coming soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
