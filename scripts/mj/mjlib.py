"""Pipeline de arte de Doty. `apply_batch` sí toca disco (recorre directorios, abre y
guarda PNG, reescribe el catálogo) — la costura no es "sin efectos", es que ninguna
dependencia externa queda sin inyectar: rembg lo pasa process.py como `remover`, y toda
ruta de E/S llega como parámetro en vez de resolverse adentro. Eso es lo que permite
probar `apply_batch` con un remover falso y un `tmp_path`, sin mockear nada de verdad."""
from __future__ import annotations
import json
import re
from pathlib import Path
from typing import Callable
from PIL import Image, ImageChops, ImageFilter

REGISTRY_GROUPS = ("expressions", "poses", "states", "celebrations", "accessories", "themed", "stickers", "icons")
EXTRA_GROUPS = ("games", "characters", "app-icon", "levels", "ui", "avatars")
# El slug se interpola tal cual en una ruta de disco (output_path) y en una clave
# de TypeScript generada (_ts_key cita pero no escapa) — kebab-case en minúsculas
# es lo único seguro para ambos destinos.
SLUG_RE = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*$")


class CatalogError(ValueError):
    pass


def load_style(path: Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_catalog(path: Path) -> dict:
    cat = json.loads(Path(path).read_text(encoding="utf-8"))
    validate_catalog(cat)
    return cat


_OSCURO = re.compile(r"\b(navy|black|charcoal|dark gr[ae]y|dark blue)\b", re.I)
# Lo que puede ser oscuro sin hundirse: una línea (outline, border, frame, edge,
# stroke, contour) y los rasgos pequeños de la cara. La pupila navy es de marca —
# el propio `brand_lock` dice "the navy eyes with white highlights" — y se lee
# porque va rodeada de blanco, no de fondo.
_COMO_DETALLE = re.compile(
    r"^[\s-]*(outline|border|frame|framed|edge|stroke|contour|line"
    r"|eye|pupil|iris|eyebrow|lash|lashes)s?\b", re.I)


def dark_fill_mentions(prompt: str) -> list[str]:
    """Menciones de color oscuro que piden RELLENO en vez de línea o rasgo.

    El navy es la línea de la marca — "thick navy outlines", "a navy border",
    "navy-framed glasses" — y ahí es correcto. Como masa es el criterio 5 al
    revés: sobre el fondo del tema oscuro el navy mide 1.18:1 y la forma se
    funde con el fondo.

    Ocho prompts pedían navy de relleno ("pink, navy and blue bricks", "navy
    laptop", "navy blue book") y ese era el origen real de las piezas que no se
    leían: no era deriva del modelo, era lo que le pedíamos. Se comprueba aquí y
    no de memoria porque la instrucción vive en el catálogo, no en la cabeza.
    """
    fallos = []
    for m in _OSCURO.finditer(prompt or ""):
        if not _COMO_DETALLE.match(prompt[m.end():]):
            fallos.append(m.group(0).lower())
    return fallos


def validate_catalog(cat: dict) -> None:
    if not isinstance(cat.get("fase"), str) or not isinstance(cat.get("pieces"), list):
        raise CatalogError("catalog needs 'fase' (str) and 'pieces' (list)")
    slugs, prefixes = set(), {}
    anchors_by_group: dict[str, str] = {}
    non_mascot_groups: set[str] = set()
    for p in cat["pieces"]:
        slug = p.get("slug")
        if not slug or slug in slugs:
            raise CatalogError(f"duplicate or missing slug: {slug!r}")
        slugs.add(slug)
        if not (isinstance(slug, str) and SLUG_RE.fullmatch(slug)):
            raise CatalogError(f"{slug!r}: slug must be lowercase kebab-case (a-z0-9, hyphen-separated)")
        oscuros = dark_fill_mentions(p.get("prompt"))
        if oscuros:
            raise CatalogError(
                f"{slug!r}: el prompt pide {', '.join(sorted(set(oscuros)))} de relleno. "
                "El navy es la línea de la marca, no la masa: sobre el tema oscuro mide "
                "1.18:1 y la forma se funde con el fondo (criterio 5). Dilo como línea "
                "('navy outline', 'navy border', 'navy-framed') o usa un color claro.")
        prefix = p.get("prefix")
        if not prefix:
            raise CatalogError(f"missing prefix for {slug!r}")
        norm = normalize(prefix)
        if not norm:
            raise CatalogError(f"{slug!r}: prefix {prefix!r} normalizes to empty — would match every filename")
        for other_norm, other_slug in prefixes.items():
            if norm in other_norm or other_norm in norm:
                raise CatalogError(
                    f"{slug!r}: prefix {prefix!r} collides with {other_slug!r} "
                    f"({norm!r} vs {other_norm!r}) — downloads would match both"
                )
        prefixes[norm] = slug
        group = p.get("group")
        if group not in REGISTRY_GROUPS + EXTRA_GROUPS:
            raise CatalogError(f"{slug}: invalid group {group!r}")
        if not isinstance(p.get("size"), int) or p["size"] <= 0:
            raise CatalogError(f"{slug}: size must be a positive int")
        if p.get("aspect") is not None and not (isinstance(p["aspect"], str) and re.fullmatch(r"\d+:\d+", p["aspect"])):
            raise CatalogError(f"{slug}: aspect must look like '3:1' (got {p['aspect']!r})")
        if not isinstance(p.get("done"), bool):
            raise CatalogError(f"{slug}: done must be bool")
        if not p.get("mascot"):
            non_mascot_groups.add(group)
        if p.get("edit_from"):
            # Variante editada a partir de OTRA pieza del catálogo (p. ej. el
            # taxi abollado a partir del intacto): la única forma de que las
            # dos sean el mismo objeto. La fuente tiene que ser una pieza real,
            # no mascota (esas ya editan desde ref-patron) y no un ancla.
            src = p["edit_from"]
            if p.get("mascot"):
                raise CatalogError(f"{slug}: edit_from requires mascot: false (mascot pieces edit from the fixed source)")
            if p.get("anchor"):
                raise CatalogError(f"{slug}: an anchor cannot be an edit_from variant — it would inherit instead of define the group's look")
            fuente = next((q for q in cat["pieces"] if q.get("slug") == src), None)
            if fuente is None:
                raise CatalogError(f"{slug}: edit_from {src!r} is not a slug in this catalog")
            if fuente.get("mascot"):
                raise CatalogError(f"{slug}: edit_from {src!r} is a mascot piece; variants of Doty go through the fixed edit source")
            if fuente.get("group") != group:
                raise CatalogError(f"{slug}: edit_from {src!r} is in group {fuente.get('group')!r}, not {group!r}")
        if p.get("anchor"):
            if p.get("mascot"):
                raise CatalogError(
                    f"{slug}: anchor requires mascot: false (mascot pieces use the fixed "
                    "edit source instead — an anchor there would mislead the operator)"
                )
            if group in anchors_by_group:
                raise CatalogError(
                    f"{slug}: group {group!r} already has an anchor ({anchors_by_group[group]!r}) "
                    "— at most one anchor per group"
                )
            anchors_by_group[group] = slug
    for group in non_mascot_groups:
        if group not in anchors_by_group:
            offending = next(p["slug"] for p in cat["pieces"] if p["group"] == group and not p.get("mascot"))
            raise CatalogError(
                f"{offending}: group {group!r} has non-mascot pieces but no piece has "
                "anchor: true — exactly one anchor is required per non-mascot group"
            )


def registry_key(piece: dict) -> str:
    return f"sticker-{piece['slug']}" if piece["group"] == "stickers" else piece["slug"]


def _relative_output(piece: dict, fase: str) -> str:
    """Parte de output_path() que no depende de dónde vivan el repo o las descargas
    — la reutiliza emit_lote para mostrarle al operador un destino legible sin
    tener que pasarle raíces de disco (emit_lote es una función pura)."""
    g, s = piece["group"], piece["slug"]
    if g in REGISTRY_GROUPS:
        return f"public/images/Doty/{g}/{s}.png"
    if g == "games":
        return f"public/images/games/{s}.png"
    if g == "characters":
        return f"{fase}/out/characters/{s}.png"
    if g == "levels":
        return f"public/images/levels/{s}.png"
    if g == "ui":
        return f"public/images/ui/{s}.png"
    if g == "avatars":
        return f"public/images/avatars/{s}.png"
    return f"{fase}/out/app-icon.png"


def output_path(piece: dict, fase: str, repo_root: Path, raw_root: Path) -> Path:
    root = raw_root if piece["group"] in ("characters", "app-icon") else repo_root
    return Path(root) / _relative_output(piece, fase)


def build_prompt(piece: dict, style: dict) -> str:
    """Dos formas, según `piece["mascot"]` (spec §5.1-bis).

    Mascota → instrucción de Edit: sin flags, el Edit Model no los toma. Pega junto
    a `style["edit_source"]` adjunta como fuente (ver `emit_prompts`).

    No-mascota (icons/games) → texto a imagen de siempre, con `--ar`/`--stylize`/`--no`
    y el filtro de `glasses` por pieza. Sin cambios respecto al comportamiento previo
    a la fase 0-bis.
    """
    if piece.get("edit_from"):
        # Variante de otra pieza: instrucción para el Edit Model, sin flags, con
        # la descarga original de la fuente adjunta (ver emit_lote). Se pide
        # conservar todo lo demás para que las variantes sean el mismo objeto.
        return ", ".join([
            piece["prefix"], piece["prompt"],
            "keep everything else exactly as in the source image: same object, same colors, "
            "same thick navy outline, same framing, plain white background",
        ])
    if piece.get("mascot"):
        # El brand_lock por defecto fija el cuerpo rosa. Los narradores derivados
        # (doty-fem, doty-sailor, doty-scientist) llevan otro color de cuerpo para
        # distinguirse a tamaño de avatar, asi que traen el suyo: sin esto la
        # instruccion se contradiria a si misma, como paso con los anteojos.
        lock = piece.get("brand_lock") or style["brand_lock"]
        # Igual con el encuadre: el app-icon es un primer plano de cabeza y hombros,
        # y el framing por defecto pide cuerpo entero — se contradirian.
        marco = piece.get("framing") or style["framing"]
        return ", ".join([piece["prefix"], piece["prompt"], lock, marco])
    negativos = style["negative"]
    if piece.get("glasses"):
        negativos = [n for n in negativos if n != "glasses"]
    body = ", ".join([piece["prefix"], piece["prompt"], style["icon_block"]])
    # `aspect` por pieza: un skyline es una franja 3:1, no un cuadrado. La
    # salida sigue pasando por trim_square_resize (lienzo cuadrado con aire
    # transparente), así que `size` debe ser el lado largo para no perder resolución.
    ar = piece.get("aspect") or style["aspect"]
    flags = " ".join([f"--ar {ar}", f"--stylize {style['stylize']}",
                       "--no " + ", ".join(negativos)])
    return f"{body} {flags}"


def emit_prompts(cat: dict, style: dict) -> str:
    lines = [f"# {cat['fase']} — prompts", "",
             "**Trabaja en V8.2.** El Edit Model corre ahí directamente: no hace falta forzar V7 "
             "ni ningún parámetro de línea de comandos para sostener el personaje.",
             "",
             f"Para las piezas de **mascota** (🎨 en la lista): adjunta `{style['edit_source']}` "
             "en la fila **\"Attach to prompt\"** y pega la instrucción tal cual, sin nada más. "
             "**Usa siempre esa misma imagen fuente — nunca encadenes** una salida como fuente de "
             "la siguiente: el Edit Model hereda el acabado y el encuadre de la fuente, y encadenar "
             "acumula deriva.",
             "",
             "Para las piezas de **icono** (🔤 en la lista, llevan `--ar`): texto a imagen normal, "
             "sin ninguna imagen adjunta.",
             "",
             "Descarga la imagen elegida a la carpeta de este lote sin renombrarla: Midjourney nombra "
             "el archivo por las primeras palabras del prompt, y así es como el pipeline la mapea de "
             "vuelta a la pieza.", ""]
    for i, p in enumerate(cat["pieces"], 1):
        target = f"{p['group']}/{p['slug']}.png"
        status = " ✅" if p.get("done") else ""
        kind = "🎨 mascota" if p.get("mascot") else "🔤 icono"
        lines += [f"{i}. `{p['slug']}` → `{target}`{status} · {kind}", "", "```", build_prompt(p, style), "```", ""]
    return "\n".join(lines)


# Ocho hechos aprendidos con defectos reales (spec §6): cada uno es la regla que un
# lote anterior violó. No son estética general, son los criterios que un operador
# nuevo necesita para no repetir el mismo error.
ACCEPTANCE_CRITERIA = (
    "El estilo coincide con el grupo: plano y de contorno grueso redondeado en "
    "`icons`/`games`; el look propio de la mascota en el resto.",
    "Paleta de marca: rosa `#FF1F8F`, navy `#1E1B5C`, azul `#3768FF`, cyan `#35D8F5`.",
    "**Sin anteojos** (excepto la pieza `lentes`) y **sin zapatos** — Doty no lleva "
    "ninguno de los dos.",
    "Contorno navy alrededor de toda la figura.",
    "**Nada negro ni navy como masa grande**: sobre el fondo del tema oscuro de la app "
    "el navy mide un contraste de 1.18:1 y desaparece.",
    "**Nada flotando despegado** de la figura principal: `rembg` lo borra (así "
    "desaparecieron las Zs de un `dormido` temprano).",
    "Cuerpo entero, sin cortes en los bordes; fondo blanco liso, sin sombra en el suelo.",
    "Brazos y patas terminan en formas **sólidas y redondeadas**, nunca en un tubo "
    "abierto con el interior navy: se lee como un miembro cortado, y además es masa "
    "navy grande (criterio 5).",
    "Legible sin leer el prompt.",
)


# Aviso de transición dentro de un grupo mixto (spec: primer caso `levels`, 22
# mascota + 16 icono): el bloque de icono deja el ancla puesta en Style
# reference, y si nadie la saca al llegar a la primera mascota, el `--sref`
# aplana a Doty igual que le pasó a doce piezas reales.
SEPARADOR_SREF_VACIO = (
    "> ⬇️ **A partir de aquí, vacía el slot _Style reference_.** Estas piezas "
    "llevan `ref-patron.png` en *Attach to prompt* y nada más: el `--sref` del "
    "ancla las aplana y Doty pierde el brillo, el párpado lila y el destello del "
    "ojo."
)


def _slots_line(cat: dict, piece: dict, style: dict) -> str:
    """Qué va en cada slot de Midjourney para ESTA pieza, sin tener que deducirlo
    de la cabecera: la confusión entre *Attach to prompt* (Edit Model) y *Style
    reference* (--sref) fue lo que produjo un Doty genérico en la fase 1-bis."""
    if piece.get("mascot"):
        return (f"> 📎 **Attach to prompt:** `{style['edit_source']}` · "
                "🎨 **Style reference:** VACÍO (sácalo si quedó el ancla de un grupo anterior)")
    if piece.get("edit_from"):
        fuente = next(q for q in cat["pieces"] if q["slug"] == piece["edit_from"])
        origen = (f"`{cat['fase']}/{fuente['source_file']}`" if fuente.get("source_file")
                  else f"la descarga que elijas de `{fuente['slug']}` (misma carpeta)")
        return f"> 📎 **Attach to prompt:** {origen} · 🎨 **Style reference:** VACÍO"
    ancla = next((q for q in cat["pieces"] if q.get("group") == piece["group"] and q.get("anchor")), None)
    if ancla is None or ancla["slug"] == piece["slug"]:
        return "> 📎 **Attach to prompt:** nada · 🎨 **Style reference:** VACÍO (esta pieza ES el ancla del grupo)"
    ref = f"`{cat['fase']}/{ancla['source_file']}`" if ancla.get("source_file") else f"la descarga elegida de `{ancla['slug']}`"
    return f"> 📎 **Attach to prompt:** nada · 🎨 **Style reference:** {ref} (ancla `{ancla['slug']}`)"


def emit_lote(cat: dict, style: dict, grupos: list[str],
              pendientes_solo: bool = False) -> str:
    """Markdown de un lote de trabajo para uno o más grupos (spec §6): lo que Claude
    genera cada vez que Sergio trabaja grupo a grupo, en vez del PROMPTS.md de la fase
    entera que emite `emit_prompts`. Las instrucciones de adjunto que trae dependen de
    lo que haya en `grupos` — mascota, no-mascota, o una mezcla de ambas.

    No-mascota necesita una explicación que `emit_prompts` no tiene: sin una fuente fija
    que las sostenga, 18 piezas independientes derivan en grosor de línea, radio de
    esquina y sombreado. La herramienta es el ancla marcada en el catálogo (`anchor:
    true`, exactamente una por grupo no-mascota — lo exige `validate_catalog`): se genera
    primero sin nada adjunto y su mejor resultado va al slot Style reference del resto.
    """
    # `pendientes_solo` deja fuera lo ya bueno. Sin esto un lote de regeneración
    # sale con 60 piezas de las que 48 llevan ✅, y hay que ir a buscar las 12
    # que importan entre ellas.
    pendiente = lambda p: (not p.get("done")) or bool(p.get("regen"))
    por_grupo: dict[str, list[dict]] = {}
    for g in grupos:
        piezas_g = [p for p in cat["pieces"] if p["group"] == g]
        # Orden de trabajo: primero las de texto a imagen (sref del ancla puesto),
        # después las ediciones (sref vacío, fuente adjunta). Así el operador
        # cambia los slots una vez por bloque y no en cada pieza.
        piezas_g = sorted(piezas_g, key=lambda p: 1 if p.get("edit_from") else 0)
        if not piezas_g:
            raise CatalogError(f"grupo {g!r} no tiene piezas en el catálogo")
        if pendientes_solo:
            piezas_g = [p for p in piezas_g if pendiente(p)]
        if piezas_g:
            por_grupo[g] = piezas_g
    pieces = [p for g in grupos if g in por_grupo for p in por_grupo[g]]

    hay_mascota = any(p.get("mascot") for p in pieces)
    hay_icono = any(not p.get("mascot") for p in pieces)

    lines = [f"# Lote: {' + '.join(grupos)} ({len(pieces)} piezas)", ""]

    if hay_mascota:
        lines += [
            f"**Piezas de mascota** (🎨): adjunta `{style['edit_source']}` en la fila "
            "**\"Attach to prompt\"** — la misma imagen fuente para todas, siempre. "
            "**El slot _Style reference_ va vacío**: si quedó puesto el ancla de un "
            "grupo anterior, sácalo antes de generar — el `--sref` aplana a Doty y le "
            "borra el brillo especular, el párpado lila, el destello del ojo, la "
            "lengua y el grosor variable del contorno. **Nunca encadenes** una salida "
            "como fuente de la siguiente: el Edit Model hereda el acabado y el "
            "encuadre de la fuente, y encadenar acumula deriva.",
            "",
        ]
    if hay_icono:
        lines += [
            "**Piezas de icono** (🔤): **no se adjunta ninguna imagen en \"Attach to "
            "prompt\"**. Cada grupo no-mascota trae su propio ancla — no se comparte "
            "entre grupos —: antes de la primera pieza de cada grupo, genera la "
            "marcada `⚓ ANCLA` como diga su propia línea — normalmente sin nada "
            "adjunto, salvo que indique lo contrario — (o recupera la que ya "
            "elegiste en un lote anterior de ese grupo) y arrástrala al slot "
            "**Style reference**, reemplazando lo que hubiera ahí, "
            "antes de seguir con el resto de ese grupo. **No es \"Attach to prompt\"**: "
            "esa fila es el Edit Model y hace otra cosa. Midjourney inserta el `--sref` "
            "solo al soltar la imagen ahí; no lo escribas en el prompt.",
            "",
        ]

    lines += [
        "Descarga una imagen por pieza, sin renombrar: Midjourney nombra el archivo por "
        "las primeras palabras del prompt, y así es como el pipeline la mapea de vuelta "
        "a la pieza. Pega cada prompt tal cual, completo.",
        "",
    ]

    lines += ["## Criterios de acierto", ""]
    lines += [f"{i}. {c}" for i, c in enumerate(ACCEPTANCE_CRITERIA, 1)]
    lines += ["", "---", ""]

    n = 0
    for g in grupos:
        if g not in por_grupo:
            continue
        # El ancla encabeza: la cabecera manda generarla primero, sin nada
        # adjunto, y si cae a mitad de grupo esa instrucción es letra muerta.
        # Los iconos (con ella al frente) van antes que las mascotas por el
        # mismo motivo práctico, no por estética: el slot Style reference se
        # pone una vez, con el ancla, y se saca una vez, al llegar a la primera
        # mascota — en vez de alternarlo pieza a pieza si los tipos vinieran
        # intercalados como trae el catálogo de `levels`, el primer grupo con
        # los dos juntos. Orden estable: dentro de cada bloque se conserva el
        # orden de catálogo.
        piezas_g = sorted(por_grupo[g], key=lambda p: (not p.get("anchor"), bool(p.get("mascot"))))
        lines += [f"## Grupo: {g} ({len(piezas_g)})", ""]
        mixto = any(p.get("mascot") for p in piezas_g) and any(not p.get("mascot") for p in piezas_g)
        cruzo_a_mascota = False
        for p in piezas_g:
            if mixto and p.get("mascot") and not cruzo_a_mascota:
                lines += [SEPARADOR_SREF_VACIO, ""]
                cruzo_a_mascota = True
            n += 1
            marcador = ("🎨 mascota" if p.get("mascot")
                        else "🖌️ edición" if p.get("edit_from") else "🔤 icono")
            destino = _relative_output(p, cat["fase"])
            status = (" ♻️ **REGENERAR** — el arte actual se publica, pero esta pieza "
                      "espera una mejor" if p.get("regen")
                      else " ✅" if p.get("done") else "")
            # `anchor_sref` es la excepcion: un ancla que en vez de generarse
            # desde cero toma prestado el acabado de OTRA fase ya cerrada,
            # pegando esa imagen en Style reference desde el primer intento
            # -- describirle la paleta con palabras no bastó (gemas, fase 3).
            # Sin el campo, el texto no cambia: no puede afectar a los grupos
            # que sí generan su ancla sin nada adjunto.
            if not p.get("anchor"):
                ancla = ""
            elif p.get("anchor_sref"):
                ancla = (" · ⚓ **ANCLA de este grupo — generar con "
                          f"`{p['anchor_sref']}` en Style reference** (esta ancla "
                          "sí lleva algo adjunto, a diferencia de las demás)")
            else:
                ancla = " · ⚓ **ANCLA de este grupo — generar primero, sin nada adjunto**"
            lines += [f"### {n}. `{p['slug']}` · {marcador} → `{destino}`{status}{ancla}", ""]
            lines += [_slots_line(cat, p, style), ""]
            if p.get("edit_from"):
                fuente = next(q for q in cat["pieces"] if q["slug"] == p["edit_from"])
                if fuente.get("source_file"):
                    lines += [f"> 🖌️ Edit Model: adjunta **`{cat['fase']}/{fuente['source_file']}`** en "
                              f"*Attach to prompt* — la descarga ORIGINAL de `{fuente['slug']}`, no el "
                              "recorte publicado. El slot *Style reference* va vacío.", ""]
                else:
                    lines += [f"> 🖌️ Edit Model a partir de `{fuente['slug']}`, que **aún no está generada**: "
                              "genérala primero y adjunta aquí, en *Attach to prompt*, la MISMA descarga que "
                              "elijas para ella (basta con que esté en esta carpeta; no hace falta aplicarla). "
                              "El slot *Style reference* va vacío.", ""]
            lines += ["```", build_prompt(p, style), "```", ""]
    return "\n".join(lines)


# Qué ve una pieza de registro cuya arte aún no llegó. Antes era uno de los 22
# sprites legacy elegido pieza a pieza (campo `fallback`), pero esos ya no viven
# en public/images/Doty/ — se archivaron en public/images/doty-classic/ al
# cerrarse la fase 1 — así que apuntar ahí generaba un registro roto que
# check-doty-assets rechaza. El placeholder es ahora `feliz`, el mismo que usa
# FALLBACK_POSE en el lado TypeScript: una sola idea en los dos sitios.
PLACEHOLDER = "/images/Doty/expressions/feliz.png"


def registry_src(piece: dict) -> str:
    if piece.get("done"):
        return f"/images/Doty/{piece['group']}/{piece['slug']}.png"
    return PLACEHOLDER


def _ts_key(key: str) -> str:
    return key if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key) else f'"{key}"'


