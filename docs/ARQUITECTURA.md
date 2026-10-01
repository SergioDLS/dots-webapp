# Arquitectura — dots-webapp

Actualizado: 2026-07-22 (post rediseño total + tanda juegos/social). Complemento del `CLAUDE.md` de la raíz.

## La app en una línea

Duolingo-like de inglés para hispanohablantes: un **Camino** de niveles con lecciones intercaladas, repaso SRS, economía de gemas, 12 minijuegos y capa social (torneo, retos 1v1, rivalidades, trono, carrera fantasma). Mascota: Doty (`components/ui/doty/doty.tsx`, registro generado `components/ui/doty/poses.ts`, sprites en `public/images/Doty/<grupo>/`, pipeline en `scripts/mj/`). Los 22 sprites de la identidad anterior están archivados en `public/images/doty-classic/`.

## Navegación (tabs del hub)

`components/shell/nav-items.ts` → bottom tabs en móvil / riel izquierdo 84px en desktop (`app-nav.tsx`), HUD superior con racha/gemas/nivel-XP (`app-header.tsx`, datos de `GET /me/stats`).

| Tab | Ruta | Qué hay |
|---|---|---|
| Camino | `/levels` | Camino v3 — una dificultad a la vez; detalle de componentes abajo. |
| Repaso | `/review` | SRS (SM-2) — cloze de oraciones falladas. |
| Retos | `/quests` | Rival banner + torneo semanal + retos 1v1 + misión diaria + leaderboard. |
| Juegos | `/play` | Arcade: dos héroes diarios con su estado de hoy, tiles de arte flotante con badge de torneo, y bloqueados en gris. |
| Perfil | `/profile` | Identidad con Doty, barra de nivel, cuatro números, insignias y gestos; los ajustes viven en una hoja (inferior en móvil, lateral en escritorio). |
| Tienda | `/shop` | Gemas → escudos de racha, boost XP, cosméticos/gestos de Doty. |

Camino v3 muestra una dificultad a la vez (`?d=<id>`; por defecto, la
actual, resuelta en `lib/path-view.ts`). `path-container` (fetch,
navegación entre dificultades, tarjetas de las bloqueadas);
`path-difficulty` (vista de una dificultad: banner con narrador,
secciones, niebla, grid md+ de 300 px + pista); `path-section` (zigzag
15/50/85 %, filas de 182 px, sub-banner); `path-node` (arte de 128 px sin
contenedor, barra 100×8, badges); `folded-header` + `back-to-current`
(visibles según el `IntersectionObserver` que arma `path-container` en
`hooks/use-in-view.ts`); `segmented-bar`. Las poses de Doty sin arte
propio caen a `poseOrFallback` (`components/ui/doty/doty.tsx`, sobre la
lógica pura de `pending.ts`). El HUD (`components/shell/app-header.tsx`)
enciende la llama solo con `streakSecuredToday`.

Flujos inmersivos (sin chrome): `/practice`, `/lesson/{pronunciation,grammar,vocab}`, `/checkpoint`, `/onboarding` (placement), `/readings/:id`, `/games/*`.

Fuera de `(app)` y sin sesión: `/` (login), `/forgot` (recuperar contraseña) y `/invite/[token]` (aceptar invitación y crear la cuenta). Esta última es la **única vía de alta que existe en la app** — no hay registro público. El panel de invitaciones vive en `/admin/users`, pestaña *Invitations*.

### PWA — instalable desde el 2026-08-16

`app/manifest.ts` (tipado con `MetadataRoute.Manifest`) hace la app
instalable: icono propio, sin barra del navegador y **bloqueada en vertical**
—`orientation: "portrait"`, que solo ata a la app ya instalada; en el
navegador se sigue pudiendo girar—. Los iconos viven en `public/icons/`
(dos `any` y dos `maskable`, que Android necesita porque recorta al 80 %
central) y en `app/apple-icon.png`, que va ahí y no en `public/` porque es la
convención de fichero que hace que Next emita el `<link rel="apple-touch-icon">`.

**No hay service worker**: la app instalada necesita red, y sin conexión
muestra el error del navegador. El push sigue delegado a la futura app React
Native. Spec: `docs/superpowers/specs/2026-08-16-pwa-manifest-design.md`.

### Aviso "te pasó"

Cuando alguien te adelanta en el ranking semanal, una tarjeta te lo dice con su
nombre y **su gesto equipado**. Es el escenario público que le da sentido a
comprar un gesto: lo que ven los demás cuando les ganas. Un solo `RivalWatch` en
el layout del hub reacciona a la ruta y consulta `GET /me/rival` al entrar a
**Camino, Juegos o Retos**, y en ninguna otra pantalla — a Repaso, al Perfil y a
la Tienda se va con una intención concreta y el aviso la interrumpiría.

