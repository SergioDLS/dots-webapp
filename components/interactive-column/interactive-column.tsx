"use client";

import React, { useEffect, useState, useRef } from "react";
import Image from "next/image";

import Streak from "./streak/streak";
import Doty from "../ui/doty/doty";
import Dialog from "../ui/dialog/dialog";
// lightweight icons: using emoji/SVG to avoid MUI dependency
const IconSchool = () => <span className="text-2xl">🎓</span>;
const IconVideo = () => <span className="text-2xl">🎬</span>;
const IconBook = () => <span className="text-2xl">📚</span>;
const IconTrophy = () => <span className="text-2xl">🏆</span>;
const IconFire = () => <span className="text-2xl">🔥</span>;
const IconGame = () => <span className="text-2xl">🎮</span>;
const IconEdit = () => <span className="text-xl">✏️</span>;

import DailyProgress from "./daily-progress/daily-progress";
import StreakTop from "./streak/streak-top";
import TopStudents from "./top-students";
import ReadingsList from "./readings-list";
import GamesList from "./games-list";
//import { updateProfilePictureService } from "../../services/user.service";
import { ADMIN_PROFILE, BASE_URL_IMAGES } from "../../constants";

type User = {
  id?: number;
  name?: string;
  profile?: number;
  profile_pic?: string | null;
  [k: string]: unknown;
};

  const getUserFromStorage = () => {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
};

type DialogState = {
  show: boolean;
  text?: string;
  type?: string;
  accept?: () => void;
  cancel?: () => void;
  accept_text?: string;
  cancel_text?: string;
};

