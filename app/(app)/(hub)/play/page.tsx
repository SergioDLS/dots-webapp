import ArcadeContainer from "@/components/play/arcade-container";
import ArcadeHeader from "@/components/play/arcade-header";

/**
 * Arcade (spec §4). El chrome (nav + HUD) lo pone el layout del grupo hub.
 * La cabecera es un componente aparte porque monta Doty (cliente) y la página
 * se queda como server component.
 */
export default function PlayPage() {
  return (
    <div className="flex flex-col gap-6">
      <ArcadeHeader />
      <ArcadeContainer />
    </div>
  );
}