La detección es una comparación de puestos contra un snapshot en `localStorage`
(`dots.rival.rank.<userId>`, `{ rank, weekStart }`). Nombrar al vecino como quien
te cruzó solo vale cuando el puesto se mueve **un** escalón; con más, el
movimiento pudo venir de gente que ni estaba —entran dos cuentas por encima de
todos y bajas dos puestos sin que tu vecino se moviera—, así que la decisión
devuelve `saltos` y la tarjeta dice cuántos puestos bajaste (o subiste) sin
atribuirle el adelantamiento a nadie. El vecino se sigue nombrando y la tarjeta
conserva su Doty en los cuatro casos. El `weekStart` está
para que no se compare entre semanas: al reiniciarse el ranking los puestos se
barajan sin que nadie te haya pasado. Un snapshot con el formato viejo
(`{ rank }` a secas) se lee como semana desconocida y solo migra.

La decisión es pura y está probada (`lib/rival-alert.ts`, bajo `node --test`);
pintar es `components/rival/rival-alert.tsx`. Sin gesto equipado —hoy, todos— el
rival presume con la pose `flexeando`. Cuando subes de puesto sale Doty
aplaudiendo y **nunca** el gesto del otro: esa exclusividad es lo que convierte
al gesto en un flex. La tarjeta no es un modal: no bloquea el scroll, no se come
los toques y se va sola a los 6 s.

Dos detalles que no son adorno, porque el aviso se descarta solo y solo hay una
oportunidad de verlo. El estado guarda `{ ruta, aviso }` y se trata como
inexistente si la ruta ya no es la actual: el layout del hub no se remonta al
cambiar de pestaña, así que sin eso la tarjeta se iría contigo a Repaso, al
Perfil o a la Tienda, que son justo las tres pantallas donde no se avisa. Y la
emisión espera a que la pantalla esté destapada —la animación de entrada de Doty
(`[data-doty-entrada]`) y cualquier diálogo con el scroll tomado
(`hayScrollBloqueado`) y la pestaña en segundo plano (`document.visibilityState`),
los mismos tres tapones que mira `use-tip-anchor` y por los mismos motivos—, con un
techo de 20 s tras el cual se descarta sin pintarse. El snapshot, en cambio, se
guarda siempre: no depende de que el aviso llegue a verse.

### Pistas contextuales

Lo único que hace falta entender de cada pestaña, dicho una vez y nunca más. Un solo
`TipsController` en el layout del hub decide cuál toca según la ruta, y encuentra el
elemento al que apuntar **por un atributo `data-tip` en el DOM**, no por refs: la
llama de la racha vive en la cabecera del propio layout y ninguna página podría
pasársela, y el Camino ya localizaba así su nodo actual. El catálogo y la selección
son puros (`lib/tips.ts`, bajo `node --test`); esperar, centrar y medir el objetivo
es `hooks/use-tip-anchor.ts`; pintar el foco y el bocadillo es
`components/ui/doty-tip/`.

Se marcan con `PATCH /me/settings { tips_seen: [clave] }`, que el backend acumula
en unión de-duplicada, así que no se repiten en otro dispositivo. Nada se enseña
hasta que el primer inicio esté resuelto, el overlay de entrada haya terminado y
no haya ningún diálogo abierto. Una pista cuyo objetivo no aparece en ~6 s se
salta en silencio, sin marcarse como vista, y se reintenta la próxima vez que se
entre a esa pantalla.

El scroll del body lo gobierna `lib/scroll-lock.ts`, un contador compartido con la
hoja de ajustes y el selector de avatar. Antes cada uno guardaba y restauraba el
valor por su cuenta, y dos bloqueos que se soltaran en orden distinto al de
apertura dejaban el body sin scroll para el resto de la sesión: en una SPA eso no
lo arregla ni navegar. Bloquea el primero que llega y solo suelta el último que se
va. Cualquier diálogo nuevo que necesite parar el fondo debe usarlo.

### Primer inicio (`/welcome`)

Ruta inmersiva (fuera del grupo `(hub)`, sin nav ni HUD) con las tres pantallas que
ve una cuenta nueva: saludo de Doty, tema —paleta, modo y sonido, con vista previa
real de cada paleta— y avatar. La página es la dueña del estado; las tres pantallas
de `components/first-run/` son presentacionales. Al cerrar manda el juego completo
de preferencias con `onboarded: true` y equipa el avatar con `POST /me/avatar`
(nunca con el PATCH, que rechaza `avatar_key`), y de ahí sale a placement o al
Camino.

Quién llega ahí lo decide `FirstRunGate`, montado en el layout del hub junto a
`ThemeSync`: pide `/me/settings` y redirige cuando `onboarded_at` es `null`. No
envuelve ni bloquea nada —pinta `null` y decide en un efecto— y usa el espejo
local `dots-onboarded` para saltarse el fetch de quien ya pasó. La lógica pura
está en `lib/first-run.ts`, bajo `node --test`.

El Camino también redirige por su cuenta cuando el placement está pendiente, así
que una cuenta nueva dispara las dos carreras a la vez. El gate publica su
veredicto en un flag de módulo de `lib/first-run.ts` y `path-container` se aparta
mientras valga «pendiente»; con «desconocido» redirige como siempre, porque fallar
abierto es preferible a dejar a alguien sin placement.

### El perfil (`/profile`)

