# Tiles de niveles del Camino — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que ningún nivel del Camino muestre una imagen que afirme un contenido que no enseña.

**Architecture:** Se reutiliza el pipeline `scripts/mj/` de la fase 1 sin cambiarlo de forma: un catálogo nuevo `fase-2.json` con un grupo `levels`, las piezas a `public/images/levels/`, y un script de backend que reasigna `levels.src` en las 70 filas de las secciones 2 a 12. Las 25 de vocabulario de la sección 1 no se tocan.

**Tech Stack:** Python 3.12 + Pillow + rembg (pipeline), Midjourney V8.2 Edit Model (generación), Node + pg (script de BD), Next.js 16 (consumo).

**Spec:** `docs/superpowers/specs/2026-09-11-tiles-de-niveles-design.md`

## Global Constraints

- **`$RAW` es `/home/endurance/Projects/Endurance/dots/imagenes/mj`**, fuera de los dos repos de git. Todos los comandos del pipeline lo reciben con `--raw`.
- **Paleta de marca**: rosa `#FF1F8F`, navy `#1E1B5C`, azul `#3768FF`, cyan `#35D8F5`.
- **El navy es línea, nunca masa.** Sobre el tema oscuro mide 1.18:1 y la forma desaparece. `validate_catalog` rechaza un prompt que lo pida de relleno.
- **Tamaño de pieza**: 512 px, como `icons` y `games`. El tile se pinta a ~64 px en el Camino.
- **Node**: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `npm`/`npx` en bash. En fish, `nvm use 24` a secas.
- **La BD es la COMPARTIDA de producción.** Ningún script con `--apply` se ejecuta sin consentimiento explícito de Sergio en esa conversación (regla 1 del CLAUDE.md del backend).
- **Orden de despliegue obligatorio**: generar → procesar → push de los PNG → verificar 200 en `app.dotsonlinelearning.com` → y solo entonces `--apply` de la BD. Al revés deja imágenes rotas en producción.

---

### Task 1: El pipeline admite el grupo `levels`

**Files:**
- Modify: `scripts/mj/mjlib.py` (`EXTRA_GROUPS`, `_relative_output`)
- Test: `scripts/mj/tests/test_mjlib.py`

**Interfaces:**
- Consumes: `mjlib.EXTRA_GROUPS`, `mjlib._relative_output(piece, fase)`, `mjlib.output_path(piece, fase, repo_root, raw_root)` — ya existen.
- Produces: el grupo `"levels"` es válido en un catálogo, y sus piezas se escriben en `public/images/levels/<slug>.png` dentro del repo.

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `scripts/mj/tests/test_mjlib.py`:

```python
def test_levels_escribe_en_su_carpeta_y_no_sobre_el_app_icon():
    # `_relative_output` cae por defecto a la ruta del app-icon: sin una rama
    # propia, las 38 piezas de niveles se escribirían todas encima de
    # fase-2/out/app-icon.png, en silencio y pisándose entre sí.
    p = piece(slug="preposiciones", group="levels", mascot=False, size=512)
    assert mjlib._relative_output(p, "fase-2") == "public/images/levels/preposiciones.png"


def test_levels_es_un_grupo_valido(tmp_path):
    cat = {"fase": "fase-2", "pieces": [
        piece(slug="preposiciones", group="levels", prefix="Level tile prepositions",
              mascot=False, size=512, anchor=True),
    ]}
    assert mjlib.load_catalog(write(tmp_path, "fase-2.json", cat))["fase"] == "fase-2"
```

- [ ] **Step 2: Ejecutar y verificar que fallan**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q -k levels
```
Esperado: FAIL. El primero devuelve `fase-2/out/app-icon.png`; el segundo lanza `CatalogError: invalid group 'levels'`.

- [ ] **Step 3: Implementar**

En `scripts/mj/mjlib.py`, línea 14:

```python
EXTRA_GROUPS = ("games", "characters", "app-icon", "levels")
```

Y en `_relative_output`, **antes** del `return` final:

```python
    if g == "levels":
        return f"public/images/levels/{s}.png"
