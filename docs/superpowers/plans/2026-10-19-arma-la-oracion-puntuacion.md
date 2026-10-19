# «¡Arma la oración!» con puntuación pegada al hueco — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline; son tres tareas cortas) o superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que toda oración de la práctica tenga solución en «¡Arma la oración!» (modo `buildUp`): la bandeja bien armada tiene que ser EXACTAMENTE la referencia que manda el servidor.

**Architecture:** Una función pura nueva, `oracionParaArmar(text, mWord)` en `dots-backend/src/common/sentence-quiz.ts`, corta las fichas con `tokenizarOracion` (la misma regla del Constructor y del admin), separa lo que el hueco lleva pegado (`antes`/`despues`) y arma la referencia uniendo esas mismas fichas. `getSentencesPractice` la usa en lugar del `replace('.', '')` + `split(' ')` de hoy y envuelve con `antes`/`despues` las cuatro opciones de `buildOptionSet`. El webapp no cambia: su comparación exacta pasa a ser correcta por construcción.

**Tech Stack:** NestJS 11 + TypeScript 5.9, jest 30 + ts-jest.

**Spec:** no hay spec aparte; la causa raíz y las decisiones están abajo. La medición viene de la corrección de oraciones de Intermediate/Advanced (`docs/superpowers/specs/2026-10-17-oraciones-intermedio-avanzado-design.md`, «Lo que se midió», punto 4; lectura de producción del 2026-10-17).

**Estado:** ejecutado y en `main` el 2026-10-19. Sergio aprobó el plan tal cual (decisión 1 incluida: los distractores también se envuelven) y autorizó la comprobación de solo lectura y la subida. Backend `f19f7d1..1f04921`: `996db35`, `4a70e7d`, `8b13d76` y, tras la revisión, `dcc4f84`, `e7c433b` y `1f04921`. `npm test` 739/739, `npm run test:scripts` 83/83 y `npm run build` en verde. En producción, las 29 oraciones activas que no tenían solución (22 de Intermediate/Advanced y 7 de Beginner) la tienen, y ninguna queda mal (Tarea 3, paso 3).

## Causa raíz

En `getSentencesPractice` (`src/modules/sentences/sentences.service.ts`, modo `buildUp`) la referencia y las fichas salen de dos fuentes distintas:

- La **referencia** sale del texto: `text.trim().replace('.', '').replace('  ', ' ')` y luego `replace('__', m_word)`. Conserva todo lo que el hueco tiene pegado.
- Las **fichas** son los tokens de `split(' ')` que no contienen `__`, más la **respuesta**, que sale de `buildOptionSet` y es la `m_word` pelada.

El cliente (`esOracionAceptada`, `lib/accepted-answers.ts`) compara `armada.toUpperCase() === referencia.toUpperCase()`. Si el hueco lleva algo pegado (`__,`, `__?`, `__!`, `__'s` o un `__.` con otro punto antes, porque `replace('.', '')` solo quita el PRIMER punto), eso queda en la referencia y en ninguna ficha: no hay solución. Además, el `replace('.', '')` borra el primer punto esté donde esté («4.30» → «430», «Sophie.» → «Sophie») y el `replace('  ', ' ')` solo colapsa el primer espacio doble: un triple espacio o un espacio antes del punto final dejan una ficha vacía.

**Consecuencia para el alumno:** la oración fallada vuelve en la misma ronda y con el mismo modo (`nextSentenceHandler` busca la siguiente sin responder y el modo viene fijo del servidor), así que cada intento cuesta una vida hasta el game over. Un nivel con una de esas oraciones pierde la ronda cada vez que a esa oración le toca `buildUp` (entre 1/4 y 1/6 de las veces).

**Reproducido sin BD** (simulación de la lógica de `origin/main` sobre los textos actuales de `scripts/sentence-fixes/correcciones.json` y casos sintéticos): sin solución #629, #963, #965, #971, «Where __?» y «__'s»; «4.30» sale «430»; el triple espacio deja una ficha vacía; #955, #957 y #964 tienen solución pero pierden el punto de en medio en el «Correct: …».

**El patrón que funciona** es `buildAnswer` del Constructor (`games.service.ts`): corta por `/\s+/`, quita la puntuación solo de la última ficha y saca las fichas de la misma lista que la respuesta, así que nunca divergen. El arreglo aplica esa idea a la práctica sin cambiar lo que la práctica tiene de propio: la respuesta es UNA ficha (aunque sean varias palabras) y compite con tres distractores.

## Decisiones

