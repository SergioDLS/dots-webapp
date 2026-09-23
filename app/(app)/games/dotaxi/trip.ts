// app/(app)/games/dotaxi/trip.ts
// El viaje de Dotaxi: quién sube al taxi, adónde va y qué dice. Puro, sin
// React ni DOM — portable a RN tal cual (como lanes.ts).
//
// Cada pasajero tiene SU destino: da personalidad sin multiplicar arte, y el
// jugador aprende que Gus siempre va al puerto. Los tres son los personajes
// con nombre propio de la tienda (avatares `fem`, `marinero`, `cientifica`).

export type Rng = () => number; // [0,1)

export type DestinationKey = "puerto" | "laboratorio" | "estadio";

export interface Trip {
  key: "gus" | "diana" | "andrea";
  name: string;
  /** /images/avatars/<avatar>.png — arte que ya existe */
  avatar: "marinero" | "cientifica" | "fem";
  destination: {
    key: DestinationKey;
    /** con artículo, para frases: "el puerto" */
    label: string;
    /** lo que dice el letrero del edificio */
    sign: string;
  };
  /** el pasajero al subir */
  ask: string;
  /** tarjeta de la llegada: "¡Llegaste al puerto!" (la contracción no se
   *  puede derivar de `label` sin una regla que se rompería con "la playa") */
  arrive: string;
  /** resultado: llegó */
  arrived: string;
  /** resultado: el taxi se rompió */
  failed: string;
  /** resultado: el jugador salió a medio camino */
  midway: string;
  /** Lo que suelta desde el asiento de atrás según lo que pasa. Frases cortas:
   *  se leen en un bocadillo pequeño junto al taxi, en marcha. No comenta
   *  cada vez (ver REMARK_CHANCE_* en page.tsx) y no repite la última frase. */
  voice: {
    /** acierto (se elige una al azar) */
    cheer: readonly string[];
    /** bache */
    ouch: readonly string[];
    /** queda poco tiempo, una vez por ronda */
    hurry: string;
    /** al bajar en el destino */
    thanks: string;
    /** el taxi se rompió */
    groan: string;
  };
}

export const TRIPS: readonly Trip[] = [
  {
    key: "gus",
    name: "Gus",
    avatar: "marinero",
    destination: { key: "puerto", label: "el puerto", sign: "PUERTO" },
    arrive: "¡Llegaste al puerto!",
    ask: "¡Al puerto, Doty! Zarpo en diez minutos.",
    arrived: "Gus llegó al puerto justo a tiempo. ¡Propina!",
    failed: "Gus no llegó al puerto… el taxi no aguantó.",
    midway: "Gus se quedó a medio camino del puerto.",
    voice: {
      cheer: ["¡Viento en popa!", "¡Así se navega!", "¡Rumbo firme!", "¡Buen timón, Doty!", "¡Esto sí es navegar!", "¡Mar en calma!"],
      ouch: ["¡Uy, marejada!", "¡Mi gorra!", "¡Se me mueve el suelo!", "¡Hombre al agua!", "¡Ese bache era un iceberg!"],
      hurry: "¡Que zarpa el barco!",
      thanks: "¡Gracias, Doty! Nos vemos en el muelle.",
      groan: "Adiós barco… adiós mar…",
    },
  },
  {
    key: "diana",
    name: "Diana",
    avatar: "cientifica",
    destination: { key: "laboratorio", label: "el laboratorio", sign: "LAB" },
    arrive: "¡Llegaste al laboratorio!",
    ask: "¡Al laboratorio, Doty! Mi experimento no espera.",
    arrived: "Diana llegó al laboratorio. ¡Eureka y propina!",
    failed: "Diana no llegó al laboratorio… el taxi no aguantó.",
    midway: "Diana se quedó a medio camino del laboratorio.",
    voice: {
      cheer: ["¡Hipótesis confirmada!", "¡Exacto!", "¡Eureka!", "¡Qué precisión!", "¡Anotado en la bitácora!", "¡Ciencia pura!"],
      ouch: ["¡Mis probetas!", "¡Cuidado, Doty!", "¡Eso no estaba en el plan!", "¡Gravedad, siempre la gravedad!", "¡Se me cayó el microscopio!"],
      hurry: "¡El experimento no espera!",
      thanks: "¡Gracias, Doty! A la ciencia.",
      groan: "Mi experimento… arruinado.",
    },
  },
  {
    key: "andrea",
    name: "Andrea",
    avatar: "fem",
    destination: { key: "estadio", label: "el estadio", sign: "ESTADIO" },
    arrive: "¡Llegaste al estadio!",
    ask: "¡Al estadio, Doty! El partido empieza ya.",
    arrived: "Andrea llegó al estadio antes del pitido. ¡Propina!",
    failed: "Andrea no llegó al estadio… el taxi no aguantó.",
    midway: "Andrea se quedó a medio camino del estadio.",
    voice: {
      cheer: ["¡Golazo!", "¡Eso, Doty!", "¡Vamos que llegamos!", "¡Qué jugada!", "¡Así se conduce!", "¡Olé!"],
      ouch: ["¡Uy!", "¡Mi bandera!", "¡Casi me caigo!", "¡Tarjeta amarilla al bache!", "¡Eso fue falta!"],
      hurry: "¡Ya va a empezar!",
      thanks: "¡Gracias, Doty! Te guardo un asiento.",
      groan: "Me perdí el partido…",
    },
  },
];

/** Elige pasajero con el rng dado: con seed, los rivales llevan al mismo. */
export function pickTrip(rng: Rng): Trip {
  const i = Math.floor(rng() * TRIPS.length);
  return TRIPS[Math.max(0, Math.min(TRIPS.length - 1, i))];
}
