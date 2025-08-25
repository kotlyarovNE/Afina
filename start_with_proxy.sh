#!/bin/bash

echo "🚀 Запуск Afina Chat Application с MIT Proxy"
echo "=============================================="

# Проверяем, что мы в правильной директории
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Ошибка: Запустите скрипт из корневой директории проекта"
    exit 1
fi

# Проверяем аргументы
START_PROXY=false
if [ "$1" = "--proxy" ] || [ "$1" = "-p" ]; then
    START_PROXY=true
    echo "🔍 MIT Proxy будет запущен для мониторинга трафика"
fi

# Функция для запуска MIT Proxy
start_proxy() {
    if [ "$START_PROXY" = true ]; then
        echo "🔍 Запуск MIT Proxy..."
        cd backend
        python start_proxy.py start --no-browser &
        PROXY_PID=$!
        echo "✅ MIT Proxy запущен (PID: $PROXY_PID)"
        echo "🌐 Web интерфейс: http://localhost:8081"
        echo "🔗 Прокси: localhost:8080"
        cd ..
        
        # Небольшая задержка для запуска прокси
        sleep 2
    fi
}

# Функция для запуска backend
start_backend() {
    echo "🔧 Запуск Backend (FastAPI)..."
    cd backend
    
    # Проверяем наличие виртуального окружения
    if [ ! -d "venv" ]; then
        echo "📦 Создание виртуального окружения..."
        python3 -m venv venv
    fi
    
    # Активируем виртуальное окружение
    source venv/bin/activate
    
    # Устанавливаем зависимости (включая mitmproxy если нужен)
    echo "📦 Установка зависимостей Python..."
    pip install -r requirements.txt
    
    if [ "$START_PROXY" = true ]; then
        echo "📦 Установка mitmproxy для мониторинга..."
        pip install mitmproxy
    fi
    
    # Настраиваем переменные окружения для прокси если нужно
    if [ "$START_PROXY" = true ]; then
        export HTTP_PROXY=http://localhost:8080
        export HTTPS_PROXY=http://localhost:8080
        echo "🔗 Настроен прокси для backend: localhost:8080"
    fi
    
    # Запускаем сервер
    echo "🚀 Запуск FastAPI сервера на http://localhost:8000"
    python start.py &
    BACKEND_PID=$!
    
    cd ..
    return 0
}

# Функция для запуска frontend
start_frontend() {
    echo "🎨 Запуск Frontend (Next.js)..."
    cd frontend
    
    # Проверяем наличие node_modules
    if [ ! -d "node_modules" ]; then
        echo "📦 Установка зависимостей Node.js..."
        npm install
    fi
    
    # Настраиваем прокси для npm если нужно
    if [ "$START_PROXY" = true ]; then
        export HTTP_PROXY=http://localhost:8080
        export HTTPS_PROXY=http://localhost:8080
        echo "🔗 Настроен прокси для frontend: localhost:8080"
    fi
    
    # Запускаем сервер разработки
    echo "🚀 Запуск Next.js сервера на http://localhost:3000"
    npm run dev &
    FRONTEND_PID=$!
    
    cd ..
    return 0
}

# Функция для остановки серверов
cleanup() {
    echo ""
    echo "🛑 Остановка серверов..."
    
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
        echo "✅ Backend остановлен"
    fi
    
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        echo "✅ Frontend остановлен"
    fi
    
    if [ ! -z "$PROXY_PID" ]; then
        kill $PROXY_PID 2>/dev/null
        echo "✅ MIT Proxy остановлен"
    fi
    
    # Убиваем все процессы
    pkill -f "uvicorn" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    pkill -f "mitmweb" 2>/dev/null
    pkill -f "mitmdump" 2>/dev/null
    
    echo "👋 До свидания!"
    exit 0
}

# Обработчик сигналов для корректной остановки
trap cleanup SIGINT SIGTERM

# Показываем справку если нужно
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Использование: $0 [--proxy|-p]"
    echo ""
    echo "Опции:"
    echo "  --proxy, -p    Запустить с MIT Proxy для мониторинга трафика"
    echo "  --help, -h     Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0              # Обычный запуск"
    echo "  $0 --proxy     # Запуск с мониторингом трафика"
    exit 0
fi

# Запускаем сервисы
start_proxy     # Запускаем прокси если нужно
start_backend   # Запускаем backend
sleep 3         # Даем время backend'у запуститься
start_frontend  # Запускаем frontend

echo ""
echo "✅ Серверы запущены!"
echo "📍 Backend API: http://localhost:8000"
echo "📍 Frontend: http://localhost:3000"
echo "📋 API документация: http://localhost:8000/docs"

if [ "$START_PROXY" = true ]; then
    echo "🔍 MIT Proxy Web UI: http://localhost:8081"
    echo "🔗 Прокси адрес: localhost:8080"
    echo ""
    echo "📋 НАСТРОЙКА СИСТЕМНОГО ПРОКСИ (опционально):"
    echo "   HTTP Proxy: localhost:8080"
    echo "   HTTPS Proxy: localhost:8080"
    echo ""
    echo "📋 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ ДЛЯ ПРИЛОЖЕНИЙ:"
    echo "   export HTTP_PROXY=http://localhost:8080"
    echo "   export HTTPS_PROXY=http://localhost:8080"
fi

echo ""
echo "💡 Нажмите Ctrl+C для остановки всех серверов"
echo ""

# Ждем сигнала завершения
wait