```

- [ ] **Step 4: Ejecutar y verificar que pasan**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Esperado: PASS, y el resto de la suite sigue en verde.

- [ ] **Step 5: Verificar que el test tiene dientes**

Quitar la rama `if g == "levels"` y volver a correr: debe fallar exactamente `test_levels_escribe_en_su_carpeta_y_no_sobre_el_app_icon`. Restaurar.

- [ ] **Step 6: Commit**

```bash
git add scripts/mj/mjlib.py scripts/mj/tests/test_mjlib.py
git commit -m "feat(mj): el pipeline admite el grupo levels

_relative_output caía por defecto a la ruta del app-icon, así que sin una rama
propia las 38 piezas de niveles se habrían escrito todas encima de
fase-2/out/app-icon.png, pisándose entre sí y sin un solo error."
```

---

### Task 2: Catálogo `fase-2.json` con las 38 piezas

**Files:**
- Create: `scripts/mj/batches/fase-2.json`
- Create: `scripts/mj/tests/test_catalogo_fase2.py`

**Interfaces:**
- Consumes: `mjlib.load_catalog`, `mjlib.validate_catalog` (Task 1).
- Produces: 38 piezas en el grupo `levels`, una de ellas con `anchor: true`.

**Contexto que el implementador necesita:**

`validate_catalog` exige **exactamente un `anchor: true` por grupo que tenga piezas no-mascota**, y `anchor` requiere `mascot: false`. El ancla del grupo `levels` es `preposiciones`: es el símbolo más concreto y sirve de patrón de estilo para los otros ocho marcadores.

> **Corregido en ejecución (`e5a5f8b`).** Diez piezas pasaron de símbolo puro a
> mascota — `pronombres`, `esto-eso`, `singular-plural`, `preposiciones`,
> `parecido`, `opuestos`, `condicionales`, `preguntas`, `estilo-indirecto`,
> `cantidad` — así que el reparto real es **22 mascota / 16 icono** y el ancla
> se mudó a `estructuras`. Los bloques de código de abajo son el diseño
> original; el catálogo en `scripts/mj/batches/fase-2.json` manda.

Las piezas con Doty llevan `mascot: true` (se generan con `ref-patron.png` adjunta); los símbolos puros llevan `mascot: false` (texto a imagen con el ancla en *Style reference*).

- [ ] **Step 1: Escribir el script que genera el catálogo**

Crear `scripts/mj/batches/_gen_fase2.py` (temporal, se borra en el Step 5):

```python
"""Genera fase-2.json desde la tabla de la spec. Se escribe como script y no a
mano porque 38 entradas JSON copiadas invitan a un error de dedo que nadie ve."""
import json, collections

SIMBOLO = ("flat icon, thick rounded outline, brand palette #FF1F8F #1E1B5C "
           "#3768FF #35D8F5, centered, plain white background")