1. **Los distractores llevan lo mismo que la respuesta** (recomendado; aprobado). Con «Just __, it’ll pass.», las cuatro opciones salen con coma: «let it go,», «just relax,», «Take it easy,»… Si solo la llevara la respuesta, la coma delataría cuál es la buena. La alternativa (solo la respuesta, la idea original) es una línea distinta en la Tarea 2.
2. **La puntuación final no es ficha ni va en la referencia**, como en el Constructor y como ya cuenta `tokenizarOracion`. El «Correct: …» de `buildUp` deja de terminar en «?» o «!» (con «.» ya pasaba casi siempre, por el `replace('.', '')`).
3. **Sin hueco** (fichas de vocabulario: `text` sin `__`), todo queda como hoy: todas las fichas son de la oración y la respuesta va aparte.

## Lo que no cambia

- **El webapp.** No hace falta deploy del front. `lib/accepted-answers.ts` y su gemela (`normalizarOracion`, `normalizarPalabra`, `tokenizarOracion`) no se tocan, así que la regla «cambian juntas» no se activa.
- **La cuenta de fichas.** `ordenesVigentes` (práctica), `respuestasDelConstructor` y `exigirLasMismasFichas` (admin) cuentan con `tokenizarOracion`; la referencia nueva da el mismo número que el texto con el hueco relleno, que es lo que mide el admin al aceptar un orden. Los órdenes aceptados siguen viajando igual. Lo fija un test. Excepción, solo con contenido mal formado: como `tokenizarOracion` no es idempotente, un texto que acaba en dos o más fichas que son solo puntuación («… __ ? .») cuenta una menos (antes del arreglo pasaba igual). La comprobación de producción lo busca (`cuenta distinta`).
- Los demás modos, `buildOptionSet`, el azar (no se consume ningún número aleatorio más) y los juegos.

## Global Constraints

- Backend en el worktree `/home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/arma-la-oracion` (branch `fix/arma-la-oracion-puntuacion` desde `origin/main`), con `node_modules` enlazado al del checkout principal (las dependencias no cambiaron desde ahí). El checkout compartido no se toca.
- Node 24: `export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"`.
- Sin `.env` en el worktree. Nada toca la BD salvo la comprobación de solo lectura de la Tarea 3, y solo con el sí de Sergio.
- `npm test` y `npm run build` en verde antes de cada commit (CLAUDE.md del backend).
- Lint solo de los archivos propios: `npx eslint <rutas>` sin `--fix`, comparado con la línea base (el repo arrastra errores previos).
- `git add` con rutas explícitas. Commits en español, terminando en `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- A `main` solo cuando Sergio lo pida: rebase sobre `origin/main`, revisar conflictos, re-verificar si entraron commits y `git push origin HEAD:main`. Sin PR ni merge.
- Hay otras sesiones trabajando en el backend (`fix/mazos-sembrados-por-id`, `fix/oraciones-intermedio-avanzado`): no tocar sus worktrees.

---

### Task 1: `oracionParaArmar`, pura y con tests

**Files:**
- Modify: `src/common/sentence-quiz.ts` (import de la línea 9 y función nueva al final)
- Test: `src/common/sentence-quiz.spec.ts` (imports y un `describe` nuevo al final)

**Interfaces:**
- Consumes: `tokenizarOracion(s: string): string[]` de `src/common/answer-alternatives.ts`.
- Produces: `export type OracionParaArmar = { fichas: string[]; antes: string; despues: string; referencia: string }` y `export function oracionParaArmar(text: string, mWord: string): OracionParaArmar`.

- [x] **Step 1: Worktree y línea base**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend
git fetch origin
git worktree add -b fix/arma-la-oracion-puntuacion .claude/worktrees/arma-la-oracion origin/main
cd .claude/worktrees/arma-la-oracion
ln -s ../../../node_modules node_modules
export PATH="$HOME/.nvm/versions/node/v24.19.0/bin:$PATH"
npx jest src/common/sentence-quiz.spec.ts src/modules/sentences
npx eslint src/common/sentence-quiz.ts src/common/sentence-quiz.spec.ts src/modules/sentences/sentences.service.ts src/modules/sentences/sentences.practice.spec.ts > "$SCRATCH/eslint-antes.txt"
npx prettier --check src/common/sentence-quiz.ts src/common/sentence-quiz.spec.ts src/modules/sentences/sentences.service.ts src/modules/sentences/sentences.practice.spec.ts
```

(`$SCRATCH` = el scratchpad de la sesión.) Expected: jest en verde. Si prettier marca algún archivo ya en la línea base, ese archivo NO se formatea entero después: solo se cuida el bloque propio.

- [x] **Step 2: Escribir los tests que fallan**

En `src/common/sentence-quiz.spec.ts`, cambiar el import de la línea 1 por:

```ts
import { tokenizarOracion } from './answer-alternatives';
import {
  buildOptionSet,
  oracionParaArmar,
  QuizOptionSource,
} from './sentence-quiz';
```

y añadir al final del archivo:

