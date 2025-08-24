#!/bin/bash

echo "🛑 Остановка мониторинга LLM API"
echo "==============================="

# Проверяем наличие PID файла
if [ -f "monitoring.pid" ]; then
    MONITOR_PID=$(cat monitoring.pid)
    
    # Проверяем, что процесс существует
    if kill -0 $MONITOR_PID 2>/dev/null; then
        echo "🔄 Остановка процесса мониторинга (PID: $MONITOR_PID)..."
        kill $MONITOR_PID
        
        # Ждем завершения
        sleep 2
        
        # Принудительно убиваем если не завершился
        if kill -0 $MONITOR_PID 2>/dev/null; then
            echo "⚠️  Принудительная остановка..."
            kill -9 $MONITOR_PID
        fi
        
        echo "✅ Мониторинг остановлен"
    else
        echo "⚠️  Процесс мониторинга уже не запущен"
    fi
    
    # Удаляем PID файл
    rm monitoring.pid
else
    echo "⚠️  PID файл не найден, ищем процессы mitmproxy..."
    
    # Ищем и убиваем все процессы mitmproxy
    MITM_PIDS=$(pgrep -f "mitm_llm_monitor.py")
    if [ ! -z "$MITM_PIDS" ]; then
        echo "🔄 Найдены процессы mitmproxy: $MITM_PIDS"
        kill $MITM_PIDS
        echo "✅ Процессы остановлены"
    else
        echo "ℹ️  Процессы мониторинга не найдены"
    fi
fi

echo ""
echo "🧹 Очистка..."

# Отключаем прокси переменные если они были установлены
unset HTTP_PROXY
unset HTTPS_PROXY
unset http_proxy
unset https_proxy

echo "✅ Переменные прокси очищены"
echo "🎉 Мониторинг полностью остановлен"