`components/profile/` reparte la pantalla: `profile-identity.tsx` (avatar, nombre, chips
MCER y racha, engranaje), `profile-xp-bar.tsx`, `profile-stats.tsx` (los cuatro números
sin cajas), `badges-grid.tsx`, `gestures-card.tsx` y `settings-sheet.tsx`. La lógica de
vista es pura y está bajo `node --test` en `lib/profile-view.ts`. El avatar de
`profile-identity.tsx` se pinta con `<Avatar>` a 78 px en móvil y 96 en escritorio —no
con `<Doty>`—; el porqué de esos dos tamaños y el resto del sistema de avatares se
documentan abajo, en «Avatares».

Ese avatar es una carta de dos caras (`avatar-flip.tsx`, spec §6.4): retrato al frente y,
detrás, Doty con el gesto equipado, bajo la misma sombra. Gira sola al entrar (una vez,
cuando ajustes e inventario ya respondieron), gira al tocarla o al pasar el ratón, y el
lápiz es un botón aparte que abre el selector. Los tiempos del giro y la pose por gesto
son puros y están bajo `node --test` en `lib/avatar-flip.ts`.

La hoja de ajustes escribe tres cosas a la vez en cada cambio: el espejo de
`localStorage`, el DOM (vía `applyThemePrefs`) y `PATCH /me/settings`. Desde aquí el
servidor es autoritativo: `components/theme/theme-sync.tsx` reconcilia al cargar y
reescribe el espejo si difiere. El servidor manda salvo mientras haya una escritura
local sin confirmar: para eso existe la marca `dots-settings-dirty`
(`lib/theme-prefs.ts`), que la hoja pone antes del `PATCH` y limpia solo al
confirmarse; si `ThemeSync` la encuentra puesta, reenvía al servidor el estado completo
de los espejos (paleta, modo y sonido) en vez de aplicar lo que diga el servidor. Sin
ella, un cambio hecho sin red se perdía en cuanto el usuario entraba a una lección y
volvía, porque este componente se remonta en cada ida y vuelta al hub. La preferencia
de sonido tiene su propio espejo en `lib/sound-prefs.ts` y `lib/feedback-sounds.ts` la
consulta antes de sonar, así que apagarla silencia los quince importadores (diez
juegos, la práctica, tres componentes de lección y un hook) que reproducen aciertos y
fallos sin tocar ninguno; la narración no pasa por ahí y nunca se silencia.

El acento de cada paleta viaja como dato (`PALETTE_ACCENTS` en el `lib/theme-colors.ts`
generado) porque los bloques CSS generados usan selectores `:root[data-palette]`, que
solo casan con `<html>`: un envoltorio anidado no heredaría el token.

### Modo admin (`components/admin-lab/`)

Spec: `docs/superpowers/specs/2026-09-29-modo-admin-design.md`. Una cuenta con perfil 1
tiene dos estados. *Modo alumno* (por defecto): la app tal cual, con candados reales; la
única señal es la sección «Admin» de la hoja de ajustes (switch + enlace al panel). *Modo
admin*: el backend reporta todo `unlocked` (es una lente en `users.settings.admin_mode`,
NO se escribe progreso) y en la fila del HUD sale el chip ADMIN (`admin-pill.tsx`; en móvil
ocupa el lugar del texto de XP, para no estrechar la barra ni tapar la cabecera plegable del
Camino), que abre la caja (`admin-lab-sheet.tsx`): reiniciar la cuenta en dos pasos, repetir el primer inicio,
completar la sección actual (la única que escribe progreso), palancas de gemas/XP/racha y
«olvidar avisos» del dispositivo. El estado del modo se espeja en `lib/admin-mode.ts`
(store puro, single-flight de `/me/settings` en `hooks/use-admin-mode.ts`, solo para
admins) y las acciones bumpean `lib/account-refresh.ts`, que HUD, Camino, arcade y tienda llevan
en las dependencias de su efecto de carga para volver a pedir sin recargar. Tras el reset
se navega a `/welcome` (no a `/levels`: `FirstRunGate` ya corrió en esa carga). Fetchers en
`services/admin-lab.service.ts`.

Con el modo encendido la **tienda cuesta 0**: avatares, gestos, escudos y boosts salen con precio
0 en `GET /shop` (la pantalla dice «Gratis» y se vuelve a pedir al cambiar de modo) y se llevan de verdad, como una compra; con el modo
apagado vuelven los precios reales. Aparte, y siempre, **la competencia es solo de los
estudiantes**: el backend deja fuera a los admins del ranking, el aviso de rival, el torneo, el
trono, los retos 1v1, el fantasma y los vecinos del Camino. Un admin puede ver esas pantallas pero
nunca aparece en ellas ni cobra sus premios, y `top-students.tsx` le oculta el botón «Retar».

### Reportes de ejercicios

El alumno avisa de un ejercicio con una banderita (`components/report/`), el admin lo arregla
en `/admin/reports` (`components/admin/reports/`) y el alumno se entera al volver al Camino;
un reporte de alumno cerrado como arreglado le paga 10 gemas (a un perfil 1, nunca). Spec:
`docs/superpowers/specs/2026-10-01-reportes-de-ejercicios-design.md`. El servidor (tablas,
fusión de duplicados, tope diario, cierre con gemas) vive en `src/modules/reports/` del
backend; sin su migración aplicada el POST de reportes responde 503 (cerrar y aceptar
también) y las lecturas llegan vacías.

