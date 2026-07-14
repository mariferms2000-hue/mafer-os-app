#!/bin/bash
# ── Lanzador de Mafer OS ────────────────────────────────────────────
# Garantiza que SIEMPRE se sirva la versión actual del código:
#   1. detiene únicamente los servidores anteriores de Mafer OS (los
#      identifica por su carpeta de trabajo — nunca toca otros procesos);
#   2. recompila si el build no corresponde al commit actual;
#   3. arranca, espera a que la app responda y abre Safari.
# Variables útiles: PORT (3456 por defecto), MAFER_NO_OPEN=1 (no abrir
# el navegador — para pruebas).
set -u

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR" || exit 1
PORT="${PORT:-3456}"
LOG="$APP_DIR/data/servidor.log"
mkdir -p "$APP_DIR/data"

fail() {
  echo ""
  echo "❌ $1"
  if [ -f "$LOG" ]; then
    echo "   Últimas líneas del registro ($LOG):"
    tail -6 "$LOG" | sed 's/^/   │ /'
  fi
  echo ""
  echo "   Si no sabes qué hacer: cierra esta ventana, vuelve a abrir"
  echo "   «Abrir Mafer OS.command» y, si falla de nuevo, pídele ayuda a Claude."
  exit 1
}

# ¿Este PID es un servidor de Mafer OS? → su carpeta de trabajo es esta app.
es_mafer() {
  local cwd
  cwd=$(lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
  [ "$cwd" = "$APP_DIR" ]
}

puerto_ocupado() { lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1; }

# ── 1-4. Detener SOLO servidores anteriores de Mafer OS ────────────
echo "🔎 Buscando servidores anteriores de Mafer OS…"
DETENIDOS=0
CANDIDATOS=$( { pgrep -f "next-server" 2>/dev/null; pgrep -f "next start" 2>/dev/null; puerto_ocupado; } | sort -u )
for pid in $CANDIDATOS; do
  [ -n "$pid" ] || continue
  if es_mafer "$pid"; then
    kill "$pid" 2>/dev/null && DETENIDOS=$((DETENIDOS + 1))
  fi
done
if [ "$DETENIDOS" -gt 0 ]; then
  echo "   Detenido(s) $DETENIDOS servidor(es) anteriores de Mafer OS."
  # esperar a que suelten el puerto; forzar solo si es nuestro y no responde
  for _ in $(seq 1 20); do
    OCUPA=$(puerto_ocupado)
    [ -z "$OCUPA" ] && break
    sleep 0.5
  done
  OCUPA=$(puerto_ocupado)
  if [ -n "$OCUPA" ] && es_mafer "$OCUPA"; then
    kill -9 "$OCUPA" 2>/dev/null
    sleep 1
  fi
fi

# Si el puerto sigue ocupado, es de OTRO programa: no lo tocamos.
OCUPA=$(puerto_ocupado)
if [ -n "$OCUPA" ]; then
  fail "El puerto $PORT está ocupado por otro programa (PID $OCUPA) que NO es Mafer OS. Ciérralo tú, o arranca con otro puerto: PORT=3457 «Abrir Mafer OS.command»."
fi

# ── Dependencias y configuración inicial ────────────────────────────
if [ ! -d node_modules ]; then
  echo "📦 Primera vez: instalando dependencias (unos minutos)…"
  npm install >> "$LOG" 2>&1 || fail "No se pudieron instalar las dependencias."
fi
[ -f .env.local ] || npm run setup >> "$LOG" 2>&1

# ── 5. Compilar solo cuando hace falta ──────────────────────────────
HEAD=$(git rev-parse --short HEAD 2>/dev/null || echo "sin-git")
INFO="src/generated/build-info.json"
NECESITA_BUILD=1
if [ -d .next ] && [ -f "$INFO" ]; then
  BUILT=$(sed -n 's/.*"commit": *"\([^"]*\)".*/\1/p' "$INFO")
  BUILT_DIRTY=$(grep -c '"dirty": true' "$INFO" 2>/dev/null || true)
  AHORA_DIRTY=$(git status --porcelain 2>/dev/null | head -1)
  if [ "$BUILT" = "$HEAD" ] && [ "${BUILT_DIRTY:-0}" = "0" ] && [ -z "$AHORA_DIRTY" ]; then
    NECESITA_BUILD=0
  fi
fi
if [ "$NECESITA_BUILD" = 1 ]; then
  echo "🛠  Preparando la versión actual ($HEAD)… puede tardar un minuto."
  npm run build >> "$LOG" 2>&1 || fail "La compilación falló."
else
  echo "✅ El build ya corresponde a la versión actual ($HEAD)."
fi

# ── 6-7. Arrancar y esperar a que responda ──────────────────────────
echo "🌿 Mafer OS está arrancando…"
: > "$LOG"
PORT="$PORT" npm run start >> "$LOG" 2>&1 &
SERVER_PID=$!

CODE=""
for _ in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "http://localhost:$PORT/login" 2>/dev/null || true)
  [ "$CODE" = "200" ] && break
  kill -0 "$SERVER_PID" 2>/dev/null || fail "El servidor se detuvo inesperadamente al arrancar."
  sleep 1
done
[ "$CODE" = "200" ] || { kill "$SERVER_PID" 2>/dev/null; fail "La app no respondió a tiempo (60 s)."; }

HOSTNAME=$(scutil --get LocalHostName 2>/dev/null | tr '[:upper:]' '[:lower:]')
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo ""
echo "🌿 Mafer OS está listo — versión $HEAD."
echo ""
echo "   En esta Mac:       http://localhost:$PORT"
[ -n "$HOSTNAME" ] && echo "   En tu iPhone/iPad: http://$HOSTNAME.local:$PORT   (misma red Wi-Fi)"
[ -n "$IP" ] && echo "   (alternativa):     http://$IP:$PORT"
echo ""
echo "   Comprueba la versión al final de Ajustes. Deja esta ventana abierta;"
echo "   para apagar, ciérrala."
echo ""

# ── 8. Abrir Safari ─────────────────────────────────────────────────
if [ -z "${MAFER_NO_OPEN:-}" ]; then
  open -a Safari "http://localhost:$PORT"
fi

wait "$SERVER_PID"
