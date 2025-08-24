# 🔍 Система мониторинга LLM API

Система для отслеживания всех запросов к LLM API (OpenAI, Anthropic, Google, Cohere) с красивым веб-интерфейсом.

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
cd backend
pip install -r requirements.txt
```

### 2. Запуск мониторинга
```bash
# Из корневой директории проекта
./start_monitoring.sh
```

### 3. Включение мониторинга в агенте
```bash
export ENABLE_LLM_MONITORING=true
```

### 4. Запуск вашего API
```bash
# В отдельном терминале
./start.sh
```

### 5. Открытие веб-интерфейса
- 🌐 **Веб-интерфейс mitmproxy**: http://localhost:8081
- 📄 **Консольные логи**: `tail -f monitoring.log`

## 🖥️ Интерфейсы мониторинга

### Веб-интерфейс (рекомендуется)
```
http://localhost:8081
```

**Возможности:**
- 📊 Красивый UI для просмотра запросов
- 🔍 Фильтрация по URL, методу, статусу
- 📝 Детальный просмотр JSON запросов/ответов
- 💾 Экспорт данных
- 🔄 Реплей запросов

### Консольный вывод
```bash
tail -f monitoring.log
```

**Что отображается:**
- 🤖 Тип LLM провайдера (OpenAI, Anthropic, etc.)
- 💬 Сообщения чата (последние 3)
- 🧠 Модель и параметры
- 💭 Ответ агента (превью 300 символов)
- 🔢 Использование токенов

## 📋 Пример вывода в консоли

```
================================================================================
🤖 LLM REQUEST #1 - OPENAI
================================================================================
📅 Time: 2024-01-15T10:30:45.123Z
🌐 URL: https://api.openai.com/v1/chat/completions
📝 Method: POST
📋 Headers: {
  "authorization": "Bearer sk-...",
  "content-type": "application/json"
}
💬 Messages (3):
   1. system: You are Afina, an intelligent assistant...
   2. user: Проанализируй загруженный файл rnn.txt
   3. assistant: Начинаю анализ документа...
🧠 Model: gpt-4o-mini
🌡️  Temperature: 0
📏 Max tokens: 4000

──────────────────────────────── RESPONSE ────────────────────────────────────
📊 Status: 200
💭 Response: Анализ файла rnn.txt показывает следующее:
1. Документ содержит отчет о разработке модели RNN
2. Основные разделы включают введение, данные, архитектуру...
🔢 Tokens: 1250 (prompt: 800, completion: 450)
================================================================================
```

## ⚙️ Настройка

### Переменные окружения

```bash
# Включить мониторинг
export ENABLE_LLM_MONITORING=true

# Настройка прокси (если нужно изменить порты)
export MITM_PROXY_PORT=8080      # Порт прокси (по умолчанию 8080)
export MITM_WEB_PORT=8081        # Порт веб-интерфейса (по умолчанию 8081)
```

### Файл .env для агента
```bash
# backend/app/.env
ENABLE_LLM_MONITORING=true
OPENAI_API_KEY=your_api_key_here
```

## 🔧 Ручная настройка

Если нужна более тонкая настройка:

### 1. Запуск мониторинга вручную
```bash
cd backend
python monitoring/mitm_llm_monitor.py
```

### 2. Включение прокси в коде
```python
from monitoring import enable_llm_monitoring, disable_llm_monitoring

# В начале функции
enable_llm_monitoring()

try:
    # Ваш код с LLM вызовами
    result = llm.invoke(messages)
finally:
    # В конце функции
    disable_llm_monitoring()
```

### 3. Использование декоратора
```python
from monitoring import monitor_llm_calls

@monitor_llm_calls
def my_function_with_llm():
    # LLM вызовы будут мониториться автоматически
    return llm.invoke(messages)
```

## 🛑 Остановка мониторинга

```bash
./stop_monitoring.sh
```

Или вручную:
```bash
# Найти и убить процесс
pkill -f mitm_llm_monitor.py

# Очистить переменные прокси
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy
```

## 🎯 Поддерживаемые LLM провайдеры

- ✅ **OpenAI** (`api.openai.com`)
- ✅ **Anthropic** (`api.anthropic.com`)
- ✅ **Google** (`generativelanguage.googleapis.com`)
- ✅ **Cohere** (`api.cohere.ai`)
- ✅ **HuggingFace** (`api-inference.huggingface.co`)

## 🐛 Решение проблем

### Прокси не работает
```bash
# Проверить, что мониторинг запущен
curl http://localhost:8080

# Проверить переменные окружения
echo $HTTP_PROXY $HTTPS_PROXY
```

### Запросы не отображаются
```bash
# Убедиться, что мониторинг включен
export ENABLE_LLM_MONITORING=true

# Проверить логи
tail -f monitoring.log
```

### Веб-интерфейс недоступен
```bash
# Проверить, что порт 8081 свободен
lsof -i :8081

# Перезапустить мониторинг
./stop_monitoring.sh
./start_monitoring.sh
```

## 💡 Полезные команды

```bash
# Просмотр всех запросов в реальном времени
tail -f monitoring.log | grep "🤖 LLM REQUEST"

# Подсчет количества запросов
grep "🤖 LLM REQUEST" monitoring.log | wc -l

# Фильтрация по провайдеру
grep "OPENAI" monitoring.log

# Мониторинг использования токенов
grep "🔢 Tokens" monitoring.log
```

## 📈 Анализ использования

Веб-интерфейс mitmproxy предоставляет:

- 📊 **Статистика запросов** по времени
- 💰 **Анализ затрат** на токены
- 🕐 **Время ответа** для каждого запроса
- 🔄 **Повторение запросов** для тестирования
- 💾 **Экспорт данных** в HAR/JSON формате

## 🎉 Готово!

Теперь вы можете видеть все LLM запросы в удобном интерфейсе и анализировать работу вашего агента!
