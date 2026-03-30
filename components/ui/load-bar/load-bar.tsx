import React from "react";
import Image from "next/image";

interface Props {
  streak?: number | null;
  progress: number;
}

const LoadBar: React.FC<Props> = ({ streak = null, progress }) => {
  // small pulsing fire icon when streak > 2
  const showFire = (streak ?? 0) > 2;

  // choose Tailwind background color based on progress
  let progressColor = "bg-gray-200";
  if (progress >= 100) progressColor = "bg-emerald-600";
  else if (progress >= 80) progressColor = "bg-emerald-300";
  else if (progress >= 50) progressColor = "bg-yellow-300";
  else if (progress >= 20) progressColor = "bg-orange-400";

  return (
    <div className="w-full flex flex-col items-start space-y-2">
      {/* Progress track */}
      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
        <div
          className={`${progressColor} h-full rounded-full transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Streak display */}
      {streak !== null && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="font-medium">Streak</span>
          <div className="flex items-center gap-2 px-2 py-1 bg-white rounded-md border border-gray-200">
            <span className="text-lg font-semibold">{streak}</span>
            {showFire && (
                <div className="w-5 h-5 relative">
                <Image src="/images/icons/fire.png" alt="fire" fill className="animate-pulse object-contain" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadBar;