**Qué se reporta, y por qué un store.** Cada pantalla describe lo que tiene delante con un
`ReportTarget` (`lib/report.ts`; el `id` es string porque `sentences.id` es bigint), armado
con los constructores por tipo del mismo archivo (`objetivoDePractica`, `objetivoDeVocab`…),
que también aloja la lógica pura bajo `node --test`: qué motivos salen (`motivosPara`), la
validación y el cuerpo del POST. Un id no numérico degrada el objetivo a «sin ejercicio»
(`type: null`) y cae en la pestaña Bugs: una píldora o unidad cuyo nodo no trae `refId`, o un
juego cuyo backend no manda el id.

La banderita no recibe props porque en vocabulario, letras y números el estado vive en hijos
(`ListenQuiz`, `AudioChoiceQuiz`, `MatchQuiz`) y la barra la pinta el padre. Por eso
`lib/report-targets.ts` es un store de módulo (el patrón de `lib/admin-mode.ts`): quien conoce
el ejercicio publica con `usePublicarObjetivos` (`hooks/use-report-targets.ts`) y el handler
que corrige llama a `registrarRespondido` —un evento, nunca un efecto: regla 3—.
`candidatosDeReporte` entrega lo actual y, si nada de eso está respondido, «el anterior», que
es lo que deja reportar una pantalla que avanzó sola. Lo que no se ve desde una pantalla:

- Publicar compara una firma (clave, modo, respuesta y si falló) y no avisa si nada cambió,
  así que publicar en cada render no hace bucles. El modo entra porque un padre que cambia de
  etapa puede publicar el mismo ítem con otro modo.
- Solo publica una pantalla a la vez: el padre pasa `null` mientras un hijo es dueño del
  ejercicio, y desmontar cualquier publicador vacía el store entero, «el anterior» incluido.
- Checkpoint, placement y lecturas publican con `wasWrong: null` y sin `expected`: no revelan
  si acertaste, así que nunca ofrecen «Mi respuesta debería estar bien».

**La banderita.** `ReportFlag` pinta el glifo `bandera` solo si hay algo que reportar y es
dueña de la hoja: al tocarla congela la lista, para que nada cambie bajo el dedo. Va en
`LessonTopBar`, en `ReportFlagRow` (las pantallas sin esa barra: presentación de vocabulario,
portadas y explicaciones, letras y números) y en la barra propia de las lecturas, siempre con
`reservar`: la banderita aparece cuando un efecto publica y, sin una caja fija de 22×14 px, lo
que comparte fila con ella cambiaba de tamaño (la pista de progreso se encogía 34 px). Por eso
usa márgenes negativos —su caja de layout se queda en esos 22×14 px y el área táctil de 46 px
sobresale— y pide una fila flex con `items-center`; si los tocas, mide la barra antes y
después. La hoja vive dentro de la banderita: si la pantalla desmonta la barra con la hoja
abierta (un cambio de etapa tras avanzar sola), se cierra con lo escrito.

**La hoja.** `ReportSheet` solo pinta y envía: «¿Sobre cuál?» (con más de un candidato),
«¿Qué pasó?» y «¡Gracias!». Es un diálogo de verdad: toma el scroll (`lib/scroll-lock.ts`), así
que pistas y avisos esperan, y contiene el teclado —los atajos de las lecciones
(`hooks/use-lesson-keys.ts`) cuelgan de `window` y, sin el corte del panel, el listener en
captura y el foco que vuelve al panel en cada paso, un Enter con la hoja abierta avanzaba el
ejercicio de detrás—. Si el envío falla, el error se queda en la hoja, el botón pasa a
«Reintentar» y nada se pierde. En modo `app` (la fila «Reportar un problema» de Ajustes) no hay
objetivo: solo `bug` y `other`, y «¿Dónde pasó?» viaja en `context.lugar`. Todo reporte lleva
la ruta, el navegador, la ventana, si la app está instalada y la versión
(`lib/report-browser.ts`, leído al enviar; la versión es `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` y
sale `dev` si Vercel no la expone); los que marcan `bug` o no tienen ejercicio suman los
últimos cinco errores de `lib/error-trail.ts`, que `ErrorTrailCapture` alimenta desde el
layout raíz.

**Juegos.** Mientras se juega no hay banderita: se reporta desde el resultado. `GameResult`
acepta `reportables` y, si llegan, pinta bajo «Salir» el `ReportButton`, que abre la hoja con
los ítems de la partida (los fallados primero) y «El juego en general», que cae en Bugs. Diez
juegos acumulan lo que el alumno vio en un `vistos` de estado, con su respuesta cuando la hubo
y sin ella si la palabra aterrizó o se acabó el tiempo, y lo vacían al repetir. Los que no
usan `GameResult` montan el `ReportButton` en su propio final: ghost-race en su `ResultCard`
(que no envía score: regla 4), y Palabra del Día y Mini Crucigrama en el bloque de partida
terminada, donde ya conocen el id de la palabra (`answerId` y `vocabId` viajan con `done`).

