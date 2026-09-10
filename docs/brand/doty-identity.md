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

## Cómo pedir una pose nueva

Nunca copiando un PNG a mano a `public/images/Doty/`: `npm run lint` lo rechaza
(`check-doty-assets --strict` prohíbe huérfanos en esa carpeta).

1. **Añade la pieza** a `scripts/mj/batches/fase-1.json`: `slug` en kebab-case,
   `group`, `prefix`, `prompt`, `size`, `mascot`, `done: false`. El `prefix` es
   la llave con la que el pipeline mapea la descarga de vuelta, **y además va
   dentro del prompt**, así que sus palabras dirigen la generación — ver abajo.
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
4. **Procesa**: `--apply fase-1 --raw $RAW` (quita fondo, cierra agujeros,
   recorta y mide el halo).
5. **Regenera el registro**: `--emit-registry fase-1`.
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
