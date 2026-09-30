# El nivel que se expande — diseño

**Fecha:** 2026-09-30
**Repos afectados:** solo `dots-webapp`
**Estado:** aprobado en conversación, pendiente de plan de implementación

## Problema

Tocar un nivel del Camino abre hoy `NodePopover`: una tarjeta flotante de 212 px
que tapa el camino y repite lo que el nodo ya dice (tipo, título, una segunda
barra de progreso con su %). Es un tooltip. Lo que se quiere es que **la propia
burbuja del nivel crezca** hasta contener el botón para practicar, sin tarjeta
aparte y sin duplicar el progreso.

Además, la barra de 100×8 bajo cada nodo dice "cuánto" pero no "qué falta". El
Camino ya tiene dos niveles de logro (F3e): **completado** (respondiste todo una
vez, check verde) y **dominado** (mastery 100, check dorado). La barra no los
distingue.

## Decisiones tomadas en conversación

1. **La burbuja crece en su lugar, sin tarjeta.** Tocar un nivel lo expande: la
   imagen, la barra de hitos y el título son los mismos elementos que se
   reacomodan, y aparece el botón. No hay un segundo bloque que repita nada.
2. **Disposición horizontal.** La imagen se queda de su lado del zigzag: los
   niveles de la izquierda crecen hacia la derecha, los de la derecha hacia la
   izquierda, y los del centro dejan la imagen a la izquierda. Junto a la
   imagen va una columna con tipo, título, hitos y botón.
3. **Ancho.** En móvil, todo el ancho de la pista, es decir, el ancho del
   teléfono menos el gutter. En escritorio, `min(440px, ancho de la pista)`,
   anclado a su lado.
4. **El nivel actual se abre solo** al entrar al Camino, en móvil y en
   escritorio. Así se nota por dónde vas y «Continuar» queda a un toque.
5. **La barra de cada nodo pasa a tener hitos: completar y dominar.** Son dos
   tramos. El primero se llena con `progress` y termina en el hito
   *completado* (verde); el segundo se llena con `mastery` y termina en
   *dominado* (dorado). Lecciones (`practice`) y lecturas (`reading`) no tienen
   dominio: les queda un solo tramo. Las barras del banner de sección y de la
   cabecera plegada **no cambian**.
6. **Los hitos absorben el check.** Se quita el check verde/dorado de la
   esquina de la imagen: el hito lleva el check dentro. Hay un solo lugar que
   dice cuánto llevas.
7. **Contenido mínimo.** Tipo, título, hitos (con etiqueta «Completado» /
   «Dominado» solo al expandir) y botón Empezar/Continuar/Repasar. No se
   muestran el % en número, la cantidad de ítems, los compañeros ni un Doty
   extra.
8. **Los bloqueados siguen sin responder**, como hoy. La vista previa de una
   dificultad bloqueada tampoco expande nada.
9. **Doty se asoma arriba.** Con el nivel actual abierto, Doty y su globo
   «¡Sigue aquí!» se asoman por el borde superior de la burbuja, del lado de la
   columna. Los compañeros (`PathPeer`) se desvanecen mientras está abierta y
   vuelven al cerrarla.
10. **Animación suave, sin rebote**: unos 400 ms con desaceleración larga
    (`cubic-bezier(.22,1,.36,1)`). Con `prefers-reduced-motion`, la regla
    global de `globals.css` ya reduce las transiciones a color y opacidad, así
    que la burbuja aparece en su forma final sin desplazarse.

Estas decisiones las tomé yo por defecto y el usuario no las objetó:

- Solo una burbuja abierta a la vez. Se cierra al tocar la imagen otra vez, al
  abrir otro nivel o con un **click** fuera. No se usa `pointerdown`, que es lo
  que hace el popover hoy: con la burbuja abierta sola, el primer toque para
  hacer scroll la cerraría. Si cierras la del nivel actual, queda cerrada
  durante esa visita.
- El checkpoint se expande igual, sin hitos (hoy tampoco tiene barra).

