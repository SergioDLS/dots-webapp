# Arte de Doty con Midjourney (fases 0 y 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar los 22 PNG numéricos de Doty por un set semántico de 97 piezas generadas en Midjourney, con un pipeline local reproducible (prompts → descargas → rembg → sprites → registro tipado) y sin romper la app en ningún punto intermedio.

**Architecture:** Un catálogo JSON por lote (`scripts/mj/batches/<fase>.json`) es la única fuente de verdad: de él se emiten los prompts que Sergio pega en Midjourney, el registro TypeScript `poses.ts` y el mapeo descarga→destino. Mientras una pieza no está lista (`done: false`) el registro apunta a un PNG legacy (`fallback`), así que la migración de call sites a nombres semánticos se hace toda al principio con la app funcionando, y los sprites nuevos van entrando lote a lote. Un check en `npm run lint` garantiza que cada `src` del registro existe en disco; al final, en modo `--strict`, exige que no quede ningún legacy.

**Tech Stack:** Python 3.12 vía `uv run` (PEP 723) con `rembg[gpu]` + Pillow para el pipeline; Node + `sharp` para iconos y splash; Next 16 / React 19 / TS para el componente; script Node con `pg` + `cloudinary` en `dots-backend/scripts/` para las 6 filas de BD.

**Spec:** `docs/superpowers/specs/2026-09-07-doty-midjourney-assets-design.md`

## Global Constraints

- Node: `source ~/.nvm/nvm.sh && nvm use` antes de cualquier `npm`/`node`/`npx` (Node 24, `.nvmrc`).
- Verificación en la webapp: `npm run lint` y `npx next build` deben pasar antes de cada commit que toque código.
- Python: siempre `uv run` con `--python 3.12` (rembg no soporta el 3.14 del sistema). Los tests: `uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q`.
- Navegación siempre con `router.push`; nunca `window.location.*` (regla 1 de CLAUDE.md). Este plan no toca navegación.
- Animación solo `transform`/`opacity` (regla 2). Los keyframes `doty-*` cumplen.
- Prohibido `setState` síncrono en el cuerpo de un `useEffect` (regla 3). Este plan no añade efectos.
- Si cambia cualquier archivo de `PRECACHE_URLS` (`/icons/icon-192.png`), **bumpear `SW_VERSION` en `public/sw.js` en el mismo commit** (regla 9).
- Doty canónico **sin anteojos**; sombra **por CSS**, nunca dentro del PNG; colores `#FF1F8F` rosa, `#D60073` rosa oscuro, `#1E1B5C` navy, `#3768FF` azul, `#35D8F5` cyan.
- Nunca automatizar la web de Midjourney. Solo se procesan descargas hechas por Sergio.
- El script del backend es el **único** contacto con la BD de producción: dry-run por defecto, `--apply` explícito, respaldo JSON antes de escribir, `--rollback`.
- Descargas crudas en `dots/imagenes/mj/<fase>/` (fuera de los repos). En los comandos de abajo `RAW=/home/endurance/Projects/Endurance/dots/imagenes/mj`.
- Hoja de marca (sref): `dots/imagenes/e1a1cdcd-a522-4f4c-a935-da5ae282cf9f.png` (1536×1024). Hero de referencia (oref): `dots/imagenes/ChatGPT Image Jul 14, 2026, 03_20_41 PM.png` (1254×1254; el Doty grande saludando está en x≈95–885, y≈40–790).

---

## File structure

**Webapp (`dots-webapp/`)**

| Archivo | Responsabilidad |
|---|---|
| `scripts/mj/style.json` | Parámetros de Midjourney congelados en fase 0 (bloques de texto + flags). |
| `scripts/mj/batches/fase-0.json` | Matriz de prueba (15 piezas). |
| `scripts/mj/batches/fase-1.json` | Catálogo de 97 piezas. |
| `scripts/mj/mjlib.py` | Funciones puras: carga/validación de catálogo, prompts, registro, mapeo de descargas, operaciones de imagen, halo, informe. Sin rembg. |
| `scripts/mj/process.py` | CLI (`--emit-prompts`, `--emit-registry`, `--dry-run`, `--apply`). Importa rembg de forma perezosa solo en `--apply`. |
| `scripts/mj/tests/test_mjlib.py` | Tests de `mjlib`. |
| `scripts/mj/compose-icons.mjs` | Deriva iconos PWA + apple-icon desde el render del icono. |
| `scripts/mj/compose-splash.mjs` | Compone splash iOS. |
| `scripts/check-doty-assets.mjs` | Registro ↔ disco; `--strict` al final. |
| `components/ui/doty/poses.ts` | **Generado**. Registro + `toDotyPose`. |
| `components/ui/doty/doty.tsx` | Componente tipado, sombra CSS, `sizes`. |
| `components/ui/doty/doty-sticker.tsx` | Burbuja + frase + pose de sticker. |
| `app/globals.css` | Keyframes `doty-*` y `.doty-shadow`. |
| `components/play/games-grid-view.tsx` | Tiles PNG de los 12 juegos. |
| `public/images/Doty/<grupo>/<slug>.png`, `public/images/games/<key>.png`, `public/icons/*`, `public/splash/*`, `app/apple-icon.png`, `app/icon.png` | Assets. |
| `app/layout.tsx`, `app/manifest.ts`, `public/sw.js` | startupImage, screenshots, `SW_VERSION`. |
| `docs/brand/doty-identity.md`, `docs/ARQUITECTURA.md`, `CLAUDE.md` | Documentación. |

**Backend (`dots-backend/`)**

| Archivo | Responsabilidad |
|---|---|
| `scripts/set-doty-art.js` | Sube 3 personajes a Cloudinary, escribe `characters.img` y `difficulty.img`, respaldo y rollback. |
| `package.json` | script `doty:art`. |

**Interfaces compartidas (todas las tareas las respetan):**

Catálogo (`scripts/mj/batches/<fase>.json`):

```json
{
  "fase": "fase-1",
  "pieces": [
    {
      "slug": "feliz",
      "group": "expressions",
      "prefix": "Doty beaming with joy",
      "prompt": "standing upright, arms slightly open, big happy smile",
      "size": 1024,
      "oref": true,
      "fallback": "02",
      "done": false
    }
  ]
}
```

- `group` ∈ `REGISTRY_GROUPS = ("expressions","poses","states","celebrations","accessories","themed","stickers","icons")` o `EXTRA_GROUPS = ("games","characters","app-icon")`.
- `prefix` único, en inglés, sin comas: abre el prompt y es lo que Midjourney pone en el nombre del archivo descargado.
- `oref` `true` → el prompt lleva `--oref`; `false` para `icons` y `games`.
- `fallback` obligatorio (número legacy `"01"`…`"22"`) mientras `done` es `false` en un grupo de registro.
- Salida (`output_path`): registro → `public/images/Doty/<group>/<slug>.png`; `games` → `public/images/games/<slug>.png`; `characters` → `$RAW/<fase>/out/characters/<slug>.png`; `app-icon` → `$RAW/<fase>/out/app-icon.png`.
- Clave del registro (`registry_key`): `sticker-<slug>` si `group == "stickers"`, si no `slug`.

`style.json`:

```json
{
  "model": "7",
  "oref_file": "ref-hero.png",
  "ow": 300,
  "sref": "",
  "sw": 200,
  "stylize": 50,
  "aspect": "1:1",
  "negative": ["text", "watermark", "glasses", "shadow", "background objects"],
  "character": "Doty the mascot: a round hot-pink ball character with a spiky tuft of hair on top, big oval navy eyes with white highlights, wide navy smiling mouth, short stubby arms and legs, dark magenta shoes, no glasses",
  "style_block": "flat vector cartoon illustration, clean bold outlines, soft cel shading, full body centered, plain white background",
  "icon_block": "flat icon, thick rounded outline, brand palette #FF1F8F #1E1B5C #3768FF #35D8F5, centered, plain white background",
  "draft_supports_oref": null,
  "gpu_minutes": { "standard": null, "draft": null, "enhance": null }
}
```

Prompt resultante (`build_prompt`):
`<prefix>, <character>, <prompt>, <style_block> --ar <aspect> --stylize <stylize> [--oref <oref_file> --ow <ow>] [--sref <sref> --sw <sw>] --no <negative unidos por ", ">`. Para `oref: false` se usa `icon_block` en lugar de `character + style_block` y no se emite `--oref`. `--sref` solo si `sref` no está vacío.

---

### Task 1: Referencias de fase 0 y esqueleto de `scripts/mj/`

**Files:**
- Create: `scripts/mj/style.json`
- Create: `scripts/mj/batches/fase-0.json`
- Create: `$RAW/fase-0/ref-hero.png`, `$RAW/fase-0/ref-sheet.png`, `$RAW/fase-0/log.md` (fuera del repo)

**Interfaces:**
- Produces: `style.json` con la forma de arriba (valores iniciales); `fase-0.json` con 15 piezas de prueba en grupo `poses`/`expressions`.

- [ ] **Step 1: Crear carpetas y recortar el hero de referencia**

```bash
RAW=/home/endurance/Projects/Endurance/dots/imagenes/mj
mkdir -p "$RAW/fase-0"
SRC="/home/endurance/Projects/Endurance/dots/imagenes/ChatGPT Image Jul 14, 2026, 03_20_41 PM.png"
# Hero sin la elipse de sombra (termina en y≈790) y con los trazos decorativos tapados en blanco.
magick "$SRC" -crop 790x750+95+40 +repage \
  -fill white -draw "rectangle 0,210 40,320" -draw "rectangle 585,40 715,130" -draw "rectangle 655,455 745,570" \
  -fuzz 4% -trim +repage -bordercolor white -border 40 "$RAW/fase-0/ref-hero.png"
cp "/home/endurance/Projects/Endurance/dots/imagenes/e1a1cdcd-a522-4f4c-a935-da5ae282cf9f.png" "$RAW/fase-0/ref-sheet.png"
magick identify "$RAW/fase-0/ref-hero.png"
```

- [ ] **Step 2: Mirar `ref-hero.png` con la herramienta Read**

Debe verse solo el Doty grande saludando, sin sombra ni trazos. Si queda un trazo, ajustar el rectángulo correspondiente (coordenadas relativas al recorte, es decir, restando 95 en x y 40 en y respecto a la imagen original) y repetir el Step 1.

- [ ] **Step 3: Escribir `scripts/mj/style.json`**

Contenido exacto: el JSON de "Interfaces compartidas" (`sref` vacío, `draft_supports_oref` y `gpu_minutes.*` en `null`).

- [ ] **Step 4: Escribir `scripts/mj/batches/fase-0.json`**

```json
{
  "fase": "fase-0",
  "pieces": [
    { "slug": "t01-saludando-ow100", "group": "poses", "prefix": "Test one Doty waving hello", "prompt": "waving one hand, friendly smile", "size": 1024, "oref": true, "ow": 100, "fallback": "01", "done": false },
    { "slug": "t02-saludando-ow300", "group": "poses", "prefix": "Test two Doty waving hello", "prompt": "waving one hand, friendly smile", "size": 1024, "oref": true, "ow": 300, "fallback": "01", "done": false },
    { "slug": "t03-saludando-v7-ow100", "group": "poses", "prefix": "Test three Doty waving hello", "prompt": "waving one hand, friendly smile", "size": 1024, "oref": true, "ow": 100, "model": "7", "fallback": "01", "done": false },
    { "slug": "t04-saludando-v7-ow300", "group": "poses", "prefix": "Test four Doty waving hello", "prompt": "waving one hand, friendly smile", "size": 1024, "oref": true, "ow": 300, "model": "7", "fallback": "01", "done": false },
    { "slug": "t05-pensando-ow100", "group": "expressions", "prefix": "Test five Doty thinking hard", "prompt": "one hand on chin, eyes looking up, puzzled", "size": 1024, "oref": true, "ow": 100, "fallback": "07", "done": false },
    { "slug": "t06-pensando-ow300", "group": "expressions", "prefix": "Test six Doty thinking hard", "prompt": "one hand on chin, eyes looking up, puzzled", "size": 1024, "oref": true, "ow": 300, "fallback": "07", "done": false },
    { "slug": "t07-pensando-v7-ow100", "group": "expressions", "prefix": "Test seven Doty thinking hard", "prompt": "one hand on chin, eyes looking up, puzzled", "size": 1024, "oref": true, "ow": 100, "model": "7", "fallback": "07", "done": false },
    { "slug": "t08-pensando-v7-ow300", "group": "expressions", "prefix": "Test eight Doty thinking hard", "prompt": "one hand on chin, eyes looking up, puzzled", "size": 1024, "oref": true, "ow": 300, "model": "7", "fallback": "07", "done": false },
    { "slug": "t09-triste-ow100", "group": "expressions", "prefix": "Test nine Doty feeling sad", "prompt": "slumped shoulders, downturned mouth, teary eyes", "size": 1024, "oref": true, "ow": 100, "fallback": "05", "done": false },
    { "slug": "t10-triste-ow300", "group": "expressions", "prefix": "Test ten Doty feeling sad", "prompt": "slumped shoulders, downturned mouth, teary eyes", "size": 1024, "oref": true, "ow": 300, "fallback": "05", "done": false },
    { "slug": "t11-triste-v7-ow100", "group": "expressions", "prefix": "Test eleven Doty feeling sad", "prompt": "slumped shoulders, downturned mouth, teary eyes", "size": 1024, "oref": true, "ow": 100, "model": "7", "fallback": "05", "done": false },
    { "slug": "t12-triste-v7-ow300", "group": "expressions", "prefix": "Test twelve Doty feeling sad", "prompt": "slumped shoulders, downturned mouth, teary eyes", "size": 1024, "oref": true, "ow": 300, "model": "7", "fallback": "05", "done": false },
    { "slug": "t13-draft-saludando", "group": "poses", "prefix": "Test thirteen draft Doty waving", "prompt": "waving one hand, friendly smile (RUN IN DRAFT MODE)", "size": 1024, "oref": true, "ow": 300, "fallback": "01", "done": false },
    { "slug": "t14-draft-pensando", "group": "expressions", "prefix": "Test fourteen draft Doty thinking", "prompt": "one hand on chin, eyes looking up (RUN IN DRAFT MODE)", "size": 1024, "oref": true, "ow": 300, "fallback": "07", "done": false },
    { "slug": "t15-sref-only-saludando", "group": "poses", "prefix": "Test fifteen sref only Doty waving", "prompt": "waving one hand, friendly smile", "size": 1024, "oref": false, "sref_only": true, "fallback": "01", "done": false }
  ]
}
```

