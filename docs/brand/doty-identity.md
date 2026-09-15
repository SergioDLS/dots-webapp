# DOTY — Identidad de marca

Doty es la mascota de **DOTS Academia de Idiomas**: el compañero de aprendizaje
que acompaña y celebra. **Doty motiva y celebra — nunca regaña**: hasta los
estados de error se leen amigables ("¡Oh no!", "¡Ups!", "¡Casi!"). Esa es la
regla que decide cualquier duda de tono.

Arte actual: rediseño de septiembre de 2026, 97 piezas generadas con Midjourney.
El método está en `docs/superpowers/specs/2026-09-07-doty-midjourney-assets-design.md`
y el pipeline en `scripts/mj/`. La identidad anterior (2024–2026) está archivada
en `public/images/doty-classic/`.

## Canon

- **Cuerpo redondo rosa** con **contorno navy** y ojos navy con brillo blanco.
- **Sin anteojos.** La única pieza que los lleva es `lentes`, y el narrador
  `doty-scientist`. Todo lo demás va sin ellos — es un filtro explícito en los
  prompts de icono.
- **Sin zapatos.** Doty nunca los ha llevado; el hero original tampoco.
- **Sin sombra pintada.** El arte nace sin la elipse y la recibe por CSS. Los
  22 clásicos sí la traen dentro del PNG, así que al usarlos hay que pasar
  `shadow={false}` o se duplica.

### Los tres narradores de voz

Comparten cara y proporciones con Doty y se distinguen a tamaño de avatar
(~80 px), que es donde se usan. Lo que los separa **no es el accesorio**: es la
silueta y el color, porque a ese tamaño un accesorio no se lee.

| Narrador | Cuerpo | Silueta | Lleva |
|---|---|---|---|
| `doty-fem` | orquídea `#B327BC` | óvalo, coleta trenzada | visera cyan, muñequera |
| `doty-sailor` | carmín `#EE013A` | bajo y cuadrado | gorra blanca de marinero, pañuelo cyan |
| `doty-scientist` | violeta `#9982D9` | penacho peinado atrás | gafas redondas, bata blanca |

Los cuatro comparten la luminosidad del rosa base a propósito: así todos miden
entre 3 y 5,7:1 de contraste en **los dos temas**, y ninguno se apaga al
cambiar. Ver la nota de §3.10 de la spec — un barrido de color que no respete
esto rompe el contraste en un tema u otro.

## Paleta

Hay **dos paletas y no son la misma cosa**; confundirlas es un error fácil.

**La de marca** — es la que va en los prompts de Midjourney y en el arte:

| Rol | Hex |
|---|---|
| Rosa (cuerpo) | `#FF1F8F` |
| Navy (contorno, ojos) | `#1E1B5C` |
| Azul | `#3768FF` |
| Cyan | `#35D8F5` |

**La de la UI** — tokens CSS de `app/globals.css`, que es su fuente de verdad:

| Token | Claro | Rol |
|---|---|---|
| `--accent` | `#e5077e` | **el rosa de la UI** — CTAs, marca |
| `--primary` | `var(--navy)` | navy — *no es el rosa* |
| `--foreground` | `#201a4d` | navy del texto |
| `--gem` | `#12b5c9` | cyan de la gema |
| `--flame` | `#ff7a1a` | naranja de la racha |
| `--gold` | `#ffb020` | oro |

Todos tienen su par en tema oscuro en el mismo archivo. **El navy no sirve como
masa grande**: sobre el fondo del tema oscuro mide 1,18:1 y la forma desaparece.
Como línea (contorno, borde, marco) es correcto y es la marca —
`validate_catalog` rechaza un prompt que lo pida de relleno.

## Tipografía

- **Baloo 2** — display: titulares, botones, números. `var(--font-display)` /
  clase `font-display`.
- **Nunito** — cuerpo de texto.
- **Geist Mono** — código y tablas de admin.

## Cómo renderizar a Doty