```ts
describe('oracionParaArmar («¡Arma la oración!»)', () => {
  // `bandeja`: las fichas bien puestas, que el cliente une con un espacio.
  // `respuesta`: la ficha del hueco, con lo que el hueco lleva pegado.
  const CASOS: Array<{
    caso: string;
    text: string;
    mWord: string;
    bandeja: string[];
    respuesta: string;
  }> = [
    {
      caso: '«__?» al final: la puntuación final no es ficha',
      text: 'Where __?',
      mWord: 'are you',
      bandeja: ['Where', 'are you'],
      respuesta: 'are you',
    },
    {
      caso: '«__!» al final',
      text: 'What a beautiful __!',
      mWord: 'day',
      bandeja: ['What', 'a', 'beautiful', 'day'],
      respuesta: 'day',
    },
    {
      caso: '#971 «__,» en medio: la coma va con la respuesta',
      text: 'Just __, it’ll pass.',
      mWord: 'let it go',
      bandeja: ['Just', 'let it go,', 'it’ll', 'pass'],
      respuesta: 'let it go,',
    },
    {
      caso: '#629 «__,» después de otro punto',
      text: 'I am sorry I lost that wallet you gave me. __, I can easily buy you another one.',
      mWord: 'Never mind',
      bandeja: [
        'I', 'am', 'sorry', 'I', 'lost', 'that', 'wallet', 'you', 'gave',
        'me.', 'Never mind,', 'I', 'can', 'easily', 'buy', 'you', 'another',
        'one',
      ],
      respuesta: 'Never mind,',
    },
    {
      caso: '#963 «__.» al final, después de otro punto',
      text: "Hey there, I'm Sophie. __.",
      mWord: 'Pleasure to meet you all',
      bandeja: ['Hey', 'there,', "I'm", 'Sophie.', 'Pleasure to meet you all'],
      respuesta: 'Pleasure to meet you all',
    },
    {
      caso: '#955 «__.» en medio de la oración',
      text: "Hi, __. It's a pleasure to meet you.",
      mWord: "I'm Emma",
      bandeja: ['Hi,', "I'm Emma.", "It's", 'a', 'pleasure', 'to', 'meet', 'you'],
      respuesta: "I'm Emma.",
    },
    {
      caso: "«__'s»: lo pegado no tiene por qué ser puntuación",
      text: "This is __'s book.",
      mWord: 'Tom',
      bandeja: ['This', 'is', "Tom's", 'book'],
      respuesta: "Tom's",
    },
    {
      caso: 'un punto que no es el final se queda («4.30»)',
      text: 'It is already 4.30 and __ is not home.',
      mWord: 'Tom',
      bandeja: ['It', 'is', 'already', '4.30', 'and', 'Tom', 'is', 'not', 'home'],
      respuesta: 'Tom',
    },
    {
      caso: 'los espacios de más no dejan fichas vacías',
      text: '  I am   __ today .  ',
      mWord: 'happy',
      bandeja: ['I', 'am', 'happy', 'today'],
      respuesta: 'happy',
    },
  ];

  it.each(CASOS)('$caso', ({ text, mWord, bandeja, respuesta }) => {
    const armado = oracionParaArmar(text, mWord);
    const hueco = bandeja.indexOf(respuesta);
    expect(armado.fichas).toEqual(bandeja.filter((_, k) => k !== hueco));
    expect(armado.antes + mWord + armado.despues).toBe(respuesta);
    // El cliente compara EXACTO con las fichas unidas por un espacio.
    expect(armado.referencia).toBe(bandeja.join(' '));
  });

  it.each(CASOS)(
    '$caso: cuenta tantas fichas como el admin al aceptar un orden',
    ({ text, mWord }) => {
      // Así cuentan `exigirLasMismasFichas` (admin-reports.service.ts) y
      // `ordenesVigentes`: si cambiara, un orden aceptado dejaría de viajar.
      const comoElAdmin = tokenizarOracion(text.replace('__', () => mWord));
      expect(
        tokenizarOracion(oracionParaArmar(text, mWord).referencia),
      ).toHaveLength(comoElAdmin.length);
    },
  );

  it('sin hueco (ficha de vocabulario): todas son de la oración y nada se envuelve', () => {
    expect(oracionParaArmar('apple', 'apple')).toEqual({
      fichas: ['apple'],
      antes: '',
      despues: '',
      referencia: 'apple',
    });
  });

  it('una m_word con «$&» se copia tal cual', () => {
    expect(oracionParaArmar('I paid __.', '$& 5').referencia).toBe(
      'I paid $& 5',
    );
  });
});
```

(El caso de espacios lleva además un espacio antes del punto final: hoy ese punto suelto deja una ficha vacía al final.)

- [x] **Step 3: Ver que falla**

Run: `npx jest src/common/sentence-quiz.spec.ts`
Expected: FAIL en los 20 tests nuevos con `TypeError: (0 , sentence_quiz_1.oracionParaArmar) is not a function` (con `isolatedModules`, ts-jest no hace type-check: el fallo sale al ejecutar). Los 11 de `buildOptionSet` siguen en verde.

- [x] **Step 4: Implementar**

