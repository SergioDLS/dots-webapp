# Dificultades parejas — diseño

- **Fecha**: 2026-10-15
- **Repos afectados**: `dots-backend` (contenido en `scripts/seed-data/` y un
  script de datos). En `dots-webapp`, solo documentación: el Camino ya sabe
  pintar píldoras de gramática.
- **Estado**: decidido por defecto con «avanza con todas» (Sergio,
  2026-10-15); las decisiones van listadas al final para que las revise.
- **Predecesora**: `2026-10-12-secciones-parejas-design.md`, que dejó
  explícitamente fuera emparejar las dificultades: «requiere contenido nuevo
  para Intermediate y Advanced».

## El problema, medido

Después del re-corte del 2026-10-12, las tres dificultades tienen secciones
parejas, pero no tamaños parejos:

| Dificultad | Nodos | Secciones |
|---|---|---|
| Beginner | 86 | 11 (Level 1–11) |
| Intermediate | 26 | 3 (Level 12–14) |
| Advanced | 15 | 2 (Level 15–16) |

Beginner tiene módulos (vocabulario, letras, números, pronunciación,
lecturas y píldoras de gramática); Intermediate y Advanced solo tienen los
niveles de práctica de siempre: 41 niveles de oraciones, sin nada que explique
la regla antes de ejercitarla.

## Decisiones

1. **El contenido nuevo son píldoras de gramática** (`grammar_pills` +
   `grammar_items`): una explicación en bloques (`p`, `example`, `tip`) y 8
   ítems `complete` con una respuesta y dos distractores. Son solo texto: no
   necesitan audio ni imagen. Los packs de vocabulario, la pronunciación y las
   lecturas sí dependen de audio, y hoy no hay generador; quedan fuera.
2. **Una píldora antes de cada nivel de práctica** de Intermediate (26) y de
   Advanced (15): primero se enseña la regla, después se ejercita. El par
   píldora + nivel nunca se separa en dos secciones.
3. **18 píldoras de gramática avanzada que hoy no cubre ningún nivel**, al
   final de Advanced, de lo más accesible a lo más difícil (lista abajo).
4. **Resultado: 86 · 52 · 48 nodos, en 11 · 6 · 6 secciones.** Beginner no
   se toca. Intermediate: 6 secciones de 4 o 5 pares (8 o 10 nodos).
   Advanced: 6 secciones de 8 nodos; las 4 primeras tienen pares, las 2
   últimas solo píldoras nuevas.
5. **El orden de lo que ya existe no cambia.** Cada píldora se intercala justo
   antes de su nivel; las nuevas van detrás de todo lo de Advanced.
6. **Checkpoints**: cada sección con niveles de práctica lleva uno al final
   (6 en Intermediate, 4 en Advanced); las 2 secciones de solo píldoras no
   llevan, como las Level 1–7 de Beginner. Se reutilizan los 5 que hay (66,
   74, 80, 91 y 93) y se crean 5.
7. **Secciones nuevas**: 7 (3 en Intermediate, 4 en Advanced), creadas en
   ese orden desde la secuencia de `section` (hoy en 16, así que 17 a 23). El
   Camino ordena por id dentro de cada dificultad, así que van detrás de las
   existentes: Intermediate 5, 6, 7, 17, 18, 19; Advanced 9, 10, 20, 21, 22,
   23. Los nombres siguen «Level N» en el orden del Camino: Beginner 1–11,
   Intermediate 12–17, Advanced 18–23.
8. **Tiles sin arte nuevo**: la píldora de un nivel usa el tile del nivel
   (`levels.src`); las 18 nuevas usan un tile de familia que ya existe
   (`perfectos`, `condicionales`, `estructuras`, `modales`…).
9. **El contenido lo escribe Claude y Sergio lo revisa en
   `/admin/foundations`** después de cargarlo, como se decidió en julio. Se
   puede corregir ahí sin tocar código.

### Las 18 píldoras nuevas de Advanced