## Diseño

### Geometría: la fila no cambia de alto

El Camino posiciona los nodos en absoluto con altura de fila fija
(`NODE_ROW_H`), y el conector SVG, Doty y los compañeros dependen de ella. La
disposición horizontal permite **no tocar esa altura**: la burbuja expandida
cabe en el mismo alto de fila, porque el título y la barra, que en reposo van
debajo de la imagen, pasan a la columna de al lado. Por eso:

- Ninguna fila se mueve al abrir o cerrar. El conector no se recalcula ni hay
  que sincronizarlo con la animación: queda debajo de la burbuja, que es
  opaca.
- La animación es **solo CSS**: transiciones sobre la burbuja y sus piezas. No
  hay rAF ni re-renders por frame.
- `NODE_ROW_H` sube de 182 a unos 188 px porque el hito (14 px) es más alto que
  la barra actual (8 px). Es un cambio de constante que el conector ya absorbe.
- **Espacio para Doty**: la fila del nivel actual reserva unos 48 px extra por
  arriba, siempre y no solo cuando está abierta, para que Doty asome sin
  chocar con la etiqueta del nivel anterior. Como es fijo, abrir o cerrar no
  mueve nada. El valor exacto se ajusta al verificar.

### Las piezas del nodo

`PathNode` pasa a tener dos estados, reposo y expandido, sobre los mismos
elementos:

| Pieza | Reposo | Expandido |
|---|---|---|
| Imagen (el botón que abre/cierra) | centrada en su slot de 150 px | desplazada con `transform: translateX` al borde de la burbuja (12 px de margen) |
| Barra de hitos | 100 px, bajo la imagen | se estira al ancho de la columna (transición de `left`/`top`/`width`) y muestra etiquetas |
| Título | bajo la imagen, 13 px, centrado | se desvanece; el de la columna aparece |
| Burbuja (fondo teñido, borde del acento, radio ~28) | invisible, del tamaño del slot | crece a su ancho final (transición de `left`/`width`) con `overflow: hidden` |
| Columna (tipo, título, CTA) | dentro de la burbuja, `opacity: 0`, `inert` | aparece con opacidad y un leve desplazamiento |

La columna tiene **ancho fijo, el final**, calculado igual que el de la
burbuja. Así el texto no se re-acomoda mientras la burbuja crece: la burbuja lo
va destapando.

Las coordenadas se calculan con unidades de contenedor (`cqw`). La pista
(`div` relativo de `path-section`, `maxWidth: 640`) pasa a ser
`container-type: inline-size`, y todas las posiciones son `calc()` puros por
lado (izquierda/centro/derecha) y por breakpoint. No se mide nada con JS. Esos
`calc()` salen de una función pura (`lib/node-bubble.ts`) con tests, para no
esparcir aritmética en el JSX.

La burbuja se pinta **dentro** del slot del nodo, así hereda el `dots-pop-in`
de entrada. Siempre está montada: la animación de cierre funciona sin
desmontar a destiempo, y una transición CSS no se dispara en el primer render.
Eso es justo lo que se quiere para el nivel actual, que **nace abierto sin
animar**.

Mientras está expandido, el nivel actual deja de flotar (`dots-float`) y de
pulsar. Conserva la estrella.

### Hitos: `lib/node-milestones.ts` + `components/path/node-milestones.tsx`

La función pura recibe `{ type, progress, completed, mastery }` y devuelve los
tramos: `{ fill: 0–100, color: "accent" | "success" | "gold", reached: boolean }[]`.

- Tipos con dominio (`letters`, `numbers`, `vocab`, `pronunciation`,
  `grammar`): dos tramos. El primero se llena con `progress` y se vuelve verde
  al completar. El segundo se llena con `mastery` **tal cual viene**, aunque el
  primero no esté completo (es un dato real: puedes dominar ítems antes de
  terminar la pasada), y se vuelve dorado a 100.
- `practice` y `reading`: un tramo.
- `checkpoint`: ninguno.