En `src/common/sentence-quiz.ts`, cambiar el import de la línea 9 por:

```ts
import { normalizarPalabra, tokenizarOracion } from './answer-alternatives';
```

y añadir al final del archivo:

```ts
/**
 * «¡Arma la oración!» (modo `buildUp` de la práctica). El cliente da por buena
 * la bandeja si sus fichas, unidas por un espacio, son EXACTAMENTE la
 * referencia; por eso la referencia se arma con las mismas fichas y no con el
 * texto de la oración.
 *
 * Las fichas se cortan con `tokenizarOracion`, como el Constructor y como
 * cuenta el admin al aceptar un orden: por espacios y sin la puntuación final.
 * La ficha del hueco no sale de aquí sino de las opciones (`buildOptionSet`),
 * pero lo que el hueco lleva pegado («__,», un «__.» en medio de la oración,
 * «__'s») es suyo: `antes` y `despues` se les ponen a la respuesta y a sus
 * distractores. Sin hueco (las fichas de vocabulario), todas las fichas son
 * de la oración y la respuesta va aparte, como siempre.
 */
export type OracionParaArmar = {
  /** Las fichas de la oración en orden, sin la del hueco. */
  fichas: string[];
  /** Lo que el hueco lleva pegado delante y detrás: «__,» → `''` y `','`. */
  antes: string;
  despues: string;
  /** La bandeja bien armada, con la respuesta en el hueco. */
  referencia: string;
};

export function oracionParaArmar(
  text: string,
  mWord: string,
): OracionParaArmar {
  const tokens = tokenizarOracion(text);
  const hueco = tokens.findIndex((t) => t.includes('__'));
  if (hueco === -1) {
    return {
      fichas: tokens,
      antes: '',
      despues: '',
      referencia: tokens.join(' '),
    };
  }
  const i = tokens[hueco].indexOf('__');
  const antes = tokens[hueco].slice(0, i);
  const despues = tokens[hueco].slice(i + 2);
  // Concatenado y no con replace(): un `$&` en la m_word no se interpreta.
  const armada = [...tokens];
  armada[hueco] = antes + mWord + despues;
  return {
    fichas: tokens.filter((_, k) => k !== hueco),
    antes,
    despues,
    referencia: armada.join(' '),
  };
}
```

- [x] **Step 5: Ver que pasa**

Run: `npx jest src/common/sentence-quiz.spec.ts`
Expected: PASS, incluidos los 11 tests de `buildOptionSet` que ya estaban.

- [x] **Step 6: Suite, build, lint y commit**

