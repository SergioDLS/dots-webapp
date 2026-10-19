# Oraciones de Intermediate y Advanced — diseño

- **Fecha**: 2026-10-17
- **Repos afectados**: `dots-backend` (un script de datos con su lista de
  correcciones). En `dots-webapp`, este documento y una línea de
  `components/practice-container/practice-container.tsx` (`??` → `||`).
- **Estado**: aplicado en producción el 2026-10-19 a las 12:50 UTC con
  `dots-backend/scripts/sentence-fixes.js` (respaldo
  `scripts/out/backup-sentence-fixes-2026-10-19T12-50-20-911Z.json`; se
  deshace con `npm run content:sentences -- --rollback <respaldo>`, que se
  niega si alguien editó una de estas oraciones o regeneró su narración).
  Verificado con el dry-run sobre la BD en vivo: las 149 oraciones tienen el
  «después», los 9 niveles su nombre nuevo y el pool del checkpoint no cambió.
  Sergio aprobó la lista el 2026-10-19 con las recomendaciones de abajo y
  dejó para después la regeneración de las narraciones.
- **Predecesora**: `2026-10-15-dificultades-parejas-design.md`. Su «Fuera de
  alcance» dejó para una tarea aparte las oraciones flojas que encontraron los
  revisores de las píldoras.

## Lo que se midió

Lectura de producción del 2026-10-17, dentro de `BEGIN READ ONLY … ROLLBACK`
y con el permiso de Sergio:

- Intermediate y Advanced tienen 41 niveles y 428 oraciones (26 desactivadas).
  Los 28 niveles de la lista suman 287 oraciones activas.
- **Ninguna de las 428 tiene progreso** (`sentences_progress`), tarjetas de
  repaso (`review_items`), respuestas aceptadas (`answer_alternatives`) ni
  reportes (`content_reports`). Corregirlas no le cambia nada guardado a
  ningún alumno.
- **Nada en curso**: ni checkpoints activos, ni placement, ni retos 1v1
  abiertos, ni puntajes de torneo. Los mazos sembrados de Escucha Rápida y
  Constructor salen de todas las oraciones narradas sin `ORDER BY`, así que
  cualquier `UPDATE` los mueve; hoy no hay ningún torneo, reto ni fantasma de
  esos juegos que dependa de ello.
- **Examen del checkpoint**: entre 28 y 58 oraciones *cloze* por sección (el
  mínimo es 5). Ninguna corrección saca una oración del pool.
- **Audio**: 411 oraciones tienen narración de la oración completa, grabada
  en `dots/sounds/sentences/<id>` (`scripts/out/upload-map.json`). Además
  tienen `img_sound`, que es el audio de la **respuesta** sola. Las 17
  restantes se narraron con ElevenLabs y no tienen `img_sound`.

## Lo que cambia el plan

1. **El audio de la respuesta.** El modo «What do you hear?» reproduce
   `img_sound`, que es la respuesta grabada. Si cambian las palabras de la
   respuesta, el alumno oiría la palabra vieja y fallaría. En 17 correcciones
   cambian esas palabras, así que su `img_sound` pasa a `NULL`.
2. **Sin `img_sound`, ese modo hoy no suena.** El servidor manda `''` y el
   cliente elige `dataSentence.img_sound ?? audioSrc`. Como `''` no es nulo,
   no cae a la narración de la oración. Ya les pasa a las 17 oraciones de
   ElevenLabs. El arreglo es cambiar `??` por `||`, y sirve para las 17 de hoy
   y para las 17 de esta corrección.
3. **La narración de la oración** vive en una ruta que sale del id. Si cambian
   las palabras, el audio queda viejo y se oye en casi todos los modos (se
   reproduce solo). 64 correcciones cambian lo que se dice (59 sin los
   extras). Se regeneran con
   `node scripts/generate-narrations.js --apply --force --ids …`, que es
   ElevenLabs (unos 3.000 caracteres) y es un paso aparte con su propio sí.
   **Pendiente** (Sergio, 2026-10-19: «no por ahora»). Ids: 619, 623, 627,
   630, 633, 636, 642, 662, 669, 671, 673, 676, 682, 685, 688, 692, 696, 697,
   713, 714, 715, 721, 731, 733, 738, 767, 770, 775, 776, 777, 781, 784, 785,
   788, 804, 809, 837, 840, 848, 849, 850, 852, 855, 858, 939–946, 957, 963,
   989, 994–997, 1000–1003 y 1012.
