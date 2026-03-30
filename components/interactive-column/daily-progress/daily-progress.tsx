"use client";

import React, { useEffect, useState } from "react";
import LoadBar from "../../ui/load-bar/load-bar";
import Doty from "../../ui/doty/doty";
//import { getDailyProgressService } from "../../../../services/progress.service";

export default function DailyProgress() {
  const [progress, setProgress] = useState<number>(0);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // determine viewport size for responsive sizing (md breakpoint at 768px)
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const raw =
          typeof window !== "undefined" ? localStorage.getItem("user") : null;
        const user = raw ? JSON.parse(raw) : null;
        if (!user || !user.id) return;
        //const progress_res = await getDailyProgressService(user.id);
        //setProgress(progress_res?.progress ?? 0);
        setProgress(0);
      } catch {
        // swallow and keep default 0
      }
    };
    fetchProgress();
  }, []);

  const initial_pose = "11";
  let pose = initial_pose;
  let message = "Let's get this done!";

  if (progress === 100 && pose === initial_pose) {
    pose = "17";
    message = "Well done!";
  } else if (progress >= 80 && pose === initial_pose) {
    pose = "06";
    message = "Almost!";
  } else if (progress >= 50 && pose === initial_pose) {
    pose = "06";
    message = "Keep going!";
  }

  return (
    <div
      className="w-full h-full overflow-auto flex flex-col items-center p-6 relative"
      style={{
        background: "linear-gradient(155deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.09) 100%)",
      }}
    >
      {/* Top sheen */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.12) 0%, transparent 100%)" }}
      />
      <h3
        className={`relative font-semibold text-foreground ${isMobile ? "text-2xl" : "text-lg"}`}
      >
        My progress today
      </h3>
      <div
        className={`relative ${isMobile ? "text-2xl" : "text-lg"} text-(--muted) mt-2 mb-4`}
      >
        {progress}%
      </div>

      <div className="relative w-full mb-4">
        <LoadBar progress={progress} />
      </div>

      <div className="relative flex items-center gap-3">
        <Doty pose={pose} size={isMobile ? "tiny" : "mini"} />
        <div className={`${isMobile ? "text-xl" : "text-base"} text-foreground`}>
          {message}
        </div>
      </div>
    </div>
  );
}
