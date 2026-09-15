import React, { Suspense } from "react";

import PathContainer from "@/components/path/path-container";
import Spinner from "@/components/ui/Spinner/Spinner";

/**
 * Camino (home). El chrome (nav + HUD) lo aporta el layout del grupo hub; aquí
 * vive una dificultad a la vez (`?d=<id>`, por defecto la actual). El Suspense
 * es obligatorio por `useSearchParams` (regla 6).
 */
export default function Levels() {
  return (
    <Suspense fallback={<Spinner title="Cargando tu camino..." />}>
      <PathContainer />
    </Suspense>
  );
}