4. **«¡Arma la oración!» tiene un bug de código.** Cuando la puntuación va
   pegada al hueco (`__,`, `__?`, `__!` o un `__.` después de otro punto), el
   servidor deja fuera de las fichas el token que contiene `__`, la
   puntuación se pierde y la comparación es exacta: el alumno nunca acierta.
   Hoy le pasa a 33 oraciones activas de Intermediate/Advanced. Las
   correcciones arreglan 11 y no rompen ninguna. Las 22 que siguen fallando
   (y las de Beginner) quedan para una tarea de código aparte; no tiene
   sentido torcer las oraciones para esquivarlo.

## Propuesta

- **149 oraciones.** 75 son de forma (espacios, tabuladores, la numeración
  «1.», puntos dentro de la respuesta, punto final que faltaba), 66 son de
  contenido y 8 son extras que no estaban en la lista.
- **9 nombres de niveles** (`levels.name`, que el Camino muestra como título
  del nivel): 8 de la lista y 1 extra.
- Se mantienen los ids, no se borra nada y no hace falta desactivar ninguna
  oración: todas tenían arreglo. Las desactivadas no se tocan.
- Criterios: la respuesta del hueco es lo que el nivel enseña; donde se pudo,
  se corrigió la oración y no la respuesta, para que el audio de la respuesta
  siga sirviendo. Las oraciones nuevas evitan que otra respuesta del mismo
  nivel también encaje, porque los distractores salen de ahí. Se priorizó el
  inglés americano (gotten, under oath).
- **Decisiones de Sergio** (2026-10-19, «con tus recomendaciones»):
  - Idioms #918, «The old lawnmower finally kicked the bucket»: **se queda**.
    Aplicarle «kick the bucket» a una máquina es un uso informal común, y con
    una persona la oración se vuelve sombría.
  - Slang #926 «bae» y #930 «on fleek»: **se quedan**. La píldora de jerga ya
    las presenta como pasadas de moda y las explica.
  - **Entran los 8 extras**: Antonyms #994–#997 y #1002, porque ahí servían
    las dos palabras del par; #616, «Dear me,» seguido de «It» y la hora
    `4.30`; #645, la coma tras «Please»; #855, que pasa de «on» a «by» como el
    #692. También entra el nombre extra: «the ING form» → «The -ing form».
  - **Entra la línea del cliente** (`??` → `||`). La regeneración de las
    narraciones es un paso aparte, con su propio sí.

## El script

`dots-backend/scripts/sentence-fixes.js`, con el patrón obligatorio del
backend: dry-run por defecto, `--apply`, respaldo JSON en `scripts/out/`
antes del COMMIT y `--rollback`. La lista vive en
`scripts/sentence-fixes/correcciones.json` (id, nivel, antes, después y
motivo) y la lógica pura en `scripts/sentence-fixes/core.js`, con tests.

En una transacción:

1. Valida la lista. Cada «después» tiene un solo `__`, ningún espacio sobrante
   ni tabulador, una respuesta no vacía y una oración llena que termina en
   puntuación, y no rompe «¡Arma la oración!» si antes no estaba rota.
2. Bloquea las filas y aborta si alguna ya no es exactamente el «antes»: si
   alguien la editó en `/admin` después de la medición, no se pisa. También
   aborta si una oración corregida tiene respuestas aceptadas, si hay un
   checkpoint empezado hace menos de 2 horas en una sección afectada (se
   corrige regenerando el examen) o si un placement espera una de estas
   oraciones.
3. Actualiza `text` y `m_word`, deja `img_sound` en `NULL` donde cambian las
   palabras de la respuesta y renombra los niveles. Cada `UPDATE` lleva el
   «antes» en el `WHERE` y tiene que tocar exactamente una fila.
4. Verifica dentro de la transacción: lo escrito es el «después», ninguna
   oración salió del pool *cloze* y todas las secciones siguen con 5 o más.
5. Escribe el respaldo (fila previa completa) y hace COMMIT. Imprime los ids
   cuya narración hay que regenerar, con el comando listo.

El rollback restaura `text`, `m_word`, `img_sound` y los nombres. Se niega si
alguna fila ya no es el «después» o si su narración se regeneró (cambió
`voice_character_id` o `sentence_extension`), porque devolver el texto viejo
la dejaría desfasada.

## Verificación

- Tests puros del validador y del plan (`npm run test:scripts`).
- Ensayo contra un Postgres local desechable, como los anteriores.
- Dry-run de solo lectura contra producción.
- Después del apply, con el sí de Sergio: las verificaciones sobre la BD en
  vivo y una práctica de un nivel corregido en el navegador integrado.

## Tabla completa

Los `·` marcan espacios sobrantes y `⇥` un tabulador. La columna «audio» dice
qué queda viejo: «narración» es la oración completa y «respuesta» el
`img_sound`.