# slug, prefix, prompt, mascota
PIEZAS = [
    ("preposiciones", "Level tile prepositions", "an open box with a small ball inside it, another ball resting on top and a third underneath, arrows showing the three positions", False),
    ("esto-eso", "Level tile this and that", "a hand pointing at a near object and a second hand pointing at a far object, the near one bigger", False),
    ("reflexivos", "Doty looking at himself in a mirror", "standing in front of an oval mirror and pointing at his own reflection, playful smile", True),
    ("singular-plural", "Level tile one and many", "one apple on the left and a group of five apples on the right, separated by a vertical line", False),
    ("frecuencia", "Level tile frequency", "a small calendar grid with several days marked by pink ticks", False),
    ("comparativo", "Doty in three sizes", "three copies of the same Doty in a row, small then medium then large, showing a size comparison", True),
    ("parecido", "Level tile two alike", "two identical cyan stars side by side with an equals sign between them", False),
    ("preguntas", "Level tile question marks", "three question marks of different sizes overlapping, one pink one blue one cyan", False),
    ("cantidad", "Level tile how many", "a tall pile of coins on one side and two coins on the other", False),
    ("desde-durante", "Level tile timeline", "a horizontal timeline with one marked point on the left and a highlighted stretch on the right", False),
    ("opuestos", "Level tile opposites", "a sun and a snowflake side by side, split by a diagonal line", False),
    ("exclamaciones", "Level tile exclamation marks", "three exclamation marks of different sizes overlapping, one pink one blue one cyan", False),
    ("palabras-compuestas", "Level tile compound words", "two puzzle pieces joining into one, each a different brand colour", False),
    ("acciones", "Doty in motion", "shown three times in one image running, jumping and waving, with motion lines", True),
    ("conectores", "Level tile chain links", "three interlocking chain links in a row, alternating pink and blue", False),
    ("condicionales", "Level tile forked road", "a path splitting into two branches, each ending in a different coloured dot", False),
    ("imperativo", "Doty giving an instruction", "standing upright pointing firmly forward with one arm, confident expression", True),
    ("estilo-indirecto", "Level tile speech inside speech", "a large speech bubble containing a smaller speech bubble", False),
    ("deseo", "Level tile shooting star", "a bright cyan shooting star with a trailing tail across the frame", False),
    ("modismos", "Level tile raining cats and dogs", "a small cloud raining cartoon cats and dogs, playful", False),
    ("jerga", "Level tile slang bubble", "a speech bubble filled with playful abstract symbols and squiggles", False),
    ("formal-informal", "Level tile formal and informal", "a necktie on one side and a casual cap on the other, split by a vertical line", False),
    ("no-me-gusta", "Doty politely declining", "making a gentle no-thanks face with one hand raised palm out, still friendly", True),
    ("me-gusta", "Doty delighted", "beaming with both thumbs up, eyes bright with enjoyment", True),
    ("presentarse", "Doty offering a handshake", "extending one hand forward for a handshake, warm welcoming smile", True),
    ("calma", "Doty calming down", "eyes closed breathing slowly with both palms pressed downward in a calming gesture", True),
    ("te-extrano", "Doty missing someone", "holding a small framed photo and looking at it fondly, wistful smile", True),
    ("decir-no", "Doty saying no kindly", "shaking one hand side to side in a friendly refusal, apologetic smile", True),
    ("felicitar", "Doty congratulating", "clapping with confetti falling around him, celebrating", True),
    # marcadores de familia
    ("pronombres", "Level tile pronouns", "three simple round character silhouettes in a row with arrows pointing between them", False),
    ("presente", "Level tile clock now", "a clock face with both hands pointing up and a highlighted ring around the rim", False),
    ("pasado", "Level tile clock backward", "a clock face with a bold curved arrow sweeping counter-clockwise around it", False),
    ("futuro", "Level tile clock forward", "a clock face with a bold curved arrow sweeping clockwise around it", False),
    ("perfectos", "Level tile completed timeline", "a horizontal timeline with a large check mark sitting on top of it", False),
    ("modales", "Doty weighing two options", "looking at two floating option bubbles, one on each side, with a thoughtful expression", True),
    ("estructuras", "Level tile puzzle pieces", "four puzzle pieces locking together into a square, each a different brand colour", False),
    ("articulos", "Level tile three small cards", "three small rounded cards in a row, each a different brand colour, no text", False),
    ("complementos", "Level tile train of cars", "a simple train of four linked cars in a row, each a different brand colour", False),
]

piezas = []
for slug, prefix, prompt, mascota in PIEZAS:
    p = collections.OrderedDict(
        slug=slug, group="levels", prefix=prefix, prompt=prompt,
        size=512, mascot=mascota, done=False,
    )
    if slug == "preposiciones":
        p["anchor"] = True
    piezas.append(p)

cat = collections.OrderedDict(fase="fase-2", pieces=piezas)
with open("scripts/mj/batches/fase-2.json", "w") as f:
    json.dump(cat, f, ensure_ascii=False, indent=2)
    f.write("\n")
print(f"{len(piezas)} piezas · {sum(1 for p in piezas if p['mascot'])} mascota")
```

- [ ] **Step 2: Ejecutarlo y validar**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
uv run --python 3.12 python scripts/mj/batches/_gen_fase2.py
uv run --python 3.12 --with pillow python -c "
import sys; sys.path.insert(0,'scripts/mj')
import mjlib
cat = mjlib.load_catalog('scripts/mj/batches/fase-2.json')
print('válido:', len(cat['pieces']), 'piezas')"
```
Esperado: `38 piezas · 10 mascota` y `válido: 38 piezas`.

