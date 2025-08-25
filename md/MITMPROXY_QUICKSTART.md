# 🎯 MIT Proxy - Быстрый старт для мониторинга LLM API

## Что это дает?

Mitmproxy позволяет видеть **все HTTP/HTTPS запросы** от вашего агента к LLM провайдерам:
- ✅ Полные запросы и ответы OpenAI, Anthropic, Google AI
- ✅ Время выполнения запросов
- ✅ Размер данных
- ✅ Коды ошибок
- ✅ Возможность повторить/модифицировать запросы

## 🚀 Быстрый запуск

### Вариант 1: Python скрипт (рекомендуется)
```bash
python start_mitmproxy.py
```

### Вариант 2: Shell скрипт
```bash
./monitor_llm.sh
```

### Вариант 3: Вручную
```bash
# Установка (если нужно)
pip install mitmproxy

# Запуск веб-интерфейса
mitmweb --listen-port 8080 --web-port 8081
```

## 📱 Доступ к интерфейсу

После запуска откройте: **http://127.0.0.1:8081**

**❗ Токен авторизации НЕ требуется** при локальном использовании

## 🔧 Настройка вашего агента

### Способ 1: Переменные окружения (рекомендуется)
```bash
export HTTP_PROXY=http://127.0.0.1:8080
export HTTPS_PROXY=http://127.0.0.1:8080

# Запуск вашего агента
python backend/start.py
```

### Способ 2: Запуск с прокси
```bash
HTTP_PROXY=http://127.0.0.1:8080 HTTPS_PROXY=http://127.0.0.1:8080 python backend/start.py
```

### Способ 3: В коде Python
```python
import os
os.environ['HTTP_PROXY'] = 'http://127.0.0.1:8080'
os.environ['HTTPS_PROXY'] = 'http://127.0.0.1:8080'

# Или для requests
import requests
proxies = {'http': 'http://127.0.0.1:8080', 'https': 'http://127.0.0.1:8080'}
response = requests.get('https://api.openai.com/...', proxies=proxies)
```

## 🔍 Полезные фильтры в веб-интерфейсе

В поле "Filter" введите:

```
# Только OpenAI
~d api.openai.com

# Только Anthropic
~d api.anthropic.com

# Только Google AI
~d generativelanguage.googleapis.com

# Все AI провайдеры
~d "api.openai.com|api.anthropic.com|generativelanguage.googleapis.com"

# Только POST запросы к AI
~m POST ~d "openai.com|anthropic.com|googleapis.com"

# Только ошибки
~c 4xx

# Медленные запросы (>2 сек)
~t ">2000"
```

## 🔒 Настройка HTTPS (обязательно!)

### macOS
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ~/.mitmproxy/mitmproxy-ca-cert.pem
```

### Linux
```bash
sudo cp ~/.mitmproxy/mitmproxy-ca-cert.pem /usr/local/share/ca-certificates/mitmproxy-ca-cert.crt
sudo update-ca-certificates
```

### Windows
1. Откройте `mmc.exe` 
2. File → Add/Remove Snap-in → Certificates → Add → Computer account
3. Certificates → Trusted Root → Import → `~/.mitmproxy/mitmproxy-ca-cert.pem`

## 💡 Тестирование

1. **Запустите mitmproxy**
2. **Настройте прокси** для вашего агента
3. **Откройте веб-интерфейс**: http://127.0.0.1:8081
4. **Примените фильтр**: `~d api.openai.com`
5. **Протестируйте агента** - отправьте запрос
6. **Увидьте запрос в mitmproxy!** 🎉

## 🔧 Интеграция с shell скриптом

```bash
# Запуск агента через прокси одной командой
./monitor_llm.sh python backend/start.py
```

## 📊 Что вы увидите

- **Request**: Полный JSON запрос к OpenAI/Anthropic
- **Response**: Ответ модели
- **Headers**: API ключи, User-Agent, и т.д.
- **Timing**: Время выполнения запроса
- **Size**: Размер запроса/ответа

## 🛑 Остановка

Нажмите `Ctrl+C` в терминале где запущен mitmproxy

---

## Примеры использования

### Тестирование разных LLM провайдеров
```bash
# Терминал 1: Запуск мониторинга
python start_mitmproxy.py

# Терминал 2: Тест OpenAI
HTTP_PROXY=http://127.0.0.1:8080 python test_openai.py

# Терминал 3: Тест Anthropic
HTTP_PROXY=http://127.0.0.1:8080 python test_anthropic.py
```

### Мониторинг вашего чат-агента
```bash
# Запуск с мониторингом
HTTP_PROXY=http://127.0.0.1:8080 HTTPS_PROXY=http://127.0.0.1:8080 python backend/start.py
```

Теперь **все запросы** вашего агента будут видны в удобном веб-интерфейсе! 🎯