### Exclamations (56)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 614 | `__ I did not realize it was getting so late!` → `·Good heavens!` | `__ I did not realize it was getting so late!` → `Good heavens!` | Espacios o numeración. | — |
| 616 (extra) | `__ It is already 4.30 and I said I would be home by 5.00!` → `Dear me,` | `__ It is already 4:30 and I said I would be home by 5:00!` → `Dear me!` | Tras «Dear me,» venía «It» con mayúscula; la hora va con dos puntos (además el 4.30 perdía el punto en Arma la oración). | — |
| 617 | `__ nobody was hurt···in the accident.` → `Thank God` | `__ nobody was hurt in the accident.` → `Thank God` | Espacios o numeración. | — |
| 618 | `__ that our partner does not recognize the same values.·` → `What a shame` | `__ that our partner does not recognize the same values.` → `What a shame` | Espacios o numeración. | — |
| 619 | `This report is __ and nothing but a waste of paper.` → `nonsense` | `__ This report is nothing but a waste of paper.` → `Nonsense!` | «nonsense» era un sustantivo, no una exclamación. | narración |
| 621 | `Louise has got us all tickets for the show. __ is that?` → `·How strange` | `Louise has got us all tickets for the show. __ is that?` → `How strange` | Espacios o numeración. | — |
| 623 | `I would not say she is rich, but she is __.·` → `all right` | `__ We won the game!` → `All right!` | «all right» significaba «acomodada», no era una exclamación. | narración |
| 627 | `Please __ on the sofa! I want to sit down.` → `make room` | `__ Grandma needs a seat.` → `Make room!` | «make room» iba como verbo dentro de la frase, no como exclamación. | narración |
| 629 | `·I am sorry I lost that wallet you gave me. __, I can easily buy you another one.` → `Never mind` | `I am sorry I lost that wallet you gave me. __, I can easily buy you another one.` → `Never mind` | Espacios o numeración. | — |
| 630 | `Well, __, we are done - we can go home now.` → `that's it` | `__ We are done for today!` → `That's it!` | «that's it» iba dentro de la frase, no como exclamación. | narración |

### Compound words (57)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 633 | `This __ is stucked.·` → `water pipe` | `This __ is blocked.` → `water pipe` | «is stucked» no existe; una cañería se tapa (blocked). | narración |
| 635 | `I think this is the __.` → `·way out` | `I think this is the __.` → `way out` | Espacios o numeración. | — |
| 636 | `We are going to purchase the finished goods at a __..` → `fixed price` | `We bought all the food for the party at the __.` → `supermarket` | «fixed price» no es una palabra compuesta; además llevaba punto doble. | narración, respuesta |
| 637 | `We should go to the __ game next Saturday.` → `football·` | `We should go to the __ game next Saturday.` → `football` | Espacios o numeración. | — |
| 638 | `Anne is a __.` → `school girl` | `Anne is a __.` → `schoolgirl` | Se escribe junto: schoolgirl. | — |
| 639 | `These are the products I use for __ cleaning.` → `·everyday·` | `These are the products I use for __ cleaning.` → `everyday` | Espacios o numeración. | — |
| 640 | `There was not a single __ in the sand.` → `footprint·` | `There was not a single __ in the sand.` → `footprint` | Espacios o numeración. | — |
| 641 | `He is a very competent __.·` → `horseman` | `He is a very competent __.` → `horseman` | Espacios o numeración. | — |
| 642 | `I live to see the __ at sunrise.·` → `sunlight` | `I love to see the __ at sunrise.` → `sunlight` | Errata: live → love. | narración |
| 643 | `My __ is full of mail already.·` → `letterbox` | `My __ is full of mail already.` → `letterbox` | Espacios o numeración. | — |
| 644 | `·Remember that the __ comes today.` → `milkman` | `Remember that the __ comes today.` → `milkman` | Espacios o numeración. | — |
| 645 (extra) | `·Please, take this __ to the table.` → `soup plate` | `Please take this __ to the table.` → `soup plate` | Sobraba la coma tras Please (y el espacio inicial). | — |

### Actions (58)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 646 | `He greeted me with __.·` → `a kiss` | `He greeted me with __.` → `a kiss` | Espacios o numeración. | — |
| 647 | `The thought brought __ to her face.·` → `a smile` | `The thought brought __ to her face.` → `a smile` | Espacios o numeración. | — |
| 650 | `Let’s go for __.·` → `a run` | `Let’s go for __.` → `a run` | Espacios o numeración. | — |
| 651 | `She was just __ of a thing.·` → `a slip` | `She was just __ of a thing.` → `a slip` | Espacios o numeración. | — |
| 654 | `Isabel went home and had __.·` → `a cry` | `Isabel went home and had __.` → `a cry` | Espacios o numeración. | — |
| 655 | `Not even __ of wind stirred the pine branches.·` → `a breath` | `Not even __ of wind stirred the pine branches.` → `a breath` | Espacios o numeración. | — |
| 656 | `I took __.·` → `·a walk` | `I took __.` → `a walk` | Espacios o numeración. | — |
| 657 | `She knocked him out with __.·` → `a blow` | `She knocked him out with __.` → `a blow` | Espacios o numeración. | — |
| 658 | `They need __.·` → `a rest` | `They need __.` → `a rest` | Espacios o numeración. | — |
| 659 | `She took __ of the sandwich.` → `·a bite` | `She took __ of the sandwich.` → `a bite` | Espacios o numeración. | — |

