# Doty clásico (2024 – 2026)

Los 22 sprites de la primera identidad de Doty, antes del rediseño de septiembre
de 2026. Estaban en `public/images/Doty/DOTTY-POSES-NN.png` y el registro los
usaba como fallback mientras llegaba el arte nuevo; con las 97 piezas de la
fase 1 hechas ya no los referencia nadie.

**No se borran**: son el único registro de la identidad anterior, pesan 1 MB
entre los 22, y son el "antes" de cualquier comparativa — la documentación de
marca y la animación de transformación los necesitan.

- 300×300 px, rosa plano con contorno cyan fino.
- **La sombra elíptica va pintada dentro del PNG.** El arte nuevo nace sin ella
  y la recibe por CSS (spec §4.3), así que mezclar los dos en una misma vista
  duplica la sombra en uno de ellos.
- `classic-18` … `classic-22` son las variantes de bruja de Halloween.

Los números se conservan tal cual porque son opacos: no hay forma de recuperar
qué pose pretendía ser cada uno. Lo único documentado es a qué pieza del
registro nuevo servía de fallback cada uno, que es esta tabla:

| clásico | servía de fallback a |
|---|---|
| 02 | el placeholder por defecto: 63 piezas, casi todo el catálogo |
| 03 | `sigue-asi` |
| 04 | `bailando` |
| 05 | `triste`, `oh-no`, `oops`, `almost` |
| 06 | `wow` |
| 07 | `pensando`, `preocupado` |
| 09 | `decepcionado` |
| 11 | `riendo`, `good-job` |
| 12 | `idea` |
| 13 | `senalando`, `hablando` |
| 14 | `saludando` |
| 16 | `bienvenido` |
| 18 | `halloween` |

Los que no aparecen (01, 08, 10, 15, 17, 19–22) nunca fueron fallback de nada.

El mapeo completo, pieza por pieza, está en el commit que retiró el campo:
`git show <commit>^:scripts/mj/batches/fase-1.json`.

`scripts/check-doty-assets.mjs --strict` no mira esta carpeta: solo recorre
`public/images/Doty/`, que es donde vive el arte en uso.