Si `validate_catalog` se queja de un prefijo que colisiona, el mensaje nombra las dos piezas: renombrar el prefijo de la más nueva. Si se queja de navy de relleno, cambiar ese color en el prompt.

- [ ] **Step 3: Escribir el test del catálogo**

Crear `scripts/mj/tests/test_catalogo_fase2.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

BATCH = Path(__file__).resolve().parents[1] / "batches" / "fase-2.json"

# Los 70 niveles de las secciones 2 a 12, según la tabla de la spec.
# Las 25 de vocabulario de la sección 1 NO están y no deben estarlo.
ASIGNACION = {
    "esto-eso": [20], "reflexivos": [24, 32], "singular-plural": [27],
    "preposiciones": [29, 95], "frecuencia": [30], "comparativo": [35],
    "parecido": [37], "preguntas": [38], "cantidad": [40, 53],
    "desde-durante": [41], "opuestos": [55, 94], "exclamaciones": [56],
    "palabras-compuestas": [57], "acciones": [58], "conectores": [62],
    "condicionales": [64], "imperativo": [65], "estilo-indirecto": [70],
    "deseo": [73], "modismos": [84], "jerga": [85], "formal-informal": [86],
    "no-me-gusta": [87], "me-gusta": [88], "presentarse": [89], "calma": [90],
    "te-extrano": [91], "decir-no": [92], "felicitar": [93],
    "pronombres": [21, 22, 26, 36], "presente": [23, 25],
    "pasado": [31, 34, 42, 43, 67], "futuro": [51, 52, 66, 76, 77],
    "perfectos": [59, 60, 61], "modales": [54, 69, 74, 75],
    "estructuras": [63, 68, 71, 72, 78, 79, 80, 81, 82, 83],
    "articulos": [19, 33, 39], "complementos": [28],
}


def test_cada_nivel_aparece_exactamente_una_vez():
    # El fallo fácil de una tabla escrita a mano es un nivel olvidado o contado
    # dos veces, y no se ve leyéndola.
    todos = [n for ids in ASIGNACION.values() for n in ids]
    esperados = set(range(19, 96)) - {44, 45, 46, 47, 48, 49, 50}
    assert len(todos) == len(set(todos)), "hay niveles repetidos"
    assert set(todos) == esperados


def test_el_catalogo_cubre_la_asignacion():
    cat = mjlib.load_catalog(BATCH)
    slugs = {p["slug"] for p in cat["pieces"]}
    assert slugs == set(ASIGNACION), slugs ^ set(ASIGNACION)


def test_todas_son_del_grupo_levels_a_512():
    cat = mjlib.load_catalog(BATCH)
    for p in cat["pieces"]:
        assert p["group"] == "levels", p["slug"]
        assert p["size"] == 512, p["slug"]


def test_exactamente_un_ancla_y_es_preposiciones():
    # validate_catalog ya exige una por grupo no-mascota; esto fija CUÁL, porque
    # el ancla define el lenguaje visual de los otros ocho símbolos.
    cat = mjlib.load_catalog(BATCH)
    anclas = [p["slug"] for p in cat["pieces"] if p.get("anchor")]
    assert anclas == ["preposiciones"]
```

- [ ] **Step 4: Ejecutar los tests**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Esperado: PASS, incluidos los de fase 1.

- [ ] **Step 5: Borrar el generador y commitear**

El script era un andamio: el catálogo es ahora la fuente de verdad y mantener los dos invita a que diverjan.

```bash
rm scripts/mj/batches/_gen_fase2.py
git add scripts/mj/batches/fase-2.json scripts/mj/tests/test_catalogo_fase2.py
git commit -m "feat(mj): catálogo de la fase 2 — 38 tiles para 70 niveles

29 imágenes propias y 9 marcadores de familia. El criterio está en la spec: si
la imagen puede llevar el contenido va una por nivel, si solo puede etiquetar la
familia va una por familia.

El test fija que los 70 niveles aparezcan exactamente una vez. Un nivel olvidado
o contado dos veces es el fallo fácil de una tabla a mano y no se ve leyéndola."
```