### Present perfect (59)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 661 | `He __ various kinds of books.` → `·has read` | `He __ various kinds of books.` → `has read` | Espacios o numeración. | — |
| 662 | `They __ football.` → `·have played` | `They __ football on the school team since they were ten.` → `have played` | Sin contexto servían varios tiempos; «since» exige el present perfect. | narración |
| 663 | `__ George?` → `Have you ever met·` | `__ George?` → `Have you ever met` | Espacios o numeración. | — |
| 667 | `They __ here for years.` → `·haven't lived` | `They __ here for years.` → `haven't lived` | Espacios o numeración. | — |
| 669 | `You __ a lot` → `have walked` | `You __ ten miles today, so your feet must be sore.` → `have walked` | Sin contexto servían otras respuestas del nivel (have written, have played…). | narración |

### Past perfect (60)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 682 | `The train __ when I arrived to the station.` → `had just left` | `The train __ when I arrived at the station.` → `had just left` | arrive at, no arrive to. | narración |
| 683 | `My 18th birthday was the worst day I __·` → `had ever had` | `My 18th birthday was the worst day I __.` → `had ever had` | Espacios o numeración. Faltaba el punto final. | — |
| 685 | `I __ the washing out when it started to rain.` → `just had put·` | `I __ the washing out when it started to rain.` → `had just put` | El orden es had just put. | narración, respuesta |
| 688 | `After she __ I found her note, I didn't say anything until she had finished talking.` → `had moved out` | `I found her note after she __.` → `had moved out` | La oración estaba rota (dos frases pegadas). | narración |

### Future perfect (61)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 692 | `I __ there for six months on June 23rd` → `will have been` | `I __ there for six months by June 23rd.` → `will have been` | Con el future perfect el marcador es by. | narración |
| 693 | `By the time you read this, I __` → `will have left` | `By the time you read this, I __.` → `will have left` | Faltaba el punto final. | — |
| 694 | `You __ your report by this time next week` → `will have finished` | `You __ your report by this time next week.` → `will have finished` | Faltaba el punto final. | — |
| 696 | `__ when I picked for you?` → `Will you have eaten` | `__ by the time I pick you up?` → `Will you have eaten` | «when I picked for you» estaba roto. | narración |

### Connectors (62)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 671 | `I won't go to the party __ I was invited·` → `even though` | `I didn't go to the party __ I was invited.` → `even though` | Mezclaba tiempos (won't … was invited). | narración |
| 672 | `__ she was walking, I was running·` → `While·` | `__ she was walking, I was running.` → `While` | Espacios o numeración. Faltaba el punto final. | — |
| 673 | `You are very late __ we cannot start the lesson.` → `so that` | `Speak louder __ everyone can hear you.` → `so that` | «so that» es «para que»; la frase pedía «so». Se mantiene so that con una frase de propósito. | narración |
| 675 | `You do not need to go __ you want to.·` → `·unless` | `You do not need to go __ you want to.` → `unless` | Espacios o numeración. | — |
| 676 | `__ I see you,··I am better.·` → `Since` | `__ I met you, I have been much happier.` → `Since` | «Since I see you, I am better» no tenía sentido. | narración |
| 677 | `I use water when making pasta,··__ my mom uses eggs` → `whereas` | `I use water when making pasta, __ my mom uses eggs.` → `whereas` | Espacios o numeración. Faltaba el punto final. | — |
| 678 | `__ if alex earned a big salary, he would not buy a fast car` → `Even` | `__ if Alex earned a big salary, he would not buy a fast car.` → `Even` | alex → Alex. | — |