Los campos opcionales `ow`, `model` y `sref_only` por pieza sobreescriben `style.json` solo en esa pieza (Task 3 los implementa). `t15` usa `character + style_block` **sin** `--oref` (no es un icono): por eso lleva `sref_only`.

- [ ] **Step 5: Plantilla del log**

Escribir `$RAW/fase-0/log.md`:

```markdown
# Fase 0 — log
| # | slug | modo | GPU min | aciertos/4 | notas |
|---|---|---|---|---|---|
```

- [ ] **Step 6: Commit**

```bash
git add scripts/mj/style.json scripts/mj/batches/fase-0.json
git commit -m "chore(mj): estilo inicial y matriz de prueba de fase 0"
```

---

### Task 2: `mjlib.py` — carga y validación del catálogo

**Files:**
- Create: `scripts/mj/mjlib.py`
- Create: `scripts/mj/tests/__init__.py` (vacío), `scripts/mj/tests/test_mjlib.py`

**Interfaces:**
- Produces: `REGISTRY_GROUPS`, `EXTRA_GROUPS`, `class CatalogError(ValueError)`, `load_catalog(path: Path) -> dict`, `validate_catalog(cat: dict) -> None`, `load_style(path: Path) -> dict`, `registry_key(piece) -> str`, `output_path(piece, fase: str, repo_root: Path, raw_root: Path) -> Path`.

- [ ] **Step 1: Test que falla**

```python
# scripts/mj/tests/test_mjlib.py
import json
from pathlib import Path
import pytest
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

def piece(**over):
    base = {"slug": "feliz", "group": "expressions", "prefix": "Doty beaming with joy",
            "prompt": "big smile", "size": 1024, "oref": True, "fallback": "02", "done": False}
    base.update(over)
    return base

def write(tmp_path, name, data):
    p = tmp_path / name
    p.write_text(json.dumps(data), encoding="utf-8")
    return p

def test_load_catalog_ok(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "fase-1", "pieces": [piece()]})
    cat = mjlib.load_catalog(p)
    assert cat["pieces"][0]["slug"] == "feliz"

def test_duplicate_slug_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(), piece(prefix="Other words")]})
    with pytest.raises(mjlib.CatalogError, match="slug"):
        mjlib.load_catalog(p)

def test_duplicate_prefix_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(), piece(slug="otro")]})
    with pytest.raises(mjlib.CatalogError, match="prefix"):
        mjlib.load_catalog(p)

def test_bad_group_rejected(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(group="nope")]})
    with pytest.raises(mjlib.CatalogError, match="group"):
        mjlib.load_catalog(p)

def test_registry_piece_needs_fallback_until_done(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(fallback=None)]})
    with pytest.raises(mjlib.CatalogError, match="fallback"):
        mjlib.load_catalog(p)
    p2 = write(tmp_path, "d.json", {"fase": "x", "pieces": [piece(fallback=None, done=True)]})
    mjlib.load_catalog(p2)  # no raise

def test_extra_group_needs_no_fallback(tmp_path):
    p = write(tmp_path, "c.json", {"fase": "x", "pieces": [piece(group="games", slug="wordle", oref=False, fallback=None)]})
    mjlib.load_catalog(p)

def test_registry_key_prefixes_stickers():
    assert mjlib.registry_key(piece(group="stickers", slug="good-job")) == "sticker-good-job"
    assert mjlib.registry_key(piece()) == "feliz"

def test_output_path_per_group(tmp_path):
    repo, raw = tmp_path / "repo", tmp_path / "raw"
    assert mjlib.output_path(piece(), "fase-1", repo, raw) == repo / "public/images/Doty/expressions/feliz.png"
    assert mjlib.output_path(piece(group="games", slug="wordle"), "fase-1", repo, raw) == repo / "public/images/games/wordle.png"
    assert mjlib.output_path(piece(group="characters", slug="doty-fem"), "fase-1", repo, raw) == raw / "fase-1/out/characters/doty-fem.png"
    assert mjlib.output_path(piece(group="app-icon", slug="app-icon"), "fase-1", repo, raw) == raw / "fase-1/out/app-icon.png"
```

- [ ] **Step 2: Ejecutar y ver el fallo**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-webapp
touch scripts/mj/tests/__init__.py
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Expected: `ModuleNotFoundError: No module named 'mjlib'`.

- [ ] **Step 3: Implementación mínima**

```python
# scripts/mj/mjlib.py
"""Funciones puras del pipeline de arte de Doty. Sin rembg aquí: lo importa process.py."""
from __future__ import annotations
import json
import re
from pathlib import Path

REGISTRY_GROUPS = ("expressions", "poses", "states", "celebrations", "accessories", "themed", "stickers", "icons")
EXTRA_GROUPS = ("games", "characters", "app-icon")
LEGACY_RE = re.compile(r"^(0[1-9]|1[0-9]|2[0-2])$")


class CatalogError(ValueError):
    pass


def load_style(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_catalog(path: Path) -> dict:
    cat = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_catalog(cat)
    return cat


def validate_catalog(cat: dict) -> None:
    if not isinstance(cat.get("fase"), str) or not isinstance(cat.get("pieces"), list):
        raise CatalogError("catalog needs 'fase' (str) and 'pieces' (list)")
    slugs, prefixes = set(), set()
    for p in cat["pieces"]:
        slug = p.get("slug")
        if not slug or slug in slugs:
            raise CatalogError(f"duplicate or missing slug: {slug!r}")
        slugs.add(slug)
        prefix = p.get("prefix")
        if not prefix or prefix in prefixes:
            raise CatalogError(f"duplicate or missing prefix for {slug!r}: {prefix!r}")
        prefixes.add(prefix)
        group = p.get("group")
        if group not in REGISTRY_GROUPS + EXTRA_GROUPS:
            raise CatalogError(f"{slug}: invalid group {group!r}")
        if not isinstance(p.get("size"), int) or p["size"] <= 0:
            raise CatalogError(f"{slug}: size must be a positive int")
        if not isinstance(p.get("done"), bool):
            raise CatalogError(f"{slug}: done must be bool")
        fb = p.get("fallback")
        if group in REGISTRY_GROUPS and not p["done"]:
            if not (isinstance(fb, str) and LEGACY_RE.match(fb)):
                raise CatalogError(f"{slug}: fallback ('01'..'22') required while done=false")


def registry_key(piece: dict) -> str:
    return f"sticker-{piece['slug']}" if piece["group"] == "stickers" else piece["slug"]


def output_path(piece: dict, fase: str, repo_root: Path, raw_root: Path) -> Path:
    g, s = piece["group"], piece["slug"]
    if g in REGISTRY_GROUPS:
        return Path(repo_root) / "public/images/Doty" / g / f"{s}.png"
    if g == "games":
        return Path(repo_root) / "public/images/games" / f"{s}.png"
    if g == "characters":
        return Path(raw_root) / fase / "out/characters" / f"{s}.png"
    return Path(raw_root) / fase / "out/app-icon.png"
```

- [ ] **Step 4: Ejecutar tests**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Expected: `8 passed`.

- [ ] **Step 5: Validar los catálogos reales y commitear**

```bash
uv run --python 3.12 python -c "import sys; sys.path.insert(0,'scripts/mj'); import mjlib; mjlib.load_catalog('scripts/mj/batches/fase-0.json'); print('fase-0 ok')"
git add scripts/mj/mjlib.py scripts/mj/tests
git commit -m "feat(mj): carga y validación del catálogo de piezas"
```

---

### Task 3: Emisión de prompts (`build_prompt`, `emit_prompts`) y CLI `--emit-prompts`

**Files:**
- Modify: `scripts/mj/mjlib.py`
- Create: `scripts/mj/process.py`
- Test: `scripts/mj/tests/test_mjlib.py`

**Interfaces:**
- Consumes: `load_catalog`, `load_style` (Task 2).
- Produces: `build_prompt(piece: dict, style: dict) -> str`, `emit_prompts(cat: dict, style: dict) -> str`; CLI `uv run scripts/mj/process.py --emit-prompts <fase> --raw $RAW` que escribe `$RAW/<fase>/PROMPTS.md`.

- [ ] **Step 1: Tests que fallan (añadir al final de `test_mjlib.py`)**

```python
STYLE = {"model": "7", "oref_file": "ref-hero.png", "ow": 300, "sref": "", "sw": 200, "stylize": 50,
         "aspect": "1:1", "negative": ["text", "shadow"],
         "character": "Doty the mascot: round pink ball", "style_block": "flat vector, white background",
         "icon_block": "flat icon, brand palette"}

def test_build_prompt_with_oref():
    out = mjlib.build_prompt(piece(), STYLE)
    assert out.startswith("Doty beaming with joy, Doty the mascot: round pink ball, big smile, flat vector, white background")
    assert "--ar 1:1 --stylize 50 --oref ref-hero.png --ow 300" in out
    assert out.endswith("--no text, shadow")
    assert "--sref" not in out

def test_build_prompt_icon_without_oref():
    out = mjlib.build_prompt(piece(group="icons", slug="correcto", oref=False, prompt="green check mark"), STYLE)
    assert out.startswith("Doty beaming with joy, green check mark, flat icon, brand palette")
    assert "--oref" not in out and "Doty the mascot" not in out

def test_build_prompt_sref_and_overrides():
    style = dict(STYLE, sref="abc123")
    out = mjlib.build_prompt(piece(ow=100, model="7"), style)
    assert "--sref abc123 --sw 200" in out and "--ow 100" in out and "--v 7" in out

def test_build_prompt_sref_only_uses_character_block():
    out = mjlib.build_prompt(piece(oref=False, sref_only=True), dict(STYLE, sref="abc123"))
    assert "Doty the mascot" in out and "--oref" not in out and "--sref abc123" in out

def test_emit_prompts_is_numbered_markdown():
    cat = {"fase": "fase-1", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad", fallback="05")]}
    md = mjlib.emit_prompts(cat, STYLE)
    assert md.splitlines()[0] == "# fase-1 — prompts"
    assert "1. `feliz` → `expressions/feliz.png`" in md and "2. `triste`" in md
    assert md.count("```") == 4  # un bloque de código por prompt
```

- [ ] **Step 2: Ejecutar y ver el fallo**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Expected: 5 fallos con `AttributeError: module 'mjlib' has no attribute 'build_prompt'`.

- [ ] **Step 3: Implementar en `mjlib.py`**

```python
def build_prompt(piece: dict, style: dict) -> str:
    use_oref = bool(piece.get("oref"))
    mascot = use_oref or bool(piece.get("sref_only"))
    body = [piece["prefix"]]
    if mascot:
        body += [style["character"], piece["prompt"], style["style_block"]]
    else:
        body += [piece["prompt"], style["icon_block"]]
    flags = [f"--ar {style['aspect']}", f"--stylize {style['stylize']}"]
    model = piece.get("model")
    if model:
        flags.append(f"--v {model}")
    if use_oref:
        flags.append(f"--oref {style['oref_file']} --ow {piece.get('ow', style['ow'])}")
    if style.get("sref"):
        flags.append(f"--sref {style['sref']} --sw {style['sw']}")
    flags.append("--no " + ", ".join(style["negative"]))
    return ", ".join(body) + " " + " ".join(flags)


def emit_prompts(cat: dict, style: dict) -> str:
    lines = [f"# {cat['fase']} — prompts", "",
             "Pega cada prompt tal cual. En la web, arrastra `ref-hero.png` al slot de Omni Reference "
             "cuando el prompt lleve `--oref`, y la hoja/código al de Style Reference cuando lleve `--sref`.",
             "Descarga la imagen elegida a la carpeta de este lote sin renombrarla.", ""]
    for i, p in enumerate(cat["pieces"], 1):
        target = f"{p['group']}/{p['slug']}.png"
        status = " ✅" if p.get("done") else ""
        lines += [f"{i}. `{p['slug']}` → `{target}`{status}", "", "```", build_prompt(p, style), "```", ""]
    return "\n".join(lines)
```

- [ ] **Step 4: Crear `scripts/mj/process.py` con `--emit-prompts`**

```python
# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["rembg[gpu]>=2.0.60", "pillow>=10"]
# ///
"""Pipeline de arte de Doty. Ver docs/superpowers/specs/2026-09-07-doty-midjourney-assets-design.md §5.

  uv run scripts/mj/process.py --emit-prompts fase-1 --raw $RAW
  uv run scripts/mj/process.py --emit-registry fase-1
  uv run scripts/mj/process.py --dry-run fase-1 --raw $RAW
  uv run scripts/mj/process.py --apply fase-1 --raw $RAW [--pick slug=archivo.png ...] [--force]

Si onnxruntime-gpu no instala en tu equipo, cambia "rembg[gpu]" por "rembg[cpu]" arriba: el
resultado es idéntico, solo más lento.
"""
from __future__ import annotations
import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))
import mjlib  # noqa: E402


def batch_path(fase: str) -> Path:
    return HERE / "batches" / f"{fase}.json"


def cmd_emit_prompts(fase: str, raw: Path) -> None:
    cat = mjlib.load_catalog(batch_path(fase))
    style = mjlib.load_style(HERE / "style.json")
    out_dir = raw / fase
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / "PROMPTS.md"
    out.write_text(mjlib.emit_prompts(cat, style), encoding="utf-8")
    print(f"{len(cat['pieces'])} prompts → {out}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--emit-prompts", metavar="FASE")
    g.add_argument("--emit-registry", metavar="FASE")
    g.add_argument("--dry-run", metavar="FASE")
    g.add_argument("--apply", metavar="FASE")
    ap.add_argument("--raw", type=Path, help="carpeta raíz de descargas (dots/imagenes/mj)")
    ap.add_argument("--pick", action="append", default=[], metavar="SLUG=ARCHIVO")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args(argv)
    if a.emit_prompts:
        if not a.raw:
            ap.error("--emit-prompts requiere --raw")
        cmd_emit_prompts(a.emit_prompts, a.raw)
        return 0
    ap.error("subcomando aún no implementado")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: Tests en verde y prueba manual**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
