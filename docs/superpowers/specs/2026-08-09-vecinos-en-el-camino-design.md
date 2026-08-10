# Vecinos en el camino — diseño

**Fecha:** 2026-08-09
**Repos afectados:** `dots-backend` (endpoint nuevo), `dots-webapp` (render)
**Estado:** diseño aprobado, pendiente plan de implementación

## Problema

El camino de aprendizaje se recorre en soledad. La única señal social que recibe un
alumno vive en `/quests` (leaderboard, rival semanal, torneos, retos), y toda ella se
mide en **XP** — es decir, en cuánto trabajaste esta semana. Nada te dice **por dónde
van los demás** en el contenido, que es la pregunta que un alumno se hace de forma
natural cuando estudia con otros.

## Objetivo

Mostrar en el camino, al costado del nodo donde está cada uno, a los **dos compañeros
más cercanos a tu posición**: el que va justo delante y el que viene justo detrás.
El efecto buscado es de vecindad, no de ranking.

## Decisiones de producto

Cinco decisiones tomadas durante el brainstorming, con el motivo de cada una. Importan
más que el código: son lo que hay que revisar si la feature no produce el efecto
esperado.

### 1. Vecinos, no ranking

Solo se ven dos personas: la inmediatamente anterior y la inmediatamente posterior.
No hay tabla de posiciones ni mapa poblado.

**Por qué.** La posición en el camino no mide esfuerzo, mide antigüedad. Duolingo
rankea deliberadamente por XP semanal y no por avance en el árbol, justo por eso: a
quien entró hace un mes le aparecen todos por delante y se desinfla. Mostrar solo
vecinos conserva el empuje ("está a 2 lecciones de ti") sin el castigo de ver la
distancia total.

### 2. Al costado del nodo, sobre el camino

La información vive en el mapa, no en una franja aparte.

**Por qué.** Una franja de texto arriba del camino sería un `rival-banner` reubicado;
no aprovecha que el camino ya es un mapa. Al pintar al vecino sobre su nodo, la
distancia **se ve** en vez de contarse.

### 3. Los 2 más cercanos entre quienes jugaron en los últimos 7 días

**Por qué.** Predecible (siempre son dos, siempre caben), y el filtro de actividad
evita el peor escenario: que tu "rival" sea alguien que abandonó hace dos meses.
Competir contra una estatua no motiva.

### 4. Inicial en círculo de color de marca

Círculo de ~34 px con la inicial del nombre y un color fijo por usuario.

**Por qué.** No existe ningún sistema de avatares en dots. Doty es una ilustración de
cuerpo entero y a ese tamaño se vuelve una mancha; además competiría visualmente con
el Doty que ya encabeza cada dificultad y con `DotyMarker`. Una inicial se lee al
instante y no cuesta infraestructura.

### 5. Visible siempre, sin opt-out

**Por qué.** El leaderboard de `/quests` ya expone nombre recortado, XP y racha de
todos a todos. Son ~28 personas de una misma academia que se conocen: es un curso, no
una red social abierta. Un opt-out simple además tiene un riesgo asimétrico — quienes
van más atrás son justo los que se apagarían, dejando un camino poblado solo de
punteros, que es el escenario más desmotivante posible.

Si en el futuro entra gente de fuera de la academia, esta decisión es la primera que
hay que revisar.

## Alcance

**Dentro:**

- Extraer el recorrido del camino a una función pura `path-walk.ts` y hacer que
  `PathService.getPath()` la use, de modo que exista una sola regla de "nodo actual".
- Arreglar la divergencia de `normalizeCurrent()` en el frontend (ver *Paso 2*), que hoy
  permite que un nodo `reading` se robe la estrella de nodo actual.
- Endpoint `GET /path/neighbors` en `dots-backend`.
- Componente `PathPeer` y su cableado en `dots-webapp`.
- Tests con fixtures de `path-walk.ts`, incluyendo el caso de la lectura que hoy se roba
  el nodo actual.

