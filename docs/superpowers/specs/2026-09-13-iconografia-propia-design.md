# Iconografía propia — fase 3

- **Fecha**: 2026-09-13
- **Estado**: diseño, pendiente de revisión de Sergio.
- **Alcance**: los emoji que la app usa como iconografía. Un set SVG nuevo
  (`components/ui/icon/`), 12 piezas nuevas por el pipeline de `scripts/mj/`, y
  el cableado en los componentes que hoy pintan un emoji.
- **Predecesora**: `2026-09-11-tiles-de-niveles-design.md` (fase 2, cerrada).
  Reutiliza el pipeline sin cambios y hereda su regla del navy.

## El problema, medido

La app pinta **72 emoji distintos** fuera de admin, en 69 archivos. Un emoji no
es un dibujo que la app controle: es una petición al sistema operativo. Apple
Color Emoji en iPhone, Noto en Android, Segoe en Windows. El mismo `💬` del
primer nivel —*Saludos*— sale distinto en Safari que en Chrome de escritorio, y
ninguna de las dos versiones se parece al arte de dots.

El segundo síntoma es peor y es el que motivó esta fase: desde que existen los
38 tiles de la fase 2, el Camino mezcla dos lenguajes. El nodo de un nivel es
arte propio con contorno navy y paleta de marca; el nodo de al lado es un emoji
de Apple. Y la barra de navegación —Camino, Repaso, Retos, Juegos, Perfil— es
enteramente emoji. Cuanto mejor queda el arte generado, más evidente es lo que
no lo es.

`components/shell/nav-items.ts` ya lo anticipaba en un comentario: *"emoji
provisional; se puede sustituir por icono más adelante"*.

## El criterio: qué se reemplaza y qué no

No todos los 72 hacen el mismo trabajo.

- **Es iconografía** si nombra una cosa del sistema y se repite: un destino del
  nav, un tipo de nodo, la racha, las gemas. El usuario lo ve cien veces y
  espera que signifique siempre lo mismo. Aquí la inconsistencia entre
  plataformas es un fallo.
- **Es puntuación** si vive dentro de una frase: `"casi lo tienes 😬"`. Ahí el
  emoji hace el trabajo de un signo, no de un icono, y que cambie de estilo
  entre teléfonos no molesta a nadie. Sustituirlo por un PNG lo empeora: rompe
  la línea de texto y obliga a maquetar un `<img>` dentro de un párrafo.

Aplicado a los 72, salen **42 piezas** dentro y **30 fuera**.

## El reparto

El eje no es "arte contra glifos". Es **qué necesita cambiar de color**.

### SVG dibujados — 30

| Grupo | Piezas | Por qué SVG |
|---|---|---|
| Nav del hub | 5 | `app-nav.tsx` tiñe el destino activo con `text-(--accent)` y el inactivo con `text-(--muted)`. Un emoji ignora el color del texto, así que **hoy el estado activo solo se ve en la etiqueta**. Un PNG tampoco se tiñe. |
| Tipos de nodo del Camino | 8 | El nodo va en gris cuando está bloqueado, en color cuando está abierto. Hoy se resuelve con `filter: grayscale(1)`, que sobre un PNG apaga también los colores de marca. |
| Glifos de interfaz | 17 | ✓ ✗ 🔒 ⚠️ 🔍 ✏️ ⚙️ ☀️ 🌙 👇 y demás. Tienen que ser exactos entre sí y heredar el color del contexto (error en rojo, éxito en verde de sistema, etc.). |

**No pasan por Midjourney**, y la razón no es el coste. Un set de iconos vive de
que las 30 compartan geometría: mismo grosor, mismo radio, misma familia de
formas. Generadas de una en una salen desparejas — es el problema que el ancla
del grupo resuelve a medias en el arte de mascota, y aquí no basta, porque estas
30 se ven **juntas y en la misma barra**, no repartidas por el Camino.

### Midjourney — 12

