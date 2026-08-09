"use client";

import Image from "next/image";

import type { Game } from "@/services/games.service";

/**
 * Vista pura del arcade: recibe la lista ya cargada y la reparte en tres
 * bloques (hoy / arcade / por desbloquear). Sin fetch, para que se pueda
 * renderizar con datos de prueba.
 */

const Bomb = "/images/DotBombs/bomb.png";
const Balloon = "/images/PopIt/balloon.png";

/**
 * Identidad visual por juego: glifo + tono. El tono siempre sale de un token
 * del sistema, así que sigue al tema claro/oscuro solo, y hace que la
 * cuadrícula se pueda barrer de un vistazo en vez de ser 14 cuadros iguales.
 */
type Skin = { img?: string; emoji?: string; hue: string };

const SKIN: Record<string, Skin> = {
  "/wordle": { emoji: "🟩", hue: "--success" },
  "/crossword": { emoji: "✏️", hue: "--primary" },
  "/flashcards": { emoji: "🎴", hue: "--accent" },
  "/speed-round": { emoji: "⚡", hue: "--gold" },
  "/dot-match": { emoji: "🔗", hue: "--gem" },
  "/true-false": { emoji: "🃏", hue: "--accent" },
  "/memory": { emoji: "🧠", hue: "--primary" },
  "/audio-blitz": { emoji: "🎧", hue: "--gem" },
  "/word-tower": { emoji: "🗼", hue: "--gold" },
  "/sentence-builder": { emoji: "🧱", hue: "--flame" },
  "/ghost-race": { emoji: "👻", hue: "--primary" },
  "/dotaxi": { emoji: "🚕", hue: "--gold" },
  "/dont-pop": { img: Balloon, hue: "--accent" },
  "/dot-bombs": { img: Bomb, hue: "--flame" },
};

const FALLBACK: Skin = { emoji: "🎮", hue: "--accent" };

const skinFor = (path: string): Skin => SKIN[path] ?? FALLBACK;

/** Juegos de un puzzle al día: el backend los sirve con estado diario. */
const DAILY = new Set(["/wordle", "/crossword"]);

/** Mezcla el tono del juego con un token base para que funcione en ambos temas. */
const tint = (hue: string, pct: number, base: string) =>
  `color-mix(in srgb, var(${hue}) ${pct}%, var(${base}))`;

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)";

// El token de acceso vive en memoria y esta lista siempre ha navegado con
// window.location (excepción legacy documentada en CLAUDE.md): la mantenemos
// para no cambiar cómo arrancan los 14 juegos.
const go = (path: string) => window.location.assign(`/games${path}`);

/**
 * Tamaños de glifo por bloque. Los emoji se miden en `font-size` y las PNG en
 * caja: un emoji ocupa ~1.2× su font-size de ancho, así que fijarle una caja
 * cuadrada lo recortaría.
 */
type GlyphSize = { img: string; emoji: string };

const GLYPH: Record<"daily" | "arcade" | "locked", GlyphSize> = {
  daily: { img: "h-8 w-8 sm:h-9 sm:w-9", emoji: "text-[30px] sm:text-[34px]" },
  arcade: { img: "h-7 w-7 sm:h-9 sm:w-9", emoji: "text-[26px] sm:text-[34px]" },
  locked: { img: "h-4 w-4 sm:h-5 sm:w-5", emoji: "text-[15px] sm:text-[17px]" },
};

function Glyph({
  skin,
  size,
  className = "",
}: {
  skin: Skin;
  size: GlyphSize;
  className?: string;
}) {
  const motion = "transition-transform duration-150 group-hover:scale-110";
  if (skin.img) {
    return (
      <Image
        src={skin.img}
        alt=""
        width={40}
        height={40}
        // Son dos iconos de ~2 KB dentro de la primera pantalla: diferirlos solo
        // provoca que aparezcan de golpe con la cuadrícula ya dibujada.
        loading="eager"
        className={`${size.img} ${className} ${motion} object-contain`}
      />
    );
  }
  return (
    // leading-[1.2] ≈ la altura real del glifo: con leading-none el emoji se
    // desborda de su caja y se come el espacio del nombre.
    <span
      aria-hidden
      className={`${size.emoji} ${className} ${motion} leading-[1.2]`}
    >
      {skin.emoji}
    </span>
  );
}

