#!/bin/bash

echo "🚀 Запуск Afina Chat Application"
echo "================================="

# Проверяем, что мы в правильной директории
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Ошибка: Запустите скрипт из корневой директории проекта"
    exit 1
fi

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
    
    # Устанавливаем зависимости
    echo "📦 Установка зависимостей Python..."
    pip install -r requirements.txt
    
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
    
    # Убиваем все процессы uvicorn и next
    pkill -f "uvicorn" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    
    echo "👋 До свидания!"
    exit 0
}

# Обработчик сигналов для корректной остановки
trap cleanup SIGINT SIGTERM

# Запускаем серверы
start_backend
sleep 3  # Даем время backend'у запуститься
start_frontend

echo ""
echo "✅ Серверы запущены!"
echo "📍 Backend API: http://localhost:8000"
echo "📍 Frontend: http://localhost:3000"
echo "📋 API документация: http://localhost:8000/docs"
echo ""
echo "💡 Нажмите Ctrl+C для остановки всех серверов"
echo ""

# Ждем сигнала завершения
wait