RAW=/home/endurance/Projects/Endurance/dots/imagenes/mj
uv run --python 3.12 scripts/mj/process.py --emit-prompts fase-0 --raw "$RAW" && head -20 "$RAW/fase-0/PROMPTS.md"
```
Expected: `13 passed`; el archivo muestra el prompt 1 completo con `--oref ref-hero.png --ow 100`. (La primera ejecución de `uv run` descarga rembg y onnxruntime; puede tardar minutos.)

- [ ] **Step 6: Commit**

```bash
git add scripts/mj/mjlib.py scripts/mj/process.py scripts/mj/tests/test_mjlib.py
git commit -m "feat(mj): emisión de prompts desde el catálogo"
```

---

### Task 4: Emisión del registro `poses.ts` (`emit_registry`) y CLI `--emit-registry`

**Files:**
- Modify: `scripts/mj/mjlib.py`, `scripts/mj/process.py`
- Test: `scripts/mj/tests/test_mjlib.py`

**Interfaces:**
- Produces: `registry_src(piece) -> str`, `emit_registry(cat: dict) -> str` (fuente TS completa); CLI `--emit-registry <fase>` escribe `components/ui/doty/poses.ts`.
- El TS emitido exporta: `DotyGroup`, `PoseEntry`, `POSES`, `DotyPose`, `FALLBACK_POSE`, `isDotyPose(v: unknown): v is DotyPose`, `toDotyPose(v: string | null | undefined): DotyPose`.

- [ ] **Step 1: Tests que fallan**

```python
def test_registry_src_uses_fallback_until_done():
    assert mjlib.registry_src(piece()) == "/images/Doty/DOTTY-POSES-02.png"
    assert mjlib.registry_src(piece(done=True)) == "/images/Doty/expressions/feliz.png"

def test_emit_registry_shape():
    cat = {"fase": "fase-1", "pieces": [
        piece(done=True),
        piece(group="stickers", slug="good-job", prefix="Doty thumbs up wink", fallback="02"),
        piece(group="games", slug="wordle", prefix="Green letter tiles", oref=False, fallback=None),
    ]}
    ts = mjlib.emit_registry(cat)
    assert ts.startswith("// GENERADO por scripts/mj/process.py --emit-registry")
    assert '  feliz: { src: "/images/Doty/expressions/feliz.png", group: "expressions" },' in ts
    assert '  "sticker-good-job": { src: "/images/Doty/DOTTY-POSES-02.png", group: "stickers" },' in ts
    assert "wordle" not in ts
    assert 'export const FALLBACK_POSE: DotyPose = "feliz";' in ts
    assert "export function toDotyPose(" in ts

def test_emit_registry_requires_feliz():
    with pytest.raises(mjlib.CatalogError, match="feliz"):
        mjlib.emit_registry({"fase": "x", "pieces": [piece(slug="triste", prefix="Doty sad", fallback="05")]})
```

- [ ] **Step 2: Ver el fallo**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Expected: 3 fallos por atributo inexistente.

- [ ] **Step 3: Implementar**

```python
def registry_src(piece: dict) -> str:
    if piece.get("done"):
        return f"/images/Doty/{piece['group']}/{piece['slug']}.png"
    return f"/images/Doty/DOTTY-POSES-{piece['fallback']}.png"


def _ts_key(key: str) -> str:
    return key if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) else f'"{key}"'


def emit_registry(cat: dict) -> str:
    pieces = [p for p in cat["pieces"] if p["group"] in REGISTRY_GROUPS]
    if not any(p["slug"] == "feliz" for p in pieces):
        raise CatalogError("registry needs a 'feliz' piece (FALLBACK_POSE)")
    groups = " | ".join(f'"{g}"' for g in REGISTRY_GROUPS)
    rows = "\n".join(
        f'  {_ts_key(registry_key(p))}: {{ src: "{registry_src(p)}", group: "{p["group"]}" }},' for p in pieces
    )
    return f'''// GENERADO por scripts/mj/process.py --emit-registry — no editar a mano.
// Fuente: scripts/mj/batches/{cat["fase"]}.json. Reglas de uso: docs/brand/doty-identity.md
export type DotyGroup = {groups};
export type PoseEntry = {{ src: string; group: DotyGroup }};

export const POSES = {{
{rows}
}} as const satisfies Record<string, PoseEntry>;

export type DotyPose = keyof typeof POSES;
export const FALLBACK_POSE: DotyPose = "feliz";

export function isDotyPose(v: unknown): v is DotyPose {{
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(POSES, v);
}}

/** Strings dinámicos (BD, params) → pose válida o la cara amable por defecto. */
export function toDotyPose(v: string | null | undefined): DotyPose {{
  return isDotyPose(v) ? v : FALLBACK_POSE;
}}
'''
```

Y en `process.py`, antes de `ap.error("subcomando aún no implementado")`:

```python
    if a.emit_registry:
        cat = mjlib.load_catalog(batch_path(a.emit_registry))
        out = REPO / "components/ui/doty/poses.ts"
        out.write_text(mjlib.emit_registry(cat), encoding="utf-8")
        print(f"registro → {out}")
        return 0
```

- [ ] **Step 4: Tests en verde**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Expected: `16 passed`. **No ejecutar aún `--emit-registry`** contra el repo: el catálogo de fase 1 llega en Task 8 y el componente en Task 10.

- [ ] **Step 5: Commit**

```bash
git add scripts/mj/mjlib.py scripts/mj/process.py scripts/mj/tests/test_mjlib.py
git commit -m "feat(mj): emisión del registro poses.ts con fallback legacy"
```

---

### Task 5: Mapeo de descargas (`match_downloads`) y CLI `--dry-run`

**Files:**
- Modify: `scripts/mj/mjlib.py`, `scripts/mj/process.py`
- Test: `scripts/mj/tests/test_mjlib.py`

**Interfaces:**
- Produces: `normalize(s: str) -> str`, `match_downloads(cat: dict, filenames: list[str]) -> dict[str, list[str]]` (slug → archivos candidatos, ordenados), `render_dry_run(cat, matches) -> str`; CLI `--dry-run <fase> --raw $RAW` imprime el informe y sale 0.

- [ ] **Step 1: Tests que fallan**

```python
def test_normalize_collapses_separators():
    assert mjlib.normalize("sergio_Doty_beaming_with_joy_3f2a.png") == "sergio doty beaming with joy 3f2a png"
    assert mjlib.normalize("Doty beaming with joy") == "doty beaming with joy"

