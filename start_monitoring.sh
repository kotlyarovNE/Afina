#!/bin/bash

echo "🚀 Запуск системы мониторинга LLM API"
echo "=================================="

# Проверяем наличие виртуального окружения
if [ ! -d "backend/venv" ]; then
    echo "❌ Виртуальное окружение не найдено в backend/venv"
    echo "💡 Сначала запустите: cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
    exit 1
fi

# Активируем виртуальное окружение
source backend/venv/bin/activate

# Проверяем установку mitmproxy
if ! python -c "import mitmproxy" 2>/dev/null; then
    echo "📦 Установка mitmproxy..."
    pip install mitmproxy
fi

# Запускаем мониторинг в фоне
echo "🔍 Запуск LLM API мониторинга..."
echo "📱 Веб-интерфейс будет доступен: http://localhost:8081"
echo "🖥️  Консольный вывод в файле: monitoring.log"

# Запускаем скрипт мониторинга
cd backend
python monitoring/mitm_llm_monitor.py > ../monitoring.log 2>&1 &
MONITOR_PID=$!

echo "✅ Мониторинг запущен (PID: $MONITOR_PID)"
echo ""
echo "📋 Для использования установите переменную окружения:"
echo "   export ENABLE_LLM_MONITORING=true"
echo ""
echo "🌐 Откройте веб-интерфейс: http://localhost:8081"
echo "📄 Логи консоли: tail -f monitoring.log"
echo ""
echo "🛑 Для остановки: kill $MONITOR_PID"

# Сохраняем PID для удобства
echo $MONITOR_PID > monitoring.pid

echo ""
echo "⏳ Ожидание запуска (5 сек)..."
sleep 5

# Проверяем, что процесс запустился
if kill -0 $MONITOR_PID 2>/dev/null; then
    echo "✅ Мониторинг успешно запущен!"
    echo "🔗 Прокси: http://localhost:8080"
    echo "📱 Веб-UI: http://localhost:8081"
else
    echo "❌ Ошибка запуска мониторинга"
    echo "📄 Проверьте логи: cat monitoring.log"
fi
