# MIT Proxy Setup для мониторинга API вызовов

## 🎯 Назначение

MIT Proxy позволяет перехватывать и анализировать все HTTP/HTTPS запросы от вашего приложения к внешним API (OpenAI, Anthropic, etc.) в удобном web интерфейсе.

## 🚀 Быстрый старт

### Вариант 1: Запуск всего проекта с прокси
```bash
./start_with_proxy.sh --proxy
```

### Вариант 2: Запуск только прокси
```bash
cd backend
python start_proxy.py start
```

### Вариант 3: Управление через API
```bash
# Запуск
curl -X POST http://localhost:8000/api/proxy/start

# Статус
curl http://localhost:8000/api/proxy/status

# Остановка
curl -X POST http://localhost:8000/api/proxy/stop
```

## 🔧 Настройка

После запуска MIT Proxy будет доступен:
- **Web интерфейс**: http://localhost:8081
- **Прокси адрес**: localhost:8080

### Настройка для Python приложений
```bash
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=http://localhost:8080
```

### Настройка для отдельных запросов
```python
import requests

proxies = {
    'http': 'http://localhost:8080',
    'https': 'http://localhost:8080'
}

response = requests.get('https://api.openai.com/v1/models', 
                       proxies=proxies, headers=headers)
```

### Настройка для OpenAI клиента
```python
import openai
import httpx

# Создаем HTTP клиент с прокси
http_client = httpx.Client(
    proxies={
        'http://': 'http://localhost:8080',
        'https://': 'http://localhost:8080'
    }
)

client = openai.OpenAI(
    api_key="your-api-key",
    http_client=http_client
)
```

## 🌐 Системный прокси (глобальный)

### Windows
1. Settings → Network & Internet → Proxy
2. Manual proxy setup: ON
3. HTTP Proxy: `localhost:8080`
4. HTTPS Proxy: `localhost:8080`

### macOS
1. System Preferences → Network
2. Advanced → Proxies
3. Web Proxy (HTTP): `localhost:8080`
4. Secure Web Proxy (HTTPS): `localhost:8080`

### Linux (Ubuntu/Debian)
```bash
# Временно (только для текущей сессии)
export HTTP_PROXY=http://localhost:8080
export HTTPS_PROXY=http://localhost:8080

# Постоянно (добавить в ~/.bashrc или ~/.profile)
echo 'export HTTP_PROXY=http://localhost:8080' >> ~/.bashrc
echo 'export HTTPS_PROXY=http://localhost:8080' >> ~/.bashrc
```

### Через GUI в Linux
Settings → Network → Network Proxy → Manual:
- HTTP Proxy: `localhost:8080`
- HTTPS Proxy: `localhost:8080`

## 🔒 HTTPS сертификаты

Для перехвата HTTPS трафика может потребоваться установка корневого сертификата MIT:

### Автоматическая установка
При первом запуске MIT Proxy создаст сертификат в `~/.mitmproxy/mitmproxy-ca-cert.pem`

### Ручная установка сертификата

#### Windows
1. Перейдите в http://mitm.it (при запущенном прокси)
2. Скачайте сертификат для Windows
3. Установите в "Trusted Root Certification Authorities"

#### macOS
```bash
# Скачайте сертификат
curl --proxy localhost:8080 -o mitmproxy-ca-cert.pem http://mitm.it/cert/pem

# Установите
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain mitmproxy-ca-cert.pem
```

#### Linux
```bash
# Скачайте сертификат
curl --proxy localhost:8080 -o mitmproxy-ca-cert.crt http://mitm.it/cert/pem

# Установите (Ubuntu/Debian)
sudo cp mitmproxy-ca-cert.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

## 📊 Использование Web интерфейса

После запуска откройте http://localhost:8081 где вы увидите:

- **Flow List**: Список всех перехваченных запросов
- **Request/Response**: Детали запросов и ответов
- **Filter**: Фильтрация по домену, методу, статусу
- **Search**: Поиск по содержимому

### Полезные фильтры
- `~d api.openai.com` - только OpenAI запросы
- `~m POST` - только POST запросы
- `~c 200` - только успешные ответы
- `~t "application/json"` - только JSON

## 🔧 Команды управления

### Через скрипт
```bash
# Запуск
python backend/start_proxy.py start

# Остановка
python backend/start_proxy.py stop

# Статус
python backend/start_proxy.py status

# Запуск без браузера
python backend/start_proxy.py start --no-browser

# Другие порты
python backend/start_proxy.py start --web-port 8082 --proxy-port 8081
```

### Через API
```bash
# Проверка доступности
curl http://localhost:8000/api/proxy/status

# Запуск
curl -X POST http://localhost:8000/api/proxy/start

# Остановка  
curl -X POST http://localhost:8000/api/proxy/stop
```

## 🐛 Troubleshooting

### Прокси не запускается
1. Проверьте, что порты 8080 и 8081 свободны
2. Установите mitmproxy: `pip install mitmproxy`
3. Проверьте права на запись в ~/.mitmproxy

### Не видны HTTPS запросы
1. Установите сертификат MIT (см. выше)
2. Перезапустите браузер/приложение
3. Проверьте настройки прокси

### Приложение не работает с прокси
1. Некоторые приложения игнорируют системный прокси
2. Используйте переменные окружения HTTP_PROXY/HTTPS_PROXY
3. Настройте прокси в коде приложения

## 📝 Примеры использования

### Мониторинг OpenAI API
```python
import openai
import os

# Настройка прокси через переменные окружения
os.environ['HTTP_PROXY'] = 'http://localhost:8080'
os.environ['HTTPS_PROXY'] = 'http://localhost:8080'

client = openai.OpenAI(api_key="your-key")
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}]
)

# Все запросы будут видны в MIT Web UI
```

### Мониторинг через requests
```python
import requests

proxies = {'http': 'http://localhost:8080', 'https': 'http://localhost:8080'}

# Все эти запросы попадут в MIT
response = requests.get('https://api.openai.com/v1/models', proxies=proxies)
response = requests.post('https://api.anthropic.com/v1/messages', proxies=proxies)
```

## 🎛 Интеграция с Afina

MIT Proxy автоматически интегрирован в проект Afina:

1. **Запуск с проектом**: `./start_with_proxy.sh --proxy`
2. **API управление**: endpoints `/api/proxy/*`
3. **Автоустановка**: mitmproxy установится автоматически
4. **Мониторинг агента**: все вызовы LLM будут видны в web UI

Теперь вы можете легко отслеживать все API вызовы вашего агента к различным LLM провайдерам! 🎉