Be used to y get used to · present perfect continuous · past perfect
continuous · el futuro visto desde el pasado (was going to, would) ·
modales de deducción (must, can't, might have) · gerundio o infinitivo con
cambio de significado (stop, remember, try) · relativas especificativas y
explicativas · oraciones de participio · comparativos avanzados (the more…
the more; much, far + comparativo) · so, neither y sustitución (so do I, I
think so) · el do enfático · contraste y concesión (although, despite,
whereas) · would rather e it's time · pasiva con verbos de opinión (it is
said that, he is believed to) · condicionales mixtos · oraciones escindidas
(it was… who, what I need is) · inversión (never have I, not only) · el
subjuntivo formal (I suggest he go).

## Cómo se escribe cada píldora

- Español neutro con tuteo y el tono de las píldoras de Beginner: claro,
  cercano, sin infantilizar. Título en español (los términos técnicos en
  inglés cuando es lo estándar: «El present perfect»).
- Explicación de 3 a 5 bloques: la regla y su contraste con el español; 2
  ejemplos (`text` en inglés, `en` con la traducción al español, como en
  Beginner); un `tip` con el error típico del hispanohablante.
- Exactamente 8 ítems `complete`: frase en inglés con un solo `__`, una
  respuesta corta y 2 distractores de la misma categoría que sean incorrectos
  en esa frase. Ningún distractor puede ser también correcto.
- La píldora de un nivel enseña lo que ese nivel ejercita: se escribe mirando
  sus oraciones, pero sin copiarlas (el nivel ya las tiene).
- Las píldoras de niveles léxicos o funcionales (Opposites, Idioms, slang,
  formal vs informal, ways to say…) explican uso y registro, con el mismo
  formato.

## El script

Un script nuevo, `dots-backend/scripts/difficulty-content.js`, con el patrón
obligatorio del backend: dry-run por defecto, `--apply`, respaldo en
`scripts/out/` y `--rollback`. Reutiliza la lógica probada de
`rebalance-sections` (recorrido del Camino, precondiciones contra un
inventario, simulación, verificaciones, informe, nodo actual, secuencia), con
el rango de tamaño como parámetro.

En una transacción:

1. Aborta si la BD no es el inventario del 2026-10-15 (secciones, nodos,
   niveles y las píldoras existentes), si alguna clave nueva ya existe, si hay
   saltos por test o si alguna secuencia que va a usar va atrás de su tabla.
2. Inserta las 59 píldoras y sus 472 ítems.
3. Inserta sus 59 nodos `grammar` y los 5 checkpoints nuevos, y crea las 7
   secciones.
4. Re-corta Intermediate y Advanced con el mismo movimiento en dos fases que
   usa `rebalance-sections`, renombra y verifica: cada nodo una vez y en el
   orden acordado, tamaños de 7 a 10, un checkpoint al final de cada sección
   con práctica y ninguno en las demás, cada checkpoint con al menos 5
   oraciones *cloze* (las que usa el examen), posiciones únicas, niveles en la
   sección de su nodo y nombres «Level 1» a «Level 23».
5. Escribe el respaldo (ids insertados y estado previo de lo movido) y hace
   COMMIT. El rollback borra lo insertado y restaura lo movido, y se niega si
   alguien ya tiene progreso en un nodo o una sección nuevos.

El contenido vive en `scripts/seed-data/pildoras-intermedio-avanzado.json` y
pasa por un validador puro con tests (8 ítems, un solo `__`, respuesta fuera
de los distractores, bloques de explicación válidos, claves únicas) antes de
que el script lo acepte.

## Verificación

- Tests puros del validador y del reparto nuevo.
- Ensayo contra un Postgres local desechable, como el de `rebalance-sections`.
- Dry-run de solo lectura contra producción.
- Después del apply, con el sí de Sergio: las verificaciones sobre la BD en
  vivo y el Camino en el navegador integrado (6 y 6 secciones, una píldora
  abre su lección).

## Fuera de alcance

- Vocabulario, pronunciación y lecturas nuevas, que necesitan audio.
- Arte nuevo para las píldoras.
- Corregir oraciones flojas de los niveles existentes (por ejemplo,
  «Compound words» tiene oraciones que no son de palabras compuestas): se
  anotan para la revisión de contenido.