`MASTERY_TYPES` hoy está duplicado en `path-node.tsx` y `node-popover.tsx`, así
que pasa a vivir aquí.

El componente pinta cada tramo como un segmento con su hito al final: un
círculo de 14 px, vacío con borde del acento, o relleno (verde o dorado) con
`<Icon name="check" mono>`. Las etiquetas «Completado» y «Dominado» solo se ven
expandido. Accesibilidad: un `role="group"` con `aria-label` que dice ambos
porcentajes.

### `path-section.tsx`

- `openKey` arranca en la clave del nodo actual si la sección lo contiene y no
  es vista previa (inicializador de `useState`, sin efecto).
- Marca la pista como contenedor (`container-type: inline-size`).
- Suma el espacio de Doty a la fila del nivel actual.
- `popoverAlign` pasa a llamarse `side: "left" | "center" | "right"`, con la
  misma regla de 35/65.
- `data-tip="camino.primer-nivel"` va en la burbuja si está abierta y en el
  slot si no, para que la pista ilumine lo que se ve. Nunca hay dos elementos
  con esa marca.

### Doty y compañeros

- `DotyMarker` recibe un modo `peek`. Con la burbuja del actual abierta, se
  posa sobre el borde superior, del lado de la columna, un poco por detrás de
  la burbuja (asoma cabeza y brazos) y con el globo al lado. Cerrada, vuelve a
  su sitio de hoy. El cambio es una transición de `transform`/`opacity`.
- `PathPeer` se desvanece (opacidad) con la burbuja abierta. Hoy Doty cede su
  sitio a los compañeros: esa regla se mantiene en reposo.

### Scroll

Al abrir un nivel con un toque, `scrollIntoView({ block: "nearest", behavior:
"smooth" })` sobre el slot, con `scroll-margin` arriba y abajo para librar la
cabecera plegada y la barra de navegación. Como la fila no cambia de alto, esto
solo actúa si el nodo ya estaba medio fuera de la pantalla. El auto-scroll al
nivel actual que existe hoy no cambia.

### Copy de la pista del primer nivel

«Toca la imagen y arrancamos» deja de ser cierto: el nivel ya está abierto y el
botón está a la vista. Pasa a ser **«Toca «Empezar» y arrancamos. Cada lección
son unos tres minutos.»**, en `lib/tips.ts` y en la tabla de voz de
`docs/brand/doty-identity.md`.

### Lo que se borra

- `components/path/node-popover.tsx`.
- El check de esquina de la imagen en `path-node.tsx`.
- El listener de `pointerdown` para cerrar (lo reemplaza el de `click`).

## Fuera de alcance

- Barras de sección, de cabecera y del panel de dificultad.
- Nodos bloqueados interactivos.
- Contenido extra en la burbuja (ítems, compañeros, % numérico).
- Cambios de backend: todos los datos ya llegan en `GET /path`.

## Verificación

- `node --test` de `lib/node-milestones.test.mjs` y `lib/node-bubble.test.mjs`
  (entran solos en `npm run test:scripts` por el glob `lib/*.test.mjs`).
- `npm run lint` (incluye `check-icons`) y `npx next build`.
- Preview con backend arriba, a 375 px (móvil) y a 1280 px (escritorio), en
  claro y oscuro:
  - El actual nace abierto y sin salto. Abrir otro cierra el anterior. Un click
    fuera cierra; hacer scroll no.
  - Nada se mueve en vertical al abrir o cerrar, y el conector no se descuadra.
  - Nodo izquierdo, central y derecho. El checkpoint. Los tipos con y sin
    dominio.
  - Doty asomando sin chocar con el nivel anterior. Los compañeros se ocultan.
  - Con `prefers-reduced-motion`, la burbuja aparece sin desplazarse.
  - La pista del primer nivel ilumina la burbuja entera.
- Ancho de pista entre 768 y ~900 px (menor que 440): la burbuja no se sale de
  la pista.
