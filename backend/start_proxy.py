#!/usr/bin/env python3
"""
Скрипт для запуска MIT Proxy мониторинга
Использование: python start_proxy.py [start|stop|status]
"""

import sys
import os
from pathlib import Path

# Добавляем путь к модулям
sys.path.insert(0, str(Path(__file__).parent))

from monitoring.proxy_manager import get_manager
import argparse


def main():
    parser = argparse.ArgumentParser(description="MIT Proxy Manager для Afina")
    parser.add_argument('action', nargs='?', default='start', 
                       choices=['start', 'stop', 'status'],
                       help='Действие: start, stop, status (по умолчанию: start)')
    parser.add_argument('--web-port', type=int, default=8081,
                       help='Порт для web интерфейса (по умолчанию: 8081)')
    parser.add_argument('--proxy-port', type=int, default=8080,
                       help='Порт для прокси (по умолчанию: 8080)')
    parser.add_argument('--no-browser', action='store_true',
                       help='Не открывать браузер автоматически')
    
    args = parser.parse_args()
    
    print("🔍 MIT Proxy Manager для Afina")
    print("================================")
    
    manager = get_manager()
    
    if args.action == 'start':
        print("🚀 Запуск MIT Proxy...")
        success = manager.start(open_browser=not args.no_browser)
        if success:
            print("\n✅ MIT Proxy запущен успешно!")
            print(f"🌐 Web интерфейс: http://localhost:{manager.web_port}")
            print(f"🔗 Прокси: localhost:{manager.proxy_port}")
            print("\n💡 Теперь настройте ваше приложение для использования прокси:")
            print(f"   HTTP_PROXY=http://localhost:{manager.proxy_port}")
            print(f"   HTTPS_PROXY=http://localhost:{manager.proxy_port}")
            print("\n⚠️  Для HTTPS может потребоваться установка сертификата MIT.")
            print("   Инструкции: https://docs.mitmproxy.org/stable/concepts-certificates/")
            
            try:
                print("\n💡 Нажмите Ctrl+C для остановки...")
                while manager.is_running():
                    import time
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\n🛑 Остановка MIT Proxy...")
                manager.stop()
        else:
            print("❌ Ошибка запуска MIT Proxy")
            sys.exit(1)
            
    elif args.action == 'stop':
        print("🛑 Остановка MIT Proxy...")
        success = manager.stop()
        if success:
            print("✅ MIT Proxy остановлен")
        else:
            print("❌ Ошибка остановки MIT Proxy")
            sys.exit(1)
            
    elif args.action == 'status':
        status = manager.get_status()
        print(f"📊 Статус: {'🟢 Запущен' if status.is_running else '🔴 Остановлен'}")
        if status.is_running:
            print(f"🆔 PID: {status.pid}")
            print(f"🌐 Web UI: {status.web_url}")
            print(f"🔗 Proxy: {status.proxy_url}")


if __name__ == "__main__":
    main()
