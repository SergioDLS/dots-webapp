# Tiles de niveles del Camino — fase 2

- **Fecha**: 2026-09-11
- **Estado**: diseño, pendiente de revisión de Sergio.
- **Alcance**: `levels.src` de las 95 filas de la BD de producción, un catálogo
  nuevo `scripts/mj/batches/fase-2.json`, los PNG en `public/images/levels/`, y
  un script de backend para reasignar. **No** toca el componente del Camino:
  `path-difficulty.tsx` y `path-container.tsx` ya leen `src` tal cual.
- **Predecesora**: `2026-09-07-doty-midjourney-assets-design.md` (fases 0 y 1,
  cerradas). Reutiliza el pipeline `scripts/mj/` sin cambios.

## El problema, medido

La estimación de la spec anterior decía "~30 tiles; corrige los 48 niveles que
comparten `abc.png`". Consultada la BD el 2026-09-11, el estado real es peor y
distinto:

| | |
|---|---|
| Niveles totales | 95 (49 vivos, 46 `on_construction`) |
| Imágenes distintas | 24 |
| Niveles con `abc.png` | 48 |

Pero **el `abc.png` no es el problema principal**. Lo es que las secciones 2 y 3
reciclan al azar las imágenes de vocabulario de la sección 1:

| Nivel | Imagen que usa hoy |
|---|---|
| `demonstrative pronouns` | `numbers.png` |
| `personal pronouns` | `colors.png` |
| `verb to be` | `family.png` |
| `do/does` | `shapes.png` |
| `past progressive` | `shapes.png` |
| `comparative superlative` | `colors.png` |

No es falta de identidad: **la imagen afirma algo falso**. Un nivel de pronombres
demostrativos con un dibujo de números le dice al alumno que va a aprender
números. Un tile genérico es neutro; uno equivocado engaña, y eso es peor.

## El criterio: qué trabajo hace la imagen

La decisión de una-por-nivel contra una-por-familia no es de presupuesto. Depende
de qué puede hacer la imagen en cada caso:

- **Si la imagen puede llevar el contenido → una por nivel.** `sports` enseña
  deportes: un dibujo de deportes adelanta literalmente lo que vas a aprender.
- **Si solo puede etiquetar la familia → una por familia.** No existe un dibujo
  de "present perfect" que enseñe present perfect. Ahí la imagen solo te orienta:
  "esto va de tiempos perfectos".

Una imagen por nivel gramatical sería **peor**, no mejor: 70 símbolos abstractos
parecidos entre sí, donde el alumno no distinguiría `past perfect` de
`present perfect` mirando un dibujo. Agrupados, al menos sabe en qué familia está.

Aplicado nivel a nivel, hay mucha más gramática dibujable de lo que parece:
`prepositions` es una caja con algo dentro, encima y debajo; `conditionals` es un
camino que se bifurca; los siete `ways to say…` son situaciones emocionales, o
sea justo lo que Doty hace mejor.

**Consecuencia visual deliberada**: vocabulario ilustrado y concreto, gramática
más simbólica. Recorrer el Camino y notar que cambia el terreno es información,
no inconsistencia. Lo que sí hay que cuidar es que los símbolos compartan
lenguaje entre ellos — mismo grosor de línea, misma paleta, mismo nivel de
abstracción — o parecerán iconos de sitios distintos. Se resuelve como en los
tiles de juegos: una pieza ancla en el slot *Style reference*.

## Reparto

**25 niveles de la sección 1 no se tocan.** Son vocabulario concreto y ya tienen
su imagen correcta. Única excepción a revisar: `foods` (12) y `meals` (13)
comparten `meals.png` y son temas distintos.

De los 70 restantes salen **29 imágenes propias y 9 marcadores de familia**: 38
piezas nuevas.

### Imágenes propias (29)

| Slug nuevo | Niveles | Qué se dibuja |
|---|---|---|
| `esto-eso` | 20 | Doty señalando algo cerca y algo lejos |
| `reflexivos` | 24, 32 | Doty señalándose en un espejo |
| `singular-plural` | 27 | un objeto contra muchos iguales |
| `preposiciones` | 29, 95 | una caja con algo dentro, encima y debajo |
| `frecuencia` | 30 | un calendario con marcas repetidas |
| `comparativo` | 35 | tres Dotys: grande, más grande, el más grande |
| `parecido` | 37 | dos objetos idénticos uno junto a otro |
| `preguntas` | 38 | signos de interrogación / las cinco W |
| `cantidad` | 40, 53 | un montón grande y un montón pequeño |
| `desde-durante` | 41 | una línea de tiempo con un punto y un tramo |
| `opuestos` | 55, 94 | frío y calor, grande y pequeño |
| `exclamaciones` | 56 | signos de exclamación |
| `palabras-compuestas` | 57 | dos piezas encajando en una |
| `acciones` | 58 | Doty en varias acciones a la vez |
| `conectores` | 62 | eslabones de cadena unidos |
| `condicionales` | 64 | un camino que se bifurca |
| `imperativo` | 65 | Doty dando una instrucción, dedo al frente |
| `estilo-indirecto` | 70 | un bocadillo dentro de otro bocadillo |
| `deseo` | 73 | una estrella fugaz |
| `modismos` | 84 | el clásico "raining cats and dogs" |
| `jerga` | 85 | bocadillo con símbolos desenfadados |
| `formal-informal` | 86 | traje a un lado, ropa de casa al otro |
| `no-me-gusta` | 87 | Doty con gesto de rechazo amable |
| `me-gusta` | 88 | Doty encantado, pulgar arriba |
| `presentarse` | 89 | Doty dando la mano |
| `calma` | 90 | Doty respirando, gesto tranquilizador |
| `te-extrano` | 91 | Doty mirando una foto con nostalgia |
| `decir-no` | 92 | Doty negando con la mano, amable |
| `felicitar` | 93 | Doty con confeti y aplauso |