**El aviso de vuelta.** `ReportNoticeWatch` (layout del hub, junto a `RivalWatch`) pide
`GET /me/report-notices` solo en `/levels` y pinta `ReportNotice` cuando nada tapa la
pantalla: la animación de entrada de Doty (`[data-doty-entrada]`), un aviso de rival visible
(`[data-rival-alert]`, el atributo que lleva `rival-alert.tsx` porque ese aviso no toma el
scroll), un diálogo con el scroll tomado o la pestaña oculta. Sondea cada 80 ms con techo de
20 s; pasado el techo no pinta nada y tampoco pierde el aviso, porque «visto» solo se marca al
cerrarlo. Es la cuarta copia de ese sondeo (`rival-watch`, `install-watch` y `use-tip-anchor`
tienen la suya, sin helper compartido): si cambias un tapón, cámbialo en los cuatro.
`ReportNotice` es una hoja de verdad: toma el scroll —por eso pistas, aviso de rival e
invitación a instalar esperan— y no se va sola. «¡Genial!», el fondo y Escape hacen lo mismo:
`POST /me/report-notices/seen` y `bumpCuenta()` (las gemas ya las sumó el servidor al cerrar el
reporte; esto solo refresca el HUD). Si el POST falla, el aviso vuelve a salir la próxima vez:
mejor que perderlo. El vigilante recuerda en un ref los ids ya cerrados mientras siga montado:
si sales de `/levels` sin cerrar y vuelves, la hoja guardada reaparece al instante con su
scroll tomado, y el fetch nuevo, que trajo lo mismo, la emitiría otra vez al cerrarla. El
texto (pose, hasta tres líneas, «y N más», total de gemas) es puro: `lib/report-notice.ts`.

**La bandeja.** `/admin/reports` tiene un filtro Pendientes/Cerrados y dos pestañas, Contenido
y Bugs; el detalle de un ejercicio se abre en el sitio, cambiando la vista por estado como el
resto del admin. La carga sigue el patrón `fetchAttempt` (regla 3) con dos relecturas:
`recargar` vacía y pide de nuevo (y refresca los contadores), `releer` pide sin vaciar para no
desmontar el editor abierto. Tocar el filtro o la pestaña que ya están activos recarga: es el
«actualizar» y la salida de un error, porque sin eso las dependencias del efecto no cambian y
la lista vaciada se quedaba en el spinner.

- **Contenido** (`GroupList`, `GroupDetail`): una fila por ejercicio, con más alumnos
  primero. El detalle junta el contenido de ahora (**Editar**, y **Apagar/Encender** salvo en
  palabras y falsos amigos, que no tienen `enabled`), las respuestas distintas con **Aceptar**
  (oraciones, y gramática solo palabras: `alternativaPara`), las que ya valen, los reportes con
  casillas y `ResolveBar` (nota para el alumno y «Arreglado» o «Descartar»). Se cierra lo
  marcado que sigue pendiente en la última lectura (`idsACerrar`): con las casillas sin tocar,
  todos los pendientes, y si otro admin cerró uno entre medias, ese id ni se manda ni cuenta.
- **Editar** reutiliza los modales de Levels y Foundations (`ContentEditor`); los de
  fundamentos eran privados de su `*-manager.tsx` y ahora se exportan al final, sin cambiar su
  comportamiento. El de oración se queda abierto tras guardar, como en Levels, porque el
  backend re-narra y su studio de voz es donde se escucha; al cerrar cualquiera se vuelve a
  leer, porque el studio publica tomas por su cuenta. Un falso amigo no se edita: vive en
  `FALSE_FRIENDS`, en el backend.
- **Bugs** (`BugList`): una fila por reporte, con el contexto técnico al abrirla. Si señalaba
  un ejercicio (salvo un falso amigo) tiene **Editar**, que pide el contenido al tocar y no
  en un efecto.
- **Errores** (`mensajeDelServidor`): solo se muestra el texto del backend en 400, 404, 409 y
  503, que él escribe en español; los 401 y 403 de Nest llegan en inglés y los 5xx no son
  suyos, y esos caen al texto por defecto de cada acción.

**Contadores.** El admin se entera por números, no por correo. `hooks/use-report-counts.ts`
pide `GET /admin/reports/summary` —solo para admins: un alumno nunca llama a `/admin/*`— y lo
leen el globo de la pestaña «Reportes» del layout de admin, la fila «Panel de admin» de Ajustes
y un puntito en el chip ADMIN (que solo existe con el modo admin encendido). La petición es una
sola aunque monten los tres y vale 2 minutos (`VIGENCIA_MS` en `lib/report-counts.ts`): un
montaje nuevo la reutiliza si es de la misma versión y más joven, y si no vuelve a preguntar,
que es lo que refresca una PWA abierta horas. No hay sondeo: lo que no se desmonta (el layout
de admin, el chip) se actualiza cuando otro consumidor se monta pasados los 2 minutos o tras
`refrescarConteoReportes()`, que se llama al cerrar un reporte. La cifra suma ejercicios con
contenido pendiente y bugs pendientes, no reportes sueltos.