def test_match_downloads_by_prefix():
    cat = {"fase": "x", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad", fallback="05")]}
    files = ["sergio_Doty_beaming_with_joy_aaaa.png", "sergio_Doty_beaming_with_joy_bbbb.png",
             "sergio_Doty_feeling_sad_cccc.png", "random.png", "PROMPTS.md"]
    m = mjlib.match_downloads(cat, files)
    assert m["feliz"] == ["sergio_Doty_beaming_with_joy_aaaa.png", "sergio_Doty_beaming_with_joy_bbbb.png"]
    assert m["triste"] == ["sergio_Doty_feeling_sad_cccc.png"]

def test_render_dry_run_lists_states():
    cat = {"fase": "x", "pieces": [piece(), piece(slug="triste", prefix="Doty feeling sad", fallback="05"),
                                   piece(slug="wow", prefix="Doty amazed", fallback="06")]}
    m = {"feliz": ["a.png", "b.png"], "triste": ["c.png"], "wow": []}
    txt = mjlib.render_dry_run(cat, m)
    assert "OK       triste ← c.png" in txt
    assert "AMBIGUO  feliz ← a.png | b.png" in txt
    assert "FALTA    wow" in txt
```

- [ ] **Step 2: Ver el fallo** (mismo comando; 3 fallos).

- [ ] **Step 3: Implementar**

```python
def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def match_downloads(cat: dict, filenames: list[str]) -> dict[str, list[str]]:
    pngs = sorted(f for f in filenames if f.lower().endswith(".png"))
    out: dict[str, list[str]] = {}
    for p in cat["pieces"]:
        key = normalize(p["prefix"])
        out[p["slug"]] = [f for f in pngs if key in normalize(f)]
    return out


def render_dry_run(cat: dict, matches: dict[str, list[str]]) -> str:
    lines = []
    for p in cat["pieces"]:
        files = matches.get(p["slug"], [])
        if p.get("done"):
            lines.append(f"HECHO    {p['slug']}")
        elif len(files) == 1:
            lines.append(f"OK       {p['slug']} ← {files[0]}")
        elif files:
            lines.append(f"AMBIGUO  {p['slug']} ← {' | '.join(files)}")
        else:
            lines.append(f"FALTA    {p['slug']}")
    return "\n".join(lines)
```

En `process.py`:

```python
def cmd_dry_run(fase: str, raw: Path) -> int:
    cat = mjlib.load_catalog(batch_path(fase))
    files = [f.name for f in (raw / fase).iterdir() if f.is_file()] if (raw / fase).exists() else []
    print(mjlib.render_dry_run(cat, mjlib.match_downloads(cat, files)))
    return 0
```
y en `main`: `if a.dry_run: return cmd_dry_run(a.dry_run, a.raw)` (con `ap.error` si falta `--raw`).

- [ ] **Step 4: Verde + prueba manual + commit**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
uv run --python 3.12 scripts/mj/process.py --dry-run fase-0 --raw "$RAW"
git add scripts/mj && git commit -m "feat(mj): dry-run que mapea descargas a piezas por prefijo"
```
Expected: `19 passed`; el dry-run lista 15 `FALTA`.

---

### Task 6: Operaciones de imagen (`trim_square_resize`, `halo_ratio`)

**Files:**
- Modify: `scripts/mj/mjlib.py`
- Test: `scripts/mj/tests/test_mjlib.py`

**Interfaces:**
- Produces: `trim_square_resize(img: PIL.Image.Image, size: int, margin: float = 0.04) -> PIL.Image.Image` (RGBA, `size×size`, contenido centrado con margen), `halo_ratio(img) -> float` (fracción de píxeles de borde semitransparentes que son rosados).

- [ ] **Step 1: Tests que fallan**

```python
from PIL import Image

def blob(w=200, h=200, box=(50, 80, 150, 120), color=(255, 31, 143, 255)):
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for x in range(box[0], box[2]):
        for y in range(box[1], box[3]):
            im.putpixel((x, y), color)
    return im

def test_trim_square_resize_centers_and_sizes():
    out = mjlib.trim_square_resize(blob(), 128, margin=0.0)
    assert out.size == (128, 128) and out.mode == "RGBA"
    bbox = out.getbbox()  # el contenido ocupa todo el ancho y queda centrado en vertical
    assert bbox[0] == 0 and bbox[2] == 128
    assert abs((bbox[1] + bbox[3]) / 2 - 64) <= 1

def test_trim_square_resize_applies_margin():
    out = mjlib.trim_square_resize(blob(), 100, margin=0.10)
    bbox = out.getbbox()
    assert 9 <= bbox[0] <= 11 and 89 <= bbox[2] <= 91

def test_trim_square_resize_empty_image_raises():
    with pytest.raises(ValueError, match="empty"):
        mjlib.trim_square_resize(Image.new("RGBA", (10, 10), (0, 0, 0, 0)), 64)

def test_halo_ratio_detects_pink_fringe():
    clean = blob()
    assert mjlib.halo_ratio(clean) == 0.0
    fringe = blob()
    for x in range(50, 150):
        fringe.putpixel((x, 80), (255, 60, 150, 120))  # borde semitransparente rosado
    assert mjlib.halo_ratio(fringe) == 1.0
    grey = blob()
    for x in range(50, 150):
        grey.putpixel((x, 80), (120, 120, 120, 120))
    assert mjlib.halo_ratio(grey) == 0.0
```

- [ ] **Step 2: Ver el fallo** (4 fallos por atributo inexistente).

- [ ] **Step 3: Implementar**

```python
from PIL import Image  # al inicio de mjlib.py


def trim_square_resize(img: "Image.Image", size: int, margin: float = 0.04) -> "Image.Image":
    img = img.convert("RGBA")
    bbox = img.getbbox()
    if bbox is None:
        raise ValueError("empty image (fully transparent)")
    content = img.crop(bbox)
    w, h = content.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(content, ((side - w) // 2, (side - h) // 2))
    inner = max(1, round(size * (1 - 2 * margin)))
    scaled = canvas.resize((inner, inner), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(scaled, ((size - inner) // 2, (size - inner) // 2))
    return out


def halo_ratio(img: "Image.Image") -> float:
    """Entre los píxeles de borde (alfa 1..254), fracción que es rosada (r>180, g<120)."""
    px = img.convert("RGBA").getdata()
    edge = [(r, g, b) for r, g, b, a in px if 0 < a < 255]
    if not edge:
        return 0.0
    pink = sum(1 for r, g, _ in edge if r > 180 and g < 120)
    return pink / len(edge)
```

- [ ] **Step 4: Verde + commit**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
git add scripts/mj && git commit -m "feat(mj): recorte, centrado, redimensión y detección de halo"
```
Expected: `23 passed`.

---

### Task 7: `--apply`: rembg inyectable, escritura, `done`, `REPORT.md`

**Files:**
- Modify: `scripts/mj/mjlib.py`, `scripts/mj/process.py`
- Test: `scripts/mj/tests/test_mjlib.py`

**Interfaces:**
- Produces: `apply_batch(cat: dict, catalog_path: Path, raw_root: Path, repo_root: Path, remover: Callable[[Image], Image], picks: dict[str, str] | None = None, force: bool = False) -> dict` (report con `done`, `skipped`, `missing`, `ambiguous`, `halo`), `render_report(report: dict) -> str`, `save_catalog(cat, path)`; CLI `--apply <fase> --raw $RAW [--pick slug=archivo] [--force]` que escribe `$RAW/<fase>/REPORT.md`.
- `remover` recibe la imagen cruda RGBA sobre fondo blanco y devuelve RGBA con fondo transparente. En producción es `rembg.remove` con `alpha_matting=True`; en tests, una lambda.

- [ ] **Step 1: Tests que fallan**

```python
def fake_remover(im):
    # vuelve transparente todo píxel blanco puro
    im = im.convert("RGBA")
    data = [(0, 0, 0, 0) if (r, g, b) == (255, 255, 255) else (r, g, b, a) for r, g, b, a in im.getdata()]
    out = Image.new("RGBA", im.size)
    out.putdata(data)
    return out

def raw_png(dirpath, name):
    im = Image.new("RGBA", (300, 300), (255, 255, 255, 255))
    for x in range(100, 200):
        for y in range(120, 180):
            im.putpixel((x, y), (255, 31, 143, 255))
    im.save(dirpath / name)

def test_apply_writes_marks_done_and_reports(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_beaming_with_joy_aaaa.png")
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_c1.png")
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_c2.png")
    cat = {"fase": "fase-1", "pieces": [
        piece(size=64),
        piece(slug="triste", prefix="Doty feeling sad", fallback="05", size=64),
        piece(slug="wow", prefix="Doty amazed", fallback="06", size=64),
    ]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover)
    out = repo / "public/images/Doty/expressions/feliz.png"
    assert out.exists() and Image.open(out).size == (64, 64)
    assert rep["done"] == ["feliz"] and rep["ambiguous"] == ["triste"] and rep["missing"] == ["wow"]
    saved = json.loads(cpath.read_text())
    assert saved["pieces"][0]["done"] is True and saved["pieces"][1]["done"] is False

def test_apply_pick_resolves_ambiguity_and_skips_existing(tmp_path):
    raw, repo = tmp_path / "raw", tmp_path / "repo"
    (raw / "fase-1").mkdir(parents=True)
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_c1.png")
    raw_png(raw / "fase-1", "sergio_Doty_feeling_sad_c2.png")
    cat = {"fase": "fase-1", "pieces": [piece(slug="triste", prefix="Doty feeling sad", fallback="05", size=64), piece(done=True)]}
    cpath = write(tmp_path, "fase-1.json", cat)
    rep = mjlib.apply_batch(cat, cpath, raw, repo, fake_remover, picks={"triste": "sergio_Doty_feeling_sad_c2.png"})
    assert rep["done"] == ["triste"] and rep["skipped"] == ["feliz"]
    rep2 = mjlib.apply_batch(mjlib.load_catalog(cpath), cpath, raw, repo, fake_remover)
    assert rep2["skipped"] == ["triste", "feliz"] and rep2["done"] == []

def test_render_report_sections():
    txt = mjlib.render_report({"fase": "fase-1", "done": ["feliz"], "skipped": [], "missing": ["wow"],
                               "ambiguous": ["triste"], "halo": [("feliz", 0.05)]})
    assert "# fase-1 — REPORT" in txt and "## Hechas (1)" in txt and "- wow" in txt
    assert "feliz (5.0%)" in txt
```

- [ ] **Step 2: Ver el fallo** (3 fallos).

- [ ] **Step 3: Implementar en `mjlib.py`**

```python
from typing import Callable

HALO_THRESHOLD = 0.02


def save_catalog(cat: dict, path: Path) -> None:
    Path(path).write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def apply_batch(cat: dict, catalog_path: Path, raw_root: Path, repo_root: Path,
                remover: Callable[["Image.Image"], "Image.Image"],
                picks: dict[str, str] | None = None, force: bool = False) -> dict:
    picks = picks or {}
    fase = cat["fase"]
    raw_dir = Path(raw_root) / fase
    files = [f.name for f in raw_dir.iterdir() if f.is_file()] if raw_dir.exists() else []
    matches = match_downloads(cat, files)
    rep = {"fase": fase, "done": [], "skipped": [], "missing": [], "ambiguous": [], "halo": []}
    for p in cat["pieces"]:
        slug = p["slug"]
        target = output_path(p, fase, repo_root, raw_root)
        if p.get("done") and target.exists() and not force:
            rep["skipped"].append(slug)
            continue
        chosen = picks.get(slug)
        cands = matches.get(slug, [])
        if not chosen:
            if len(cands) == 1:
                chosen = cands[0]
            elif cands:
                rep["ambiguous"].append(slug)
                continue
            else:
                rep["missing"].append(slug)
                continue
        src = Image.open(raw_dir / chosen).convert("RGBA")
        cut = remover(src)
        out = trim_square_resize(cut, p["size"])
        target.parent.mkdir(parents=True, exist_ok=True)
        out.save(target, optimize=True)
        ratio = halo_ratio(out)
        if ratio > HALO_THRESHOLD:
            rep["halo"].append((slug, ratio))
        p["done"] = True
        p["source_file"] = chosen
        rep["done"].append(slug)
        save_catalog(cat, catalog_path)
    return rep


def render_report(rep: dict) -> str:
    def section(title, items):
        return [f"## {title} ({len(items)})", *[f"- {i}" for i in items], ""]
    lines = [f"# {rep['fase']} — REPORT", ""]
    lines += section("Hechas", rep["done"])
    lines += section("Ya existían (saltadas)", rep["skipped"])
    lines += section("Ambiguas: usa --pick slug=archivo", rep["ambiguous"])
    lines += section("Faltan", rep["missing"])
    lines += section("Alerta de halo rosa: regenerar o retocar", [f"{s} ({r:.1%})" for s, r in rep["halo"]])
    return "\n".join(lines)
```

En `process.py`:

```python
def cmd_apply(fase: str, raw: Path, picks: list[str], force: bool) -> int:
    from rembg import new_session, remove  # perezoso: pesa y solo hace falta aquí
    session = new_session("isnet-general-use")

    def remover(im):
        return remove(im, session=session, alpha_matting=True,
                      alpha_matting_foreground_threshold=240, alpha_matting_background_threshold=10,
                      alpha_matting_erode_size=10)

    cpath = batch_path(fase)
    cat = mjlib.load_catalog(cpath)
    pick_map = dict(p.split("=", 1) for p in picks)
    rep = mjlib.apply_batch(cat, cpath, raw, REPO, remover, picks=pick_map, force=force)
    report = raw / fase / "REPORT.md"
    report.write_text(mjlib.render_report(rep), encoding="utf-8")
    print(mjlib.render_report(rep))
    print(f"→ {report}")
    return 0
```
y en `main`: `if a.apply: return cmd_apply(a.apply, a.raw, a.pick, a.force)` (con `ap.error` si falta `--raw`). Quitar el `ap.error("subcomando aún no implementado")`.

- [ ] **Step 4: Verde**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Expected: `26 passed`.

- [ ] **Step 5: Comprobar que rembg carga en GPU (o cae a CPU)**

```bash
uv run --python 3.12 --with "rembg[gpu]" python -c "import onnxruntime as o; print(o.get_available_providers())"
```
Expected: la lista incluye `CUDAExecutionProvider`. Si solo aparece `CPUExecutionProvider`, sigue funcionando; anotarlo en el commit. Si la instalación de `onnxruntime-gpu` falla, cambiar la dependencia en la cabecera de `process.py` a `rembg[cpu]`.

- [ ] **Step 6: Commit**

```bash
git add scripts/mj && git commit -m "feat(mj): apply con rembg, marcado done e informe por lote"
```

---

### Task 8: Catálogo `fase-1.json` (97 piezas)

**Files:**
- Create: `scripts/mj/batches/fase-1.json`
- Test: `scripts/mj/tests/test_catalogs.py`

**Interfaces:**
- Produces: el catálogo real. Slugs y grupos exactamente los de la spec §3; `prefix` únicos; `oref: false` solo en `icons` y `games`; `size` 512 en `icons` y `games`, 1024 en el resto.

- [ ] **Step 1: Test que falla**

```python
# scripts/mj/tests/test_catalogs.py
import sys
from collections import Counter
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mjlib  # noqa: E402

BATCH = Path(__file__).resolve().parents[1] / "batches" / "fase-1.json"
EXPECTED = {"expressions": 15, "poses": 16, "states": 6, "celebrations": 6, "accessories": 16,
            "themed": 6, "icons": 6, "stickers": 10, "games": 12, "characters": 3, "app-icon": 1}
GAMES = {"wordle", "crossword", "dot-match", "true-false", "memory", "audio-blitz", "word-tower",
         "sentence-builder", "ghost-race", "dotaxi", "dont-pop", "dot-bombs"}

def test_fase1_counts_and_rules():
    cat = mjlib.load_catalog(BATCH)
    counts = Counter(p["group"] for p in cat["pieces"])
    assert dict(counts) == EXPECTED and len(cat["pieces"]) == 97
    for p in cat["pieces"]:
        expect_oref = p["group"] not in ("icons", "games")
        assert p["oref"] is expect_oref, p["slug"]
        assert p["size"] == (512 if p["group"] in ("icons", "games") else 1024), p["slug"]
        assert "," not in p["prefix"], p["slug"]
        assert "glasses" not in p["prompt"].lower() or p["slug"] in ("lentes", "doty-scientist"), p["slug"]
    assert {p["slug"] for p in cat["pieces"] if p["group"] == "games"} == GAMES
    assert {p["slug"] for p in cat["pieces"] if p["group"] == "characters"} == {"doty-fem", "doty-sailor", "doty-scientist"}
    assert any(p["slug"] == "hablando" and p["group"] == "poses" for p in cat["pieces"])
    assert len({p["prefix"] for p in cat["pieces"]}) == 97
```

- [ ] **Step 2: Ver el fallo**: `FileNotFoundError` de `fase-1.json`.

- [ ] **Step 3: Escribir el catálogo**

Reglas para redactar cada pieza (aplicarlas a las 97; abajo van las listas de slugs y ejemplos completos por grupo):

- `prefix`: 3–6 palabras en inglés, empieza por "Doty" en las piezas con mascota, sin comas, único.
- `prompt`: la pose/gesto/prop en 5–15 palabras; sin pedir texto; los props en colores de marca (`navy book`, `blue headphones`, `yellow taxi`).
- `fallback` por grupo: expressions/states/celebrations → el legacy más cercano de la tabla §4.5 de la spec (`feliz`→`02`, `triste`→`05`, `pensando`→`07`, `decepcionado`→`09`, `riendo`→`11`, `idea`→`12`, `senalando`→`13`, `saludando`→`14`, `bienvenido`→`16`, `halloween`→`18`, `sigue-asi`→`03`, `bailando`→`04`, `wow`→`06`); todo lo demás `"02"`.
- `done: false` en todas.

Ejemplos completos (uno por grupo, copiar el patrón):

```json
{ "slug": "feliz", "group": "expressions", "prefix": "Doty beaming with joy", "prompt": "standing upright, arms slightly open, big happy smile", "size": 1024, "oref": true, "fallback": "02", "done": false }
{ "slug": "hablando", "group": "poses", "prefix": "Doty talking to the viewer", "prompt": "mouth open mid-sentence, one hand raised palm up, friendly eye contact", "size": 1024, "oref": true, "fallback": "13", "done": false }
{ "slug": "oh-no", "group": "states", "prefix": "Doty gasping oh no", "prompt": "both hands on cheeks, wide worried eyes, small open mouth", "size": 1024, "oref": true, "fallback": "05", "done": false }
{ "slug": "lo-lograste", "group": "celebrations", "prefix": "Doty jumping in victory", "prompt": "mid-air jump, both fists up, eyes closed with a huge grin", "size": 1024, "oref": true, "fallback": "02", "done": false }
{ "slug": "libro", "group": "accessories", "prefix": "Doty holding a navy book", "prompt": "holding a closed navy blue book with both hands against the chest", "size": 1024, "oref": true, "fallback": "02", "done": false }
{ "slug": "navidad", "group": "themed", "prefix": "Doty in a Santa hat", "prompt": "wearing a red Santa hat with white trim, waving", "size": 1024, "oref": true, "fallback": "02", "done": false }
{ "slug": "correcto", "group": "icons", "prefix": "Green check mark badge", "prompt": "a bold green check mark inside a white circle", "size": 512, "oref": false, "fallback": "02", "done": false }
{ "slug": "good-job", "group": "stickers", "prefix": "Doty thumbs up and winking", "prompt": "thumbs up with one hand, winking, cheeky grin", "size": 1024, "oref": true, "fallback": "11", "done": false }
{ "slug": "wordle", "group": "games", "prefix": "Green and yellow letter tiles", "prompt": "five square letter tiles in a row, two green two yellow one grey, no letters", "size": 512, "oref": false, "fallback": null, "done": false }
{ "slug": "doty-fem", "group": "characters", "prefix": "Doty Fem talking with a cyan bow", "prompt": "same round pink body, long eyelashes, cyan bow on top of the head, mouth open mid-sentence, one hand raised", "size": 1024, "oref": true, "fallback": null, "done": false }
{ "slug": "app-icon", "group": "app-icon", "prefix": "Doty face close up icon", "prompt": "head and shoulders close-up, centered, big smile, looking at the viewer", "size": 1024, "oref": true, "fallback": null, "done": false }
```

Slugs por grupo (spec §3):
- expressions: feliz, muy-feliz, emocionado, orgulloso, sorprendido, pensando, preocupado, triste, enojado, decepcionado, riendo, timido, enamorado, cansado, dormido.
- poses: saludando, pulgar-arriba, senalando, bienvenido, aplaudiendo, caminando, corriendo, saltando, bailando, sentado, leyendo, escribiendo, en-laptop, escuchando, en-celular, hablando.
- states: wow, oh-no, ups, excelente, perfecto, sigue-asi.
- celebrations: lo-lograste, confeti, trofeo-celebracion, medalla, diploma-celebracion, fuegos-artificiales. (Los slugs `trofeo` y `diploma` a secas son los accesorios; las celebraciones llevan sufijo, como en el registro de la rama de marca.)
- accessories: libro, lapiz, laptop, tablet, celular, mochila, taza, diploma, trofeo, microfono, bandera-uk, bandera-usa, maleta, lentes, idea, globo.
- themed: navidad, halloween, san-valentin, fiestas-patrias, graduacion, back-to-school.
- icons: correcto, incorrecto, atencion, cargando, racha, nivel-completado.
- stickers: good-job, amazing, keep-going, you-can-do-it, lets-practice, oops, almost, nice, excellent, see-you.
- games: los 12 keys, motivos en spec §3.9.
- characters: doty-fem (pestañas + lazo cyan), doty-sailor (gorra marinera blanca con visera navy y pañuelo navy), doty-scientist (anteojos redondos + bata blanca; es la única pieza con anteojos junto a `lentes`).
- app-icon: app-icon.

- [ ] **Step 4: Verde**

```bash
uv run --python 3.12 --with pytest --with pillow python -m pytest scripts/mj/tests -q
```
Expected: `27 passed`. Si falla por conteo, revisar el grupo que indica el `Counter`.

- [ ] **Step 5: Commit**

```bash
git add scripts/mj/batches/fase-1.json scripts/mj/tests/test_catalogs.py
git commit -m "feat(mj): catálogo de las 97 piezas de fase 1"
```

---

### Task 9: `scripts/check-doty-assets.mjs` y cableado en `npm run lint`

**Files:**
- Create: `scripts/check-doty-assets.mjs`
- Modify: `package.json` (scripts `lint`, `check:doty`)

**Interfaces:**
- Consumes: `components/ui/doty/poses.ts` (Task 10 lo genera; hasta entonces el check pasa con 0 entradas).
- Produces: `node scripts/check-doty-assets.mjs [--strict]`. Exit 1 si algún `src` no existe; con `--strict` también si algún `src` contiene `DOTTY-POSES` o hay PNG huérfanos bajo `public/images/Doty/`.

- [ ] **Step 1: Escribir el script**

```js
#!/usr/bin/env node
// Verifica que cada src del registro de Doty existe en disco.
// --strict: además prohíbe legacy (DOTTY-POSES) y PNG huérfanos en public/images/Doty.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const strict = process.argv.includes("--strict");
const registryPath = join(root, "components/ui/doty/poses.ts");
const source = existsSync(registryPath) ? readFileSync(registryPath, "utf8") : "";
const srcs = [...source.matchAll(/src:\s*"(\/images\/Doty\/[^"]+)"/g)].map((m) => m[1]);

const errors = [];
for (const src of srcs) {
  if (!existsSync(join(root, "public", src))) errors.push(`falta en disco: ${src}`);
  if (strict && src.includes("DOTTY-POSES")) errors.push(`legacy en registro: ${src}`);
}

if (strict) {
  const walk = (dir) =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const referenced = new Set(srcs.map((s) => join(root, "public", s)));
  for (const f of walk(join(root, "public/images/Doty"))) {
    if (f.endsWith(".png") && !referenced.has(f)) errors.push(`huérfano: ${relative(root, f)}`);
  }
}

if (errors.length) {
  console.error(`check-doty-assets: ${errors.length} problema(s)\n  ${errors.join("\n  ")}`);
  process.exit(1);
}
console.log(`check-doty-assets: ${srcs.length} poses OK${strict ? " (strict)" : ""}`);
```

- [ ] **Step 2: Cablear en `package.json`**

```json
"lint": "eslint && node scripts/check-doty-assets.mjs",
"check:doty": "node scripts/check-doty-assets.mjs"
```

- [ ] **Step 3: Probar los tres caminos**

```bash
source ~/.nvm/nvm.sh && nvm use
npm run check:doty                      # "0 poses OK" (aún no hay registro)
node scripts/check-doty-assets.mjs --strict; echo "exit=$?"   # exit=1: los 22 DOTTY-POSES son huérfanos
npm run lint
```
Expected: lint pasa (eslint no toca `.mjs` de `scripts/` con reglas de React que fallen; si eslint se queja de `scripts/**`, añadir `"scripts/**"` a `globalIgnores` en `eslint.config.mjs`).

- [ ] **Step 4: Commit**

```bash
git add scripts/check-doty-assets.mjs package.json eslint.config.mjs
git commit -m "chore(doty): check registro↔disco de sprites, encadenado a lint"
```

---

### Task 10: Registro generado, componente `Doty` tipado, keyframes y sombra CSS

**Files:**
- Create (generado): `components/ui/doty/poses.ts`
- Modify: `components/ui/doty/doty.tsx` (reescritura completa)
- Modify: `app/globals.css` (añadir bloque al final, antes del `@media (prefers-reduced-motion)` si existe)

**Interfaces:**
- Consumes: `emit_registry` (Task 4), `fase-1.json` (Task 8).
- Produces: `Doty` con props `{ pose: DotyPose; size?: DotySize; customClass?: string; animation?: DotyAnimation; say?: string; shadow?: boolean }`; re-exporta `type DotyPose`, `toDotyPose`, `isDotyPose`. Tras esta tarea `npx tsc --noEmit` **falla** en los call sites con literales numéricos: es lo esperado, Tasks 11–12 los migran. No commitear hasta cerrar Task 12 (o commitear en rama de trabajo).

- [ ] **Step 1: Generar el registro**

```bash
uv run --python 3.12 scripts/mj/process.py --emit-registry fase-1
head -12 components/ui/doty/poses.ts && grep -c 'src:' components/ui/doty/poses.ts
```
Expected: cabecera `// GENERADO…` y `81` entradas, todas apuntando a `DOTTY-POSES-XX.png`.

- [ ] **Step 2: Reescribir `components/ui/doty/doty.tsx`**

```tsx
"use client";

import React from "react";
import Image from "next/image";
import { POSES, FALLBACK_POSE, isDotyPose, toDotyPose, type DotyPose } from "./poses";

export type DotyAnimation = "none" | "bob" | "cheer" | "sad" | "wave";
export type DotySize = "micro" | "mini" | "small" | "tiny" | "smaller" | "medium" | "big";
export type { DotyPose };
export { toDotyPose, isDotyPose };

interface DotyProps {
  /** Pose semántica del registro (components/ui/doty/poses.ts). Para strings dinámicos usa toDotyPose(). */
  pose: DotyPose;
  size?: DotySize;
  customClass?: string;
  /** Animación del vocabulario de movimiento de Doty (globals.css): solo transform. */
  animation?: DotyAnimation;
  /** Burbuja de texto sobre Doty. */
  say?: string;
  /** Sombra por CSS (drop-shadow). Los PNG nacen sin sombra a propósito. */
  shadow?: boolean;
}

/** Ancho renderizado en px por tamaño; alimenta `sizes` para que next/image no sirva 1024px a un sprite de 32. */
const SIZE_PX: Record<DotySize, number> = {
  micro: 32,
  mini: 80,
  tiny: 96,
  smaller: 112,
  small: 144,
  medium: 192,
  big: 352,
};

const sizeClass: Record<DotySize, string> = {
  micro: "w-8",
  mini: "w-20",
  tiny: "w-24",
  smaller: "w-28",
  small: "w-36",
  medium: "w-48",
  big: "w-[22rem] max-w-full",
};

const animationClass: Record<DotyAnimation, string> = {
  none: "",
  bob: "doty-bob",
  cheer: "doty-cheer",
  sad: "doty-sad",
  wave: "doty-wave",
};

export default function Doty({
  pose,
  size = "small",
  customClass = "",
  animation = "none",
  say,
  shadow = true,
}: DotyProps) {
  // Guardia de runtime: un `as DotyPose` mal puesto cae a la cara amable, no a un 404.
  const entry = POSES[isDotyPose(pose) ? pose : FALLBACK_POSE];
  const img = (
    <Image
      src={entry.src}
      alt=""
      aria-hidden
      width={1024}
      height={1024}
      sizes={`${SIZE_PX[size]}px`}
      className={`h-auto select-none ${sizeClass[size]} ${animationClass[animation]} ${shadow ? "doty-shadow" : ""} ${customClass}`}
      draggable={false}
    />
  );

  if (!say) return img;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="bubble-pop relative max-w-55 rounded-2xl px-4 py-2.5 text-center text-sm font-bold"
        style={{
          background: "var(--surface)",
          border: "2px solid var(--border)",
          color: "var(--foreground)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}
      >
        {say}
        <span
          aria-hidden
          className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45"
          style={{
            background: "var(--surface)",
            borderRight: "2px solid var(--border)",
            borderBottom: "2px solid var(--border)",
          }}
        />
      </div>
      {img}
    </div>
  );
}
```

- [ ] **Step 3: Añadir a `app/globals.css`** (buscar el bloque `.bubble-pop`; pegar justo antes)

```css
/* ─── DOTY: movimiento y sombra ───────────────────────────────
   Solo transform (portable a RN); la sombra va por CSS porque los sprites
   nacen sin ella (spec 2026-09-07-doty-midjourney-assets §4.3). */
.doty-shadow { filter: drop-shadow(0 6px 4px rgba(30, 27, 92, 0.18)); }

@keyframes doty-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
}
.doty-bob { animation: doty-bob 2.2s ease-in-out infinite; }

@keyframes doty-cheer {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25%      { transform: translateY(-10px) rotate(-4deg); }
  50%      { transform: translateY(0) rotate(0deg); }
  75%      { transform: translateY(-10px) rotate(4deg); }
}
.doty-cheer { animation: doty-cheer 900ms ease-in-out infinite; }

@keyframes doty-sad {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50%      { transform: translateY(3px) rotate(-2deg); }
}
.doty-sad { animation: doty-sad 3s ease-in-out infinite; }

@keyframes doty-wave {
  0%, 100% { transform: rotate(0deg); }
  20%      { transform: rotate(-6deg); }
  40%      { transform: rotate(5deg); }
  60%      { transform: rotate(-4deg); }
  80%      { transform: rotate(2deg); }
}
.doty-wave { animation: doty-wave 1.6s ease-in-out infinite; transform-origin: 70% 80%; }
```

Comprobar que `grep -n "bubble-pop\|prefers-reduced-motion" app/globals.css` muestra que `.bubble-pop` existe y que las nuevas animaciones quedan dentro del alcance del bloque `prefers-reduced-motion` global (si el archivo lo tiene, ya las cubre por `*`).

- [ ] **Step 4: Ver qué rompe el tipado (es la lista de trabajo de Tasks 11–12)**

```bash
source ~/.nvm/nvm.sh && nvm use
npx tsc --noEmit 2>&1 | grep -c "error TS"
npx tsc --noEmit 2>&1 | grep "error TS" | cut -d"(" -f1 | sort -u
```
Expected: ~45 errores `Type '"05"' is not assignable to type DotyPose` repartidos en los archivos listados en Tasks 11 y 12. Si aparece un archivo que no está en esas tablas, añadirlo a Task 11 con la pose elegida por contexto (tabla tono→pose de la spec).

- [ ] **Step 5: `npm run check:doty`**

Expected: `81 poses OK` (todos los fallbacks legacy existen en disco).

---

### Task 11: Migrar los call sites con literal numérico

**Files:** (Modify, línea aproximada → reemplazo exacto del valor de `pose`)

| Archivo:línea | Antes | Después |
|---|---|---|
| `app/(app)/practice/page.tsx:251` y `:279` | `"05"` | `"oh-no"` |
| `app/(app)/admin/page.tsx:54` | `"02"` | `"saludando"` |
| `app/(app)/admin/layout.tsx:69` | `"05"` | `"oh-no"` |
| `app/(app)/admin/layout.tsx:93` | `"07"` | `"pensando"` |
| `app/(app)/readings/[id]/page.tsx:91` | `"05"` | `"oh-no"` |
| `app/(app)/readings/[id]/page.tsx:133` | `"11"` | `"leyendo"` |
| `app/(app)/readings/[id]/page.tsx:168` | `"07"` | `"pensando"` |
| `app/(app)/readings/[id]/page.tsx:243` | `result.passed ? "17" : "05"` | `result.passed ? "lo-lograste" : "triste"` |
| `app/(app)/checkpoint/page.tsx:84` | `"07"` | `"pensando"` |
| `app/(app)/(hub)/play/page.tsx:16` | `"12"` | `"idea"` |
| `app/(app)/(hub)/profile/page.tsx:122` | `"06"` | `"feliz"` |
| `app/(app)/(hub)/review/page.tsx:36` | `"17"` | `"excelente"` |
| `app/(app)/(hub)/shop/page.tsx:109` | `"05"` | `"timido"` |
| `app/forgot/page.tsx:151` | `"13"` | `"senalando"` |
| `app/forgot/page.tsx:221` | `"07"` | `"pensando"` |
| `app/forgot/page.tsx:296` | `"17"` | `"excelente"` |
| `app/page.tsx:148` | `"17"` | `"saludando"` |
| `app/page.tsx:204` | `"13"` | `"senalando"` |
| `app/invite/[token]/page.tsx:183` | `"05"` | `"oh-no"` |
| `app/invite/[token]/page.tsx:206` | `"07"` | `"pensando"` |
| `app/invite/[token]/page.tsx:226` | `"17"` | `"lo-lograste"` |
| `components/interactive-column/streak/streak-top.tsx:73` | `"03"` | `"sigue-asi"` |
| `components/interactive-column/top-students.tsx:100` | `"17"` | `"medalla"` |
| `components/interactive-column/top-students.tsx:236` | `"17"` | `"timido"` |
| `components/practice-container/practice-container.tsx:123` | `"02"` | `"emocionado"` |
| `components/practice-container/practice-container.tsx:155` | `isGameover ? "05" : mode === "perfect" ? "17" : "02"` | `isGameover ? "oh-no" : mode === "perfect" ? "perfecto" : "excelente"` |
| `components/lesson/result-screen.tsx:68` | idem anterior | idem anterior |
| `components/games/dont-pop/hot-air-balloon.tsx:179` | `phase === "exploded" ? "05" : phase === "landed" ? "02" : "14"` | `phase === "exploded" ? "oh-no" : phase === "landed" ? "lo-lograste" : "saludando"` |
| `components/games/shared/game-intro.tsx:48` | `"12"` | `"bienvenido"` |
| `components/games/shared/game-result.tsx:56` | `isNewRecord ? "07" : "02"` | `isNewRecord ? "trofeo-celebracion" : "muy-feliz"` |
| `components/checkpoint/checkpoint-result.tsx:24` | `"17"` | `"lo-lograste"` |
| `components/checkpoint/checkpoint-result.tsx:54` | `"05"` | `"sigue-asi"` |
| `components/lesson/grammar/explanation-card.tsx:35` | `"02"` | `"idea"` |
| `components/lesson/pronunciation/pronunciation-drill.tsx:101` | `"05"` | `"triste"` |
| `components/lesson/pronunciation/pronunciation-drill.tsx:138` | `"02"` | `"escuchando"` |
| `components/onboarding/placement-result.tsx:20` | `"17"` | `"lo-lograste"` |
| `components/onboarding/placement-test.tsx:92` | `"07"` | `"pensando"` |
| `components/onboarding/welcome-screen.tsx:19` | `"17"` | `"saludando"` |
| `components/path/doty-marker.tsx:38` | `"17"` | `"saludando"` |
| `components/path/path-container.tsx:142` | `"05"` | `"oh-no"` |
| `components/play/games-grid.tsx:63` | `"09"` | `"decepcionado"` |
| `components/play/games-grid.tsx:80` | `"01"` | `"timido"` |
| `app/(app)/games/dotaxi/page.tsx:654` | `outcome === "clear" ? "17" : outcome === "crash" ? "05" : "02"` | `outcome === "clear" ? "excelente" : outcome === "crash" ? "oh-no" : "feliz"` |

**Interfaces:**
- Consumes: `DotyPose` (Task 10). Los ternarios quedan tipados por inferencia de literales al pasar directo al prop.

- [ ] **Step 1: Aplicar la tabla**

Usar Edit por archivo con el valor exacto. Las líneas son las de main en `8b67521`; si se movieron, localizar por `grep -n 'pose=' <archivo>`.

- [ ] **Step 2: Comprobar que no queda ningún literal numérico**

```bash
grep -rn 'pose="[0-9]' app components hooks lib; echo "exit=$?"
grep -rnE '"(0[1-9]|1[0-9]|2[0-2])"' components/games/dont-pop/hot-air-balloon.tsx components/games/shared/game-result.tsx components/practice-container/practice-container.tsx components/lesson/result-screen.tsx "app/(app)/games/dotaxi/page.tsx" "app/(app)/readings/[id]/page.tsx"
```
Expected: `exit=1` (sin coincidencias) en ambos.

- [ ] **Step 3: tsc**

```bash
npx tsc --noEmit 2>&1 | grep "error TS" | cut -d"(" -f1 | sort -u
```
Expected: solo quedan los archivos de Task 12 (`dialog.tsx`, `admin/page.tsx` cards, `daily-progress.tsx`, `dotaxi/page.tsx` (`Taxi`), `practice/page.tsx` (estado), `practice-container.tsx` (prop `doty`), `invite/[token]/page.tsx` (`REJECTION_COPY`), `path-difficulty.tsx`, `voice-characters.ts`, `voice-avatar.tsx`).

---

### Task 12: Migrar los call sites dinámicos y tipar sus fuentes

**Files:**
- Modify: `components/ui/dialog/dialog.tsx:21-45`
- Modify: `app/(app)/admin/page.tsx:1-50` (array de cards)
- Modify: `components/interactive-column/daily-progress/daily-progress.tsx:28-41`
- Modify: `app/(app)/games/dotaxi/page.tsx:63-71`
- Modify: `app/(app)/practice/page.tsx:35,100,115,136`
- Modify: `components/practice-container/practice-container.tsx:21`
- Modify: `app/invite/[token]/page.tsx:24-45`
- Modify: `components/path/path-difficulty.tsx:1-5,115`
- Modify: `lib/voice-characters.ts`

**Interfaces:**
- Consumes: `DotyPose`, `toDotyPose`, `isDotyPose` desde `@/components/ui/doty/doty`.
- Produces: `VoiceCharacterInfo.pose: DotyPose`; `PracticeContainer` prop `doty: DotyPose`.

- [ ] **Step 1: `dialog.tsx`** — importar el tipo y cambiar el mapa

```ts
import type { DotyPose } from "@/components/ui/doty/doty";
// ...
const toneConfig: Record<DialogTone, { fallbackTitle: string; dotyPose?: DotyPose; headerBg: string; border: string }> = {
  success: { fallbackTitle: "Great!",    dotyPose: "excelente",  /* resto igual */ },
  warning: { fallbackTitle: "Warning!",  dotyPose: "preocupado", /* resto igual */ },
  error:   { fallbackTitle: "Oh no!",    dotyPose: "oh-no",      /* resto igual */ },
  info:    { fallbackTitle: "Heads up",  dotyPose: "senalando",  /* resto igual */ },
  "":      { fallbackTitle: "", /* igual */ },
};
```

- [ ] **Step 2: `admin/page.tsx`** — tipar el array de cards y cambiar las 5 poses

Añadir `import type { DotyPose } from "@/components/ui/doty/doty";`, anotar el array como `Array<{ title: string; desc: string; href: string; pose: DotyPose; accent: string; edge: string }>` (conservar los campos que ya tenga) y reemplazar: Levels & Content `"07"`→`"pensando"`, Foundations `"09"`→`"escribiendo"`, Learning path `"11"`→`"caminando"`, Readings `"12"`→`"leyendo"`, Users `"02"`→`"saludando"`.

- [ ] **Step 3: `daily-progress.tsx`**

```ts
import type { DotyPose } from "@/components/ui/doty/doty";
// ...
  const initial_pose: DotyPose = "sigue-asi";
  let pose: DotyPose = initial_pose;
  let message = "Let's get this done!";

  if (progress === 100 && pose === initial_pose) {
    pose = "lo-lograste";
    message = "Well done!";
  } else if (progress >= 80 && pose === initial_pose) {
    pose = "emocionado";
    message = "Almost!";
  } else if (progress >= 50 && pose === initial_pose) {
    pose = "emocionado";
    message = "Keep going!";
  }
```

- [ ] **Step 4: `dotaxi/page.tsx`** — el prop del `Taxi`

```ts
import Doty, { type DotyPose } from "@/components/ui/doty/doty";
// en Taxi({ ... }: { tilt: number; crashing: boolean; pose: DotyPose })
```
(el ternario de la línea 654 ya quedó semántico en Task 11).

- [ ] **Step 5: `practice/page.tsx` y `practice-container.tsx`**

```ts
// practice/page.tsx
import Doty, { type DotyPose } from "@/components/ui/doty/doty";
const [doty, setDoty] = useState<DotyPose>("pensando");
// línea ~100: setDoty("02")  → setDoty("excelente")
// línea ~115: setDoty("05")  → setDoty("oh-no")
// línea ~136: setDoty("07")  → setDoty("pensando")

// practice-container.tsx, interfaz de props (línea 21)
doty: DotyPose;   // + import type { DotyPose } from "@/components/ui/doty/doty";
```

- [ ] **Step 6: `invite/[token]/page.tsx`**

```ts
import Doty, { type DotyPose } from "@/components/ui/doty/doty";
const REJECTION_COPY: Record<Rejection, { title: string; body: string; pose: DotyPose }> = {
  // "Este enlace ya venció"          → pose: "triste"
  // "Esta invitación fue cancelada"  → pose: "triste"
  // "Esta invitación ya se usó"      → pose: "muy-feliz"
  // "No encontramos esta invitación" → pose: "preocupado"
};
```

- [ ] **Step 7: `path-difficulty.tsx`** — el valor viene de la BD

```ts
import Doty, { isDotyPose } from "@/components/ui/doty/doty";
// línea 115:
<Doty size="mini" pose={isDotyPose(img) ? img : "bienvenido"} />
```
Hasta que Task 20 escriba slugs en `difficulty.img`, la BD trae `"01"/"04"/"17"` y las tres dificultades muestran `bienvenido`. Es el comportamiento deseado.

- [ ] **Step 8: `lib/voice-characters.ts`**

```ts
import type { DotyPose } from "@/components/ui/doty/doty";
import type { ItemCharacter } from "@/services/lessons.service";

export type VoiceCharacterInfo = { key: string; name: string; pose: DotyPose };

/** Pose de respaldo por personaje mientras `characters.img` está vacío (lo llena
 *  dots-backend/scripts/set-doty-art.js). VoiceAvatar prefiere `img` cuando existe. */
const BY_KEY: Record<string, VoiceCharacterInfo> = {
  doty:             { key: "doty",           name: "Doty",            pose: "hablando" },
  "doty-fem":       { key: "doty-fem",       name: "Doty Fem",        pose: "hablando" },
  "doty-sailor":    { key: "doty-sailor",    name: "Doty marinero",   pose: "hablando" },
  "doty-scientist": { key: "doty-scientist", name: "Doty científica", pose: "hablando" },
};
```
El resto del archivo no cambia.

- [ ] **Step 9: Verificación completa**

```bash
npx tsc --noEmit && npm run lint && npx next build
```
Expected: los tres pasan. Si `next build` falla por un literal olvidado, el mensaje indica archivo y línea.

- [ ] **Step 10: Preview visual (dev server `dots-webapp` del launch.json)**

Abrir `/levels`, `/play`, `/review`, `/profile` y una lección; confirmar que Doty se ve (con sprite legacy vía fallback), con sombra CSS y que `animation="cheer"`/`"bob"` ahora se mueven. Verificar en tema oscuro que la sombra no ensucia el fondo.

- [ ] **Step 11: Commit (registro + componente + CSS + migración, un solo commit coherente)**

```bash
git add components/ui/doty app/globals.css app components hooks lib
git commit -m "feat(doty): registro semántico generado, componente tipado y migración de poses numéricas

Las 81 poses apuntan por ahora a los PNG legacy (fallback) y van cambiando
lote a lote con scripts/mj/process.py --apply + --emit-registry."
```

---

### Task 13: `DotySticker`

**Files:**
- Create: `components/ui/doty/doty-sticker.tsx`

**Interfaces:**
- Produces: `<DotySticker kind={StickerKind} size?: "mini" | "tiny" />` con `StickerKind = "good-job" | "amazing" | "keep-going" | "you-can-do-it" | "lets-practice" | "oops" | "almost" | "nice" | "excellent" | "see-you"`.

- [ ] **Step 1: Escribir el componente**

```tsx
"use client";

import Doty, { type DotyPose } from "./doty";

export type StickerKind =
  | "good-job" | "amazing" | "keep-going" | "you-can-do-it" | "lets-practice"
  | "oops" | "almost" | "nice" | "excellent" | "see-you";

/** Copy en español; el sprite no lleva texto quemado (spec §3.8). */
const STICKER_TEXT: Record<StickerKind, string> = {
  "good-job": "¡Buen trabajo!",
  amazing: "¡Increíble!",
  "keep-going": "¡Sigue así!",
  "you-can-do-it": "¡Tú puedes!",
  "lets-practice": "¡A practicar!",
  oops: "¡Ups!",
  almost: "¡Casi!",
  nice: "¡Bien!",
  excellent: "¡Excelente!",
  "see-you": "¡Hasta pronto!",
};

interface DotyStickerProps {
  kind: StickerKind;
  size?: "mini" | "tiny";
}

export default function DotySticker({ kind, size = "mini" }: DotyStickerProps) {
  const pose = `sticker-${kind}` as DotyPose;
  return <Doty pose={pose} size={size} shadow={false} say={STICKER_TEXT[kind]} />;
}
```

- [ ] **Step 2: Comprobar el cast contra el registro**

```bash
for k in good-job amazing keep-going you-can-do-it lets-practice oops almost nice excellent see-you; do grep -q "\"sticker-$k\":" components/ui/doty/poses.ts || echo "FALTA sticker-$k"; done
npx tsc --noEmit && npm run lint
```
Expected: sin `FALTA`; tsc y lint pasan. (El `as DotyPose` es seguro porque el test de Task 8 fija los 10 slugs de stickers; el guard de runtime de `Doty` cubre cualquier desvío.)

- [ ] **Step 3: Usarlo en un sitio real** — en `components/checkpoint/checkpoint-result.tsx:54` reemplazar `<Doty pose="sigue-asi" size="small" animation="sad" say="¡Casi! Sigamos practicando." />` por `<DotySticker kind="almost" size="tiny" />` seguido del párrafo existente. Verificar en preview `/checkpoint` con un resultado fallido.

- [ ] **Step 4: Commit**

```bash
git add components/ui/doty/doty-sticker.tsx components/checkpoint/checkpoint-result.tsx
git commit -m "feat(doty): DotySticker con copy en CSS, sin texto en el sprite"
```

---

### Task 14: Fase 0 — kit de estilo (compuerta; trabajo humano + medición)

**Files:**
- Modify: `scripts/mj/style.json` (rellenar `sref`, `ow`, `draft_supports_oref`, `gpu_minutes`)
- Fuera del repo: `$RAW/fase-0/PROMPTS.md`, `$RAW/fase-0/log.md`, descargas

**Interfaces:**
- Consumes: `--emit-prompts` (Task 3), `--dry-run` (Task 5).
- Produces: `style.json` completo. **Nada de Task 15 en adelante arranca sin él.**

- [ ] **Step 1: Emitir prompts y entregar a Sergio**

```bash
RAW=/home/endurance/Projects/Endurance/dots/imagenes/mj
uv run --python 3.12 scripts/mj/process.py --emit-prompts fase-0 --raw "$RAW"
```
Entregar: la ruta de `PROMPTS.md`, `ref-hero.png` (Omni Reference) y `ref-sheet.png` (Style Reference) con estas instrucciones:
1. Prompts 1–12: modo estándar. Anotar en `log.md` los minutos de GPU que la página de cuenta de Midjourney descuenta por cada trabajo.
2. Prompts 13–14: activar **Draft Mode** antes de enviar. Si Midjourney rechaza `--oref` en Draft, anotar `draft_supports_oref = false` y saltarlos.
3. Prompt 15: sin Omni Reference; solo la hoja como Style Reference.
4. Por cada trabajo anotar cuántas de las 4 imágenes cumplen los 6 criterios de la spec §2.3. Descargar **todas** las que cumplan a `$RAW/fase-0/` sin renombrar.

- [ ] **Step 2: Cuando Sergio termine, mapear y revisar**

```bash
uv run --python 3.12 scripts/mj/process.py --dry-run fase-0 --raw "$RAW"
```
Abrir con Read cada descarga y confirmar el veredicto del log contra los criterios §2.3 (picos, ojos, boca, zapatos, sin anteojos, fondo blanco, sin texto ni sombra).

- [ ] **Step 3: Decidir y congelar `style.json`**

- `ow`: el valor (100 o 300) con más aciertos en las 3 poses.
- `model`: si `--v 7` explícito no cambió nada, dejar `"7"` (los trabajos con `--oref` corren en V7 igualmente).
- `sref`: en la web, seleccionar las 2–3 mejores imágenes propias, crear un código de estilo desde ellas y pegarlo. Si Midjourney no ofrece código desde imágenes propias, subir las 2–3 imágenes como Style Reference y anotar en `sref` la palabra `"SHEET"` con un comentario en el log de qué imágenes son (la emisión de prompts imprime el valor tal cual).
- `draft_supports_oref`: `true`/`false`. `gpu_minutes.standard/draft/enhance`: medias del log.
- Compuerta: **≥ 25 % de aciertos** (≥ 1 de 4 de media) con el ajuste elegido. Si no se alcanza, detenerse aquí, dejar constancia en el spec (§1) y no seguir con Task 15.

- [ ] **Step 4: Recalcular el presupuesto de §9 de la spec con los minutos medidos y commitear**

```bash
git add scripts/mj/style.json docs/superpowers/specs/2026-09-07-doty-midjourney-assets-design.md
git commit -m "chore(mj): estilo congelado tras fase 0 y presupuesto medido"
```

---

### Task 15: Fase 1 — lotes de generación (procedimiento repetible; ejecutar hasta que las 97 piezas estén `done`)

**Files:**
- Modify (por lote): `scripts/mj/batches/fase-1.json` (`done`, `source_file`), `components/ui/doty/poses.ts` (regenerado), `public/images/Doty/**`, `public/images/games/*`
- Fuera del repo: `$RAW/fase-1/`

**Interfaces:**
- Consumes: `--emit-prompts`, `--dry-run`, `--apply`, `--emit-registry`, `check:doty`.

Orden recomendado de lotes (~20 piezas cada uno, para no agotar la GPU mensual de golpe): (1) expressions; (2) poses; (3) states + celebrations + stickers; (4) accessories + themed; (5) icons + games (sin oref); (6) characters + app-icon.

- [ ] **Step 1: Emitir el archivo de prompts** (una vez; se re-emite si cambia el catálogo; las piezas hechas salen con ✅)

```bash
uv run --python 3.12 scripts/mj/process.py --emit-prompts fase-1 --raw "$RAW"
```
Indicar a Sergio el rango de números del lote. Si `draft_supports_oref` es `true`: explorar en Draft, "enhance" solo la elegida, descargar la mejorada.

- [ ] **Step 2: Mapear**

```bash
uv run --python 3.12 scripts/mj/process.py --dry-run fase-1 --raw "$RAW"
```
Para cada `AMBIGUO`, abrir los candidatos con Read y elegir; para cada `FALTA` del lote, devolverlo a Sergio.

- [ ] **Step 3: Aplicar**

```bash
uv run --python 3.12 scripts/mj/process.py --apply fase-1 --raw "$RAW" --pick feliz=sergio_Doty_beaming_with_joy_1a2b.png
cat "$RAW/fase-1/REPORT.md"
```
Abrir con Read 2–3 salidas de `public/images/Doty/<grupo>/` y todas las listadas en "Alerta de halo". Una pieza con halo visible se regenera (borrar su descarga, `done` vuelve a `false` a mano en el JSON) o se retoca en un editor y se vuelve a aplicar con `--force`.

- [ ] **Step 4: Regenerar registro y verificar**

```bash
uv run --python 3.12 scripts/mj/process.py --emit-registry fase-1
npm run lint && npx next build
```
Expected: `check-doty-assets` cuenta 81 poses OK; las hechas ya apuntan a `/images/Doty/<grupo>/<slug>.png`.

- [ ] **Step 5: Preview del grupo** en las pantallas donde se usa (buscar con `grep -rn 'pose="<slug>"' app components`). Comprobar tamaños `micro` (32 px) y `small`/`medium`: nitidez y que el recorte con margen del 4 % no deja a Doty "flotando".

- [ ] **Step 6: Commit del lote**

```bash
git add scripts/mj/batches/fase-1.json components/ui/doty/poses.ts public/images/Doty public/images/games
git commit -m "feat(doty): lote <n> — <grupos> (<k> piezas)"
```

Repetir Steps 1–6 por lote. Las piezas `games`, `characters` y `app-icon` no tocan el registro; sus consumidores son Tasks 16, 19 y 20.

---

### Task 16: Iconos PWA derivados (`compose-icons.mjs`) + bump del SW

**Files:**
- Create: `scripts/mj/compose-icons.mjs`
- Modify: `package.json` (devDependency `sharp`, script `icons:compose`), `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-192.png`, `public/icons/icon-maskable-512.png`, `app/apple-icon.png`, `app/icon.png` (nuevo), `public/sw.js` (`SW_VERSION`)

**Interfaces:**
- Consumes: `$RAW/fase-1/out/app-icon.png` (Task 15, pieza `app-icon`, 1024 px transparente).
- Produces: `node scripts/mj/compose-icons.mjs <ruta app-icon.png>`.

- [ ] **Step 1: Declarar sharp (ya está en node_modules como dependencia de Next; se declara para que no desaparezca con un upgrade)**

```bash
npm i -D sharp@^0.34.5
```

- [ ] **Step 2: Escribir el script**

```js
#!/usr/bin/env node
// Deriva todos los iconos de la PWA desde un único render 1024px transparente de Doty.
// Uso: node scripts/mj/compose-icons.mjs /ruta/app-icon.png
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const src = process.argv[2];
if (!src) { console.error("uso: compose-icons.mjs <app-icon.png>"); process.exit(2); }
const root = new URL("../..", import.meta.url).pathname;
const BG = "#fff7fb"; // THEME_COLORS.light (lib/theme-colors.ts) — cambiar ambos si cambia

/** Doty ocupa `ratio` del lienzo, centrado; fondo transparente u opaco. */
async function icon(size, ratio, bg) {
  const inner = Math.round(size * ratio);
  const doty = await sharp(src).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: doty, gravity: "centre" }])
    .png()
    .toBuffer();
}