```tsx
import Doty, { toDotyPose } from "@/components/ui/doty/doty";

<Doty pose="excelente" size="smaller" />              // éxito
<Doty pose="oh-no" size="small" animation="sad" />    // error
<Doty pose={toDotyPose(valorDeLaApi)} size="mini" />  // string dinámico
```

- **`pose` es un tipo, no un string.** Sale del registro **generado**
  `components/ui/doty/poses.ts`. Un valor que venga de la API o de la BD pasa
  por `toDotyPose`, que cae a `feliz` en vez de a un 404.
- **`size`**: `micro` 32 · `mini` 80 · `tiny` 96 · `smaller` 112 · `small` 144
  · `medium` 192 · `big` 352.
- **`animation`**: `none` · `bob` · `cheer` · `sad` · `wave`. Solo
  `transform`/`opacity`, así que cumplen la regla 2 de CLAUDE.md (RN-safe).
- **`shadow`**: por defecto la pone el CSS. `shadow={false}` para stickers y
  para cualquier arte que ya la traiga pintada.
- **`say`**: burbuja de texto.

Para los diez stickers usa `DotySticker`, que trae el copy en CSS —
el texto **no** está en el sprite, así que se puede traducir:

```tsx
import DotySticker from "@/components/ui/doty/doty-sticker";
<DotySticker kind="amazing" />   // → "¡Increíble!"
```

## Catálogo (97 piezas)

Los ocho primeros grupos son el registro que consume `<Doty>`; los tres últimos
viven fuera de él.

| Grupo | N | Slugs |
|---|---|---|
| `expressions/` | 15 | feliz, muy-feliz, emocionado, orgulloso, sorprendido, pensando, preocupado, triste, enojado, decepcionado, riendo, timido, enamorado, cansado, dormido |
| `poses/` | 16 | saludando, pulgar-arriba, senalando, bienvenido, aplaudiendo, caminando, corriendo, saltando, bailando, sentado, leyendo, escribiendo, en-laptop, escuchando, en-celular, hablando |
| `states/` | 6 | wow, oh-no, ups, excelente, perfecto, sigue-asi |
| `celebrations/` | 6 | lo-lograste, confeti, trofeo-celebracion, medalla, diploma-celebracion, fuegos-artificiales |
| `accessories/` | 16 | libro, lapiz, laptop, tablet, celular, mochila, taza, diploma, trofeo, microfono, bandera-uk, bandera-usa, maleta, lentes, idea, globo |
| `themed/` | 6 | navidad, halloween, san-valentin, fiestas-patrias, graduacion, back-to-school |
| `icons/` | 6 | correcto, incorrecto, atencion, cargando, racha, nivel-completado |
| `stickers/` | 10 | good-job, amazing, keep-going, you-can-do-it, lets-practice, oops, almost, nice, excellent, see-you |
| `games/` | 12 | un tile por juego, en `public/images/games/` — los consume la cuadrícula de `/play`, no `<Doty>` |
| `characters/` | 3 | los tres narradores; van a Cloudinary, no al repo |
| `app-icon/` | 1 | de aquí salen los seis iconos de la PWA y los doce splash |

Las claves de `stickers` llevan prefijo en el registro: `sticker-good-job`.
Las celebraciones de trofeo y diploma se llaman `trofeo-celebracion` y
`diploma-celebracion` para no chocar con los accesorios homónimos.

La fase 4 (`fase-4.json`) suma 14 expresiones, 3 narradores de dificultad y
el grupo `avatars` (25 retratos, fuera del registro, en
`public/images/avatars/`).

## Qué expresión va con qué mensaje

| Contexto | Pose |
|---|---|
| Éxito / respuesta correcta | `excelente`, `perfecto` |
| Error / respuesta incorrecta | `oh-no`, `ups` |
| Advertencia | `preocupado` + chapa `atencion` |
| Info / tip | `pensando`, `senalando`, `idea` |
| Toast ok / error (admin) | `pulgar-arriba` / `ups` |
| XP ganado | `confeti` |
| Racha | chapa `racha` + `emocionado` |
| Quest diaria completada | `lo-lograste` |
| Nivel completado | `trofeo-celebracion` + chapa `nivel-completado` |
| Podio del leaderboard | `medalla`, `trofeo` |
| Lecturas | `leyendo` |
| Práctica / juegos | `en-laptop`, `sigue-asi` |
| Login / bienvenida | `bienvenido`, `saludando` |
| Cargando | chapa `cargando`, `pensando` |
| Estado vacío | `timido`, `sentado` |
| Avatar de narrador de voz | `hablando` |
| Despedida | `DotySticker kind="see-you"` |