**Respuestas aceptadas.** `lib/accepted-answers.ts` es la gemela cliente de la normalización
de `src/common/answer-alternatives.ts` en el backend (palabra: recorte, sin puntuación final y
en mayúsculas; oración: además, espacios colapsados): si cambias una, cambia la otra. La usan
`PracticeContainer` (`esOracionAceptada`: «Arma la oración» acepta el texto o cualquiera de
`accepted_texts`), el Constructor (`primerFalloEnOrden` contra `answers`), ¡No lo revientes!
(`sinAceptadas` sobre sus señuelos, en `rounds.ts`, que importa con ruta relativa y `.ts` para
que `node --test` lo cargue) y el editor del admin. `AnswerAlternativesEditor` (en
`SentenceModal` y en el modal de ítem de gramática) guarda al momento contra
`/admin/answer-alternatives`, sin pasar por «Guardar», y en gramática avisa —sin bloquear— si
lo aceptado se lleva todos los distractores (`cubreTodasLasIncorrectas`). Los campos nuevos
que manda el servidor son opcionales: con un backend viejo cada pantalla se comporta como
antes. En ¡No lo revientes! las aceptadas se quitan DESPUÉS de barajar, así que sin
alternativas la ronda sembrada sale idéntica a la de siempre. Con ellas no: aceptar una
palabra que era señuelo de una pregunta con mazo sembrado (torneo, reto) cambia sus opciones
para quien juegue después.

**Al añadir algo.** Una pantalla de ejercicio nueva construye su objetivo con un constructor
de `lib/report.ts`, lo publica con `usePublicarObjetivos`, registra la respuesta con
`registrarRespondido` si corrige y le da un sitio a la banderita (`LessonTopBar`,
`ReportFlagRow` o `<ReportFlag reservar />`). Un juego nuevo acumula `vistos`, pasa
`reportables` a `GameResult` (o monta `ReportButton`) y pide al backend el id de lo que
muestra, o sus reportes caerán en Bugs. Un `mode` o una `surface` nuevos necesitan además su
etiqueta en `lib/admin-reports.ts` (`ETIQUETA_MODO`, `SUPERFICIES`, `JUEGOS`), o la bandeja los
pinta en crudo; y el servidor valida `surface` contra una lista cerrada (spec §3.2), así que
una nueva también se declara en el backend. Lo puro está bajo `node --test`
(`npm run test:scripts`): `lib/report*.test.mjs`, `admin-reports`, `accepted-answers`,
`error-trail` y `dont-pop-rounds`; los componentes no tienen runner.

### Avatares (`components/ui/avatar/`)

La cara pública del usuario. Un único `<Avatar avatar size>` pinta el retrato **sin
marco**: flota como el arte de los nodos del Camino y lo único que lo apoya es una
sombra tenue teñida con su propio color (`drop-shadow`, que sigue la silueta del PNG
y no su caja). Lo usan el perfil (78/96), el selector y la tienda (96), el primer
inicio (86), y el leaderboard, los vecinos del Camino y el aviso de rival (34). La
geometría y el fallback viven en `lib/avatar.ts`, puro y bajo `node --test`. La caja
con su sombra se exporta aparte como `<AvatarShadow>`: el dorso del avatar del perfil
la reutiliza con un `<Doty size="dorso">` al 70 % del lado, así el gesto se apoya
igual que el retrato.

El círculo con anillo del acento que llevó hasta el 2026-09-17 se retiró a petición de
Sergio: homologarlo con los nodos del Camino quitó una caja que el principio 4 del spec
no quiere y que competía con el arte del propio avatar.

Los avatares **no son poses de Doty**: son filas de `shop_items` con `kind='avatar'`,
sus PNG viven en `public/images/avatars/` y están fuera del registro generado
(`components/ui/doty/poses.ts`). Quien no tiene avatar equipado ve `clasico`, y ese
fallback lo resuelve el backend para que ninguna pantalla tenga que decidirlo.

Equipar va por `POST /me/avatar { key }`, que concede el ítem si es gratis y lo
equipa en una transacción; los de pago se compran antes por `/shop/buy`.

## Los 12 juegos (`app/(app)/games/`)

Legacy: **ninguno**. (flashcards y speed-round fueron retirados el 2026-08-10 con sus récords purgados; dot-bombs, dotaxi y dont-pop fueron reconstruidos RN-safe — specs en `docs/superpowers/specs/`.)

Nuevos (12, todos RN-safe y con `?seed=` determinista donde aplica):