### Phrasal verbs (63)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 697 | `1.⇥Jane’s brother did not come to her wedding. She felt __.` → `let down` | `Jane’s brother did not come to her wedding, so she felt __.` → `let down` | Numeración «1.» pegada; además el punto tras el hueco rompía Arma la oración. | narración |
| 701 | `Paul misbehaves all the time. But this time, his father decided not to __` → `let him off.` | `Paul misbehaves all the time, but this time his father decided not to __.` → `let him off` | Punto final dentro de la respuesta. | — |
| 706 | `I got __ the team after a string of poor performances.` → `·kicked off·` | `I got __ the team after a string of poor performances.` → `kicked off` | Espacios o numeración. | — |
| 708 | `He wanted to get some fresh air so I __` → `let him out.` | `He wanted to get some fresh air, so I __.` → `let him out` | Punto final dentro de la respuesta. | — |
| 713 | `13.⇥I was driving and the motor just __` → `kicked out.` | `I was driving and the motor just __.` → `kicked out` | Espacios o numeración. Punto final dentro de la respuesta. | narración |
| 714 | `14.⇥The rent has been __ again.` → `kicked up` | `The rent has been __ again.` → `kicked up` | Espacios o numeración. | narración |
| 715 | `The car is __` → `kicking up.` | `The kids are __ a fuss about going to bed again.` → `kicking up` | «The car is kicking up» no tenía sentido claro; kick up a fuss = armar un escándalo. | narración |
| 721 | `20.⇥I’m going to stay at home on Saturday and just __` → `kick back.` | `I’m going to stay at home on Saturday and just __.` → `kick back` | Espacios o numeración. Punto final dentro de la respuesta. | narración |
| 723 | `What was that noise? It sounded like a bomb __` → `went off.` | `What was that noise? It sounded like a bomb __.` → `went off` | Punto final dentro de la respuesta. | — |
| 725 | `You have to push the switch hard to get the heater to __` → `kick in.` | `You have to push the switch hard to get the heater to __.` → `kick in` | Punto final dentro de la respuesta. | — |
| 726 | `Some young men tried to __ last night.·` → `kick her door down` | `Some young men tried to __ last night.` → `kick her door down` | Espacios o numeración. | — |
| 731 | `30.⇥After several years of making a loss, the business finally __` → `went under.` | `After several years of making a loss, the business finally __.` → `went under` | Espacios o numeración. Punto final dentro de la respuesta. | narración |

### Shall (66)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 732 | `·I __ it to you tomorrow.` → `shall post` | `I __ it to you tomorrow.` → `shall post` | Espacios o numeración. | — |
| 733 | `We __ to tell him what happened.` → `shall have` | `We __ dinner at eight.` → `shall have` | «shall have» era una respuesta incompleta (shall have to); ahora have es el verbo principal. | narración |
| 738 | `You __ your room before you go out` → `shall clean` | `I __ my room before I go out.` → `shall clean` | «You shall clean your room» es arcaico; shall va con I y we. | narración |
| 740 | `We __ on vacation next month.·` → `shall go` | `We __ on vacation next month.` → `shall go` | Espacios o numeración. | — |
| 741 | `I __ on my dreams` → `shall never give up` | `I __ on my dreams.` → `shall never give up` | Faltaba el punto final. | — |

### Used to (67)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 762 | `You __··the piano.` → `used to play` | `You __ the piano.` → `used to play` | Espacios o numeración. | — |
| 767 | `No matter how many times I fly, I'll never get __ and landing!` → `used to take-off` | `No matter how many times I fly, I'll never get __ takeoffs and landings!` → `used to` | «used to take-off» partía «take-off and landing». | narración, respuesta |
| 768 | `·They __ in London.` → `used to live·` | `They __ in London.` → `used to live` | Espacios o numeración. | — |
| 770 | `We are __ to the seaside for our holidays.` → `used to go` | `We __ to the seaside for our holidays.` → `used to go` | «We are used to go» es incorrecto. | narración |
| 771 | `Sam and Mary __ to Mexico in the summer.` → `·used to go` | `Sam and Mary __ to Mexico in the summer.` → `used to go` | Espacios o numeración. | — |

### Active/passive (68)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 775 | `·The strawberry pie __ by me` → `was eaten·` | `The whole strawberry pie __ before I got home, so I didn't get a single bite.` → `was eaten` | Pasiva forzada («by me»). | narración |
| 776 | `A Honda car __ by me` → `·was bought` | `The old house __ by a young couple.` → `was bought` | Pasiva forzada («by me»). | narración |
| 777 | `Skydiving __ by Reema` → `can be done·` | `This exercise __ at home without any equipment.` → `can be done` | Pasiva forzada («by Reema»). | narración |
| 779 | `·The windows __ .` → `have been cleaned` | `The windows __.` → `have been cleaned` | Espacios o numeración. | — |
| 781 | `The sweater __ by her.` → `is knitted` | `Each sweater __ by hand.` → `is knitted` | Pasiva forzada («by her»). | narración |
| 782 | `Milk __ in litres` → `·is sold·` | `Milk __ in litres.` → `is sold` | Espacios o numeración. Faltaba el punto final. | — |
| 783 | `The jar __ with juice.` → `is filled·` | `The jar __ with juice.` → `is filled` | Espacios o numeración. | — |
| 784 | `Chocolates __ by them.` → `are being eaten` | `The chocolates __ faster than I can buy them.` → `are being eaten` | Pasiva forzada («by them»), igual que las otras cuatro. | narración |