Los nueve últimos (`no-me-gusta` … `felicitar`) son los más dibujables de los 95:
son emociones, y Doty ya tiene el vocabulario expresivo para todas. Todos están
`on_construction` hoy.

### Marcadores de familia (9)

| Slug nuevo | Niveles | Qué se dibuja |
|---|---|---|
| `pronombres` | 21, 22, 26, 36 | siluetas de Doty con flechas de posesión entre ellas |
| `presente` | 23, 25 | un reloj marcando ahora |
| `pasado` | 31, 34, 42, 43, 67 | un reloj con la flecha hacia atrás |
| `futuro` | 51, 52, 66, 76, 77 | un reloj con la flecha hacia delante |
| `perfectos` | 59, 60, 61 | una marca de completado sobre una línea de tiempo |
| `modales` | 54, 69, 74, 75 | Doty ante dos opciones, gesto de duda |
| `estructuras` | 63, 68, 71, 72, 78, 79, 80, 81, 82, 83 | piezas de puzzle que encajan |
| `articulos` | 19, 33, 39 | tres fichas pequeñas: a, an, the |
| `complementos` | 28 | una frase como tren de vagones |

`estructuras` agrupa diez niveles porque son exactamente los que no comparten
nada salvo "no se pueden dibujar": `phrasal verbs`, `active/passive`,
`the ING form`, `use of For`. Es el cajón honesto, no el de sastre — cualquier
símbolo que los distinguiera entre sí sería inventado.

## Arquitectura de assets

- **Catálogo**: `scripts/mj/batches/fase-2.json`, mismo esquema que fase 1. Grupo
  nuevo `levels`, `mascot: true` donde sale Doty y `false` donde es símbolo puro.
- **Ancla**: una pieza con `anchor: true` para el grupo, que fija el lenguaje de
  los símbolos. Sin ella, 38 piezas generadas por separado divergen en grosor de
  línea y nivel de abstracción — es el mismo fallo que el ancla de `games` evita.
- **Destino**: `public/images/levels/<slug>.png`, 512 px (como `icons` y `games`;
  el tile se pinta a ~64 px en el Camino).
- **Registro**: estas piezas **no** entran en `poses.ts`. No las consume `<Doty>`
  sino `path-difficulty.tsx` leyendo `levels.src` de la API, igual que hoy.
  `check-doty-assets --strict` solo recorre `public/images/Doty/`, así que la
  carpeta nueva no le afecta.

## Cambio en la base de datos

Un script en `dots-backend/scripts/set-level-art.js`, con el patrón obligatorio
del CLAUDE.md del backend: dry-run por defecto, `--apply` explícito, respaldo JSON
en `scripts/out/` reescrito tras cada fila, y `--rollback`.

Escribe `levels.src` en las 70 filas de las secciones 2 a 12. Las 25 de la
sección 1 no se tocan.

**Riesgo conocido y cómo se evita.** El 2026-09-10 se escribió `difficulty.img`
con valores que solo entendía el frontend sin desplegar, y producción quedó con
tres imágenes rotas. Aquí pasaría lo mismo si se aplica antes de desplegar los
PNG. El orden es obligatorio:

1. Generar y procesar las 38 piezas.
2. Commit y **push** — que los PNG estén servidos en producción.
3. Verificar que las 38 URLs responden 200 en `app.dotsonlinelearning.com`.
4. Solo entonces, `--apply` del script de BD.

Con ese orden, el peor caso intermedio es que un nivel siga con su imagen vieja,
que es exactamente el estado de hoy.

## Fuera de alcance

- **Los 46 niveles `on_construction` siguen sin contenido.** Se les asigna
  imagen igualmente, por consistencia y porque sus temas ya están definidos por
  el nombre. Si un nivel cambia de enfoque al construirse, se regenera esa pieza:
  es una, no el lote.
- **Los duplicados del currículo.** Los niveles 24 y 32 se llaman los dos
  `reflexive pronouns`, y 37 (`like / alike`) y 80 (`Like`) se solapan. Aquí se
  tratan como el mismo tema y comparten imagen, pero **si es un error de datos,
  el arreglo es de contenido y va aparte**.
- **`foods` y `meals`** comparten `meals.png` en la sección 1. Queda anotado;
  separarlos es una pieza más si Sergio quiere.
- **Los tiles de secciones y checkpoints**, si los hubiera. Esta spec cubre
  `levels`, no `path_nodes`.

## Presupuesto

38 piezas. Con el plan Standard y relax ilimitado el coste es tiempo, no dinero:
a 4 candidatas por pieza y ~1 min de GPU por trabajo en V8.2 + Edit Model, son
unos 150 minutos de generación repartidos en tandas.

## Criterios de aceptación

1. Ningún nivel de las secciones 2 a 12 comparte imagen con un nivel de la
   sección 1.
2. Ningún nivel muestra una imagen que afirme un contenido que no enseña.
3. Los 38 tiles se leen a 64 px, el tamaño real del nodo en el Camino — medido
   como en los tiles de juegos, sobre el fondo real de la tarjeta y en los dos
   temas.
4. Los símbolos comparten grosor de línea y nivel de abstracción entre sí.
5. `npm run lint` y `npx next build` pasan; el script de BD tiene su respaldo y
   su rollback probados.