## Humor e irreverencia

Doty es juvenil e irreverente, para **todo público**. La regla que decide cualquier
duda sigue siendo la de arriba: **motiva y celebra, nunca regaña**. Sobre ella,
cinco reglas de voz (aprobadas el 2026-09-14):

| Regla | Sí | No |
|---|---|---|
| Hype exagerado al celebrar | "Modo bestia activado. +1000 de aura." | "Bien hecho." (plano) |
| Drama sobre sí mismo, nunca sobre el usuario | "Se me apagó la llama. Estoy destruido. Vuelve." | "Perdiste la racha por flojo." |
| Picardía suave **solo** por inactividad | "Te extrañé… 👀 ¿Volvemos?" | Picardía tras un error: "¿Otra vez mal?" |
| Jerga de internet latina neutra | aura, cocinado, GOAT, modo bestia, épico, literal | Chilenismos, regionalismos, vulgaridad |
| Español; inglés solo como modismo enseñable, con traducción | "You're on fire! (= estás en racha)" | Celebraciones enteras en inglés |

**El arte dibuja arquetipos, el copy pone la moda.** Los PNG duran años; una frase
se cambia en un commit. Los memes van en esta tabla, no en el catálogo de arte, y
las franquicias se describen sin nombrarlas ("aura dorada flameante y pelo de
energía en punta", nunca el nombre de la serie).

### Frases aprobadas por momento

| Momento | Pose | Frase |
|---|---|---|
| Racha en práctica (5, 10, 15…) | `en-llamas` | "You're on fire! (= estás en racha) · {n} seguidas" |
| Nuevo récord o trono | `aura` | "Farmeaste aura. Récord nuevo." |
| Tiempo agotado en un juego | `cocinado` | "Me cociné yo, no tú. Otra ronda." |
| Primera carga tras perder la racha | `llanto-dramatico` | "Se apagó la llama. Estoy destruido. Una lección y me recupero." |
| Maestría al 100 % | `cerebro-galaxia` | "Cerebro galaxia. Este nivel ya es tuyo." |
| Entrada tras 3 a 6 días sin practicar | `reojo` | "Te extrañé… 👀 ¿Volvemos?" |
| Entrada tras 7 o más días | `bostezo` | "Me quedé dormido esperándote. Cero drama. Vamos." |
| Nivel desbloqueado | `mente-volada` | "Nivel nuevo desbloqueado. Sin palabras." |
| Checkpoint aprobado | `lentes-deal` | "Checkpoint aprobado. Deal with it (= acéptalo)." |
| Cabecera de /play | `gamer` | "Arcade · XP sin sufrir." |
| Aviso de rival | `chismoso` | "{nombre} te pasó en el ranking. Está {n} XP arriba. Una lección y lo recuperas." |
| Error de carga | `facepalm` | "Se me cayó algo. Culpa mía. ¿Reintentamos?" |
| Boost de XP activo | `flexeando` | "XP x2 activo. Modo bestia." |
| Repaso al día | `meditando` | "Repaso al día. Paz mental." |
| Dificultad: 0 % | narrador | "Todo el mundo empezó aquí. Hasta yo." |
| Dificultad: < 50 % | narrador | "Vas con todo. Ni una lección te frena." |
| Dificultad: < 80 % | narrador | "Más de la mitad. Ya no hay vuelta atrás." |
| Dificultad: < 100 % | narrador | "Ya casi. Cierra con estilo." |
| Dificultad bloqueada (vista previa) | narrador | "Termina la anterior y este camino se abre." |
| Dificultad: 100 % | narrador | "Nivel dominado. +1000 de aura." |
| Bienvenida (primer inicio) | `saludando` | "¡Hola! Soy Doty. Tu coach de inglés. Prometo no regañarte." |
| Pista: primer nivel | `senalando` | "Este es tu primer nivel. Toca la imagen y arrancamos. Cada lección son unos tres minutos." |
| Pista: la llama | `emocionado` | "La llama es tu racha. Practica hoy y se enciende. Un día sin practicar y se apaga. Drama garantizado." |

Prohibido en copy y en prompts de arte: burlarse de un error del usuario,
vulgaridad, regionalismos, franquicias por nombre, texto dentro del PNG.

## Cómo pedir una pose nueva

Nunca copiando un PNG a mano a `public/images/Doty/`: `npm run lint` lo rechaza
(`check-doty-assets --strict` prohíbe huérfanos en esa carpeta).

1. **Añade la pieza** a `scripts/mj/batches/fase-4.json` (fase-1 está cerrada;
   las piezas nuevas de Doty van a la fase 4): `slug` en kebab-case, `group`,
   `prefix`, `prompt`, `size`, `mascot`, `done: false`. El `prefix` es la llave
   con la que el pipeline mapea la descarga de vuelta, **y además va dentro del
   prompt**, así que sus palabras dirigen la generación — ver abajo.
2. **Saca el lote**:
   `uv run --python 3.12 scripts/mj/process.py --emit-lote <grupo> --pendientes --raw $RAW`
3. **Genera en Midjourney** siguiendo el lote: las piezas de mascota van con
   `$RAW/fase-0/ref-patron.png` adjunta en *Attach to prompt* — la misma fuente
   siempre, **nunca una salida anterior**, que el Edit Model hereda el acabado y
   encadenar acumula deriva. Las de icono van sin adjunto y con el ancla de su
   grupo en *Style reference*, que es otro slot y hace otra cosa. Descarga
   **sin renombrar**: el pipeline mapea cada archivo a su pieza por las
   primeras palabras del prompt.

   `$RAW` es `dots/imagenes/mj/`, fuera de los dos repos de git.
4. **Procesa**: `--apply fase-4 --raw $RAW` (quita fondo, cierra agujeros,
   recorta y mide el halo).
5. **Regenera el registro**: `--emit-registry fase-1 fase-4` (ambas fases: el
   registro es la unión).
6. `npm run lint` y commit — el PNG y el catálogo van en el mismo commit.

Para rehacer una pieza que ya existe no pongas `done: false`: márcala
`regen: true`. Con `done: false` el registro cae al placeholder mientras dure, y
eso es una regresión silenciosa en producción.

### Lo que aprendimos escribiendo los prompts

Cinco cosas que costaron intentos y ahorran los siguientes:

- **El prefijo dirige la generación, no solo nombra el archivo.** "Doty Sailor
  the **old** crimson narrator" dio el cuerpo bajo y cuadrado del marinero;
  pedirlo como geometría ("stockier and squarer") no lo conseguía. Midjourney
  construye primero una idea de *persona* y deriva el cuerpo de ahí, así que un
  concepto de persona funciona mejor que una instrucción de forma.
- **El navy solo como línea.** Ocho prompts lo pedían de relleno y eran el
  origen real de las piezas que no se leían sobre el tema oscuro. Hay un guard
  en `validate_catalog`.
- **Un accesorio pequeño sale mal y cinco salen peor.** Dos objetos grandes es
  lo que funciona: gorra + pañuelo, gafas + bata.
- **Los rasgos infantiles vienen en racimo** — lazo, rubor, cabeza ladeada,
  mano al pecho — y hay que negarlos explícitamente en el prompt, porque son el
  prior del modelo y vuelven solos.
- **Nada blanco encerrado en la figura sin avisar.** `rembg` decide por color y
  se come el blanco de un ojo o de un pergamino; el pipeline lo repara
  (`fill_internal_holes`), pero si el hueco da al fondo en vez de estar
  encerrado, no lo alcanza y hay que regenerar.

## Iconografía

Desde septiembre de 2026 la app no usa emoji como iconografía de producto: un
emoji lo dibuja el sistema operativo, sale distinto en Safari de iPhone que en
escritorio, y no se puede teñir con CSS. Dos sistemas lo reemplazan, ninguno
pasa por `<Doty>` ni por `poses.ts`:

- **35 SVG propios** — `<Icon name=…>`, `components/ui/icon/paths.tsx` — en
  tres familias: nav, nodo y glifo.
- **12 PNG de economía** — `<UiIcon name=…>`, `public/images/ui/` —
  generados con Midjourney igual que el resto del arte de Doty, porque su
  color es identidad (una gema es cyan, una racha es fuego) y no algo que el
  contexto deba teñir.

`npm run lint` verifica los dos (`scripts/check-icons.mjs`).

### Los 35 SVG

| Familia | N | `strokeWidth` | Slugs |
|---|---|---|---|
| `nav` | 5 | 3 | camino, repaso, retos, juegos, perfil |
| `nodo` | 8 | 2.5 | leccion, escucha, gramatica, vocabulario, letras, numeros, lectura, checkpoint |
| `glifo` | 22 | 3.5 | check, cruz, aviso, candado, lupa, lapiz, ajustes, enlace, abajo, sol, luna, imagen, calendario, punto, cuadro, empate, duelo, brujula, escudo, armar, izquierda, derecha |

- **Paleta cerrada de rellenos**: rosa `#FF1F8F`, azul `#3768FF`, cyan
  `#35D8F5` y blanco. Nada más entra en un `fill`.
- **El navy `#1E1B5C` es la línea, nunca el relleno.** Sobre el tema oscuro
  mide 1,18:1 de contraste y una masa navy se funde con el fondo — el mismo
  criterio 5 que rige el arte de Midjourney (`mjlib.py::dark_fill_mentions`).
  `check-icons.mjs` lo rechaza si aparece en un `fill`.
- **Un solo `viewBox`, 48**, igual en las tres familias, para que un mismo
  número de grosor signifique lo mismo en cualquiera de ellas.
- **El grosor es constante dentro de cada familia y NO se copia de los tiles
  de Midjourney** (`public/images/levels/`, fase 2): su contorno mide el 1.8%
  del sujeto, que a 24 px —el tamaño real al que se ven esos tiles en la
  cabecera— son 0.45 px, invisibles. El grosor de un SVG se decide por el
  tamaño real al que se renderiza esa familia, no imitando el trazo de un PNG
  generado a otra escala. Por eso nav es 3, nodo 2.5 y glifo 3.5, y no los
  tres iguales.
- **El tamaño de render se elige por call site, no se fija en un número.** El
  "16 px" que calibra el grosor de la familia glifo (3.5 se lee bien entre 16
  y 24 px) es una referencia de calibración del trazo, no una orden de
  renderizar todo a 16. Seguirla al pie de la letra dejó diminuto un `aviso`
  en `memory/page.tsx` que antes era un emoji grande: el tamaño lo decide lo
  que el icono reemplaza en cada sitio (16 como piso para texto corrido,
  20-24+ para lo que antes era un emoji grande), no una constante global.
- **`izquierda` y `derecha`**: flechas de navegación entre dificultades del
  Camino (familia glifo).

> **`cairosvg` pinta macizo lo que es un agujero.** Si verificas estos SVG
> fuera del navegador —una hoja de contacto en Python, por ejemplo—, ten en
> cuenta que `cairosvg` renderiza mal `fill-rule="evenodd"`: un icono como
> `enlace` (dos anillos huecos entrelazados) sale con los anillos rellenos,
> como si fueran discos macizos. En el navegador real se ven huecos, que es
> como se leen. Esto estuvo a punto de tirar un icono que estaba bien: la
> hoja de contacto de Python miente en cualquier pieza con `evenodd` — hay
> que mirarla en un navegador de verdad antes de descartarla.

### Los cuatro últimos: duelo, brujula, escudo y armar

La revisión final de la rama `feat/iconografia-propia` (2026-09-14) encontró
emoji que el criterio de arriba clasifica como iconografía —nombran una cosa
del sistema y se repiten— pero que ningún icono cubría todavía. Cuatro
coincidían con un icono ya dibujado para otra cosa y se cablearon en esa
misma pasada: `repaso`←🔁, `retos`←🎯, `checkpoint`←🏁, `escucha`←🔊 y 👂. Los
cuatro que quedaban sin icono propio —⚔️, 🧭, 🛡️, 🧩— se dibujaron y cablearon
en `feat/iconos-pendientes`: el criterio de aceptación 1 de
`docs/superpowers/specs/2026-09-13-iconografia-propia-design.md` queda
cumplido y no queda iconografía-emoji en código de producto (los emoji de
copy dentro de una frase, como el toast "¡Reto enviado! ⚔️" de
`top-students.tsx:88`, siguen fuera de esta cuenta: esos son puntuación, no
iconos).

- **⚔️ → `duelo`.** Dos espadas cruzadas en aspa, rosa y cyan, cada una con
  su guarda. Cablea en tres sitios — el botón que abre el picker de rival
  (`components/interactive-column/top-students.tsx`), la cabecera del panel
  "Duelo directo" y el prefijo de cada reto saliente en su lista (los dos en
  `components/quests/challenges-panel.tsx`).
- **🧭 → `brujula`.** Círculo con una aguja de rombo inclinada, mitad rosa y
  mitad blanca. Cablea en las dos pantallas de la prueba de ubicación
  (`components/onboarding/placement-test.tsx` y `placement-result.tsx`) vía
  la prop `emoji` de `SectionLabel`, que acepta `ReactNode`.
- **🛡️ → `escudo`.** Silueta de escudo —hombros rectos arriba, punta
  abajo— rellena de cyan, con un galón rosa dentro. Cablea en
  `components/quests/rival-banner.tsx`, como contraparte del `retos` de la
  línea de arriba (el rival por delante ya cableado, éste es el rival por
  detrás).
- **🧩 → `armar`.** Tres bloques de palabra en fila, de anchos distintos, y
  un cuarto flotando encima desplazado, a punto de encajar. Cablea en
  `components/practice-container/practice-container.tsx` (modo `buildUp`).
  **A propósito no es un puzzle.** El candidato obvio era reutilizar
  `gramatica` (dos piezas encajando, rosa y cyan) — pero `gramatica` ya está
  cableado al tipo de nodo Gramática (`NODE_META.grammar`,
  `lib/path-node-meta.ts`), y prestarlo aquí mezclaría dos señales: un
  ejercicio "arma la oración" puede vivir en cualquier tipo de lección, no
  solo en Gramática, y el préstamo le diría al usuario que está en un nodo
  que no es. Por eso `armar` tiene geometría propia — bloques rectangulares,
  no piezas — y sigue siendo la razón por la que un `gramatica` #2 no debe
  aparecer aquí en el futuro.

**Lección de esta pasada: un trazo que solo llega hasta el centro no cruza
nada.** El primer intento de `duelo` dibujaba cada espada como un triángulo
con la punta lejos del centro y la base cerca de él — geometría que no
llenaba el lienzo, solo lo alcanzaba a medias. A 16-24 px eso no se leía como
espadas cruzadas, se leía como una flecha o un pájaro. Dos formas que solo
alcanzan la mitad del lienzo y se tocan cerca del medio no forman una X: cada
espada necesita abarcar la diagonal completa, de esquina a esquina, para que
al rotarlas ±45° la punta y la guarda queden en extremos opuestos. Se
detectó mirando la hoja de contacto, no con una métrica — otro caso a favor
de mirar antes de descartar.

### Los 12 PNG de economía

Mismo pipeline que el resto del arte de Doty (Midjourney → `rembg` → recorte
y alfa → `--apply`). Los criterios de rechazo, verificados a 24 px —el
tamaño real en la cabecera— sobre los dos fondos del tema:

1. Ninguna pieza pierde un elemento sobre el fondo oscuro.
2. Los tres del podio se distinguen entre sí.
3. Ningún color fuera de la paleta de marca.
4. La fracción de píxeles "apagados" (HSV, saturación < 0.45, sin contar el
   blanco del fondo ni el navy de la línea) queda por debajo de un umbral.

**Sobre qué etapa se mide el criterio 4.** El mismo cálculo da números muy
distintos según la imagen que le pases:

| Tanda | Descarga cruda (sobre blanco) | PNG procesado (alfa, recortado) |
|---|---|---|
| Buena (aceptada) | 6.8% | 0.7% |
| Descartada (ronda 4) | 21% | *no existe* — se descartó antes de procesarse |

La diferencia entre etapas son los píxeles del borde: al reducir una imagen
con fondo blanco, el degradado entre la figura y el fondo son píxeles
desaturados, y `rembg` los elimina de raíz al recortar el alfa. **Medir sobre
el PNG procesado da una cifra entre cinco y diez veces menor que medir sobre
la descarga cruda** — un umbral calibrado en una etapa no dice nada sobre la
otra.

**El criterio se mide sobre la descarga cruda**, nunca sobre el PNG
procesado: es la etapa en la que de verdad se decide si una candidata merece
procesarse (para cuando existe un PNG procesado, la generación ya se aceptó),
y además es la única etapa en la que hay dato de las dos tandas — una tanda
que se descarta no llega a tener versión procesada con la que comparar.

Umbral: **12%**. No es arbitrario: es, redondeado, la media geométrica entre
la mediana de la tanda buena en crudo (6.8%) y la de la tanda descartada en
crudo (21%) — √(6.8 × 21) ≈ 12.0 —, así que dista lo mismo *proporcionalmente*
(~1.75×) de cada una en vez de estar pegado a un extremo: da margen a que un
lote algo peor que el de referencia siga pasando, sin acercarse a la zona de
las tandas que de verdad estaban mal. Cualquier pieza que falle vuelve al
catálogo con `regen: true`, nunca `done: false`.

### Aviso: las métricas por píxel priorizan, no deciden

A lo largo del arte generado con Midjourney para este proyecto —las poses de
Doty y los doce tiles de juego (fase 1), los doce iconos de economía de esta
tarea (fase 3)— una medición por píxel estuvo a punto de tirar arte bueno o
de aceptar arte malo, cuatro veces:

- Midiendo el contraste por píxel de cuatro tiles de juego contra el fondo de
  su tarjeta (fase 1): marcó **tres de cuatro como rotos** cuando no lo
  estaban. La legibilidad de un dibujo no es el contraste medio de sus
  píxeles, es su estructura local — un icono se lee si sus formas se separan
  entre sí y del fondo por bordes, no si cada píxel supera un umbral contra
  el fondo. El cuarto, `memory`, sí estaba roto de verdad: medía **1.21:1**,
  y ahí no era un problema de promedio, era que la forma entera se fundía
  con el fondo. Se corrigió retocando la descarga cruda a cyan, que subió a
  **8.05:1**. Es el caso más instructivo de los cuatro porque es el único
  donde la métrica acertó en una pieza y falló en las otras tres — eso es lo
  que hace peligrosa una métrica a medio validar: acierta lo suficiente para
  que te fíes de ella.
- Midiendo la saturación "apagada" del criterio 4 sobre el PNG ya procesado
  en vez de sobre la descarga cruda — la diferencia es de cinco a diez veces
  (ver arriba).
- Midiendo conformidad de paleta con un score que dio 37% para arte fuera de
  marca y 34% para arte ya publicado y correcto — la métrica no separaba los
  dos mundos; puesta al lado del arte de referencia, la diferencia se veía a
  simple vista.
- Midiendo el color del disco de `podio-bronce` con una ventana centrada que
  también cogía el anillo exterior, lo que hizo parecer que una regeneración
  válida era peor que la anterior — mirarlas a 24 px, una junto a otra,
  mostró que no lo era.

El patrón se repite porque la métrica mide algo real, pero no mide lo que
decide. **Una métrica por píxel sirve para priorizar qué mirar, nunca para
decidir sin mirar.** La decisión se toma viendo la pieza al tamaño real de
uso, sobre el fondo real.
