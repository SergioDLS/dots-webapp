# Tiles de módulos del Camino — fase 3

- **Fecha**: 2026-09-29
- **Estado**: diseño aprobado por secciones con Sergio; pendiente de revisión
  del documento.
- **Alcance**: una columna nueva `path_nodes.src`, su lectura en `GET /path` y
  en el CRUD de `/admin/path`, un catálogo `scripts/mj/batches/fase-5.json` con
  46 piezas en `public/images/levels/`, y un script de backend que asigna la
  imagen a 58 nodos (10 con tiles que ya existen).
- **Predecesora**: `2026-09-11-tiles-de-niveles-design.md` (fase 2, cerrada).
  Reutiliza su pipeline `scripts/mj/`, su grupo `levels` y su carpeta.

## El problema, medido

La fase 2 dejó fuera la sección 1 porque "sus 25 niveles de vocabulario ya
tienen su imagen correcta". Consultada la BD el 2026-09-29, esa premisa ya no
es cierta: esos niveles se convirtieron en vocab packs, y **la sección 1 no
tiene ni un nodo `practice`**.

| Sección 1 (`section.id = 1`) | |
|---|---|
| Nodos activos | 57 |
| Nodos `practice` | 0 |
| Nodos con imagen | 0 |

El backend solo manda `src` a los nodos `practice`, que la toman de
`levels.src` (`path.service.ts`, `toNodeDto`). El resto cae al icono de su
tipo ([path-node.tsx](../../../components/path/path-node.tsx), `<Icon
name={meta.icon} size={72}>`). Resultado: 29 nodos de vocabulario seguidos
con el mismo bocadillo, 10 de gramática con la misma pieza de puzzle, 8 de
pronunciación con el mismo altavoz. Fuera de la sección 1 pasa lo mismo con
dos nodos más: la píldora de gramática de la sección 2 y el `-ED` de la 3.

Las imágenes viejas (`colors.png`, `family.png`…) siguen en `levels.src` de
los niveles 1–18, pero nadie las lee. `readings.src` guarda el **audio** de la
lectura, no una imagen.

### Limpieza previa (ya aplicada)

Antes de esta spec se fusionaron los duplicados de la sección 1 con
`dots-backend/scripts/merge-duplicate-nodes.js` (aplicado el 2026-09-29,
respaldo `scripts/out/backup-merge-duplicates-2026-09-29T18-02-00-335Z.json`):

- Retirados (`enabled = false`) `La casa`, `El cuerpo` y `La escuela`: sus
  palabras ya estaban en `house`, `body` y `school`. Las cinco que no
  (student, homework, test, question, answer) pasaron a `school`.
- Retirado el nivel 32 `reflexive pronouns`: copia vacía (0 oraciones) del 24
  que bloqueaba el camino, porque un nodo `practice` es obligatorio.

Por eso la sección 1 tiene 57 nodos y no 60.

## Decisiones

1. **La imagen vive en el nodo** (`path_nodes.src`), no en cada tabla de
   contenido ni en un mapa del frontend. Una columna sirve a los seis tipos
   de módulo y a las lecturas, se edita desde el CRUD de `/admin/path` que ya
   existe, y mantiene la BD como fuente de verdad. Descartadas: una columna
   `src` por tabla de contenido (seis columnas, seis joins, seis formularios)
   y un mapa estático en el frontend (cambiar una imagen exigiría deploy).