`racha`, `gemas`, `vidas`, `xp`, `corona`, `trofeo`, `medalla`, `regalo`,
`podio-oro`, `podio-plata`, `podio-bronce`, `rayo`.

Son objetos con color propio que **no debe cambiar con el contexto**: una gema
es cyan, una racha es fuego. Ahí el color es parte del significado, un PNG es el
formato correcto, y es donde el arte generado se luce. Entran como grupo nuevo
`ui` en un catálogo `fase-3.json`, con su pieza ancla.

**La vida perdida (`🤍`) no es una pieza más.** Es el mismo corazón apagado, y se
resuelve con `filter: grayscale(1) opacity(.4)` sobre `vidas.png`. Generar una
segunda pieza obligaría a mantener dos dibujos sincronizados para una diferencia
que es de estado, no de objeto.

### Fuera de alcance — 30

- **14 de pantallas de juego**: 👻 en ghost-race, 💣 en dot-bombs, 🚕 en dotaxi,
  🟦 en memory, 🎭 🧠 🎧 🪂 🗼 🛬 🚀 ❄️ 🧱 🎨. Son decoración local de una
  pantalla concreta, y cada juego ya tiene su tile generado en la fase 1.
- **13 de copy**: 😬 😔 😅 🙂 😮 😏 💪 💔 💥 👋 💡 🌱 🤯. Ver el criterio.
- **3 variantes**: 🤍 (lo resuelve un filtro CSS, arriba), 🌟 y ✨, que son
  brillo decorativo alrededor de premios que sí tienen pieza.

Los 6 emoji que solo viven en admin quedan aparte de esta cuenta y no se tocan:
es herramienta interna y nadie fuera del equipo los ve.

## La regla de dibujo

Es el corazón de la spec. Sin ella acabamos como los 6 iconos que la fase 1 ya
generó y que nadie cableó: `correcto` verde, `atencion` naranja,
`nivel-completado` dorado — ninguno usa la paleta, y cambiar un emoji ajeno por
un PNG ajeno no arregla nada.

**Lo que hace familia:**

1. **Paleta cerrada.** Rellenos solo en rosa `#FF1F8F`, azul `#3768FF`, cyan
   `#35D8F5` y blanco. Contorno siempre navy `#1E1B5C`. **Nunca navy como
   relleno** — mide 1.18:1 sobre el tema oscuro y la forma se funde con el
   fondo. Es la misma regla que el `icon_block` del pipeline.
2. **Rellenos planos.** Sin degradados, sin brillos especulares. El arte de
   mascota sí los lleva; la iconografía no, y esa diferencia es correcta: Doty
   es un personaje, un icono es un signo.
3. **Geometría redondeada.** `stroke-linecap="round"`, `stroke-linejoin="round"`,
   esquinas con radio. Nada de ángulos vivos.
4. **`viewBox="0 0 48 48"`** en las 30, para que un mismo camino se lea igual a
   cualquier tamaño.

**Lo que NO hace familia, y hay que decirlo explícitamente:** el grosor de
trazo de los tiles. Medido sobre las 38 piezas de la fase 2, el contorno navy es
el **1.8% del sujeto** — en un viewBox de 48, un `stroke-width` de 0.9. A tamaño
de nav (24 px) eso son 0.45 píxeles reales: invisible.

Una ilustración de 512 px vista a 64 tiene el contorno finísimo; un icono de
24 px necesita trazo que se vea. Copiar el número produce iconos que no se leen.
El grosor se elige **por tamaño de uso**, calibrado mirando el icono a su tamaño
real sobre los dos fondos:

| Uso | Tamaño | `stroke-width` sobre viewBox 48 |
|---|---|---|
| Nav | 24 px | 3 |
| Nodo del Camino | 40 px | 2.5 |
| Glifo en línea de texto | 16 px | 3.5 |

Son puntos de partida, no dogma: cada icono se valida a su tamaño real y se
ajusta si hace falta. Lo que no se negocia es que dentro de un mismo uso, las
piezas compartan grosor exacto.