```bash
npx prettier --write src/common/sentence-quiz.ts src/common/sentence-quiz.spec.ts   # solo si estaban limpios en la línea base
npm test && npm run build
npx eslint src/common/sentence-quiz.ts src/common/sentence-quiz.spec.ts
git add src/common/sentence-quiz.ts src/common/sentence-quiz.spec.ts
git commit -m "feat(sentence-quiz): oracionParaArmar — las fichas de «Arma la oración» y su referencia salen de lo mismo

Corta con tokenizarOracion, como el Constructor y como cuenta el admin, y
separa lo que el hueco lleva pegado para ponérselo a la respuesta y a sus
distractores. La referencia son esas fichas unidas por un espacio, así que
la bandeja bien armada coincide con ella por construcción.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: la práctica usa `oracionParaArmar`

**Files:**
- Modify: `src/modules/sentences/sentences.service.ts:17` (import) y `:190-217` (bloque `buildUp`)
- Test: `src/modules/sentences/sentences.practice.spec.ts`

**Interfaces:**
- Consumes: `oracionParaArmar(text, mWord): { fichas, antes, despues, referencia }` (Task 1).
- Produces: el mismo contrato de `GET /sentences/practice/:levelId`; en `buildUp`, `text` es la bandeja bien armada y cada `options[].word` es una ficha.

- [x] **Step 1: Escribir los tests que fallan**

En `src/modules/sentences/sentences.practice.spec.ts`:

1. Añadir `text: string;` al tipo `PracticeItem`.
2. Sacar `primeraEnBuildUp` del `describe` de alternativas al nivel del módulo (justo después de `primeraOracion`), sin cambiarle el cuerpo, para que la use también el `describe` nuevo.
3. Añadir al final:

```ts
describe('SentencesService.getSentencesPractice — «¡Arma la oración!» con lo que el hueco lleva pegado', () => {
  /** Las palabras de las opciones, ordenadas: las de la oración o los distractores. */
  const palabras = (item: PracticeItem, correct: boolean) =>
    item.options
      .filter((o) => o.correct === correct)
      .map((o) => o.word)
      .sort();

  it('#971 «__,»: la respuesta lleva la coma y la bandeja bien armada es el texto', async () => {
    const { service } = makeService(
      [],
      [entity('1', 'Just __, it’ll pass.', 'let it go'), ...RESTO],
    );
    const first = await primeraEnBuildUp(service);
    const bandeja = ['Just', 'let it go,', 'it’ll', 'pass'];
    expect(first.text).toBe(bandeja.join(' '));
    expect(palabras(first, true)).toEqual([...bandeja].sort());
  });

  it('los distractores llevan la misma coma: la puntuación no delata la buena', async () => {
    const { service } = makeService(
      [],
      [entity('1', 'Just __, it’ll pass.', 'let it go'), ...RESTO],
    );
    const first = await primeraEnBuildUp(service);
    expect(palabras(first, false)).toEqual(['are,', 'feel,', 'goes,']);
  });

  it('#963 «__.» después de otro punto: el punto de en medio se queda y no hay fichas vacías', async () => {
    const { service } = makeService(
      [],
      [
        entity('1', "Hey there, I'm Sophie. __.", 'Pleasure to meet you all'),
        ...RESTO,
      ],
    );
    const first = await primeraEnBuildUp(service);
    expect(first.text).toBe("Hey there, I'm Sophie. Pleasure to meet you all");
    expect(palabras(first, true)).toEqual(
      ['Hey', 'there,', "I'm", 'Sophie.', 'Pleasure to meet you all'].sort(),
    );
    expect(first.options.some((o) => o.word.trim() === '')).toBe(false);
  });

  it('una oración sin nada pegado al hueco sale como siempre', async () => {
    const { service } = makeService([]);
    const first = await primeraEnBuildUp(service);
    expect(first.text).toBe('I am happy today');
    expect(palabras(first, true)).toEqual(['I', 'am', 'happy', 'today'].sort());
    expect(palabras(first, false)).toEqual(['are', 'feel', 'goes']);
  });

  it('un orden aceptado de una oración con «__,» sigue viajando: las fichas se cuentan igual', async () => {
    const { service } = makeService(
      [{ target_id: '1', kind: 'sentence', value: 'It’ll pass, just let it go.' }],
      [entity('1', 'Just __, it’ll pass.', 'let it go'), ...RESTO],
    );
    const first = await primeraEnBuildUp(service);
    expect(first.accepted_texts).toEqual(['It’ll pass, just let it go.']);
  });
});
```

- [x] **Step 2: Ver que fallan los que tienen que fallar**

Run: `npx jest src/modules/sentences/sentences.practice.spec.ts`
Expected: FAIL en tres — #971 (las fichas traen «let it go» sin coma), distractores (sin coma) y #963 (`text` es «Hey there, I'm Sophie Pleasure to meet you all.»). PASAN «sale como siempre» y «orden aceptado»: son guardas de lo que no debe moverse.

- [x] **Step 3: Implementar**

En `src/modules/sentences/sentences.service.ts`, el import de la línea 17 pasa a:

```ts
import { buildOptionSet, oracionParaArmar } from 'src/common/sentence-quiz';
```

y el bloque `if (item.mode === 'buildUp') { … }` (líneas 190-217) pasa a:

```ts
        if (item.mode === 'buildUp') {
          if (item.text) {
            // Las fichas y la referencia salen de lo mismo
            // (src/common/sentence-quiz.ts): la bandeja bien armada es
            // exactamente `item.text`, que el cliente compara tal cual.
            const armado = oracionParaArmar(item.text, item.m_word);
            // Lo que el hueco lleva pegado («__,») va con la respuesta y con
            // sus distractores, para que no delate cuál es la buena.
            for (const opt of options) {
              opt.word = armado.antes + opt.word + armado.despues;
            }
            for (const ficha of armado.fichas) {
              options.push({
                word: ficha,
                correct: true,
                img: '',
                img_sound: '',
              });
            }
            item.text = armado.referencia;
            // Solo los órdenes con tantas fichas como la oración de ahora: si
            // el admin la editó después de aceptar uno y creció, ese orden
            // daría por buena la bandeja a medio armar.
            const ordenes = ordenesVigentes(item.text, alts.sentences);
            if (ordenes.length > 0) item.accepted_texts = ordenes;
          }
          // shuffle options
          shuffle(options);
          item.img = LISTENING_PLACEHOLDER_IMG;
        }
```

(Si Sergio elige que solo la respuesta lleve lo pegado: el primer `for` pasa a envolver solo `options.find((o) => o.correct)`, y el test de distractores se invierte: `['are', 'feel', 'goes']`.)

Los objetos de `options` son nuevos (`buildOptionSet` los crea con `map` y un literal), así que envolverlos no toca la `m_word` de ninguna otra oración de `response`.

- [x] **Step 4: Ver que pasa**

Run: `npx jest src/modules/sentences src/common/sentence-quiz.spec.ts`
Expected: PASS (los 4 de alternativas que ya estaban, los 5 nuevos y los de `sentences.service.spec.ts`).

- [x] **Step 5: Suite, build, lint y commit**

```bash
npm test && npm run build
npx eslint src/modules/sentences/sentences.service.ts src/modules/sentences/sentences.practice.spec.ts > "$SCRATCH/eslint-despues.txt"; diff "$SCRATCH/eslint-antes.txt" "$SCRATCH/eslint-despues.txt"
git add src/modules/sentences/sentences.service.ts src/modules/sentences/sentences.practice.spec.ts
git commit -m "fix(sentences): «Arma la oración» tiene solución cuando el hueco lleva puntuación pegada