const jobs = [
  ["public/icons/icon-192.png", 192, 0.92, null],
  ["public/icons/icon-512.png", 512, 0.92, null],
  ["public/icons/icon-maskable-192.png", 192, 0.80, BG], // zona segura 80 % (maskable)
  ["public/icons/icon-maskable-512.png", 512, 0.80, BG],
  ["app/apple-icon.png", 180, 0.84, BG],                 // iOS descarta el alfa → fondo opaco
  ["app/icon.png", 192, 0.92, null],                     // favicon moderno que Next enlaza solo
];
for (const [out, size, ratio, bg] of jobs) {
  writeFileSync(join(root, out), await icon(size, ratio, bg));
  console.log(`${out} ← ${size}px`);
}
```

- [ ] **Step 3: Ejecutar y bumpear el SW en el mismo commit**

```bash
node scripts/mj/compose-icons.mjs "$RAW/fase-1/out/app-icon.png"
magick identify public/icons/*.png app/apple-icon.png app/icon.png
sed -i 's/const SW_VERSION = "v1";/const SW_VERSION = "v2";/' public/sw.js && grep -n SW_VERSION public/sw.js | head -1
```
Expected: 192/512/192/512/180/192 px. Abrir con Read `icon-maskable-512.png` (Doty dentro del 80 % central sobre fondo crema) y `icon-512.png` (transparente).

- [ ] **Step 4: Verificar con el build de producción**

```bash
npx next build && npm run start   # o config dots-webapp-prod del launch.json
```
En el preview: DevTools → Application → Manifest muestra los 4 iconos nuevos; Service Workers muestra `v2` activándose. `npm run lint` pasa.

- [ ] **Step 5: Commit**

```bash
git add scripts/mj/compose-icons.mjs package.json package-lock.json public/icons app/apple-icon.png app/icon.png public/sw.js
git commit -m "feat(pwa): iconos derivados del Doty nuevo y SW_VERSION v2

icon-192 está en PRECACHE_URLS: sin el bump los clientes instalados
seguirían con la burbuja vieja (regla 9 de CLAUDE.md)."
```

---

### Task 17: Splash de iOS (`compose-splash.mjs` + `appleWebApp.startupImage`)

**Files:**
- Create: `scripts/mj/compose-splash.mjs`, `public/splash/*.png`
- Modify: `app/layout.tsx` (bloque `appleWebApp`), `package.json` (script `splash:compose`)

**Interfaces:**
- Consumes: `public/icons/icon-512.png` (Task 16).
- Produces: 12 PNG en `public/splash/` y su lista `{ url, media }` en `layout.tsx`.

- [ ] **Step 1: Escribir el script**

```js
#!/usr/bin/env node
// Splash de iOS: fondo del tema claro + Doty centrado. iOS exige un PNG por
// tamaño físico de pantalla y lo elige con media queries (ver layout.tsx).
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const BG = "#fff7fb";
const doty = join(root, "public/icons/icon-512.png");
// [ancho CSS, alto CSS, DPR] — iPhone SE/8, 11/XR, 12–16 y Pro/Max, iPad 10.2–13"
export const DEVICES = [
  [375, 667, 2], [414, 896, 2], [414, 896, 3], [375, 812, 3], [390, 844, 3], [393, 852, 3],
  [402, 874, 3], [430, 932, 3], [440, 956, 3], [768, 1024, 2], [820, 1180, 2], [1024, 1366, 2],
];
mkdirSync(join(root, "public/splash"), { recursive: true });
for (const [w, h, dpr] of DEVICES) {
  const W = w * dpr, H = h * dpr;
  const side = Math.round(Math.min(W, H) * 0.32);
  const d = await sharp(doty).resize(side, side, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const out = await sharp({ create: { width: W, height: H, channels: 4, background: BG } })
    .composite([{ input: d, gravity: "centre" }]).png().toBuffer();
  const name = `splash-${w}x${h}@${dpr}x.png`;
  writeFileSync(join(root, "public/splash", name), out);
  console.log(name);
}
```

- [ ] **Step 2: Ejecutar**

```bash
node scripts/mj/compose-splash.mjs && ls public/splash | wc -l
```
Expected: `12`.

- [ ] **Step 3: Enlazar en `app/layout.tsx`** — dentro de `appleWebApp: { ... }` añadir:

```ts
    startupImage: [
      [375, 667, 2], [414, 896, 2], [414, 896, 3], [375, 812, 3], [390, 844, 3], [393, 852, 3],
      [402, 874, 3], [430, 932, 3], [440, 956, 3], [768, 1024, 2], [820, 1180, 2], [1024, 1366, 2],
    ].map(([w, h, dpr]) => ({
      url: `/splash/splash-${w}x${h}@${dpr}x.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
```
Mantener la lista idéntica a `DEVICES` del script (comentario cruzado en ambos).

- [ ] **Step 4: Verificar**

```bash
npx next build && npm run start
curl -s http://localhost:3000/ | grep -o 'apple-touch-startup-image' | wc -l
```
Expected: `12`. Con el preview en `resize_window` móvil, comprobar que `/splash/splash-390x844@3x.png` carga (1170×2532, Doty centrado sobre crema).

- [ ] **Step 5: Commit**

```bash
git add scripts/mj/compose-splash.mjs public/splash app/layout.tsx package.json
git commit -m "feat(pwa): splash de iOS compuesto desde el icono de Doty"
```

---

### Task 18: Screenshots del manifest

**Files:**
- Create: `public/screenshots/camino-narrow.png`, `juegos-narrow.png`, `leccion-narrow.png`, `camino-wide.png`
- Modify: `app/manifest.ts` (campo `screenshots`)

**Interfaces:**
- Consumes: arte de Tasks 15–16 ya en la app (las capturas deben mostrar el Doty nuevo).

- [ ] **Step 1: Capturar con el build de producción** (`dots-webapp-prod` del launch.json, sesión iniciada con la cuenta de prueba)

Con `resize_window` a `390×844` capturar `/levels`, `/play` y una lección en curso; con `1280×800` capturar `/levels`. Guardar los PNG desde el navegador en `public/screenshots/` con los nombres de arriba (la herramienta de captura del pane escribe a disco; si no, `magick import` sobre la ventana no sirve en Wayland: usar la captura del pane).

- [ ] **Step 2: Declarar en `app/manifest.ts`** (después de `icons`)

```ts
    screenshots: [
      { src: "/screenshots/camino-narrow.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "El Camino: niveles y lecciones" },
      { src: "/screenshots/juegos-narrow.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "12 juegos para practicar" },
      { src: "/screenshots/leccion-narrow.png", sizes: "390x844", type: "image/png", form_factor: "narrow", label: "Lecciones cortas con Doty" },
      { src: "/screenshots/camino-wide.png", sizes: "1280x800", type: "image/png", form_factor: "wide", label: "El Camino en escritorio" },
    ],
```
Ajustar `sizes` a las dimensiones reales (`magick identify public/screenshots/*.png`).

- [ ] **Step 3: Verificar y commitear**

```bash
npx next build && npm run start
```
DevTools → Application → Manifest muestra las 4 capturas sin advertencias. `npm run lint` pasa.

```bash
git add public/screenshots app/manifest.ts
git commit -m "feat(pwa): screenshots del manifest con el Doty nuevo"
```

---

### Task 19: Tiles PNG de los 12 juegos en el grid

**Files:**
- Modify: `components/play/games-grid-view.tsx:12-38,58-101`

**Interfaces:**
- Consumes: `public/images/games/<key>.png` (12, Task 15).

- [ ] **Step 1: Sustituir el mapa de skins**

```ts
/** Identidad visual por juego: tile PNG (scripts/mj, spec 2026-09-07 §3.9) + tono. */
type Skin = { img: string; hue: string };