---

### Task 3: Generación en Midjourney (trabajo humano — compuerta)

**Files:**
- Produce: 38 PNG en `$RAW/fase-2/`

**Interfaces:**
- Consumes: `scripts/mj/batches/fase-2.json` (Task 2).
- Produces: las descargas que Task 4 procesa.

- [ ] **Step 1: Emitir el lote**

```bash
mkdir -p "$RAW/fase-2"
uv run --python 3.12 --with pillow scripts/mj/process.py --emit-lote levels --pendientes --raw "$RAW" --fase fase-2
```
Esperado: `38 piezas (22 mascota, 16 icono) → $RAW/fase-2/LOTE-levels.md`

- [ ] **Step 2: Generar el ancla primero**

`estructuras` va marcada `⚓ ANCLA` en el lote. Se genera **sin nada adjunto**. Su mejor resultado se arrastra al slot **Style reference** y se deja ahí para los otros 15 símbolos.

Sin el ancla, 15 símbolos generados por separado divergen en grosor de línea y nivel de abstracción, y el Camino parece tener iconos de ocho sitios distintos.

- [ ] **Step 3: Generar el resto**

- **Las 15 de icono** (🔤): sin adjunto, con el ancla en *Style reference*.
- **Las 22 de mascota** (🎨): con `$RAW/fase-0/ref-patron.png` en *Attach to prompt*, nunca encadenando una salida como fuente.

Descargar **sin renombrar**: el pipeline mapea cada archivo a su pieza por las primeras palabras del prompt.

- [ ] **Step 4: Criterios para elegir candidata**

Además de los ocho del lote, tres propios de esta fase:

1. **Se lee a 64 px.** Es el tamaño real del nodo. Un símbolo con detalle fino se vuelve una mancha; probarlo entrecerrando los ojos.
2. **Nada de texto.** Midjourney escribe mal, y además la app va a traducirse.
3. **Si cambias una palabra del prompt, dilo** — va al catálogo. El prefijo es la llave del mapeo y además dirige la generación (lección de `old` en el marinero).

- [ ] **Step 5: Confirmar que están las 38**

```bash
uv run --python 3.12 --with pillow scripts/mj/process.py --dry-run fase-2 --raw "$RAW"
```
Esperado: 38 líneas `OK`, cero `FALTA`, cero `AMBIGUO`.

---

### Task 4: Procesado y verificación a 64 px

**Files:**
- Create: `public/images/levels/*.png` (38)
- Modify: `scripts/mj/batches/fase-2.json` (el pipeline marca `done` y `source_file`)

**Interfaces:**
- Consumes: las descargas de Task 3.
- Produces: los 38 PNG servidos por Next desde `public/images/levels/`.

- [ ] **Step 1: Procesar**

```bash
uv run --python 3.12 --with pillow --with rembg --with onnxruntime-gpu \
  scripts/mj/process.py --apply fase-2 --raw "$RAW"
```
Esperado: `## Hechas (38)`, `## Faltan (0)`, `## Alerta de halo (0)`.

Si alguna sale con alerta de halo, regenerarla: el umbral son 2.0 px y un sprite limpio mide ~1.4.

- [ ] **Step 2: Verificar que se leen a 64 px**

Crear y ejecutar `/tmp/verifica-tiles.py`:

