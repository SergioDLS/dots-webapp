import React, { useEffect, useState } from "react";
import Doty from "../../ui/doty/doty";
import Image from "next/image";
import { getRankingStreaksService } from "../../../../services/user.service";
import { BASE_URL_IMAGES } from "../../../constants";
const GoldCup = "/images/cups/gold_cup.png";
const SilverCup = "/images/cups/silver_cup.png";
const bronzeCup = "/images/cups/bronze_cup.png";
const Fire = "/images/icons/fire.png";

type Student = {
  id: number;
  name: string;
  last_name?: string;
  profile_pic?: string | null;
  streak?: number;
};

export default function StreakTop() {
  const [ranking, setRanking] = useState<Student[]>([]);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const getRankingStreaks = async () => {
      /*const response = await getRankingStreaksService();
      if (Array.isArray(response) && response.length > 0) {
        setRanking(response as Student[]);
      }
        */
    };
    getRankingStreaks();
  }, []);

  const cupWidthClass = isMobile ? "w-24 h-24" : "w-12 h-12";
  const photoSizeClass = isMobile ? "w-28 h-28" : "w-20 h-20";

  return (
    <div
      className="w-full h-full overflow-auto flex flex-col items-center gap-4 p-6 relative"
      style={{
        background: "linear-gradient(155deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.09) 100%)",
      }}
    >
      {/* Top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.12) 0%, transparent 100%)" }}
      />
      <div className="relative flex items-center gap-2">
        <div className="w-5 h-5 relative">
          <Image
            src={Fire}
            alt="fire"
            fill
            className="object-contain animate-pulse"
          />
        </div>
        <h3 className={`${isMobile ? "text-2xl" : "text-lg"} font-semibold text-foreground`}>
          Top {ranking.length} streaks!
        </h3>
      </div>

      <div className="relative w-full flex flex-col gap-3 overflow-auto">
        {ranking.map((item, index) => (
          <div key={item.id} className="flex items-center gap-3">
            <div className="shrink-0">
              {index === 0 && (
                <div className={`${cupWidthClass} relative`}>
                  <Image src={GoldCup} alt="gold" fill className="object-contain" />
                </div>
              )}
              {index === 1 && (
                <div className={`${cupWidthClass} relative`}>
                  <Image src={SilverCup} alt="silver" fill className="object-contain" />
                </div>
              )}
              {index === 2 && (
                <div className={`${cupWidthClass} relative`}>
                  <Image src={bronzeCup} alt="bronze" fill className="object-contain" />
                </div>
              )}
              {index > 2 && <div className="w-12" />}
            </div>

            <div className="text-base font-medium text-foreground">{index + 1}</div>

            {item.profile_pic ? (
              <div className={`${photoSizeClass} rounded-full overflow-hidden relative`}>
                <Image src={`${BASE_URL_IMAGES}/users/${item.profile_pic}`} alt={item.name} fill className="object-cover" />
              </div>
            ) : (
              <Doty size="mini" pose="03" />
            )}

            <div className="flex flex-col">
              <div className={`${isMobile ? "text-xl" : "text-base"} font-medium text-foreground`}>
                {item.name} {item.last_name ?? ""}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-5 h-5 relative">
                  <Image src={Fire} alt="fire" fill className="object-contain" />
                </div>
                <div className={`${isMobile ? "text-lg" : "text-base"} text-(--muted)`}>
                  {item.streak}
                  {item.streak && item.streak > 1 ? " days" : item.streak === 1 ? " day" : ""}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