### Had better (69)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 785 | `The movie __ soon.` → `had better end` | `This movie __ soon, or I'm going to fall asleep.` → `had better end` | «The movie had better end soon» sonaba rara sin la consecuencia. | narración |
| 786 | `They __ here before we start dinner.` → `had better be·` | `They __ here before we start dinner.` → `had better be` | Espacios o numeración. | — |
| 787 | `It’s five o’clock. I __ now before the traffic gets too bad.` → `·had better go` | `It’s five o’clock. I __ now before the traffic gets too bad.` → `had better go` | Espacios o numeración. | — |
| 788 | `The democratic movement __ on the immediate issues of the economy and security.·` → `had better concentrate` | `You __ on your exams this week.` → `had better concentrate` | Registro político que no encajaba. | narración |
| 790 | `You __ Elizabeth about the broken glass·` → `had better not tell` | `You __ Elizabeth about the broken glass.` → `had better not tell` | Espacios o numeración. Faltaba el punto final. | — |
| 791 | `·__ a note for the delivery guy to take the parcel next door?` → `Had we better leave` | `__ a note for the delivery guy to take the parcel next door?` → `Had we better leave` | Espacios o numeración. | — |
| 794 | `·She __ ready for next week's meeting` → `had better be` | `She __ ready for next week's meeting.` → `had better be` | Espacios o numeración. Faltaba el punto final. | — |

### Reported speech (70)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 795 | `Manny said he __ home.·` → `was going·` | `Manny said he __ home.` → `was going` | Espacios o numeración. | — |
| 796 | `Felicite wondered where they __.·` → `had gone` | `Felicite wondered where they __.` → `had gone` | Espacios o numeración. | — |
| 799 | `Bob said that he __ in his garden.·` → `enjoyed working` | `Bob said that he __ working in his garden.` → `enjoyed` | Dos verbos en el hueco. | respuesta |
| 800 | `She said she __ me later.` → `·would see` | `She said she __ me later.` → `would see` | Espacios o numeración. | — |

### Suppose (71)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 803 | `__ that you agreed with me.` → `Just suppose for a moment` | `Just __ for a moment that you agreed with me.` → `suppose` | Respuesta larguísima. | respuesta |
| 804 | `__, what do we do then?` → `Supposing he refuses to help` | `__ he refuses to help, what do we do then?` → `Suppose` | Respuesta larguísima (y la coma pegada al hueco rompía Arma la oración). Suppose y no Supposing, porque «suppose» es otra respuesta del nivel y también valdría. | narración, respuesta |
| 805 | `The renovations will cost much __` → `more than we originally supposed.` | `The renovations will cost much more than we originally __.` → `supposed` | Respuesta larguísima con el punto final dentro. | respuesta |
| 806 | `·__ an egg and asked you to describe exactly what was inside.` → `Suppose someone gave you` | `__ someone gave you an egg and asked you to describe exactly what was inside.` → `Suppose` | Respuesta larguísima. | respuesta |
| 807 | `The policy is perfectly clear and __ that it isn't working.` → `·I see no reason to suppose` | `The policy is perfectly clear, and I see no reason to __ that it isn't working.` → `suppose` | Respuesta larguísima. | respuesta |
| 808 | `I knew very well that the problem was __.` → `more complex than he supposed` | `I knew very well that the problem was more complex than he __.` → `supposed` | Respuesta larguísima. | respuesta |
| 809 | `__ that by then Peter would be married.` → `It had been supposed` | `Peter and Anna __ get married last year, but they changed their minds.` → `were supposed to` | «It had been supposed that…» era muy formal y anticuada. | narración, respuesta |
| 810 | `__ two to three hours.` → `The process was supposed to take·` | `The process __ take two to three hours.` → `was supposed to` | Respuesta larguísima. | respuesta |

### Can/Could have (75)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 837 | `I __ into any university in the word if I had applied.` → `could have got` | `I __ into any university in the world if I had applied.` → `could have gotten` | Errata word → world; got → gotten (inglés americano). | narración, respuesta |
| 840 | `I __ that to him, he is my best friend after all.` → `couldn’t have done` | `I __ that to him because he is my best friend.` → `couldn’t have done` | Unía dos frases con coma. | narración |