```python
"""Los 38 tiles al tamaño REAL del nodo del Camino y sobre su fondo real.
Medir a tamaño completo miente: lo que decide es si el símbolo sobrevive la
reducción."""
import glob, os
from PIL import Image, ImageDraw, ImageFont

F = "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"
# el nodo del Camino es un círculo crema sobre el fondo de la app
FONDO = {"claro": (0xFA, 0xE8, 0xD7), "oscuro": (0x2A, 0x24, 0x52)}
rutas = sorted(glob.glob("public/images/levels/*.png"))
C, P, COLS = 96, 6, 8
for tema, fondo in FONDO.items():
    filas = (len(rutas) + COLS - 1) // COLS
    z = Image.new("RGB", (P * 2 + COLS * C, P * 2 + filas * (C + 14)), fondo)
    d = ImageDraw.Draw(z)
    peq = ImageFont.truetype(F, 8)
    tinta = (0x1E, 0x1B, 0x5C) if tema == "claro" else (255, 255, 255)
    for i, r in enumerate(rutas):
        im = Image.open(r).convert("RGBA")
        im.thumbnail((64, 64), Image.LANCZOS)
        cx, cy = P + (i % COLS) * C, P + (i // COLS) * (C + 14)
        caja = Image.new("RGBA", (C, C), fondo + (255,))
        caja.alpha_composite(im, ((C - im.width) // 2, (C - im.height) // 2))
        z.paste(caja.convert("RGB"), (cx, cy))
        d.text((cx + C // 2, cy + C - 2), os.path.basename(r)[:-4][:14],
               font=peq, fill=tinta, anchor="ma")
    z.save(f"/tmp/tiles-{tema}.png")
    print(f"/tmp/tiles-{tema}.png")
```

```bash
uv run --python 3.12 --with pillow python /tmp/verifica-tiles.py
```

Abrir los dos PNG con Read. Criterio: **cada tile tiene que ser distinguible de sus vecinos a ese tamaño.** Los que se vuelvan mancha se regeneran con menos detalle, no se aceptan.

- [ ] **Step 3: Lint y build**

```bash
source ~/.nvm/nvm.sh && nvm use
npm run lint && npx next build
```
Esperado: ambos pasan. `check-doty-assets --strict` solo recorre `public/images/Doty/`, así que la carpeta nueva no le afecta — si se queja, algo se escribió donde no debía.

- [ ] **Step 4: Commit**

```bash
git add public/images/levels scripts/mj/batches/fase-2.json
git commit -m "feat(levels): 38 tiles de niveles procesados

Verificados a 64 px, el tamaño real del nodo en el Camino, sobre el fondo del
nodo y en los dos temas. Medir a tamaño completo miente: lo que decide es si el
símbolo sobrevive la reducción."
```

---

### Task 5: Script de backend `set-level-art.js`

**Files:**
- Create: `dots-backend/scripts/set-level-art.js`
- Modify: `dots-backend/package.json` (script `levels:art`)

**Interfaces:**
- Consumes: la tabla de asignación de la spec.
- Produces: `levels.src` reescrito en 70 filas; respaldo en `dots-backend/scripts/out/backup-level-art-<ts>.json`.

- [ ] **Step 1: Escribir el script**

Crear `dots-backend/scripts/set-level-art.js`:

