#!/usr/bin/env node
// Hoja de contacto de una familia de iconos, a su tamaño de uso y sobre los
// fondos reales de los dos temas. Mirar el icono a tamaño completo miente:
// lo que decide es si sobrevive la reducción.
//
//   node scripts/contact-sheet-icons.mjs nav 24
//
// Escribe un HTML; ábrelo con el preview y hazle captura.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const [familia, tam = "24"] = process.argv.slice(2);
if (!familia) { console.error("uso: contact-sheet-icons.mjs <familia> [tamaño]"); process.exit(1); }

const source = readFileSync(join(root, "components/ui/icon/paths.tsx"), "utf8");
const marcas = [...source.matchAll(/── familia (\S+) · stroke-width ([\d.]+) ──/g)];
const i = marcas.findIndex((m) => m[1] === familia);
if (i === -1) { console.error(`no existe la familia ${familia}`); process.exit(1); }
const bloque = source.slice(marcas[i].index, i + 1 < marcas.length ? marcas[i + 1].index : source.length);
const nombres = [...bloque.matchAll(/^  ([a-z][\w-]*): \(/gm)].map((m) => m[1]);

// El JSX no se puede renderizar desde Node sin compilar, así que la hoja
// importa el componente real a través de una página de Next: esto solo genera
// la ruta de prueba que la sirve.
const page = `// Generado por scripts/contact-sheet-icons.mjs — no editar a mano.
import { Icon } from "@/components/ui/icon";
const NOMBRES = ${JSON.stringify(nombres)} as const;
export default function Hoja() {
  return (
    <div>
      {[["#ffffff", "#1E1B5C"], ["#201a4d", "#ffffff"]].map(([bg, fg]) => (
        <div key={bg} style={{ background: bg, color: fg, padding: 24, display: "flex", gap: 24 }}>
          {NOMBRES.map((n) => (
            <div key={n} style={{ textAlign: "center", fontSize: 10 }}>
              <Icon name={n} size={${tam}} />
              <div>{n}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
`;
writeFileSync(join(root, "app/dev-iconos/page.tsx"), page);
console.log(`hoja de ${nombres.length} iconos (${familia}, ${tam}px) → /dev-iconos`);
