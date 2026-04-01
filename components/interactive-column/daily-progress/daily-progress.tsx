"use client";

import React, { useEffect, useState } from "react";
import LoadBar from "../../ui/load-bar/load-bar";
import Doty from "../../ui/doty/doty";
//import { getDailyProgressService } from "../../../../services/progress.service";

export default function DailyProgress() {
  const [progress, setProgress] = useState<number>(0);

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
    <div className="w-full h-full flex flex-col items-center justify-center gap-5 p-6">
      {/* Header */}
      <div className="flex items-center gap-2 self-start">
        <span className="inline-block w-1 h-5 rounded-full bg-(--accent)" />
        <span className="text-xs font-bold uppercase tracking-widest text-(--muted)">My progress today</span>
      </div>

      {/* Doty + message */}
      <div className="flex items-center gap-3">
        <Doty pose={pose} size="mini" />
        <div className="flex flex-col gap-0.5">
          <span className="text-3xl font-extrabold text-foreground">{progress}%</span>
          <span className="text-sm font-semibold text-(--muted)">{message}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <LoadBar progress={progress} />
      </div>

      {/* Motivational chips */}
      <div className="flex gap-2 flex-wrap justify-center">
        {[
          { label: "Keep going 🚀", active: progress > 0 && progress < 50 },
          { label: "Halfway 🌟",    active: progress >= 50 && progress < 100 },
          { label: "Done! 🎉",      active: progress >= 100 },
        ].map((chip) => chip.active && (
          <span
            key={chip.label}
            className="rounded-full px-3 py-1 text-xs font-extrabold"
            style={{ background: "rgba(212,0,126,0.12)", color: "#d4007e", border: "1.5px solid rgba(212,0,126,0.25)" }}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