export default function InteractiveColumn() {
  const [hover, setHover] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => {
    const u = getUserFromStorage();
    return u?.profile_pic ? BASE_URL_IMAGES + "/users/" + u.profile_pic : null;
  });
  const [hoverPhoto, setHoverPhoto] = useState(false);
  const [userHover, setUserHover] = useState(false);
  const [userSettingsHover, setUserSettingsHover] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ show: false });
  const [isMobile, setIsMobile] = useState(false);
  const [user, setUser] = useState<User>(() => getUserFromStorage() as User);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);

  const menus = [
    { title: "My progress", icon: <IconSchool /> },
    { title: "Audio books", icon: <IconVideo /> },
    { title: "Readings", icon: <IconBook /> },
    { title: "Top students", icon: <IconTrophy /> },
    { title: "Top streaks", icon: <IconFire /> },
    { title: "Games", icon: <IconGame /> },
  ];

  

  // matchMedia for responsive JS logic (md breakpoint ~768px)
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    type LegacyMQL = { addListener?: (cb: (e: MediaQueryListEvent) => void) => void; removeListener?: (cb: (e: MediaQueryListEvent) => void) => void };
  const update = () => setIsMobile(!!mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update as EventListener);
    else (mq as LegacyMQL).addListener?.(update);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update as EventListener);
      else (mq as LegacyMQL).removeListener?.(update);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!hover) {
        setCurrentSection((s) => (s >= menus.length - 1 ? 0 : s + 1));
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [hover, menus.length]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAdminMenu(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // keyboard navigation for accessibility (left/right arrows)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setCurrentSection((s) => Math.min(s + 1, menus.length - 1));
      if (e.key === "ArrowLeft") setCurrentSection((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menus.length]);

  // touch handlers for swipe on mobile
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const onTouchStart = (ev: TouchEvent) => {
      touchStartX.current = ev.touches[0].clientX;
      touchDeltaX.current = 0;
    };

    const onTouchMove = (ev: TouchEvent) => {
      if (touchStartX.current == null) return;
      const x = ev.touches[0].clientX;
      touchDeltaX.current = x - touchStartX.current;
    };

    const onTouchEnd = () => {
      if (touchStartX.current == null) return;
      const delta = touchDeltaX.current;
      const threshold = 40; // pixels
      if (delta > threshold) setCurrentSection((s) => Math.max(s - 1, 0));
      else if (delta < -threshold) setCurrentSection((s) => Math.min(s + 1, menus.length - 1));
      touchStartX.current = null;
      touchDeltaX.current = 0;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart as EventListener);
      el.removeEventListener("touchmove", onTouchMove as EventListener);
      el.removeEventListener("touchend", onTouchEnd as EventListener);
    };
  }, [menus.length]);

  const closeDialogHandler = () => {
    setDialog({ show: false });
  };


  const logOutHandler = () => {
    setDialog({
      text: "Are you sure you want to log out?",
      type: "warning",
      accept: () => {
        localStorage.removeItem("user");
        window.location.replace("/login");
      },
      accept_text: "yes!",
      cancel_text: "nope!",
      show: true,
      cancel: closeDialogHandler,
    });
  };

  const setProfilePhotoHandler = (file: File) => {
    if ((user?.id ?? 0) > 0) {
      const url = URL.createObjectURL(file);
      setProfilePhoto(url);
      //updateProfilePictureService(user.id as number, file);
      const newUser = { ...user, profile_pic: `${String(user.id)}.${file.name.split(".")[1]}` } as User;
      setUser(newUser);
      localStorage.setItem("user", JSON.stringify(newUser));
    }
  };

  // position/marginPosition were used by the old translate calculation.
  // Keep them for potential future tuning, but avoid unused var lint by deriving them from currentSection when needed.
  // carousel positioning now uses percentage-based translateX(-N*100%)

  const comingSoon = (
    <div className="flex w-full items-center justify-center flex-col gap-4 rounded-2xl bg-(--surface) border border-(--border) p-8">
      <Doty pose="03" size="small" />
      <h3 className="text-base font-semibold text-foreground">Coming soon…</h3>
      <p className="text-xs text-(--muted) text-center">We&apos;re working on something cool!</p>
    </div>
  );

  

  return (
    <div
      className={`interactive-column w-full ${isMobile ? "h-auto" : "h-screen"} relative overflow-auto`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Interactive column"
    >
      <div className={`p-4 w-full md:w-80 ${isMobile ? "relative" : ""} md:sticky md:top-8`}>
        <div className="flex flex-col gap-5">

          {/* ── Profile card ─────────────────────────────────── */}
          <div
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background: "linear-gradient(155deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.12) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1.5px solid rgba(255,255,255,0.18)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.26)",
            }}
          >
            {/* Top sheen */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-2xl"
              style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.16) 0%, transparent 100%)" }}
            />
            <div className={`flex ${isMobile ? "flex-row items-center" : "flex-col items-center"} gap-4`}>

              {/* Avatar */}
              <div className="relative w-20 h-20 md:w-24 md:h-24 shrink-0">
                <div
                  className={`absolute inset-0 z-20 flex items-center justify-center rounded-full transition-all duration-200 ${hoverPhoto ? "bg-black/50" : "bg-transparent"}`}
                  onMouseEnter={() => setHoverPhoto(true)}
                  onMouseLeave={() => setHoverPhoto(false)}
                >
                  <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center text-white rounded-full">
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = (e.target as HTMLInputElement).files?.[0];
                        if (f) setProfilePhotoHandler(f);
                      }}
                    />
                    {hoverPhoto && (
                      <div className="flex flex-col items-center gap-0.5">
                        <IconEdit />
                        <span className="text-[10px] font-semibold">Change</span>
                      </div>
                    )}
                  </label>
                </div>

                {profilePhoto ? (
                  <div className="relative w-full h-full rounded-full overflow-hidden ring-3 ring-(--accent)/40 shadow-md">
                    <Image src={profilePhoto} alt="profile" fill style={{ objectFit: "cover" }} />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center rounded-full bg-background ring-3 ring-(--border) p-2">
                    <Doty customClass={"animated tada"} pose="06" size="tiny" />
                  </div>
                )}
              </div>

              {/* Name + streak */}
              <div
                className="flex flex-col gap-1 min-w-0 flex-1"
                onMouseEnter={() => setUserHover(true)}
                onMouseLeave={() => setUserHover(false)}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-(--muted)">Welcome back</p>
                <h3 className="text-lg font-extrabold leading-tight truncate text-foreground">
                  {user?.name || "there"} 👋
                </h3>
                <div className="mt-1">
                  <Streak />
                </div>
              </div>
            </div>

            {/* Settings panel – slides in on hover */}
            <div
              className={`overflow-hidden transition-all duration-300 ${userHover || userSettingsHover ? "opacity-100 max-h-44 mt-3" : "opacity-0 max-h-0"}`}
              onMouseEnter={() => setUserSettingsHover(true)}
              onMouseLeave={() => setUserSettingsHover(false)}
            >
              <div className="flex flex-col gap-2 pt-3 border-t border-white/10">
                <button
                  onClick={logOutHandler}
                  className="w-full rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-(--muted) transition-all duration-200 hover:border-(--accent) hover:text-(--accent) hover:bg-(--accent)/5 focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  Log out
                </button>

                {user?.profile === ADMIN_PROFILE && (
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setShowAdminMenu((s) => !s)}
                      className="w-full rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-(--muted) transition-all duration-200 hover:border-(--accent) hover:text-(--accent) hover:bg-(--accent)/5 focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                      aria-expanded={showAdminMenu}
                      aria-haspopup="menu"
                    >
                      Admin ⚙️
                    </button>

                    {showAdminMenu && (
                      <ul
                        className="absolute right-0 z-30 mt-2 w-44 rounded-2xl overflow-hidden"
                        style={{
                          background: "linear-gradient(155deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.15) 100%)",
                          backdropFilter: "blur(16px)",
                          WebkitBackdropFilter: "blur(16px)",
                          border: "1.5px solid rgba(255,255,255,0.22)",
                          boxShadow: "0 8px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.28)",
                        }}
                      >
                        {[
                          { label: "Levels", href: "/admin/levels" },
                          { label: "Readings", href: "/admin/readings" },
                          { label: "Users", href: "/admin/users" },
                        ].map((item) => (
                          <li key={item.href}>
                            <button
                              onClick={() => (window.location.href = item.href)}
                              className="block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-(--accent)/8 hover:text-(--accent) transition-colors"
                            >
                              {item.label}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Navigation tabs ───────────────────────────────── */}
          <div
            className="rounded-2xl p-2 relative overflow-hidden"
            style={{
              background: "linear-gradient(155deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.11) 100%)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1.5px solid rgba(255,255,255,0.18)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.24)",
            }}
          >
            <div className="grid grid-cols-3 gap-1.5">
              {menus.map((m, idx) => (
                <button
                  key={m.title}
                  onClick={() => setCurrentSection(idx)}
                  aria-pressed={currentSection === idx}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-(--accent)/30 ${
                    currentSection === idx
                      ? "bg-linear-to-br from-(--primary-accent) to-(--accent) text-white shadow-md shadow-(--accent)/25"
                      : "text-(--muted) hover:bg-(--accent)/8 hover:text-(--accent)"
                  }`}
                  style={currentSection !== idx ? { background: "rgba(255,255,255,0.05)" } : undefined}
                >
                  <span className="text-base leading-none">{m.icon}</span>
                  <span className="text-[10px] font-semibold leading-tight">{m.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Carousel ─────────────────────────────────────── */}
          <div
            className="w-full overflow-hidden rounded-2xl"
            style={{
              height: isMobile ? "40rem" : "28rem",
              background: "linear-gradient(155deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.10) 100%)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1.5px solid rgba(255,255,255,0.16)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.22)",
            }}
          >
            <div
              ref={carouselRef}
              className="flex h-full transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentSection * 100}%)`, willChange: "transform" }}
              role="region"
              aria-roledescription="carousel"
              aria-live="polite"
            >
              <div className="flex-none w-full h-full"><DailyProgress /></div>
              <div className="flex-none w-full h-full">{comingSoon}</div>
              <div className="flex-none w-full h-full"><ReadingsList /></div>
              <div className="flex-none w-full h-full"><TopStudents /></div>
              <div className="flex-none w-full h-full"><StreakTop /></div>
              <div className="flex-none w-full h-full"><GamesList /></div>
            </div>
          </div>

          {/* ── Slide indicators ─────────────────────────────── */}
          <div className="flex justify-center gap-1.5">
            {menus.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSection(idx)}
                aria-label={`Go to section ${idx + 1}`}
                className={`rounded-full transition-all duration-300 focus:outline-none ${
                  currentSection === idx
                    ? "w-5 h-2 bg-(--accent)"
                    : "w-2 h-2 bg-(--border) hover:bg-(--muted)"
                }`}
              />
            ))}
          </div>

        </div>
      </div>

      <Dialog
        show={Boolean(dialog.show)}
        text={(dialog as DialogState).text as string | undefined}
        accept={(dialog as DialogState).accept as (() => void) | undefined}
        cancel={(dialog as DialogState).cancel as (() => void) | undefined}
        accept_text={(dialog as DialogState).accept_text as string | undefined}
        cancel_text={(dialog as DialogState).cancel_text as string | undefined}
      />
    </div>
  );
}