| Juego | key | Mecánica | Contenido |
|---|---|---|---|
| ¿Verdad o Trampa? | true-false | swipe (pointer events) sí/no sobre pares EN-ES, con botones ✗/✓ de respaldo; trampas con falsos amigos; termina al agotarse mazo o tiempo | vocab_items + FALSE_FRIENDS |
| Dot Match | dot-match | parejas EN/ES contrarreloj, 3 rondas 60/45/30s, combo | vocab_items |
| Memoria Relámpago | memory | 4×4 flip cards palabra-imagen, cronómetro+movimientos | words (con img) |
| Escucha Rápida | audio-blitz | oyes narración, eliges la palabra, 7s/pregunta; acierto rápido paga más y se ve (+N) | sentences con narración |
| Torre de Palabras | word-tower | palabra cae (useTicker/transform), tap al carril de su categoría, 3 vidas; rondas rebarajadas en cada revancha sin seed | vocab_packs |
| Constructor | sentence-builder | oyes la frase, la armas con fichas en orden; bonus por rapidez y señuelos cruzados que escalan (diferenciado del buildUp de la práctica) | sentences con narración |
| Palabra del Día | wordle | wordle diario server-side, teclado QWERTY en pantalla (compartido con crossword); intentos y longitud los manda el servidor | vocab (server) |
| Mini Crucigrama | crossword | 5×5 diario determinista, pistas ES, 5 checks (botón deshabilitado al agotarlas; fallo de red visible) | vocab (server) |
| Carrera Fantasma | ghost-race | corres preguntas de audio vs replay grabado de un rival (barra fantasma por timeline; el timeline registra TODA pregunta resuelta) | audio-blitz + game_runs |
| Dot Bombs | dot-bombs | caen bombas con imagen y palabra; desactivas deletreando con fichas de anagrama (tap); modos easy/medium/hard y survival | words (con img) |
| ¡No lo revientes! | dont-pop | sin reloj: el globo se infla solo y ES la presión; imagen + 3 palabras, acertar desinfla y fallar infla; responder tranquilo paga más | words (con img) |
| Dotaxi | dotaxi | frase con hueco; mueves el taxi al carril de la palabra y confirmas con «¡Vamos!»; los carriles crecen 2→3→4 con los aciertos | dotaxi (frases) |

Patrón de página: Suspense (searchParams) → fetch con loadError/Reintentar → `GameIntro` (récord propio + trono vía `useGameRecords`) → juego → `GameResult` (score una vez; muestra +XP, récord, trono robado; con `reportables` añade «Reportar un problema», ver «Reportes de ejercicios»). Hooks `useTournamentMode` (`?tournament=1`) y `useChallengeMode` (`?challenge=<id>`) envían scores adicionales a sus endpoints al llegar a result.

### El arcade (`/play`)

`components/play/arcade-container.tsx` pide la lista (`GET /games`, obligatoria) y en
paralelo lo que solo decora: torneo de la semana y el estado de hoy de los dos
diarios. Ninguna de esas tres retrasa la rejilla ni la rompe si falla (el badge de
trono se retiró; ver `lib/arcade.ts`). El reparto en bloques, la clave de juego, los
badges y el copy del estado diario viven en `lib/arcade.ts`, que es puro y está bajo
`node --test`. Los tiles exportan su geometría para que `arcade-skeleton.tsx` calque
la retícula real en vez de aproximarla. Se entra a un juego con `router.push`: la
excepción legacy de `window.location.assign` murió aquí.

El esqueleto de carga presupone que los dos juegos diarios están desbloqueados y, por tanto,
los retira si el usuario aún no los tiene. Solo lo perciben los usuarios con menos de cinco
niveles completados, que es cuando el primero de ellos se abre; se aceptó así deliberadamente
porque cambiar este comportamiento sería incorrecto para el resto.

## Social (visible en /quests)

- **Torneo semanal** (`tournament-card.tsx`): juego de la semana por rotación, top-10, countdown, CTA con `?tournament=1&seed=`.
- **Retos 1v1** (`challenges-panel.tsx` + ⚔️ en `top-students.tsx`): retar desde el leaderboard, mismo mazo por seed, panel entrantes/salientes/historial, badge en nav.
- **Rival** (`rival-banner.tsx`): el de arriba/abajo tuyo en XP semanal, con avatar, nombre y diferencia. El mismo `GET /me/rival` alimenta el aviso "te pasó" del hub (ver «Aviso "te pasó"» arriba), que sustituyó al toast imperativo de `use-rival-watch` — ese hook ya no existe.
- **Trono**: récord global por juego; robarlo = +10 gemas (server).

## Auth y datos

`lib/api-client.ts`: axios con access token **en memoria** + refresh cookie HttpOnly → por eso `router.push` obligatorio. Usuario cacheado en `localStorage["user"]` (id/nombre para UI). Services resilientes: los de features sociales devuelven null/[] en error para no romper el shell.

## Temas y preferencias

`design/themes.json` (paleta × modo) → `scripts/themes/render.mjs` (funciones puras) + `scripts/themes/build.mjs` (E/S, `--check`) → generados `app/themes.generated.css` y `lib/theme-colors.ts`; `npm run lint` falla si están desactualizados.

`<html data-palette="rosa|electrico" data-theme="light|dark">`: Auto es la ausencia de `data-theme` (resuelve por `prefers-color-scheme`). El script anti-flash inline de `app/layout.tsx` fija estos atributos antes del primer paint desde el espejo de `localStorage`; `applyThemePrefs` (`lib/theme-prefs.ts`) hace exactamente lo mismo desde React — si cambias uno, cambia el otro.

`components/profile/settings-sheet.tsx`: hoja de ajustes que reemplazó al toggle binario claro/oscuro; lee el modo resuelto del DOM (`html.dark`) y nunca de `matchMedia` en el render (regla 12). Ver "El perfil" arriba para el detalle de qué escribe (paleta, modo y sonido) y cómo se reconcilia con el servidor.

`components/theme/theme-sync.tsx`: reconcilia paleta, modo y sonido contra `GET /me/settings` — ver "El perfil" arriba para el detalle completo (servidor autoritativo salvo marca de pendiente); en Auto también sigue `prefers-color-scheme` con la pestaña abierta.