Los dos primeros puntos no son adornos: sin ellos la distancia entre vecinos es
incorrecta por construcción.

**Fuera, a propósito:**

- Presencia en tiempo real, websockets, "está en línea ahora".
- Fotos de perfil o avatares subibles.
- Ajuste de privacidad / modo incógnito.
- Grupos, cohortes o cursos.
- Retar al vecino desde el camino (ver *Siguiente paso natural*).

## Backend — `GET /path/neighbors`

Guard `JwtAuthGuard` a nivel de clase. El `userId` sale de `@CurrentUser()`, nunca del
body.

### Respuesta

```jsonc
{
  "ahead":  { "id": 12, "name": "Sofía", "lastName": "G", "nodeId": 87, "distance": 2 },
  "behind": { "id": 31, "name": "Diego", "lastName": "M", "nodeId": 83, "distance": 1 }
}
```

- Ambos campos son nullable.
- `lastName` va recortado a la inicial **en el servidor**.

  Nota: esto expone estrictamente **menos** que el leaderboard actual, al
  contrario de lo que decía una versión anterior de este spec.
  `LeaderboardEntryDto` manda el apellido **completo** y el recorte, cuando
  ocurre, lo hace el cliente. Aquí el dato nunca sale del servidor.
- `distance` se mide en nodos. `0` significa mismo nodo.
- `id` se incluye porque el frontend deriva de él el color determinista, y porque
  habilita el paso siguiente (retar) sin cambiar el contrato.

### Cálculo

**Paso 1 — índice global del catálogo.** El orden es total y estable:

```sql
SELECT pn.id, pn.type, pn.ref_id, pn.section_id
FROM dots.path_nodes pn
JOIN dots.section s    ON s.id = pn.section_id
JOIN dots.difficulty d ON d.id = s.id_difficulty
WHERE pn.enabled = true AND d.enabled = true
ORDER BY d.id, s.id, pn.position
```

Produce un `Map<nodeId, índice>`. Sin caché en la primera versión: es una query y son
~28 usuarios.

Dos detalles que **deben** replicar lo que hace `getPath()`, o el índice se desalinea:

- `dots.section` **no tiene columna `enabled`**; solo se filtra `path_nodes.enabled` y
  `difficulty.enabled`. Filtrar de más aquí desplazaría todos los índices.
- Los nodos `practice` cuyo `ref_id` apunta a un nivel deshabilitado o inexistente se
  **omiten** del catálogo, igual que en `path.service.ts:116-119`.

**Paso 2 — posición de cada usuario (el punto crítico).**

`users.current_level` es FK a `levels.id`, **no** a `path_nodes.id`: son dos tablas
distintas, así que ese campo **no** sirve para ubicar a nadie en el camino. Descartado.

La posición real ya se calcula hoy, en el recorrido ordenado de
`PathService.getPath()` (`path.service.ts:97-138`), con dos acumuladores
(`frontierOpen`, `currentAssigned`) sobre el orden `difficulty.id → section.id →
position`. Esa es la regla buena.

### Divergencia detectada (bug preexistente)

El frontend **sobrescribe** el `current` del backend con una regla distinta, en
`normalizeCurrent()` de `path-container.tsx:15-32`:

| | Excluye `checkpoint` | Excluye `reading` |
|---|---|---|
| Backend (`isOptional`) | sí | **sí** |
| Frontend (`normalizeCurrent`) | sí | **no** |

Consecuencia en producción hoy: **un nodo de tipo `reading` puede robarse la estrella
de "nodo actual"**, el marcador de Doty y el auto-scroll, aunque las lecturas son
opcionales y no cierran la frontera de desbloqueo. Es un bug que ya existe,
independiente de esta feature.

Para los vecinos es fatal: si el backend ubica a Sofía con una regla y la pantalla de
Sofía usa otra, la distancia miente en ambas direcciones a la vez.

### Resolución

1. Extraer el recorrido a una **función pura** `findCurrentNodeId()` en
   `src/modules/path/path-walk.ts`, sin dependencias de TypeORM ni de la BD — así se
   testea con fixtures, cumpliendo la regla de no tocar la BD compartida.