La referencia salía del texto y la ficha de la respuesta, de la m_word
pelada: con «__,», «__?», «__'s» o un «__.» después de otro punto, lo
pegado quedaba en la referencia y en ninguna ficha, y el cliente compara
exacto. Además replace('.', '') borraba el primer punto esté donde esté
(«4.30» → «430») y replace('  ', ' ') dejaba fichas vacías. Ahora fichas y
referencia salen de oracionParaArmar, y lo pegado al hueco va también en
los distractores para no delatar la buena.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(El `diff` de eslint no debe mostrar errores nuevos; los números de línea pueden correrse.)

---

### Task 3: documentación, verificación final y subida

**Files:**
- Modify: `dots-backend/docs/ARQUITECTURA.md` (un punto nuevo después de «**Órdenes que quedaron viejos.**», hoy en la línea 77)
- Modify: este plan (`Estado`)

- [x] **Step 1: Documentar la regla en el backend**

Añadir después del punto «**Órdenes que quedaron viejos.**»:

```markdown
- **Fichas de «Arma la oración».** La práctica las corta con `oracionParaArmar` (`common/sentence-quiz.ts`): `tokenizarOracion` sobre el texto —por espacios y sin la puntuación final, como el Constructor y como cuenta el admin— y lo que el hueco lleva pegado («__,», un «__.» en medio, «__'s») va en la ficha de la respuesta y en la de cada distractor. La referencia (`text` en `buildUp`) son esas fichas unidas por un espacio: el cliente compara exacto y la bandeja bien armada coincide por construcción. Hasta 2026-10-19 la referencia salía del texto y la ficha de la respuesta, de la `m_word` pelada: con algo pegado al hueco no había solución.
```

Commit: `docs(arquitectura): de dónde salen las fichas de «Arma la oración»`.

- [x] **Step 2: Verificación contra el código compilado**

Repetir la simulación del scratchpad (`repro-new.js`) importando `dist/common/sentence-quiz.js` del worktree en vez de la copia: los 43 casos locales (los de `correcciones.json` con algo pegado al hueco y los sintéticos) tienen solución, sin fichas vacías y con la misma cuenta que el admin.

- [x] **Step 3 (solo con el sí de Sergio): comprobación de solo lectura en producción**

`$SCRATCH/verificar-arma-la-oracion.js`, con el `.env` del checkout principal y el `dist/` del worktree (`node verificar-arma-la-oracion.js <worktree>`). Versión ampliada tras la revisión y ensayada sin BD (`pg` y `dotenv` falsos en la caché de `require`, sobre las 149 oraciones de `correcciones.json`):

