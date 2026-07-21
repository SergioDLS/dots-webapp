import React from "react";

import PathContainer from "@/components/path/path-container";

/**
 * Camino (home). El chrome (nav + HUD con racha/XP) lo aporta el layout del
 * grupo hub; aquí solo vive el sendero de progreso a ancho completo. El
 * contenido que antes estaba en el sidebar-carrusel se movió a /profile,
 * /quests y /play.
 */
function Levels() {
  return <PathContainer />;
}

export default Levels;