const tile = (key: string) => `/images/games/${key}.png`;

const SKIN: Record<string, Skin> = {
  "/wordle": { img: tile("wordle"), hue: "--success" },
  "/crossword": { img: tile("crossword"), hue: "--primary" },
  "/dot-match": { img: tile("dot-match"), hue: "--gem" },
  "/true-false": { img: tile("true-false"), hue: "--accent" },
  "/memory": { img: tile("memory"), hue: "--primary" },
  "/audio-blitz": { img: tile("audio-blitz"), hue: "--gem" },
  "/word-tower": { img: tile("word-tower"), hue: "--gold" },
  "/sentence-builder": { img: tile("sentence-builder"), hue: "--flame" },
  "/ghost-race": { img: tile("ghost-race"), hue: "--primary" },
  "/dotaxi": { img: tile("dotaxi"), hue: "--gold" },
  "/dont-pop": { img: tile("dont-pop"), hue: "--accent" },
  "/dot-bombs": { img: tile("dot-bombs"), hue: "--flame" },
};

const FALLBACK: Skin = { img: tile("memory"), hue: "--accent" };
```
Borrar las constantes `Bomb` y `Balloon`. En el render del glifo (líneas ~58–101) eliminar la rama `emoji`: `GlyphSize` pasa a `{ img: string }` y el componente devuelve siempre el `<Image>`. Conservar el comentario de que son iconos de la primera pantalla y no se difieren.

- [ ] **Step 2: Verificar**

```bash
npx tsc --noEmit && npm run lint && npx next build
```
Preview `/play`: 12 tiles nítidos en los tres bloques (hoy / arcade / bloqueados, este último en gris por el filtro existente).

- [ ] **Step 3: Commit**

```bash
git add components/play/games-grid-view.tsx
git commit -m "feat(play): tiles ilustrados para los 12 juegos"
```

---

### Task 20: Backend — `scripts/set-doty-art.js` (personajes a Cloudinary + poses de dificultad)

**Files:**
- Create: `dots-backend/scripts/set-doty-art.js`
- Modify: `dots-backend/package.json` (script `"doty:art": "node scripts/set-doty-art.js"`)

**Interfaces:**
- Consumes: `$RAW/fase-1/out/characters/{doty-fem,doty-sailor,doty-scientist}.png` (Task 15).
- Produces: `characters.img` (3 URLs Cloudinary), `difficulty.img` (`bienvenido`/`sigue-asi`/`orgulloso`), respaldo `scripts/out/backup-doty-art-<ts>.json`.

- [ ] **Step 1: Escribir el script**

```js
/**
 * Arte de Doty en BD (spec webapp 2026-09-07-doty-midjourney-assets §7).
 *   node scripts/set-doty-art.js --src /ruta/out/characters            # dry-run
 *   node scripts/set-doty-art.js --src /ruta/out/characters --apply    # sube + UPDATE (6 filas)
 *   node scripts/set-doty-art.js --rollback scripts/out/backup-doty-art-<ts>.json
 * Lee DB_* y CLOUDINARY_* del .env (mismo loader que migrate-media-to-cloudinary.js).
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUT_DIR = path.join(__dirname, 'out');
const CHARACTERS = ['doty-fem', 'doty-sailor', 'doty-scientist'];
const DIFFICULTY_POSES = { beginner: 'bienvenido', intermediate: 'sigue-asi', advanced: 'orgulloso' };

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
  return i === -1 ? null : process.argv[i + 1] ?? true;
}

async function upload(cloudinary, file, key) {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { public_id: `dots/images/characters/${key}`, resource_type: 'image', overwrite: true, invalidate: true },
        (err, r) => (err || !r ? reject(err ?? new Error('empty result')) : resolve(r.secure_url)),
      )
      .end(fs.readFileSync(file));
  });
}

async function rollback(db, file) {
  const entries = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const e of entries) {
    await db.query(`UPDATE ${e.table} SET img = $1 WHERE id = $2`, [e.old, e.id]);
  }
  console.log(`Rolled back ${entries.length} rows from ${file}`);
}

async function main() {
  loadEnv();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const apply = process.argv.includes('--apply');
  const rollbackFile = arg('--rollback');
  const src = arg('--src');

  const db = new Client({
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: { rejectUnauthorized: false },
  });
  await db.connect();
  await db.query('SET search_path TO dots');
  try {
    if (rollbackFile) return await rollback(db, rollbackFile);
    if (!src) throw new Error('--src <carpeta con doty-fem.png, doty-sailor.png, doty-scientist.png> es obligatorio');
    for (const k of CHARACTERS) {
      if (!fs.existsSync(path.join(src, `${k}.png`))) throw new Error(`falta ${k}.png en ${src}`);
    }
    const chars = (await db.query('SELECT id, key, img FROM characters WHERE key = ANY($1)', [CHARACTERS])).rows;
    const diffs = (await db.query('SELECT id, name, img FROM difficulty')).rows;
    console.log('characters:', chars.map((c) => `${c.key} img=${c.img ?? 'NULL'}`).join(' | '));
    console.log('difficulty:', diffs.map((d) => `${d.name} img=${d.img}`).join(' | '));
    if (!apply) return console.log('\n(dry-run — nada escrito. Usa --apply.)');

    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) throw new Error('CLOUDINARY_* requeridas');
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET });

    const backup = [];
    const backupFile = path.join(OUT_DIR, `backup-doty-art-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    for (const c of chars) {
      const url = await upload(cloudinary, path.join(src, `${c.key}.png`), c.key);
      await db.query('UPDATE characters SET img = $1 WHERE id = $2', [url, c.id]);
      backup.push({ table: 'characters', id: c.id, old: c.img, new: url });
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      console.log(`${c.key} → ${url}`);
    }
    for (const d of diffs) {
      const pose = DIFFICULTY_POSES[d.name];
      if (!pose) { console.warn(`difficulty ${d.name}: sin pose asignada, se deja ${d.img}`); continue; }
      await db.query('UPDATE difficulty SET img = $1 WHERE id = $2', [pose, d.id]);
      backup.push({ table: 'difficulty', id: d.id, old: d.img, new: pose });
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      console.log(`difficulty ${d.name} → ${pose}`);
    }
    console.log(`\nRespaldo: ${backupFile}`);
  } finally {
    await db.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run, aplicar, verificar**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend && source ~/.nvm/nvm.sh && nvm use
npm run doty:art -- --src "$RAW/fase-1/out/characters"            # dry-run: 3 characters con img=NULL, 3 difficulty 01/04/17
npm run doty:art -- --src "$RAW/fase-1/out/characters" --apply
npm run doty:art -- --src "$RAW/fase-1/out/characters"            # ahora muestra las URLs y los slugs
```
En la webapp (preview), una lección con narrador `doty-fem` muestra el PNG de Cloudinary en `VoiceAvatar`; `/levels` muestra `bienvenido`/`sigue-asi`/`orgulloso` en las tres dificultades. Si algo sale mal: `npm run doty:art -- --rollback scripts/out/backup-doty-art-<ts>.json`.

- [ ] **Step 3: Commit (backend)**

```bash
git add scripts/set-doty-art.js package.json
git commit -m "feat(scripts): set-doty-art — personajes a Cloudinary y poses de dificultad"
```

---

### Task 21: Borrado de los 22 legacy y `--strict`

**Files:**
- Delete: `public/images/Doty/DOTTY-POSES-01.png` … `-22.png`
- Modify: `package.json` (`lint` con `--strict`), `docs/ARQUITECTURA.md:7`

**Interfaces:**
- Precondición: las 81 piezas de registro con `done: true` (`grep -c '"done": true' scripts/mj/batches/fase-1.json` ≥ 81) y registro regenerado.

- [ ] **Step 1: Verificar la precondición y borrar**

```bash
uv run --python 3.12 scripts/mj/process.py --emit-registry fase-1
grep -c "DOTTY-POSES" components/ui/doty/poses.ts    # debe ser 0
git rm public/images/Doty/DOTTY-POSES-*.png
```

- [ ] **Step 2: Endurecer el lint**

`package.json`: `"lint": "eslint && node scripts/check-doty-assets.mjs --strict"`. Ejecutar `npm run lint`: `81 poses OK (strict)`. Si reporta huérfanos, son PNG que `--apply` escribió para piezas luego renombradas: borrarlos.

- [ ] **Step 3: Actualizar la referencia de ARQUITECTURA.md línea 7**

`Mascota: Doty (`components/ui/doty/doty.tsx`, registro generado `components/ui/doty/poses.ts`, sprites en `public/images/Doty/<grupo>/`, pipeline en `scripts/mj/`).`

- [ ] **Step 4: Build, preview de humo (onboarding, camino, lección, juego, tienda vacía, admin) y commit**

```bash
npx next build
git add -A public/images/Doty package.json components/ui/doty/poses.ts docs/ARQUITECTURA.md
git commit -m "chore(doty): adiós a los 22 DOTTY-POSES; check de assets en modo strict"
```

---

### Task 22: Documentación de marca, CLAUDE.md y memoria

**Files:**
- Create: `docs/brand/doty-identity.md` (partiendo de `git show redesign/doty-brand:docs/brand/doty-identity.md`)
- Modify: `CLAUDE.md` (regla 10), `docs/superpowers/specs/2026-09-07-doty-midjourney-assets-design.md` (estado)
- Memoria: `~/.claude/projects/-home-endurance-Projects-Endurance-dots-dots-webapp/memory/doty-brand-redesign.md`, `factibilidad-pwa-vs-rn.md`

- [ ] **Step 1: `docs/brand/doty-identity.md`**

Partir del archivo de la rama y reescribir estas secciones: (a) canon **sin anteojos** y los tres personajes con sus rasgos; (b) "Cómo renderizar": `pose` tipada, `toDotyPose` para strings dinámicos, `shadow`, `DotySticker`; (c) catálogo: tabla grupo → slugs tal como quedó `fase-1.json` (sin tier hero, sin escenarios); (d) tabla contexto → pose actualizada con las elecciones de Tasks 11–12 (éxito `excelente`/`perfecto`, error `oh-no`, vacío `timido`, carga `pensando`, bienvenida `saludando`/`bienvenido`, récord `trofeo-celebracion`, avatar de voz `hablando`); (e) sección nueva "Cómo pedir una pose nueva": añadir la pieza a `scripts/mj/batches/fase-1.json` con `fallback`, `--emit-prompts`, generar, `--apply`, `--emit-registry`, commit.

- [ ] **Step 2: Regla 10 en `CLAUDE.md`** (después de la regla 9)

```markdown
10. **Doty.** Solo se renderiza con `<Doty pose=…>` y poses del registro **generado** `components/ui/doty/poses.ts` (strings dinámicos pasan por `toDotyPose`). Las piezas nuevas entran por `scripts/mj/` (catálogo → prompts → `--apply` → `--emit-registry`), nunca copiando PNG a mano a `public/images/Doty/`; `npm run lint` lo verifica (`check-doty-assets --strict`). Guía de tono→pose: `docs/brand/doty-identity.md`.
```

- [ ] **Step 3: Estado en la spec** — en la cabecera cambiar `Estado` a "implementado (fases 0 y 1) el <fecha>; pendientes: fases 2–4 y spec de ejercicios sin imagen" y anotar en §9 los minutos reales.

- [ ] **Step 4: Memoria**

En `doty-brand-redesign.md`: la rama `redesign/doty-brand` queda obsoleta (lo útil se portó: registro, componente, keyframes, doc de marca); no mergear. En `factibilidad-pwa-vs-rn.md`: eliminar el "Bug abierto" del prop `animation` (cerrado) y anotar que iconos, splash y screenshots de la PWA ya existen. Actualizar `MEMORY.md` si cambia alguna descripción.

- [ ] **Step 5: Commit**

```bash
git add docs/brand/doty-identity.md CLAUDE.md docs/superpowers/specs/2026-09-07-doty-midjourney-assets-design.md
git commit -m "docs(doty): identidad de marca actualizada, regla 10 y cierre de fases 0–1"
```

---

## Self-review (hecho al escribir el plan)

- **Cobertura de la spec:** §2 → Tasks 1 y 14; §3 → Task 8 (catálogo) + 15 (generación) + 16/17/18 (icono, splash, screenshots) + 19 (tiles) + 20 (personajes); §4.1–4.4 → Tasks 10 y 13; §4.5 → Tasks 11, 12 y 20; §4.6 → Tasks 9 y 21; §5 → Tasks 2–7; §6 → Tasks 14–15; §7 → Task 20; §8 → Tasks 21–22; §12 criterios → Steps de verificación de Tasks 12, 16, 20, 21.
- **Desvíos respecto a la spec, deliberados:** los `out` del catálogo se calculan (`output_path`) en vez de escribirse a mano; la pieza `hablando` eleva poses a 16 y el total a 97 tal como quedó aprobado; las celebraciones `trofeo`/`diploma` se llaman `trofeo-celebracion`/`diploma-celebracion` para no chocar con los accesorios (mismo criterio que la rama de marca).
- **Consistencia de nombres:** `registry_key`, `registry_src`, `output_path`, `match_downloads`, `apply_batch`, `render_report` se usan con la misma firma en Tasks 2–7; `toDotyPose`/`isDotyPose` se exportan desde `poses.ts` y se re-exportan en `doty.tsx` (Task 10) y así los consumen Tasks 12–13.
