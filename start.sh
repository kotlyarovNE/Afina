#!/bin/bash
set -euo pipefail

echo "🚀 Запуск Afina Chat Application"
echo "================================="

# ---- Настройки ----
PROXY_PORT=8080
WEB_PORT=8081
PROXY_URL="http://127.0.0.1:${PROXY_PORT}"
WEB_URL="http://127.0.0.1:${WEB_PORT}"
CERT_PATH="$HOME/.mitmproxy/mitmproxy-ca-cert.pem"

# Сгенерируем токен (твой «пароль») один раз на запуск
MITM_TOKEN="$(python3 - <<'PY'
import secrets; print(secrets.token_urlsafe(32))
PY
)"
echo "🔑 Mitmweb токен: ${MITM_TOKEN}"

# ---- Запуск mitmweb СНАЧАЛА ----
echo "🔧 Стартуем mitmweb..."
mitmweb \
--listen-host 127.0.0.1 --listen-port 8080 \
--web-host 127.0.0.1 --web-port 8081 \
--set web_open_browser=false \
--set stream_large_bodies=5m \
--set web_password="${MITM_TOKEN}" \
--set view_filter='~m "(?i)POST" & ~d "(api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.mistral\.ai|openrouter\.ai|api\.perplexity\.ai|api\.together\.xyz)"' \
> .mitmweb.log 2>&1 &

MITM_PID=$!

# Немного подождать чтобы порт поднялся
sleep 2

if ! kill -0 "$MITM_PID" 2>/dev/null; then
  echo "❌ Не удалось запустить mitmweb. Смотри ./.mitmweb.log"
  exit 1
fi

# ---- Доверяем CA mitmproxy (один раз на машине) ----
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS: после первого запуска у тебя появится $CERT_PATH
  if [ -f "$CERT_PATH" ]; then
    echo "🔒 Если не делал этого раньше, добавь CA в системные доверенные (разово):"
    echo "sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain $CERT_PATH"
  fi
fi

# ---- Прокидываем прокси и сертификаты ДО запуска бэка/фронта ----
export HTTP_PROXY="$PROXY_URL"
export HTTPS_PROXY="$PROXY_URL"
export ALL_PROXY="$PROXY_URL"
export NO_PROXY="localhost,127.0.0.1"

# Python/Requests/httpx/OpenAI клиент (используют certifi) будет доверять этому CA:
export REQUESTS_CA_BUNDLE="$CERT_PATH"
export SSL_CERT_FILE="$CERT_PATH"
export CURL_CA_BUNDLE="$CERT_PATH"

# Node.js (Next.js) пусть тоже доверяет:
export NODE_EXTRA_CA_CERTS="$CERT_PATH"

echo "📍 Mitmweb UI: ${WEB_URL}/?token=${MITM_TOKEN}"
echo "   (или используй заголовок Authorization: Bearer ${MITM_TOKEN})"

# ---- (опционально) Глобальный системный прокси на macOS для ВСЕГО трафика ----
# Включай, только если реально хочешь весь трафик системы:
# networksetup -setwebproxy "Wi-Fi" 127.0.0.1 ${PROXY_PORT}
# networksetup -setsecurewebproxy "Wi-Fi" 127.0.0.1 ${PROXY_PORT}
# networksetup -setwebproxystate "Wi-Fi" on
# networksetup -setsecurewebproxystate "Wi-Fi" on

# ---- Дальше стартуем backend ----
echo "🔧 Запуск Backend (FastAPI)..."
pushd backend >/dev/null
if [ ! -d "venv" ]; then python3 -m venv venv; fi
source venv/bin/activate

# (необязательно) приглушить bcrypt-спам: зафиксировать версию
# pip install 'bcrypt==4.0.1' 'passlib>=1.7.4' >/dev/null

pip install -r requirements.txt
python start.py &
BACKEND_PID=$!
popd >/dev/null

# ---- И frontend ----
echo "🎨 Запуск Frontend (Next.js)..."
pushd frontend >/dev/null
if [ ! -d "node_modules" ]; then npm install; fi
npm run dev &
FRONTEND_PID=$!
popd >/dev/null

cleanup() {
  echo ""
  echo "🛑 Остановка..."
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${MITM_PID:-}" ] && kill "$MITM_PID" 2>/dev/null || true

  # (если включал системный прокси – не забудь выключить)
  # networksetup -setwebproxystate "Wi-Fi" off
  # networksetup -setsecurewebproxystate "Wi-Fi" off
  echo "👋 До встречи!"
}
trap cleanup EXIT INT TERM

echo ""
echo "✅ Всё поднялось!"
echo "📍 Backend:  http://localhost:8000"
echo "📍 Frontend: http://localhost:3000"
echo "📋 Docs:     http://localhost:8000/docs"
echo "🧪 Mitmweb:  ${WEB_URL}/?token=${MITM_TOKEN}"
echo ""

# Держим скрипт живым
wait