### Will be doing (76)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 848 | `The baby __ the whole night.` → `will be playing·` | `At this time tomorrow, the kids __ in the pool.` → `will be playing` | Sin un momento futuro que la anclara. | narración |
| 849 | `I __ my mother to make breakfast.` → `will be helping` | `Tomorrow morning, I __ my mother to make breakfast.` → `will be helping` | Sin un momento futuro que la anclara. | narración |
| 850 | `Sheldon __ the cake later.` → `will be eating` | `Don't call Sheldon at seven because he __ dinner then.` → `will be eating` | Sin un momento futuro que la anclara. | narración |
| 852 | `She __ her dog for a walk.` → `will be taking` | `At six o'clock, she __ her dog for a walk.` → `will be taking` | Sin un momento futuro que la anclara. | narración |

### Will have done (77)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 855 (extra) | `We __ in this house for a year on February 2nd` → `will have been` | `We __ in this house for a year by February 2nd.` → `will have been` | Igual que en Future perfect, by. | narración |
| 856 | `They __ their lunch by then` → `will not have had` | `They __ their lunch by then.` → `will not have had` | Faltaba el punto final. | — |
| 858 | `If all goes well, by June 2012, I __ my university degree.` → `will have finished` | `If all goes well, by next June I __ my university degree.` → `will have finished` | «by June 2012» ya pasó. | narración |

### about (81)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 889 | `·I'm __ going on vacation next month.` → `thinking about` | `I'm __ going on vacation next month.` → `thinking about` | Espacios o numeración. | — |
| 890 | `She's __ environmental conservation.` → `·passionate about` | `She's __ environmental conservation.` → `passionate about` | Espacios o numeración. | — |
| 891 | `We need to __ our future plans` → `have a discussion about` | `We need to __ our future plans.` → `have a discussion about` | Faltaba el punto final. | — |
| 892 | `What's so special __ book?` → `about that·` | `What's so special __ book?` → `about that` | Espacios o numeración. | — |

### questions tags (83)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 901 | `You've finished your homework, __` → `·haven't you?` | `You've finished your homework, __` → `haven't you?` | Espacios o numeración. | — |

### Idioms (84)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 914 | `Buying a new car can __ these days.` → `·cost an arm and a leg` | `Buying a new car can __ these days.` → `cost an arm and a leg` | Espacios o numeración. | — |

### slangs words (85)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 923 | `·I'm going skydiving tomorrow because, you know, __.` → `YOLO` | `I'm going skydiving tomorrow because, you know, __.` → `YOLO` | Espacios o numeración. | — |
| 924 | `·I didn't go out with them last night, and now I have serious __.` → `·FOMO` | `I didn't go out with them last night, and now I have serious __.` → `FOMO` | Espacios o numeración. | — |
| 928 | `·I'm meeting up with my __ for lunch later.` → `squad·` | `I'm meeting up with my __ for lunch later.` → `squad` | Espacios o numeración. | — |

### ways to say I don't like it (87)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 939 | `The concept doesn't align with my preferences; it's just __.` → `not my cup of tea·` | `Thanks for the invite, but opera is just __.` → `not my cup of tea` | Oración muy forzada. | narración |
| 940 | `While I can see its merits, I'm __ a personal connection to it.` → `not really feeling` | `The movie was well made, but I'm __ it.` → `not really feeling` | Oración muy forzada. | narración |
| 941 | `"It __ to my sensibilities or fit into the range of things that typically resonate with me.` → `doesn't quite appeal` | `The idea __ to me, to be honest.` → `doesn't quite appeal` | Comilla suelta y oración muy forzada. | narración |
| 942 | `The style or approach __.` → `isn't quite to my taste` | `The food was fine, but the sauce __.` → `isn't quite to my taste` | Oración muy forzada. | narración |
| 943 | `While I acknowledge its potential or value, I'm not particularly __.` → `fond of it` | `I know it's popular, but I'm not particularly __.` → `fond of it` | Oración muy forzada. | narración |
| 944 | `It __ with me emotionally or intellectually.` → `doesn't strike a chord` | `The song is catchy, but it __ with me.` → `doesn't strike a chord` | Oración muy forzada. | narración |
| 945 | `The overall appeal is missing __ for me; it lacks that special quality or charm.` → `appeal is missing` | `Karaoke? Sorry, it really isn't __.` → `my thing` | «The overall appeal is missing __» con respuesta «appeal is missing» estaba rota. | narración, respuesta |
| 946 | `It __ for me; there's an absence of that engaging factor.` → `doesn't quite do it` | `The new menu __ for me.` → `doesn't quite do it` | Oración muy forzada. | narración |

### Ways to say I like it (88)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 951 | `I'm __ it.` → `keen on·` | `I'm __ it.` → `keen on` | Espacios o numeración. | — |