## Arquitectura

### El componente

`components/ui/icon/icon.tsx` expone `<Icon name="camino" size={24} />`. Los
caminos SVG viven en `components/ui/icon/paths.ts` como un mapa
`Record<IconName, ReactNode>`, no como archivos `.svg` sueltos: inline evita una
petición por icono y permite que `currentColor` funcione.

```tsx
<Icon name="camino" size={24} />          // hereda color del contenedor
<Icon name="candado" size={16} className="text-(--muted)" />
```

El relleno de marca va fijo en el path; lo que hereda `currentColor` es el
**contorno**, que es lo que el nav y el nodo necesitan teñir. Un icono en estado
inactivo pierde el contorno navy y toma el gris del contexto, y su relleno baja
de opacidad por CSS.

**Una sola costura para React Native.** La regla 2 del CLAUDE.md anticipa una
app RN. El SVG inline en JSX no porta tal cual, pero si todos los caminos viven
en un único `paths.ts` y un único `icon.tsx` los pinta, el puerto es reescribir
ese componente con `react-native-svg` y **no tocar ninguna pantalla**. Ese es el
motivo de que sea un componente y no `<svg>` suelto en cada sitio.

### Los 12 de Midjourney

Catálogo `scripts/mj/batches/fase-3.json`, grupo `ui`, 512 px, con su ancla. El
destino es `public/images/ui/<slug>.png` — hace falta una rama nueva en
`_relative_output` de `mjlib.py`, igual que la que la fase 2 añadió para
`levels`.

**No entran en `poses.ts`.** No los consume `<Doty>` sino un `<UiIcon>` propio,
por la misma razón que los tiles de nivel no entraron: un icono no es una pose.

### Limpieza: los 6 de la fase 1

`correcto`, `incorrecto`, `atencion`, `cargando`, `racha`, `nivel-completado`
están en `public/images/Doty/icons/`, registrados en `poses.ts` como poses de
Doty, y **ninguna pantalla los renderiza** — se generaron y nunca se cablearon.

Se retiran del registro y se archivan junto a los sprites classic. Cuatro de
ellos los cubre el set SVG (`correcto`, `incorrecto`, `atencion`, `cargando`) y
dos los cubre el grupo `ui` (`racha`, `nivel-completado` → `xp`). Dejarlos sería
mantener dos fuentes de verdad para el mismo icono.

Ojo: `check-doty-assets --strict` prohíbe huérfanos en `public/images/Doty/`, así
que el borrado del directorio y la limpieza del registro van en el mismo commit.

## Riesgos

**El set SVG queda desparejo.** Es el riesgo real: 30 iconos dibujados en
sesiones distintas derivan. Se mitiga dibujándolos por familias (los 5 del nav
de una vez, los 8 de nodo de una vez) y revisando cada familia en una hoja de
contacto a tamaño real sobre los dos fondos, como se hizo con los tiles.

**Un icono no se lee a 24 px.** Pasó con los tiles a 64 px y pasará aquí antes.
La verificación es la misma y es obligatoria: mirar la pieza al tamaño de uso,
nunca a tamaño completo.

## Criterios de aceptación

1. Ninguno de los 42 emoji del alcance queda en el código de producto. Un grep
   de los rangos de emoji sobre `components/` y `app/`, excluyendo admin y los
   30 que quedan fuera, devuelve cero.
2. Los 30 SVG se leen a su tamaño de uso —24 px el nav, 40 px el nodo, 16 px los
   glifos— sobre el fondo real y en los dos temas.
3. Dentro de cada familia, todas las piezas comparten `stroke-width` exacto.
4. Ningún icono usa navy como relleno.
5. El nav tiñe el icono activo, no solo la etiqueta: `<Icon>` responde a
   `currentColor`.
6. Los 6 iconos de la fase 1 ya no están en `poses.ts` ni en
   `public/images/Doty/icons/`.
7. `npm run lint` y `npx next build` pasan.