`services/settings.service.ts`: fetchers de `/me/settings` (`GET`/`PATCH`), tolerantes a que el endpoint no exista todavía.

`lib/level-math.ts` es la única fórmula de nivel (la comparten HUD y perfil).

## Deuda conocida (frontend)

- Con `settings` ya declarada en la entidad `Users` del backend, viaja en todos
  los `save(user)`: un `PATCH /me/settings` que confirme entre la lectura y el
  guardado de una escritura de XP puede quedar pisado. La vía limpia sería
  marcar la columna como no seleccionada por defecto y pedirla explícitamente
  donde se usa, pero hacerlo mal es peor que la carrera — si la lectura
  devolviera vacío, el merge partiría de los valores por defecto y borraría
  los ajustes del usuario —, así que queda anotado y sin cambiar.
- `GameResult` traga errores del submit sin estado de error (patrón aceptado batch-wide).
- Aviso "te pasó" (§6.5): la tarjeta puede quedar **enterrada bajo una pista
  contextual que sube DESPUÉS de emitirla**, y el orden juega a favor de que
  pase — `RivalWatch` emite en cuanto resuelve su fetch y `TipsController` va por
  detrás por construcción (pide settings, busca el ancla, espera animaciones
  hasta 800 ms y solo entonces toma el scroll). Como el snapshot ya se consumió,
  ese adelantamiento se pierde para siempre. El caso inverso —el tapón que ya
  estaba puesto— sí está cubierto. Cerrarlo pide recomprobar `pantallaTapada()`
  al pintar, o suscribirse a `lib/scroll-lock.ts`.
- Aviso "te pasó": el aviso **fantasma no dura 6 s, dura mientras el hub siga
  montado**. El estado viaja con su ruta, así que salir del Camino a los 2 s,
  navegar diez minutos y volver repinta la tarjeta entera con 6 s nuevos, y ese
  repintado además no pasa por la comprobación de tapones. No es información
  falsa, es vieja. La vía limpia es pasarle a `RivalAlert` el instante de emisión
  para que descuente, en vez de reiniciar el temporizador al montarse.
- Aviso de resultados de los reportes (`components/report/report-notice-watch.tsx`): igual
  que el aviso "te pasó" (arriba), puede quedar **debajo de una pista que suba DESPUÉS de
  pintarse**. Aquí pesa menos: la hoja no se cierra sola, así que no se pierde, y sigue
  esperando bajo la pista.
- Countdown del torneo muestra "0h" en la última hora.
- Rival: LIMIT 200 en backend → usuarios 201+ se ven como sin rank.
- crossword y wordle replican la fórmula de score del backend en cliente solo
  para mostrarla (`crosswordScore` / el cálculo de wordle, comentados con su
  fuente); el arreglo de fondo es que los endpoints devuelvan el score ya
  calculado.
- wordle no escucha el teclado físico (cumple la regla RN-safe: teclados =
  botones en pantalla), así que en escritorio hay que tocar las teclas.
- `useGameSeed()` (hooks/) es el único lector de `?seed=`: lo honra SOLO con `?tournament=1` o `?challenge=<id>`, así que fijar un seed a mano en juego libre ya no permite memorizar el mazo y farmear récord/trono.
- `submitChallengeScore(score, { completed })` exige declarar si la partida terminó: el intento del reto 1v1 se gasta a la primera (el backend 409ea repetidos) y no hay rearme, así que enviar un abandono lo quemaba. Los seis juegos con reto lo declaran explícitamente.
- "Salir" a mitad de dot-match va a result con score parcial (decisión de diseño: su score sube desde 0). En memory, "Salir" ABANDONA sin enviar nada — su fórmula parte de 1000 y baja, y un parcial temprano superaría a cualquier partida completa (exploit de torneo, corregido 2026-08-10). En sentence-builder, "Salir" también abandona sin enviar — el guard del reto 1v1 no se rearma y un parcial quemaba el intento (corregido 2026-08-10). En ghost-race igual: salir posteaba a /ghost/run una carrera truncada (corregido 2026-08-10). En audio-blitz, true-false, word-tower, dotaxi y dont-pop el parcial SÍ cuenta para el récord personal (su score sube desde 0, como dot-match), pero torneo y reto solo aceptan partidas completas (corregido 2026-08-10).
- `/games/dont-pop` tampoco acepta seed: no debe entrar en reto ni torneo hasta que el endpoint lo honre.
- `/games/dotaxi` IGNORA el `seed` (el backend baraja con Math.random), así que dos rivales reciben mazos distintos: dotaxi NO debe entrar en `CHALLENGE_GAMES` ni en la rotación de torneo hasta que el endpoint lo honre.
- Torre de Palabras: en partidas sin seed, la ronda 0 muestra la palabra de una ronda con
  los carriles de otra (bug previo, arreglo en una tarea aparte); hasta entonces sus reportes
  de la ronda 0 pueden traer una respuesta que no estaba entre las opciones.

## Historia

Specs/planes/handoffs en `docs/superpowers/`. Rama de trabajo: `redesign/total` (mergeada a main por FF el 2026-07-22).