### How to introduce yourself (89)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 955 | `Hi, __. It's a pleasure to meet you.` → `·I'm Emma` | `Hi, __. It's a pleasure to meet you.` → `I'm Emma` | Espacios o numeración. | — |
| 957 | `Hey there, __. Nice to make your acquaintance.` → `I go by Laura` | `Hey there, __. Nice to meet you.` → `I go by Laura` | «Nice to make your acquaintance» no es la fórmula. | narración |
| 962 | `Hi, everyone! I'm Saul. __` → `·I hope you're all doing well.` | `Hi, everyone! I'm Saul. __` → `I hope you're all doing well.` | Espacios o numeración. | — |
| 963 | `Hey there, I'm Sophie. __.` → `Pleasure to be in your company` | `Hey there, I'm Sophie. __.` → `Pleasure to meet you all` | «Pleasure to be in your company» sonaba rara. | narración, respuesta |

### ways to say "calm down" (90)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 964 | `Look, __. It’ll be okay` → `·just relax` | `Look, __. It’ll be okay.` → `just relax` | Espacios o numeración. Faltaba el punto final. | — |
| 965 | `·Everything will be okay. __.` → `Take it easy` | `Everything will be okay. __.` → `Take it easy` | Espacios o numeración. | — |
| 968 | `·__ and tell me what happened at school` → `take a deep breath` | `__ and tell me what happened at school.` → `take a deep breath` | Espacios o numeración. Faltaba el punto final. | — |
| 970 | `Everyone should just __ and step back` → `take a chill pill` | `Everyone should just __ and step back.` → `take a chill pill` | Faltaba el punto final. | — |
| 971 | `Just __, it’ll pass.` → `·let it go` | `Just __, it’ll pass.` → `let it go` | Espacios o numeración. | — |

### ways to say "congratulations" (93)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 989 | `Congratulations, __` → `you deserve this accomplishment!` | `Congratulations, __` → `you deserve it!` | «you deserve this accomplishment» no es idiomático. | narración, respuesta |

### Antonyms (94)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 994 (extra) | `She __ her journey early in the morning.` → `began·` | `She __ her journey early in the morning and arrived by lunchtime.` → `began` | Servían began y ended. | narración |
| 995 (extra) | `He __ his day late at night.` → `ended` | `He __ his day with a hot shower before bed.` → `ended` | Servían ended y began. | narración |
| 996 (extra) | `They __ the speed of the conveyor belt.` → `increased·` | `They __ the speed of the conveyor belt to finish the order faster.` → `increased` | Servían increased y decreased. | narración |
| 997 (extra) | `They __ the production output.` → `decreased` | `They __ the production output because sales were falling.` → `decreased` | Servían decreased e increased. | narración |
| 998 | `He __ the door to let in some fresh air.·` → `opens` | `He __ the door to let in some fresh air.` → `opens` | Espacios o numeración. | — |
| 1000 | `She __ the car on the highway.·` → `accelerated` | `She __ to pass the truck on the highway.` → `accelerated` | Par de «decelerated the vehicle»: «accelerated the car» también sonaba forzada. | narración |
| 1001 | `He __ the vehicle as he approached the intersection.` → `decelerated` | `He __ and stopped at the red light.` → `decelerated` | «decelerated the vehicle» sonaba forzada. | narración |
| 1002 (extra) | `She __ him deeply.` → `loves` | `She __ him deeply and can't wait to marry him.` → `loves` | Servían loves y hates. | narración |
| 1003 | `She __ them profoundly.` → `·hates` | `She __ waking up early, so she never takes morning classes.` → `hates` | «She hates them profoundly» era sombría. | narración |

### Other prepositions (95)

| id | antes (oración → respuesta) | después (oración → respuesta) | motivo | audio |
|---|---|---|---|---|
| 1008 | `__ the question about her favorite hobby, Sarah replied, 'I love painting landscapes.` → `In answer to` | `__ the question about her favorite hobby, Sarah replied, 'I love painting landscapes.'` → `In answer to` | Faltaba cerrar la comilla. | — |
| 1012 | `In court, witnesses are required to speak '__,' which means they promise to tell the truth.` → `on oath` | `In court, witnesses must speak __ and promise to tell the truth.` → `under oath` | En inglés americano es under oath; además la coma pegada al hueco rompía Arma la oración. | narración, respuesta |

### Nombres de niveles (`levels.name`)

| id | antes | después |
|---|---|---|
| 81 | `about` | `About` |
| 83 | `questions tags` | `Question tags` |
| 85 | `slangs words` | `Slang words` |
| 87 | `ways to say I don't like it` | `Ways to say I don't like it` |
| 90 | `ways to say "calm down"` | `Ways to say "calm down"` |
| 91 | `ways to say "I miss you "` | `Ways to say "I miss you"` |
| 92 | `ways to say "no"` | `Ways to say "no"` |
| 93 | `ways to say "congratulations"` | `Ways to say "congratulations"` |
| 82 (extra) | `the ING form` | `The -ing form` |