2. **Mismo tema, mismo tile.** Diez nodos reutilizan un tile de la fase 2.
   El criterio 1 de la fase 2 ("ningún nivel de las secciones 2 a 12 comparte
   imagen con uno de la sección 1") nació contra imágenes que mentían — un
   nivel de pronombres con un dibujo de números. Compartir tile entre una
   píldora y un nivel del mismo tema dice la verdad. Se sustituye por el
   criterio 2 de esta spec.
3. **Paleta cerrada salvo `colores`.** Rellenos solo en rosa `#FF1F8F`, azul
   `#3768FF`, cyan `#35D8F5` y blanco, con contorno navy `#1E1B5C`; el
   vocabulario concreto se reconoce por la forma. Única excepción: el tile de
   colores, donde el color es el contenido.
   **Historia (2026-10-06):** la primera generación derivó a menta, amarillos y
   gris pizarra, y la causa era el ancla: `formas` salió con un triángulo menta,
   una estrella amarilla y un cuadrado pizarra, y el sref contagió los tres al
   lote (el pizarra produjo justo las masas oscuras que en el tema oscuro
   desaparecen). Se aceptó un rato y se revirtió el mismo día: se regeneran el
   ancla y las 39 piezas que dependen de ella, con la paleta estricta, para que
   la sección 1 no se vea como otra app al lado de las secciones 2 a 12. Ver
   §Segunda generación.
4. **Pronunciación: el par dibujado.** Seis unidades muestran sus dos objetos
   lado a lado, que es literalmente la lección. Las tres sin par dibujable
   (S inicial, S final, `-ED`) comparten un marcador de familia.
5. **Texto solo donde es el contenido.** La fase 2 evitó el texto a propósito
   (`articulos` son tres fichas en blanco). Aquí se permite en dos piezas:
   el abecedario y los números del 1 al 20.

## Arquitectura

### Base de datos

`dots-backend/scripts/migrate-path-node-src.js`, con el patrón `migrate-*`
del CLAUDE.md del backend (dry-run por defecto, `--apply`, respaldo,
`--rollback`):

```sql
ALTER TABLE dots.path_nodes ADD COLUMN IF NOT EXISTS src varchar(255);
```

Es aditiva: el código desplegado hoy no la nota. **Tiene que correr antes de
desplegar el backend nuevo**: en cuanto la entity declare `src`, todo `find()`
de `PathNode` la pide en el `SELECT` (`GET /path`, completar nodos,
checkpoint, contenido del nodo, vecinos, placement y admin), así que todo eso
respondería 500 sin ella.

### Backend

- `PathNode` gana `@Column({ type: 'varchar', length: 255, nullable: true })
  src?: string | null`.
- `toNodeDto`: todo nodo manda `dto.src = node.src ?? null`; los `practice`,
  `node.src ?? level?.src ?? null` — el nodo puede sobrescribir la imagen del
  nivel, y sin valor propio todo sigue como hoy.
- Admin: `src` entra en `CreatePathNodeDto` y `UpdatePathNodeDto`
  (`@IsOptional`, `@IsString`, `@MaxLength(255)`; `null` la borra) y en
  `serializePathNode`.

### Webapp

- **El Camino no cambia.** `path-node.tsx` ya pinta `node.src` sin mirar el
  tipo, y `wordImageUrl` deja pasar `/images/levels/x.png` tal cual.
- `/admin/path`: el modal del nodo gana un campo «Imagen» junto a «Título»,
  con una vista previa pequeña. `AdminPathNode` y los payloads de
  `services/admin.service.ts` ganan `src`.

### Asignación

`dots-backend/scripts/set-node-art.js`, calcado de `set-level-art.js`
(dry-run, `--apply`, respaldo reescrito tras cada fila, `--rollback`).

- El mapa se escribe por **`tipo:ref_id`** (p. ej. `vocab:10 → dias`), no por
  id de nodo: identifica el contenido aunque el nodo se recree en el admin.
  Un `tipo:ref_id` sin nodo activo es un error y aborta, como un id
  inexistente en `set-level-art.js`.
- **Antes de escribir cada fila pide la URL a producción**
  (`https://app.dotsonlinelearning.com/images/levels/<slug>.png`). Si no
  responde 200, la fila se salta y se avisa. El orden "PNG desplegado antes
  que la BD" — cuya violación dejó tres imágenes rotas el 2026-09-10 — pasa a
  garantizarlo el script, no la memoria de quien lo corre.
- Por eso se puede correr por tandas: asigna lo publicado y deja el resto
  para la siguiente corrida.
- Un nodo cuyo `src` ya tiene otro valor (no nulo y distinto del del mapa)
  lo puso alguien a mano desde `/admin/path`: el script lo **respeta** y lo
  lista como `respeta`, salvo que se pase `--pisar`.

## Catálogo de arte

### Reglas del lote

- **Catálogo**: `scripts/mj/batches/fase-5.json` (`fase-3` y `fase-4` ya son
  los lotes de UI y de avatares). Grupo `levels`, 512 px, destino
  `public/images/levels/<slug>.png` (`mjlib.py` ya lo mapea). No entra en
  `poses.ts`: lo consume `path-node.tsx` vía `src`, como la fase 2.
- **Ancla**: `formas`, símbolo puro, generada con `estructuras` (el ancla de
  la fase 2) como referencia de estilo, para heredar su grosor de línea y su
  nivel de abstracción. `validate_catalog` exige un ancla por grupo sin
  mascota dentro de cada catálogo.
- **Doty** sale cuando el tema es una persona, una acción o una situación; los
  temas de cosas van sin él. Canon: sin zapatos, sin gafas, y sin orejas,
  nariz ni pelo — por eso `cuerpo` y `pelo` no pueden ser Doty.
- **Texto**: prohibido salvo en `abecedario` (A B C), `numeros-1-20`
  (1 2 3) y, desde la 2ª generación, `decenas` (10 20 30) y `dias` (las
  iniciales M T W T F S S), como glifos
  sueltos; en esas piezas `text` sale de los negativos. Plan B si los glifos
  salen deformes: soportes en blanco y glifos compuestos después con Baloo 2
  (la fuente de display de la app) mediante sharp, como `compose-icons.mjs`.
- **Slugs en español**, como los 38 de la fase 2. Los de pronunciación son el
  propio par inglés, que es el contenido.

### Reutilizados (10 nodos, 0 piezas)

| Tile | Nodos (`tipo:ref_id`) |
|---|---|
| `articulos` | A, AN y THE (`grammar:2`) |
| `esto-eso` | This, that, these, those (`grammar:6`) |
| `singular-plural` | El plural con -S (`grammar:5`) |
| `presente` | El verbo TO BE (`grammar:1`) · Presente simple (`grammar:7`) |
| `preguntas` | Preguntas con DO y DOES (`grammar:8`) · Preguntas con What, Where, Who… (`grammar:11`, sección 2) |
| `modales` | CAN: poder y saber hacer (`grammar:9`) |
| `pronombres` | El posesivo 'S (`grammar:4`) |
| `acciones` | verbs (`vocab:15`) |

### Piezas nuevas (46)

**Vocabulario (23)**

| Slug | Nodo | Qué se dibuja | Doty |
|---|---|---|---|
| `dias` | `vocab:10` days of the week | tira de siete casillas, una resaltada | no |
| `meses` | `vocab:12` months of the year | calendario de pared con anillas y cuadrícula de 12 | no |
| `estaciones` | `vocab:22` seasons | árbol partido en cuatro: nieve, flor, sol, hoja cayendo | no |
| `partes-del-dia` | `vocab:27` daytime | arco del sol a la luna sobre un horizonte | no |
| `clima` | `vocab:23` weather | nube con lluvia y rayo, sol asomando | no |
| `hora` | `vocab:16` time | despertador | no |
| `colores` | `vocab:11` colors | paleta de pintor con colores reales (excepción de paleta) | no |
| `formas` | `vocab:17` shapes | círculo, triángulo, cuadrado y estrella (**ancla**) | no |
| `familia` | `vocab:13` family | un Doty adulto de la mano de un Doty pequeño | sí |
| `profesiones` | `vocab:24` professions | tres gorros: de chef, casco de obra, cofia | no |
| `ropa` | `vocab:14` clothes | camiseta, gorra y zapatillas | no |
| `cuerpo` | `vocab:31` body | mano, ojo y pie | no |
| `cuidado-personal` | `vocab:25` personal care products | cepillo de dientes, peine y bote de loción | no |
| `alimentos` | `vocab:19` foods | queso, pan y salchicha | no |
| `comidas` | `vocab:20` meals | tres platos en fila bajo sol naciente, sol alto y luna | no |
| `frutas` | `vocab:28` fruits | frutero con manzana, plátano y uvas | no |
| `cocina` | `vocab:18` kitchen elements | olla, sartén y espátula | no |
| `deportes` | `vocab:21` sports | balones de básquet, fútbol y tenis | no |
| `animales` | `vocab:26` animals | gato, perro y pájaro | no |
| `casa` | `vocab:30` house | casa por fuera: puerta, tejado y jardín | no |
| `muebles` | `vocab:29` furniture | sofá y lámpara | no |
| `escuela` | `vocab:32` school | mochila, lápiz y libro | no |
| `ciudad` | `vocab:6` La ciudad | edificios con una parada de autobús | no |

**Letras y números (3)**

| Slug | Nodo | Qué se dibuja |
|---|---|---|
| `abecedario` | `letters:1` El abecedario | tres bloques de juguete con A, B y C |
| `numeros-1-20` | `numbers:1` Números 1–20 | tres bloques de juguete con 1, 2 y 3 |
| `decenas` | `numbers:2` Las decenas | tres barras de diez cubos (bloques de base diez) |

**Lecturas (6)**

| Slug | Nodo | Qué se dibuja |
|---|---|---|
| `luna` | `reading:1` What makes the moon shine? | luna creciente iluminada de lado por el sol |
| `peces` | `reading:2` How do fish breathe underwater? | pez con burbujas y branquias |
| `volcan` | `reading:3` What is a volcano? | volcán en erupción, lava rosa |
| `pelo` | `reading:4` FUN FACT 1 (el pelo liso o rizado) | un mechón liso junto a uno rizado, bajo una gota de lluvia |
| `oceano` | `reading:5` How deep is the ocean? | submarino bajando entre líneas de profundidad |
| `telefono` | `reading:6` How does a telephone work? | dos teléfonos unidos por ondas |

**Frases con Doty (5)**

| Slug | Nodo | Qué se dibuja |
|---|---|---|
| `saludos` | `vocab:1` Saludos y cortesía | Doty saludando con la mano en alto |
| `supervivencia` | `vocab:2` Frases de supervivencia | Doty agarrado a un salvavidas |
| `frases-clase` | `vocab:5` Frases para aprender | Doty levantando la mano |
| `cognados` | `vocab:3` Palabras gratis (cognados) | caja de regalo de la que salen bocadillos (sin Doty) |
| `falsos-amigos` | `vocab:4` Falsos amigos | Doty desconfiado ante un bocadillo con antifaz |

**Pronunciación (7)**

| Slug | Nodos | Qué se dibuja | Por qué este par |
|---|---|---|---|
| `ship-sheep` | `pronunciation:1` ship vs sheep | barco y oveja | es el título |
| `hat-hut` | `pronunciation:2` cat vs cut | sombrero y cabaña | «cut» no se dibuja |
| `bath-bat` | `pronunciation:3` El sonido TH | bañera y murciélago | three/tree exigiría pintar un 3 |
| `heart-art` | `pronunciation:6` La H sí suena | corazón y caballete | una paleta chocaría con `colores` |
| `van-ban` | `pronunciation:7` V vs B | furgoneta y señal de prohibido | boat/vote repetiría el barco |
| `cash-catch` | `pronunciation:8` SH vs CH | billetes y guante atrapando una pelota | ship/chip repetiría el barco |
| `sonido` | `pronunciation:4` S inicial · `pronunciation:5` S final · `pronunciation:9` -ED (sección 3) | boca con ondas de sonido | marcador de familia |

**Gramática (2)**

| Slug | Nodo | Qué se dibuja |
|---|---|---|
| `adjetivos` | `grammar:3` Adjetivos: antes y sin cambios | una pelota con una etiqueta colgando |
| `hay` | `grammar:10` There is / There are | Doty señalando una estantería: un objeto en una balda, varios en otra |

Recuento: 23 + 3 + 6 + 5 + 7 + 2 = 46 piezas, que cubren 48 nodos (`sonido`
cubre tres). Con los 10 reutilizados, 58 nodos: los 56 de la sección 1 que no
son checkpoint, más `grammar:11` (sección 2) y `pronunciation:9` (sección 3).

### Legibilidad entre piezas

Dentro de cada grupo las piezas tienen que distinguirse a 128 px:

- **Cielo y calendario**: `dias`, `meses`, `estaciones`, `partes-del-dia`,
  `clima`, `hora`.
- **Comida**: `alimentos`, `comidas`, `frutas`, `cocina`.
- **Lugares**: `casa`, `muebles`, `escuela`, `ciudad`.

Y antes de aceptar una pieza se compara lado a lado con el tile que más se le
parece:

| Pieza nueva | Tile existente | Riesgo |
|---|---|---|
| `saludos` | `presentarse` | los dos son Doty con la mano extendida |
| `familia` | `comparativo`, `singular-plural` | Dotys de varios tamaños o en grupo |
| `hay` | `cantidad` | "uno y muchos" |
| `deportes` | `formas` | balones contra círculo |

### Segunda generación (2026-10-06)

La primera tanda se generó entera y se descartaron 39 de 46 piezas: las que
dependían de un ancla con colores ajenos (ver la historia de la decisión 3),
más los conceptos que Sergio rechazó (`cuerpo`, `pelo`, `hat-hut`,
`ship-sheep`). Se quedan `colores` y las seis de Doty, que no usan el sref del
ancla. Los conceptos de la tabla de piezas de arriba son los de la primera
generación; **los vigentes viven en `scripts/mj/batches/fase-5.json`**, con
prefijos de la familia `Path tile` para que ninguna descarga vieja
(`Level tile …`) vuelva a emparejar.

Pauta de identidad, pedida por Sergio ("darle identidad a los tiles sin
sobrecargar"):

- **Un protagonista con un giro que cuenta el tema**, no un inventario: el
  murciélago que se da un baño de burbujas en la tina (`bath-bat`), la choza
  cuyo techo es un sombrero (`hat-hut`), el guante que atrapa billetes
  (`cash-catch`), la oveja de pie en el barco (`ship-sheep`), un perchero con
  tres gorros de oficio (`profesiones`).
- **Como mucho dos elementos más, siempre tocando al protagonista**: nada
  flotando, que `rembg` lo borra. Los pares de pronunciación dejan de ser
  "mitad y mitad" con línea divisoria.
- **Las lecturas dibujan lo que el texto explica**, no solo su tema: la luz del
  sol que rebota en la luna; el pez con las branquias abiertas; el volcán
  cortado por la mitad con la roca fundida subiendo desde dentro de la tierra;
  dos cabezas de espaldas, pelo liso y rizado, con una nubecita de lluvia sobre
  la rizada (el clima riza el pelo); el corte del mar de la orilla a la fosa;
  dos teléfonos unidos por un cable con un pulso que viaja.
- **Gramática con la regla dentro de la imagen** cuando se puede: `adjetivos`
  es un coche de juguete con la etiqueta colgando **delante** (el adjetivo va
  antes del sustantivo).
- **Paleta estricta** (decisión 3) y **`estructuras` en Style reference para
  las 39 piezas**, la misma referencia con la que se generó toda la fase 2: la
  sección 1 queda con el acabado del resto del Camino y no depende de acertar
  un ancla nueva. `formas` sigue siendo el ancla del grupo en el catálogo
  (`validate_catalog` exige una), pero con `group_sref` le pasa su referencia
  prestada a todo el grupo en vez de ser ella la referencia. Su concepto es el
  más simple: tres figuras separadas en fila, sin tocarse (cuadrado azul,
  triángulo cyan, círculo rosa). Se descartaron la torrecita apilada (leía como
  un arbolito de Navidad), la caja de encajar formas (juguete de bebé) y el
  póster con las figuras superpuestas (amontonado, no se distinguía ninguna).
- **Neutro, no femenino** (Sergio: "un 10 % más masculino o neutro"): el
  protagonista va en azul o cyan y el rosa queda de acento — una cinta, un
  cordón, una vela, un detalle. Fuera adjetivos tiernos (`cozy`, `friendly`,
  `fluffy`). Doty sigue siendo rosa: eso es canon, no paleta de los tiles.
- **Lo más sencillo gana** (Sergio, al revisar la 2ª generación: "una luna
  normal y ya", "el mar lo más sencillo"): cuando un concepto ingenioso no se
  lee a 128 px, se vuelve al objeto solo. `luna` es una luna creciente,
  `oceano` unas olas, `cash-catch` un guante junto a un fajo de billetes, y
  `volcan` un volcán clásico en erupción. Midjourney tiende a meter un panel o
  marco de fondo que apelmaza el tile: los prompts rehechos piden fondo blanco
  liso sin panel.
- **Juvenil, no infantil** (la guía de marca: "juvenil e irreverente, para
  todo público"; el arte dibuja arquetipos). Nada de juguetes de bebé: las
  letras son teclas de teclado mecánico, los números botones de calculadora,
  las decenas un marcador digital con 10, 20 y 30, y `adjetivos` una zapatilla
  con la etiqueta delante.

## Despliegue

1. **Migración**: `migrate-path-node-src.js --apply`, con consentimiento
   explícito (regla 1 del CLAUDE.md del backend).
2. **Backend (Render)**: entity, DTO y admin. Después del paso 1, nunca antes.
3. **Webapp (Vercel)**: el campo «Imagen» del admin.
4. **Por tanda**: PNG publicados, luego `set-node-art.js`. El dry-run dice qué
   URLs responden 200; el `--apply`, con consentimiento.

**Rollback**: `set-node-art --rollback <respaldo>` devuelve los `src`
anteriores. La migración no se deshace dropeando la columna — como
`migrate-settings` y `migrate-economy`, su `--rollback` la deja inerte: con
el backend nuevo desplegado, quitarla rompería `GET /path`, y sin él nadie la
lee.

### Tandas

| Tanda | Contenido | Piezas |
|---|---|---|
| 0 | pasos 1–3 + los 10 nodos reutilizados | 0 |
| 1 | ancla `formas`, letras, números y los otros 22 de vocabulario | 26 |
| 2 | 6 lecturas y 5 frases con Doty | 11 |
| 3 | 7 de pronunciación y 2 de gramática | 9 |

La tanda 0 no necesita arte: en cuanto se despliega, diez nodos ya tienen
imagen. La tanda 1 es la queja original — el abecedario, los números y el
bocadillo repetido del vocabulario.

Cada tanda de arte: generar (4 candidatas por pieza) → `process.py` →
revisar a 128 px en los dos temas y sobre el fondo real del Camino, con los
parecidos lado a lado → commit y push → deploy de Vercel → `set-node-art`.

### Service worker

Las piezas nuevas son URLs nuevas: no hay caché que invalidar. Si se regenera
una pieza **ya publicada**, el Camino la carga con `next/image`, que pasa por
`/_next/image` (stale-while-revalidate en `sw.js`): se corrige en la siguiente
visita. Pero `/images/` directo es cache-first; si la pieza se usa también en
un `<img>` sin optimizar, hay que bumpear `SW_VERSION`, como hizo la v3 con el
avatar `clasico`.

## Criterios de aceptación

1. Ningún nodo de las secciones 1 a 3, salvo los checkpoints, pinta el icono
   de su tipo.
2. Ninguna imagen afirma un contenido que el nodo no enseña. (Sustituye al
   criterio 1 de la fase 2.)
3. Cada pieza se lee a 128 px — el tamaño real del arte del nodo (`ART` en
   `path-node.tsx`) — en los dos temas, sobre el fondo real del Camino; las
   de un mismo grupo se distinguen entre sí, y los parecidos de la tabla se
   han revisado lado a lado.
4. Rellenos solo en la paleta de marca salvo `colores`; ninguna masa navy u
   oscura; mismo grosor y nivel de abstracción que la fase 2.
5. Los glifos A, B, C y 1, 2, 3 son correctos y legibles.
6. `set-node-art` no escribe ningún `src` cuya URL no responda 200 — probado
   con un slug aún no publicado.
7. Backend: test de jest de `toNodeDto` (nodo módulo con `src`, nodo módulo
   sin `src`, `practice` que hereda de `levels.src`) y `npm test` en verde.
   Webapp: `npm run lint` y `npx next build`. El respaldo y el rollback de
   `set-node-art` se prueban en la tanda 0.

## Fuera de alcance

- **Las imágenes de cada palabra dentro de las lecciones** (el stock de
  150 px del VPS antiguo). Otra fase.
- **Imagen para las cinco palabras que pasaron a `school`** (student,
  homework, test, question, answer), que llegaron sin ella.
- **El `levels.src` de los niveles de vocabulario 1–18**, que ya nadie lee.
  Se queda como está.
- **Los títulos**: los packs en inglés siguen en inglés y los de fundamentos
  en español (decisión de Sergio).
- **Los banners de sección y los checkpoints**, que siguen con su arte actual.

## Presupuesto

46 piezas. A 4 candidatas por pieza y ~1 min de GPU por trabajo en V8.2 +
Edit Model (medido en fase 0), unos 180 minutos de generación en relax,
repartidos en tres tandas, sin contar regeneraciones.