2. `PathService.getPath()` pasa a usarla (`current = node.id === currentNodeId`), de
   modo que existe **una sola** implementación de la regla.
3. El endpoint de vecinos usa la misma función para cada usuario activo.
4. **Arreglar el frontend:** `normalizeCurrent()` queda restringido al fallback de
   `/levels` + adapter, que es el único caso donde el `current` no viene calculado.
   Cuando `/path` responde, sus flags se respetan tal cual.

Con el punto 2 aplicado, la coherencia **deja de ser algo que un test vigila** y pasa a
ser estructural: hay una sola implementación, y `getPath()` se limita a comparar
`node.id === currentNodeId`. Un test que verificara esa igualdad sería tautológico.

Lo que sí cubren los tests de `path-walk.ts` son las invariantes de la regla: que el
nodo actual nunca sea una lectura ni un checkpoint, que las secciones superadas por test
se atraviesen como completas, y que el catálogo omita los `practice` de niveles
deshabilitados. Contra el riesgo real que queda —que alguien vuelva a duplicar la regla
en otro archivo— ningún test sirve; por eso el comentario de cabecera de `path-walk.ts`
lo dice de forma explícita.

**Paso 3 — filtro de actividad (7 días).**

```sql
SELECT DISTINCT id_user
FROM dots.daily_use
WHERE GREATEST(updated_at, created_at) >= NOW() - INTERVAL '7 days'
```

`daily_use` tiene granularidad de día y su noción de "hoy" usa hora de Santiago, pero
para una ventana de 7 días el timestamp crudo alcanza y evita el enredo de zona
horaria.

**Paso 4 — selección.**

Ordenar los usuarios activos por índice.

- `ahead` = el de menor índice **mayor** al propio.
- `behind` = el de mayor índice **menor** al propio.
- **Empate en el mismo nodo:** se desempata por el progreso dentro de ese nodo. Si va
  más avanzado es `ahead` con `distance: 0`; si va menos, es `behind` con
  `distance: 0`. Si el progreso también empata, desempata `id` ascendente.

  El progreso **no** se lee de `levels_progress` directamente: los nodos del camino no
  son todos niveles (hay `vocab`, `grammar`, `pronunciation`, `letters`, `numbers`,
  `reading` y `checkpoint`) y `levels_progress` solo cubre los de tipo `practice`. La
  regla por tipo ya existe en el método privado `PathService.nodeProgress()`
  (`path.service.ts:213-234`) y se extrae junto con el recorrido a `path-walk.ts`:

  | Tipo de nodo | Fuente del progreso |
  |---|---|
  | sección superada (`section_test`) | `100`, cualquier tipo |
  | `checkpoint` | `0` si la sección no fue superada |
  | `reading` | `100` si hay `daily_use` de esa lectura, si no `0` |
  | `practice` | `levels_progress.progress` del `refId` |
  | resto | `node_progress.progress` del `nodeId` |

El caso `distance: 0` es deliberadamente el más visible de la feature: "Sofía está en
tu mismo nodo, un poco más adelante" es el mensaje con más potencial motivador de
todos.

### Exclusiones

Quedan fuera del conjunto de candidatos:

- El propio usuario que consulta.
- Usuarios con `blocked = true`.
- Usuarios con `expires` vencido (coherente con las reglas de acceso cerrado).
- Usuarios que completaron el camino entero: no tienen nodo actual que mostrar.

**Corrección (2026-08-10).** Una versión anterior de este spec listaba aquí
"usuarios sin `current_level`", contradiciendo la tabla de casos borde de más
abajo. No existe tal exclusión y no debe existir: la posición ya no se deriva de
`users.current_level`. Alguien con placement pendiente **puede** aparecer como
vecino en el primer nodo si tiene actividad reciente, lo cual es coherente con
tratar a quien saltó por placement según su posición real.

### Constantes

