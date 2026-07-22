# F0 — Triage de contenido · Reporte de ejecución

- **Fecha:** 2026-07-22
- **Rama:** `redesign/contenido-camino` (backend)
- **Herramienta:** `dots-backend/scripts/triage-content.js` (`npm run triage:content`)
- **Backup (rollback):** `dots-backend/scripts/out/backup-triage-1784737020582.json`
  - Revertir: `node scripts/triage-content.js --rollback scripts/out/backup-triage-1784737020582.json`

## Aplicado a prod

```
deleted=12  dedup=16  enabled=139  fixes=17
```

### Borrado (12 oraciones basura)
- **L1 alphabet ×10:** `#290,#291` "this is test sentence", `#292` "last test creating", `#293` "final sentence testing", `#294` "more testing", `#295` "new sentenceeee", `#296` "new test sentence for", `#299` "testing 10000", `#304` "new test", `#308` "testing new version".
- **L2 numbers ×1:** `#302` "this is a final test".
- **L80 Like ×1:** `#887` "f::__".

### Deduplicado (16 — se conservó el original)
family `#86`; professions `#235`; personal care `#245`; articles `#315`; future progressive `#558`; modal verbs `#585,#592`; phrasal verbs `#698,#700,#704,#712,#719`; wish `#818`; "Ways to say I like it" `#949,#954`; "How to introduce yourself" `#961`.

### Re-habilitado (139 oraciones en 14 niveles muertos)
Eran niveles con **0 oraciones activas** pese a tener contenido bien formado y on-topic — estaban apagados sin razón de contenido (probable disable masivo o nunca encendidos):

| Nivel | encendidas |
|---|---|
| L22 possesive adjectives | 20 |
| L25 do/does | 15 |
| L23 verb to be | 14 |
| L29 prepositions | 13 |
| L33 indefinite | 12 |
| L30 frequency adverbs | 9 |
| L24 reflexive pronouns / L31 was-were / L52 future progressive | 8 c/u |
| L26 possesive pronouns / L28 complements / L34 irregular past / L35 comparatives / L65 imperative | 6–8 |

→ **Las secciones 2 y 3 dejan de estar vacías.**

### Fixes (17)
Trim de espacios en `text`/`m_word` de las oraciones encendidas (p.ej. `"hotter than "` → `"hotter than"`, que si no rompía el match de la respuesta).

## Excluido a propósito (no era F0)
- **`#67` "He has an important test in __"** (months): falso positivo de la regex (`test` = examen). **No borrado.**
- **L55 "Opposites"** (21 oraciones, formato roto `"Put-__"`): → **F1** reescritura.
- **L32 "reflexive pronouns"** (0/0, duplicado vacío de L24): → **F3** consolidar/retirar el nodo.
- **Oraciones-acróstico deshabilitadas de L1 alphabet / L2 numbers:** → **F3** (esos temas van a módulos Letras/Números).
- **Niveles vocab sin oraciones** (daytime, furniture, house, body, school): → **F1/F3**.

## Handoff a F1 (expansión a la barra ≥8)
Revividos pero aún **<8 activas** (necesitan +oraciones on-topic): complements, verbs in past (irregular), comparative/superlative, imperative, since/for, reciprocal, like/alike, interrogatives, simple past, should have, will have done, y varios de la sección 12. Vocab flacos (stations, meals, shapes, days) se resuelven junto con su módulo en F3.

Regenerar la lista exacta en cualquier momento: `npm run triage:content` (read-only).