```js
/* Solo lectura: BEGIN READ ONLY … ROLLBACK. Uso: node verificar-arma-la-oracion.js <worktree con dist/> */
const path = require('path');
const BACKEND = '/home/endurance/Projects/Endurance/dots/dots-backend';
const WT = process.argv[2];
if (!WT) {
  console.error('Falta la ruta del worktree con dist/');
  process.exit(1);
}
require(path.join(BACKEND, 'node_modules/dotenv')).config({ path: path.join(BACKEND, '.env'), quiet: true });
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));
const { oracionParaArmar } = require(path.join(WT, 'dist/common/sentence-quiz.js'));
const { tokenizarOracion, normalizarOracion } = require(path.join(WT, 'dist/common/answer-alternatives.js'));

// La lógica de origin/main antes del arreglo, tal cual, para medir qué arregla.
function antes(text, m) {
  const t = String(text).trim().replace('.', '').replace('  ', ' ');
  const tokens = t.split(' ');
  const referencia = t.replace('__', m);
  const armada = tokens.map((x) => (x.includes('__') ? m : x)).join(' ');
  return { ok: armada.toUpperCase() === referencia.toUpperCase(), vacias: tokens.includes(''), referencia };
}
function despues(text, m) {
  const a = oracionParaArmar(text, m);
  const h = tokenizarOracion(text).findIndex((t) => t.includes('__'));
  const respuesta = a.antes + m + a.despues;
  const bandeja = h === -1 ? a.fichas : [...a.fichas.slice(0, h), respuesta, ...a.fichas.slice(h)];
  return {
    ...a,
    hueco: h,
    bandeja,
    ok: bandeja.join(' ').toUpperCase() === a.referencia.toUpperCase(),
    vacias: a.fichas.includes('') || (h !== -1 && respuesta.trim() === ''),
    mismaCuenta:
      tokenizarOracion(a.referencia).length === tokenizarOracion(String(text).replace('__', () => m)).length,
  };
}

/**
 * ¿Se puede armar este orden aceptado con las fichas nuevas? Heurística por
 * palabras: todas las palabras de las fichas, y solo la última del orden puede
 * venir sin su puntuación final (normalizarOracion se la quita a la bandeja).
 * No mira que una ficha de varias palabras vaya junta: si dice «no», es seguro.
 */
function seArma(orden, bandeja) {
  const quedan = bandeja.join(' ').toUpperCase().split(/\s+/).filter(Boolean);
  const palabras = normalizarOracion(orden).split(' ').filter(Boolean);
  for (let i = 0; i < palabras.length; i++) {
    const p = palabras[i];
    let k = quedan.indexOf(p);
    if (k === -1 && i === palabras.length - 1) k = quedan.findIndex((w) => w.replace(/[.,;:!?]+$/, '') === p);
    if (k === -1) return false;
    quedan.splice(k, 1);
  }
  return quedan.length === 0;
}

(async () => {
  const c = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  try {
    await c.query('BEGIN READ ONLY');
    const { rows } = await c.query(`
      SELECT s.id::text AS id, s.text, COALESCE(s.m_word, '') AS m_word, COALESCE(d.name, '(sin nivel)') AS dificultad
        FROM dots.sentences s
        LEFT JOIN dots.levels l ON l.id = s.level_id
        LEFT JOIN dots.section sec ON sec.id = l.id_section
        LEFT JOIN dots.difficulty d ON d.id = sec.id_difficulty
       WHERE s.enabled = true AND COALESCE(s.text, '') <> ''
       ORDER BY s.id`);
    let ordenes = [];
    try {
      ({ rows: ordenes } = await c.query(`
        SELECT a.id, a.target_id::text AS sentence_id, a.value
          FROM dots.answer_alternatives a
         WHERE a.target_type = 'sentence' AND a.kind = 'sentence'
         ORDER BY a.id`));
    } catch (e) {
      console.log(`(answer_alternatives no se pudo leer: ${e.message})`);
    }

    const porId = new Map();
    const por = new Map();
    for (const r of rows) {
      const g = por.get(r.dificultad) ?? {
        activas: 0, sinSolucionAntes: [], vaciasAntes: [], malDespues: [], cuentaDistinta: [],
        variosHuecos: [], tresGuiones: [], pegadoConLetras: [], referenciaCambia: [],
      };
      const a = antes(r.text, r.m_word);
      const d = despues(r.text, r.m_word);
      porId.set(r.id, d);
      g.activas++;
      if (!a.ok) g.sinSolucionAntes.push(r.id);
      if (a.vacias) g.vaciasAntes.push(r.id);
      if (!d.ok || d.vacias) g.malDespues.push(r.id);
      if (!d.mismaCuenta) g.cuentaDistinta.push(r.id);
      if ((r.text.match(/__/g) || []).length > 1) g.variosHuecos.push(r.id);
      if (r.text.includes('___')) g.tresGuiones.push(r.id);
      if (d.hueco !== -1 && d.despues !== "'s" && /[A-Za-z0-9]/.test(d.antes + d.despues)) {
        g.pegadoConLetras.push(`${r.id} «${d.antes}__${d.despues}»`);
      }
      if (a.ok && normalizarOracion(a.referencia) !== normalizarOracion(d.referencia)) g.referenciaCambia.push(r.id);
      por.set(r.dificultad, g);
    }
    const lista = (xs) => `${xs.length}${xs.length ? ` [${xs.join(', ')}]` : ''}`;
    for (const [dif, g] of por) {
      console.log(`\n${dif}: ${g.activas} activas`);
      console.log(`  sin solución antes: ${lista(g.sinSolucionAntes)}`);
      console.log(`  fichas vacías antes: ${lista(g.vaciasAntes)}`);
      console.log(`  MAL DESPUÉS (sin solución o ficha vacía): ${lista(g.malDespues)}`);
      console.log(`  cuenta distinta de la del admin: ${lista(g.cuentaDistinta)}`);
      console.log(`  varios huecos: ${lista(g.variosHuecos)} · con ___: ${lista(g.tresGuiones)}`);
      console.log(`  hueco pegado a letras (no 's): ${lista(g.pegadoConLetras)}`);
      console.log(`  ya tenían solución y su «Correct: …» cambia más allá de la puntuación final: ${lista(g.referenciaCambia)}`);
    }
    const muertos = ordenes.filter((o) => porId.has(o.sentence_id) && !seArma(o.value, porId.get(o.sentence_id).bandeja));
    console.log(`\nÓrdenes aceptados de oraciones activas: ${ordenes.filter((o) => porId.has(o.sentence_id)).length}`);
    console.log(`  que ya no se pueden armar con las fichas nuevas: ${muertos.length}`);
    for (const o of muertos) console.log(`    alternativa ${o.id} (oración ${o.sentence_id}): ${JSON.stringify(o.value)}`);
  } finally {
    await c.query('ROLLBACK').catch(() => {});
    await c.end();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
```

Expected: `MAL DESPUÉS` y `cuenta distinta` vacíos en todas las dificultades; `sin solución antes` con las 22 de Intermediate/Advanced (ids 622, 629, 664, 730, 756, 759, 760, 863, 866, 870, 881, 920, 925, 958, 959, 960, 963, 965, 969, 971, 988, 1013) más las de Beginner. Lo demás es para que Sergio decida, fuera de este arreglo: `varios huecos`, `con ___` y `hueco pegado a letras` son contenido mal formado (ahora tiene solución, pero se ve raro: «Tom_», o la palabra pegada repetida en las cuatro opciones); `«Correct: …» cambia` lista las que ya tenían solución y recuperan el punto de en medio; los órdenes aceptados que ya no se pueden armar son filas muertas en la bandeja del admin (inofensivas: la referencia ya funciona) que se pueden borrar.

**Resultado (2026-10-19, con el sí de Sergio; `dist/` de `1f04921`).** 694 oraciones activas.

| Dificultad | Activas | Sin solución antes | Fichas vacías antes | Mal después | Cuenta distinta | «Correct: …» que mejora |
|---|---|---|---|---|---|---|
| Beginner | 292 | 7 (404, 418, 461, 481, 513, 565, 586) | 1 (498) | 0 | 0 | 5 (351, 353, 360, 362, 367) |
| Intermediate | 275 | 11 (622, 629, 664, 730, 756, 759, 760, 863, 866, 870, 881) | 0 | 0 | 0 | 12 (621, 707, 717, 722, 727, 728, 787, 789, 836, 844, 845, 859) |
| Advanced | 127 | 11 (920, 925, 958, 959, 960, 963, 965, 969, 971, 988, 1013) | 0 | 0 | 0 | 7 (955, 956, 957, 962, 964, 966, 1008) |

Las 22 de Intermediate/Advanced son exactamente las de la medición del 2026-10-17. Ninguna oración activa tiene varios huecos ni `___`, y no hay órdenes aceptados de oraciones (ninguno queda muerto). Contenido para Sergio, fuera de este arreglo: en #481 («__yesterday») y #586 («You__») falta el espacio entre el hueco y la palabra; ahora tienen solución, pero esa palabra sale pegada en las cuatro opciones.

- [x] **Step 4 (cuando Sergio lo pida): subir a main**

```bash
cd /home/endurance/Projects/Endurance/dots/dots-backend/.claude/worktrees/arma-la-oracion
git fetch origin && git rebase origin/main
npm test && npm run build      # otra vez, si el rebase trajo commits
git push origin HEAD:main
```

En el webapp, el plan (con `Estado: ejecutado`) se commitea como `docs(plan): «Arma la oración» con puntuación pegada al hueco` y sube igual (rebase + `git push origin HEAD:main`). Si el clasificador bloquea el push, se le deja el comando a Sergio.

---

## Revisión (subagente, 2026-10-19)

Veredicto: listo con arreglos; nada crítico. Comprobó la bandeja = referencia por construcción, con un fuzz de 200.000 oraciones sintéticas y las 149 reales (antes y después), y que los tests nuevos fallan contra el código viejo por la razón correcta. Lo que se hizo con cada punto:

- **Importante — copia vieja en `scripts/sentence-fixes/core.js`** (llegó a `origin/main` después de la base): `armar()` simulaba el `replace('.', '')` + `split(' ')` y `validarLista` rechazaba con él correcciones que ahora tienen solución. Se quitó, con sus tests; uno nuevo fija que «__,», «__?» y un «__.» después de otro punto ya no se rechazan (en rojo contra el `core.js` viejo). `1f04921`.
- **Importante — ningún test con algo pegado delante del hueco**: perder `antes` no rompía nada. Casos «$__» y «(__)» en la tabla y uno del servicio con los distractores envueltos por los dos lados; un test fija además que con dos huecos gana el primero (como el `replace('__')` del admin). Verificado con las dos mutaciones del revisor (`antes = ''`: fallan 3; `findLastIndex`: falla 1). `dcc4f84`.
- **Menores**: el JSDoc pasó del tipo a la función y los comentarios ya no dicen «EXACTO» (el cliente ignora mayúsculas) — `e7c433b`; la cuenta en contenido mal formado quedó anotada arriba y la mide la comprobación de producción, igual que `___`, el pegado a letras y los órdenes aceptados muertos. La `m_word` con espacios alrededor se arma bien y en HTML no se ve: sin cambio.
- **Cambio visible para el admin**: los reportes nuevos de «Arma la oración» traen `expected` y `prompt` sin la puntuación final y con los puntos de en medio. La agrupación es por ejercicio, así que no se rompe.