```js
/**
 * Tiles de niveles del Camino (spec webapp 2026-09-11-tiles-de-niveles §"Cambio
 * en la base de datos").
 *
 *   node scripts/set-level-art.js                    # dry-run
 *   node scripts/set-level-art.js --apply            # UPDATE de 70 filas
 *   node scripts/set-level-art.js --rollback scripts/out/backup-level-art-<ts>.json
 *
 * Toca SOLO las secciones 2 a 12. Los 25 niveles de vocabulario de la sección 1
 * ya tienen su imagen correcta y no se tocan.
 *
 * Patrón obligatorio del CLAUDE.md del backend: dry-run por defecto, --apply
 * explícito, respaldo JSON tras cada fila y --rollback.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');
const BASE = '/images/levels';

// slug del tile → ids de nivel. Copiado de la tabla de la spec.
const ASIGNACION = {
  'esto-eso': [20], reflexivos: [24, 32], 'singular-plural': [27],
  preposiciones: [29, 95], frecuencia: [30], comparativo: [35],
  parecido: [37], preguntas: [38], cantidad: [40, 53],
  'desde-durante': [41], opuestos: [55, 94], exclamaciones: [56],
  'palabras-compuestas': [57], acciones: [58], conectores: [62],
  condicionales: [64], imperativo: [65], 'estilo-indirecto': [70],
  deseo: [73], modismos: [84], jerga: [85], 'formal-informal': [86],
  'no-me-gusta': [87], 'me-gusta': [88], presentarse: [89], calma: [90],
  'te-extrano': [91], 'decir-no': [92], felicitar: [93],
  pronombres: [21, 22, 26, 36], presente: [23, 25],
  pasado: [31, 34, 42, 43, 67], futuro: [51, 52, 66, 76, 77],
  perfectos: [59, 60, 61], modales: [54, 69, 74, 75],
  estructuras: [63, 68, 71, 72, 78, 79, 80, 81, 82, 83],
  articulos: [19, 33, 39], complementos: [28],
};

function loadEnv() {
  const file = path.join(__dirname, '..', '.env');
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.trim().startsWith('#')) {
      const k = line.slice(0, i).trim();
      if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
    }
  }
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
}

async function rollback(db, file) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const e of entries) {
    await db.query('UPDATE levels SET src = $1 WHERE id = $2', [e.old, e.id]);
    console.log(`  ${e.id}: ${e.new} → ${e.old}`);
  }
  console.log(`Revertidas ${entries.length} filas`);
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const apply = process.argv.includes('--apply');
  const rollbackFile = arg('--rollback');

  const db = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  await db.query('SET search_path TO dots');
  try {
    if (rollbackFile) return await rollback(db, rollbackFile);

    // Un id que no exista en la BD es un error del mapeo, no un aviso: la fila
    // simplemente no se actualizaría y nadie se enteraría.
    const destino = new Map();
    for (const [slug, ids] of Object.entries(ASIGNACION)) {
      for (const id of ids) destino.set(id, `${BASE}/${slug}.png`);
    }
    const filas = (await db.query(
      'SELECT id, name, src FROM levels WHERE id = ANY($1) ORDER BY id',
      [[...destino.keys()]],
    )).rows;
    const faltan = [...destino.keys()].filter((id) => !filas.some((f) => f.id === id));
    if (faltan.length) throw new Error(`ids sin fila en levels: ${faltan.join(', ')}`);

    let cambian = 0;
    for (const f of filas) {
      const nuevo = destino.get(f.id);
      if (f.src === nuevo) continue;
      cambian++;
      console.log(`  ${String(f.id).padStart(3)} ${f.name.padEnd(34)} ${f.src.split('/').pop()} → ${nuevo.split('/').pop()}`);
    }
    console.log(`\n${cambian} de ${filas.length} filas cambian`);
    if (!apply) return console.log('\n(dry-run — nada escrito. Usa --apply.)');

    const backup = [];
    const backupFile = path.join(
      OUT_DIR, `backup-level-art-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    for (const f of filas) {
      const nuevo = destino.get(f.id);
      if (f.src === nuevo) continue;
      await db.query('UPDATE levels SET src = $1 WHERE id = $2', [nuevo, f.id]);
      backup.push({ id: f.id, name: f.name, old: f.src, new: nuevo });
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    }
    console.log(`\n${backup.length} filas escritas. Respaldo: ${backupFile}`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Declarar el script npm**

En `dots-backend/package.json`, dentro de `"scripts"`:

```json
"levels:art": "node scripts/set-level-art.js"
```

- [ ] **Step 3: Dry-run (solo lectura, seguro)**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend && nvm use 24
npm run levels:art
```
Esperado: 70 filas listadas con su `antes → después`, y `(dry-run — nada escrito)`.

Si sale `ids sin fila en levels`, el mapeo tiene un id que no existe: corregir la tabla antes de seguir.

- [ ] **Step 4: Commit (sin aplicar todavía)**

```bash
git add scripts/set-level-art.js package.json
git commit -m "feat(scripts): set-level-art — tiles de niveles a levels.src

Toca solo las secciones 2 a 12; los 25 de vocabulario de la sección 1 ya tienen
su imagen correcta. Un id que no exista en la BD es error y no aviso: la fila no
se actualizaría y nadie se enteraría."
```

---

### Task 6: Despliegue en el orden obligatorio

**Files:** ninguno nuevo.

**Interfaces:**
- Consumes: Tasks 4 (PNG) y 5 (script).

**Este orden no es una preferencia.** El 2026-09-10 se escribió `difficulty.img` con valores que solo entendía el frontend sin desplegar, y producción quedó con tres imágenes rotas hasta que se desplegó. Aquí pasaría lo mismo: `levels.src` apuntaría a PNG que aún no existen.

- [ ] **Step 1: Push del webapp**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
npm run lint && npx next build && git push origin main
```

- [ ] **Step 2: Esperar al despliegue y verificar las 38 URLs**

```bash
P=https://app.dotsonlinelearning.com
for f in public/images/levels/*.png; do
  u="/images/levels/$(basename "$f")"
  c=$(curl -s -o /dev/null -w "%{http_code}" "$P$u")
  [ "$c" = "200" ] || echo "  $c  $u"
done
echo "revisadas $(ls public/images/levels/*.png | wc -l)"
```
Esperado: ninguna línea de error. **Si alguna no responde 200, parar aquí.**

- [ ] **Step 3: Pedir consentimiento explícito a Sergio**

Regla 1 del CLAUDE.md del backend. Mostrarle la salida del dry-run y esperar un sí en esa conversación. Una directiva general ("termina el plan") no cuenta.

- [ ] **Step 4: Aplicar**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend && nvm use 24
npm run levels:art -- --apply
```
Esperado: `70 filas escritas` y la ruta del respaldo.

- [ ] **Step 5: Verificar en producción**

```bash
npm run levels:art
```
Esperado: `0 de 70 filas cambian` — la BD ya está en el estado deseado.

Luego abrir `/levels` en el navegador con sesión y comprobar que las secciones 2 y 3 muestran los tiles nuevos.

Si algo se ve mal: `npm run levels:art -- --rollback scripts/out/backup-level-art-<ts>.json`.

---

### Task 7: Documentación

**Files:**
- Modify: `docs/brand/doty-identity.md`, `docs/superpowers/specs/2026-09-11-tiles-de-niveles-design.md`

- [ ] **Step 1: Añadir el grupo al catálogo del doc de marca**

En la tabla "Catálogo" de `docs/brand/doty-identity.md`, después de la fila `app-icon/`:

```markdown
| `levels/` | 38 | tiles del Camino, en `public/images/levels/` — los consume `path-difficulty.tsx` leyendo `levels.src` de la API, no `<Doty>` |
```

Y actualizar el encabezado de la tabla: el catálogo pasa de 97 a 136 piezas (98 de fase 1 + 38 de fase 2).

- [ ] **Step 2: Cerrar el estado de la spec**

En la cabecera de `2026-09-11-tiles-de-niveles-design.md`, cambiar `Estado` a `implementado el <fecha>` y anotar cuántas piezas hicieron falta regenerar por no leerse a 64 px — ese número es el que informa la próxima fase.

- [ ] **Step 3: Commit**

```bash
git add docs/brand/doty-identity.md docs/superpowers/specs/2026-09-11-tiles-de-niveles-design.md
git commit -m "docs(levels): el grupo levels en el doc de marca y cierre de la fase 2"
```

---

## Self-review (hecho al escribir el plan)

- **Cobertura de la spec:** "El problema, medido" → Task 5 (el mapeo corrige las secciones 2-3); "El criterio" → Task 2 (el catálogo lo materializa); "Reparto" → Tasks 2 y 3; "Arquitectura de assets" → Tasks 1, 2, 4; "Cambio en la base de datos" → Tasks 5 y 6; "Criterios de aceptación" 1 y 2 → test de Task 2 + dry-run de Task 5; el 3 → Step 2 de Task 4; el 4 → el ancla de Task 3; el 5 → Step 3 de Task 4 y Step 1 de Task 6.
- **Fuera de alcance respetado:** no se toca `path_nodes`, ni los 25 de la sección 1, ni se arreglan los duplicados del currículo (24/32, 37/80) — se tratan como el mismo tema, y si son error de datos va aparte.
- **Riesgo principal cubierto:** el orden de despliegue tiene su propia tarea con una parada explícita si alguna URL no responde 200, porque este error ya ocurrió una vez.
- **Trampa del pipeline:** `_relative_output` cae por defecto a la ruta del `app-icon`. Task 1 la cubre con un test que se verifica quitando la rama.