| Constante | Valor | Motivo |
|---|---|---|
| `NEIGHBOR_ACTIVITY_DAYS` | `7` | Ventana de actividad reciente. |
| `NEIGHBOR_MAX_DISTANCE` | `5` | Más allá no es un vecino, es un desconocido; pintarlo en territorio bloqueado desmotiva más de lo que empuja. |

Si el vecino más cercano supera `NEIGHBOR_MAX_DISTANCE`, se devuelve `null` en ese
lado. Ambos números son los primeros candidatos a ajustar con datos reales, así que van
como constantes nombradas y no incrustados en la query.

### Migraciones

**Ninguna obligatoria.** Todo sale de tablas existentes; no hay DDL en el camino
crítico.

Aparte y opcional, se detectó que faltan índices por `id_user` en dos tablas muy
consultadas:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_levels_progress_user
  ON dots.levels_progress(id_user);
```

**Corrección (2026-08-10): el índice sobre `daily_use(id_user)` NO sirve para
esta feature.** La query de actividad filtra por
`GREATEST(du.updated_at, du.created_at) >= NOW() - …` sin ninguna igualdad por
`id_user`, así que un índice por esa columna es inutilizable y la query será
siempre un scan completo de `daily_use`. Al único sitio donde ayudaría es a la
query de lecturas — que además es la que no afecta al resultado. Que nadie lo
cree creyendo que acelera esto. Con ~28 usuarios da igual de todas formas.

`CONCURRENTLY` evita tomar lock sobre la BD compartida de producción. Va como script
aparte, con dry-run por defecto y `--apply` explícito, según la regla del backend. **No
es requisito de esta feature**; con 28 usuarios el full scan es irrelevante.

## Frontend

### Fetcher

`getPathNeighborsService()` en [`services/levels.service.ts`](../../../services/levels.service.ts),
junto a `getPathService()` — mismo dominio, mismo archivo. Tipos en
`types/path.types.ts`.

### Carga y degradación

`PathContainer` pide `/path/neighbors` en paralelo con `/path`.

**Excepción deliberada a la regla 5 del CLAUDE.md.** El fetch de vecinos **no** lleva
estado `loadError` ni botón de Reintentar. Esa regla existe para fetches que bloquean
el juego; este es decorativo y su fallo no debe generar ruido: si el endpoint falla, se
pone lento o tiene un bug, el camino se renderiza exactamente como hoy y el alumno no
se entera. El fetch de `/path` conserva su `loadError` y su Reintentar intactos.

El efecto que hace el fetch debe respetar la regla 3: nada de `setState` síncrono en el
cuerpo del `useEffect`.

### Flujo de datos

El endpoint devuelve 2 vecinos; el árbol es Difficulty → Section → Node. Se pasa un
`peersByNodeId: Record<number, Peer[]>` por props a través de `PathDifficulty` →
`PathSection`. Dos props en una jerarquía de dos niveles: el prop drilling explícito
gana a introducir un context.

### `PathPeer`

Clon estructural de [`components/path/doty-marker.tsx`](../../../components/path/doty-marker.tsx),
que ya resuelve exactamente este problema:

- `absolute`, anclado con `left: 100%` o `right: 100%` sobre el wrapper de 150 px.
- `zIndex: 20`.
- Reusa la regla de lado que `PathSection` ya calcula: `xPct >= 50 ? "left" : "right"`,
  es decir siempre hacia el interior del zigzag.
- Círculo de ~34 px con la inicial; nombre recortado debajo, 11 px.

Tres detalles que no son cosméticos:

1. **El nombre va siempre visible, nunca en hover.** Regla RN-safe: en React Native el
   hover no existe. Por lo mismo, la animación se limita a `transform` / `opacity`.
2. **Color dark-mode-safe.** `PathNode` resuelve todos sus tintes con
   `color-mix(in srgb, ${hex} 16%, var(--surface))`; `PathPeer` sigue el mismo patrón.
   La paleta vive en `lib/peer-colors.ts` e indexa por `id % N`, de modo que cada
   persona conserva siempre su color.
3. **Colisión con `DotyMarker`.** Si un vecino cae en el nodo actual, `DotyMarker` ya
   ocupa ese hueco. El vecino va al **lado opuesto** a Doty; si son dos en el mismo
   nodo, se apilan verticalmente en ese lado desplazando `top`. Se descartó la
   alternativa de fusionar el vecino en la burbuja de Doty ("Sofía está aquí contigo"):
   es más cálida, pero pierde el círculo de color y mezcla dos responsabilidades en un
   componente.

### Móvil

El contenedor de `PathSection` mide `maxWidth: 520` y el wrapper del nodo 150 px,
anclado al zigzag en 15 % / 50 % / 85 %. En un viewport de 380 px el lado interior deja
holgura suficiente para los 96 px que `DotyMarker` ya ocupa hoy sin romperse.

**Esto hay que medirlo con `preview_inspect`, no asumirlo.**

## Casos borde

| Situación | Resultado |
|---|---|
| Nadie activo en 7 días | `{ ahead: null, behind: null }`; el camino se ve como hoy. |
| Vas primero entre los activos | `ahead: null`. |
| Vas último entre los activos | `behind: null`. |
| Vecino a más de 5 nodos | Ese lado va `null`. |
| Vecino en tu mismo nodo | `distance: 0`; se ubica por progreso dentro del nodo. |
| Dos vecinos en tu mismo nodo | Se apilan verticalmente, lado opuesto a Doty. |
| Vecino en dificultad que no desbloqueaste | Se pinta igual: el nodo existe en tu árbol aunque esté bloqueado. Limitado en la práctica por el tope de 5 nodos. |
| Usuario que completó el camino entero | Excluido: no tiene nodo actual que mostrar. |
| Usuario recién invitado, sin nada de progreso | Su nodo actual es el primero del camino. En la práctica no aparece igual, porque sin filas en `daily_use` no pasa el filtro de actividad. |
| Usuario que saltó por placement | Cuenta con su posición real, sin caso especial: es su nivel real, no un atajo. |
| El endpoint falla | Sin vecinos, sin error visible, sin botón de reintentar. |

## Verificación

No hay test runner de componentes en el frontend; la verificación es lint + build +
preview manual.

**Backend:**

- `npm test` verde, con `path-walk.spec.ts` y `neighbors-select.spec.ts` cubriendo las
  invariantes de la regla y la selección de vecinos.
- Toda la lógica se prueba con fixtures y repositorios mockeados con `jest.fn()`.
  **Nunca contra la BD compartida.**

**Frontend:**

- `npm run lint` (incluye las reglas del compiler de React).
- `npx next build` (type-check) antes de commitear.

**Visual:**

- Los tres estados —sin vecinos, un vecino, dos en el mismo nodo— se verifican
  inyectando una respuesta simulada en el cliente. Cero escritura en producción para
  ver un caso borde.
- Medir el encaje en 380 px y en desktop con `preview_inspect`.

## Riesgos conocidos

1. **Divergencia de posición.** Es el riesgo técnico principal y está mitigado por la
   función compartida y su test. Si alguien vuelve a duplicar la lógica de "cuál es el
   nodo actual", la feature empieza a mentir sin fallar.
2. **La feature puede quedarse vacía.** Con ~28 usuarios y un filtro de 7 días, un
   alumno en una zona poco transitada del camino puede no ver a nadie nunca. Es
   aceptable —degrada al estado actual— pero conviene medirlo antes de invertir más.
3. **Efecto contrario al buscado.** Ver que alguien va delante empuja a unos y desanima
   a otros. Las decisiones de producto de arriba están calibradas para minimizarlo
   (vecinos en vez de ranking, tope de distancia, filtro de actividad), pero el efecto
   real solo se sabe observando.

## Siguiente paso natural

Si la feature funciona, **tocar al vecino para retarlo**: reusaría `POST /challenges`,
que ya existe y ya funciona desde el leaderboard, con muy poco código nuevo. El
contrato del endpoint ya incluye `id` justamente para no tener que cambiarlo entonces.
