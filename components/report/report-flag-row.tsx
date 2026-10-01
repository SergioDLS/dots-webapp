"use client";

import type { ReactNode } from "react";

import ReportFlag from "@/components/report/report-flag";

/**
 * La fila de la banderita en las pantallas que no tienen LessonTopBar
 * (portadas, letras, números...): primer hijo del contenedor, encima de la
 * tarjeta, siempre en la esquina superior derecha.
 *
 * Alto fijo de 14 px = la caja de layout de la banderita (ver report-flag.tsx).
 * La banderita no existe en el primer render: aparece cuando un efecto publica
 * la lista, y sin esta reserva la fila medía 0 y, al aparecer, empujaba 14 px
 * todo lo que hay debajo. `items-center` es lo que ReportFlag pide a su fila.
 *
 * Con `children` (una línea de texto, como el progreso de las letras) la
 * banderita comparte fila con ella: el texto queda entre dos columnas del
 * ancho de la banderita —la derecha es la propia banderita, que con `reservar`
 * ocupa su caja de 22 px aunque aún no haya nada que reportar, y la izquierda
 * es esa misma caja vacía, de espejo—, así que ni se corre ni cambia de ancho
 * (ni de líneas) cuando la banderita aparece. Ninguna columna fija un ancho a
 * mano: salen de ReportFlag. Una fila `flex` con el texto en `flex-1` lo
 * corría 15 px a la izquierda y, con 30 px menos de ancho, podía partirlo en
 * una línea más.
 */
export default function ReportFlagRow({ children }: { children?: ReactNode }) {
  const bandera = (
    <div className="flex h-3.5 items-center justify-end">
      <ReportFlag reservar />
    </div>
  );
  if (children === undefined) return bandera;
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
      {/* El espejo: la misma caja reservada, sin botón (una lista vacía no lo pinta). */}
      <ReportFlag objetivos={[]} reservar />
      {children}
      {bandera}
    </div>
  );
}
