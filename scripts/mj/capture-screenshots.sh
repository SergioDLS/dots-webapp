#!/usr/bin/env bash
# Capturas del campo `screenshots` del manifest de la PWA.
#
# Hay que rehacerlas cada vez que la UI cambia de forma visible, así que va como
# script y no como procedimiento a mano.
#
# Necesita sesión iniciada: /levels, /play y las lecciones son privadas. La
# sesión no se automatiza — el refresh_token es una cookie HttpOnly de 7 días,
# así que vive en el PERFIL del navegador. El flujo es:
#
#   1. Abre un Chrome con el perfil dedicado y entra a mano:
#        google-chrome-stable --user-data-dir=/tmp/dots-capturas http://localhost:3000/
#   2. Cierra ese Chrome (headless y headed no comparten perfil a la vez).
#   3. Ejecuta este script con el mismo perfil.
#
# El servidor tiene que ser el de PRODUCCIÓN (`npm run start`): en dev el banner
# de Next y los overlays de desarrollo salen en la captura.
#
# Uso: scripts/mj/capture-screenshots.sh [PERFIL] [BASE]
set -euo pipefail

PERFIL="${1:-/tmp/dots-capturas}"
BASE="${2:-http://localhost:3000}"
DEST="$(cd "$(dirname "$0")/../.." && pwd)/public/screenshots"
mkdir -p "$DEST"

# nombre|ruta|ancho|alto — los tamaños son los que declara app/manifest.ts
CAPTURAS=(
  "camino-narrow|/levels|390|844"
  "juegos-narrow|/play|390|844"
  # /review y no /practice: practice necesita un ?id= y sin el da estado de
  # error. /review muestra un ejercicio real con sus opciones, que es justo lo
  # que la captura quiere ensenar. /profile queda descartada a proposito: lleva
  # la foto del usuario y estas capturas son publicas en el prompt de instalacion.
  "leccion-narrow|/review|390|844"
  "camino-wide|/levels|1280|800"
)

for fila in "${CAPTURAS[@]}"; do
  IFS='|' read -r nombre ruta w h <<<"$fila"
  google-chrome-stable \
    --headless=new --disable-gpu --hide-scrollbars \
    --user-data-dir="$PERFIL" \
    --force-device-scale-factor=1 \
    --window-size="$w,$h" \
    --virtual-time-budget=9000 \
    --screenshot="$DEST/$nombre.png" \
    "$BASE$ruta" >/dev/null 2>&1
  printf '  %-16s %-10s %sx%s\n' "$nombre.png" "$ruta" "$w" "$h"
done

echo
echo "Si alguna sale con la pantalla de login, la sesión del perfil caducó:"
echo "vuelve al paso 1."