/** Bloque "Hoy": tarjeta ancha, un poco más entonada que las del arcade. */
function DailyTile({ game }: { game: Game }) {
  const skin = skinFor(game.path);
  return (
    <button
      type="button"
      onClick={() => go(game.path)}
      className={`dots-pressable group flex h-[70px] w-full items-center gap-3.5 rounded-2xl px-4 text-left sm:h-[84px] sm:gap-4 sm:px-5 ${FOCUS}`}
      style={
        {
          background: tint(skin.hue, 16, "--surface"),
          border: `2px solid ${tint(skin.hue, 42, "--border")}`,
          "--press-color": tint(skin.hue, 55, "--border"),
        } as React.CSSProperties
      }
    >
      <Glyph skin={skin} size={GLYPH.daily} className="shrink-0" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-display text-base font-extrabold text-foreground sm:text-lg">
          {game.name}
        </span>
        <span className="text-[11px] font-bold text-(--muted)">
          Nuevo cada día
        </span>
      </span>
    </button>
  );
}

/** Cuadro del arcade: glifo arriba, nombre abajo. */
function ArcadeTile({ game }: { game: Game }) {
  const skin = skinFor(game.path);
  return (
    <button
      type="button"
      onClick={() => go(game.path)}
      className={`dots-pressable group flex h-[92px] w-full flex-col items-center justify-center gap-1 rounded-2xl px-1.5 sm:h-[116px] sm:gap-1.5 sm:px-2 ${FOCUS}`}
      style={
        {
          background: tint(skin.hue, 14, "--surface"),
          border: `2px solid ${tint(skin.hue, 30, "--border")}`,
          "--press-color": tint(skin.hue, 45, "--border"),
        } as React.CSSProperties
      }
    >
      <Glyph skin={skin} size={GLYPH.arcade} />
      {/* leading-snug, no leading-tight: line-clamp recorta la caja y con una
          interlínea más apretada se comen los acentos y las colas. */}
      <span className="line-clamp-2 text-center font-display text-[11.5px] font-extrabold leading-snug text-foreground sm:text-sm">
        {game.name}
      </span>
    </button>
  );
}

/**
 * Juego aún cerrado: mismo lenguaje, pero plano. La ausencia del canto 3-D es
 * la señal de que no se puede pulsar — no hace falta deshabilitar un botón.
 */
function LockedRow({ game }: { game: Game }) {
  const skin = skinFor(game.path);
  return (
    <div className="flex h-[50px] items-center gap-2 rounded-xl border-2 border-(--border) bg-(--surface-2) px-2.5">
      <Glyph
        skin={skin}
        size={GLYPH.locked}
        className="shrink-0 opacity-45 grayscale"
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[12.5px] font-bold text-(--muted)">
          {game.name}
        </span>
        <span className="text-[10.5px] font-bold text-(--muted) opacity-75">
          {game.levelsLeft === 1
            ? "falta 1 nivel"
            : `faltan ${game.levelsLeft} niveles`}
        </span>
      </span>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-widest text-(--muted)">
      {children}
    </h2>
  );
}

export default function GamesGridView({ games }: { games: Game[] }) {
  const daily = games.filter((g) => g.unlocked && DAILY.has(g.path));
  const arcade = games.filter((g) => g.unlocked && !DAILY.has(g.path));
  const locked = games.filter((g) => !g.unlocked);

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {daily.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <Eyebrow>Hoy</Eyebrow>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {daily.map((game) => (
              <li key={game.id}>
                <DailyTile game={game} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {arcade.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <Eyebrow>Arcade</Eyebrow>
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {arcade.map((game) => (
              <li key={game.id}>
                <ArcadeTile game={game} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {locked.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <Eyebrow>Por desbloquear</Eyebrow>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4">
            {locked.map((game) => (
              <li key={game.id}>
                <LockedRow game={game} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