def emit_registry(cats: "dict | list[dict]") -> str:
    """Registro TS a partir de una o varias fases. Solo entran los REGISTRY_GROUPS;
    una clave repetida entre fases es un error, no una sobreescritura silenciosa."""
    cat_list = [cats] if isinstance(cats, dict) else list(cats)
    pieces: list[dict] = []
    seen: dict[str, str] = {}
    for cat in cat_list:
        for p in cat["pieces"]:
            if p["group"] not in REGISTRY_GROUPS:
                continue
            key = registry_key(p)
            if key in seen:
                raise CatalogError(f"registry key {key!r} repetida: {seen[key]} y {cat['fase']}")
            seen[key] = cat["fase"]
            pieces.append(p)
    if not any(registry_key(p) == "feliz" for p in pieces):
        raise CatalogError("registry needs a 'feliz' piece (FALLBACK_POSE)")
    groups = " | ".join(f'"{g}"' for g in REGISTRY_GROUPS)
    fuente = " + ".join(f"{c['fase']}.json" for c in cat_list)
    rows = "\n".join(
        f'  {_ts_key(registry_key(p))}: {{ src: "{registry_src(p)}", group: "{p["group"]}" }},' for p in pieces
    )
    return f'''// GENERADO por scripts/mj/process.py --emit-registry — no editar a mano.
// Fuente: scripts/mj/batches/{fuente}. Reglas de uso: docs/brand/doty-identity.md
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
        if p.get("done") and not p.get("regen"):
            lines.append(f"HECHO    {p['slug']}")
        elif len(files) == 1:
            lines.append(f"OK       {p['slug']} ← {files[0]}")
        elif files:
            lines.append(f"AMBIGUO  {p['slug']} ← {' | '.join(files)}")
        else:
            lines.append(f"FALTA    {p['slug']}")
    return "\n".join(lines)


def internal_hole_mask(img: "Image.Image") -> "Image.Image":
    """Máscara ("L", 255 = agujero) de todo lo NO opaco rodeado de figura.

    `rembg` decide qué es fondo por color, no por topología, así que se come
    cualquier mancha clara encerrada en el dibujo: el blanco de un ojo, el check
    de `correcto`, la "!" de `atencion`, el pergamino de `diploma`, el ribete del
    gorro de `navidad`. Sobre fondo blanco el agujero no se ve — deja pasar
    blanco — y sobre el tema oscuro aparece un ojo del color del fondo.

    Un agujero se distingue del fondo por conectividad: el fondo llega al borde
    de la imagen, un agujero no. Se enmarca en un borde de 1 px para que un solo
    relleno desde (0,0) alcance TODO el fondo, toque o no las esquinas.

    El criterio es "no del todo opaco", no "casi transparente": el interior de
    una figura sólida es opaco por definición, así que la orla semitransparente
    del borde del agujero es parte del agujero. Recortarla en el alfa casi-cero
    dejaba ese anillo dentro de la figura, y `halo_thickness_px` — que cuenta
    píxeles semitransparentes rosados sobre el largo del contorno — lo leía como
    halo: al arreglar los agujeros saltaron dos alertas falsas.
    """
    from PIL import ImageDraw

    alfa = img.convert("RGBA").getchannel("A")
    w, h = alfa.size
    marco = Image.new("L", (w + 2, h + 2), 255)
    marco.paste(alfa.point(lambda v: 255 if v < 255 else 0), (1, 1))
    ImageDraw.floodfill(marco, (0, 0), 128)
    return marco.crop((1, 1, w + 1, h + 1)).point(lambda v: 255 if v == 255 else 0)


def fill_internal_holes(cut: "Image.Image", src: "Image.Image") -> "Image.Image":
    """Devuelve el color original a los agujeros que `rembg` abrió dentro de la
    figura. El color sale de `src` — la descarga sin recortar, del mismo tamaño —
    y no de un blanco inventado: el ojo lleva su sombreado y la estrella de
    `nivel-completado` su dorado.

    No todo agujero es un defecto: `cargando` es un anillo y su centro es fondo
    de verdad. Esas piezas se marcan `keep_holes` en el catálogo y no pasan por
    aquí; la topología no puede distinguirlas, es un juicio por pieza.
    """
    mask = internal_hole_mask(cut)
    if mask.getbbox() is None:
        return cut
    r, g, b, a = cut.convert("RGBA").split()
    sr, sg, sb = src.convert("RGB").split()
    for canal, fuente in ((r, sr), (g, sg), (b, sb)):
        canal.paste(fuente, (0, 0), mask)
    a.paste(255, (0, 0), mask)
    return Image.merge("RGBA", (r, g, b, a))


def trim_square_resize(img: "Image.Image", size: int, margin: float = 0.04) -> "Image.Image":
    img = img.convert("RGBA")
    bbox = img.getbbox(alpha_only=True)
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


def halo_thickness_px(img: "Image.Image") -> float:
    """Grosor medio, en píxeles, de la banda semitransparente ROSADA (r>180, g<120)
    alrededor del sujeto: cuenta de esos píxeles dividida por el largo del contorno.

    El antialiasing de un sprite limpio deja una banda de ~1.4 px en cualquier
    silueta y a cualquier resolución. Se mide grosor y no una fracción del sprite
    porque la fracción depende de la silueta y del tamaño: la de Doty (pelo en
    picos, extremidades finas) tiene mucho más perímetro por área que un círculo,
    y a 512 px un sprite limpio ya daba más del 2 % — los rangos limpio/con-halo
    se solapaban entre formas.

    Es un canario, no un veredicto: solo cuenta píxeles con 0 < alfa < 255 que
    además son rosados saturados (r>180, g<120). Un fleco difuminado hacia blanco,
    o un fleco gris/blanco liso, le es invisible — y la app vive en tema oscuro,
    donde ese es justamente el fleco que se nota. Debe llamarse sobre la salida
    de `remover`, ANTES de `trim_square_resize`: redimensionar (sobre todo si
    amplía) desenfoca la arista alfa y infla o esconde la medida sin que el
    halo real haya cambiado.
    """
    img = img.convert("RGBA")
    a = img.getchannel("A")
    visible = a.point(lambda v: 255 if v > 0 else 0, mode="L")
    semi = a.point(lambda v: 255 if 0 < v < 255 else 0, mode="L")
    rosa = ImageChops.multiply(
        img.getchannel("R").point(lambda v: 255 if v > 180 else 0, mode="L"),
        img.getchannel("G").point(lambda v: 255 if v < 120 else 0, mode="L"),
    )
    semi_rosa = ImageChops.multiply(semi, rosa)
    contorno = ImageChops.subtract(visible, visible.filter(ImageFilter.MinFilter(3)))
    n_contorno = sum(1 for v in contorno.get_flattened_data() if v)
    n_semi = sum(1 for v in semi_rosa.get_flattened_data() if v)
    return n_semi / n_contorno if n_contorno else 0.0


# Grosor de banda semitransparente por encima del cual la pieza es candidata a
# regenerar. Un sprite limpio mide ~1.4 px en cualquier silueta y resolución.
HALO_THRESHOLD = 2.0


# Cuántos píxeles se erosiona la silueta antes de mirar el relleno. La orla de
# antialiasing mide ~1.4 px en cualquier silueta y resolución: a 6 px ya está
# fuera de la cuenta hasta en un contorno muy curvo.
INTERIOR_EROSION_PX = 6


def soft_interior_fraction(img: "Image.Image") -> float:
    """Fracción del INTERIOR de la figura que no es del todo opaca.

    `halo_thickness_px` vigila el borde; esta vigila el relleno. Son los dos
    fallos opuestos de `rembg`: el halo deja de más por fuera, y esto caza cuando
    deja de menos por dentro — la máscara se deshilacha sobre una zona clara y el
    cuerpo sale traslúcido. Le pasó a `cientifica`: su bata blanca y su cara
    violeta clara se fueron con el fondo y la mitad de su interior acabó en alfa
    parcial, contra el 0.3 % de la mediana de los avatares.

    `fill_internal_holes` no lo cubre porque su criterio es topológico: rescata
    lo que queda ENCERRADO por figura, y aquel interior desaguaba hasta el borde
    de la imagen por el hueco entre las solapas de la bata. Para el relleno era
    fondo, no agujero — y sobre el blanco del raw no se veía.

    Se mide el interior y no el sprite entero por la misma razón por la que el
    halo se mide en píxeles y no en fracción: la orla semitransparente del
    contorno crece con el perímetro, así que una fracción global castiga a las
    siluetas recortadas — el pelo en picos, los brazos de `corriendo` — y a los
    tamaños pequeños. Erosionando `INTERIOR_EROSION_PX` px esa orla sale de la
    cuenta y las 102 piezas ya publicadas caen todas por debajo del 6 %.

    Si la figura es tan fina que la erosión se la come entera no hay interior que
    juzgar y devuelve 0. Es un canario: callar es mejor que inventarse una alarma
    sobre cuatro píxeles.

    Va sobre la salida de `remover` y DESPUÉS de `fill_internal_holes`: medir
    antes contaría como deshilachado un agujero que el pipeline ya sabe coser, y
    una alerta que suena cuando no hay nada que arreglar se acaba ignorando.
    """
    img = img.convert("RGBA")
    a = img.getchannel("A")
    visible = a.point(lambda v: 255 if v > 0 else 0, mode="L")
    # Erosionar 1 px seis veces equivale a un MinFilter de 13 y es mucho más
    # barato: el filtro de rango de PIL ordena la ventana entera en cada píxel.
    interior = visible
    for _ in range(INTERIOR_EROSION_PX):
        interior = interior.filter(ImageFilter.MinFilter(3))
    opaco = a.point(lambda v: 255 if v == 255 else 0, mode="L")
    blando = ImageChops.subtract(interior, opaco)
    n_interior = sum(1 for v in interior.get_flattened_data() if v)
    n_blando = sum(1 for v in blando.get_flattened_data() if v)
    return n_blando / n_interior if n_interior else 0.0


# Fracción de interior blando por encima de la cual el recorte se da por roto.
# Las 102 piezas publicadas no pasan del 6 % — la peor es `bandera-uk` — y
# `cientifica` recién rota marcaba 51 %: hay margen por los dos lados.
SOFT_INTERIOR_THRESHOLD = 0.10


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
    rep = {"fase": fase, "done": [], "skipped": [], "missing": [], "ambiguous": [], "halo": [], "soft": [], "duplicates": [], "failed": []}

    # Validar picks: todos los archivos deben existir
    missing_picks = [f"{s}={f}" for s, f in picks.items() if not (raw_dir / f).is_file()]
    if missing_picks:
        raise CatalogError(f"--pick apunta a archivos que no existen: {', '.join(sorted(missing_picks))}")

    consumed: dict[str, str] = {}
    for p in cat["pieces"]:
        slug = p["slug"]
        target = output_path(p, fase, repo_root, raw_root)
        # `done` significa "hay arte publicado", no "es el arte definitivo". Una pieza
        # marcada `regen` ya produjo su PNG pero espera una mejor: se reprocesa sin
        # tener que pasar --force global, y sobre todo sin poner done=false, que
        # devolveria el registro a los sprites legacy en la proxima regeneracion.
        if p.get("done") and not force and not p.get("regen"):
            rep["skipped"].append(slug)
            continue
        chosen = picks.get(slug)
        # Una elección ya tomada vale como pick. Sin esto un --force pierde las
        # ambigüedades que se resolvieron a mano (y los --pick de prefijos que
        # no emparejan) y deja el PNG viejo en disco sin avisar: la pieza parece
        # hecha y está sin reprocesar, que es lo peor de los dos mundos.
        if not chosen and p.get("source_file") and (raw_dir / p["source_file"]).is_file():
            chosen = p["source_file"]
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
        if chosen in consumed:
            rep["duplicates"].append((slug, chosen, consumed[chosen]))
        try:
            src = Image.open(raw_dir / chosen).convert("RGBA")
            # `cutout_model` deja que una pieza pida un recortador distinto del
            # defecto (`DEFAULT_MODEL` en process.py). Hoy no lo usa ninguna:
            # nació para que `cientifica`, `astronauta` y `dj` saltaran a
            # `isnet-anime` sin arrastrar a las 102 publicadas, y al pasar ese a
            # ser el defecto las tres se quedaron sin nada especial que pedir.
            #
            # NO se llama `model` porque esa clave ya existe en fase-0 con otro
            # significado — la versión de Midjourney ("7") — y sus quince piezas
            # siguen en `done: false`, asi que un `--apply fase-0` le habria
            # pasado "7" a rembg como si fuera un modelo de recorte.
            #
            # Se pasa por nombre para no romper los `remover` de un argumento.
            cut = (remover(src, model=p["cutout_model"]) if p.get("cutout_model")
                   else remover(src))
            if not p.get("keep_holes"):
                cut = fill_internal_holes(cut, src)
            out = trim_square_resize(cut, p["size"])
            target.parent.mkdir(parents=True, exist_ok=True)
            out.save(target, optimize=True)
        except Exception as exc:
            rep["failed"].append((slug, f"{type(exc).__name__}: {exc}"))
            continue
        consumed[chosen] = slug
        grosor = halo_thickness_px(cut)
        # `ghost-race` es un fantasma translucido a proposito: sus pixeles
        # semitransparentes rosados son el dibujo, no un fleco, y la metrica no
        # puede distinguirlo — es un canario, no un veredicto. Sin esta salida
        # deja una alerta permanente, y una alerta que siempre suena se ignora.
        if grosor > HALO_THRESHOLD and not p.get("translucent"):
            rep["halo"].append((slug, grosor))
        # Mismo indulto que el halo, y por el mismo motivo: en `ghost-race` el
        # interior traslúcido es el dibujo, no un recorte que se pasó de listo.
        blando = soft_interior_fraction(cut)
        if blando > SOFT_INTERIOR_THRESHOLD and not p.get("translucent"):
            rep["soft"].append((slug, blando))
        p["done"] = True
        p.pop("regen", None)
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
    lines += section("Falló el procesado", [f"{s}: {e}" for s, e in rep["failed"]])
    lines += section("Mismo archivo usado por dos piezas", [f"{s} y {otro} -> {f}" for s, f, otro in rep["duplicates"]])
    lines += section("Alerta de halo: banda gruesa, regenerar o retocar", [f"{s} ({r:.2f} px)" for s, r in rep["halo"]])
    lines += section("Alerta de relleno: el recorte se comió el cuerpo, regenerar", [f"{s} ({f:.0%} del interior traslúcido)" for s, f in rep["soft"]])
    return "\n".join(lines)
